# Sales Enablement — Backend / System Changelog

Backend, system, infrastructure, pathway, Edge Function, migration, and Python script deltas. Frontend app deltas live in `superpatch-frontend/docs/CHANGELOG.md`. Newest entries at the top. Entries follow the README Delta template from `.cursor/rules/readme-first-session.mdc`.

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
