# Frontend Changelog

Frontend app deltas (Next.js app, API routes, client components, frontend deps). Backend / system deltas live in `docs/dev/changelog.md` at the repo root. Newest entries at the top. Entries follow the README Delta template from `.cursor/rules/readme-first-session.mdc`.

---

## 2026-06-15 — Quick-call aborted by optional email validation

- **What changed**:
  - `src/lib/validation.ts` — `CreatePractitionerSchema.contact_email` (and `website`) now `z.preprocess`-trim their input before `.email()`/`.url()`. A stray trailing space or whitespace-only value no longer fails validation; the trimmed value is what gets stored. A genuinely malformed email is still rejected.
  - `src/components/campaign/quick-call-tab.tsx` — `handleManualCall` now trims the email once (`contactEmail`), and if the operator typed an invalid address it shows a clear, actionable toast ("Correct it or clear the field to place the call.") and stops *before* the practitioner save, instead of letting a cryptic `400 (contact_email: Invalid email address)` abort the dial. The trimmed value is reused for `contact_email`, `practice_email`, and `clinic_email`.
- **Why it changed**: one-off calls were failing with `Failed to save practitioner (400)… Call aborted to prevent untracked record. {"error":"Validation failed: contact_email: Invalid email address"}` whenever the optional email field held a typo or trailing space — even though email is not required to place a call.
- **Code touchpoints**: `src/lib/validation.ts`, `src/components/campaign/quick-call-tab.tsx`, `src/__tests__/validation.test.ts`.
- **Data-flow impact**: dialer (Quick Call) → `POST /api/practitioners` save → call placement. No schema/DB change.
- **ID / contract changes**: none.
- **API / schema impact**: `CreatePractitionerSchema` now trims `contact_email`/`website` (more lenient inputs, same stored shape).
- **Verification**: `npm test` 264/264 (7 new `CreatePractitionerSchema` email/website cases); `tsc --noEmit` clean; lint clean.

---

## 2026-06-05 — Call-center wiring bug-fix sweep (frontend slice)

End-to-end review remediation. Closes silent-failure and RLS gaps across the dialer → UI → API data flow. Backend/Edge/migration slice is in `docs/dev/changelog.md`.

- **What changed**:
  - `src/hooks/useSampleRequests.ts` — sample PATCH now sends a flattened body (`{ id, ...updates }` / `{ ids, ...updates }`). The route's `UpdateSampleSchema` has no `updates` key, so the previous nested payload was stripped by Zod and wrote `{}`. `src/__tests__/samples-update.test.ts` added.
  - `src/lib/db/call-records.ts` + `src/lib/db/call-notes.ts` — both modules now select the DB client via `getDb()` = `supabaseAdmin ?? supabase`. These run server-side from API routes that already enforce `requireApiAuth()`; the anon client carried no JWT so `is_active_user()` RLS returned empty/failed. localStorage fallback preserved when neither client is configured. `src/__tests__/call-records-admin-client.test.ts` added.
  - `src/lib/db/call-records.ts` — `getCallRecord` is now multi-row safe (`order created_at desc` + `.limit(1).maybeSingle()`); `.single()` threw when a practitioner had >1 record.
  - `src/lib/batch-caller.ts` — status transitions now sync to Supabase (`syncStatusToSupabase`, PATCH then POST fallback) after every `updateCallStatus`, so the queue/KPIs/badges (driven by `useSupabaseCallRecords`) no longer stay stale during a campaign. Added a `do_not_call` guard in `makeCall` and a skip+`call_failed` emit in `processQueue`. Tests: `src/__tests__/batch-caller-sync.test.ts`, extended `batch-caller.test.ts`.
  - `src/components/campaign/practitioner-detail-drawer.tsx` — implemented "Add to Queue", "Edit Practitioner" (dialog + PATCH), and "Delete Practitioner" (confirm dialog + DELETE); added `onQueued`/`onPractitionerUpdated`/`onPractitionerDeleted` callbacks.
  - `src/app/api/practitioners/[id]/route.ts` (new) — `PATCH` (whitelist fields via `UpdatePractitionerSchema`) and `DELETE`, both `requireApiAuth()` + `supabaseAdmin`. `src/lib/validation.ts` gained `UpdatePractitionerSchema`. `src/__tests__/practitioners-id-route.test.ts` added.
  - `src/app/campaign/page.tsx` — wired the new drawer callbacks; applied `hasWebsiteOnly` + `callStatusFilter` via the new pure `src/lib/campaign-filters.ts` (`applyListFilters` / `matchesCallStatus`, tested in `campaign-filters.test.ts`); wired `useRealtimePractitioners` enrichment callbacks to patch row `enrichment_status` live; removed dead imports/hooks (`Separator`, `FunnelView`, `ActivityFeedCompact`, `GaugeChart`/`RadialProgressChart`/`StatCard`/`KPIGrid`, `DEFAULT_COLUMNS`, `SortState`, unused lucide icons, `resetColumns`); added `country`/`enrichment_status` to `PractitionerData` and made the sort comparator type-safe (removed `any`).
  - `src/app/api/search/import/route.ts` — post-import auto-enrich now invokes the `enrich-practitioners-v2` Edge Function with the service-role bearer instead of a cookieless internal `fetch('/api/search/enrich')` that 401'd. `src/__tests__/search-import-enrich.test.ts` added.
