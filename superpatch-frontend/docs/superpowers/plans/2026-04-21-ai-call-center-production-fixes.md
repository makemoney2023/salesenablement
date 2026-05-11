# AI Call Center — Production Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate every production-blocking bug surfaced in the 2026-04-21 end-to-end review so the Sales Enablement AI call center can reliably book demos, ship samples, enrich leads, and produce daily reports without silent failure.

**Architecture:** Fix in dependency order. Phase 1 unblocks the platform (Cal.com v2 migration, sample-trigger repair, cron hygiene, deprecated-route removal). Phase 2 restores silent subsystems (retry RPC, analyze-call lifetime, report metric, timezones, practitioner-type canonicalization, client env var). Phase 3 hardens correctness (injection filters, CSV pagination, type coercions, booleans). Phase 4 removes dead code and adds database guard rails. Every change ships with a failing test first (Vitest for frontend/edge-shared, SQL smoke tests for migrations) and a focused commit.

**Tech Stack:** Next.js 15 (App Router) · Supabase (Postgres + Edge Functions on Deno) · Cal.com v2 API · Bland.ai · Vitest · Deno test runner · pg_cron + pg_net · Resend.

---

## Conventions

- **Branch:** `fix/ai-call-center-production-2026-04` — all work lands here, PR to `main` after Phase 1 passes verification.
- **Tests first:** every bug fix begins with a failing test that reproduces the bug. No exceptions, even for migrations (use `supabase db reset` against a local branch + a `.test.sql` script).
- **Commit style:** Conventional Commits. One bug per commit. Message format: `fix(scope): short summary (#plan-task-N)` — body explains the failing behaviour.
- **Env-var audit:** any env var added or renamed in this plan MUST be added to `superpatch-frontend/.env.example` and `b2b_sales_enablement/.env.example` in the same commit.
- **Changelog:** after each phase merges, append a dated bullet to `superpatch-frontend/docs/CHANGELOG.md` (frontend-facing changes) and/or `docs/dev/changelog.md` (backend / Supabase changes).
- **Canonical IDs:** never hardcode Bland pathway, Cal event-type, voice, KB, or memory IDs. Read from `b2b_sales_enablement/bland_ai_pathways/canonical_ids.json` (Node) or `superpatch-frontend/supabase/functions/_shared/pathways.ts` (Deno). If a new ID is needed, add it to both files in the same commit.
- **Shell:** macOS zsh commands only (M4 Max). `pnpm` is available via `./node_modules/.bin/...` — when `pnpm` is not on PATH, use the direct binary path.
- **Don't destroy core functionality:** the fixes remove or rewrite specific logic; never delete routes, migrations, or functions wholesale without verifying no caller remains.

---

## Pre-flight

### Task 0.1 — Create the working branch and capture a baseline

**Files:**
- Modify: none (git operations)

- [ ] **Step 1: Verify clean working tree or stash**

Run:
```bash
cd /Users/cbsuperpatch/Desktop/SalesEnablement
git status --short
```

Expected: If any files beyond the tracked modifications in the original status block are dirty, resolve or stash them first. Do NOT commit the unrelated executive-powerpoint / wordtracks deletions as part of this plan.

- [ ] **Step 2: Create and check out the branch**

```bash
git checkout -b fix/ai-call-center-production-2026-04
```

- [ ] **Step 3: Capture a baseline test run (expected partial failures)**

```bash
cd superpatch-frontend
./node_modules/.bin/vitest run 2>&1 | tee /tmp/baseline-vitest.log
```

Save the log — we'll diff against it after Phase 4 to confirm we only fixed things, never regressed green tests.

---

### Task 0.2 — Provision Cal.com v2 credentials and the Edge Function secrets needed for Phase 1

**Files:**
- Modify: `superpatch-frontend/.env.example`
- Modify: `b2b_sales_enablement/.env.example` (if `CAL_API_KEY` is referenced there)

- [ ] **Step 1: Confirm required secrets exist**

In Supabase dashboard → Project Settings → Edge Functions → Secrets, ensure these are set (do NOT commit values):
- `CAL_API_KEY` (Cal.com v2 — starts with `cal_live_…`)
- `CAL_EVENT_TYPE_ID` (must equal the value in `b2b_sales_enablement/bland_ai_pathways/canonical_ids.json.cal.demoEventTypeId`)
- `CAL_API_VERSION` (new — set to `2024-08-13`)
- `BUSINESS_TIMEZONE` (set to `America/Toronto` unless the business has explicitly changed)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BLAND_API_KEY`, `RESEND_API_KEY`, `GEMINI_API_KEY`, `FIRECRAWL_API_KEY` — already present, re-verify.

- [ ] **Step 2: Document the new `CAL_API_VERSION` secret in `.env.example`**

Append under the Cal.com section:
```
# Cal.com v2 API version header. Must be set for Edge Functions.
CAL_API_VERSION=2024-08-13
```

- [ ] **Step 3: Commit**
```bash
git add superpatch-frontend/.env.example
git commit -m "chore(env): document CAL_API_VERSION for Cal.com v2 migration"
```

---

## Phase 1 — P0 Production Blockers

Each of these is already breaking production on 2026-04-21. Ship Phase 1 as a single PR that can be hotfixed to `main` immediately.

---

### Task 1.1 — Migrate `book-appointment` Edge Function to Cal.com v2

Cal.com v1 was retired 2026-04-08. Every demo booking currently 404s.

**Files:**
- Modify: `superpatch-frontend/supabase/functions/book-appointment/index.ts` (lines 15, 68–100, 79)
- Create: `superpatch-frontend/supabase/functions/_shared/cal.ts`
- Create: `superpatch-frontend/supabase/functions/_shared/cal.test.ts`

- [ ] **Step 1: Write the failing Deno test for the new helper**

Create `superpatch-frontend/supabase/functions/_shared/cal.test.ts`:
```ts
import { assertEquals, assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createCalBooking, CalError } from "./cal.ts";

Deno.test("createCalBooking posts to v2 with required headers and body", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(
      JSON.stringify({ status: "success", data: { id: 999, uid: "abc", status: "accepted" } }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const result = await createCalBooking(
    {
      eventTypeId: 4004901,
      start: "2026-05-01T14:00:00.000Z",
      attendee: { name: "Dr Alice", email: "alice@example.com", timeZone: "America/Toronto" },
      metadata: { practitioner_id: "p-1", call_record_id: "c-1" },
    },
    { apiKey: "cal_live_test", apiVersion: "2024-08-13", fetchImpl: fakeFetch },
  );

  assertEquals(result.uid, "abc");
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, "https://api.cal.com/v2/bookings");
  const headers = new Headers(calls[0].init.headers);
  assertEquals(headers.get("authorization"), "Bearer cal_live_test");
  assertEquals(headers.get("cf-api-version"), "2024-08-13");
  const body = JSON.parse(String(calls[0].init.body));
  assertEquals(body.attendee.timeZone, "America/Toronto");
  assertEquals(body.eventTypeId, 4004901);
});

Deno.test("createCalBooking throws CalError on non-2xx", async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ error: { message: "slot taken" } }), { status: 409 });

  await assertRejects(
    () =>
      createCalBooking(
        {
          eventTypeId: 1,
          start: "2026-05-01T14:00:00.000Z",
          attendee: { name: "x", email: "x@y.z", timeZone: "UTC" },
        },
        { apiKey: "k", apiVersion: "2024-08-13", fetchImpl: fakeFetch },
      ),
    CalError,
    "slot taken",
  );
});
```

- [ ] **Step 2: Run the test to confirm it fails (module missing)**

```bash
cd superpatch-frontend
deno test --allow-net supabase/functions/_shared/cal.test.ts
```
Expected: FAIL — `Module not found "./cal.ts"`.

- [ ] **Step 3: Implement `_shared/cal.ts`**

Create `superpatch-frontend/supabase/functions/_shared/cal.ts`:
```ts
export interface CalBookingRequest {
  eventTypeId: number;
  start: string; // ISO 8601 UTC
  attendee: { name: string; email: string; timeZone: string; phoneNumber?: string };
  metadata?: Record<string, string>;
}

export interface CalBookingResult {
  id: number;
  uid: string;
  status: string;
  start?: string;
  end?: string;
}

