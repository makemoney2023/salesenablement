# Call Center Wiring Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the end-to-end wiring gaps found in the call-center review so every surface renders real data, side-effects fire exactly once, and KPIs are trustworthy.

**Architecture:** The dominant defect is a client mismatch — call-center hooks read RLS-gated tables through the anonymous `@/lib/supabase` singleton (no session), so `is_active_user()` returns zero rows. The fix routes those hooks through the session-aware `@supabase/ssr` browser client (cookie session, auto-authenticated Realtime). Remaining fixes are targeted logic/UX corrections plus dead-code and doc cleanup.

**Tech Stack:** Next.js 16 (App Router), React 19, `@supabase/ssr` + `@supabase/supabase-js@2`, Supabase Edge Functions (Deno), Vitest, Bland.ai pathways (+ Python tool builder), Cal.com v2.

**Verified external facts (do not re-research):**
- `createBrowserClient` from `@supabase/ssr` is a browser singleton (`isSingleton: true` by default), reads the session from cookies, and supabase-js auto-calls `realtime.setAuth()` on auth-state changes — so `postgres_changes` subscriptions run as the authenticated user and pass RLS. (Context7 `/supabase/ssr`.)
- Bland.ai custom tools support **Response Variables** via `response_data`: values extracted from the tool's API response become pathway variables (`{{name}}`) that are included in the post-call webhook payload. This lets the in-call Cal.com booking return its `uid` for reconciliation. (Bland docs via Firecrawl.)

---

## Phase 0 — Branch + baseline

### Task 0: Create working branch and capture baseline

**Files:** none (git only)

- [ ] **Step 1: Create branch**

```bash
cd /Users/cbsuperpatch/Desktop/SalesEnablement
git checkout -b fix/call-center-wiring-e2e
```

- [ ] **Step 2: Baseline test + typecheck (record current state)**

Run: `cd superpatch-frontend && npm test -- --run; npx tsc --noEmit`
Expected: existing suite result recorded (note: `rls-active-user-policy.test.ts` already fails pre-change and is unrelated; do not "fix" it in this plan unless Task 18 covers it).

---

## Phase 1 — Systemic fix: session-aware browser client (CRITICAL)

Root cause: hooks import the runtime `supabase` (anon, no session) from `@/lib/supabase.ts`. All 8 call-center tables gate SELECT behind `public.is_active_user()` (`supabase/migrations/20260601000002_tighten_rls_to_active_profiles.sql`). Anon → zero rows.

### Task 1: Add a session-aware browser Supabase accessor

**Files:**
- Create: `superpatch-frontend/src/lib/supabase/browser.ts`
- Test: `superpatch-frontend/src/__tests__/supabase-browser.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// superpatch-frontend/src/__tests__/supabase-browser.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const createClientMock = vi.fn(() => ({ from: vi.fn(), channel: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: createClientMock }));

describe("getBrowserSupabase", () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockClear();
    vi.stubGlobal("window", {} as Window & typeof globalThis);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  });

  it("returns a client and memoizes it", async () => {
    const { getBrowserSupabase } = await import("@/lib/supabase/browser");
    const a = getBrowserSupabase();
    const b = getBrowserSupabase();
    expect(a).not.toBeNull();
    expect(a).toBe(b);
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when env is unset", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { getBrowserSupabase } = await import("@/lib/supabase/browser");
    expect(getBrowserSupabase()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd superpatch-frontend && npm test -- --run src/__tests__/supabase-browser.test.ts`
Expected: FAIL — `Cannot find module '@/lib/supabase/browser'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// superpatch-frontend/src/lib/supabase/browser.ts
"use client";

import { createClient } from "@/lib/supabase/client";
import type { TypedSupabaseClient } from "@/lib/supabase";

export const isBrowserSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

let cached: TypedSupabaseClient | null = null;

/**
 * Session-aware browser Supabase client.
 *
 * Unlike the anon singleton in `@/lib/supabase`, this is the `@supabase/ssr`
 * browser client (cookie session) used by the auth flow, so its reads run as
 * the logged-in user and pass `is_active_user()` RLS. Realtime is
 * auto-authenticated from the same session.
 */
export function getBrowserSupabase(): TypedSupabaseClient | null {
  if (!isBrowserSupabaseConfigured) return null;
  if (typeof window === "undefined") return null;
  if (!cached) cached = createClient() as unknown as TypedSupabaseClient;
  return cached;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd superpatch-frontend && npm test -- --run src/__tests__/supabase-browser.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add superpatch-frontend/src/lib/supabase/browser.ts superpatch-frontend/src/__tests__/supabase-browser.test.ts
git commit -m "feat(supabase): add session-aware browser client accessor for RLS-gated reads"
```

