# Sales Enablement — Architecture

End-to-end view of how a Google Places listing becomes a booked Cal.com appointment. This is the authoritative diagram and flow description. For concrete file paths, see:

- Project overview rule: `.cursor/rules/project-overview.mdc`
- Pathway rules & deploy docs: `b2b_sales_enablement/bland_ai_pathways/README.md`
- Lead pipeline: `superpatch-frontend/docs/LEAD_PIPELINE.md`
- Call center UI: `superpatch-frontend/docs/CALL_CENTER.md`

## Stage overview

```
   [ EXTERNAL SOURCES ]                            [ INTERNAL SURFACES ]
   
   Google Places Scraper   ---+
   Firecrawl Website Crawl ---+--> scripts/        practitioners table <--- /campaign (Next.js)
   LinkedIn Enrichment     ---+   import + dedup       |                         |
                                                       |                         |
                                                       v                         v
                                         process-retry-queue (Edge Fn)   "Start call" button
                                         pg_cron, business hours                  |
                                                       |                         |
                                                       v                         v
                                         Bland.ai Pathway (per type) <----- Manual single-call
                                         + KB + Cal.com custom tools          (via API route)
                                                       |
                                         [ LIVE CALL — speech + tools ]
                                                       |
                                                       v
                                         webhook-processor (Edge Fn)
                                         parses transcript + extractVars
                                               /     |         \
                                              /      |          \
                               sample_requests   call_records    (appointment?)
                                       |               |               |
                                       v               |               v
                          send-sample-confirmation     |      book-appointment (Edge Fn)
                                  (Resend)             |         (Cal.com v2)
                                       |               |               |
                                       v               v               v
                           Practitioner email    Analytics/UI    Cal.com event + invite
                                                        ^
                                                        |
                                         sync-cal-bookings (pg_cron backfill)
```

## Stage details

### 1. Lead ingestion

- **Source scripts** live in `scripts/` and `b2b_sales_enablement/` (scraper, Firecrawl, LinkedIn enrichment).
- **Input shapes** produce JSON/CSV with `name`, `phone`, `website`, `practitioner_type`, `address`, `rating`, `review_count`, optional `linkedin_url`.
- **Target table**: `practitioners` (see `superpatch-frontend/supabase/schema.sql`).
- **Deduplication** happens at import time on normalized `(name, phone)`.
- **Enrichment JSONB** (`enrichment_json`) holds Firecrawl and LinkedIn outputs; safe to re-run because new blocks are merged.

### 2. Dialer

Two entry points:

- **Retry queue** (`process-retry-queue` Edge Function): pg_cron kicks this during business hours in `America/Toronto`. Selects practitioners with `next_retry_at <= now()` and `do_not_call = false`, then calls Bland.ai with the correct pathway for each `practitioner_type`.
- **Single call** (API route in `src/app/api/` invoked from `/campaign`): operator-triggered, same Bland call shape.

Pathway selection uses `getPathwayId()` from `supabase/functions/_shared/pathways.ts` / `src/lib/config/pathways.ts`, which both mirror `b2b_sales_enablement/bland_ai_pathways/canonical_ids.json`.

### 3. Conversation (Bland pathway)

- One pathway per practitioner type. Files: `b2b_sales_enablement/bland_ai_pathways/<Type>_contextual.json`.
- Shared KB (`canonical_ids.json.knowledge_base.id`) + shared voice (Jennifer) applied at call initiation.
- Two Bland custom tools are available to every pathway:
  - `check_availability` — calls Cal.com v2 `/slots` (`cal-api-version: 2024-09-04`).
  - `book_appointment` — calls Cal.com v2 `/bookings` (`cal-api-version: 2026-02-25`).
  - Tool definitions are built and pushed by `b2b_sales_enablement/appointment_webhook/update_bland_tools_calcom.py`; tool IDs live in `canonical_ids.json -> tools`.
- On call end, Bland POSTs to `webhook-processor` with the full transcript + extractVars.

### 4. Webhook processing

`superpatch-frontend/supabase/functions/webhook-processor/index.ts`:

- Verifies origin.
- Writes the call to `call_records` (transcript, outcomes, extracted_vars).
- If `wants_samples === true`: inserts a `sample_requests` row and invokes `send-sample-confirmation`.
- If `appointment_booked === true && call_records.booking_id IS NULL`: invokes `book-appointment` (with dedup check). The previous pg_net trigger (`20260116_book_appointment_trigger.sql`) was removed on 2026-04-21 to eliminate a duplicate path; this explicit fetch is now canonical.

### 5. Fulfillment

- **Samples**: `send-sample-confirmation` sends the Resend email and fills `sample_requests.email_sent_at`.
- **Appointments**: `book-appointment` creates the Cal.com booking, stores the returned `uid` as `call_records.booking_id`, and Cal.com sends the invite.

### 6. Reconciliation & analytics

- `sync-cal-bookings` (pg_cron) backfills any calls whose booking was created on Cal.com but not reflected in `call_records` yet (e.g., tool timeouts).
- `analyze-call` runs Gemini analysis on transcripts for sentiment / objections.
- `generate-daily-report` produces the end-of-day report surfaced at `/reports`.

## Runtime invariants

1. **Canonical IDs only**: pathway/KB/voice/tool/webhook/Cal.com IDs live in `canonical_ids.json`; all other references are mirrors enforced by a Vitest test.
2. **One side-effect path per event**: either an Edge Function explicit fetch OR a pg_net trigger — never both. Current canonical paths are documented in `.cursor/rules/supabase-conventions.mdc`.
3. **RLS enabled on every table** with explicit policies; Edge Functions use `SUPABASE_SERVICE_ROLE_KEY`.
4. **Business hours** enforced in `process-retry-queue` (Toronto timezone, 9 AM - 5 PM, weekdays only).
5. **Do-not-call honored** everywhere (dialer checks `do_not_call = false` in queries).

## Deployment topology

- **Frontend (Next.js)**: Vercel, served at the configured `NEXT_PUBLIC_SITE_URL`.
- **Edge Functions**: Supabase project `gdwwppwaxyvudsecexuq` (Toronto region).
- **Database**: Supabase Postgres (same project) with `pg_net` and `pg_cron` enabled.
- **Bland.ai**: dashboard pathways + custom tools. IDs in `canonical_ids.json`.
- **Cal.com**: `superpatchhealthprosales` workspace, 30-min event type (`4352394`).
- **Resend**: production sender.
- **Flask companion** (`b2b_sales_enablement/appointment_webhook/server.py`): local / fallback development helper. Not used in the primary production path.

## Observability

- Edge Function logs via Supabase dashboard (prefix per function).
- Cal.com webhooks land in the Cal.com dashboard + optional Flask app for legacy compatibility.
- Gemini analyses written to `call_records.analysis_json`.

## Change management

All changes that touch any stage above must update the corresponding changelog:

- Backend / infra / pathway / Python: `docs/dev/changelog.md`
- Frontend app: `superpatch-frontend/docs/CHANGELOG.md`

See `.cursor/rules/documentation-maintenance.mdc` for the doc-drift decision matrix.
