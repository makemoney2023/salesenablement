# Frontend Changelog

Frontend app deltas (Next.js app, API routes, client components, frontend deps). Backend / system deltas live in `docs/dev/changelog.md` at the repo root. Newest entries at the top. Entries follow the README Delta template from `.cursor/rules/readme-first-session.mdc`.

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

### Added
- `superpatch-frontend/supabase/tests/sample_requests_insert.test.sql` pgTAP smoke test asserting a minimal `sample_requests` insert succeeds. Runs once a local Supabase test harness is wired (see the plan's Task 4.3).

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
