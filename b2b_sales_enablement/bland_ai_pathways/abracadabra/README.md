# Abracadabra voice draft (not live)

Draft Bland.ai content for Christopher's review. Nothing in this folder is published. No live pathway, knowledge base, tool, or calendar was created. The SuperPatch pathways, `canonical_ids.json`, the TypeScript mirrors, and the call-center runtime are untouched.

Persona: **Ada**. The name sits inside Abracadabra (abra-c-**ada**-bra). Ada is the outbound caller. The discovery call and the thirty-minute working session are booked with **Christopher Buzny**. Houdini (`houdini@abra-ca-dabra.app`) is only the written follow-up owner. Ada does not tell the prospect they will meet Houdini.

Voice ID is not chosen. Placeholder: `TODO_CHRISTOPHER_BLAND_VOICE_ID`.

## Files

| File | What it is |
|---|---|
| `abracadabra_knowledge_base.txt` | Facts the agent may say. Every service, offer, and number is taken from https://abra-ca-dabra.app (and the pages on its sitemap), fetched 2026-10-19. Gaps are `TODO_CHRISTOPHER_*`. |
| `Abracadabra_SMB_Outbound.json` | One outbound pathway for small-business owners. Qualify, then book a thirty-minute working session with Christopher Buzny. Per-call facts use Bland `{{variable}}` tags from `request_data`. |
| `sample_request_data.json` | Fake Northwind Bakery payload. Not a real lead. Not a number to dial. |
| `test_abracadabra_pathway_schema.py` | Checks the draft parses, keeps the source graph, does not keep SuperPatch language, and only uses documented `request_data` variables. |

## Graph compared with the source

Source file: `../Chiropractors_contextual.json`.

| | Source | This draft |
|---|---|---|
| Nodes | 41 | 41 |
| Edges | 410 | 410 |
| Node ids, node types, edge ids, edge source, edge target | | Identical |

37 edge labels were rewritten because they named a product, a clinic role, or SuperPatch. The other labels are unchanged (`interested`, `price objection`, `firm no`, `time selected`, `confirmed`, and the rest). Same edge, same endpoints. The label text is what the model matches, so a label that still said "Freedom" would never fire on this call.

`python3 -m pytest b2b_sales_enablement/bland_ai_pathways/abracadabra/test_abracadabra_pathway_schema.py`

## Call flow

1. **Introduction.** Ada asks if she has the business, handles "who is this," a busy owner, the front desk, a large team, and an automated menu.
2. **IVR Navigation** and **Team Size Discovery** / **Find Decision Maker** when she is not yet talking to the person who can say yes.
3. **Company Introduction.** About thirty seconds on what Abracadabra does. No service list.
4. **Discovery ladder** (situation, who the customer is, where work slows, what they use today, what "done" would look like). She does not present during this ladder.
5. **One service, or the menu.** Search and AI visibility, sales assistants, customer service, or operations, chosen from what they said. The menu node is the general case.
6. **Objection branches** stay in the graph: proof, price, already have someone, need to think, don't want a big project, the team won't use it, not interested, no time, off-the-shelf comparison. Each one can return to a service, the engagement choice, the Readiness Check, or the calendar.
7. **Three ways to start.** Owned system, one service, or hybrid. Same three-option choice as the source.
8. **Close** by locking the thirty-minute working session with Christopher Buzny, or by naming the one service he should open with. No payment is taken.
9. **Check Availability** then **Schedule Appointment** (Cal.com tool nodes). Four facts before the tool: business, email, phone, a real day and time. The invite names Christopher Buzny.
10. **End calls.** A booked session, a named service, a callback, and a send-info request flag written follow-up for Houdini. A firm no sets `houdini_follow_up` to false. Nobody tells the prospect the meeting is with Houdini.

## Who they meet, and who gets the written follow-up

There is no phone number on the public site, so this draft does not transfer the call live.