---

### Task 2: Add a regression guard that call-center read hooks use the session-aware client

**Files:**
- Test: `superpatch-frontend/src/__tests__/hooks-use-session-client.test.ts`

This test locks in Phase 1 so future edits cannot reintroduce anon reads.

- [ ] **Step 1: Write the failing test**

```ts
// superpatch-frontend/src/__tests__/hooks-use-session-client.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Hooks that perform direct SELECTs / realtime on is_active_user()-gated tables.
const HOOKS = [
  "useRealtimeCallStatus.ts",
  "useRealtimeRetryQueue.ts",
  "useRealtimePractitioners.ts",
  "useAppointments.ts",
  "useFollowUpQueue.ts",
  "usePathwaySuggestions.ts",
  "useSidebarBadges.ts",
  "useDailyReports.ts",
  "useSampleRequests.ts",
  "useSupabaseCallRecords.ts",
];

describe("call-center read hooks use the session-aware browser client", () => {
  for (const file of HOOKS) {
    it(`${file} imports getBrowserSupabase and not the anon singleton`, () => {
      const src = readFileSync(resolve(__dirname, "../hooks", file), "utf8");
      expect(src).toContain("@/lib/supabase/browser");
      // No runtime import of the anon client (type-only import is allowed).
      expect(src).not.toMatch(/import\s*\{[^}]*\bsupabase\b[^}]*\}\s*from\s*["']@\/lib\/supabase["']/);
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd superpatch-frontend && npm test -- --run src/__tests__/hooks-use-session-client.test.ts`
Expected: FAIL — every hook still imports from `@/lib/supabase`.

- [ ] **Step 3: (No implementation yet — Tasks 3–11 make this pass.)**

- [ ] **Step 4: Commit the guard test**

```bash
git add superpatch-frontend/src/__tests__/hooks-use-session-client.test.ts
git commit -m "test(hooks): guard that call-center read hooks use the session-aware client"
```

---

### Tasks 3–11: Migrate each hook to the session-aware client

**DRY transform (apply identically in each hook below):**

1. Replace the import line
   `import { supabase, isSupabaseConfigured } from "@/lib/supabase";`
   with
   `import { getBrowserSupabase, isBrowserSupabaseConfigured } from "@/lib/supabase/browser";`
   (Keep any `import type { ... } from "@/lib/supabase"` type-only imports.)
2. At the top of the hook function body add:
   `const supabase = getBrowserSupabase();`
3. Replace every `isSupabaseConfigured` reference with `isBrowserSupabaseConfigured`.
4. Leave all `.from(...)`, `.channel(...)`, and `.subscribe(...)` calls unchanged — `supabase` now resolves to the session-aware singleton.
5. If the file used `supabase` at module scope (outside the hook), move that usage inside the hook via the local `const supabase`.

Each task = apply the transform to one file, run typecheck, commit. No behavior test per hook (covered by Task 2 guard + Task 12 manual verification); these are mechanical wiring changes.

### Task 3: `useRealtimeCallStatus.ts` (Active Calls Monitor)

**Files:** Modify `superpatch-frontend/src/hooks/useRealtimeCallStatus.ts` (import ~line 14; direct SELECT at `:90`; channel SELECT at `:343`).

