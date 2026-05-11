# Lead Pipeline

How practitioner leads move from public data sources into the `practitioners` table and become dial-ready. Mirrors the skill at `~/.cursor/skills/sales-enablement-lead-ingestion/SKILL.md`; this doc is the on-repo reference.

## Sources

| Source | Purpose | Fetched by |
|---|---|---|
| Google Maps Places | Primary discovery (name, phone, address, rating, reviews, website) | `scripts/` scrapers + `/api/search/places` |
| Firecrawl | Website crawl for bio, services, email enrichment | `/api/search/enrich` + `supabase/functions/enrich-practitioners-v2` |
| LinkedIn | Profile-level enrichment (title, bio, credentials) | Python enrichment scripts under `scripts/` or legacy `b2b_sales_enablement/` |

## Flow

```
[Places Search]  ---+
[Firecrawl]      ---+---> raw JSON/CSV --> import script (dedup) --> practitioners table
[LinkedIn]       ---+
                                                |
                                                v
                                enrich-practitioners-v2 (Edge Function)
                                                |
                                                v
                                 practitioners ready for dialer
```

## `practitioners` schema (key columns)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `name` | text | Practice / clinic name |
| `phone` | text | E.164 preferred; used as dedup key |
| `email` | text | Optional; filled by Firecrawl / LinkedIn / manual |
| `practitioner_type` | text | Must match a slug/alias in `canonical_ids.json.pathways.*.aliases` |
| `city`, `province`, `address` | text | Location |
| `rating`, `review_count` | numeric | From Google Places |
| `website` | text | Used by Firecrawl |
| `linkedin_url` | text | Used by LinkedIn enrichment |
| `enrichment_json` | jsonb | `{ firecrawl?: ..., linkedin?: ..., places?: ... }` |
| `do_not_call` | boolean | Default false |
| `retry_count`, `next_retry_at`, `retry_reason` | various | Retry queue state |
| `last_call_at` | timestamptz | Last Bland attempt |
| `created_at`, `updated_at` | timestamptz | Bookkeeping |

## Practitioner-type normalization

`practitioner_type` drives pathway selection. Valid values are the canonical slugs plus every alias from `canonical_ids.json`:

```
chiropractor            (aliases: chiropractors)
massage_therapist       (aliases: massage, massage therapist, rmt)
naturopath              (aliases: naturopaths, naturopathic doctor)
integrative_medicine    (aliases: integrative, integrative medicine, integrative medicine doctor, integrative medicine practitioner)
functional_medicine     (aliases: functional, functional medicine, functional medicine doctor, functional medicine practitioner)
acupuncturist           (aliases: acupuncturists)
```

Unknown values fall back to the chiropractor pathway via `getPathwayId`; always normalize at import to avoid silent mis-routing.

## Import flow

1. **Search** (Places) via `/api/search/places` or offline scraper — produce a candidate list.
2. **Preview / dedup** — operator reviews in `/search` UI; dedup on `(name, phone)`.
3. **Import** via `/api/search/import` (calls Supabase with `upsert(..., { onConflict: "phone" })`).
4. **Enrich** via `/api/search/enrich` (triggers `enrich-practitioners-v2`). Firecrawl results land in `enrichment_json.firecrawl`. LinkedIn runs separately if `linkedin_url` is present.
5. **Ready state** — `do_not_call = false`, `phone` present, `practitioner_type` in the canonical list. Retry queue will pick up during business hours.

## Dialer entry

Two paths read from `practitioners`:

- `process-retry-queue` Edge Function — pg_cron, business hours (`America/Toronto`, 9-17, weekdays).
- `/api/bland/calls` — operator single call from `/campaign`.

Both use `getPathwayId(practitioner.practitioner_type)` from the shared module.

## Operational runbooks

### Add a new data source

1. Write the scraper / enricher under `scripts/` or `b2b_sales_enablement/`.
2. Ensure output includes a normalized `practitioner_type`.
3. Merge into `enrichment_json` under a new key (e.g., `enrichment_json.new_source`).
4. Update this doc + `docs/dev/changelog.md`.

### Bulk mark do-not-call

Use a migration (never Studio edits) or a scripted RPC. Add an audit comment in the migration.

### Backfill missing pathway routing

Query `select id, practitioner_type from practitioners where practitioner_type is null or not in (<canonical list>)`. Fix in a migration or scripted update; log a delta.

### Rerun enrichment for a batch

```bash
supabase functions invoke enrich-practitioners-v2 \
  --no-verify-jwt \
  --body '{"practitionerIds":["<id1>","<id2>"]}'
```

## Related docs

- Architecture overview: `../ARCHITECTURE.md`
- Call center: `CALL_CENTER.md`
- Pathway authoring: `../../b2b_sales_enablement/bland_ai_pathways/README.md`
- Rules: `.cursor/rules/supabase-conventions.mdc`, `.cursor/rules/project-overview.mdc`
- Skill: `~/.cursor/skills/sales-enablement-lead-ingestion/SKILL.md`