- The meeting is the thirty-minute working session the site offers after the Readiness Check (https://check.abra-ca-dabra.app/). The person on that session is Christopher Buzny. Booking, close, and session-locked nodes say his name.
- `Check Availability` and `Schedule Appointment` are still the Cal.com tool nodes. Their tool ids are placeholders: `TODO_CHRISTOPHER_CHECK_AVAILABILITY_TOOL_ID` and `TODO_CHRISTOPHER_BOOK_APPOINTMENT_TOOL_ID`. The event slug placeholder is `TODO_CHRISTOPHER_CAL_EVENT_SLUG`. The transfer-phone placeholder is `TODO_CHRISTOPHER_TRANSFER_PHONE`.
- Written follow-up stays with Houdini at `houdini@abra-ca-dabra.app`. That flag is on the Readiness Check node, the booking node, send-info, callbacks, and the positive end-call nodes (`houdini_follow_up` true, `handoff_email` set). The graceful exit sets `houdini_follow_up` to false so a refusal is not a request to call. Send-info sets its own flag on that node before the exit.
- Edge labels do not name either person. They were checked. None said Houdini, so the 37 rewritten labels from the first draft are unchanged.
- A voicemail node is not part of the source graph. The source prompt mentioned one that does not exist. A message or a missed IVR ends at **End Call: Graceful Exit**.

## Node mapping

Technique column is the sales move the source node was built to perform. The move is kept. The words changed.

| Id | Source node | Abracadabra node | Technique kept |
|---|---|---|---|
| 1 | Introduction | Introduction | Permission opener, gatekeeper, enrichment routing by team size |
| 2 | Company Introduction | Company Introduction | Thirty-second company story, then discovery |
| 3 | Discovery: Practice Overview | Discovery: Business Overview | Situation questions. No pitch yet |
| 4 | Discovery: Patient Types | Discovery: Customer Types | Who they serve. Tag the later presentation |
| 5 | Discovery: Patient Challenges | Discovery: Where Work Slows | Problem question. Do not solve it here |
| 6 | Discovery: Current Products | Discovery: Current Tools | What they use today, which sets the size of the project |
| 7 | Discovery: Ideal Solution | Discovery: Ideal Outcome | Need-payoff, then ask permission to present |
| 8 | Present: Freedom Patch | Present: Search and AI Visibility | Flagship presentation. This is the only node with a published number |
| 9 | Present: REM Patch | Present: Sales Assistants | Mechanism, then how the customer experiences it. No invented statistic |
| 10 | Present: Peace Patch | Present: Customer Service | Experience, and an honest "you may not need this" |
| 11 | Present: Liberty Patch | Present: Operations | Concrete job. No invented percentage |
| 12 | Present: Product Overview | Present: Service Menu | Whole menu, then recommend one or two from discovery |
| 13 | Objection: Need Research | Objection: Need Proof | Praise the skepticism. Cite only the published result. Offer the small step |
| 14 | Objection: Price Concern | Objection: Price Concern | Acknowledge, isolate, reframe to the job they named, offer the smaller step |
| 15 | Objection: Already Have Products | Objection: Already Have Someone | Compliment the current setup. Complement it. Do not rip it out |
| 16 | Objection: Need to Think | Objection: Need to Think | Stall probe. Specific next step. Do not accept "I'll call you" |
| 17 | Objection: Don't Want to Retail | Objection: Don't Want a Big Project | Agree with the identity, then the light path |
| 18 | Objection: Patients Won't Believe | Objection: Team Won't Use It | Experience on real work, not a lecture |
| 19 | Objection: Not Interested | Objection: Not Interested | One probe, then respect the no |
| 20 | Business Model Options | Engagement Options | Three-option choice |
| 21 | Business Model: Wholesale | Engagement: Owned System | Higher commitment. They keep the system |
| 22 | Business Model: Affiliate | Engagement: One Service | Light start. No inventory analogue |
| 23 | Business Model: Hybrid | Engagement: Hybrid | One service now, custom only where a rented tool fails |
| 24 | Close: Place Order | Close: Lock the Working Session | Confirm and stop selling. See the TODO below |
| 25 | Close: Set Up Affiliate | Close: Start One Service | Capture the choice and the email. See the TODO below |
| 26 | Offer Sample | Offer Readiness Check | Offer the meeting first, then the smaller step, then book the follow-up |
| 27 | Check Availability | Check Availability | Four required facts, then the availability tool |
| 28 | Schedule Appointment | Schedule Appointment | Read-back. Never say a missing value out loud. Then the booking tool |
| 29 | Schedule Callback | Schedule Callback | Turn "next week" into a day and a time |
| 30 | End Call: Sale Made | End Call: Session Locked with Christopher | Short close. Meeting with Christopher Buzny. Written follow-up flagged |
| 31 | End Call: Affiliate Set Up | End Call: One Service Started | Short close. Session with Christopher. Written follow-up flagged |
| 32 | End Call: Follow-Up Scheduled | End Call: Follow-Up Scheduled | Confirm Christopher's invite. Written follow-up flagged |
| 33 | End Call: Callback Scheduled | End Call: Callback Scheduled | Ada calls back. Written follow-up flagged for Houdini |
| 34 | End Call: Graceful Exit | End Call: Graceful Exit | Respect the no. Also the IVR dead-end. Follow-up false |
| 35 | Objection: No Time to Learn | Objection: No Time to Learn | Shrink the ask. Do not dismiss the calendar |
| 36 | Objection: Salonpas Comparison | Objection: Off-the-Shelf Comparison | Contrast the mechanism. Do not attack the other tool |
| 37 | Send Info Only | Send Info Only | Take the email and leave |
| 38 | Multi-Practitioner Discovery | Team Size Discovery | Size question at the front desk. No pitch |
| 39 | Lunch and Learn Offer | Team Working Session | One session for the group. See the lunch TODO |
| 40 | Find Decision Maker | Find Decision Maker | The person who answered is an ally |
| 41 | IVR Navigation | IVR Navigation | Listen, speak numbers as words, try the operator |

### Nodes that are not a clean product match

Kept, with the edges. Not deleted.

- **Close: Lock the Working Session** (was Place Order). The site has no checkout and no price. The node confirms the session and the job. It does not take payment. `TODO_CHRISTOPHER_PRICING`.
- **Close: Start One Service** (was affiliate signup). The site has no self-serve enrollment, code, or payout. The node records the service for Christopher Buzny's session. Written follow-up is flagged for Houdini.
- **Offer Readiness Check** (was the sample, including the "$200 kit" upsell). The meeting is offered first. The check is the smaller step. Nothing is shipped. The site does not say the check is free.
- **Team Working Session** (was Lunch and Learn). The half-hour group session stays. The meal does not. The site never offers food. `TODO_CHRISTOPHER_LUNCH` if that should return.
- **End Call: Graceful Exit** also covers a voicemail-style ending, because the source graph has no voicemail node.

Service mapping inside the four presentation nodes:

| Source focus | Abracadabra service | Why this slot |
|---|---|---|
| Freedom / pain, the evidence flagship | Search and AI visibility | Only published figures on the site (pirx.ca) |
| REM / sleep, "while you are away" | Sales assistants | The request still gets finished after the first reply |
| Peace / stress, a person still in the loop | Customer service | Answers from the record, a person when needed |
| Liberty / balance, the repeated daily job | Operations | Same steps, exceptions to a person |
| Product line overview | Service menu | One service, or the whole menu |

## Placeholders Christopher has to fill

Do not publish until these are real. The agent is instructed not to speak the tokens.

| Token | Where | What's missing |
|---|---|---|
| `TODO_CHRISTOPHER_BLAND_VOICE_ID` | Pathway description, prompts, KB | Bland voice for Ada |
| `TODO_CHRISTOPHER_ABRACADABRA_KB_ID` | Pathway description, prompts, KB | Bland id after the KB is uploaded |
| `TODO_CHRISTOPHER_CHECK_AVAILABILITY_TOOL_ID` | Check Availability `tool` | Bland custom tool. Do not reuse the SuperPatch tool id |
| `TODO_CHRISTOPHER_BOOK_APPOINTMENT_TOOL_ID` | Schedule Appointment `tool` | Bland custom tool for Christopher Buzny's calendar |
| `TODO_CHRISTOPHER_CAL_EVENT_SLUG` | Scheduling prompts and static vars | Cal.com event for the thirty-minute session with Christopher Buzny |
| `TODO_CHRISTOPHER_TRANSFER_PHONE` | Prompts and booking static vars | Only if a live transfer is wanted. Left blank on purpose |
| `TODO_CHRISTOPHER_PRICING` | Price objection, closes, KB | No price page was found (the `/pricing` URL 404'd) |
| `TODO_CHRISTOPHER_PRODUCT_PRICING` | KB | Schema, Super Funnel, and LLM Leverage have no public price |
| `TODO_CHRISTOPHER_READINESS_PRICE` | KB | The check page does not say free or paid |
| `TODO_CHRISTOPHER_LUNCH` | Team Working Session | Meal offer removed |
| `TODO_CHRISTOPHER_SOCIAL_DETAIL` | KB | Homepage mentions social posts. No separate service URL was on the sitemap |
| `TODO_CHRISTOPHER_LEAD_LIST_FIELDS` | KB, this README | Per-call variables below. Several HQ columns do not exist yet (`schema_score_reasons`, `schema_report_pdf_url`, split city/region/address, `team_count`, ratings). |

The only traffic figures in the prompts are pirx.ca, Google Search Console, Jul 18 to Oct 17, 2026: 398K search impressions, 1.94K clicks, average position 7.6, and 46.5K AI-feature impressions as a separate report. The agent is told results vary by site and that nobody can guarantee a mention.

StrongFoam's public website stays in the KB because the site publishes it as a case study: visitors can start an estimate and book (https://abra-ca-dabra.app/portfolio/strongfoam-website/). Milrcorr's portfolio page also describes that business as StrongFoam's sister fit-out company. Renew Implants and the StrongFoam CRM placeholder were removed from this draft. The agent is not given a write-up of either.

## Per-call request_data

Bland `POST /v1/calls` `request_data` becomes pathway variables. The knowledge base stays generic. Empty, null, or blank means Ada uses the generic line already in that node. She does not say a blank, "null", or a placeholder.

`company_summary` is at most two sentences. `pain_points` and `talking_points` are at most three. `pain_points` and `signals` are questions. `fit_reasons` is one paraphrased public reason. `talking_points` are only while she presents one service.

`owner_name` is the meeting owner. For this campaign it is Christopher Buzny. If it is empty, she says Christopher Buzny. `contact_name` is the person on the phone. The extract slot named `owner_name` tells the model not to overwrite the meeting owner with the person who answered.

The only score she says is `schema_score` (0–100, the website / AI-visibility score HQ stores as `deals.lead_score` / `schema_score`; lower means more room to improve). She says it as an opportunity, with `schema_public_finding` and the top one or two `schema_score_reasons` when those are present. She never says `bdr_fit_score`, `routing_status`, "C quality", sources, staff notes, "ready for outbound", "nurture", or `lead_score` as its own number. She does not speak the numeric Readiness Check scores. `readiness_summary`, when present, is one sentence with no number.

`sample_request_data.json` is the fake Northwind example, including a fake PDF URL on `example.com`. Do not dial `+15555550123`.

| Variable | Nodes | When it is empty |
|---|---|---|
| `business_name` | 1, 2, 41 | "the owner" / "someone there". No invented name. |
| `contact_name` | 1, 32, 40 | Ask for the owner, or the title if that is set. Node 32 thanks them by name only when it is set. |
| `contact_title` | 1, 38, 40 | Generic owner / decision-maker ask. |
| `contact_email` | 1, 2, 8, 13, 26, 27, 28, 32, 37 | Ask for the email before the invite. On the report offer, name the address only when it is already known. |
| `best_phone` | 27, 28 | Falls back to `to`, then "what's the best number?". Never speak a blank number. |
| `website` | 1, 2, and the score line on 8, 13, 26 | Do not name a site. The score line drops "on {site}". |
| `industry` | 2 | Skip the industry phrase. |
| `business_city`, `location_note` | 1 | Drop the place. `business_region` and `business_address` are spoken only when set. |
| `company_summary` | 2 | Generic thirty-second story. |
| `pain_points` | 5 | "What's the biggest slowdown after that first contact?" |
| `tech_stack` | 6, 15 | Generic tools question. "Already Have Someone" stays the generic compliment. |
| `talking_points` | 8, 9, 10, 11, 12 | The written presentation for that service. At most three lines, and only if they match that service. |
| `decision_makers` | 38, 40 | Generic "owner or manager" question. |
| `fit_reasons` | 1, 2 | No invented reason for the call. |
| `signals` | 5 | Generic slowdown question. Not a score. |
| `schema_public_finding` | 2, 8, 13 | No invented finding about their site. |
| `schema_score` | 2, 8, 13, 26 | Do not mention a score. |
| `schema_score_reasons` | 2, 8, 13, 26, 37 | "The full breakdown is in the report." No invented reasons. |
| `schema_report_pdf_url` | 2, 8, 13, 26, 37 | Fall back to `schema_report_url`, then the generic public page. She offers to email the PDF to `contact_email`. She does not send it. |
| `schema_report_url` | 2, 8, 13, 26, 37 | Generic public page. Do not spell the URL unless asked. |
| `survey_url` | 26 | Offer check.abra-ca-dabra.app. |
| `readiness_summary` | 26 | Skip it. No numeric survey score. |
| `owner_name` | 1, and the shared prompt on nodes 2–41 (every line that names the meeting owner, including 24, 30, and 32) | Say "Christopher Buzny". |
| `to` | 27, 28 | Ask for the best number. `to` is the number Bland dialed, not an HQ column. |
| `appointment_time` | 28, 32, and the other scheduling nodes that already confirm the time | Ask for a day and a time. Do not say a blank time. |
| `team_count`, `business_languages`, `google_rating`, `review_count` | 1 | Leave them out. Do not invent a headcount or a rating. HQ does not export these. |

### Where `schema_score_reasons` should come from

Read-only check of `makemoney2023/abracadabra` main on 2026-10-19. This repo was not edited.

The scan stores the number and the findings. It does not store a dialer-ready reasons list on the deal.

- `readiness_scans.score_total` is the 0–100 score. `score_breakdown_json` holds five pillars (structured data, AI discovery files, AI crawlability, page coverage, answer readiness).
- `readiness_scan_findings` stores `code`, `severity`, `passed`, `message`, `page_url`, and `evidence_json` (`readiness-check/migrations/0001_readiness_scans.sql`).
- `buildPriorityFixes` in `readiness-check/src/lib/scoring/findings.ts` ranks failed, non-info findings and returns up to five `message` strings.
- `buildPillarWhy` maps finding codes to short labels such as "Missing llms.txt" (`readiness-check/src/lib/scoring/pillar-why.ts`).
- `deals.lead_score`, `scored_at`, and `routing_status` are the HQ columns (`handoff/migrations/0024_lead_scores.sql`). Pass the website number as `schema_score` only. Do not pass `routing_status`.
- `presentSchemaLead` in `handoff/src/lib/schema-report.ts` builds `schema_report_url` as `https://check.abra-ca-dabra.app/scan/{publicToken}`. Its lines are pillar scores ("Structured data 20/35"), not plain-language reasons. `schema_check_sites.answer` is a staff review sentence, not this list.

**Gap.** HQ has no `schema_score_reasons` field. The dialer should copy up to five failed findings from `readiness_scan_findings.message`, in `buildPriorityFixes` order, rewritten into "what's missing and why it matters" when the stored message is only a label. Do not pass `evidence_json`, finding codes, or pillar scores for Ada to read. Until that copy exists, send `schema_score_reasons` as an empty list.

### Does a PDF exist today?

A PDF can be rendered. A stable per-lead PDF URL does not exist. Live calls must pass `schema_report_pdf_url` as `""`. The sample file's `example.com` URL is only there to show the shape.

What exists:

- `GET /api/scans/{token}/pdf` (`readiness-check/src/app/api/scans/[token]/pdf/route.tsx`) renders a schema report with `@react-pdf/renderer` from the scan payload: score, summary, pillar scores, page matrix, and findings. The next-step line tells the reader to install a fix package. It does not invite them to book with Christopher. The route requires an unlock cookie and returns a download. It does not store the file.
- `GET /api/assessments/{token}/pdf` is a different document, the questionnaire report, and only after the visitor leaves an email. It is not the schema scan PDF.
- `schema_report_url` is the HTML page `/scan/{publicToken}`, not a PDF.
- Handoff's Wrangler config binds R2 buckets named `handoff` and `handoff-skills`. The readiness-check worker config does not bind R2 for this report, and nothing writes the scan PDF into R2.
- No `schema_report_pdf_url` column or export field was found.

**Proposed HQ change. Needs Christopher's approval. Not built here.** After `scan_ready`, a Cloudflare Worker should generate the PDF (the existing renderer, or Browser Rendering), store it in R2, and write a stable `schema_report_pdf_url` onto the deal export. The PDF should contain the score, the plain-language reasons, the fixes, and a call to book the working session with Christopher Buzny. Ada offers to email that PDF to `contact_email`. The send happens after the call on the written-follow-up flag. Ada does not send it live and does not name Houdini.

### Open questions for Christopher

1. Approve copying `readiness_scan_findings.message` (failed rows, top five, plain language) into `schema_score_reasons` at dial time.
2. Approve the stored PDF: Worker, R2, `schema_report_pdf_url`, with the score, reasons, fixes, and a booking link for Christopher.
3. `team_count`, `business_languages`, `google_rating`, and `review_count` are still not in the HQ export. The prompts leave them empty.
4. HQ location is one free-text string. Pass it as `business_city` only when it is a single city. Otherwise pass `location_note` and leave city, region, and address empty.

## Proposed rollout

Do this in order. Do not skip ahead.

1. **This draft.** Review the KB and the outbound pathway. Fill the placeholders above. Upload the KB and the pathway in Bland only after that review. Attach the KB at call time. Point the two tool ids at Christopher Buzny's calendar.
2. **Inbound pathway.** Not in this folder. Build it after the outbound copy is accepted, so the same Ada facts, the same session with Christopher Buzny, and the same written follow-up flag are reused.
3. **Wire it.** Only then add an Abracadabra entry to `canonical_ids.json` and mirror it in `superpatch-frontend/src/lib/config/pathways.ts` and `superpatch-frontend/supabase/functions/_shared/pathways.ts`. Update runtime copy that still assumes a practitioner pathway. Run `pnpm test` in `superpatch-frontend/` so the canonical-id sync test stays honest.
4. **Retire SuperPatch pathways last.** Delete or unpublish the six live pathways only after Abracadabra outbound and inbound are in production and the call center is reading the new ids. Not before.

## What this draft does not do

- It does not edit `canonical_ids.json`, either `pathways.ts`, the webhook processor, or any `*_contextual.json` pathway.
- It does not call Bland, Cal.com, Resend, or any other write API.
- It does not place a call or send email.
