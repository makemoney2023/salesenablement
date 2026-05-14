# Plan — Structural fix for the Bland scheduling flow (nodes 27 + 28)

**Status**: Draft / not started
**Owner**: Unassigned
**Predecessor**: 2026-05-14 prompt-only mitigation (shipped — see `docs/dev/changelog.md`)

## Why this plan exists

On 2026-05-14, an end-to-end test (call_id `70bd9fe4-93ee-4c12-9419-0bea899ea100`, Naturopaths pathway, `+15192427550`) surfaced that the Bland voice agent read `null` out loud when it reached "Schedule Appointment" without having captured `appointment_time`, `practitioner_email`, or `best_phone`. The pathway visited node 27 (Check Availability), asked only the first of its four scripted questions (confirm address), and immediately transitioned to node 28 (Schedule Appointment) — never invoking the `check_cal_availability` Cal.com tool.

A prompt-only mitigation was shipped same-day across all 6 pathways (Chiropractors, Massage_Therapists, Naturopaths, Integrative_Medicine, Functional_Medicine, Acupuncturists):

1. Node 27 prompt now includes a "HARD REQUIREMENT — do not transition until you have ALL of these" block and explicit step-by-step asks.
2. Node 28 prompt now wraps each confirmation line in Jinja `{% if %}` guards and adds a "SAFETY CHECK" that fills any missing var before reading the confirmation.

The mitigation is reliable enough for testing but is **not** a structural fix. The root cause remains: node 27 is a single `Webhook`-type node trying to collect 4 distinct facts AND invoke a tool — more than the Bland runtime reliably executes in one turn.

## What this plan delivers

Replace node 27 with a 4-node chain plus a separate Webhook node for the tool call:

```
(coming from any node that routes to "Check Availability")
   │
   ▼
27a "Confirm Visit Address"      [Default, extractVars: practice_address]
   │
   ▼
27b "Get/Confirm Visit Email"    [Default, extractVars: practitioner_email]
   │
   ▼
27c "Confirm Visit Phone"        [Default, extractVars: best_phone]
   │
   ▼
27d "Get Preferred Date/Time"    [Default, extractVars: appointment_time]
   │
   ▼
27e "Check Cal Availability"     [Webhook, tool=check_cal_availability]
   │
   ▼
28  "Schedule Appointment"       [Webhook, tool=book_cal_appointment]  (unchanged)
```

Each Default node has ONE ask and ONE extractVar. The runtime treats each as a discrete turn, so a single user utterance cannot accidentally satisfy the whole block.

## Tasks

### Phase 1 — Schema design (no production impact)

