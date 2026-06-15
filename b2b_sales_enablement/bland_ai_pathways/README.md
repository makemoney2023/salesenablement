# Bland.ai Pathways — SuperPatch Sales Enablement

This folder holds every Bland.ai pathway that SuperPatch uses for B2B outbound sales, along with the Python tooling to deploy and operate them.

## Canonical source of truth

**All** Bland.ai pathway / KB / voice / tool / Cal.com / webhook IDs live in:

```
canonical_ids.json
```

TypeScript mirrors (kept in sync via `superpatch-frontend/src/__tests__/canonical-ids-sync.test.ts`):

- `superpatch-frontend/src/lib/config/pathways.ts`
- `superpatch-frontend/supabase/functions/_shared/pathways.ts`

If you change an ID here, run `pnpm test` in `superpatch-frontend/` before merging.

## Pathway inventory

| Practitioner type | Pathway file | Canonical key |
|---|---|---|
| Chiropractor | `Chiropractors_contextual.json` | `chiropractor` |
| Massage therapist / RMT | `Massage_Therapists_contextual.json` | `massage_therapist` |
| Naturopath | `Naturopaths_contextual.json` | `naturopath` |
| Integrative medicine | `Integrative_Medicine_contextual.json` | `integrative_medicine` |
| Functional medicine | `Functional_Medicine_contextual.json` | `functional_medicine` |
| Acupuncturist | `Acupuncturists_contextual.json` | `acupuncturist` |

Every `*_contextual.json` file is a production-scale pathway with `data.prompt` nodes and a `Webhook` terminus that posts to `webhook-processor`. The pathway IDs for each are in `canonical_ids.json.pathways.*.id`.

## Scripts

| Script | Purpose |
|---|---|
| `bland_cli.py` | Operator CLI: place calls, fetch status, download recordings, analyze transcripts, list recent calls. Loads IDs from `canonical_ids.json`. |
| `publish_pathways_production.py` | Creates a new pathway version from the local `_contextual.json` and promotes it to production. Loads IDs from `canonical_ids.json`. |
| `deploy_updated_pathways.py` | Legacy — prefer `publish_pathways_production.py`. |
| `bland_ai_pathway_generator.py` | Generates a starting pathway JSON skeleton from templates. |
| `add_booking_incentive.py` | Idempotent, additive transform that makes "book a demo" the primary goal and adds the "$200 free samples for booking" incentive across all 6 pathways. Writes timestamped backups; never adds/removes nodes or edges. Run with `--check` for a dry run. |

All scripts require `BLAND_API_KEY` in the environment.

## Deploying a pathway change

```bash
# 1. Edit <Type>_contextual.json with your changes.

# 2. Publish the new version.
export BLAND_API_KEY="..."
python3 publish_pathways_production.py

# 3. Verify in the Bland dashboard (the new version should load without errors).

# 4. If you changed extractVars, update:
#    - superpatch-frontend/docs/PATHWAY_VARIABLES.md
#    - superpatch-frontend/supabase/functions/webhook-processor/index.ts

# 5. Append a delta to docs/dev/changelog.md.
```

## Booking goal + $200 sample incentive

Every pathway's primary goal is to **book a 20-30 minute demo**. The headline conversion lever is: **book a demo and we ship $200 worth of free SuperPatch samples** to try before the visit. This is implemented additively (the existing sample-only, order, affiliate, and callback paths are untouched):

- A `## PRIMARY GOAL — BOOK A DEMO` block is injected before the `## ROUTING PRIORITY` marker in each routing node.
- `Offer Sample` upsells to the $200 demo kit before sending a single free sample (falls back to the single sample if declined).
- `Check Availability` reinforces the $200 reward while capturing the four required fields.
- `Schedule Appointment` sets `staticVars.wants_sample = "true"` and `sample_notes = "$200 demo-booking incentive ..."`, so booking **auto-fulfils** the $200 sample: `webhook-processor` creates the `sample_requests` row and sends the confirmation email (`shouldInsertSample`), deduped one-per-call. No Edge Function or schema change is needed.

Re-apply or update this behavior with the idempotent transform:

```bash
python3 add_booking_incentive.py --check   # dry run
python3 add_booking_incentive.py           # apply (writes backups/)
python3 -m pytest test_booking_incentive.py
```

### Safe deploy (don't-destroy) procedure

1. **Pre-flight sync** — confirm the local files still match live production before publishing (the publisher prefers the local file, so unsynced dashboard edits would be reverted). Compare node/edge counts + node names against a `GET /v1/pathway/{id}` for each pathway.
2. Publish **one** pathway first and test-call it (see below) to confirm it loads and that booking + $200 sample fire end-to-end.
3. Publish the rest with `publish_pathways_production.py`.
4. **Rollback** — every publish creates a new numbered version; to roll back, re-publish a prior `version_id`: `POST /v1/pathway/{id}/publish` with `{ "version_id": <n>, "environment": "production" }`.

## Updating Cal.com custom tools

Cal.com `check_availability` and `book_appointment` tool configs live on Bland.ai and are updated via:

```bash
cd ../appointment_webhook
export BLAND_API_KEY="..."
export CAL_COM_API_KEY="..."
python3 update_bland_tools_calcom.py
```

The script loads tool IDs and Cal.com event-type info from `canonical_ids.json`.

## Test-calling a pathway

```bash
export BLAND_API_KEY="..."
python3 bland_cli.py call --phone "+15551234567" --pathway chiropractor
python3 bland_cli.py status --call-id <returned id>
python3 bland_cli.py analyze --call-id <returned id>
```

Accepted `--pathway` values: every canonical key plus every alias from `canonical_ids.json` (e.g., `chiropractor`, `chiropractors`, `massage`, `rmt`, etc.).

## Deprecated files

- `deployed_ids.txt` — held a stale UUID set that never matched production. File remains as a deprecation pointer.
- `deployed_pathway_ids.json` — redundant mirror; treat `canonical_ids.json` as authoritative.

## Related docs

- End-to-end flow: `../../ARCHITECTURE.md`
- Pathway variables: `../../superpatch-frontend/docs/PATHWAY_VARIABLES.md`
- Call center UI: `../../superpatch-frontend/docs/CALL_CENTER.md`
- Skill for pathway work: `~/.cursor/skills/sales-enablement-pathway-authoring/SKILL.md`
- Cursor rules: `.cursor/rules/pathway-conventions.mdc`, `.cursor/rules/supabase-conventions.mdc`
