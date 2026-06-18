# Sales Enablement — Backend / System Changelog

Backend, system, infrastructure, pathway, Edge Function, migration, and Python script deltas. Frontend app deltas live in `superpatch-frontend/docs/CHANGELOG.md`. Newest entries at the top. Entries follow the README Delta template from `.cursor/rules/readme-first-session.mdc`.

---

## 2026-06-18 — Callback time no longer counts as a booked demo; canonical-ids test hardening

Two correctness fixes on the call-center wiring branch. (1) A scheduled callback time was being misread as a booked demo. (2) The canonical-ids sync test only covered pathway/KB/voice IDs, leaving the webhook URL, Cal.com config, and Bland tool IDs unguarded against drift.

- **What changed**:
  - **webhook-processor** (`index.ts` + new `_shared/derive-call-status.ts`): a new pure helper `deriveCallStatus({ completed, wantsDemo, scheduleDemo, appointmentTime, wentToVoicemail })` decides the call status. An `appointment_time` **alone** (e.g. a scheduled callback) no longer counts as a booked demo — a `"booked"` status now requires demo intent (`wants_demo`/`schedule_demo`) **plus** an appointment time. `call_records.appointment_booked` now derives from `callStatus === "booked" || callStatus === "calendar_sent"` instead of the bare presence of an appointment time. Covered by `webhook-processor/_tests/booking-status.test.ts`.
  - **Canonical-ids sync test** (`src/__tests__/canonical-ids-sync.test.ts`): extended to assert the frontend `WEBHOOK_URL` matches `canonical_ids.json.webhooks.primary` (and the Edge `_shared/pathways.ts` mirror contains it), that `cal_com.event_type_id` is present/non-empty, and that the Bland `tools` map (incl. `check_availability` + `book_appointment`) has non-empty IDs. Per the testing-tdd rule's "never weaken canonical-ids-sync" guidance, this only adds coverage.
- **Why it changed**: prevent callback scheduling from inflating booked-demo counts and KPIs; widen the drift guard so a stale webhook URL / Cal.com event type / tool ID is caught by the test suite rather than in production.
- **Code touchpoints**: `webhook-processor/index.ts`, `webhook-processor/_shared/derive-call-status.ts`, `webhook-processor/_tests/booking-status.test.ts`, `src/__tests__/canonical-ids-sync.test.ts`.
- **Data-flow impact**: webhook-processor (call status / `appointment_booked` derivation) → analytics / KPIs (booked-demo counts).
- **ID / contract changes**: none (canonical IDs unchanged; test coverage widened only).
- **API / schema impact**: none.
- **Verification**: `npm test -- --run supabase/functions/webhook-processor` (booking-status + booking-gate green); `npm test src/__tests__/canonical-ids-sync.test.ts` green; `npx tsc --noEmit` clean. Edge deploy deferred to a controlled deploy step.

---

## 2026-06-18 — Reconcile in-call Cal.com booking uid; skip duplicate post-call booking

The in-call `book_cal_appointment` tool books on Cal.com DURING the call, while `webhook-processor` ALSO dispatched the `book-appointment` Edge Function AFTER the call — with no `booking_uid` handoff, the same prospect could be double-booked. Now the in-call booking uid is captured as a pathway variable and used to gate the post-call dispatch.

