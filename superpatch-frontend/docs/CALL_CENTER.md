# Call Center / Campaign Dialer

The AI-powered call center enables automated outbound calling to healthcare practitioners across Canada, leveraging Bland.ai for natural conversations.

## Overview

The call center is accessed at `/campaign` and provides:
- Practitioner database management
- Campaign dialer with queue management
- Real-time call tracking and analytics
- Sample request tracking
- Do Not Call (DNC) compliance

---

## Practitioner Management

### Data Sources

**Database Practitioners**
- Imported from Google Maps scraping of Canadian healthcare practitioners
- Includes chiropractors, naturopaths, massage therapists, acupuncturists, and integrative/functional medicine practitioners
- Contains contact info, ratings, reviews, and location data

**User-Added Practitioners**
- Created via Quick Call when calling numbers not in the database
- Marked with `is_user_added = true` flag
- Displayed with "User Added" badge in UI
- Filterable via the "Source" filter

### Enrichment Data

Practitioners can have enrichment data from website scraping:
- Team members (names, credentials)
- Contact emails
- Services offered
- Languages spoken

Enriched practitioners display a purple "Enriched" badge and compact indicators in the table.

#### Enrichment Status

| Status | Description |
|--------|-------------|
| `pending` | Website not yet scraped |
| `in_progress` | Scraping currently running |
| `completed` | Successfully enriched |
| `failed` | Scraping failed (will retry) |

#### Enrichment Improvements

**Stale Status Cleanup**: Records stuck in `in_progress` for >5 minutes are automatically reset to `pending`.

**Retry Mechanism**: Failed enrichments can be retried by calling the edge function with `includeRetries: true`.

**Duplicate Prevention**: The enrich API checks current status before starting:
- Skips if already `in_progress`
- Skips if already `enriched` (unless `force: true`)

#### Real-Time Enrichment Updates

Enrichment status changes are broadcast in real-time:
- Progress visible as practitioners move through statuses
- Callbacks available for completion/failure events

### Filtering Options

| Filter | Description |
|--------|-------------|
| Province | Filter by Canadian province |
| City | Filter by city (province-dependent) |
| Type | Practitioner type (Chiropractor, etc.) |
| Rating | Minimum Google rating |
| Phone | Has phone number (default: on) |
| Website | Has website URL |
| Enriched | Has enrichment data |
| Emails | Has contact emails |
| Team | Has team member data |
| Multilingual | Multiple languages spoken |
| Source | User Added vs Database |
| DNC | Hide/Show Do Not Call |
| Call Status | Filter by call outcome |

---

## Campaign Dialer

### Queue Management

1. Select practitioners in the table (checkbox or shift-click for range)
2. Click "Start Calling" to begin campaign
3. System calls practitioners sequentially
4. Configurable delay between calls (default: 60 seconds)

### Call Flow

```
Start Campaign
    ↓
Pick next practitioner from queue
    ↓
Initiate Bland.ai call with pathway
    ↓
Wait for call completion (webhook)
    ↓
Update call record with results
    ↓
Check for DNC phrases in transcript
    ↓
Continue to next or end campaign
```

### Pathways

Each practitioner type has a dedicated conversational pathway:

| Type | Pathway ID |
|------|------------|
| Chiropractor | `9aa760af-6f9a-430f-8d0c-25bf84afd8fb` |
| Massage Therapist | `1fee31b1-8179-48c6-b6fa-12fcd434ed2b` |
| Naturopath | `db955b59-d278-410e-981e-5728dfa2dafd` |
| Integrative Medicine | `b6240419-3b24-4415-9541-804994cce425` |
| Functional Medicine | `70f3a50a-9055-4f41-bc0d-81964dfae19a` |
| Acupuncturist | `084673ec-84d6-4c3a-bedb-ba9d72bd7e3b` |

---

## Quick Call

For one-off calls to numbers not in the database:

1. Enter phone number
2. Search checks if practitioner exists
3. If found: displays practitioner info, allows pathway selection
4. If not found: enter manual details (practice name, contact, address)
5. Select pathway based on practitioner type
6. Initiate call
7. On success: practitioner is saved to database as "User Added"

