# Bland.ai Pathway Variable Configuration

This document describes the variables to configure in each Bland.ai pathway for comprehensive lead qualification and data capture.

## IMPORTANT: extractVars Format

Bland.ai requires `extractVars` in pathway nodes to use a specific **array-of-arrays** format:

```json
"extractVars": [
  ["variable_name", "type", "description"],
  ["contact_name", "string", "Name of the person we're speaking with"],
  ["decision_maker", "string", "Whether they make purchasing decisions"]
]
```

**DO NOT USE** these incorrect formats (will cause "Error Fetching Version"):
- Plain strings: `["contact_name", "decision_maker"]`
- Objects: `[{"name": "contact_name", "description": "..."}]`

## Input Variables (Request Data)

These variables are sent TO the pathway when initiating a call:

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `practice_name` | text | Practice/clinic name | "Dr. Smith Chiropractic" |
| `practice_address` | text | Street address | "123 Main St" |
| `practice_city` | text | City | "Toronto" |
| `practice_province` | text | Province | "Ontario" |
| `google_rating` | text | Google Maps rating | "4.8" |
| `review_count` | text | Number of Google reviews | "127" |
| `website` | text | Practice website URL | "www.drsmith.com" |
| `practitioner_type` | text | Type of practitioner | "chiropractor" |
| `has_address` | text | Whether address is available | "true" / "false" |

## Output Variables (Capture During Call)

Configure these variables to be extracted during the conversation:

### Contact Information

| Variable | Type | How to Capture | Example Prompt |
|----------|------|----------------|----------------|
| `contact_name` | text | Ask for name | "May I ask who I'm speaking with today?" |
| `contact_role` | select | Ask about position | "Are you the owner, office manager, or...?" |
| `email` | email | Ask for email | "What's the best email to send information to?" |
| `decision_maker` | boolean | Ask about authority | "Are you the one who makes decisions about new products for the practice?" |
| `best_callback_time` | text | Ask preference | "When would be the best time to reach you?" |

**Valid `contact_role` values:**
- `owner`
- `office_manager`
- `receptionist`
- `practitioner`
- `other`

### Interest & Qualification

| Variable | Type | How to Capture | Notes |
|----------|------|----------------|-------|
| `interest_level` | select | AI determines | Based on conversation tone and responses |
| `pain_points` | text | Listen for challenges | "What challenges do your patients face with pain management?" |
| `current_solutions` | text | Ask what they use | "What do you currently recommend to patients for pain relief?" |
| `objections` | text | Track concerns | Note any hesitations or concerns they raise |

**Valid `interest_level` values:**
- `high` - Very interested, wants to proceed
- `medium` - Interested but needs more info
- `low` - Slightly curious
- `not_interested` - Not interested at this time

### Business Information

| Variable | Type | How to Capture | Example Prompt |
|----------|------|----------------|----------------|
| `practice_size` | number | Ask directly | "How many practitioners work at your clinic?" |
| `patient_volume` | text | Ask about volume | "Roughly how many patients do you see per week?" |

### Next Steps

| Variable | Type | How to Capture | Notes |
|----------|------|----------------|-------|
| `follow_up_action` | select | Agree on action | What was agreed at end of call |
| `follow_up_date` | date | Schedule if needed | When to follow up |
| `decision_timeline` | text | Ask timeline | "When do you think you'd be ready to make a decision?" |

**Valid `follow_up_action` values:**
- `send_info` - Will email information
- `callback` - Will call back later
- `sample` - Will send samples
- `demo` - Will schedule demo
- `none` - No follow-up needed

### Existing Variables (Already Captured)

These are already being captured in the current pathways:

| Variable | Description |
|----------|-------------|
| `wants_demo` | Whether they want a demo |
| `appointment_time` | Scheduled appointment time |
| `wants_sample` | Whether they want samples |
| `sample_products` | Which products they want |

### Booking goal + $200 sample incentive (2026-06-09)

