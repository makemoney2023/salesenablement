# Abracadabra voice draft (not live)

Draft Bland.ai content for Christopher's review. Nothing in this folder is published. No live pathway, knowledge base, tool, or calendar was created. The SuperPatch pathways, `canonical_ids.json`, the TypeScript mirrors, and the call-center runtime are untouched.

Persona: **Ada**. The name sits inside Abracadabra (abra-c-**ada**-bra). Ada is the outbound caller. The discovery call and the thirty-minute working session are booked with **Christopher Buzny**. Houdini (`houdini@abra-ca-dabra.app`) is only the written follow-up owner. Ada does not tell the prospect they will meet Houdini.

Voice ID is not chosen. Placeholder: `TODO_CHRISTOPHER_BLAND_VOICE_ID`.

## Files

| File | What it is |
|---|---|
| `abracadabra_knowledge_base.txt` | Facts the agent may say. Every service, offer, and number is taken from https://abra-ca-dabra.app (and the pages on its sitemap), fetched 2026-10-19. Gaps are `TODO_CHRISTOPHER_*`. |
| `Abracadabra_SMB_Outbound.json` | One outbound pathway for small-business owners. Qualify, then book a thirty-minute working session with Christopher Buzny. |
| `test_abracadabra_pathway_schema.py` | Checks the draft parses, keeps the source graph, and does not keep SuperPatch language. |

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
| `TODO_CHRISTOPHER_LEAD_LIST_FIELDS` | KB | Call-list variables this pathway expects: `business_name`, `business_city`, `business_region`, `business_address`, `website`, `team_count`, `contact_email`, optional `google_rating` and `review_count`. `to` is the number Bland dialed |

The only traffic figures in the prompts are pirx.ca, Google Search Console, Jul 18 to Oct 17, 2026: 398K search impressions, 1.94K clicks, average position 7.6, and 46.5K AI-feature impressions as a separate report. The agent is told results vary by site and that nobody can guarantee a mention.

StrongFoam's public website stays in the KB because the site publishes it as a case study: visitors can start an estimate and book (https://abra-ca-dabra.app/portfolio/strongfoam-website/). Milrcorr's portfolio page also describes that business as StrongFoam's sister fit-out company. Renew Implants and the StrongFoam CRM placeholder were removed from this draft. The agent is not given a write-up of either.

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