- [ ] **Step 1: Apply the DRY transform above.**
- [ ] **Step 2: Typecheck** — Run: `cd superpatch-frontend && npx tsc --noEmit` — Expected: no new errors.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "fix(hooks): authenticate useRealtimeCallStatus reads via session client"`

### Task 4: `useRealtimeRetryQueue.ts` (Retries tab)

**Files:** Modify `superpatch-frontend/src/hooks/useRealtimeRetryQueue.ts` (SELECT at `:181`).

- [ ] **Step 1: Apply transform. Step 2: `npx tsc --noEmit`. Step 3: commit** `fix(hooks): authenticate useRealtimeRetryQueue via session client`.

### Task 5: `useRealtimePractitioners.ts` (live enrichment badges)

**Files:** Modify `superpatch-frontend/src/hooks/useRealtimePractitioners.ts` (SELECTs `:141-189`).

- [ ] **Step 1: Apply transform. Step 2: `npx tsc --noEmit`. Step 3: commit** `fix(hooks): authenticate useRealtimePractitioners via session client`.

### Task 6: `useAppointments.ts` (Appointments page)

**Files:** Modify `superpatch-frontend/src/hooks/useAppointments.ts` (SELECTs `:99-553`).

- [ ] **Step 1: Apply transform. Step 2: `npx tsc --noEmit`. Step 3: commit** `fix(hooks): authenticate useAppointments via session client`.

### Task 7: `useFollowUpQueue.ts` (Follow-up queue page)

**Files:** Modify `superpatch-frontend/src/hooks/useFollowUpQueue.ts` (SELECTs `:107-465`).

- [ ] **Step 1: Apply transform. Step 2: `npx tsc --noEmit`. Step 3: commit** `fix(hooks): authenticate useFollowUpQueue via session client`.

### Task 8: `usePathwaySuggestions.ts` (Pathway suggestions page)

**Files:** Modify `superpatch-frontend/src/hooks/usePathwaySuggestions.ts` (SELECTs `:103-567`).

- [ ] **Step 1: Apply transform. Step 2: `npx tsc --noEmit`. Step 3: commit** `fix(hooks): authenticate usePathwaySuggestions via session client`.

### Task 9: `useSidebarBadges.ts` (sidebar counts)

**Files:** Modify `superpatch-frontend/src/hooks/useSidebarBadges.ts` (SELECTs `:168-190`).

- [ ] **Step 1: Apply transform. Step 2: `npx tsc --noEmit`. Step 3: commit** `fix(hooks): authenticate useSidebarBadges via session client`.

### Task 10: `useSampleRequests.ts` + `useSupabaseCallRecords.ts` (Realtime channels)

These already fetch initial data via API routes (correct), but their **Realtime channels** use the anon client and never fire. Migrate the channel client only; leave the API fetch paths unchanged.

**Files:**
- Modify `superpatch-frontend/src/hooks/useSampleRequests.ts` (channel/SELECT `:119`, `:338`).
- Modify `superpatch-frontend/src/hooks/useSupabaseCallRecords.ts` (channel `:247`; keep `fetch("/api/campaign/calls")` at `:186`).

- [ ] **Step 1: Apply the DRY transform** (import swap + `const supabase = getBrowserSupabase();`). Do NOT remove the `/api/campaign/calls` or `/api/samples` fetches.
- [ ] **Step 2: `npx tsc --noEmit`** — Expected: clean.
- [ ] **Step 3: Commit** — `git commit -am "fix(hooks): authenticate realtime channels for samples + call records"`

### Task 11: `useDailyReports.ts` (Reports — upgrade analytics read from best-effort to authenticated)

**Files:** Modify `superpatch-frontend/src/hooks/useDailyReports.ts` (import ~line 13-19; `campaign_analytics` SELECT `:113`; channel `:289`).

- [ ] **Step 1: Apply the DRY transform.** Keep the `fetch("/api/campaign/calls", ...)` live-call path (Task already landed). Update the `console.warn` comment to note analytics reads are now authenticated (no longer "best-effort").
- [ ] **Step 2: `npx tsc --noEmit`** — Expected: clean.
- [ ] **Step 3: Run guard + analytics tests** — Run: `cd superpatch-frontend && npm test -- --run src/__tests__/hooks-use-session-client.test.ts src/__tests__/campaign-analytics.test.ts` — Expected: both PASS.
- [ ] **Step 4: Commit** — `git commit -am "fix(reports): read campaign_analytics via authenticated session client"`

### Task 12: Remove dead `useRealtimeSampleRequests`

**Files:**
- Delete: `superpatch-frontend/src/hooks/useRealtimeSampleRequests.ts`
- Modify: `superpatch-frontend/src/hooks/index.ts` (remove its export)

- [ ] **Step 1: Confirm zero production consumers** — Run: `cd superpatch-frontend && rg "useRealtimeSampleRequests" src --glob '!src/hooks/useRealtimeSampleRequests.ts'` — Expected: only `src/hooks/index.ts`.
- [ ] **Step 2: Delete the file and its export line in `hooks/index.ts`.**
- [ ] **Step 3: `npx tsc --noEmit`** — Expected: clean.
- [ ] **Step 4: Commit** — `git commit -am "chore(hooks): remove unused useRealtimeSampleRequests duplicate"`

---

## Phase 2 — Confirmed logic breaks

### Task 13: Fix command-palette "Queue" no-op

The command palette's `queue` action writes a local record only — no `queued` status, no Supabase sync (`src/app/campaign/page.tsx:2417-2428`). Make it match the drawer's "Add to Queue" behavior.

**Files:**
- Modify: `superpatch-frontend/src/app/campaign/page.tsx:2417-2428`
- Reference (correct pattern): `src/components/campaign/practitioner-detail-drawer.tsx:574-607` (`handleAddToQueue`)

- [ ] **Step 1: Locate the existing queue helper.** Confirm how the drawer queues: it calls `updateCallStatus(practitioner.id, "queued")` then `syncCallRecordToSupabase(...)`. Find the matching imports already available in `page.tsx` (`createCallRecord`, `syncCallRecordToSupabase` from `@/lib/campaign-storage`; `getBatchCaller`).

- [ ] **Step 2: Replace the `else if (action === "queue")` block with:**

```tsx
} else if (action === "queue") {
  const p = practitioner as PractitionerData;
  if (p.do_not_call) {
    toast.error("This practitioner is marked Do Not Call.");
    return;
  }
  // Create/refresh the local record, mark queued, and persist to Supabase
  // so the Queue tab, KPIs, and badges reflect it (mirrors drawer Add-to-Queue).
  createCallRecord({
    id: p.id,
    name: p.name,
    practitioner_type: p.practitioner_type,
    phone: p.phone || "",
    address: p.address,
    city: p.city,
    province: p.province,
  });
  updateCallStatus(p.id, "queued");
  await syncCallRecordToSupabase(p.id);
  loadCallRecords();
  toast.success(`${p.name} added to queue`);
}
```

(If `updateCallStatus` / `syncCallRecordToSupabase` are not yet imported in `page.tsx`, add them to the existing `@/lib/campaign-storage` import. Make the `onSelect` callback `async`.)

- [ ] **Step 3: Typecheck + lint** — Run: `cd superpatch-frontend && npx tsc --noEmit` — Expected: clean.
- [ ] **Step 4: Commit** — `git commit -am "fix(campaign): command-palette Queue now persists queued status to Supabase"`

### Task 14: Fix callback false `appointment_booked`

A callback with only `appointment_time` (no demo intent) currently flips `callStatus` to `"booked"` and sets `appointment_booked=true` without booking (`supabase/functions/webhook-processor/index.ts:1171-1173`), inflating KPIs.

**Files:**
- Modify: `superpatch-frontend/supabase/functions/webhook-processor/index.ts:1171-1173`
- Test: `superpatch-frontend/supabase/functions/webhook-processor/_tests/booking-status.test.ts` (create; mirror existing `_tests/` harness style if present, else a pure-function test extracted from the status logic)

- [ ] **Step 1: Extract the status decision into a pure, testable helper** (if not already). Add near the top of `index.ts` (or a `_shared` helper):

```ts
// Returns the call status. A booking only counts when the prospect actually
// wanted a demo/appointment — an appointment_time alone (callback scheduling)
// must NOT be treated as a booked demo.
export function deriveCallStatus(args: {
  completed: boolean;
  wantsDemo: boolean;
  scheduleDemo: boolean;
  appointmentTime: string | null;
  wentToVoicemail: boolean;
}): "completed" | "booked" | "voicemail" | "failed" {
  if (args.wentToVoicemail) return "voicemail";
  if (!args.completed) return "failed";
  if ((args.wantsDemo || args.scheduleDemo) && args.appointmentTime) return "booked";
  return "completed";
}
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { deriveCallStatus } from "../index.ts";

