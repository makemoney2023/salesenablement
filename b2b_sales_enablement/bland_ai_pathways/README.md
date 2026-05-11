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