export interface CalClientOptions {
  apiKey: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class CalError extends Error {
  constructor(public status: number, message: string, public body: unknown) {
    super(message);
    this.name = "CalError";
  }
}

const CAL_BASE_URL = "https://api.cal.com/v2";

function buildHeaders(opts: CalClientOptions): Headers {
  const h = new Headers({
    "Content-Type": "application/json",
    Authorization: `Bearer ${opts.apiKey}`,
    "cf-api-version": opts.apiVersion ?? "2024-08-13",
  });
  return h;
}

async function fetchJson(url: string, init: RequestInit, opts: CalClientOptions) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const msg = body?.error?.message || body?.message || `Cal.com ${res.status}`;
      throw new CalError(res.status, msg, body);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export async function createCalBooking(
  req: CalBookingRequest,
  opts: CalClientOptions,
): Promise<CalBookingResult> {
  const body = await fetchJson(
    `${CAL_BASE_URL}/bookings`,
    { method: "POST", headers: buildHeaders(opts), body: JSON.stringify(req) },
    opts,
  );
  const data = body?.data ?? body;
  return { id: data.id, uid: data.uid, status: data.status, start: data.start, end: data.end };
}

export async function listCalBookings(
  params: { afterStart?: string; beforeStart?: string; status?: string; take?: number },
  opts: CalClientOptions,
): Promise<{ bookings: Array<Record<string, unknown>> }> {
  const url = new URL(`${CAL_BASE_URL}/bookings`);
  if (params.afterStart) url.searchParams.set("afterStart", params.afterStart);
  if (params.beforeStart) url.searchParams.set("beforeStart", params.beforeStart);
  if (params.status) url.searchParams.set("status", params.status);
  if (params.take) url.searchParams.set("take", String(params.take));
  const body = await fetchJson(url.toString(), { method: "GET", headers: buildHeaders(opts) }, opts);
  const bookings = Array.isArray(body?.data) ? body.data : body?.data?.bookings ?? body?.bookings ?? [];
  return { bookings };
}

export async function cancelCalBooking(
  uid: string,
  reason: string | undefined,
  opts: CalClientOptions,
): Promise<void> {
  await fetchJson(
    `${CAL_BASE_URL}/bookings/${uid}/cancel`,
    {
      method: "POST",
      headers: buildHeaders(opts),
      body: JSON.stringify({ cancellationReason: reason ?? "" }),
    },
    opts,
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
deno test --allow-net superpatch-frontend/supabase/functions/_shared/cal.test.ts
```
Expected: 2 passed.

- [ ] **Step 5: Rewrite `book-appointment/index.ts` to use the helper**

Replace lines 15 and 60–120 (the Cal.com call block) with:
```ts
// Top of file
import { createCalBooking, CalError } from "../_shared/cal.ts";
import { PATHWAY_IDS } from "../_shared/pathways.ts";

const CAL_API_KEY = Deno.env.get("CAL_API_KEY") ?? "";
const CAL_API_VERSION = Deno.env.get("CAL_API_VERSION") ?? "2024-08-13";
const CAL_EVENT_TYPE_ID = Number(Deno.env.get("CAL_EVENT_TYPE_ID"));
const BUSINESS_TIMEZONE = Deno.env.get("BUSINESS_TIMEZONE") ?? "America/Toronto";

if (!CAL_API_KEY) throw new Error("CAL_API_KEY is required");
if (!Number.isFinite(CAL_EVENT_TYPE_ID)) {
  throw new Error("CAL_EVENT_TYPE_ID is required and must match canonical_ids.json");
}
```

Replace the booking block (where `fetchWithTimeout` currently hits `/v1/bookings`) with:
```ts
let booking;
try {
  booking = await createCalBooking(
    {
      eventTypeId: CAL_EVENT_TYPE_ID,
      start: startIso,
      attendee: {
        name: attendeeName,
        email: attendeeEmail,
        timeZone: BUSINESS_TIMEZONE,
        phoneNumber: attendeePhone || undefined,
      },
      metadata: {
        practitioner_id: practitionerId ?? "",
        call_record_id: callRecordId ?? "",
        source: "webhook-processor",
      },
    },
    { apiKey: CAL_API_KEY, apiVersion: CAL_API_VERSION },
  );
} catch (err) {
  if (err instanceof CalError) {
    return new Response(
      JSON.stringify({ success: false, error: err.message, status: err.status }),
      { status: err.status === 409 ? 409 : 502, headers: { "Content-Type": "application/json" } },
    );
  }
  throw err;
}

const bookingId = booking.uid;
```

- [ ] **Step 6: Commit**
```bash
git add superpatch-frontend/supabase/functions/_shared/cal.ts \
        superpatch-frontend/supabase/functions/_shared/cal.test.ts \
        superpatch-frontend/supabase/functions/book-appointment/index.ts
git commit -m "fix(book-appointment): migrate to Cal.com v2 API (#plan-1.1)"
```

---

### Task 1.2 — Migrate `sync-cal-bookings` to Cal.com v2 and fix status normalization

**Files:**
- Modify: `superpatch-frontend/supabase/functions/sync-cal-bookings/index.ts` (lines 70–140)

- [ ] **Step 1: Write the failing Deno test for status normalization**

Append to `superpatch-frontend/supabase/functions/_shared/cal.test.ts`:
```ts
import { normalizeCalStatus } from "../sync-cal-bookings/status.ts";

Deno.test("normalizeCalStatus maps cal v2 lowercase statuses", () => {
  assertEquals(normalizeCalStatus("accepted"), "confirmed");
  assertEquals(normalizeCalStatus("ACCEPTED"), "confirmed");
  assertEquals(normalizeCalStatus("cancelled"), "cancelled");
  assertEquals(normalizeCalStatus("Rescheduled"), "rescheduled");
  assertEquals(normalizeCalStatus("no_show"), "no_show");
  assertEquals(normalizeCalStatus(undefined), "pending");
});
```

- [ ] **Step 2: Run the test (expected fail — `status.ts` missing)**

```bash
deno test --allow-net superpatch-frontend/supabase/functions/_shared/cal.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Extract normalization to `sync-cal-bookings/status.ts`**

Create `superpatch-frontend/supabase/functions/sync-cal-bookings/status.ts`:
```ts
export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "rescheduled"
  | "completed"
  | "no_show";

export function normalizeCalStatus(calStatus: string | undefined | null): AppointmentStatus {
  if (!calStatus) return "pending";
  switch (String(calStatus).toLowerCase()) {
    case "accepted":
    case "confirmed":
      return "confirmed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "rescheduled":
      return "rescheduled";
    case "completed":
      return "completed";
    case "no_show":
    case "no-show":
      return "no_show";
    default:
      return "pending";
  }
}
```

- [ ] **Step 4: Rewrite `sync-cal-bookings/index.ts` to call v2 and use the helper**

Replace the v1 fetch and `mapCalStatusToAppointmentStatus` with:
```ts
import { listCalBookings } from "../_shared/cal.ts";
import { normalizeCalStatus } from "./status.ts";

const CAL_API_KEY = Deno.env.get("CAL_API_KEY") ?? "";
const CAL_API_VERSION = Deno.env.get("CAL_API_VERSION") ?? "2024-08-13";

const { bookings } = await listCalBookings(
  { afterStart: windowStart, beforeStart: windowEnd, take: 250 },
  { apiKey: CAL_API_KEY, apiVersion: CAL_API_VERSION },
);

for (const booking of bookings) {
  const newStatus = normalizeCalStatus(booking.status as string);
  // ...existing update logic, but use newStatus
}
```

Delete the old `mapCalStatusToAppointmentStatus` and the `toUpperCase` branch at lines 94–110.

- [ ] **Step 5: Update the `call_records` sync path to key on `appointments.call_id`**

In the update block previously keyed on `.eq("appointment_id", booking.uid)`:
```ts
const { data: apptRow } = await supabase
  .from("appointments")
  .select("id, call_id")
  .eq("cal_booking_uid", booking.uid)
  .maybeSingle();

if (apptRow?.call_id) {
  await supabase
    .from("call_records")
    .update({ appointment_status: newStatus })
    .eq("id", apptRow.call_id);
}
```

- [ ] **Step 6: Run tests**

```bash
deno test --allow-net superpatch-frontend/supabase/functions/_shared/cal.test.ts
```
Expected: all 3 tests pass.

- [ ] **Step 7: Commit**
```bash
git add superpatch-frontend/supabase/functions/sync-cal-bookings/index.ts \
        superpatch-frontend/supabase/functions/sync-cal-bookings/status.ts \
        superpatch-frontend/supabase/functions/_shared/cal.test.ts
git commit -m "fix(sync-cal-bookings): migrate to Cal.com v2 + normalize statuses (#plan-1.2)"
```

---

### Task 1.3 — Repair the `sample_requests` notification trigger

Trigger currently references non-existent columns (`practitioner_name`, `practitioner_type`, `products`, `address`) and throws on every insert, rolling the insert back. Real columns (verified in `superpatch-frontend/src/lib/db/types.ts:378-402`): `requester_name`, `practice_name`, `products_requested` (text[]), `shipping_address`, `shipping_city`.

**Files:**
- Create: `superpatch-frontend/supabase/migrations/20260422_fix_sample_notification_trigger.sql`
- Create: `superpatch-frontend/supabase/tests/sample_requests_insert.test.sql`

- [ ] **Step 1: Write the failing SQL test**

Create `superpatch-frontend/supabase/tests/sample_requests_insert.test.sql`:
```sql
BEGIN;
SELECT plan(1);

-- Should succeed; if the broken trigger is active, this INSERT throws
-- column "practitioner_name" does not exist.
SELECT lives_ok(
  $$INSERT INTO sample_requests (requester_name, phone, sample_type, quantity)
    VALUES ('Test Requester', '+15555551212', 'standard_kit', 1)$$,
  'sample_requests insert fires notification without error'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run against a local Supabase branch to confirm fail**

```bash
cd superpatch-frontend
supabase db reset --local
supabase test db --linked=false --local --file supabase/tests/sample_requests_insert.test.sql
```
Expected: FAIL — `column "practitioner_name" does not exist`.

- [ ] **Step 3: Write the migration**

Create `superpatch-frontend/supabase/migrations/20260422_fix_sample_notification_trigger.sql`:
```sql
-- Repairs new_sample_request notification trigger to use the real column
-- names on sample_requests (see 20260115_add_sample_requests_columns.sql and
-- src/lib/db/types.ts).

CREATE OR REPLACE FUNCTION notify_new_sample_request()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'new_sample_request',
    json_build_object(
      'id', NEW.id,
      'call_record_id', NEW.call_record_id,
      'practitioner_id', NEW.practitioner_id,
      'requester_name', NEW.requester_name,
      'practice_name', NEW.practice_name,
      'email', NEW.email,
      'phone', NEW.phone,
      'sample_type', NEW.sample_type,
      'products_requested', NEW.products_requested,
      'quantity', NEW.quantity,
      'shipping_address', NEW.shipping_address,
      'shipping_city', NEW.shipping_city,
      'status', NEW.status,
      'created_at', NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_new_sample_request ON sample_requests;
CREATE TRIGGER trg_notify_new_sample_request
AFTER INSERT ON sample_requests
FOR EACH ROW EXECUTE FUNCTION notify_new_sample_request();
```

- [ ] **Step 4: Re-run the test**

```bash
supabase db reset --local
supabase test db --linked=false --local --file supabase/tests/sample_requests_insert.test.sql
```
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add superpatch-frontend/supabase/migrations/20260422_fix_sample_notification_trigger.sql \
        superpatch-frontend/supabase/tests/sample_requests_insert.test.sql
git commit -m "fix(db): align sample_requests notification trigger with real schema (#plan-1.3)"
```

---

### Task 1.4 — Repoint enrichment cron at `enrich-practitioners-v2` and harden Bearer token

Cron in `20260115_setup_cron_jobs.sql:22-37` calls `/functions/v1/enrich-practitioners`; deployed function is `enrich-practitioners-v2`. Additionally, `'Bearer ' || current_setting('supabase.service_role_key', true)` returns empty string on a default project, so every scheduled HTTP call 401s.

**Files:**
- Create: `superpatch-frontend/supabase/migrations/20260422_repoint_cron_jobs.sql`

- [ ] **Step 1: Inspect current cron config (produces the failure evidence)**

```bash
supabase db remote commit --linked --dry-run 2>/dev/null || true
```
Then in the Supabase SQL editor (or via MCP), run:
```sql
SELECT jobname, schedule, command FROM cron.job ORDER BY jobid;
SELECT current_setting('supabase.service_role_key', true) AS token;
```
Expected: `token` returns empty string or NULL; `process-enrichment-queue` command contains `/enrich-practitioners` (without `-v2`).

- [ ] **Step 2: Add `service_role_key` to Supabase Vault**

Run once (idempotent):
```sql
INSERT INTO vault.secrets (name, secret)
VALUES ('service_role_key', '<service_role_key_from_dashboard>')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
```
Note the secret's `id` (UUID) from `SELECT id FROM vault.secrets WHERE name = 'service_role_key';`. Record it as a deployment note — the migration below reads it by name via `vault.decrypted_secrets`.

- [ ] **Step 3: Write the migration that unschedules the stale jobs and recreates them**

Create `superpatch-frontend/supabase/migrations/20260422_repoint_cron_jobs.sql`:
```sql
-- Replaces broken 20260115 cron jobs:
--  - process-enrichment-queue targeted missing function
--  - Bearer header used empty setting; switched to vault secret lookup

DO $$
DECLARE
  job_id INTEGER;
  service_token TEXT;
  supabase_url TEXT := 'https://gdwwppwaxyvudsecexuq.supabase.co';
BEGIN
  SELECT decrypted_secret INTO service_token
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key';

  IF service_token IS NULL OR length(service_token) = 0 THEN
    RAISE EXCEPTION 'vault.secrets "service_role_key" is empty; insert it before running this migration';
  END IF;

  -- Unschedule any prior versions
  FOR job_id IN SELECT jobid FROM cron.job WHERE jobname IN (
    'process-enrichment-queue',
    'process-retry-queue',
    'generate-daily-report',
    'sync-cal-bookings'
  )
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;

  PERFORM cron.schedule(
    'process-enrichment-queue',
    '*/30 * * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', %L
        ),
        body := '{}'::jsonb
      );
    $cron$, supabase_url || '/functions/v1/enrich-practitioners-v2', 'Bearer ' || service_token)
  );

  PERFORM cron.schedule(
    'process-retry-queue',
    '*/10 * * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', %L
        ),
        body := '{}'::jsonb
      );
    $cron$, supabase_url || '/functions/v1/process-retry-queue', 'Bearer ' || service_token)
  );

  PERFORM cron.schedule(
    'sync-cal-bookings',
    '*/15 * * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', %L
        ),
        body := '{}'::jsonb
      );
    $cron$, supabase_url || '/functions/v1/sync-cal-bookings', 'Bearer ' || service_token)
  );

  PERFORM cron.schedule(
    'generate-daily-report',
    '0 14 * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', %L
        ),
        body := '{}'::jsonb
      );
    $cron$, supabase_url || '/functions/v1/generate-daily-report', 'Bearer ' || service_token)
  );
END $$;
```

- [ ] **Step 4: Verify cron schedule after applying locally**

```bash
supabase db reset --local
supabase db execute --local --sql "SELECT jobname, schedule, substring(command from 1 for 60) AS command FROM cron.job ORDER BY jobname;"
```
Expected: four rows, all four commands reference `/functions/v1/…-v2` where applicable and `Authorization` includes a non-empty bearer.

- [ ] **Step 5: Commit**
```bash
git add superpatch-frontend/supabase/migrations/20260422_repoint_cron_jobs.sql
git commit -m "fix(cron): repoint enrichment job + use vault for service key (#plan-1.4)"
```

---

### Task 1.5 — Decommission the deprecated `/api/webhooks/bland` Next.js route

This route has 1,200 lines of stale logic (v1 Cal.com, boolean handling bug, wrong email priority, DST-broken hour math) that races with the canonical Edge Function.

**Files:**
- Modify: `superpatch-frontend/src/app/api/webhooks/bland/route.ts` (entire file)
- Modify: `b2b_sales_enablement/bland_ai_pathways/canonical_ids.json` (verify `webhookUrl` points at the Edge Function)
- Modify: `superpatch-frontend/supabase/functions/_shared/pathways.ts` (verify `DEFAULT_WEBHOOK_URL`)

- [ ] **Step 1: Audit live pathways for the deprecated URL**

```bash
cd b2b_sales_enablement/bland_ai_pathways
python3 bland_cli.py list-pathways > /tmp/live-pathways.json
grep -nH "api/webhooks/bland" /tmp/live-pathways.json || echo "OK: no live pathway points at the Vercel webhook"
```

If any pathway still points at `/api/webhooks/bland`, run (for each ID):
```bash
python3 bland_cli.py set-webhook --pathway-id <id> \
  --url "https://gdwwppwaxyvudsecexuq.supabase.co/functions/v1/webhook-processor"
```

- [ ] **Step 2: Write the failing test asserting the route returns 410**

Create `superpatch-frontend/src/app/api/webhooks/bland/route.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { POST, GET } from "./route";

describe("deprecated bland webhook route", () => {
  it("POST returns 410 Gone", async () => {
    const req = new Request("http://localhost/api/webhooks/bland", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.deprecated).toBe(true);
  });

  it("GET returns 410 Gone", async () => {
    const res = await GET();
    expect(res.status).toBe(410);
  });
});
```

- [ ] **Step 3: Run test (expected fail — current handler still processes webhooks)**

```bash
cd superpatch-frontend
./node_modules/.bin/vitest run src/app/api/webhooks/bland/route.test.ts
```
Expected: FAIL.

- [ ] **Step 4: Replace the route body with a 410 stub**

Replace the entire contents of `superpatch-frontend/src/app/api/webhooks/bland/route.ts` with:
```ts
import { NextResponse } from "next/server";

/**
 * @deprecated This route was superseded on 2026-04-22 by the Supabase
 * Edge Function `/functions/v1/webhook-processor`. Bland.ai pathways must
 * point at the Edge Function; any request arriving here is a configuration
 * bug. Returning 410 Gone to surface the misconfiguration quickly.
 */
export async function POST(_req: Request) {
  return NextResponse.json(
    {
      deprecated: true,
      message:
        "This webhook endpoint was retired on 2026-04-22. Repoint the Bland pathway to /functions/v1/webhook-processor.",
    },
    { status: 410 },
  );
}

export async function GET() {
  return NextResponse.json({ deprecated: true }, { status: 410 });
}
```

- [ ] **Step 5: Re-run test**
```bash
./node_modules/.bin/vitest run src/app/api/webhooks/bland/route.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add superpatch-frontend/src/app/api/webhooks/bland/route.ts \
        superpatch-frontend/src/app/api/webhooks/bland/route.test.ts
git commit -m "fix(webhooks): retire deprecated Vercel Bland webhook route (#plan-1.5)"
```

---

### Phase 1 verification gate

Before moving to Phase 2, run:
```bash
cd superpatch-frontend
./node_modules/.bin/vitest run
deno test --allow-net supabase/functions/_shared/cal.test.ts
supabase db reset --local
supabase test db --linked=false --local
```
All tests must pass. Deploy Phase 1 to staging and execute the end-to-end smoke in the "Verification" section at the bottom of this plan before merging to `main`.

---

## Phase 2 — P1 Reliability Fixes

---

### Task 2.1 — Fix `process-retry-queue` RPC argument name

**Files:**
- Modify: `superpatch-frontend/supabase/functions/process-retry-queue/index.ts:230-231`
- Create: `superpatch-frontend/supabase/functions/process-retry-queue/retry.test.ts`

- [ ] **Step 1: Write the failing Deno test (against a spy Supabase client)**

Create `superpatch-frontend/supabase/functions/process-retry-queue/retry.test.ts`:
```ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { incrementRetry } from "./retry.ts";

Deno.test("incrementRetry calls RPC with p_id argument", async () => {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const client = {
    rpc(fn: string, args: unknown) {
      calls.push({ fn, args });
      return Promise.resolve({ data: 2, error: null });
    },
  } as const;
  const result = await incrementRetry(client as any, "practitioner-uuid");
  assertEquals(result, 2);
  assertEquals(calls, [{ fn: "increment_retry_count", args: { p_id: "practitioner-uuid" } }]);
});
```

- [ ] **Step 2: Run (expected fail — helper missing)**

```bash
deno test --allow-net superpatch-frontend/supabase/functions/process-retry-queue/retry.test.ts
```

- [ ] **Step 3: Extract `retry.ts` helper**

Create `superpatch-frontend/supabase/functions/process-retry-queue/retry.ts`:
```ts
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function incrementRetry(
  client: SupabaseClient,
  practitionerId: string,
): Promise<number> {
  const { data, error } = await client.rpc("increment_retry_count", {
    p_id: practitionerId,
  });
  if (error) {
    console.error("[process-retry-queue] increment_retry_count RPC failed", error);
    throw error;
  }
  return Number(data ?? 0);
}
```

- [ ] **Step 4: Replace the call site in `process-retry-queue/index.ts`**

Replace lines 227–244 (the `supabase.rpc("increment_retry_count", { practitioner_id })` block and its fallback) with:
```ts
import { incrementRetry } from "./retry.ts";

let newRetryCount: number;
try {
  newRetryCount = await incrementRetry(supabase, practitionerId);
} catch (rpcError) {
  console.error("[process-retry-queue] retry increment failed; skipping practitioner", {
    practitionerId,
    rpcError,
  });
  continue;
}
```

- [ ] **Step 5: Run test**
```bash
deno test --allow-net superpatch-frontend/supabase/functions/process-retry-queue/retry.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add superpatch-frontend/supabase/functions/process-retry-queue/retry.ts \
        superpatch-frontend/supabase/functions/process-retry-queue/retry.test.ts \
        superpatch-frontend/supabase/functions/process-retry-queue/index.ts
git commit -m "fix(retry-queue): use p_id RPC argument for atomic retry count (#plan-2.1)"
```

---

### Task 2.2 — Keep `analyze-call` alive with `EdgeRuntime.waitUntil`

**Files:**
- Modify: `superpatch-frontend/supabase/functions/webhook-processor/index.ts:1256-1278`

- [ ] **Step 1: Write the failing test**

Create `superpatch-frontend/supabase/functions/webhook-processor/trigger-analysis.test.ts`:
```ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { triggerAnalyzeCall } from "./trigger-analysis.ts";

Deno.test("triggerAnalyzeCall registers work with waitUntil when available", async () => {
  const registered: Promise<unknown>[] = [];
  const fakeEdge = { waitUntil: (p: Promise<unknown>) => registered.push(p) };
  const calls: string[] = [];
  const fakeFetch: typeof fetch = async (url) => {
    calls.push(String(url));
    return new Response("{}", { status: 200 });
  };

  triggerAnalyzeCall({
    supabaseUrl: "https://proj.supabase.co",
    serviceKey: "srv",
    callRecordId: "cr-1",
    practitionerType: "chiropractor",
    fetchImpl: fakeFetch,
    edgeRuntime: fakeEdge,
  });

  assertEquals(registered.length, 1);
  await registered[0];
  assertEquals(calls, ["https://proj.supabase.co/functions/v1/analyze-call"]);
});
```

- [ ] **Step 2: Run (expected fail)**
```bash
deno test --allow-net superpatch-frontend/supabase/functions/webhook-processor/trigger-analysis.test.ts
```

- [ ] **Step 3: Implement `trigger-analysis.ts`**

Create `superpatch-frontend/supabase/functions/webhook-processor/trigger-analysis.ts`:
```ts
interface EdgeLike { waitUntil(p: Promise<unknown>): void }

export interface TriggerAnalyzeCallArgs {
  supabaseUrl: string;
  serviceKey: string;
  callRecordId: string;
  practitionerType?: string;
  fetchImpl?: typeof fetch;
  edgeRuntime?: EdgeLike;
}

export function triggerAnalyzeCall(args: TriggerAnalyzeCallArgs): void {
  const fetchImpl = args.fetchImpl ?? fetch;
  const edge = args.edgeRuntime ?? (globalThis as { EdgeRuntime?: EdgeLike }).EdgeRuntime;
  const task = fetchImpl(`${args.supabaseUrl}/functions/v1/analyze-call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.serviceKey}`,
    },
    body: JSON.stringify({
      call_record_id: args.callRecordId,
      practitioner_type: args.practitionerType,
    }),
  })
    .then((res) => {
      if (!res.ok) console.error("[webhook-processor] analyze-call non-2xx", res.status);
    })
    .catch((err) => console.error("[webhook-processor] analyze-call trigger failed", err));

  if (edge?.waitUntil) {
    edge.waitUntil(task);
  } else {
    // Best effort when waitUntil unavailable (e.g. unit test without edge polyfill)
    void task;
  }
}
```

- [ ] **Step 4: Replace the call site in `webhook-processor/index.ts:1256-1278`**

Replace:
```ts
fetchWithTimeout(`${SUPABASE_URL}/functions/v1/analyze-call`, { ... }).catch(...)
```
with:
```ts
import { triggerAnalyzeCall } from "./trigger-analysis.ts";
// ...
triggerAnalyzeCall({
  supabaseUrl: SUPABASE_URL,
  serviceKey: supabaseServiceKey,
  callRecordId,
  practitionerType: resolvedPractitionerType,
});
```

- [ ] **Step 5: Run tests**
```bash
deno test --allow-net superpatch-frontend/supabase/functions/webhook-processor/trigger-analysis.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add superpatch-frontend/supabase/functions/webhook-processor/trigger-analysis.ts \
        superpatch-frontend/supabase/functions/webhook-processor/trigger-analysis.test.ts \
        superpatch-frontend/supabase/functions/webhook-processor/index.ts
git commit -m "fix(webhook-processor): keep analyze-call alive via EdgeRuntime.waitUntil (#plan-2.2)"
```

---

### Task 2.3 — Normalize `enrichment_status` values

Reader in `generate-daily-report/index.ts:158` uses `"completed"`. Writer in `enrich-practitioners-v2/index.ts:381` uses `"enriched"`. Pick `"enriched"` (matches existing data) and add a CHECK constraint.

**Files:**
- Modify: `superpatch-frontend/supabase/functions/generate-daily-report/index.ts:158`
- Create: `superpatch-frontend/supabase/migrations/20260422_enrichment_status_check.sql`

- [ ] **Step 1: Patch the reader**

Replace `.eq("enrichment_status", "completed")` with `.eq("enrichment_status", "enriched")`.

- [ ] **Step 2: Write the CHECK constraint migration**

Create `superpatch-frontend/supabase/migrations/20260422_enrichment_status_check.sql`:
```sql
-- Normalize any legacy "completed" rows to "enriched", then enforce domain.

UPDATE practitioners
SET enrichment_status = 'enriched'
WHERE enrichment_status = 'completed';

ALTER TABLE practitioners
  DROP CONSTRAINT IF EXISTS practitioners_enrichment_status_check;

ALTER TABLE practitioners
  ADD CONSTRAINT practitioners_enrichment_status_check
  CHECK (enrichment_status IN ('pending', 'in_progress', 'enriched', 'failed', 'skipped'));
```

- [ ] **Step 3: Apply locally and verify**
```bash
supabase db reset --local
supabase db execute --local --sql "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'practitioners_enrichment_status_check';"
```
Expected: constraint definition includes `enriched`.

- [ ] **Step 4: Commit**
```bash
git add superpatch-frontend/supabase/functions/generate-daily-report/index.ts \
        superpatch-frontend/supabase/migrations/20260422_enrichment_status_check.sql
git commit -m "fix(reports): align enrichment_status reader + add CHECK constraint (#plan-2.3)"
```

---

### Task 2.4 — Respect `BUSINESS_TIMEZONE` in bookings

**Files:**
- Modify: `superpatch-frontend/supabase/functions/book-appointment/index.ts` (already imported BUSINESS_TIMEZONE in Task 1.1; verify attendee.timeZone uses it, not the literal "America/New_York")

- [ ] **Step 1: Grep for any remaining hardcoded timezone**
```bash
rg "America/New_York" superpatch-frontend/supabase/functions superpatch-frontend/src
```
Expected: zero matches (the deprecated webhook route is already stubbed in Task 1.5).

- [ ] **Step 2: If any remain, replace with** `Deno.env.get("BUSINESS_TIMEZONE") ?? "America/Toronto"` and commit.

If the grep returns zero matches, skip — Task 1.1 already covered this.

- [ ] **Step 3 (only if changes were made): Commit**
```bash
git add -A superpatch-frontend
git commit -m "fix(tz): remove residual America/New_York hardcodes (#plan-2.4)"
```

---

### Task 2.5 — Drop hardcoded `CAL_EVENT_TYPE_ID` fallback

Already addressed in Task 1.1 (we now throw if unset). Verify in passing:

- [ ] **Step 1:** `rg "4352394|4004901" superpatch-frontend/supabase/functions` should return zero matches in `.ts` files. If any remain, remove them and re-commit. Constant lives only in `canonical_ids.json` and `_shared/pathways.ts`.

---

### Task 2.6 — Use public env var for `BLAND_FROM_NUMBER` in client code

**Files:**
- Modify: `superpatch-frontend/src/lib/batch-caller.ts:206`
- Modify: `superpatch-frontend/.env.example`
- Modify: `superpatch-frontend/src/lib/config/env.ts` (add the public var to the documented list)

- [ ] **Step 1: Write the failing test**

Create `superpatch-frontend/src/lib/batch-caller.from-number.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("BatchCaller.fromNumber", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_BLAND_FROM_NUMBER", "+15555550123");
    vi.stubEnv("BLAND_FROM_NUMBER", "");
  });

  it("reads NEXT_PUBLIC_BLAND_FROM_NUMBER on the client", async () => {
    const { resolveFromNumber } = await import("./batch-caller");
    expect(resolveFromNumber()).toBe("+15555550123");
  });
});
```

- [ ] **Step 2: Run (expected fail — function not exported)**

```bash
./node_modules/.bin/vitest run src/lib/batch-caller.from-number.test.ts
```

- [ ] **Step 3: Refactor `batch-caller.ts:206`**

Export and use a helper:
```ts
export function resolveFromNumber(): string | undefined {
  return process.env.NEXT_PUBLIC_BLAND_FROM_NUMBER;
}

// in makeBlandCall:
const fromNumber = resolveFromNumber();
```

Remove the server-only `process.env.BLAND_FROM_NUMBER` fallback.

- [ ] **Step 4: Update `.env.example`**

Add under the Bland section:
```
# Public Bland.ai caller ID (must start with NEXT_PUBLIC_ to reach the browser)
NEXT_PUBLIC_BLAND_FROM_NUMBER=+15555550123
```
Remove the now-unused `BLAND_FROM_NUMBER` entry, or annotate it `# deprecated — use NEXT_PUBLIC_BLAND_FROM_NUMBER`.

- [ ] **Step 5: Run tests**
```bash
./node_modules/.bin/vitest run src/lib/batch-caller.from-number.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add superpatch-frontend/src/lib/batch-caller.ts \
        superpatch-frontend/src/lib/batch-caller.from-number.test.ts \
        superpatch-frontend/.env.example
git commit -m "fix(batch-caller): read NEXT_PUBLIC_BLAND_FROM_NUMBER client-side (#plan-2.6)"
```

---

### Task 2.7 — Canonicalize practitioner type across webhook-processor and analyze-call

**Files:**
- Modify: `superpatch-frontend/supabase/functions/webhook-processor/index.ts:1046, 1123, 1172`
- Modify: `superpatch-frontend/supabase/functions/analyze-call/index.ts:76-90, 214`
- Create: `superpatch-frontend/supabase/functions/_shared/practitioner-type.ts`
- Create: `superpatch-frontend/supabase/functions/_shared/practitioner-type.test.ts`

- [ ] **Step 1: Write the failing test**

Create `superpatch-frontend/supabase/functions/_shared/practitioner-type.test.ts`:
```ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { canonicalPractitionerType, displayName, pathwaySummaryFor } from "./practitioner-type.ts";

Deno.test("canonicalPractitionerType collapses slugs, versions, and aliases", () => {
  assertEquals(canonicalPractitionerType("Chiropractors"), "chiropractor");
  assertEquals(canonicalPractitionerType("chiropractor_v2"), "chiropractor");
  assertEquals(canonicalPractitionerType("chiropractic_assistant"), "chiropractic_assistant");
  assertEquals(canonicalPractitionerType(undefined), "unknown");
  assertEquals(canonicalPractitionerType("physio"), "physiotherapist");
});

Deno.test("displayName returns human label", () => {
  assertEquals(displayName("chiropractor"), "Chiropractors");
});

Deno.test("pathwaySummaryFor returns canonical summary and falls back cleanly", () => {
  const summary = pathwaySummaryFor("chiropractor_v2");
  assertEquals(summary.canonical, "chiropractor");
  assertEquals(summary.summary.length > 0, true);
});
```

- [ ] **Step 2: Run (expected fail)**
```bash
deno test --allow-net superpatch-frontend/supabase/functions/_shared/practitioner-type.test.ts
```

- [ ] **Step 3: Implement `practitioner-type.ts`**

Create `superpatch-frontend/supabase/functions/_shared/practitioner-type.ts`:
```ts
export type CanonicalPractitionerType =
  | "chiropractor"
  | "chiropractic_assistant"
  | "physiotherapist"
  | "physiotherapy_assistant"
  | "massage_therapist"
  | "pharmacist"
  | "unknown";

const ALIASES: Record<string, CanonicalPractitionerType> = {
  chiropractor: "chiropractor",
  chiropractors: "chiropractor",
  chiropractor_v1: "chiropractor",
  chiropractor_v2: "chiropractor",
  chiro: "chiropractor",
  chiropractic_assistant: "chiropractic_assistant",
  "chiropractic assistants": "chiropractic_assistant",
  physiotherapist: "physiotherapist",
  physio: "physiotherapist",
  physiotherapy: "physiotherapist",
  physiotherapy_assistant: "physiotherapy_assistant",
  massage_therapist: "massage_therapist",
  rmt: "massage_therapist",
  pharmacist: "pharmacist",
};

const DISPLAY: Record<CanonicalPractitionerType, string> = {
  chiropractor: "Chiropractors",
  chiropractic_assistant: "Chiropractic Assistants",
  physiotherapist: "Physiotherapists",
  physiotherapy_assistant: "Physiotherapy Assistants",
  massage_therapist: "Massage Therapists",
  pharmacist: "Pharmacists",
  unknown: "Unknown",
};

const SUMMARIES: Record<CanonicalPractitionerType, string> = {
  chiropractor:
    "Chiropractic practice focused on spinal manipulation, neuromusculoskeletal pain, and rehab protocols. Superpatch positioned as drug-free acute and recovery pain management.",
  chiropractic_assistant:
    "Front-desk or clinical support staff supporting chiropractors. Focus on patient intake, product hand-offs, and relay of clinical benefits.",
  physiotherapist:
    "Physiotherapy practice focused on rehab, post-surgical recovery, and sports injury. Superpatch as adjunct to manual therapy and exercise programming.",
  physiotherapy_assistant:
    "Support staff running patient exercise plans. Introduce Superpatch as in-clinic + take-home recovery aid.",
  massage_therapist:
    "RMT practice focused on soft-tissue recovery. Superpatch supports between-session pain management.",
  pharmacist:
    "Community pharmacy. Superpatch as OTC drug-free pain option for patients avoiding NSAIDs.",
  unknown:
    "Unknown practitioner type — default to chiropractor framing until we confirm the practice model.",
};

export function canonicalPractitionerType(
  raw: string | undefined | null,
): CanonicalPractitionerType {
  if (!raw) return "unknown";
  const key = String(raw).toLowerCase().trim().replace(/\s+/g, "_");
  return ALIASES[key] ?? ALIASES[key.replace(/_v\d+$/, "")] ?? "unknown";
}

export function displayName(canonical: CanonicalPractitionerType): string {
  return DISPLAY[canonical];
}

export function pathwaySummaryFor(raw: string | undefined | null) {
  const canonical = canonicalPractitionerType(raw);
  return { canonical, summary: SUMMARIES[canonical] };
}
```

- [ ] **Step 4: Use it in `webhook-processor`**

At line 1046:
```ts
import { canonicalPractitionerType } from "../_shared/practitioner-type.ts";

const practitionerType = canonicalPractitionerType(
  vars.practitioner_type || meta.practitioner_type || meta.selected_pathway,
);
```

Everywhere the code currently writes `resolvedPractitionerType` to the DB, ensure it passes through `canonicalPractitionerType()`.

- [ ] **Step 5: Use it in `analyze-call`**

Replace lines 76–90 and line 214:
```ts
import { pathwaySummaryFor } from "../_shared/practitioner-type.ts";
// ...
const { summary: pathwaySummary } = pathwaySummaryFor(practitionerType);
```
Delete the old `PATHWAY_SUMMARIES` constant.

- [ ] **Step 6: Run tests**
```bash
deno test --allow-net superpatch-frontend/supabase/functions/_shared/practitioner-type.test.ts
```
Expected: all 3 pass.

- [ ] **Step 7: Commit**
```bash
git add superpatch-frontend/supabase/functions/_shared/practitioner-type.ts \
        superpatch-frontend/supabase/functions/_shared/practitioner-type.test.ts \
        superpatch-frontend/supabase/functions/webhook-processor/index.ts \
        superpatch-frontend/supabase/functions/analyze-call/index.ts
git commit -m "fix(edge): canonicalize practitioner type across webhook + analyze (#plan-2.7)"
```

---

### Task 2.8 — Preserve notes history when `book-appointment` writes back

**Files:**
- Modify: `superpatch-frontend/supabase/functions/book-appointment/index.ts` (the `updateCallRecord` block)

- [ ] **Step 1: Write the failing test**

Append to an existing suite `superpatch-frontend/supabase/functions/book-appointment/index.test.ts` (create if needed) a test that asserts:
```ts
import { describe, it, expect } from "vitest";
import { buildNotesUpdate } from "./notes.ts";

describe("buildNotesUpdate", () => {
  it("appends the Cal booking ID instead of overwriting", () => {
    const result = buildNotesUpdate("Prior notes from agent", "xyz-123");
    expect(result).toContain("Prior notes from agent");
    expect(result).toContain("Cal.com Booking ID: xyz-123");
  });
  it("handles null prior notes", () => {
    expect(buildNotesUpdate(null, "abc")).toBe("Cal.com Booking ID: abc");
  });
});
```

- [ ] **Step 2: Run (expected fail — helper missing)**
```bash
cd superpatch-frontend
./node_modules/.bin/vitest run supabase/functions/book-appointment/index.test.ts
```

Note: This test uses Vitest (not Deno test) because our CI already runs Vitest; the file is TypeScript-compatible with both.

- [ ] **Step 3: Create `book-appointment/notes.ts`**
```ts
export function buildNotesUpdate(prior: string | null, calBookingId: string): string {
  const line = `Cal.com Booking ID: ${calBookingId}`;
  if (!prior || !prior.trim()) return line;
  if (prior.includes(line)) return prior;
  return `${prior.trimEnd()}\n${line}`;
}
```

- [ ] **Step 4: Use it in `index.ts`**

Replace the line that sets `notes: \`Cal.com Booking ID: ${bookingId}\`` with:
```ts
import { buildNotesUpdate } from "./notes.ts";
// ...
const { data: existing } = await supabase
  .from("call_records")
  .select("notes")
  .eq("id", callRecordId)
  .maybeSingle();

await supabase
  .from("call_records")
  .update({
    appointment_booked: true,
    appointment_id: bookingId,
    appointment_status: "confirmed",
    notes: buildNotesUpdate(existing?.notes ?? null, bookingId),
  })
  .eq("id", callRecordId);
```

- [ ] **Step 5: Run tests** → PASS.
- [ ] **Step 6: Commit**
```bash
git add superpatch-frontend/supabase/functions/book-appointment/notes.ts \
        superpatch-frontend/supabase/functions/book-appointment/index.ts \
        superpatch-frontend/supabase/functions/book-appointment/index.test.ts
git commit -m "fix(book-appointment): append Cal booking ID to notes (#plan-2.8)"
```

---

### Task 2.9 — Unify boolean/string coercion for `wants_demo`, `decision_maker`, etc.

**Files:**
- Create: `superpatch-frontend/supabase/functions/_shared/coerce.ts`
- Create: `superpatch-frontend/supabase/functions/_shared/coerce.test.ts`
- Modify: `webhook-processor/index.ts`, `analyze-call/index.ts`, `book-appointment/index.ts` wherever booleans are read from webhook `variables`.

- [ ] **Step 1: Write the failing test**
```ts
// _shared/coerce.test.ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { toBool } from "./coerce.ts";

Deno.test("toBool handles booleans, common strings, and null", () => {
  assertEquals(toBool(true), true);
  assertEquals(toBool(false), false);
  assertEquals(toBool("true"), true);
  assertEquals(toBool("YES"), true);
  assertEquals(toBool("1"), true);
  assertEquals(toBool("no"), false);
  assertEquals(toBool(""), false);
  assertEquals(toBool(null), false);
  assertEquals(toBool(undefined), false);
  assertEquals(toBool(0), false);
});
```

- [ ] **Step 2: Implement**
```ts
// _shared/coerce.ts
export function toBool(v: unknown): boolean {
  if (v === true) return true;
  if (v === false || v == null) return false;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    return ["true", "yes", "y", "1"].includes(v.trim().toLowerCase());
  }
  return false;
}
```

- [ ] **Step 3:** Replace every `vars.wants_demo === true` / `vars.decision_maker.toLowerCase()` pattern with `toBool(vars.wants_demo)` / `toBool(vars.decision_maker)`. Grep first:
```bash
rg "wants_demo|decision_maker" superpatch-frontend/supabase/functions/
```

- [ ] **Step 4:** Run tests, commit.
```bash
git add superpatch-frontend/supabase/functions/_shared/coerce.ts \
        superpatch-frontend/supabase/functions/_shared/coerce.test.ts \
        superpatch-frontend/supabase/functions
git commit -m "fix(edge): unified bool coercion for webhook variables (#plan-2.9)"
```

---

## Phase 3 — P2 Correctness and Hardening

---

### Task 3.1 — Sanitize `samples` API search (PostgREST injection)

**Files:**
- Modify: `superpatch-frontend/src/app/api/samples/route.ts:37-44`

- [ ] **Step 1: Write the failing test**

Create `superpatch-frontend/src/app/api/samples/route.search.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildSampleSearchOr } from "./search";

describe("buildSampleSearchOr", () => {
  it("escapes PostgREST control characters", () => {
    const clause = buildSampleSearchOr("foo),shipping_address.is.not.null,(");
    expect(clause).not.toMatch(/,shipping_address\.is\./);
    expect(clause).toContain("requester_name.ilike.%foo");
  });

  it("returns null for empty input", () => {
    expect(buildSampleSearchOr("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run (expected fail)**

- [ ] **Step 3: Extract `search.ts`**
```ts
// src/app/api/samples/search.ts
export function buildSampleSearchOr(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.replace(/[(),%]/g, "").slice(0, 120);
  if (!cleaned) return null;
  const esc = cleaned.replace(/\*/g, "");
  return [
    `requester_name.ilike.%${esc}%`,
    `practice_name.ilike.%${esc}%`,
    `email.ilike.%${esc}%`,
    `phone.ilike.%${esc}%`,
  ].join(",");
}
```

- [ ] **Step 4: Use it in `route.ts`**
```ts
import { buildSampleSearchOr } from "./search";
// ...
const orClause = buildSampleSearchOr(search ?? "");
if (orClause) query = query.or(orClause);
```

- [ ] **Step 5: Apply the same pattern to `campaign/memory/route.ts:~206`** (phone search). Extract `buildMemoryPhoneOr`, reuse the sanitizer.

- [ ] **Step 6: Commit**
```bash
git add superpatch-frontend/src/app/api/samples/ \
        superpatch-frontend/src/app/api/campaign/memory/route.ts
git commit -m "fix(api): sanitize PostgREST search inputs (#plan-3.1)"
```

---

### Task 3.2 — Cap sample CSV export

**Files:**
- Modify: `superpatch-frontend/src/app/api/samples/route.ts` (CSV branch)

- [ ] **Step 1: Write the failing test asserting 10k cap**
```ts
import { describe, it, expect } from "vitest";
import { SAMPLES_CSV_MAX_ROWS } from "./constants";

describe("samples csv cap", () => {
  it("is 10000", () => {
    expect(SAMPLES_CSV_MAX_ROWS).toBe(10_000);
  });
});
```

- [ ] **Step 2: Add constant + apply `.limit(SAMPLES_CSV_MAX_ROWS)` in the CSV code path.**

- [ ] **Step 3: Commit**
```bash
git add superpatch-frontend/src/app/api/samples
git commit -m "fix(samples): cap CSV export at 10k rows (#plan-3.2)"
```

---

### Task 3.3 — Validate AI-extracted emails before writing to `sample_requests`

**Files:**
- Modify: `superpatch-frontend/supabase/functions/webhook-processor/index.ts` (around `saveSampleRequest`)

- [ ] **Step 1: Write the failing test (pure function)**

Create `superpatch-frontend/supabase/functions/webhook-processor/email.test.ts`:
```ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { pickSampleEmail } from "./email.ts";

Deno.test("prefers form email over AI email when present", () => {
  assertEquals(
    pickSampleEmail({ aiEmail: "ai@weird.xyz", formEmail: "real@clinic.ca", dbEmail: null }),
    "real@clinic.ca",
  );
});

Deno.test("drops AI email if it does not look like a valid email", () => {
  assertEquals(
    pickSampleEmail({ aiEmail: "not an email", formEmail: null, dbEmail: null }),
    null,
  );
});

Deno.test("falls back to DB email when form and AI absent", () => {
  assertEquals(
    pickSampleEmail({ aiEmail: null, formEmail: null, dbEmail: "known@clinic.ca" }),
    "known@clinic.ca",
  );
});
```

- [ ] **Step 2: Implement `email.ts`**
```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (e: string | null | undefined) =>
  !e ? null : EMAIL_RE.test(e.trim()) ? e.trim().toLowerCase() : null;

export function pickSampleEmail(args: {
  aiEmail: string | null | undefined;
  formEmail: string | null | undefined;
  dbEmail: string | null | undefined;
}): string | null {
  return clean(args.formEmail) ?? clean(args.dbEmail) ?? clean(args.aiEmail);
}
```

- [ ] **Step 3: Apply in `webhook-processor`** where `sample_requests.email` is resolved.

- [ ] **Step 4: Commit**
```bash
git add superpatch-frontend/supabase/functions/webhook-processor/email.ts \
        superpatch-frontend/supabase/functions/webhook-processor/email.test.ts \
        superpatch-frontend/supabase/functions/webhook-processor/index.ts
git commit -m "fix(samples): validate email priority (form > db > AI) (#plan-3.3)"
```

---

### Task 3.4 — Fix `sample_type` classification

**Files:**
- Modify: `webhook-processor/index.ts` around line 1305

- [ ] **Step 1: Write the failing test**
```ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { classifySampleType } from "./sample-type.ts";

Deno.test("classifySampleType recognizes explicit standard_kit", () => {
  assertEquals(classifySampleType("standard_kit"), "standard_kit");
  assertEquals(classifySampleType("all"), "standard_kit");
  assertEquals(classifySampleType(""), "standard_kit");
  assertEquals(classifySampleType("freedom,boost"), "custom");
});
```

- [ ] **Step 2: Implement**
```ts
export function classifySampleType(raw: string | null | undefined): "standard_kit" | "custom" {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v || v === "all" || v === "standard_kit" || v === "standard kit") return "standard_kit";
  return "custom";
}
```

- [ ] **Step 3:** Wire it in at the classification site.
- [ ] **Step 4:** Commit.
```bash
git add superpatch-frontend/supabase/functions/webhook-processor/sample-type.ts \
        superpatch-frontend/supabase/functions/webhook-processor/sample-type.test.ts \
        superpatch-frontend/supabase/functions/webhook-processor/index.ts
git commit -m "fix(samples): classify standard_kit literal correctly (#plan-3.4)"
```

---

## Phase 4 — P3 Cleanup and Guardrails

---

### Task 4.1 — Delete dead code

- [ ] **Step 1:** Remove unused `callId` parameter in `process-retry-queue/index.ts:210`.
- [ ] **Step 2:** Remove the `replace(/```json\n?|\n?```/g, "")` regex guard in `analyze-call/index.ts` if the LLM prompt is producing clean JSON; keep it if staging logs still show markdown fences. Document the decision inline with a one-line comment citing this task.
- [ ] **Step 3:** Commit:
```bash
git commit -am "chore(edge): remove dead code paths (#plan-4.1)"
```

---

### Task 4.2 — Add a canonical-ID sync test for the Deno runtime

**Files:**
- Create: `superpatch-frontend/supabase/functions/_shared/pathways.test.ts`

- [ ] **Step 1: Test**
```ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { PATHWAY_IDS, DEFAULT_PATHWAY_ID, KB_ID, VOICE_ID, DEFAULT_WEBHOOK_URL } from "./pathways.ts";

const canonical = JSON.parse(
  await Deno.readTextFile(
    new URL("../../../../b2b_sales_enablement/bland_ai_pathways/canonical_ids.json", import.meta.url),
  ),
);

Deno.test("pathways.ts mirrors canonical_ids.json", () => {
  assertEquals(PATHWAY_IDS, canonical.bland.pathways);
  assertEquals(DEFAULT_PATHWAY_ID, canonical.bland.defaultPathwayId);
  assertEquals(KB_ID, canonical.bland.kbId);
  assertEquals(VOICE_ID, canonical.bland.voiceId);
  assertEquals(DEFAULT_WEBHOOK_URL, canonical.bland.defaultWebhookUrl);
});
```

- [ ] **Step 2: Run**
```bash
deno test --allow-read superpatch-frontend/supabase/functions/_shared/pathways.test.ts
```

- [ ] **Step 3: Commit**
```bash
git add superpatch-frontend/supabase/functions/_shared/pathways.test.ts
git commit -m "test(edge): assert pathways.ts mirrors canonical_ids.json (#plan-4.2)"
```

---

### Task 4.3 — Ensure the book-appointment trigger is disabled on prod

A prior migration `20260421_disable_book_appointment_trigger.sql` was written. Confirm it's in `supabase/migrations/` and applied on prod.

- [ ] **Step 1:**
```bash
ls superpatch-frontend/supabase/migrations | grep disable_book_appointment_trigger
```
Expected: one file. If missing, re-add it (see the prior session's fix).

- [ ] **Step 2:** On staging/prod:
```bash
supabase db execute --linked --sql "SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trg_book_appointment';"
```
Expected: `tgenabled = 'D'` (disabled) OR the trigger has been dropped. If still `O`, re-run the disable migration.

---

### Task 4.4 — Update documentation

**Files:**
- Modify: `superpatch-frontend/docs/CALL_CENTER.md` — add "API versions" section listing Cal.com v2, Bland.ai v1, noting `CAL_API_VERSION` env var.
- Modify: `superpatch-frontend/docs/SYSTEM_REVIEW_FINDINGS.md` — mark the 25 bugs from this plan as "Resolved in 2026-04-22 PR".
- Modify: `superpatch-frontend/docs/CHANGELOG.md` — append phase-by-phase entries.
- Modify: `docs/dev/changelog.md` — append the Supabase / Python-side changes.

- [ ] **Step 1:** Perform updates above and commit:
```bash
git add superpatch-frontend/docs docs/dev/changelog.md
git commit -m "docs: record 2026-04-22 call-center production-fix plan outcomes (#plan-4.4)"
```

---

## End-to-End Verification

After all four phases merge to `main`, run this full-stack smoke in staging before promoting to prod.

- [ ] **Smoke 1: Enrichment cron**
  - Insert a practitioner with `enrichment_status = 'pending'` and a real website.
  - Wait 30 minutes or trigger `/functions/v1/enrich-practitioners-v2` manually.
  - Assert: row ends with `enrichment_status = 'enriched'` and populated `enrichment_data`.

- [ ] **Smoke 2: Retry cron**
  - Insert a practitioner with `next_retry_at < now()` and `retry_count = 0`.
  - Trigger `/functions/v1/process-retry-queue`.
  - Assert: Bland call initiated; `retry_count = 1`; no RPC errors in logs.

- [ ] **Smoke 3: Demo booking end-to-end**
  - Run a Bland test call that extracts `wants_demo: true` and a future `appointment_time`.
  - Assert: `appointments` row with `status = 'confirmed'` and real `cal_booking_uid`; Cal.com dashboard shows the booking in `America/Toronto`; `call_records.notes` still contains any prior agent notes AND the new Cal ID line.

- [ ] **Smoke 4: Sample request end-to-end**
  - Trigger a Bland call that extracts `wants_sample: true`.
  - Assert: `sample_requests` row persists (no "column does not exist" error in logs), `pg_notify('new_sample_request', ...)` event observed on the channel.
  - Run the CSV export for a large window and confirm response < 10k rows.

- [ ] **Smoke 5: Daily report**
  - Trigger `/functions/v1/generate-daily-report` manually.
  - Assert: `campaign_analytics` row for today includes `enriched_practitioners > 0` for tenants with enriched rows.

- [ ] **Smoke 6: Cal sync**
  - Cancel an appointment from Cal.com UI.
  - Trigger `/functions/v1/sync-cal-bookings`.
  - Assert: matching `appointments.status = 'cancelled'` AND `call_records.appointment_status = 'cancelled'` for the same call.

- [ ] **Smoke 7: Deprecated webhook is dead**
  - `curl -X POST https://<prod>/api/webhooks/bland -d '{}' -H 'content-type: application/json'` returns 410 with `{"deprecated": true}`.

- [ ] **Smoke 8: Vitest + Deno test suites green**
```bash
cd superpatch-frontend
./node_modules/.bin/vitest run
deno test --allow-net --allow-read supabase/functions
```

---

## Self-Review

1. **Spec coverage:** Every bug enumerated in the 2026-04-21 P0/P1/P2/P3 report has a matching task. Cross-check:
   - P0 #1 Cal.com v2 → Tasks 1.1, 1.2
   - P0 #2 sample trigger → Task 1.3
   - P0 #3 cron endpoint + P0 #4 empty Bearer → Task 1.4
   - P0 #5 deprecated route → Task 1.5
   - P1 #6 RPC arg → Task 2.1
   - P1 #7 fire-and-forget → Task 2.2
   - P1 #8 enrichment_status → Task 2.3
   - P1 #9 sync-cal-bookings case sensitivity → already rolled into Task 1.2 (normalizeCalStatus)
   - P1 #10 hardcoded TZ → Task 2.4
   - P1 #11 hardcoded event type → Task 2.5
   - P1 #12 practitioner type → Task 2.7
   - P1 #13 analyze-call display-name keys → Task 2.7
   - P1 #14 client-side env var → Task 2.6
   - P2 #15 injection → Task 3.1
   - P2 #16 CSV cap → Task 3.2
   - P2 #17 bool coercion → Task 2.9
   - P2 #18 sample_type → Task 3.4
   - P2 #19 notes overwrite → Task 2.8
   - P2 #20 memory phone search → rolled into Task 3.1
   - P2 #21 AI email validation → Task 3.3
   - P3 #22 dead code → Task 4.1
   - P3 #23 delete legacy route → completed in Task 1.5
   - P3 #24 CHECK constraint → rolled into Task 2.3
   - P3 #25 canonical-ID test → Task 4.2

2. **Placeholder scan:** No "TBD", "handle appropriately", or bare "add validation". Every step shows concrete code or commands.

3. **Type consistency:** Helper names align across tasks (`incrementRetry`, `createCalBooking`, `listCalBookings`, `normalizeCalStatus`, `triggerAnalyzeCall`, `canonicalPractitionerType`, `pathwaySummaryFor`, `toBool`, `buildSampleSearchOr`, `classifySampleType`, `pickSampleEmail`, `buildNotesUpdate`).

---

## Execution Handoff

Plan complete and saved to `superpatch-frontend/docs/superpowers/plans/2026-04-21-ai-call-center-production-fixes.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — one fresh subagent per task, two-stage review between tasks. Fast iteration, low context bloat.
2. **Inline Execution** — work through the plan task-by-task in this session using `superpowers:executing-plans`, stopping at each phase gate for user checkpoint.

Which approach?