Booking a demo is the primary goal of every pathway, and booking earns the practitioner $200 worth of free samples. This is wired through node `staticVars`, not new extractVars:

| Variable | Where set | Effect |
|----------|-----------|--------|
| `wants_sample` | `Schedule Appointment` node `staticVars` (force-set to `"true"`) | Makes a booked demo auto-create a `sample_requests` row + confirmation email via `webhook-processor` `shouldInsertSample`. Still also captured organically by the `Offer Sample` / close nodes. |
| `sample_notes` | `Schedule Appointment` node `staticVars` (`"$200 demo-booking incentive ..."`) | Flows to `sample_requests.notes` so ops can identify incentive-driven sample kits. |

No schema or Edge Function change accompanies this — `wants_sample` already drives sample insertion. The booking dispatch (`shouldDispatchBooking`) and the sample insertion (`shouldInsertSample`) fire independently from the same completed booking call; a Do Not Call request suppresses both.

### Variable Type Handling

**Important:** Bland.ai may return boolean variables in different formats depending on the pathway configuration:

| Variable | Possible Values |
|----------|-----------------|
| `wants_sample` | `true` (boolean), `"true"` (string), `"yes"` (string) |
| `wants_demo` | `true` (boolean), `"true"` (string), `"yes"` (string) |
| `decision_maker` | `true` (boolean), `"true"` (string), `"yes"` (string) |

The `webhook-processor` Edge Function handles all these formats automatically by:
1. Converting values to strings using `String(value).toLowerCase()`
2. Checking for both boolean `true` and string `"true"`/`"yes"`

When configuring pathways, you can use either format - the webhook will process them correctly.

## Lead Score Impact

The system automatically calculates a lead score (0-100) based on:

| Factor | Score Impact |
|--------|--------------|
| Answered by human | +30 |
| Call duration > 2 min | +20 |
| Demo booked | +50 |
| Sample requested | +25 |
| Positive sentiment | +15 |
| Negative sentiment | -10 |
| Voicemail | -20 |
| Failed call | -30 |
| **Interest: High** | **+30** |
| **Interest: Medium** | **+15** |
| **Interest: Low** | **+5** |
| **Interest: Not interested** | **-20** |
| **Decision maker** | **+20** |
| **Email captured** | **+10** |
| **Follow-up: Demo** | **+25** |
| **Follow-up: Sample** | **+20** |
| **Follow-up: Callback** | **+15** |
| **Follow-up: Send info** | **+10** |
| **Practice size 5+** | **+15** |
| **Practice size 3-4** | **+10** |
| **Practice size 2** | **+5** |

## Example Pathway Configuration

In Bland.ai, configure your pathway to extract these variables at appropriate points:

```
Opening:
- Introduce yourself
- Ask: "May I ask who I'm speaking with?" → contact_name
- Ask: "Are you the owner or office manager?" → contact_role

Discovery:
- Ask about their practice → practice_size
- Ask about challenges → pain_points
- Ask what they currently use → current_solutions

Pitch:
- Present SuperPatch benefits
- Note their response → interest_level (AI-determined)
- Track any concerns → objections

Close:
- Ask: "Are you the decision maker?" → decision_maker
- Ask for email → email
- Agree on next steps → follow_up_action
- If scheduling: → follow_up_date
- Ask timeline → decision_timeline

Always capture:
- Best callback time if not proceeding → best_callback_time
```

## Webhook Processing

All extracted variables are automatically:
1. Saved to the `practitioners` table in Supabase
2. Used to calculate lead score
3. Available in the campaign dashboard for filtering

The webhook processes variables from `payload.variables` with these fallback patterns:
- `contact_name` OR `spoke_with`
- `contact_role` OR `role` OR `position`
- `email` OR `contact_email` OR `practitioner_email`
- `best_callback_time` OR `callback_time` OR `preferred_time_to_call`
- etc.
