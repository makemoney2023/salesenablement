# SuperPatch Sales Enablement Platform

> **From 0 to AI-Powered Outbound Sales in 5 Phases**  
> A comprehensive system that transforms world-class sales training into intelligent, context-aware voice agents with a full-featured Call Center UI.

---

## 🎯 The Vision

Build an end-to-end sales enablement platform that:
1. **Extracts** proven sales frameworks from top trainers (Grant Cardone, Jordan Belfort, Brian Tracy)
2. **Synthesizes** these techniques into practitioner-specific word tracks
3. **Deploys** intelligent AI voice agents that can conduct real sales conversations
4. **Schedules** in-person demo appointments directly into calendars
5. **Manages** campaigns through a modern Call Center UI with real-time analytics

---

## 📊 Project Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SUPERPATCH SALES ENABLEMENT                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   PHASE 1: Knowledge Extraction                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐            │
│   │  60 YouTube │───▶│   Gemini    │───▶│  44 Framework   │            │
│   │   Videos    │    │  Analysis   │    │   Extractions   │            │
│   └─────────────┘    └─────────────┘    └─────────────────┘            │
│                                                                         │
│   PHASE 2: Content Synthesis                                            │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐            │
│   │  Frameworks │───▶│  SuperPatch │───▶│  6 Practitioner │            │
│   │ + Products  │    │   Context   │    │   Word Tracks   │            │
│   └─────────────┘    └─────────────┘    └─────────────────┘            │
│                                                                         │
│   PHASE 3: Voice Agent Development                                      │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐            │
│   │ Word Tracks │───▶│  Bland.ai   │───▶│  36-38 Nodes    │            │
│   │  + Context  │    │  Pathways   │    │  365-423 Edges  │            │
│   └─────────────┘    └─────────────┘    └─────────────────┘            │
│                                                                         │
│   PHASE 4: Scheduling Integration                                       │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐            │
│   │   Cal.com   │───▶│   Webhooks  │───▶│   Automated     │            │
│   │     API     │    │   + Tools   │    │   Bookings      │            │
│   └─────────────┘    └─────────────┘    └─────────────────┘            │
│                                                                         │
│   PHASE 5: Call Center & Analytics                                      │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐            │
│   │  Supabase   │───▶│  Real-time  │───▶│  Campaign       │            │
│   │  Database   │    │    Hooks    │    │  Management     │            │
│   └─────────────┘    └─────────────┘    └─────────────────┘            │
│                                                                         │
│   PHASE 6: Voice Agent Enhancements                                     │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐            │
│   │ Enrichment  │───▶│ Multilingual│───▶│  IVR + Voicemail│            │
│   │   Data      │    │   Support   │    │   Handling      │            │
│   └─────────────┘    └─────────────┘    └─────────────────┘            │
│                                                                         │
│   PHASE 7: Full Supabase Migration                                      │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐            │
│   │Practitioners│───▶│  Real-time  │───▶│  Phone Lookup   │            │
│   │   in DB     │    │   Updates   │    │   + Linking     │            │
│   └─────────────┘    └─────────────┘    └─────────────────┘            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
SalesEnablement/
│
├── 📺 PHASE 1: Knowledge Extraction
│   ├── YouTube videos.md          # 60 curated training videos
│   ├── youtube_videos.json        # Structured video metadata
│   ├── scripts/
│   │   ├── gemini_video_analyzer.py   # AI video analysis tool
│   │   └── transcribe_video.py        # Audio transcription
│   ├── analyses/                  # 44 video analyses (JSON + MD)
│   │   ├── _summary.json
│   │   └── [video_id].md          # Extracted frameworks per video
│   └── frameworks/
│       ├── all_frameworks.md      # 5,357 lines of extracted techniques
│       ├── closing_techniques.md
│       ├── objection_handling.md
│       ├── cold_calling.md
│       └── ...
│
├── 📝 PHASE 2: Content Synthesis
│   ├── products/
│   │   ├── SuperPatch_Product_Reference.md
│   │   └── superpatch_products.json
│   ├── b2b_sales_enablement/
│   │   └── wordtracks/
│   │       └── practitioners/     # 6 practitioner-specific guides
│   │           ├── Chiropractors_WordTrack.md
│   │           ├── Massage_Therapists_WordTrack.md
│   │           ├── Naturopaths_WordTrack.md
│   │           ├── Functional_Medicine_WordTrack.md
│   │           ├── Integrative_Medicine_WordTrack.md
│   │           └── Acupuncturists_WordTrack.md
│   └── canadian_market/           # Canadian-specific content
│       ├── PRACTITIONER_SCRAPER_README.md
│       └── wordtracks/
│
├── 📊 Data Collection Tools
│   └── scripts/
│       ├── canadian_practitioner_scraper.py  # Google Maps API scraper
│       ├── enrich_practitioner_data.py       # Website data enrichment
│       ├── migrate_to_supabase.py            # Practitioner DB migration
│       └── test_canadian_practitioner_scraper.py
│
├── 🤖 PHASE 3: Voice Agent Development
│   └── b2b_sales_enablement/
│       └── bland_ai_pathways/
│           ├── [Practitioner]_contextual.json  # Live pathways (40-41 nodes each)
│           ├── deploy_pathways.py
│           ├── deploy_updated_pathways.py      # Deploy all pathways at once
│           ├── make_call_with_kb.py            # Python call script with enrichment
│           ├── update_pathways_with_context.py
│           ├── expanded_pathway_generator.py
│           └── superpatch_knowledge_base.txt
│
├── 📅 PHASE 4: Scheduling Integration
│   └── b2b_sales_enablement/
│       ├── appointment_webhook/
│       │   ├── server.py              # Flask webhook server (legacy)
│       │   ├── sheets_integration.py  # Google Sheets logging
│       │   └── update_bland_tools_calcom.py
│       └── bland_ai_pathways/
│           ├── bland_cli.py           # CLI for Bland.ai API
│           ├── make_call_with_kb.py   # Python call script
│           └── make_call_with_kb.sh   # Bash call script
│
└── 🖥️ PHASE 5: Frontend Application & Call Center
    └── superpatch-frontend/           # Next.js sales enablement app
        ├── src/app/
        │   ├── campaign/              # Call Center Dashboard
        │   ├── voice-agent/           # Voice Agent Dashboard
        │   └── api/
        │       ├── bland/             # Bland.ai API proxy routes
        │       ├── campaign/          # Campaign management API
        │       │   ├── calls/         # Call records CRUD
        │       │   └── notes/         # Notes management
        │       ├── practitioners/     # Practitioner data API
        │       └── webhooks/
        │           └── bland/         # Cal.com booking webhook
        ├── src/components/
        │   ├── campaign/              # Call Center components
        │   │   ├── analytics-dashboard.tsx
        │   │   ├── practitioner-map.tsx
        │   │   ├── call-timeline.tsx
        │   │   ├── enhanced-charts.tsx
        │   │   └── empty-states.tsx
        │   └── ui/                    # Reusable UI components
        ├── src/hooks/                 # React hooks
        │   ├── useSupabaseCallRecords.ts  # Realtime call records (primary)
        │   ├── useCallRecords.ts      # Legacy call records hook
        │   ├── useCallNotes.ts        # Notes management
        │   └── useCampaignStats.ts    # Campaign statistics
        ├── src/lib/
        │   ├── supabase.ts            # Supabase client
        │   └── db/                    # Database service layer
        │       ├── call-records.ts
        │       ├── call-notes.ts
        │       ├── analytics.ts
        │       └── migrate-localstorage.ts
        ├── supabase/
        │   ├── schema.sql             # Full database schema
        │   └── practitioners_table.sql  # Practitioners table schema
        └── public/
            └── data/
                └── practitioners.json  # Backup JSON (data now in Supabase)