- **Why it changed**: Call-center end-to-end review found silent failures (sample PATCH no-op, stale dialer UI, 401'd enrichment) and RLS-blocked server reads/writes.
- **Code touchpoints**: see above.
- **Data-flow impact**: dialer → call_records sync, sample fulfilment update, lead enrichment after import, drawer practitioner CRUD, list filtering.
- **ID / contract changes**: None.
- **API / schema impact**: New `PATCH`/`DELETE /api/practitioners/[id]`. Sample PATCH body shape corrected (flat fields).
- **Verification**: `npx vitest run` (touched suites green), `npx tsc --noEmit` clean, `npx eslint src/app/campaign/page.tsx` → 0 errors (3 pre-existing exhaustive-deps warnings).

---

## 2026-05-14 — Production-hardening sweep: HTTP contract honesty + UI truth alignment

Frontend slice of the cross-stack deep-dive (full report in `docs/dev/changelog.md`). Fixes silent-failure modes in API DELETE handlers, the quick-call dialer, the practitioner detail drawer, the campaign storage helper, and the batch caller's concurrency model.

- **What changed**:
  - `src/app/api/campaign/calls/route.ts` — DELETE for a specific practitioner now returns HTTP 500 (was 200) when `deleteCallRecord` returns false. Clients checking `response.ok` will now see failures.
  - `src/app/api/campaign/notes/route.ts` — same fix for `DELETE /api/campaign/notes`. HTTP 500 on delete failure, HTTP 400 on missing `id`.
  - `src/__tests__/api-delete-status-codes.test.ts` (new) — 6 Vitest tests covering both endpoints (success → 200, failure → 500, missing id → 400, clearAll → 200).
  - `src/components/campaign/quick-call-tab.tsx` — manual dial path now ABORTS when the `/api/practitioners` save fails. Previously it logged the error and proceeded with `practitionerId = null`, relying on the webhook's phone-only lookup which is brittle (reformatted numbers, hidden caller-id). Operator now sees a `toast.error` with the HTTP status + truncated error body, and the call is not dispatched. `dispatch({ type: "SET_MAKING", value: false })` runs in every abort branch so the button doesn't stick.
  - `src/components/campaign/practitioner-detail-drawer.tsx` — notes PATCH now SURFACES failures (toast + console.error) instead of silently falling back to `saveCallRecord` (localStorage-only). Operators can no longer write a note, see "saved", and have the next operator on a different machine not see it. localStorage is now only written as a MIRROR on success.
  - `src/lib/campaign-storage.ts` — `createCallRecord` fire-and-forget Supabase sync now escalates the failure log from `console.warn` to `console.error` so drift is visible. The fire-and-forget pattern is preserved for batch-dial throughput; the campaign page and quick-call tab continue to await sync explicitly via `syncCallRecordToSupabase`. (An earlier iteration of this commit also wrote a `_sync_failed_at` marker to localStorage on failure, but it was removed before commit — nothing read it, which violates the no-scaffold-code rule.)
  - `src/lib/batch-caller.ts` — added `inFlightPractitioners: Set<string>` mutex inside the `BatchCaller` class. `makeCall(p)` short-circuits with `{ success: false, error: "Call already in progress for this practitioner" }` if `p.id` is already in flight. Prevents double-dial on rapid-click, two tabs, or two operators racing the same practitioner. The mutex is released in a `finally` block so a thrown error doesn't permanently lock a practitioner.
  - `src/__tests__/batch-caller.test.ts` — new test "rejects a second concurrent call for the same practitioner" exercises in-flight, post-release, and 3rd-call success.
- **Why it changed**: Silent-failure deep-dive surfaced these as P1 items (full ranking in `docs/dev/changelog.md`).
- **Code touchpoints**: see above.
- **Data-flow impact**: Aligns frontend UX with HTTP truth. Failed deletes, failed practitioner saves, failed note syncs, and concurrent dials no longer present as success.
- **ID / contract changes**: None.
- **API / schema impact**: DELETE response contract changed: now uses HTTP 500 on failure. Body shape unchanged (`{ status: "error", message }`).
- **Verification**:
  - `npm test -- --run` → **185/185 passing** (gained 6 DELETE tests + 1 mutex test).
  - `npx tsc --noEmit` → clean.
  - `ReadLints` on `src/` → no errors.

---

## 2026-05-14 — Sidebar green-call indicator now reconciles on every route

- **What changed**:
  - Extracted the previously inline `useQuickStats` hook from `src/components/layout/app-sidebar.tsx` into `src/hooks/useQuickStats.ts` and wired `reconcileStaleInProgressRecords()` (from `@/lib/campaign-storage`) into every poll tick — both the initial mount tick and the recurring 10-second interval. Behaviour parity preserved: the same counts (`activeCalls` / `queuedCalls` / `todayBooked`) are computed from `localStorage["superpatch_campaign_calls"]`, the same `storage` event listener triggers a re-read, and the same 24h `in_progress` → `failed` safety-net cleanup runs.
  - Added `src/__tests__/useQuickStats.test.ts` (4 vitest cases) covering: reconciler runs on first render, empty-storage returns zero counts, today `in_progress` records count as active, and the reported `activeCalls` drops back to 0 immediately after the reconciler flips a stale record to `failed`.
- **Why it changed**: The green pulse on the "Call Center" sidebar item is driven by `quickStats.activeCalls > 0`. That count is taken from a localStorage flag (`status === "in_progress"` for today). The flag gets cleared by either (a) `webhook-processor` delivery (broken pre-`verify_jwt` fix — see today's root-changelog entry), or (b) `reconcileStaleInProgressRecords()` flipping records older than 20 minutes to `failed`. Pre-fix, the reconciler was mounted only on `/campaign` (`src/app/campaign/page.tsx:362-374`), so any operator who dialed a call and then navigated to `/campaign/samples`, `/campaign/appointments`, `/` (D2C/B2B/Canadian markets), Settings, or the Pathway Insights view saw the pulse stay lit until the 24h sweep — even after an abrupt hang-up. The sidebar is global, so the reconciler now lives where the indicator does.
- **Code touchpoints**:
  - `superpatch-frontend/src/hooks/useQuickStats.ts` (new).
  - `superpatch-frontend/src/components/layout/app-sidebar.tsx` — removed the inline `useQuickStats` definition (lines 113-188 in the prior version); now imports the hook from `@/hooks/useQuickStats`.
  - `superpatch-frontend/src/__tests__/useQuickStats.test.ts` (new).
- **Data-flow impact**: Sidebar indicator only. No DB write, no API, no Edge Function, no pathway behavior changed. The `/campaign` page still runs its own `reconcileStaleInProgressRecords()` calls (page-mount and visibilitychange) — those are now functionally redundant but harmless (`reconcileStaleInProgressRecords` is idempotent and short-circuits when there are no stale records); they can be removed in a follow-up.
- **ID / contract changes**: None.
- **API / schema impact**: None.
- **Operational**:
  1. With `webhook-processor` healthy again (root changelog entry), `updateFromWebhook` will clear `in_progress` records the moment Bland's post-call webhook lands — usually within a few seconds of hang-up. The 20-minute reconciler is now a fallback, not the primary path.
  2. Open follow-up: drop the 20-minute reconciliation window to ~5 minutes once we have a week of healthy webhook deliveries. Tracked informally; not on a dedicated plan yet.
  3. Optional (not in this delta): poll `/api/bland/calls/{id}` from the dialer after dial so the localStorage record is flipped to `completed`/`failed` independent of webhook latency. Worth doing if we observe meaningful webhook latency in the next test cycle.
- **Verification**:
  - `npx vitest run src/__tests__/useQuickStats.test.ts` → 4/4 ✅.
  - `npm test -- --run` from `superpatch-frontend/` → **178/178 ✅**.
  - `npx tsc --noEmit` → clean.
  - Manual: after an abrupt hang-up, navigate to any route other than `/campaign`; within a single 10-second poll tick the reconciler runs and the pulse clears (provided `call_started_at + 20 min` is in the past, per the reconciler's existing threshold).

---

## 2026-05-12

### Fixed
- `superpatch-frontend/supabase/migrations/20260512_fix_sample_notification_trigger.sql` recreates `notify_new_sample_request()` to reference the real `sample_requests` columns (`requester_name`, `practice_name`, `products_requested`, `shipping_address`, `shipping_city`, etc.). The 20260115 trigger referenced columns that never existed (`practitioner_name`, `practitioner_type`, `products`, `address`), so every AFTER INSERT raised `column ... does not exist` and rolled the insert back — no sample requests had been persisting in production. Migration drops both the legacy `trigger_notify_new_sample` and the new `trg_notify_new_sample_request` defensively before recreating.
- `superpatch-frontend/supabase/migrations/20260512_repoint_cron_jobs.sql` repoints the four HTTP pg_cron jobs (`process-enrichment-queue`, `process-retry-queue`, `sync-cal-bookings`, `generate-daily-report`) so they (a) target the correct Edge Function names — `enrich-practitioners-v2` was previously `enrich-practitioners` (404) — and (b) read the Bearer token from `vault.decrypted_secrets` instead of the unset `supabase.service_role_key` runtime setting. Without this fix, every scheduled invocation was rejected with HTTP 401, so enrichment, retry calls, Cal sync, and daily reports had been silently failing in production. `cleanup-stale-enrichment` (pure SQL, no HTTP) is preserved unchanged.
- `superpatch-frontend/src/app/api/webhooks/bland/route.ts` retired. The previous implementation ran ~1,370 lines of parallel Bland.ai webhook logic that conflicted with the canonical Supabase Edge Function `webhook-processor` (Cal.com v1, AI-email leak, boolean `.toLowerCase()` crash, DST-broken business-hours math). The route now returns HTTP 410 with `{ deprecated: true, replacement: "/functions/v1/webhook-processor" }` so any misconfigured Bland pathway surfaces immediately instead of silently double-writing rows. Replaced by a vitest test in `src/app/api/webhooks/bland/route.test.ts` asserting the 410 contract.
- `superpatch-frontend/supabase/functions/process-retry-queue/index.ts` was calling the `increment_retry_count` RPC with the wrong argument name (`practitioner_id`), which always returned `PGRST202` "function not found" and silently fell through to a non-atomic read-then-update path — defeating the race-condition guard the RPC was added for. Refactored into a focused `process-retry-queue/retry.ts` helper that uses the correct `p_id` argument, plus three Deno tests covering the happy path, RPC errors, and missing-data responses.
- `superpatch-frontend/supabase/functions/webhook-processor/index.ts` now hands the fire-and-forget `analyze-call` fetch to `EdgeRuntime.waitUntil`. Previously the promise was dropped on the floor, so the Supabase Edge Runtime could terminate the isolate before the request flushed and the analysis would silently never run — leaving call records stuck in `analysis_status: "processing"`. Guarded for local/unit-test contexts where `EdgeRuntime` is undefined.
- Normalize `practitioners.enrichment_status` to the canonical value `'enriched'`. The writer (`enrich-practitioners-v2`) had already moved off the older `'completed'` value, but `generate-daily-report`, the `get_enrichment_stats` / `queue_practitioners_for_enrichment` RPCs, and `useRealtimePractitioners` still filtered on `'completed'` — so dashboards underreported enrichment counts and the queue RPC let already-enriched practitioners be re-queued. `supabase/migrations/20260513_normalize_enrichment_status.sql` backfills legacy `'completed'` rows, recreates both RPCs to filter on `'enriched'`, and adds a CHECK constraint pinning the column to `('pending', 'in_progress', 'enriched', 'failed', 'skipped')` so the drift cannot reopen. `get_enrichment_stats` keeps its return column named `completed` (now sourced from the `'enriched'` filter) for backward compatibility with the realtime hook. The dead-code `|| existing.enrichment_status === "completed"` branch in `src/app/api/search/enrich/route.ts` is also removed.
- `superpatch-frontend/supabase/functions/webhook-processor/index.ts` had a `CAL_EVENT_TYPE_ID` const (with a hardcoded `4352394` fallback) and a `CAL_API_KEY` const that were both declared at module load and never referenced — leftover state from before the booking path was extracted into `/functions/v1/book-appointment`. Removed both; bookings already delegate to `book-appointment`, which enforces a missing-env-var failure mode (plan tasks 2.4/2.5 verification).
- `superpatch-frontend/src/lib/batch-caller.ts` now exports a small `resolveFromNumber()` helper that reads `NEXT_PUBLIC_BLAND_FROM_NUMBER` (the only var available in the client bundle, since `BatchCaller` is invoked from `'use client'` components). The previous `|| process.env.BLAND_FROM_NUMBER` fallback was dead code — Next.js strips server-only env vars from the client build, so that fallback was always `undefined` in practice and masked the fact that misconfiguring the public var would silently fall back to Bland's account default. Backed by `src/lib/batch-caller.from-number.test.ts` (4 tests: read, unset, whitespace handling, no server-fallback).
- Canonicalize `practitioner_type` across Edge Functions. `webhook-processor` and `analyze-call` previously persisted whatever raw value was on the Bland.ai webhook (`"Chiropractors"`, `"chiropractor"`, `"chiropractor_v2"`, `"RMT"`, `"Massage Therapists"`, etc.) and `analyze-call` keyed its `PATHWAY_SUMMARIES` map by display names, so a webhook that wrote `"chiropractor"` would silently fall back to the `"Chiropractors"` default summary. Added `supabase/functions/_shared/practitioner-type.ts` (with `canonicalPractitionerType`, `displayName`, `pathwaySummaryFor`) whose canonical type list mirrors `b2b_sales_enablement/bland_ai_pathways/canonical_ids.json` exactly (`chiropractor`, `massage_therapist`, `naturopath`, `integrative_medicine`, `functional_medicine`, `acupuncturist`, `unknown`). `webhook-processor` now canonicalizes once after resolution and before any DB write; `analyze-call` canonicalizes on entry and pulls its prompt summary from `pathwaySummaryFor`, deleting the duplicated `PATHWAY_SUMMARIES` constant. Backed by `_shared/practitioner-type.test.ts` (4 Deno tests).
- `superpatch-frontend/supabase/functions/book-appointment/index.ts`'s `updateCallRecord` previously skipped the `notes` field entirely (deferred from the Cal.com v2 migration). It now reads `call_records.notes`, hands it to a new `buildNotesUpdate(prior, bookingUid)` helper in `book-appointment/notes.ts`, and writes the result back — appending the `Cal.com Booking ID: <uid>` line below any existing call summary instead of overwriting it. Idempotent: re-running with the same booking ID does not duplicate the line. Also sets `appointment_booked = true` alongside `booking_id` / `calendar_invite_sent` so the UI's "booked" view doesn't lag a sync cycle. Backed by `book-appointment/notes.test.ts` (4 Deno tests covering append, null/blank/idempotent/whitespace).
- Unify boolean coercion of Bland.ai webhook variables behind `supabase/functions/_shared/coerce.ts` (`toBool`). Bland sends `wants_demo` / `wants_sample` / `decision_maker` / `sample_requested` / `schedule_demo` as either native booleans, strings (`"true"`/`"yes"`/`"1"`), or numbers depending on how the pathway captured them, and every call site in `webhook-processor` was rolling its own coercion — several of which crashed on `undefined` via `String(undefined).toLowerCase()` (which doesn't crash but yields the string `"undefined"`, never matched as truthy, but masked legitimate empty-input bugs). Replaced six duplicated coercion blocks across `webhook-processor/index.ts` with `toBool(...)` calls. Backed by `_shared/coerce.test.ts` (5 Deno tests covering native booleans, truthy/falsy strings, numbers, null/undefined, objects).
- Sanitize PostgREST `.or()` clause inputs in `src/app/api/samples/route.ts` and `src/app/api/memory/route.ts`. Both routes were interpolating raw values (sample-search user input; Bland API `phone_number`) directly into `.or()` filter strings, which PostgREST parses with `,`, `(`, `)`, `%`, `_` as control characters — letting a crafted value inject additional predicates into the clause. Both routes now run their inputs through the existing `sanitizeSearchInput` helper (escapes `%`/`_`, strips `,`/`(`/`)`, caps length). The memory route additionally guards against empty-after-sanitize inputs that would otherwise produce a malformed `.or()` clause. Backed by `src/app/api/samples/route.search.test.ts` (4 vitest cases).
- Cap `GET /api/samples?format=csv` at 10,000 rows (`src/app/api/samples/constants.ts:SAMPLES_CSV_MAX_ROWS`). The CSV branch previously called `await query` with no `.limit()` so a growing `sample_requests` dataset would eventually OOM the Vercel function (and produce a multi-minute download). The response now also includes `X-Export-Truncated` / `X-Export-Row-Cap` headers so the admin UI can surface a "results may be truncated" warning when the cap is hit. Constant pinned by `constants.test.ts`.
- `superpatch-frontend/supabase/functions/webhook-processor/index.ts` now resolves `sample_requests.email` via a new `pickSampleEmail({ formEmail, dbEmail, aiEmail })` helper (`email.ts`) that enforces the canonical priority **form > db > AI** and runs a strict regex pass — so a half-cleaned AI-extracted value can't leak past the existing `sanitizeTranscribedEmail` upstream. Sample-type classification was also extracted into `sample-type.ts` (`classifySampleType` + `buildProductsRequested`). The previous inline classifier (`productsRaw === "all" || !productsRaw ? "standard_kit" : "custom"`) didn't recognize the literal `"standard_kit"` and would write the marker string into `products_requested`; the helpers correctly fold `"all"`, `"standard_kit"`, `"standard kit"`, empty, and whitespace-only into `standard_kit` (with `products_requested` set to `null`). Backed by 6 Deno tests for `email.ts` and 5 for `sample-type.ts`.

### Added
- `superpatch-frontend/supabase/tests/sample_requests_insert.test.sql` pgTAP smoke test asserting a minimal `sample_requests` insert succeeds. Runs once a local Supabase test harness is wired (see the plan's Task 4.3).
- `superpatch-frontend/supabase/functions/_shared/pathways.test.ts` — Deno companion to the existing Vitest `canonical-ids-sync` test. Asserts the Edge module's `KB_ID`, `VOICE_ID`, `DEFAULT_PATHWAY_ID`, `DEFAULT_WEBHOOK_URL`, every canonical pathway slug + alias (via both direct `PATHWAY_IDS` lookup and `getPathwayId`), and the unknown-input default behaviour all match `b2b_sales_enablement/bland_ai_pathways/canonical_ids.json`. Runs inside the Edge runtime so a deploy carrying stale UUIDs fails before it leaves CI. 7 tests, all green.

### Changed (final-review fixes — 2026-05-12)
- **Pathway-suggestions UI/wire format restored.** `analyze-call` had begun writing the canonical slug (`chiropractor`, `massage_therapist`, …) into `pathway_suggestions.practitioner_type`, but `src/app/campaign/pathway-suggestions/page.tsx`, `usePathwaySuggestions.ts`, and `/api/pathway-suggestions/export/route.ts` filter that column by the underscore-joined wire format (`Chiropractors`, `Massage_Therapists`, `Functional_Medicine`, `Integrative_Medicine`, `Naturopaths`, `Acupuncturists`). The mismatch would have silently returned 0 rows for every practitioner type starting the moment this branch shipped. Added `pathwaySuggestionsKey()` to `_shared/practitioner-type.ts` that mirrors the UI's wire format exactly, and routed every `pathway_suggestions` read/write inside `savePathwaySuggestions` through it. `pathwaySummaryFor` continues to receive the canonical slug. Backed by an additional Deno test asserting the six pathway-suggestion keys.
- **`20260512_repoint_cron_jobs.sql` no longer persists the service-role JWT into `cron.job.command`.** The earlier draft used `format(..., 'Bearer ' || service_token)` which substituted the plaintext token at schedule time, leaving it readable in `cron.job`. The migration now inlines a `SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'` subquery inside each cron command so the token is fetched at run time and never serialized into the job definition. The pre-flight `EXISTS` check still fails fast if the Vault secret hasn't been seeded.
- **`call_records.notes` overwrite paths now append instead of clobbering.** `sync-cal-bookings/index.ts` (cancellation path) and `book-appointment/index.ts:logBookingFailure` were each setting `notes` directly, wiping any analyze-call summary or `Cal.com Booking ID: …` line that had already been written. Both paths now go through a new shared `_shared/notes.ts:appendNoteLine(prior, line)` (5 Deno tests covering blank/null prior, append, idempotence, trailing-whitespace trim, substring-not-line semantics); `sync-cal-bookings` widens its `call_records` SELECTs to include `notes`, and `logBookingFailure` reads existing notes before update. `book-appointment/notes.ts:buildNotesUpdate` is now a thin wrapper around `appendNoteLine`.
- **`webhook-processor` sample confirmation email is now gated on `sampleEmail` (strict), not `resolvedEmail` (loose).** The DB row's `email` column already used `sampleEmail` from `pickSampleEmail`, but the Resend send was still using the looser `resolvedEmail`, so the row could be stored with `email = null` while a confirmation shipped to an unvalidated address. The two are now in lockstep; if no valid email survives `pickSampleEmail`, the sample row is persisted with an explanatory `notes` line ("No valid email captured — sample confirmation not auto-sent.") instead of silently mis-sending.
- **`update_bland_tools_calcom.py` migrated to Cal.com v2** (was the open `FOLLOWUP-BLAND-TOOLS-V2`). The script defines the two Bland.ai custom tools that the voice agent invokes mid-call — `check_cal_availability` and `book_cal_appointment` — and both were still wired against the retired Cal.com v1 (`/v1/slots`, `/v1/bookings`, `?apiKey=` query auth, v1 `responses` body shape). The script now:
  - Builds tool configs via two pure builder functions (`build_check_availability_config`, `build_book_appointment_config`) so they're exercisable in `pytest` without hitting the network.
  - Targets `https://api.cal.com/v2/slots` (`cal-api-version: 2024-09-04`) and `https://api.cal.com/v2/bookings` (`cal-api-version: 2026-02-25`).
  - Swaps the v1 `?apiKey=` query parameter for a `Authorization: Bearer …` header on both tools.
  - Updates `/slots` query params (v1 `startTime`/`endTime` → v2 `start`/`end`; dates are now `YYYY-MM-DD`).
  - Rewrites the booking body to v2's `attendee` shape (drops v1's `responses` block) and re-points the response JSONPath unwrap at the `$.data` envelope (`booking_uid`, `booking_id`, etc.).
  - Replaces the `subprocess + curl` shell-out with `requests.post` (which was already in `requirements.txt`).
  - Adds a `smoke_check_cal_v2_slots(...)` helper that hits the real v2 `/slots` endpoint on startup to verify credentials before pushing tool configs.
  - Default timezone in the LLM-facing input schemas moved from `America/New_York` to `America/Toronto` to match `BUSINESS_TIMEZONE` in `book-appointment` (no more split-brain on which booking path is canonical).
  - Backed by `b2b_sales_enablement/appointment_webhook/test_update_bland_tools_calcom.py` — 13 pytest cases covering URL, auth, version header, query parameter names, attendee shape, metadata pass-through, and JSONPath envelope. Plus a "no `api.cal.com/v1` anywhere in either tool config" defense-in-depth assertion.
  - `canonical_ids.json -> tools.*.description` text and `ARCHITECTURE.md` updated to reflect the new versions.
  - **Operational**: the operator still has to run the script once against the live Bland.ai account (`BLAND_API_KEY=… CAL_COM_API_KEY=… python3 update_bland_tools_calcom.py`) to push the new configs — until that happens, in-call tool invocations continue to 404 against v1.

### Changed
- Dead code removed:
  - `process-retry-queue/index.ts` — drop the unused `callId` param on `updatePractitionerAfterCall`; the Bland `call_id` was passed but never written. Both call sites updated.
  - `analyze-call/index.ts` — dedupe four duplicated `response.replace(/```json\n?|\n?```/g, "")` regex guards into a `stripJsonFences` helper. Behaviour preserved because Gemini 2.0 Flash still occasionally wraps JSON in markdown fences despite the "Return ONLY valid JSON" prompt instruction.
- Drift in `PATHWAY_IDS` maps fixed in **both** runtimes after the new Deno canonical-ID test surfaced missing aliases:
  - `supabase/functions/_shared/pathways.ts`: added `naturopaths`, `acupuncturists`, `integrative_medicine`, `functional_medicine` keys.
  - `src/lib/config/pathways.ts`: added `chiropractors`, `naturopaths`, `acupuncturists`, `integrative_medicine`, `functional_medicine` keys.
  - Every canonical pathway slug + alias listed in `canonical_ids.json` now resolves to the correct UUID in both Node (Vitest, Next.js) and Deno (Edge Functions).
- Docs scrubbed of stale `/api/webhooks/bland` references that implied the Next.js route was still live:
  - `docs/CALL_CENTER.md` — Bland Integration section now flags the legacy route as HTTP 410 and adds an "API versions" table covering Cal.com v2, Bland.ai v1, Supabase JS, and Gemini.
  - `docs/SYSTEM_REVIEW_FINDINGS.md` — masthead note that all 25 bugs are resolved on `fix/ai-call-center-production-2026-04`; data-flow diagram, Test 5 webhook checklist, and file inventory updated.
  - `docs/FEATURE_SCOPE.md`, `superpatch-frontend/README.md`, root `README.md`, `superpatch-frontend/SECURITY.md` — `/api/webhooks/bland` consistently labelled as retired with a 2026-05-12 cutoff date.

### Operational (run BEFORE applying 20260512_repoint_cron_jobs.sql)
- Insert the `service_role_key` into Supabase Vault:
  ```sql
  INSERT INTO vault.secrets (name, secret)
  VALUES ('service_role_key', '<SUPABASE_SERVICE_ROLE_KEY>')
  ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
  ```
  The migration raises immediately if this secret is missing.

## 2026-05-11

### Added
- `superpatch-frontend/supabase/functions/_shared/cal.ts` shared Cal.com v2 HTTP client (`createCalBooking`, `listCalBookings`, `cancelCalBooking`, `CalError`) used by `book-appointment` and `sync-cal-bookings`.
- `superpatch-frontend/supabase/functions/sync-cal-bookings/status.ts` `normalizeCalStatus` helper mirroring the canonical `AppointmentStatus` union from `src/lib/db/types.ts`.

### Changed
- `superpatch-frontend/supabase/functions/book-appointment/index.ts` migrated from the retired Cal.com v1 API to v2 (`cal-api-version: 2026-02-25`). `CAL_API_KEY` and `CAL_EVENT_TYPE_ID` are now required at module load; `BUSINESS_TIMEZONE` (default `America/Toronto`) replaces the hardcoded `America/New_York` for booking timezone.
- `superpatch-frontend/supabase/functions/sync-cal-bookings/index.ts` migrated to Cal.com v2 (`start`/`end` field names, lowercase statuses) and routes `booking.status` through `normalizeCalStatus`. Outer error handler now maps `CalError` to the upstream HTTP status. CORS headers unified via `corsHeaders()` on all response paths.
- `superpatch-frontend/.env.example` adds `CAL_API_VERSION=2026-02-25`.

### Why
- Cal.com retired the v1 API on 2026-04-08; every demo booking and Cal sync was 404'ing in production.

---

## 2026-04-21 — Canonical pathway IDs + Edge Function shared module

- **What changed**:
  - `src/lib/config/pathways.ts` now documents its status as a mirror of `canonical_ids.json`.
  - Added `supabase/functions/_shared/pathways.ts` for cross-function pathway resolution.
  - `supabase/functions/process-retry-queue/index.ts` refactored to import `KB_ID`, `VOICE_ID`, `DEFAULT_WEBHOOK_URL`, and `getPathwayId` from the shared module instead of duplicating the pathway map.
  - Added `src/__tests__/canonical-ids-sync.test.ts` enforcing that `canonical_ids.json`, `src/lib/config/pathways.ts`, and `supabase/functions/_shared/pathways.ts` stay aligned.
  - `supabase/migrations/20260421_disable_book_appointment_trigger.sql` drops the pg_net trigger that duplicated `webhook-processor`'s explicit call to `book-appointment`.
- **Why it changed**: Remove drift risk between pathway ID sources, and eliminate the duplicate downstream path that caused risk of double-booking appointments.
- **Code touchpoints**:
  - `src/lib/config/pathways.ts`
  - `supabase/functions/_shared/pathways.ts` (new)
  - `supabase/functions/process-retry-queue/index.ts`
  - `supabase/migrations/20260421_disable_book_appointment_trigger.sql` (new)
  - `src/__tests__/canonical-ids-sync.test.ts` (new)
- **Data-flow impact**: Retry queue (pathway resolution now shared); appointment booking (single canonical path via webhook-processor -> book-appointment).
- **ID / contract changes**: None. All pathway / KB / voice / webhook IDs remain unchanged.
- **API / schema impact**: Dropped `trigger_queue_appointment_booking` trigger and `queue_appointment_booking()` function; `call_records` table gains an updated `COMMENT ON TABLE` documenting the new canonical path.
- **Verification**: Run `pnpm test` and `pnpm tsc --noEmit` from `superpatch-frontend/`. New test `canonical-ids-sync.test.ts` exercises all three mirrors.
