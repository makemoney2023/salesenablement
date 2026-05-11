# Sales Enablement — Backend / System Changelog

Backend, system, infrastructure, pathway, Edge Function, migration, and Python script deltas. Frontend app deltas live in `superpatch-frontend/docs/CHANGELOG.md`. Newest entries at the top. Entries follow the README Delta template from `.cursor/rules/readme-first-session.mdc`.

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