### Required Fields
- Phone number
- Practice name (for manual calls)

### Optional Fields
- Contact name (Dr. name)
- Email address
- Street address
- City, Province, Postal code

---

## Do Not Call (DNC) System

### Automatic Detection

The webhook analyzes call transcripts for DNC phrases:

```typescript
const DNC_PHRASES = [
  "don't call",
  "do not call",
  "stop calling",
  "remove me",
  "take me off",
  "not interested",
  "never call again",
  "unsubscribe",
];
```

When detected:
1. Practitioner flagged with `do_not_call = true`
2. Source set to `ai_detected`
3. Matched phrase stored in `dnc_reason`
4. Timestamp recorded in `dnc_detected_at`

### Manual Marking

From the practitioner drawer "More Actions" menu:
1. Click "Mark as Do Not Call"
2. Dialog opens with reason input
3. Enter reason (required)
4. Confirm to mark as DNC

### Restoring from DNC

2-step process to prevent accidents:
1. Click "Restore to Active" in drawer
2. Confirmation dialog appears:
   - Warning about re-adding
   - Checkbox: "I confirm this practitioner has given consent"
   - Must check box to enable Confirm button
3. Click Confirm to restore

### DNC Filtering

- **Default behavior:** DNC practitioners are hidden
- **Filter option:** "Show Do Not Call Only" to view DNC list
- **Visual indicators:** Red "DNC" badge, subtle row tinting

---

## Call Records

### Status Values

| Status | Description |
|--------|-------------|
| `not_called` | No call attempt made |
| `queued` | In campaign queue |
| `in_progress` | Call currently active |
| `completed` | Call finished successfully |
| `booked` | Appointment scheduled |
| `calendar_sent` | Cal.com invite sent |
| `voicemail` | Reached voicemail |
| `failed` | Call failed to connect |

### Sentiment Analysis

Bland.ai provides sentiment analysis:
- **Positive** (green): Interested, engaged
- **Neutral** (gray): Non-committal
- **Negative** (red): Disinterested, hostile

### Lead Scoring

Automatic scoring (0-100) based on:
- Call outcome
- Sentiment score
- Engagement indicators
- Appointment booking

---

## Post-Call LLM Analysis

### Overview

After each call completes, the `analyze-call` Edge Function uses Google Gemini to perform deep analysis of the call transcript. This runs asynchronously (fire-and-forget) so it doesn't slow down webhook processing.

### Features

**Structured Data Extraction**
- Objections raised by the prospect
- Buying signals detected
- Pain points mentioned
- Products discussed (Freedom, REM, Liberty, etc.)
- Decision maker identification
- Competitor mentions
- Next steps agreed
- Timeline indicators
- Contact information extraction

**Enhanced Lead Scoring**
- LLM-calculated score (0-100) with reasoning
- Considers conversation quality, not just outcomes
- Stored separately from rule-based score for comparison

**Pathway Improvement Suggestions**
- Analyzes where AI responses could be better
- Identifies missing conversation paths (edges)
- Detects knowledge base gaps
- Suggests new nodes for common scenarios
- Tracks suggestion frequency across calls

**Follow-Up Email Generation**
- Auto-generates personalized follow-up emails
- References relevant clinical studies
- Addresses specific objections from the call
- Stored as drafts in `follow_up_queue`

### Database Tables

#### call_records (new columns)
```sql
llm_analysis      JSONB       -- Full structured extraction
llm_lead_score    INTEGER     -- LLM-calculated score (0-100)
llm_analyzed_at   TIMESTAMPTZ -- When analysis completed
analysis_status   TEXT        -- pending, processing, completed, failed
```

#### pathway_suggestions
```sql
id                  UUID PRIMARY KEY
call_record_id      UUID REFERENCES call_records
practitioner_type   TEXT        -- Chiropractors, Naturopaths, etc.
suggestion_type     TEXT        -- node_prompt, edge_label, missing_edge, missing_node, knowledge_base_gap
node_id             TEXT        -- Which pathway node (e.g., "6")
node_name           TEXT        -- Human-readable name
suggested_content   TEXT        -- The improvement suggestion
reasoning           TEXT        -- Why this change helps
transcript_excerpt  TEXT        -- Relevant conversation snippet
severity            TEXT        -- low, medium, high, critical
frequency_count     INTEGER     -- How often this issue occurs
status              TEXT        -- new, reviewed, implemented, dismissed
```