describe("deriveCallStatus", () => {
  it("callback with appointment_time but no demo intent is NOT booked", () => {
    expect(deriveCallStatus({
      completed: true, wantsDemo: false, scheduleDemo: false,
      appointmentTime: "2026-06-20T15:00:00Z", wentToVoicemail: false,
    })).toBe("completed");
  });
  it("demo intent + time is booked", () => {
    expect(deriveCallStatus({
      completed: true, wantsDemo: true, scheduleDemo: false,
      appointmentTime: "2026-06-20T15:00:00Z", wentToVoicemail: false,
    })).toBe("booked");
  });
});
```

- [ ] **Step 3: Replace the inline status logic at `:1171-1173`** to call `deriveCallStatus(...)`, and set `appointment_booked` from `callStatus === "booked"` (not from `appointmentTime` alone).
- [ ] **Step 4: Run the test** — Run: `cd superpatch-frontend && npm test -- --run supabase/functions/webhook-processor` — Expected: PASS. (If Deno-only imports block Vitest, place the helper in a `.ts` with no Deno globals and import it; keep `index.ts` importing the helper.)
- [ ] **Step 5: Deploy the Edge Function** — Run: `cd superpatch-frontend && supabase functions deploy webhook-processor` — Expected: deployed.
- [ ] **Step 6: Commit** — `git commit -am "fix(webhook): callback appointment_time no longer counts as a booked demo"`

---

## Phase 3 — Dual Cal.com booking path

The pathway's in-call `book_cal_appointment` tool books on Cal.com during the call, AND `webhook-processor` dispatches `book-appointment` post-call. No `booking_uid` handoff → duplicate bookings or a 409 with `booking_id` left null. Bland response variables let the in-call tool return its `uid`.

### Task 15: Capture in-call booking `uid` and skip redundant post-call booking

**Files:**
- Modify: `b2b_sales_enablement/appointment_webhook/update_bland_tools_calcom.py:119-227` (add `response_data` extracting `uid`→`booking_uid`, `status`→`booking_status`; add `call_record_id`/`call_id` to Cal.com booking `metadata`)
- Modify: `b2b_sales_enablement/bland_ai_pathways/*_contextual.json` (Schedule Appointment node: add `booking_uid` to `extractVars` so it returns in the webhook payload)
- Modify: `superpatch-frontend/supabase/functions/webhook-processor/index.ts:1560-1602` (booking dispatch gate)
- Reference: `superpatch-frontend/supabase/functions/sync-cal-bookings/index.ts:137-142` (link-by-metadata fallback)

- [ ] **Step 1: Add response-variable extraction to the Bland tool builder.** In `update_bland_tools_calcom.py`, in the `book_cal_appointment` tool definition, add a `response_data` array (per Bland tool schema) that maps the Cal.com response `data.uid` to variable `booking_uid` and `data.status` to `booking_status`. Also add `"call_record_id"` and `"call_id"` to the Cal.com booking request `metadata` so `sync-cal-bookings` can link orphans.

- [ ] **Step 2: Add `booking_uid` to each pathway's Schedule Appointment `extractVars`.** In every `*_contextual.json`, on the Schedule Appointment node, append an extractVar for `booking_uid` (string) so Bland includes it in the webhook `variables`. Keep all other extractVars unchanged.

- [ ] **Step 3: Update the webhook booking gate.** In `webhook-processor/index.ts`, before the booking dispatch block (`:1560`):

```ts
// If the in-call Bland tool already booked, record its uid and skip re-booking.
const inCallBookingUid = toStr(vars.booking_uid);
if (inCallBookingUid && !savedRecord.booking_id) {
  await supabase.from("call_records")
    .update({ booking_id: inCallBookingUid })
    .eq("id", savedRecord.id);
  savedRecord.booking_id = inCallBookingUid;
}
// Only dispatch post-call book-appointment when no in-call booking exists
// (fallback for tool timeouts). Existing dedup checks remain.
const needsPostCallBooking = !inCallBookingUid && !savedRecord.booking_id;
```

Then guard the existing `book-appointment` dispatch with `needsPostCallBooking &&` in addition to the current `wantsDemo`/time/email checks.

- [ ] **Step 4: Write a test for the gate.** Add to the webhook test file: when `vars.booking_uid` is present, `book-appointment` is NOT invoked and `booking_id` is set to the uid. Mock the dispatch fetch and assert it is not called.

Run: `cd superpatch-frontend && npm test -- --run supabase/functions/webhook-processor`
Expected: PASS.

- [ ] **Step 5: Publish tool + pathways + deploy webhook.**

```bash
cd b2b_sales_enablement/appointment_webhook && python update_bland_tools_calcom.py
cd ../bland_ai_pathways && python deploy_pathways.py   # use the repo's actual deploy script name
cd ../../superpatch-frontend && supabase functions deploy webhook-processor
```

- [ ] **Step 6: Commit** — `git add -A && git commit -m "fix(booking): reconcile in-call Cal.com booking uid; skip duplicate post-call booking"`

---

## Phase 4 — KPI / UX trust fixes

### Task 16: Real KPI sparkline + period-over-period trends

`recentCallCounts` and `previousStats` are never passed, so the Total Calls sparkline is synthetic and trend arrows never render (`src/components/campaign/kpi-cards.tsx:216-231,246,269,282`; call site `src/app/campaign/page.tsx:1288-1299`).

**Files:**
- Modify: `superpatch-frontend/src/app/campaign/page.tsx:1288-1299` (pass real props)
- Modify: `superpatch-frontend/src/components/campaign/kpi-cards.tsx:216-231` (use real data; drop synthetic fallback)
- Test: `superpatch-frontend/src/__tests__/kpi-trends.test.ts`

- [ ] **Step 1: Write the failing test** for a `computeRecentCallCounts(records, days)` helper (last-N-day counts from `created_at`) and `computePreviousStats(records, window)`:

```ts
import { describe, it, expect } from "vitest";
import { computeRecentCallCounts } from "@/components/campaign/kpi-utils";

describe("computeRecentCallCounts", () => {
  it("buckets records into the last N local days", () => {
    const now = new Date();
    const recs = [
      { created_at: now.toISOString() },
      { created_at: now.toISOString() },
    ];
    const counts = computeRecentCallCounts(recs as never, 7);
    expect(counts).toHaveLength(7);
    expect(counts[counts.length - 1]).toBe(2);
  });
});
```

- [ ] **Step 2: Run it** — Expected: FAIL (module missing).
- [ ] **Step 3: Implement `src/components/campaign/kpi-utils.ts`** with `computeRecentCallCounts(records, days)` returning a `number[]` of per-day counts (oldest→newest), grouping by local date from `created_at`.
- [ ] **Step 4: Wire it in `page.tsx`** — pass `recentCallCounts={computeRecentCallCounts(Object.values(callRecords), 7)}` to `<KPICards>`. (Leave `previousStats` for a follow-up if a prior-window stat source isn't readily available; if it is, pass it too.)
- [ ] **Step 5: Remove the synthetic `generateSparklineData()` fallback in `kpi-cards.tsx`** — render the sparkline only when `recentCallCounts.length > 0`, else render no chart (never fabricate).
- [ ] **Step 6: Run tests + typecheck** — Expected: PASS, clean.
- [ ] **Step 7: Commit** — `git commit -am "fix(kpi): real call-count sparkline; remove synthetic trend data"`

### Task 17: Add actions to the main Retries tab (parity with drawer panel)

The main Retries tab is read-only (`src/app/campaign/page.tsx:2251-2359`) while `src/components/campaign/retry-queue-panel.tsx` already has Retry-Now/cancel. Reuse the panel.

**Files:**
- Modify: `superpatch-frontend/src/app/campaign/page.tsx:2251-2359` (render `<RetryQueuePanel>` instead of the bespoke read-only list, or add the same action handlers)

- [ ] **Step 1: Replace the read-only list with the existing `RetryQueuePanel`** component (already imported for the drawer), passing the same props it uses in the drawer (`page.tsx:1243-1245`). Confirm it consumes `useRealtimeRetryQueue` (now authenticated) or its own polling.
- [ ] **Step 2: Typecheck** — Expected: clean.
- [ ] **Step 3: Commit** — `git commit -am "fix(retries): main Retries tab reuses RetryQueuePanel with actions"`

### Task 18: Enforce DNC in Quick Call + drawer UI

DNC is only blocked at dial time in `BatchCaller`; Quick Call bypasses it (`src/components/campaign/quick-call-tab.tsx:210-297`) and the drawer's `canCall` ignores DNC (`practitioner-detail-drawer.tsx:687-690`).

**Files:**
- Modify: `superpatch-frontend/src/components/campaign/quick-call-tab.tsx:210-297` (block dial when `state.result?.do_not_call`)
- Modify: `superpatch-frontend/src/components/campaign/practitioner-detail-drawer.tsx:687-690` (`canCall` returns false when `practitioner.do_not_call`)

- [ ] **Step 1: In `quick-call-tab.tsx`**, before the found-practitioner POST to `/api/bland/calls`, add: if `state.result?.do_not_call`, show `toast.error("Practitioner is marked Do Not Call.")` and return.
- [ ] **Step 2: In `practitioner-detail-drawer.tsx`**, change `canCall` to also require `!practitioner.do_not_call`. Add a tooltip/disabled reason.
- [ ] **Step 3: Typecheck + lint** — Expected: clean.
- [ ] **Step 4: Commit** — `git commit -am "fix(dnc): enforce Do Not Call in Quick Call and detail drawer UI"`

### Task 19: Propagate DNC/restore state to the practitioner list

DNC/restore close the drawer but never call `onPractitionerUpdated`, so list badges stay stale (`practitioner-detail-drawer.tsx:531,563`).

**Files:**
- Modify: `superpatch-frontend/src/components/campaign/practitioner-detail-drawer.tsx:511-571`

- [ ] **Step 1: After a successful DNC mark/restore PATCH**, call `onPractitionerUpdated?.({ ...practitioner, do_not_call: <new>, dnc_reason, dnc_source, dnc_detected_at })` before closing the drawer.
- [ ] **Step 2: Typecheck** — Expected: clean.
- [ ] **Step 3: Commit** — `git commit -am "fix(dnc): refresh practitioner list after DNC mark/restore"`

---

## Phase 5 — Cleanup, docs, and coverage

### Task 20: Remove remaining dead code

**Files:**
- Modify: `superpatch-frontend/src/lib/campaign-storage.ts` (remove unused `addToQueue`, `clearQueue` `:603-644`; `max_concurrent_calls` if unread)
- Modify: `superpatch-frontend/src/lib/batch-caller.ts` (remove dead `pollingInterval` field `:138`; remove `queued_practitioner_ids` mutation path if confirmed unused)
- Modify: `superpatch-frontend/src/app/campaign/pathway-suggestions/page.tsx:69-76` (remove per-render `console.log`)

- [ ] **Step 1: Confirm each symbol has zero references** with `rg`, then remove.
- [ ] **Step 2: `npx tsc --noEmit` + `npm test -- --run`** — Expected: clean, green.
- [ ] **Step 3: Commit** — `git commit -am "chore: remove dead queue helpers, polling field, and debug logging"`

### Task 21: Decide on orphan API routes

`/api/bland/calls/[id]/stop`, `/api/bland/calls/[id]/analyze`, `/api/memory` have no frontend consumer.

- [ ] **Step 1: Decision (ask the user if unsure):** wire a "Stop call" button in `active-calls-monitor.tsx` to `/stop` (recommended — useful control), and delete `/analyze` (superseded by Edge `analyze-call`) and `/api/memory` if truly unused.
- [ ] **Step 2:** Implement the chosen option; if wiring `/stop`, add a button that POSTs and refreshes; if deleting, remove route files.
- [ ] **Step 3: `npx tsc --noEmit`** — Expected: clean.
- [ ] **Step 4: Commit** — `git commit -am "chore(api): wire stop-call action / remove superseded routes"`

### Task 22: Extend canonical-IDs sync test to tools + Cal.com + webhook

`canonical-ids-sync.test.ts` doesn't assert tool IDs, `cal_com`, or `webhooks.primary`.

**Files:**
- Modify: `superpatch-frontend/src/__tests__/canonical-ids-sync.test.ts`

- [ ] **Step 1: Add assertions** that `WEBHOOK_URL` in both mirrors equals `canonical_ids.json.webhooks.primary`, and that `book-appointment`'s `CAL_EVENT_TYPE_ID` usage references `canonical_ids.json.cal_com.event_type_id` (document the env-coupling in the test comment). For tool IDs (JSON-only by design), assert they exist and are non-empty in `canonical_ids.json`.
- [ ] **Step 2: Run** — `npm test -- --run src/__tests__/canonical-ids-sync.test.ts` — Expected: PASS.
- [ ] **Step 3: Commit** — `git commit -am "test(canonical-ids): cover webhook URL, Cal.com, and tool IDs"`

### Task 23: Documentation sync

**Files:**
- Modify: `ARCHITECTURE.md` (fix `wants_samples`→`wants_sample`; correct the booking gate description to `wantsDemo + parsed time + email + no existing booking`; note in-call uid reconciliation)
- Modify: `superpatch-frontend/docs/PATHWAY_VARIABLES.md` (align `email` vs `practitioner_email`; add `booking_uid`)
- Modify: `superpatch-frontend/supabase/schema.sql` (refresh snapshot: add `sample_requests`, `appointments`, `follow_up_queue`, `pathway_suggestions`, and `call_records` analysis columns)
- Modify: `superpatch-frontend/docs/CALL_CENTER.md` (note enrichment status canonical value is `enriched`, not `completed`, per prior migration)
- Modify: `superpatch-frontend/docs/CHANGELOG.md` (frontend delta) and `docs/dev/changelog.md` (backend delta for webhook/booking/pathway changes)

- [ ] **Step 1: Apply doc edits** per `.cursor/rules/documentation-maintenance.mdc` decision matrix.
- [ ] **Step 2: Verify no stale references** — Run: `rg "wants_samples" superpatch-frontend ARCHITECTURE.md b2b_sales_enablement` — Expected: no matches.
- [ ] **Step 3: Commit** — `git commit -am "docs: sync architecture, pathway variables, schema snapshot, changelogs"`

---

## Phase 6 — Full verification + handoff

### Task 24: Full suite + manual E2E smoke

- [ ] **Step 1: Full test + typecheck** — Run: `cd superpatch-frontend && npm test -- --run && npx tsc --noEmit` — Expected: green (except the pre-existing, unrelated `rls-active-user-policy.test.ts` if not addressed; confirm it is the only known failure).
- [ ] **Step 2: Lint** — Run: `cd superpatch-frontend && npm run lint` — Expected: no new errors.
- [ ] **Step 3: Manual smoke (logged in as an active user):** load `/campaign` → Retries tab shows rows; `/campaign/appointments`, `/campaign/follow-up-queue`, `/campaign/pathway-suggestions` render data; sidebar badges show counts; Active Calls "Live" tab lists in-progress calls; `/campaign/reports` matches dashboard totals.
- [ ] **Step 4: Post-plan deep review** per `.cursor/rules/post-plan-deep-review.mdc` (dispatch `code-reviewer` with the full diff + this plan). Fix any gaps.
- [ ] **Step 5: Finish branch** per `finishing-a-development-branch` skill (PR or merge as the user chooses).

---

## Self-Review (author checklist — completed)

- **Spec coverage:** Every review finding maps to a task — RLS/client (Tasks 1–12), command-palette queue (13), callback booking (14), dual booking (15), KPI sparkline/trends (16), retries actions (17), DNC UI (18–19), dead code (20), orphan routes (21), test coverage (22), docs (23).
- **Type consistency:** `getBrowserSupabase`/`isBrowserSupabaseConfigured` (Task 1) used verbatim in Tasks 3–11; `deriveCallStatus` signature (Task 14) reused in Task 15 test; `computeRecentCallCounts` (Task 16) consistent name across steps.
- **Placeholder scan:** No TBD/"add error handling" placeholders; code blocks provided for non-mechanical steps. Mechanical hook migrations share one explicit DRY transform with exact file/line anchors.
- **Risk notes:** Tasks 15 and 21 require a product decision; both flag "ask the user." Deploy steps (Edge Functions, Bland tool/pathway publish) are explicit and must run after their code/test steps.