- **What changed**:
  - **Bland tool** (`b2b_sales_enablement/appointment_webhook/update_bland_tools_calcom.py`): `book_cal_appointment` `response` block now also maps `$.data.status → booking_status` (the `$.data.uid → booking_uid` mapping already existed and is the in-repo precedent for Bland response variables). The booking request `metadata` gains `call_record_id` + `call_id` (`{{...}}` pathway vars) as an orphan-linking fallback for `sync-cal-bookings`.
  - **Pathways** (all 6 `*_contextual.json`): appended `["booking_uid","string",...]` to the `Schedule Appointment` node `extractVars` so the in-call booking uid is forwarded in the post-call webhook payload. No other extractVars changed.
  - **webhook-processor** (`index.ts` + new `_shared/booking-gate.ts`): before the booking dispatch, if `vars.booking_uid` is present it is written to `call_records.booking_id`. A new pure helper `needsPostCallBooking({ inCallBookingUid, existingBookingId })` gates the dispatch — `postCallBookingNeeded &&` was prepended to the existing condition (all prior checks — `wantsDemo`, `parsedAppointmentTime`, name, email, `payload.completed`, `savedRecord?.id`, and `shouldDispatchBooking`'s dedup — remain).
  - **Shared coerce** (`supabase/functions/_shared/coerce.ts`): added `toStr(value)` (mirrors `toBool`) returning a trimmed non-empty string or `null`, used for `vars.booking_uid`.
- **Why it changed**: prevent duplicate Cal.com bookings (or a 409 that left `booking_id` null) when the in-call tool already booked.
- **Code touchpoints**: `update_bland_tools_calcom.py`, 6 `*_contextual.json`, `webhook-processor/index.ts`, `webhook-processor/_shared/booking-gate.ts`, `_shared/coerce.ts`, `webhook-processor/_tests/booking-gate.test.ts`.
- **Data-flow impact**: pathway (in-call booking) → webhook-processor (booking reconciliation) → book-appointment (now skipped when in-call booking exists) → sync-cal-bookings (metadata fallback).
- **ID / contract changes**: none (no Bland/Cal.com/KB/voice/tool ID changed; tool config payload extended only).
- **API / schema impact**: none.
- **Verification**: `npm test -- --run supabase/functions/webhook-processor` → 7 passing (3 booking-gate + 4 booking-status); `python3 -m pytest test_update_bland_tools_calcom.py` → 13 passing; all 6 pathway JSON parse; `npx tsc --noEmit` clean. NOT deployed — tool push / pathway publish / `supabase functions deploy` deferred to a controlled deploy step.

---

## 2026-06-15 — Applied 4 pending migrations to production (RLS tighten, phone-normalized, sample dedup, retry RPC)

Pushed the remaining unapplied migrations to the live Supabase DB via `supabase db push`. All four are idempotent and applied cleanly (the `NOTICE ... does not exist, skipping` lines are the `DROP ... IF EXISTS` / `DROP FUNCTION IF EXISTS` guards firing on first apply).

- **What changed**:
  - **Applied to remote** (now recorded in `supabase_migrations.schema_migrations`):
    - `is_active_user()` helper + active-user RLS on `call_records`, `call_notes`, `campaign_analytics`, `practitioners`, `sample_requests`, `appointments`, `follow_up_queue`, `pathway_suggestions` (tightened from `auth.uid() IS NOT NULL`; also drops the out-of-band wide-open dashboard policies that were silently negating the lock-down).
    - `practitioners.phone_normalized` generated column + `idx_practitioners_phone_normalized`.
    - `sample_requests` duplicate collapse + partial unique index `uq_sample_requests_call_record_id`.
    - `increment_retry_count(uuid)` RPC (`CREATE OR REPLACE`).
  - **Migration filename renames (required, committed)**: the repo used date-only migration versions, so multiple same-day files collided on the `schema_migrations` version primary key and the CLI's positional history diff conflated `20260514xxxxxx` with the already-applied `20260514` row. Renamed the four pending files to unambiguous, unique 14-digit versions so `db push` reconciled cleanly:
    - `20260514_fix_increment_retry_count_rpc.sql` → `20260601000001_fix_increment_retry_count_rpc.sql`
    - `20260514_tighten_rls_to_active_profiles.sql` → `20260601000002_tighten_rls_to_active_profiles.sql`
    - `20260605_practitioners_phone_normalized.sql` → `20260605000001_practitioners_phone_normalized.sql`
    - `20260605_sample_requests_dedup.sql` → `20260605000002_sample_requests_dedup.sql`
- **Why it changed**: the migrations were authored in prior sweeps but never applied to prod; the user requested they be pushed.
- **Code touchpoints**: `superpatch-frontend/supabase/migrations/2026060100000{1,2}_*.sql`, `superpatch-frontend/supabase/migrations/2026060500000{1,2}_*.sql`.
- **Data-flow impact**: DB-layer only — RLS hardening (auth surface), phone-lookup index (dialer/dedup), sample dedup backstop (webhook-processor sample insert), retry RPC (process-retry-queue).
- **ID / contract changes**: none.
- **API / schema impact**: applied the schema changes above. `src/lib/db/types.ts` and the `phone_normalized` column/index in `schema.sql` already reflect this; `schema.sql` remains a loose partial snapshot (omits `sample_requests`/`appointments`/`follow_up_queue`/`pathway_suggestions` and still shows pre-RLS policies for `practitioners`) — `migrations/` is the source of truth, full snapshot reconciliation tracked separately.
- **Verification**: `supabase db push` → "Finished" with no errors; `supabase migration list` confirms `20260601000001`, `20260601000002`, `20260605000001`, `20260605000002` recorded on remote (Local + Remote + Time populated).
- **Follow-up recommendation**: adopt full 14-digit timestamp migration versions going forward (date-only versions break `db push` whenever two migrations share a day).

---

## 2026-06-09 — Booking-goal reframe + $200 sample incentive (all 6 pathways)

Made booking a demo the primary goal of every practitioner pathway, with "$200 in free samples for booking" as the headline incentive, auto-fulfilled when the booking is saved. Purely additive — no node/edge removed, no existing prompt rewritten, no ID/schema change.

- **What changed**:
  - **Pathways** (all 6 `*_contextual.json`): a new idempotent transform `add_booking_incentive.py` injects a `## PRIMARY GOAL — BOOK A DEMO` + "$200 free samples" block before the existing `## ROUTING PRIORITY` marker in every routing node (27-29 per file), adds an upsell bridge to `Offer Sample`, a reward lead to `Check Availability`, and a $200 confirmation line to `Schedule Appointment`. The `Schedule Appointment` node now also force-sets `staticVars.wants_sample = "true"` and `sample_notes = "$200 demo-booking incentive - ship $200 sample kit"` (existing `wants_demo`/`schedule_demo` preserved).
  - **Auto-fulfillment**: no new Edge Function logic or schema change. `webhook-processor` already creates a `sample_requests` row and fires `send-sample-confirmation` via `shouldInsertSample(wants_sample, !dnc)`; the booking node's `wants_sample` staticVar makes a booking auto-create the $200 sample (one per call, protected by `uq_sample_requests_call_record_id`). `sample_notes` flows to `sample_requests.notes`.
  - **webhook-processor hardening** (`index.ts`): the two sample-error branches (email dispatch failed / no valid email) now **append** their status to `sample_requests.notes` instead of overwriting it, so the `$200` incentive tag survives failure paths now that `notes` is the incentive's carrier.
  - **Non-destructive safeguards**: pre-flight production sync confirmed local == live for all 6 (node/edge counts + names); transform writes timestamped backups to `backups/`; smoke test pins exact node/edge counts.
  - **Tests**: new `b2b_sales_enablement/bland_ai_pathways/test_booking_incentive.py` (30 cases — count parity, sentinel coverage, booking staticVars, $200 mentions); extended `webhook-processor/gating.test.ts` with the booking-triggers-sample contract (booking + sample fire together; DNC suppresses both).
- **Why it changed**: shift the campaign goal toward booked demos and use a concrete $200 sample reward as the conversion lever, without disturbing the existing sophisticated flows (sample-only, order, affiliate, callback).
- **Code touchpoints**: `b2b_sales_enablement/bland_ai_pathways/{*_contextual.json, add_booking_incentive.py, test_booking_incentive.py}`; `superpatch-frontend/supabase/functions/webhook-processor/{index.ts, gating.test.ts}`.
- **Data-flow impact**: dialer → Bland pathway (goal/incentive prompts + booking node) → webhook-processor (booking dispatch + auto sample insert) → sample fulfillment + Cal.com booking.
- **ID / contract changes**: None (`canonical_ids.json` unchanged).
- **API / schema impact**: None (incentive tagged via existing `sample_requests.notes`).
- **Verification**: pytest 30/30; Deno webhook-processor 44/44; Vitest 257/257 (incl. `canonical-ids-sync`); `tsc --noEmit` clean. Deploy via `publish_pathways_production.py` (manual, `BLAND_API_KEY`); rollback = re-publish prior `version_id`.

---

## 2026-06-05 — Call-center wiring bug-fix sweep (backend / Edge / migration slice)

End-to-end review remediation for Edge Functions, migrations, config, and docs. Frontend slice is in `superpatch-frontend/docs/CHANGELOG.md`.

- **What changed**:
  - **webhook-processor**:
    - Extracted `webhook-processor/dnc.ts` (+`dnc.test.ts`) and `webhook-processor/gating.ts` (+`gating.test.ts`). DNC detection now runs EARLY (before sample insert / booking dispatch) and gates both side-effects via `shouldInsertSample` / `shouldDispatchBooking`.
    - Tightened the DNC phrase list — removed `"not interested"` (a normal sales objection, not a legal DNC request).
    - Sample insert is now dedup-guarded (check existing `sample_requests` by `call_record_id` before insert).
    - Booking dispatch is additionally gated on `savedRecord.booking_id` and any existing `appointments` row (via `shouldDispatchBooking`).
    - `findPractitionerByPhone` now matches DB-side on the new `practitioners.phone_normalized` generated column (with a bounded client-scan fallback when the column hasn't been migrated yet) instead of scanning only the first 100 rows.
  - **process-retry-queue**: manual POST trigger now respects business hours (rejects outside hours unless `{ force: true }`) via the new pure `shouldProcessManualTrigger` helper in `retry.ts` (+tests); manual select now pulls the same columns as the cron path. 500 responses now use `sanitizeError`.
  - **sanitizeError adoption**: `book-appointment` and `send-sample-confirmation` 500 handlers now return `sanitizeError(...)` instead of raw `error.message`.
  - **config.toml**: pinned explicit `verify_jwt = true` for `book-appointment`, `process-retry-queue`, `send-sample-confirmation`, `analyze-call`, `sync-cal-bookings`, `enrich-practitioners-v2`, `generate-daily-report` (webhook-processor stays `false` — HMAC-authenticated).
  - **Migrations**:
    - `20260605_sample_requests_dedup.sql` — collapses existing duplicates then adds a partial unique index `uq_sample_requests_call_record_id` (`WHERE call_record_id IS NOT NULL`).
    - `20260605_practitioners_phone_normalized.sql` — adds the generated `phone_normalized` column (last 10 digits) + `idx_practitioners_phone_normalized`. Mirrored in `schema.sql` and `src/lib/db/types.ts`.
  - **Docs**: README pathway IDs corrected to match `canonical_ids.json`; README "Next.js 14" → 16; `ARCHITECTURE.md` `email_sent_at` → `confirmation_sent_at`.
- **Why it changed**: Call-center end-to-end review surfaced ordering bugs (DNC after side-effects), duplicate sample/booking risk on webhook redelivery, a phone-lookup blind spot beyond 100 rows, an after-hours manual-retry gap, error-detail leakage, and stale docs.
- **Code touchpoints**: see above.
- **Data-flow impact**: webhook-processor (DNC, sample, booking, phone lookup), retry queue, sample/appointment confirmation error handling.
- **ID / contract changes**: None (`canonical_ids.json` unchanged; README now matches it).
- **API / schema impact**: new `phone_normalized` column + index; new unique index on `sample_requests(call_record_id)`. `schema.sql` + `types.ts` updated.
- **Verification**: `npx tsc --noEmit` clean; Deno modules unit-tested (`dnc`, `gating`, `retry` helpers). Migrations require `supabase db push` at deploy time.

---

## 2026-05-14 — Production-hardening sweep: schema repair, fail-closed auth, downstream error surfacing, concurrency guards

A second deep-dive after the `verify_jwt` fix uncovered 15 silent-failure modes spread across schema, Edge Functions, and frontend. All P0/P1 items remediated in one task-master plan; P2/P3 hygiene fixes included. A post-plan code-reviewer pass then caught 4 follow-up issues (analyze-call dispatch, dead `_sync_failed_at`, schema/types drift, misleading idempotency comment) which were all fixed in this same commit. Test count grew from 178 → 192 Vitest+Deno.

- **What changed** (grouped by remediation area):
  - **Schema repair**:
    - `supabase/migrations/20260514_fix_increment_retry_count_rpc.sql` — recreates `public.increment_retry_count(p_id text)`. Production probe before fix: PGRST202 `function not found`. The May-12 fix renamed the RPC argument from `practitioner_id` to `p_id` but the RPC itself was never deployed (the 2026-02-06 migration declared `p_id UUID` while `practitioners.id` is `text`, so PostgREST refused to dispatch text arguments). Effect of the bug: `webhook-processor` was treating every voicemail/failed call as retry #0 because `supabase.rpc(...)` returned `{ error }` not a throw → `(null ?? 1) - 1 = 0` → infinite retries once the webhook pipeline went live. Verified end-to-end with a live test practitioner (`ChIJ0RtEKZzM1IkR6WK9JovK16A`): retry_count went 0 → 1 after a single RPC call, then reverted to 0.
    - `supabase/migrations/20260514_add_call_records_processed_at.sql` — adds `call_records.processed_at TIMESTAMPTZ` + partial index. Required by the new idempotency check below.
  - **Fail-closed webhook auth**:
    - Extracted `webhook-processor/auth-gate.ts` from the inline HMAC verification in `index.ts`. The previous behavior was fail-OPEN: missing `BLAND_WEBHOOK_SECRET` → log warning + process the payload anyway. New behavior: every error path (`secret_not_configured`, `signature_missing`, `signature_mismatch`, `verification_error`) returns ok=false → function returns HTTP 401.
    - `webhook-processor/auth-gate.test.ts` — 8 Deno tests covering every failure mode + the happy path. Live probe after deploy confirms: unsigned POST → 401, bogus signature → 401, GET probe → 200.
    - Fixed config.toml comment that mis-named the header (`x-bland-signature` was wrong; the correct Bland header per [docs.bland.ai/tutorials/webhook-signing](https://docs.bland.ai/tutorials/webhook-signing) is `x-webhook-signature`, which the code has always used correctly).
  - **Downstream error surfacing**:
    - `webhook-processor/dispatch.ts` (new) — `dispatchEdgeFunction({ url, bearer, body, label })` returns `{ ok: true } | { ok: false, reason, httpStatus }` and never throws. Replaces the previous inline `fetchWithTimeout(...).catch(...)` pattern which never checked `.ok` on the response, so non-2xx replies from `book-appointment` / `send-sample-confirmation` silently resolved while webhook-processor reported `record_saved: true`.
    - `webhook-processor/dispatch.test.ts` — 6 Deno tests covering 2xx, 4xx, 5xx, network error, body truncation, header construction.
    - `webhook-processor/index.ts` — wired `dispatchEdgeFunction(...)` into both the sample-confirmation fan-out (~L1337) and the book-appointment fan-out (~L1491). On non-2xx the parent row (`sample_requests` or `call_records`) gets a structured failure note, and the final response payload includes a new `downstream` field surfacing per-call status to Bland (visible in Bland's call detail logs).
    - `book-appointment/response.ts` (new) — `buildBookingResponse({ booking, appointmentId })`. Previously the handler returned HTTP 200 + `success: true` + `appointment_id: null` when the Cal.com booking succeeded but the `appointments` row INSERT failed. Now returns HTTP 500 + `success: false` + a clear error message + the Cal.com booking detail (so ops can find the orphaned calendar event). `book-appointment/response.test.ts` — 3 Deno tests.
  - **Defensive Edge Function changes**:
    - `process-retry-queue/business-hours.ts` (new) — pure `isWithinBusinessHours(timezone, now, hours)` extracted from `index.ts`. Old code defaulted to `true` ("allow calls") on `Intl.DateTimeFormat` failure, which during a DST transition could let after-hours dials slip through. New code is fail-CLOSED. `business-hours.test.ts` — 8 Deno tests.
    - `process-retry-queue/index.ts` — `getRetryQueue` now `throw`s `RetryQueueFetchError` on DB failure instead of returning `[]`. The caller distinguishes "queue empty" from "queue fetch failed" and returns `skipped_reason: "queue_fetch_failed: ..."` so the cron audit trail no longer logs a successful "0 retries processed" tick when the DB is broken.
    - `generate-daily-report/index.ts` — `sample_requests` / `practitioners` query failures now `throw` instead of silently saving a report with zeros for those sections.
    - `webhook-processor/index.ts` — `analyze-call` `waitUntil` falls back to `await` when `EdgeRuntime` global is missing (local/test/preview contexts), so analysis is never dropped on the floor.
  - **Concurrency guards**:
    - `webhook-processor/index.ts` — idempotency check at the top of the handler keyed on `call_records.processed_at`. Bland redelivers webhooks on network errors; without this guard every redelivery re-fired sample_request creation, book-appointment dispatch, analyze-call dispatch, and retry scheduling. Now: if `processed_at IS NOT NULL` for the incoming `call_id`, return 200 immediately with `message: "Already processed (idempotent skip)"`. The `processed_at` write happens right before the success response, so partial failures don't lock out a future retry-delivery.
- **Why it changed**: Per the deep-dive audit ("rock-solid app" request). Eight subagent + live-DB findings drove the remediation:
  | # | Finding | Severity |
  |---|---|---|
  | 1 | `increment_retry_count` RPC missing in prod | P0 |
  | 2 | `webhook-processor` fail-open on missing `BLAND_WEBHOOK_SECRET` | P0 |
  | 3 | Downstream `.ok` never checked in webhook fan-outs | P0 |
  | 4 | `book-appointment` returns success when DB insert fails | P0 |
  | 5 | DELETE routes return HTTP 200 with `status: "error"` | P1 |
  | 6 | Manual-dial save fail leaves system inconsistent | P1 |
  | 7 | Notes silently saved to localStorage instead of DB | P1 |
  | 8 | `analyze-call` waitUntil dropped in non-prod contexts | P1 |
  | 9 | `process-retry-queue.isWithinBusinessHours` fails OPEN | P1 |
  | 10 | `process-retry-queue.getRetryQueue` returns `[]` on DB error | P1 |
  | 11 | `daily_report` saves zeros on partial query failure | P1 |
  | 12 | `createCallRecord` fire-and-forget sync, no failure surface | P1 |
  | 13 | `batchCaller.makeCall` no per-practitioner mutex | P1 |
  | 14 | `webhook-processor` no idempotency check | P1 |
  | 15 | `config.toml` comment used wrong header name | P3 |
- **Code touchpoints**:
  - New: `supabase/migrations/20260514_fix_increment_retry_count_rpc.sql`, `supabase/migrations/20260514_add_call_records_processed_at.sql`, `supabase/functions/webhook-processor/{auth-gate,dispatch}.ts` (+ tests), `supabase/functions/book-appointment/response.ts` (+ test), `supabase/functions/process-retry-queue/business-hours.ts` (+ test).
  - Modified: `supabase/functions/webhook-processor/index.ts`, `supabase/functions/book-appointment/index.ts`, `supabase/functions/process-retry-queue/index.ts`, `supabase/functions/generate-daily-report/index.ts`, `supabase/config.toml`.
- **Data-flow impact**: Every stage of the post-call pipeline now fails LOUDLY instead of silently when something goes wrong. Retry counts will actually increment. DNC detection will actually mark practitioners. Cron jobs that fail will surface real error messages instead of "0 processed". Duplicate webhook deliveries no longer double-fire side effects.
- **ID / contract changes**: None.
- **API / schema impact**:
  - Schema: `call_records.processed_at TIMESTAMPTZ NULL` + partial index.
  - RPC: `public.increment_retry_count(p_id text) RETURNS integer` (recreated). Grants: `service_role`, `authenticated`.
  - Edge Function response shapes:
    - `webhook-processor` response now includes a `downstream: { book_appointment?, send_sample_confirmation? }` field summarizing fan-out outcomes.
    - `book-appointment` returns HTTP 500 (was 200) when the appointment-row INSERT fails after a successful Cal.com booking.
    - `webhook-processor` returns HTTP 401 (was: log warning + process) when `BLAND_WEBHOOK_SECRET` is unset.
    - DELETE `/api/campaign/calls` and `/api/campaign/notes` return HTTP 500 (was 200) when the underlying delete fails.
- **Operational**:
  1. Both migrations were applied via `supabase db query --linked --file ...` and verified with live REST probes.
  2. Affected Edge Functions redeployed: `webhook-processor` (with `--no-verify-jwt`), `book-appointment`, `process-retry-queue`, `generate-daily-report`.
  3. **Follow-ups not in this commit**:
     - Drop the unused `schedule_retry`, `clear_retry`, `get_retry_queue` RPCs (all return PGRST202 / type mismatch in prod; no production code calls them).
     - Add a partial UNIQUE INDEX on `sample_requests(call_record_id)` so a concurrent-redelivery race on the `processed_at` idempotency check cannot double-fire sample shipments. (Today the gap is bounded — Bland sends 200 once and won't redeliver — but the index is cheap insurance.)
     - Open a ticket for a startup self-check that probes every required RPC, function, and column at boot so this class of drift is caught earlier.
     - Build an "unsynced call records" UI indicator (currently `createCallRecord` only logs to console.error on Supabase sync failure for batch dials; quick-call and the campaign page already await sync explicitly).
- **Verification**:
  - `npm test -- --run` → **185 / 185 passing** (was 178; gained 7 tests: 6 DELETE + 1 mutex).
  - `deno test` for each touched function → all green (25 webhook-processor, 7 book-appointment, 11 process-retry-queue).
  - `npx tsc --noEmit` → clean.
  - `ReadLints` on `src/` and `supabase/functions/` → no errors.
  - Live REST probe: `POST /functions/v1/webhook-processor` unsigned → HTTP 401 from auth-gate (not the gateway).
  - Live RPC probe: `increment_retry_count(p_id='<test_id>')` → 200 with the new count.

---

## 2026-05-14 — `webhook-processor` re-deployed with `verify_jwt = false`; entire post-call pipeline back online

- **What changed**:
  - Added `superpatch-frontend/supabase/config.toml` pinning `[functions.webhook-processor] verify_jwt = false` so every deploy (local, scripted, CI) applies the same gateway policy. The file also documents the rule that any function with `verify_jwt = false` must implement its own in-code authentication.
  - Redeployed the `webhook-processor` Edge Function with `supabase functions deploy webhook-processor --no-verify-jwt --project-ref gdwwppwaxyvudsecexuq` (script size 113.8 kB, deploy 2026-05-14 ~12:18 ET). The function source code already enforces an HMAC SHA-256 signature check on `x-webhook-signature` against `BLAND_WEBHOOK_SECRET` (`webhook-processor/index.ts:949-968`); that branch was previously unreachable because the Supabase API gateway rejected every anonymous POST with HTTP 401 / `sb-error-code: UNAUTHORIZED_NO_AUTH_HEADER` before the function body ran.
  - Added `superpatch-frontend/src/__tests__/edge-functions-verify-jwt.test.ts` as a regression test: it reads `supabase/config.toml` and asserts that `[functions.webhook-processor]` contains `verify_jwt = false`. The test currently covers a single function (extend `PUBLIC_FUNCTIONS_REQUIRING_NO_JWT` if more public, third-party-driven functions are added).
  - Updated the `superpatch-frontend/README.md` Edge Functions table to record the per-function `verify_jwt` policy and the rule that public functions MUST keep `verify_jwt = false` paired with in-code authentication.
- **Why it changed**: End-to-end review surfaced that the entire post-call data pipeline had been silently broken since 2026-01-28. Hard evidence:
  - PostgREST `content-range: */0` on `call_records`, `sample_requests`, `appointments` for any `created_at >= 2026-05-01`.
  - The two `call_records` rows that exist in production are both from 2026-01-28, both `Unknown Caller`, both with the Bland default-inbound-bot transcript ("Hello, I'm an inbound agent for Bland AI. I haven't been set up yet…") — i.e. no outbound `webhook-processor` write has ever landed in this DB.
  - 15+ Bland outbound calls in 2026 with `wants_sample: true`, `products_interested: …`, `appointment_time: …` etc. in `extracted_vars` (queried via `GET https://api.bland.ai/v1/calls`).
  - Live probe: `POST https://gdwwppwaxyvudsecexuq.supabase.co/functions/v1/webhook-processor` (no `Authorization` header) returned HTTP 401 with `sb-error-code: UNAUTHORIZED_NO_AUTH_HEADER` — the Supabase gateway rejection, not the in-code HMAC rejection. Bland's webhook delivery does not include a Supabase JWT (it's a third-party caller hitting a public URL), so every delivery had been silently dropped at the edge.
  - The function source already had `BLAND_WEBHOOK_SECRET` HMAC validation in place, which is the secure, correct authentication for this endpoint; the gateway-level JWT check was redundant and was masking it.
- **Code touchpoints**:
  - `superpatch-frontend/supabase/config.toml` (new — declares `verify_jwt = false` for `webhook-processor`).
  - `superpatch-frontend/src/__tests__/edge-functions-verify-jwt.test.ts` (new — 2 assertions; runs in `pnpm test`).
  - `superpatch-frontend/README.md` — Edge Functions section now records the `verify_jwt` policy per function.
  - No change to `webhook-processor/index.ts` itself.
- **Data-flow impact**: Re-enables the entire post-call data pipeline — `call_records` writes, `sample_requests` creation, Resend confirmation emails, `book-appointment` invocation (which in turn writes `appointments` and updates `call_records.booking_id`), `analyze-call` Gemini summarization, and the `follow_up_queue` retry scheduler all depend on `webhook-processor` running to completion. Note that the in-pathway Cal.com booking tools (`TL-79a3c232-…` `check_cal_availability`, `TL-bbaa7f38-…` `book_cal_appointment`) call `https://api.cal.com/v2/*` directly and were not affected by this gateway issue — they have been working through the broken period.
- **ID / contract changes**: None. Webhook URL, pathway IDs, tool IDs, KB ID, voice ID, Resend, and Cal.com settings unchanged.
- **API / schema impact**: None to schema. Public Edge Function `webhook-processor` now accepts anonymous POSTs whose body validates HMAC against `BLAND_WEBHOOK_SECRET`. Unsigned or invalidly-signed POSTs are rejected with HTTP 401 and `{"status":"error","message":"Invalid webhook signature"}` (in-code response, not the gateway error code).
- **Operational**:
  1. Confirmed `BLAND_WEBHOOK_SECRET` is set in the function's secrets (the live probe returned `Invalid webhook signature` — not the `BLAND_WEBHOOK_SECRET not configured` warning bypass).
  2. **Operator action — place a test call** to confirm: dial via `/api/bland/calls` (or the quick-call UI), let it complete, and verify within ~30 seconds that a `call_records` row appears with the live `call_id`. Sample requests / appointments will populate per the call's `extracted_vars`.
  3. Historical Bland calls (those that completed during the broken window) can be re-driven from the Bland dashboard's "Resend webhook" action if any are worth backfilling. By default we treat 2026-01-28 → 2026-05-14 as a write-loss window; the source-of-truth for those calls is Bland's call log itself (still queryable via `GET /v1/calls/{id}`).
  4. If a future public-facing Edge Function is added (e.g. an inbound SMS webhook), add it to `PUBLIC_FUNCTIONS_REQUIRING_NO_JWT` in `edge-functions-verify-jwt.test.ts` and add a `[functions.<name>] verify_jwt = false` block to `config.toml`. Do **not** disable JWT on a function that lacks its own authentication.
- **Verification**:
  - `npx vitest run src/__tests__/edge-functions-verify-jwt.test.ts` → 2/2 ✅.
  - `npm test -- --run` from `superpatch-frontend/` → **178/178 ✅** (17 test files, including the 2 new ones).
  - `npx tsc --noEmit` → clean.
  - Live probe **before** redeploy: `HTTP 401 / sb-error-code: UNAUTHORIZED_NO_AUTH_HEADER`. **After** redeploy: `HTTP 401 / body: {"status":"error","message":"Invalid webhook signature"}` — gateway is no longer involved, function code is running and correctly rejecting the unsigned probe.
  - `GET https://gdwwppwaxyvudsecexuq.supabase.co/functions/v1/webhook-processor` returns the function's self-describe JSON (status `ok`, list of 13 features), confirming the function is reachable at the URL stored as the Bland webhook target.

---

## 2026-05-14 — Scheduling node prompt-only fix: stop the "DateTime null" bug

- **What changed**:
  - Rewrote node 27 ("Check Availability") and node 28 ("Schedule Appointment") prompts in all 6 contextual pathway JSON files (`Chiropractors_contextual.json`, `Massage_Therapists_contextual.json`, `Naturopaths_contextual.json`, `Integrative_Medicine_contextual.json`, `Functional_Medicine_contextual.json`, `Acupuncturists_contextual.json`) and published new versions to Bland production.
  - **Node 27** — added an explicit "HARD REQUIREMENT — do not transition until you have ALL of these" block listing `practice_address` / `practitioner_email` / `best_phone` / `appointment_time`, plus a step-by-step "Ask each question and WAIT for an answer before the next" script with `[WAIT FOR …]` markers around each ask, plus a "never read a variable out loud if its value is empty/null" rule. Old prompt: 2010 chars. New: 3444 chars.
  - **Node 28** — added a "SAFETY CHECK — DO THIS FIRST" block that, using `{% if not appointment_time %}` / `{% if not practitioner_email %}` / `{% if not best_phone %}` / `{% if not practice_address %}` Jinja guards, asks the prospect for any missing value before reading the confirmation list. The confirmation list itself is now wrapped in `{% if appointment_time %}…{% endif %}` so each bullet only appears when its value is populated, and the prompt explicitly forbids saying "null" out loud. Old: 1425 chars. New: 2624 chars.
  - Backup of every pre-edit pathway saved to `b2b_sales_enablement/bland_ai_pathways/backups/*_pre_scheduling_fix_20260514_113447.json`.
  - Published via `b2b_sales_enablement/bland_ai_pathways/publish_pathways_production.py`. New versions (each promoted to `production`): Naturopaths v9, Integrative_Medicine v13, Functional_Medicine v11, Acupuncturists v12, Chiropractors and Massage_Therapists (per the publish output — see `docs/dev/changelog.md`'s adjacent reproduction). All six confirmed live by `GET /v1/pathway/{id}` returning the new prompts.
- **Why it changed**: End-to-end test call `70bd9fe4-93ee-4c12-9419-0bea899ea100` to `+15192427550` on the Naturopaths pathway (today, 10:54 AM ET) reproduced this verbatim from the agent: *"Perfect! Let me confirm everything: - Date/Time: null, - Location: 176 Hahn Avenue…, - Email for invite: null, - Best phone: null. Does all of that look correct?"* Inspection of the call's `pathway_logs` showed the agent transitioned `Introduction → Company Introduction → Discovery → Check Availability (27) → Schedule Appointment (28)` without invoking the `check_cal_availability` Cal.com tool and without capturing any of the four scheduling extractVars. Root cause: the single-node design of node 27 (one Webhook node attempting to capture 4 facts + invoke a tool in one turn) was unreliable — Bland's runtime treated the first user response ("yes, address is correct") as satisfying the node and fired the `27→28` edge labeled `"time selected"` even though `appointment_time` was empty. Node 28 then literally interpolated the string `null` into its read-back. **All 6 pathways had byte-identical broken node 27 and node 28 prompts** (verified via SHA-1 before patching), so the bug reproduced on whichever pathway the operator tested.
- **Code touchpoints**:
  - `b2b_sales_enablement/bland_ai_pathways/Chiropractors_contextual.json`
  - `b2b_sales_enablement/bland_ai_pathways/Massage_Therapists_contextual.json`
  - `b2b_sales_enablement/bland_ai_pathways/Naturopaths_contextual.json`
  - `b2b_sales_enablement/bland_ai_pathways/Integrative_Medicine_contextual.json`
  - `b2b_sales_enablement/bland_ai_pathways/Functional_Medicine_contextual.json`
  - `b2b_sales_enablement/bland_ai_pathways/Acupuncturists_contextual.json`
  - `superpatch-frontend/docs/superpowers/plans/2026-05-14-scheduling-node-structural-fix.md` (new — follow-up plan for the structural fix)
- **Data-flow impact**: Dialer + Bland pathway. Only the in-call scheduling branch behavior changes — no schema, no Edge Function, no webhook contract, no extractVars surface, no Cal.com tool config. `webhook-processor` continues to consume `appointment_time` / `practitioner_email` / `best_phone` / `practice_address` from the call's `extracted_vars` exactly as before; the change is that those values are now reliably populated before `book_cal_appointment` is invoked.
- **ID / contract changes**: None. No pathway UUID, tool ID, KB ID, voice ID, or webhook URL changed. `canonical_ids.json` untouched. The published version numbers on Bland advanced (per pathway) and `_meta.updated_at` in `canonical_ids.json` was intentionally not bumped because no IDs changed.
- **API / schema impact**: None.
- **Operational**:
  1. Mitigation is **live** on all 6 production pathways now (verified via `GET /v1/pathway/{id}`).
  2. **Rollback**: re-promote the prior version per pathway from the Bland dashboard. Pre-edit versions were: Naturopaths v8, Integrative_Medicine v12, Functional_Medicine v10, Acupuncturists v11 (and equivalents on Chiropractors / Massage_Therapists from the publish output).
  3. **Follow-up tracked**: `superpatch-frontend/docs/superpowers/plans/2026-05-14-scheduling-node-structural-fix.md` describes the proper structural refactor — split node 27 into 4 Default nodes + 1 Webhook node so each ask is a discrete runtime turn. The prompt-only mitigation is sufficient for the current testing cycle but should not be the long-term shape of the scheduling flow.
- **Verification**:
  - All 6 contextual JSON files re-parsed successfully after the edit.
  - `npm test` from `superpatch-frontend/` → 172/172 ✅ (includes `canonical-ids-sync.test.ts`).
  - `GET /v1/pathway/db955b59-…dafd` (Naturopaths) confirms node 27 `prompt_len=3444` containing `"HARD REQUIREMENT"` and node 28 `prompt_len=2624` containing `"SAFETY CHECK"` + `"NEVER say"`. Same shape expected on the other 5 pathways but not individually re-fetched (deferred to next test call).
  - Operator-facing verification: place a fresh call to `+15192427550` (now a brand-new caller — see the adjacent 2026-05-14 memory-store entry below). The agent should ask address → email → phone → date/time in that order before reading any confirmation, and should never say "null".

---

## 2026-05-14 — Bland memory store recreated; stale `BLAND_MEMORY_ID` resolved

- **What changed**:
  - Created a fresh Bland.ai memory store `161014f4-1e6a-429c-a203-d9a5583dca29` (name: `SuperPatch Sales Campaign`) and repointed `BLAND_MEMORY_ID` / `NEXT_PUBLIC_BLAND_MEMORY_ID` to it across all three surfaces: `superpatch-frontend/.env.local`, Vercel project env vars (Production + Preview + Development), and the Supabase Edge Function secret `BLAND_MEMORY_ID` on project `gdwwppwaxyvudsecexuq`.
  - Hard-deleted practitioner row `user_1771345668964_r71lna9` (name `wholehealth365`, phone `+15192427550`, type `Naturopath`, self-added test record) so the operator can call `5192427550` as a brand-new caller in end-to-end QA. Re-verified zero residue across `practitioners`, `call_records`, `sample_requests`, `appointments`, and `follow_up_queue` for both the phone substring and the practitioner_id.
- **Why it changed**: While clearing the DB for a fresh end-to-end test, surfaced that the configured `BLAND_MEMORY_ID` (`21d48afa-0981-4f16-bd97-c1b95f04d2ac`) had been returning `NOT_FOUND` from Bland for some time — and `GET /v1/memory` reported `{ memories: [] }` on the account, meaning the store had been deleted on Bland's side without the env vars being updated. Net effect in production: `process-retry-queue` (Deno) and the in-call flows that read `NEXT_PUBLIC_BLAND_MEMORY_ID` (`src/lib/batch-caller.ts`, `src/components/campaign/quick-call-tab.tsx`) were silently dispatching calls **without** cross-call memory — every retry / quick-call was effectively a cold first contact for the recipient, with no `last_call_at` / `summary` carry-over from prior conversations. The MEMORY_ID-gated branches in those callers no-op cleanly when the env var is missing or invalid, which is why the regression was invisible from the UI but real in the Bland conversation context.
- **Code touchpoints**:
  - `superpatch-frontend/.env.local` — `BLAND_MEMORY_ID` and `NEXT_PUBLIC_BLAND_MEMORY_ID` updated.
  - Vercel project `superpatch-frontend` (team `team_sSaTJgrsnrs5tFzsJeaw8DjT`) — both keys set for Production, Preview, Development via dashboard.
  - Supabase project `gdwwppwaxyvudsecexuq` Edge Function secrets — `BLAND_MEMORY_ID` updated via dashboard. Verified by sha256 digest match: `printf '161014f4-1e6a-429c-a203-d9a5583dca29' \| shasum -a 256` = `6bdf0704b2d6c69ba682b29f26b202bb3fd78f649d4de61e51795968574428e9` (matches `supabase secrets list` digest).
  - No source files changed.
- **Data-flow impact**: Dialer + retry queue. `superpatch-frontend/src/lib/batch-caller.ts:22` (`MEMORY_ID` read at module load), `superpatch-frontend/src/components/campaign/quick-call-tab.tsx:238,369` (read at click time), and `superpatch-frontend/supabase/functions/process-retry-queue/index.ts:31` (read at function invocation) all now see a live, empty memory store on the next call. No call-record write path, webhook-processor, book-appointment, or analytics path was touched.
- **ID / contract changes**: `BLAND_MEMORY_ID` rotated from `21d48afa-0981-4f16-bd97-c1b95f04d2ac` (deleted) to `161014f4-1e6a-429c-a203-d9a5583dca29` (active). The memory ID is **env-only** today and is intentionally not in `canonical_ids.json` (rotation is operational, not pathway-bound) — see follow-up below.
- **API / schema impact**: None.
- **Operational**:
  1. **Vercel redeploy required** for the frontend to pick up the new `NEXT_PUBLIC_BLAND_MEMORY_ID` (Next.js inlines `NEXT_PUBLIC_*` at build time). Trigger a fresh Production deploy of `superpatch-frontend` (do **not** "use existing build cache").
  2. Supabase Edge Functions do **not** need a redeploy — Deno reads the secret on each invocation. `process-retry-queue` will pick up the new ID on its next pg_cron tick.
  3. Old `BLAND_MEMORY_ID=21d48afa-...d2ac` should be considered dead. If it ever resurfaces in env, function logs, or docs, treat it as stale.
- **Verification**:
  - `curl https://api.bland.ai/v1/memory/161014f4-...dca29` returns the store with `users: []` (confirmed).
  - `GET /rest/v1/practitioners?phone=ilike.*5192427550*` returns `[]`; same for `call_records.phone`, `sample_requests.phone`, `appointments.attendee_phone`, and `follow_up_queue.practitioner_id` for the deleted id (confirmed).
  - Supabase secret digest matches the new UUID (confirmed via sha256).
- **Follow-up** (not yet shipped): Production has no guardrail against a missing/invalid `BLAND_MEMORY_ID` — the silent failure mode that hid this incident is still possible. Recommended next change: in `superpatch-frontend/supabase/functions/process-retry-queue/index.ts` (and a startup check in `batch-caller.ts`), on first read of the env var hit `GET /v1/memory/{id}` once and `console.error` (Edge) / surface a banner (frontend) if the response is `NOT_FOUND`. Track as a separate ticket; do not block on this for the current test.

---

## 2026-05-12 — AI Call Center production-fix plan (Phases 1–4)

- **What changed**:
  - **Cal.com v1 → v2 migration** in both `book-appointment` and `sync-cal-bookings` Edge Functions. Centralized into `supabase/functions/_shared/cal.ts` (`createCalBooking`, `listCalBookings`, `cancelCalBooking`, `CalError`) with `cal-api-version: 2026-02-25`. `sync-cal-bookings/status.ts` normalizes Cal.com statuses (`pending` → `scheduled`) into the canonical `AppointmentStatus` union from `src/lib/db/types.ts`.
  - **Repaired `sample_requests` notification trigger** (`20260512_fix_sample_notification_trigger.sql`) — the legacy trigger referenced columns that never existed (`practitioner_name`, `products`, `address`), so every AFTER INSERT raised `column does not exist` and rolled the insert back. No sample requests had been persisting in production.
  - **Repointed four pg_cron HTTP jobs** (`20260512_repoint_cron_jobs.sql`) — `process-enrichment-queue` was 404'ing because the function was renamed to `enrich-practitioners-v2`, and every HTTP cron call was being sent with an empty Bearer token (the `supabase.service_role_key` runtime setting is never populated). All four jobs now source the token from `vault.decrypted_secrets`. Operationally, the Vault secret must be inserted **before** the migration runs (the migration raises otherwise).
  - **Retired `/api/webhooks/bland`** (Next.js route) — the previous ~1,370-line implementation duplicated `webhook-processor` and was running on Cal.com v1 with the AI-email leak, the `.toLowerCase()` crash on undefined, and DST-broken business-hours math. Stub now returns HTTP 410 with `{ deprecated: true, replacement: "/functions/v1/webhook-processor" }`.
  - **`process-retry-queue`** — fixed the `increment_retry_count` RPC argument name (was `practitioner_id`, must be `p_id`); the wrong name made every call return `PGRST202` "function not found" and silently fall through to a non-atomic read-then-update path. Extracted into `process-retry-queue/retry.ts`. Also removed the unused `callId` parameter on `updatePractitionerAfterCall` (Task 4.1).
  - **`webhook-processor`** — `analyze-call` fetch handed to `EdgeRuntime.waitUntil` so the isolate doesn't terminate before the Gemini extraction flushes. Removed stale `CAL_API_KEY` and `CAL_EVENT_TYPE_ID` module-load constants. Unified boolean coercion of webhook variables into `_shared/coerce.ts:toBool`. Canonicalized `practitioner_type` once per webhook via `_shared/practitioner-type.ts` (canonical types and aliases now mirror `canonical_ids.json` exactly). Email priority + validation extracted into `webhook-processor/email.ts:pickSampleEmail`; sample-type classification extracted into `webhook-processor/sample-type.ts:classifySampleType` (now recognizes the literal `"standard_kit"`, which the inline classifier didn't).
  - **`book-appointment`** — `updateCallRecord` now reads existing `call_records.notes`, runs them through a new `book-appointment/notes.ts:buildNotesUpdate` helper to append `Cal.com Booking ID: <uid>` idempotently, and sets `appointment_booked = true` alongside `booking_id` / `calendar_invite_sent` so the UI's "booked" view doesn't lag a sync cycle.
  - **`analyze-call`** — `PATHWAY_SUMMARIES` constant replaced with the shared `_shared/practitioner-type.ts:pathwaySummaryFor` lookup; four duplicated Gemini fence-stripping regexes consolidated into a `stripJsonFences` helper (Task 4.1).
  - **Enrichment status normalized** (`20260513_normalize_enrichment_status.sql`) — `generate-daily-report`, `get_enrichment_stats`, `queue_practitioners_for_enrichment`, and `useRealtimePractitioners` were still filtering on the older `'completed'` value while the writer had moved on. Migration backfills legacy rows, adds a `CHECK ('pending','in_progress','enriched','failed','skipped')`, and recreates both RPCs. `get_enrichment_stats` keeps its return column named `completed` (now sourced from the `'enriched'` filter) so existing UI consumers don't break.
  - **PostgREST `.or()` injection guard** — `src/app/api/samples/route.ts` and `src/app/api/memory/route.ts` now run user/Bland-supplied search inputs through the existing `sanitizeSearchInput` helper before interpolation. CSV export from `/api/samples` is capped at 10,000 rows via `SAMPLES_CSV_MAX_ROWS` with `X-Export-Truncated` / `X-Export-Row-Cap` response headers.
  - **`batch-caller.resolveFromNumber()`** — only reads `NEXT_PUBLIC_BLAND_FROM_NUMBER` (Next.js strips server-only env vars from the client bundle, so the `|| process.env.BLAND_FROM_NUMBER` fallback was always `undefined` and masked missing config).
  - **Canonical-ID drift detection in the Deno runtime** — added `supabase/functions/_shared/pathways.test.ts` (Task 4.2). 7 Deno tests assert `KB_ID`, `VOICE_ID`, `DEFAULT_PATHWAY_ID`, `DEFAULT_WEBHOOK_URL`, every canonical pathway slug + alias, and the unknown-input default all mirror `canonical_ids.json`. The new test surfaced and resolved drift in **both** PATHWAY_IDS maps (Edge + frontend mirror): added `naturopaths`, `acupuncturists`, `chiropractors`, `integrative_medicine`, and `functional_medicine` keys so every canonical alias resolves to its UUID in both runtimes.
  - **Repointed Python CLI defaults** — `b2b_sales_enablement/bland_ai_pathways/make_call_with_kb.py` and `make_campaign_calls.py` now default the `webhook` payload field to the Supabase Edge Function URL (was pointing at the retired Vercel route).
  - **`update_bland_tools_calcom.py` migrated to Cal.com v2** — the Bland.ai in-call tools (`check_cal_availability` → `/v2/slots`, `book_cal_appointment` → `/v2/bookings`) were still defined against the retired Cal.com v1. The script now builds configs via two pure builders, uses Bearer auth + the documented `cal-api-version` headers (`2024-09-04` for slots, `2026-02-25` for bookings), rewrites the booking body to v2's `attendee` shape, unwraps the `$.data` response envelope, and swaps the `subprocess+curl` push for `requests.post`. Backed by 13 pytest cases in `b2b_sales_enablement/appointment_webhook/test_update_bland_tools_calcom.py`. **Operational note**: the new tool definitions are committed but still need to be pushed to Bland once (`BLAND_API_KEY=… CAL_COM_API_KEY=… python3 update_bland_tools_calcom.py`); until that runs, in-call tool invocations continue to 404 against the still-deployed v1 configs.
  - **Docs scrubbed** — `docs/CALL_CENTER.md` (with a new "API versions" table covering Cal.com v2, Bland.ai v1, Supabase JS, Gemini), `docs/SYSTEM_REVIEW_FINDINGS.md`, `docs/FEATURE_SCOPE.md`, `superpatch-frontend/README.md`, root `README.md`, and `superpatch-frontend/SECURITY.md` no longer treat `/api/webhooks/bland` as a live endpoint.
- **Why it changed**: Every item above was either silently failing in production or actively masking a different failure (404, 401, swallowed error, write-then-rollback, race condition, double-booking, AI email leak, untyped `.toLowerCase()` crash, Cal.com v1 deprecation). The Bug Report this plan executes against is `docs/superpowers/plans/2026-04-21-ai-call-center-production-fixes.md`.
- **Code touchpoints** (Edge / migration / Python — frontend touchpoints listed in `superpatch-frontend/docs/CHANGELOG.md`):
  - `superpatch-frontend/supabase/functions/_shared/cal.ts` (new) + `cal.test.ts`
  - `superpatch-frontend/supabase/functions/_shared/practitioner-type.ts` (new) + test
  - `superpatch-frontend/supabase/functions/_shared/coerce.ts` (new) + test
  - `superpatch-frontend/supabase/functions/_shared/pathways.ts` (alias additions) + `pathways.test.ts` (new)
  - `superpatch-frontend/supabase/functions/book-appointment/{index.ts,notes.ts}` + `notes.test.ts`
  - `superpatch-frontend/supabase/functions/sync-cal-bookings/{index.ts,status.ts}`
  - `superpatch-frontend/supabase/functions/process-retry-queue/{index.ts,retry.ts}` + `retry.test.ts`
  - `superpatch-frontend/supabase/functions/webhook-processor/{index.ts,email.ts,sample-type.ts}` + tests
  - `superpatch-frontend/supabase/functions/analyze-call/index.ts`
  - `superpatch-frontend/supabase/functions/generate-daily-report/index.ts`
  - `superpatch-frontend/supabase/migrations/20260512_fix_sample_notification_trigger.sql` (new)
  - `superpatch-frontend/supabase/migrations/20260512_repoint_cron_jobs.sql` (new)
  - `superpatch-frontend/supabase/migrations/20260513_normalize_enrichment_status.sql` (new)
  - `superpatch-frontend/supabase/tests/sample_requests_insert.test.sql` (new)
  - `b2b_sales_enablement/bland_ai_pathways/make_call_with_kb.py`
  - `b2b_sales_enablement/bland_ai_pathways/make_campaign_calls.py`
- **Data-flow impact**: Every stage of the call-center pipeline was touched. Dialer (NEXT_PUBLIC_BLAND_FROM_NUMBER required); Bland webhook (Edge Function is now the sole entry point, with 410 on the old route); call-record write (canonical practitioner_type, sanitized boolean coercion, validated sample email, correct sample-type classification, `analyze-call` survives isolate teardown); appointment booking (Cal.com v2, idempotent notes append, `appointment_booked` set in-band); appointment sync (v2 statuses normalized, error surface maps `CalError` to upstream); retry queue (atomic RPC, no unused params); enrichment (status normalized + CHECK-constrained, cron HTTP jobs authorized); daily report (filters on `'enriched'`); admin UI (`/api/samples` and `/api/memory` PostgREST `.or()` injection guarded, CSV capped).
- **ID / contract changes**: No production Bland.ai or Cal.com IDs changed. `PATHWAY_IDS` gained missing alias keys (`naturopaths`, `chiropractors`, `acupuncturists`, `integrative_medicine`, `functional_medicine`) in both runtime mirrors to match `canonical_ids.json`.
- **API / schema impact**:
  - `practitioners.enrichment_status` now constrained to `('pending','in_progress','enriched','failed','skipped')`. `'completed'` rows backfilled to `'enriched'`.
  - `sample_requests` notification trigger recreated.
  - Four `pg_cron` jobs unscheduled and recreated.
  - `/api/webhooks/bland` returns HTTP 410.
  - `GET /api/samples?format=csv` capped at 10k rows + `X-Export-Truncated` / `X-Export-Row-Cap` headers.
  - `GET /api/samples?search=...` and `POST /api/memory` now sanitize PostgREST `.or()` inputs.
- **Operational (run order)**:
  1. **Before** applying `20260512_repoint_cron_jobs.sql`, insert `service_role_key` into `vault.secrets` (the migration raises if it's missing).
  2. Apply Supabase migrations in order: `20260512_fix_sample_notification_trigger.sql`, `20260512_repoint_cron_jobs.sql`, `20260513_normalize_enrichment_status.sql`.
  3. Verify `20260421_disable_book_appointment_trigger.sql` is applied on prod: `SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trigger_queue_appointment_booking';` should return zero rows (trigger dropped) — see plan Task 4.3.
  4. Deploy Edge Functions: `webhook-processor`, `book-appointment`, `sync-cal-bookings`, `process-retry-queue`, `analyze-call`, `generate-daily-report`.
  5. Update Bland.ai dashboard if any pathway still points at `https://sales-enablement-six.vercel.app/api/webhooks/bland` — repoint to `https://gdwwppwaxyvudsecexuq.supabase.co/functions/v1/webhook-processor`.
- **Verification**:
  - Vitest: 172/172 ✅ (after Phase 3 gate)
  - Deno: 33/33 ✅ (after Phase 3 gate), 40/40 after Task 4.2 (`_shared/pathways.test.ts` adds 7)
  - End-to-end smoke checklist lives at the bottom of `docs/superpowers/plans/2026-04-21-ai-call-center-production-fixes.md` ("End-to-End Verification" / Smokes 1–8).

---

## 2026-04-21 — Rules, skills, and docs overhaul; canonical ID reconciliation; critical bug fixes

- **What changed**:
  - Introduced `b2b_sales_enablement/bland_ai_pathways/canonical_ids.json` as the single source of truth for Bland.ai pathway / KB / voice / tool / Cal.com / webhook IDs.
  - Refactored `bland_cli.py`, `publish_pathways_production.py`, and `update_bland_tools_calcom.py` to load IDs from `canonical_ids.json` at runtime. Fixed missing `import os` in `bland_cli.py` and `update_bland_tools_calcom.py`.
  - Deprecated `bland_ai_pathways/deployed_ids.txt` (replaced with a pointer). Stale IDs in `deployed_pathway_ids.json` should now be reconciled against `canonical_ids.json` during the next release.
  - Added `superpatch-frontend/supabase/functions/_shared/pathways.ts`; refactored `process-retry-queue` to import pathway resolution from it.
  - Added `superpatch-frontend/src/__tests__/canonical-ids-sync.test.ts` to enforce cross-mirror ID consistency.
  - Fixed broken Flask webhook import (`server.py`: `log_appointment_to_sheets` -> `append_appointment_to_sheet`) and aligned row payload keys in `sheets_integration.py`.
  - Disabled the pg_net `trigger_queue_appointment_booking` via `supabase/migrations/20260421_disable_book_appointment_trigger.sql` — `webhook-processor` remains the sole canonical appointment-booking path.
  - Authored a complete set of project-scoped Cursor rules in `.cursor/rules/` (de-PIRX'd existing four, added seven new) and user-scoped skills in `~/.cursor/skills/` for pathway authoring, lead ingestion, sample requests, and appointments.
- **Why it changed**: Eliminate silent drift between pathway ID sources; close two production bugs (broken Flask import and duplicate appointment booking); codify the review / doc-drift / TDD workflow so future work does not regress.
- **Code touchpoints**:
  - `b2b_sales_enablement/bland_ai_pathways/canonical_ids.json` (new)
  - `b2b_sales_enablement/bland_ai_pathways/bland_cli.py`
  - `b2b_sales_enablement/bland_ai_pathways/publish_pathways_production.py`
  - `b2b_sales_enablement/bland_ai_pathways/deployed_ids.txt`
  - `b2b_sales_enablement/appointment_webhook/server.py`
  - `b2b_sales_enablement/appointment_webhook/sheets_integration.py`
  - `b2b_sales_enablement/appointment_webhook/update_bland_tools_calcom.py`
  - `superpatch-frontend/src/lib/config/pathways.ts`
  - `superpatch-frontend/supabase/functions/_shared/pathways.ts` (new)
  - `superpatch-frontend/supabase/functions/process-retry-queue/index.ts`
  - `superpatch-frontend/supabase/migrations/20260421_disable_book_appointment_trigger.sql` (new)
  - `superpatch-frontend/src/__tests__/canonical-ids-sync.test.ts` (new)
  - `.cursor/rules/*.mdc` (readme-first, supabase-migrations, response-shape, no-scaffold updated; project-overview, frontend, supabase-conv, pathway, testing-tdd, taskmaster, documentation-maintenance added)
- **Data-flow impact**: Dialer stage (retry queue resolves pathway via shared module); webhook-processor stage (appointment booking path deduplicated); pathway authoring stage (Python scripts now authoritative against canonical JSON).
- **ID / contract changes**: No production Bland IDs changed. Stale IDs in `deployed_ids.txt` were never wired into production; removing them corrects the audit trail.
- **API / schema impact**: Migration drops `trigger_queue_appointment_booking` and `queue_appointment_booking()` — `book-appointment` Edge Function remains unchanged.
- **Verification**:
  - `pnpm test` (frontend) — see companion entry in `superpatch-frontend/docs/CHANGELOG.md` for results
  - Manual: `python3 -c "import json; print(json.load(open('b2b_sales_enablement/bland_ai_pathways/canonical_ids.json'))['pathways'].keys())"` returns all six pathway slugs.