#### follow_up_queue
```sql
id              UUID PRIMARY KEY
call_record_id  UUID REFERENCES call_records
practitioner_id TEXT REFERENCES practitioners
type            TEXT        -- email, sms, callback_notes
subject         TEXT        -- Email subject line
content         TEXT        -- Email body
context_data    JSONB       -- Products, studies, objections
status          TEXT        -- draft, approved, sent
created_at      TIMESTAMPTZ
sent_at         TIMESTAMPTZ
```

### Configuration

Set the Gemini API key in Supabase Dashboard:
1. Go to Project Settings → Edge Functions → Secrets
2. Add `GEMINI_API_KEY` with your Google AI API key

### Edge Function: analyze-call

**Trigger:** Called by `webhook-processor` after saving call records

**Input:**
```json
{
  "call_record_id": "uuid",
  "transcript": "full call transcript",
  "practitioner_id": "optional practitioner id",
  "practitioner_type": "Chiropractors",
  "current_lead_score": 65
}
```

**Output:**
```json
{
  "success": true,
  "llm_lead_score": 78,
  "scoring_reasoning": "High engagement with decision maker...",
  "extraction_summary": {
    "objections": 2,
    "buying_signals": 3,
    "pain_points": 2,
    "products_discussed": ["Freedom", "REM"]
  },
  "pathway_suggestions_saved": 1,
  "follow_up_generated": true
}
```

### Suggestion Deduplication

When the same pathway issue is detected across multiple calls:
- `frequency_count` is incremented instead of creating duplicates
- `similar_call_ids` array tracks which calls had this issue
- High-frequency suggestions indicate systematic pathway problems

### Analysis Status

| Status | Description |
|--------|-------------|
| `pending` | Call saved, waiting for analysis |
| `processing` | LLM analysis in progress |
| `completed` | Analysis finished, results saved |
| `failed` | Analysis failed (check logs) |

---

## Sample Requests

### Detection

The webhook detects sample requests from call transcripts when prospects express interest in receiving product samples.

### Products

- Freedom (pain)
- Liberty (balance)
- REM (sleep)
- Focus
- Ignite (metabolism)
- Defend (immunity)
- Victory (performance)
- Kick It (habits)
- Joint Flex

### Status Workflow

```
pending → approved → shipped → delivered
              ↓
         cancelled
```

### Real-Time Updates

Sample requests update in real-time via Supabase subscriptions:
- New requests appear immediately in the Samples tab
- Status changes are reflected without page refresh
- Live connection indicator shows when real-time is active

### Export

Sample requests can be exported to CSV for fulfillment processing.

---

## Retry Queue

### Overview

The Retries tab shows practitioners scheduled for follow-up calls. Retries are automatically scheduled when calls result in voicemail or failed status.

### Stats Dashboard

| Stat | Description |
|------|-------------|
| Due Now | Retries past their scheduled time |
| Next Hour | Retries scheduled within the next 60 minutes |
| Next 24 Hours | Retries scheduled within 24 hours |

### Retry Logic

When a call ends with voicemail or failure:
1. `retry_count` is incremented
2. `next_retry_at` is set (business hours: 9 AM - 6 PM local time)
3. `retry_reason` is recorded (e.g., "voicemail", "no_answer")

### Retry Queue Processing

The `process-retry-queue` edge function (cron-triggered) handles automatic retries:
- Fetches practitioners where `next_retry_at <= now`
- Excludes `do_not_call = true` practitioners
- Initiates calls with full practitioner context
- Includes `memory_id` for cross-call context retention

### Real-Time Updates

The retry queue updates in real-time:
- New retries appear automatically when scheduled
- Processed retries are removed from the queue
- Time-based stats refresh every minute

---

## Real-Time Updates

### Overview