```

---

## 🖥️ Call Center Dashboard

**Live URL**: https://sales-enablement-six.vercel.app/campaign

The Call Center is a comprehensive campaign management interface for running AI-powered outbound sales campaigns.

### Features

#### 📋 Practitioner List
- **12,492 practitioners** stored in Supabase database
- **Virtualized table** with smooth scrolling (handles large datasets)
- **Compact Inter font layout** for data density
- **Server-side filtering**: Province, city, practitioner type, rating, enrichment status
- **Column sorting**: Click any column header to sort
- **Enrichment indicators**: Visual badges for enriched data (JSONB)
- **Quick actions**: One-click calling, view details, add to queue
- **Call data columns**: Last Called, Call Count, Duration, Voicemail (VM), Appointment, Summary

#### 🗺️ Interactive Map
- **Leaflet-based map** with practitioner markers
- **Clustering** for performance with large datasets
- **Status-based markers**: Color-coded by call status
- **Click to view**: Opens practitioner detail drawer
- **Load all option**: Fetch full dataset for complete coverage

#### 📊 Analytics Dashboard
- **Real-time statistics**: Calls today, connections, bookings, queue size
- **Gauge charts**: Connection rate, booking rate visualization
- **Call volume by day**: 7-day trend chart
- **Performance by practitioner type**: Comparative analysis
- **Duration trends**: Average call length over time

#### ⏱️ Call Timeline
- **Activity feed**: Real-time call events
- **Status updates**: Track call progression
- **Transcript access**: Full conversation records
- **Filtering**: By status, date range, practitioner

#### 📝 Notes System
- **Per-practitioner notes**: Add observations, follow-up items
- **Auto-save**: Notes persist automatically
- **Database-backed**: Stored in Supabase (with localStorage fallback)

#### ⚡ Quick Call
- **Search practitioners**: Find by name, phone, or city
- **Pathway selection**: Choose conversation type per practitioner
- **Direct dialing**: Start calls with one click
- **Request data passthrough**: Enrichment data passed to voice agent for personalization

### Call Center UI Components

| Component | Purpose |
|-----------|---------|
| `practitioner-map.tsx` | Interactive Leaflet map with clustering |
| `call-timeline.tsx` | Activity feed with call events |
| `analytics-dashboard.tsx` | Charts and statistics |
| `enhanced-charts.tsx` | Gauge, radial, and bar charts |
| `empty-states.tsx` | Friendly empty state illustrations |
| `skeleton-loaders.tsx` | Loading state skeletons |
| `practitioner-detail-drawer.tsx` | Full practitioner info + call history |

---

## 💾 Database Integration (Supabase)

### Architecture

```
┌─────────────────────┐      ┌─────────────────────┐
│   Client (Browser)  │      │   Server (API)      │
│                     │      │                     │
│  useSupabaseCall ───┼─────▶│  /api/campaign/     │
│  Records (realtime) │      │  calls, notes       │
│                     │      │                     │
│  Practitioners ─────┼─────▶│  /api/practitioners │
│  (from Supabase)    │      │  (queries DB)       │
│                     │      │         │           │
│       ▲             │      │         ▼           │
│       │ realtime    │      │  ┌─────────────┐    │
│       │ updates     │◀─────┼──│  Supabase   │    │
│       │             │      │  │  PostgreSQL │    │
└───────┼─────────────┘      │  │             │    │
        │                    │  │ practitioners│    │
        └────────────────────┼──│ call_records │    │
                             │  │ call_notes   │    │
                             │  └─────────────┘    │
                             │         ▲           │
                             │         │           │
                             │  /api/webhooks/     │
                             │  bland ─────────────┘
                             │  (phone lookup +    │
                             │   writes directly)  │
                             └─────────────────────┘
