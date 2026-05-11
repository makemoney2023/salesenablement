# Sales Enablement — Backend / System Changelog

Backend, system, infrastructure, pathway, Edge Function, migration, and Python script deltas. Frontend app deltas live in `superpatch-frontend/docs/CHANGELOG.md`. Newest entries at the top. Entries follow the README Delta template from `.cursor/rules/readme-first-session.mdc`.

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