The campaign page uses Supabase real-time subscriptions to provide live updates without page refresh. Three dedicated hooks handle different data streams.

### Hooks

| Hook | Table | Purpose |
|------|-------|---------|
| `useRealtimeSampleRequests` | `sample_requests` | Live sample request updates |
| `useRealtimePractitioners` | `practitioners` | Enrichment status changes |
| `useRealtimeRetryQueue` | `practitioners` | Upcoming retry scheduling |

### Connection Status

Each real-time feature shows a "Live" badge when connected:
- Green radio icon indicates active subscription
- Automatic reconnection on connection loss
- Fallback polling available if real-time unavailable

### Callbacks

Hooks support optional callbacks for reactive behavior:

```typescript
useRealtimeSampleRequests({
  onNewRequest: (request) => { /* show notification */ },
  onStatusChange: (request, oldStatus) => { /* log change */ },
});

useRealtimePractitioners({
  onEnrichmentComplete: (practitioner) => { /* update UI */ },
  onEnrichmentFailed: (practitioner) => { /* show error */ },
});

useRealtimeRetryQueue({
  onRetryScheduled: (item) => { /* notify user */ },
  onRetryProcessed: (item) => { /* remove from view */ },
});
```

---

## Bland.ai Integration

### Webhook Endpoint

**Primary (Supabase Edge Function):**
```
POST https://<project-id>.supabase.co/functions/v1/webhook-processor
```

**Legacy (Vercel API Route — retired 2026-05-12):**
```
POST /api/webhooks/bland   →   HTTP 410 Gone
```
The legacy Next.js route was decommissioned on 2026-05-12 and now responds with HTTP 410 and `{ deprecated: true, replacement: "/functions/v1/webhook-processor" }`. Any pathway still configured against this URL will fail loudly — repoint it at the Supabase Edge Function above.

The webhook is now processed exclusively by the Supabase Edge Function `webhook-processor` for improved reliability and direct database access. Configure this URL in the Bland.ai dashboard under your pathway settings.

**Note (2026-04-21):** `webhook-processor` verifies request origin and required headers, and performs per-call-record dedup (via `call_records.booking_id` checks before invoking `book-appointment`). Bland.ai does not currently expose an HMAC signing secret for pathway webhooks; once available, HMAC validation should be added in this Edge Function. Track via `docs/dev/changelog.md`.

Receives call completion data:
- Call status and duration
- Transcript (concatenated)
- AI-generated summary
- Sentiment analysis
- Recording URL
- Extracted variables (supports both string and boolean types)

### Variable Type Handling

Bland.ai may return variables as either strings or booleans:
- `wants_sample`: `true` (boolean) or `"true"` (string)
- `wants_demo`: `true` (boolean) or `"true"` (string)

The webhook processor handles both formats automatically.

### Email Resolution

The webhook resolves practitioner email using a fallback chain:

```
1. Call-captured email (vars.email, vars.practitioner_email)
2. Metadata email (meta.clinic_email)
3. Stored contact_email (from practitioners table)
4. Enrichment emails (enrichment.data.emails[0])
```

This ensures Cal.com bookings and sample requests always have the best available email.

### Memory System

Cross-call context retention using Bland.ai Memory:
- Stores conversation history per phone number
- Enables personalized follow-up calls
- Maintains practitioner relationship context

### Environment Variables

```env
BLAND_API_KEY=sk_...
NEXT_PUBLIC_BLAND_MEMORY_ID=mem_...
BLAND_MEMORY_ID=mem_...
NEXT_PUBLIC_BLAND_WEBHOOK_URL=https://<project-id>.supabase.co/functions/v1/webhook-processor
```

**Bland Dashboard Configuration:**
Set the webhook URL in Bland.ai dashboard to point directly to the Supabase Edge Function. This bypasses the Vercel API route and provides more reliable webhook processing.

Note: `NEXT_PUBLIC_BLAND_WEBHOOK_URL` is used by the frontend when initiating calls. For production, this should match the URL configured in the Bland dashboard.

### API versions