```

### Database Schema

```sql
-- Practitioners (12,492 records with enrichment data)
CREATE TABLE practitioners (
  id TEXT PRIMARY KEY,               -- Google Maps ID
  name TEXT NOT NULL,
  practitioner_type TEXT NOT NULL,
  address TEXT,
  city TEXT,
  province TEXT,
  phone TEXT,
  website TEXT,
  rating DECIMAL(2,1),
  review_count INTEGER,
  business_status TEXT,
  google_maps_uri TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  scraped_at TIMESTAMPTZ,
  notes TEXT,
  enrichment JSONB,                  -- Team members, emails, services, languages
  enrichment_status TEXT DEFAULT 'pending',
  enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Call Records (linked to practitioners via FK)
CREATE TABLE call_records (
  id UUID PRIMARY KEY,
  practitioner_id TEXT REFERENCES practitioners(id),  -- FK to practitioners
  practitioner_name TEXT NOT NULL,
  practitioner_type TEXT,
  phone TEXT NOT NULL,
  address TEXT,
  city TEXT,
  province TEXT,
  call_id TEXT UNIQUE,           -- Bland.ai call ID
  status TEXT DEFAULT 'not_called',  -- Includes 'voicemail' status
  call_started_at TIMESTAMPTZ,
  call_ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  transcript TEXT,               -- Full conversation
  summary TEXT,                  -- AI-generated summary
  appointment_booked BOOLEAN,
  appointment_time TIMESTAMPTZ,
  calendar_invite_sent BOOLEAN,
  practitioner_email TEXT,
  booking_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Call Notes (multiple notes per call)
CREATE TABLE call_notes (
  id UUID PRIMARY KEY,
  call_record_id UUID REFERENCES call_records(id),
  content TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ
);

-- Campaign Analytics (daily aggregates)
CREATE TABLE campaign_analytics (
  id UUID PRIMARY KEY,
  date DATE UNIQUE,
  total_calls INTEGER,
  completed INTEGER,
  booked INTEGER,
  failed INTEGER,
  total_duration_seconds INTEGER,
  created_at TIMESTAMPTZ
);
```

### React Hooks

| Hook | Purpose |
|------|---------|
| `useSupabaseCallRecords` | **Primary hook** - Real-time call records with Supabase subscriptions |
| `useCallRecords` | Legacy hook with polling fallback |
| `useCallNotes` | CRUD operations for notes |
| `useCampaignStats` | Aggregated campaign statistics |

### Key Features

- **Real-time Updates**: Call records update instantly via Supabase Realtime
- **Phone Lookup**: Webhook automatically links calls to practitioners by phone number
- **Practitioners in DB**: All 12,492 practitioners stored in Supabase (not JSON file)
- **Fallback Support**: Falls back to localStorage if Supabase unavailable

### Setting Up Supabase

1. **Create Project**: Go to [supabase.com](https://supabase.com) and create a new project

2. **Run Schema**: Copy `superpatch-frontend/supabase/schema.sql` to SQL Editor and execute

3. **Get API Keys**: From Project Settings > API:
   - Project URL
   - anon (public) key
   - service_role key (for server-side)

4. **Configure Environment Variables**:

```bash
# .env.local (or Vercel Environment Variables)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

5. **Deploy to Vercel**: Add the same variables in Vercel dashboard

### Graceful Fallback

The system works **without Supabase** using JSON files and localStorage:

- **Practitioners**: Falls back to `public/data/practitioners.json` if DB unavailable
- **Call records**: Falls back to localStorage if Supabase not configured
- **Real-time**: Falls back to polling (10s intervals) if subscriptions fail

```typescript
// Automatic fallback in practitioners API
const useSupabase = await checkSupabaseTable();
if (!useSupabase) {
  // Load from JSON file
  return loadFromJSON();
}

// Automatic fallback in call records hook
if (!isSupabaseConfigured || !realtimeConnected) {
  // Use polling fallback
  startPolling();
}
```

---

## 🔄 Data Enrichment

### Website Scraping

The `enrich_practitioner_data.py` script crawls practitioner websites to extract:

| Data Point | Description |
|------------|-------------|
| **Team Members** | Names and credentials of practitioners |
| **Services** | List of services offered |
| **Emails** | Contact emails found on site |
| **Phone Numbers** | Additional phone numbers |
| **Languages** | Languages spoken at the practice |

### Enrichment Display in UI

- **Enriched Badge**: Purple sparkle indicator on practitioner rows
- **Enrichment Column**: Sortable column showing enrichment status
- **Detail Drawer**: Full enrichment data with team members, services, etc.
- **Filter Options**: Filter by has enrichment, has emails, has team members

### Running Enrichment

```bash
cd scripts
python enrich_practitioner_data.py \
  --input ../canadian_practitioners/all_practitioners_latest.json \
  --output ../canadian_practitioners/enriched_practitioners.json \
  --limit 100
```

---

## 🔬 Phase 1: Knowledge Extraction

### The Source Material
We curated **60 YouTube videos** from the world's top sales trainers:

| Trainer | Focus Area | Key Techniques |
|---------|------------|----------------|
| **Grant Cardone** | Closing, Persistence | 10X Rule, Assumptive Close |
| **Jordan Belfort** | Persuasion, Tonality | Straight Line Selling, Certainty Transfer |
| **Brian Tracy** | Psychology, Process | AIDA, Consultative Selling |
| **Jeremy Miner** | NEPQ, Questions | Neuro-Emotional Persuasion Questions |
| **Various** | Objection Handling | Feel-Felt-Found, Reframing |

### The Extraction Process

```python
# scripts/gemini_video_analyzer.py
# Uses Google Gemini to analyze videos and extract:
# - Step-by-step frameworks
# - Exact scripts and word tracks
# - Objection handling responses
# - SuperPatch-specific applications

ANALYSIS_PROMPT = """
Analyze this sales training video and extract:
1. Main technique and framework name
2. Step-by-step process with psychology
3. Exact scripts and word tracks (quotable)
4. Objection handling with exact responses
5. Key actionable takeaways
6. How to apply to SuperPatch wellness products
"""
```

### Output: 44 Framework Analyses

Each video analysis includes SuperPatch-specific applications:

```markdown
## CLOSING Steps Framework (from VoUJ848UpWA)

### The 5-Step Closing Framework:
1. Proactively Overcome Objections
2. Sprinkle "Do you have any questions?"
3. The "Loop" Before Close
4. The Close
5. The Backup Close

### SuperPatch Application:
"Many people wonder how a small patch can make a big difference. 
Our patches don't contain drugs—they use vibrotactile technology 
to communicate with your brain. Let me show you how that works..."
```

---

## 📋 Phase 2: Content Synthesis

### Product Knowledge Base

13 SuperPatch products with clinical evidence:

| Product | Target | Clinical Evidence |
|---------|--------|-------------------|
| **Freedom** | Pain Relief | RESTORE Study: RCT, 118 participants |
| **REM** | Sleep | HARMONI Study: 80% stopped sleep meds |
| **Liberty** | Balance | 31% improvement, p<0.05 |
| **Peace** | Stress | Parasympathetic activation |
| **Boost** | Energy | Drug-free energy support |
| **Focus** | Clarity | Cognitive enhancement |
| *+ 7 more* | Various | Supporting research |

### Practitioner-Specific Word Tracks

We created comprehensive sales guides for 6 practitioner types, each with:

| Section | Content |
|---------|---------|
| **Understanding** | Practice philosophy, patient demographics, pain points |
| **Product Recommendations** | Which patches fit which patient presentations |
| **Opening Scripts** | 5 different approaches (cold call, referral, conference, etc.) |
| **Discovery Questions** | 15+ practitioner-specific questions |
| **Product Presentation** | P-A-S-E framework adapted to practice |
| **Objection Handling** | 6-8 objections with exact responses |
| **Closing Scripts** | 5 closing approaches |
| **Follow-Up Sequences** | Day 1, 3, 7, 14 email/call scripts |
| **Business Models** | Wholesale vs. Affiliate explanation |

---

## 🤖 Phase 3: Voice Agent Development

### Bland.ai Conversational Pathways

We programmatically generated **6 intelligent voice agents**—one for each practitioner type—with **40-41 nodes** and **382-440 edges** enabling full dynamic routing, including IVR navigation, multi-practitioner handling, and multilingual support:

```
Conversation Flow (36-38 Nodes with Global Routing):
┌─────────────┐
│ Introduction │ ──▶ "Hi, this is Jennifer with SuperPatch..."
└─────┬───────┘
      │ ←──────────────────────────────────────────────────┐
      ▼                                                     │
┌─────────────┐    ┌──────────────────────────────────┐    │
│  Discovery  │◀──▶│  GLOBAL ROUTING (any node can    │    │
│  Questions  │    │  jump to any other node)         │    │
└─────┬───────┘    └──────────────────────────────────┘    │
      │                        │                           │
      ▼                        ▼                           │
┌─────────────┐    ┌─────────────────┐                    │
│  Product    │◀──▶│  Objection      │──────────────────▶│
│ Presentations│    │  Handling (9)   │  (return edges)   │
└─────┬───────┘    └─────────────────┘                    │
      │                                                    │
      ▼                                                    │
┌─────────────┐    ┌─────────────────┐                    │
│  Business   │◀──▶│  Scheduling     │                    │
│   Model     │    │  (Cal.com)      │                    │
└─────┬───────┘    └─────────────────┘                    │
      │                   │                                │
      ▼                   ▼                                │
┌─────────────┐    ┌─────────────────┐                    │
│ Close/Order │    │  Send Info Only │────────────────────┘
└─────┬───────┘    └─────────────────┘
      │
      ▼
┌─────────────┐
│  End Call   │ ──▶ 5 ending variations (sale, callback, etc.)
└─────────────┘
```

### Available Pathway IDs

| Practitioner | Pathway ID |
|--------------|------------|
| Chiropractors | `cf2233ef-7fb2-49ff-af29-0eee47204e9f` |
| Massage Therapists | `d202aad7-bcb6-478c-a211-b00877545e05` |
| Naturopaths | `1d07d635-147e-4f69-a4cd-c124b33b073d` |
| Integrative Medicine | `1c958dd7-e1ff-4f6d-b9a3-f80a369c26aa` |
| Functional Medicine | `236dbd85-c74d-4774-a7af-4b5812015c68` |
| Acupuncturists | `154f93f4-54a5-4900-92e8-0fa217508127` |

---

## 📅 Phase 4: Scheduling Integration

### Cal.com + Webhook Integration

> **Important**: Bland.ai's API does not allow `tools` to be passed when using `pathway_id`. 
> Therefore, Cal.com booking is handled via **webhooks** instead of inline tools.

The voice agent workflow:
1. **Collects scheduling info** during the call (name, email, preferred time, address)
2. **Sends webhook** on call completion with extracted variables
3. **Webhook books** to Cal.com automatically
4. **Saves to Supabase** for tracking and analytics

### Webhook Architecture

```
┌─────────────┐    ┌──────────┐    ┌─────────────┐    ┌─────────┐
│ Voice Agent │───▶│ Bland.ai │───▶│ Your Webhook│───▶│ Cal.com │
│   (Call)    │    │ (Pathway)│    │ (Book Appt) │    │(Calendar)│
└─────────────┘    └──────────┘    └──────┬──────┘    └─────────┘
                                          │
                                          ▼
                                   ┌─────────────┐
                                   │  Supabase   │
                                   │  Database   │
                                   └─────────────┘
```

### Webhook Endpoint

```typescript
// superpatch-frontend/supabase/functions/webhook-processor/index.ts
//
// Canonical Bland.ai webhook handler (Supabase Edge Function).
// - Receives call completion data from Bland.ai
// - Extracts: name, email, preferred_time, address, practice_name
// - Books: Cal.com v2 appointment for in-person sales visit
//     (delegated to /functions/v1/book-appointment, which dedup-checks against call_records.booking_id)
// - Saves: Call record with transcript to Supabase
// - Links: Automatically finds practitioner by phone number
// - Fires: /functions/v1/analyze-call (Gemini extraction) via EdgeRuntime.waitUntil
```

**Production Webhook URL**:
```
https://gdwwppwaxyvudsecexuq.supabase.co/functions/v1/webhook-processor
```

The legacy Next.js route `https://sales-enablement-six.vercel.app/api/webhooks/bland` was retired on 2026-05-12 and now returns HTTP 410. Any Bland.ai pathway still configured against it will fail loudly.

---

## 🎙️ Phase 6: Voice Agent Enhancements

### Overview

Based on Firecrawl research of Bland.ai documentation, we implemented 5 key enhancements that leverage enrichment data (13,000+ practitioners, 6,500+ emails, 1,700+ multilingual clinics).

### 1. Pre-filled Email Confirmation

When we have a clinic email from enrichment data, Jennifer confirms it rather than asking:

```
WITHOUT pre-filled email:
"What email should I send the calendar invite to?"

WITH pre-filled email:
"I have info@clinic.com on file for the calendar invite - should I send it there?"
```

**Implementation:**
- `clinic_email` passed via `request_data` from enrichment
- Node 27 (Check Availability) uses conditional: `{% if clinic_email %}`

### 2. Multi-Practitioner Handling (Lunch & Learn)

Smart routing based on `team_count` from enrichment data:

```
┌─────────────────────────────────────────────────────────────┐
│                    INTRODUCTION (Node 1)                     │
│                                                              │
│  Enrichment Data:                                            │
│  - team_count: {{team_count}} practitioners                  │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  team_count > 2 │ │  team_count = 2 │ │ team_count = 1  │
│  LARGE PRACTICE │ │ MEDIUM PRACTICE │ │   or unknown    │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Node 40: Find   │ │ Node 38: Multi- │ │  Normal flow    │
│ Decision Maker  │ │ Prac Discovery  │ │  to Discovery   │
│                 │ │ → Lunch & Learn │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

**New Nodes:**
| Node | Name | Purpose |
|------|------|---------|
| 38 | Multi-Practitioner Discovery | Determines practice size via receptionist |
| 39 | Lunch and Learn Offer | Offers catered group demo (30 min) |
| 40 | Find Decision Maker | Routes to office manager/administrator |

### 3. Multilingual Jennifer (French/Quebec Support)

Jennifer automatically speaks French for Quebec and matches the prospect's language:

```python
# Language detection priority:
1. Quebec province → French (fr-CA)
2. Enrichment languages → Match first non-English language
3. Default → English

# French opening:
"Bonjour, c'est Jennifer de SuperPatch. Est-ce que je parle à quelqu'un de {practice_name}?"
```

**Supported Languages:** French, Spanish, Mandarin, Cantonese, Korean, Japanese, Portuguese, Italian, German, Hindi, Punjabi, Vietnamese, Tagalog, Arabic

**Implementation:**
- `language` parameter set based on province/enrichment
- All 191 nodes have multilingual instruction: "Respond in the same language the prospect is speaking"

### 4. Voicemail Handling

Configurable voicemail behavior with retry logic:

```python
payload["voicemail"] = {
    "action": "leave_message",
    "message": "Hi, this is Jennifer from SuperPatch...",
}

payload["retry"] = {
    "wait": 60,  # Minutes before retry
    "voicemail_action": "leave_message",
    "voicemail_message": "Hi, Jennifer again from SuperPatch..."
}
```

**Features:**
- Personalized voicemail messages (English + French)
- Automatic retry after 60 minutes
- Webhook tracks voicemail status separately
- New `voicemail` status in call records

### 5. IVR Navigation (Phone Tree Navigation)

Based on Firecrawl deep research of Bland.ai documentation:

```python
payload = {
    # CRITICAL: Use base model - turbo doesn't support IVR
    "model": "base",
    
    # IVR Settings
    "wait_for_greeting": True,
    "ignore_button_press": False,
    
    # Continue through IVR prompts
    "voicemail": {
        "action": "ignore",  # Don't hang up on IVR detection
        "sensitive": True,
    },
    
    # Extended duration for hold queues
    "max_duration": 20,
}
```

**New Node 41: IVR Navigation**

Handles automated phone systems with:
- Menu navigation (speaking "One", "Two", "Zero")
- Hold queue patience
- Voicemail detection
- Human detection and routing

### Updated Call Command

```bash
python3 make_call_with_kb.py \
  --phone "+15551234567" \
  --pathway chiropractors \
  --practice-name "Clinique Santé" \
  --address "123 Rue Principale, Montreal" \
  --province "Quebec" \
  --clinic-email "info@cliniquesante.ca" \
  --languages "French,English" \
  --team-count 3
```

### Pathway Statistics (Post-Enhancement)

| Pathway | Nodes | Edges |
|---------|-------|-------|
| Chiropractors | 41 | 410 |
| Massage Therapists | 40 | 383 |
| Naturopaths | 41 | 440 |
| Integrative Medicine | 40 | 382 |
| Functional Medicine | 41 | 411 |
| Acupuncturists | 41 | 415 |

---

## 🗄️ Phase 7: Full Supabase Migration

### Overview

Migrated all practitioner data and call records to Supabase as the single source of truth, enabling real-time updates, better performance, and automatic call-to-practitioner linking.

### What Changed

| Before | After |
|--------|-------|
| Practitioners in JSON file | Practitioners in Supabase `practitioners` table |
| Call records in localStorage | Call records in Supabase with realtime subscriptions |
| Manual practitioner lookup | Automatic phone-based practitioner linking |
| Polling for updates | Real-time Supabase subscriptions |

### Migration Stats

| Metric | Count |
|--------|-------|
| Practitioners migrated | 12,492 |
| With enrichment data | 10,818 |
| With contact emails | 6,528 |
| With team members | 4,638 |
| Multilingual clinics | 1,739 |

### New Features

1. **Real-time Call Updates**: Call records update instantly across all clients
2. **Phone Lookup**: Webhook automatically finds practitioner by phone number
3. **Voicemail Status**: New `voicemail` status for call tracking
4. **Database-backed Filtering**: Server-side filtering for better performance

### Running the Migration

```bash
# 1. Run schema in Supabase SQL Editor
# (copy contents of supabase/practitioners_table.sql)

# 2. Run migration script
cd /Users/cbsuperpatch/Desktop/SalesEnablement
source .venv/bin/activate
python scripts/migrate_to_supabase.py
```

---

## 🇨🇦 Canadian Practitioner Data Collection

A Google Maps Places API scraper for collecting wellness practitioner leads across Canada.

### Market Size (Total Addressable Market)

| Practitioner Type | Est. Count | Key Provinces |
|-------------------|------------|---------------|
| **Massage Therapists** | 23,000+ | Ontario, BC |
| **Chiropractors** | ~9,000 | Ontario, Quebec, BC |
| **Acupuncturists** | ~4,000 | BC, Ontario, Quebec |
| **Integrative Medicine** | ~2,500 | Urban centers |
| **Functional Medicine** | ~1,500 | Toronto, Vancouver |
| **Naturopaths** | ~800 | BC, Ontario |
| **TOTAL** | **~40,800** | |

### Data Collected Per Practitioner

- Business name, address, phone number
- Website URL
- Google rating and review count
- Geographic coordinates (for map display)
- Business status (operational/closed)
- Direct Google Maps link

### Enrichment Data (from website scraping)

- Team members with credentials
- Services offered
- Contact emails
- Languages spoken
- Additional phone numbers

### Usage

```bash
# Run the scraper (full Canada ~$70)
python scripts/canadian_practitioner_scraper.py

# Run for specific provinces only (~$15-20)
python scripts/canadian_practitioner_scraper.py --provinces "Ontario" "British Columbia"

# Run enrichment
python scripts/enrich_practitioner_data.py \
  --input ../canadian_practitioners/all_practitioners_latest.json \
  --output ../canadian_practitioners/enriched_practitioners.json
```

---

## 🚀 How to Use

### Running the Call Center

```bash
cd superpatch-frontend
npm install
npm run dev
# Open http://localhost:3000/campaign
```

### Running the Voice Agent Dashboard

```bash
cd superpatch-frontend
npm run dev
# Open http://localhost:3000/voice-agent
```

### Command Line Interface

```bash
cd b2b_sales_enablement/bland_ai_pathways

# Make a call
python bland_cli.py call +1234567890 --pathway cf2233ef-7fb2-49ff-af29-0eee47204e9f

# Check call status
python bland_cli.py status <call_id>

# List recent calls
python bland_cli.py list
```

---

## 🔧 Technical Stack

### Frontend
- **Next.js 14** + TypeScript
- **Tailwind CSS** + shadcn/ui components
- **Framer Motion** for animations
- **Recharts** for data visualization
- **React Leaflet** for maps
- **@tanstack/react-virtual** for virtualized lists

### Backend
- **Next.js API Routes**
- **Supabase** (PostgreSQL) for database
- **Supabase Realtime** for live updates

### External Services
| Service | Purpose |
|---------|---------|
| **Google Gemini** | Video analysis and framework extraction |
| **Bland.ai** | Voice agent platform |
| **Cal.com** | Appointment scheduling |
| **Supabase** | Database and real-time subscriptions |
| **Google Maps API** | Practitioner data collection |
| **Firecrawl** | Website scraping for enrichment |

---

## 📈 Results & Metrics

### Content Generated

| Asset | Quantity |
|-------|----------|
| Videos Analyzed | 44 |
| Framework Extractions | 5,357 lines |
| Word Track Documents | 6 (1,500+ lines each) |
| Conversation Nodes | 244 (40-41 per pathway × 6) |
| Conversation Edges | 2,441 total (382-440 per pathway) |
| **Practitioners in Supabase** | **12,492** |
| **With Enrichment Data** | **10,818** |
| Unique Objection Responses | 54+ |
| Discovery Questions | 90+ |
| Languages Supported | 14 |
| **Enriched Emails** | **6,528** |
| **Multilingual Clinics** | **1,739** |

### Voice Agent Capabilities

- ✅ Natural conversation flow
- ✅ Practitioner-specific language
- ✅ Real-time objection handling
- ✅ Global routing - jump to any node instantly
- ✅ Return routing - flow back after handling objections
- ✅ Product routing - jump to specific product when asked
- ✅ Calendar integration (Cal.com)
- ✅ Knowledge base connected
- ✅ Transcripts and summaries saved to database
- ✅ **Multilingual support** (14 languages, French auto-detect for Quebec)
- ✅ **IVR navigation** (phone tree, hold queues, operator routing)
- ✅ **Voicemail handling** (leave message, auto-retry)
- ✅ **Pre-filled data** (email confirmation from enrichment)
- ✅ **Smart routing** (team_count → decision maker / Lunch & Learn)
- ✅ **Multi-practitioner handling** (Lunch & Learn offers for large practices)

### Call Center Capabilities

- ✅ 12,492 practitioners in Supabase database
- ✅ Interactive map visualization
- ✅ **Real-time call updates** via Supabase subscriptions
- ✅ Full analytics dashboard
- ✅ Notes per practitioner
- ✅ Enrichment data display (JSONB)
- ✅ **Server-side filtering** (database queries)
- ✅ Virtualized lists for performance
- ✅ **Automatic phone-based practitioner linking**
- ✅ **Voicemail status tracking**
- ✅ **Call data columns** (Last Called, Duration, VM indicator, Appointment, Summary)
- ✅ **Cal.com booking with notes** (practice info + call summary in description)

---

## 🔮 Future Enhancements

### Completed ✅
- [x] Voice Agent Dashboard with call management
- [x] Webhook-based Cal.com booking integration
- [x] CLI tool for Bland.ai API interactions
- [x] Global routing (any node → any node)
- [x] Knowledge base integration
- [x] Canadian practitioner data collection tool
- [x] **Call Center Dashboard with 12K+ practitioners**
- [x] **Interactive map with clustering**
- [x] **Real-time analytics dashboard**
- [x] **Supabase database integration**
- [x] **Call timeline view**
- [x] **Data enrichment pipeline**
- [x] **Notes system per practitioner**
- [x] **Multilingual support** (14 languages, Quebec French auto-detect)
- [x] **IVR navigation** (phone tree, hold queue, operator routing)
- [x] **Voicemail handling** (leave message, auto-retry after 60 min)
- [x] **Pre-filled email confirmation** (from enrichment data)
- [x] **Multi-practitioner handling** (Lunch & Learn for large practices)
- [x] **Smart routing** (team_count-based decision maker routing)
- [x] **Full Supabase Migration** (practitioners + call records in DB)
- [x] **Real-time subscriptions** (instant call status updates)
- [x] **Phone-based practitioner linking** (webhook auto-links calls)
- [x] **Voicemail status tracking** (new status in call records)
- [x] **Call data columns** (Last Called, Duration, VM, Appointment, Summary)
- [x] **Cal.com booking notes** (practice info + call summary in description field)
- [x] **Improved webhook reliability** (call_id upsert strategy)
- [x] **Compact table typography** (Inter font, optimized row height)

### Planned
- [ ] Add more practitioner types (Physical Therapists, Athletic Trainers)
- [ ] SMS follow-up sequences
- [ ] CRM integration (HubSpot, Salesforce)
- [ ] A/B test different opening scripts
- [ ] Real-time call monitoring (live transcription)
- [ ] Automated follow-up email sequences
- [ ] Call outcome tracking and conversion metrics
- [ ] Warm transfer to human agents
- [ ] Call recording playback in dashboard
- [ ] Sentiment analysis on transcripts

---

## 📄 License

Proprietary - SuperPatch AI

---

## 👥 Contributors

Built with AI assistance for SuperPatch sales enablement.

---

*Last Updated: January 13, 2026 (Call Data Columns + Cal.com Notes)*