- [ ] **1.1** Read both `book_cal_appointment` and `check_cal_availability` tool definitions from `b2b_sales_enablement/appointment_webhook/update_bland_tools_calcom.py` to confirm what inputs `check_cal_availability` needs (currently: `start_date`, `end_date`, `timezone`). Decide how `27d` will convert a free-form "Tuesday at 2pm" into `start_date`/`end_date` (one option: pass `appointment_time` as a single string and have the tool's input mapping handle parsing; alternative: a date-normalization step in the prompt).
- [ ] **1.2** Sketch the new node graph in plain text in this plan doc, including every incoming edge for the existing node 27 (today the Naturopaths pathway has multiple sources routing into "Check Availability") and how each one repoints to `27a`.
- [ ] **1.3** Decide if all 6 pathways stay byte-identical for these new nodes (currently they are) or whether per-practitioner phrasing diverges. Recommend identical to keep blast radius small.

### Phase 2 — Implementation

- [ ] **2.1** Write a one-shot Python script (`b2b_sales_enablement/bland_ai_pathways/split_scheduling_node.py`) that, given a `<Type>_contextual.json`, in-place:
  - Renames the existing node `27` to `27a`, retains its incoming edges, replaces its prompt with a single-ask "Confirm Visit Address" prompt, sets `extractVars` to just `practice_address`, and clears its `tool` binding.
  - Inserts new nodes `27b`, `27c`, `27d`, `27e` with their prompts and extractVars.
  - Removes the old `27→28` edge labeled "time selected" and inserts `27a→27b→27c→27d→27e→28` with explicit conditions.
  - Re-routes any edge sources that used to target `27` to instead target `27a`.
  - Writes a `pre_structural_fix_<timestamp>.json` backup to `backups/`.
- [ ] **2.2** Run the script over all 6 contextual files.
- [ ] **2.3** Re-verify the 6 files all parse as JSON and that no edges target a now-missing node id.

### Phase 3 — Tests

- [ ] **3.1** Add a Vitest pathway-structure assertion (e.g., `src/__tests__/pathways-structure.test.ts`) that loads each contextual.json and asserts: (a) node `27a` exists and has `extractVars` `['practice_address']`, (b) node `27e` is a Webhook bound to `TL-79a3c232-…` (check_availability), (c) the edge chain `27a→27b→27c→27d→27e→28` exists, (d) no edges still target the old single `27`.
- [ ] **3.2** Run `pnpm test`. Confirm 173/173 (or whatever new count) green.

### Phase 4 — Test call

- [ ] **4.1** Place a Bland test call to a test number (e.g., the operator's own phone) using `bland_cli.py call --pathway naturopath`. Walk through the scheduling flow end-to-end. Verify the agent asks every question and invokes the Cal.com tool before reaching node 28.
- [ ] **4.2** Pull the call's `pathway_logs` and `variables` from `https://api.bland.ai/v1/calls/{id}`. Assert all four scheduling vars are non-null and the `check_cal_availability` tool_invocation appears in the call's tool log.

### Phase 5 — Production rollout

- [ ] **5.1** Publish all 6 pathways via `python3 publish_pathways_production.py`.
- [ ] **5.2** Verify in the Bland dashboard that each pathway loads at its new version without "Error Fetching Version".
- [ ] **5.3** Smoke-call from `/campaign` UI to confirm the dialer initiates the new version.

### Phase 6 — Docs

- [ ] **6.1** Append a delta to `docs/dev/changelog.md` covering: pathway version bumps, the new node id scheme, the new test file, and the rollback procedure (re-promote previous version per pathway in the Bland dashboard).
- [ ] **6.2** Update `superpatch-frontend/docs/PATHWAY_VARIABLES.md` if the scheduling extractVars surface area changed.
- [ ] **6.3** Mark this plan as **Completed** in `Status`.

## Non-goals

- Re-architecting the post-booking confirmation node (node 28) beyond the existing defensive-prompt patch. That node will need similar defense once collection is reliable, but the current Jinja-guard mitigation is sufficient.
- Cal.com tool definition changes. The deployed tools are already on Cal.com v2 (`https://api.cal.com/v2/slots`, `cal-api-version: 2024-09-04`) and don't need updating for this fix.
- Localization or wording polish. Keep prompts identical to the existing ones; only the node decomposition is changing.

## Risks & rollback

- **Risk**: A pathway that loses an incoming edge to `27` would silently break the "schedule a visit" branch from whatever node previously routed in. The Phase 1.2 sketch and Phase 3.1 test mitigate this.
- **Risk**: Adding 4 Default nodes to all 6 pathways increases token usage per call (~5–10% on the scheduling branch only).
- **Rollback**: Re-promote the prior pathway version per `id` from the Bland dashboard. The current (post-mitigation) versions are: Naturopaths v9, Integrative_Medicine v13, Functional_Medicine v11, Acupuncturists v12, Chiropractors and Massage_Therapists (see `docs/dev/changelog.md` 2026-05-14 entry for exact numbers).

## Out-of-scope follow-ups worth tracking separately

- Add a Vitest / runtime assertion that, on every Bland call's `pathway_logs`, every Webhook node that was visited also has a tool_invocation entry. Today a Webhook node can be entered and exited without the tool firing — that's the silent-failure shape that caused this incident.
- Surface an admin-UI warning on the `call_records` row when `appointment_booked = true` but `appointment_time` / `attendee_email` / `attendee_phone` is null. Today the UI would happily render a "booked" call with null fields.