| Vendor | Version | How it's pinned |
|---|---|---|
| Cal.com | v2 (header `cal-api-version: 2026-02-25`) | `CAL_API_VERSION` env var (default `2026-02-25`), enforced in `supabase/functions/_shared/cal.ts`. Cal.com retired v1 on 2026-04-08; `book-appointment` and `sync-cal-bookings` both call v2. |
| Bland.ai | v1 (`https://api.bland.ai`) | Bland is not yet versioned in URL; pathway / KB / voice IDs are pinned in `b2b_sales_enablement/bland_ai_pathways/canonical_ids.json` and mirrored into `supabase/functions/_shared/pathways.ts` and `src/lib/config/pathways.ts` (cross-checked by Vitest **and** a Deno test). |
| Supabase JS | `@supabase/supabase-js@2.x` | Pinned in `package.json`; Edge Functions import `2.39.0` directly. |
| Google Generative AI | `@google/generative-ai@latest` (Gemini 2.0 Flash) | Used by `analyze-call` for transcript extraction and follow-up classification. |

---

## Practitioner Search

### Overview

The "Search New" tab enables discovering and importing practitioners from Google Maps across North America (Canada and USA).

### Features

**Search Options**
- Country selector (Canada / USA)
- Province/State dropdown
- City dropdown with pre-configured coordinates
- Practitioner type selection (Chiropractor, Massage Therapist, Naturopath, etc.)
- Search radius slider (5-50 km)

**Results Management**
- Preview practitioner details before import
- Select multiple practitioners for bulk import
- Duplicate detection (existing practitioners highlighted)
- Enrich with Firecrawl website scraping
- Direct links to Google Maps

### Workflow

```
1. Select Country → Province/State → City
2. Choose Practitioner Type
3. Adjust Search Radius
4. Click "Search Google Maps"
5. Review Results
6. Select practitioners to import
7. Click "Import Selected"
8. Optionally enrich with Firecrawl
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search/places` | POST | Search Google Maps Places API |
| `/api/search/import` | POST | Bulk import practitioners to database |
| `/api/search/enrich` | POST | Enrich practitioner with Firecrawl |

### Environment Variables for Search

```env
# Required for Practitioner Search
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Required for Enrichment
FIRECRAWL_API_KEY=your_firecrawl_api_key
```

### Cost Considerations

| Service | Cost |
|---------|------|
| Google Maps Places API | ~$40 per 1,000 searches |
| Firecrawl Scrape | 1 credit per website |

### Enrichment Data Extracted

- Team member names and credentials
- Contact emails
- Phone numbers
- Services offered
- Languages spoken

---

## Practitioner Detail Drawer

### Tabs

**Overview**
- Practice information (address, phone, rating)
- Team members (from enrichment)
- Contact emails
- Services offered
- Languages spoken

**History**
- Call timeline with expandable entries
- Transcript preview
- Recording playback
- Sentiment indicators

**Notes**
- AI-generated call summary (read-only)
- User notes (editable, auto-saved)

### Actions

| Action | Description |
|--------|-------------|
| Call Now | Initiate call to practitioner |
| Send Email | Opens mailto link |
| Open Website | Opens practitioner website |
| Add to Queue | Add to campaign queue |
| Copy Phone | Copy phone to clipboard |
| Copy Address | Copy address to clipboard |
| Edit | Edit practitioner details |
| Export CSV | Download as CSV |
| Mark DNC | Mark as Do Not Call |
| Delete | Remove practitioner |

---

## Analytics

### KPI Cards
- Total calls made
- Successful connections
- Appointments booked
- Average call duration

### Pipeline View
- Kanban-style board by call status
- Drag-and-drop status changes

### Charts
- Call volume over time
- Conversion rates
- Sentiment distribution

---

## Database Schema

### practitioners table
```sql
id              UUID PRIMARY KEY
name            TEXT NOT NULL
practitioner_type TEXT
address         TEXT
city            TEXT
province        TEXT
phone           TEXT
website         TEXT
rating          DECIMAL
review_count    INTEGER
is_user_added   BOOLEAN DEFAULT FALSE
do_not_call     BOOLEAN DEFAULT FALSE
dnc_reason      TEXT
dnc_detected_at TIMESTAMPTZ
dnc_source      TEXT  -- 'ai_detected' | 'manual'
enrichment      JSONB
created_at      TIMESTAMPTZ
```

