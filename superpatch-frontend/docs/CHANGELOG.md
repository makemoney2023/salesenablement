# Frontend Changelog

Frontend app deltas (Next.js app, API routes, client components, frontend deps). Backend / system deltas live in `docs/dev/changelog.md` at the repo root. Newest entries at the top. Entries follow the README Delta template from `.cursor/rules/readme-first-session.mdc`.

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