### call_records table
```sql
id                  UUID PRIMARY KEY
practitioner_id     UUID REFERENCES practitioners
practitioner_name   TEXT
phone               TEXT
call_id             TEXT  -- Bland.ai call ID
status              call_status
call_started_at     TIMESTAMPTZ
call_ended_at       TIMESTAMPTZ
duration_seconds    INTEGER
transcript          TEXT
summary             TEXT
sentiment_score     INTEGER
sentiment_label     TEXT
lead_score          INTEGER
recording_url       TEXT
appointment_booked  BOOLEAN
appointment_time    TIMESTAMPTZ
notes               TEXT
-- LLM Analysis columns
llm_analysis        JSONB       -- Structured extraction from Gemini
llm_lead_score      INTEGER     -- LLM-calculated score (0-100)
llm_analyzed_at     TIMESTAMPTZ -- When analysis completed
analysis_status     TEXT        -- pending, processing, completed, failed
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

### sample_requests table
```sql
id              UUID PRIMARY KEY
practitioner_id UUID REFERENCES practitioners
call_record_id  UUID REFERENCES call_records
products        TEXT[]
status          sample_status
shipping_address TEXT
notes           TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### pathway_suggestions table
```sql
id                  UUID PRIMARY KEY
call_record_id      UUID REFERENCES call_records
practitioner_type   TEXT NOT NULL        -- Chiropractors, Naturopaths, etc.
suggestion_type     TEXT NOT NULL        -- node_prompt, edge_label, missing_edge, missing_node, knowledge_base_gap
node_id             TEXT                 -- Pathway node ID (e.g., "6")
node_name           TEXT                 -- Human-readable name (e.g., "Objection Handler")
edge_id             TEXT                 -- Edge ID if applicable
current_content     TEXT                 -- Current prompt/label that needs improvement
suggested_content   TEXT NOT NULL        -- The suggested improvement
reasoning           TEXT                 -- Why this change would help
transcript_excerpt  TEXT                 -- Relevant conversation snippet
severity            TEXT DEFAULT 'medium'-- low, medium, high, critical
frequency_count     INTEGER DEFAULT 1    -- How many times this issue seen
similar_call_ids    UUID[]               -- Array of call IDs with same issue
status              TEXT DEFAULT 'new'   -- new, reviewed, implemented, dismissed
created_at          TIMESTAMPTZ
reviewed_at         TIMESTAMPTZ
implemented_at      TIMESTAMPTZ
```

### follow_up_queue table
```sql
id              UUID PRIMARY KEY
call_record_id  UUID REFERENCES call_records
practitioner_id TEXT REFERENCES practitioners
type            TEXT DEFAULT 'email'     -- email, sms, callback_notes
subject         TEXT                     -- Email subject line
content         TEXT NOT NULL            -- Email body content
context_data    JSONB                    -- Products mentioned, studies to reference, objections
status          TEXT DEFAULT 'draft'     -- draft, approved, sent, failed
created_at      TIMESTAMPTZ
sent_at         TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

---

## Supabase Edge Functions

### Overview

The call center uses several Supabase Edge Functions for async processing:

| Function | Trigger | Purpose |
|----------|---------|---------|
| `webhook-processor` | Bland.ai webhook | Process call completions, save records, trigger analysis |
| `analyze-call` | webhook-processor | LLM analysis with Gemini |
| `book-appointment` | webhook-processor | Create Cal.com bookings |
| `process-retry-queue` | Cron (scheduled) | Auto-dial retry queue |
| `send-sample-confirmation` | webhook-processor | Send sample request emails |
| `enrich-practitioners-v2` | API call | Website scraping via Firecrawl |

### Required Secrets

Set in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

| Secret | Required For |
|--------|--------------|
| `GEMINI_API_KEY` | analyze-call (LLM analysis) |
| `CAL_API_KEY` | book-appointment |
| `BLAND_API_KEY` | process-retry-queue |
| `FIRECRAWL_API_KEY` | enrich-practitioners-v2 |
