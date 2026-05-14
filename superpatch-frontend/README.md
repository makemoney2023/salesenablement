# SuperPatch Sales Enablement App

A comprehensive sales enablement platform for SuperPatch, featuring an AI-powered call center, word tracks, clinical evidence, and training materials.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** shadcn/ui + Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **AI Voice:** Bland.ai
- **Scheduling:** Cal.com
- **Deployment:** Vercel

## Features

### Sales Reference App
- Product word tracks for D2C, B2B, and Canadian markets
- Clinical evidence hub with study summaries
- Roadmap gallery with zoomable images
- Practice mode for objection handling
- Favorites and bookmarks

### AI Call Center
- Campaign dialer with batch calling
- AI-powered conversations via Bland.ai pathways
- Real-time sentiment analysis and lead scoring
- Call recording playback
- Do Not Call (DNC) management with AI detection
- Sample request tracking
- **Post-call LLM analysis** (Gemini-powered):
  - Structured data extraction (objections, buying signals, pain points)
  - Enhanced lead scoring with reasoning
  - Pathway improvement suggestions for AI optimization
  - Auto-generated follow-up email drafts

### Practitioner Management
- Canadian healthcare practitioner database
- User-added practitioners with tracking
- Enrichment data from website scraping
- Advanced filtering and sorting

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Bland.ai API key
- Cal.com account (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/SuperPatchAi/SalesEnablement.git
cd SalesEnablement/superpatch-frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Bland.ai
BLAND_API_KEY=your_bland_api_key
NEXT_PUBLIC_BLAND_MEMORY_ID=your_memory_store_id
BLAND_MEMORY_ID=your_memory_store_id
NEXT_PUBLIC_BLAND_WEBHOOK_URL=https://your-project-id.supabase.co/functions/v1/webhook-processor

# Cal.com (optional)
CAL_API_KEY=your_cal_api_key
CAL_EVENT_TYPE_ID=your_event_type_id

# Practitioner Search (optional - for Search New tab)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
FIRECRAWL_API_KEY=your_firecrawl_api_key
```

### Supabase Edge Function Secrets

These secrets must be set in the Supabase Dashboard (Project Settings → Edge Functions → Secrets):

```env
# LLM Analysis (required for post-call analysis)
GEMINI_API_KEY=your_google_gemini_api_key
```

### Bland.ai Dashboard Configuration

Configure the webhook URL in the Bland.ai dashboard to point to the Supabase Edge Function:

```
https://your-project-id.supabase.co/functions/v1/webhook-processor
```

This ensures call completion webhooks are processed directly by Supabase for reliable database updates.

## API Endpoints

All endpoints return `{ status: "success", data: ... }` or `{ status: "error", message: string }` per `.cursor/rules/response-shape-contract.mdc`.

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/invite` | Send a team-member invite email |
| POST | `/api/auth/signout` | Invalidate the current Supabase session |

### Practitioners
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/practitioners` | List practitioners with filters (type, city, do_not_call, retry window) |
| POST | `/api/practitioners` | Create a user-added practitioner |
| PATCH | `/api/practitioners/[id]/dnc` | Mark / restore do-not-call status |

### Campaign & Calls
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET / PATCH | `/api/campaign/calls` | Call record CRUD (list, update disposition, attach notes) |
| GET / POST | `/api/campaign/notes` | Operator notes on call records |
| POST | `/api/bland/calls` | Initiate a single Bland.ai call (resolves pathway from practitioner_type) |
| GET | `/api/bland/calls/[id]` | Fetch call status / transcript / recording URL |
| POST/GET | `/api/webhooks/bland` | Retired 2026-05-12 — responds with HTTP 410 and `{ deprecated: true, replacement: "/functions/v1/webhook-processor" }`. Canonical handler is the Supabase Edge Function `webhook-processor`. |

### Practitioner Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/search/places` | Google Maps Places search with practitioner-type filters |
| POST | `/api/search/import` | Bulk import searched practitioners into Supabase |
| POST | `/api/search/enrich` | Trigger Firecrawl + LinkedIn enrichment for selected practitioners |

### Samples & Memory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET / PATCH | `/api/samples` | Sample request queue and fulfillment status |
| GET / POST | `/api/memory` | Bland.ai shared memory store management |

### Pathway suggestions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pathway-suggestions/export` | Export AI-suggested pathway improvements from call analysis |

### Debug
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/debug-env` | Non-secret environment visibility (behind auth in production) |

## Supabase Edge Functions

These live in `supabase/functions/` and are deployed via `supabase functions deploy <name>` from this folder. Per-function deploy flags (e.g. `verify_jwt`) are pinned in `supabase/config.toml` so the same policy applies whether the deploy is run from a workstation or from CI. Public, third-party-driven functions MUST keep `verify_jwt = false` in `config.toml` and rely on in-code authentication (HMAC, payload validation) — without that, the Supabase API gateway rejects every anonymous POST with `sb-error-code: UNAUTHORIZED_NO_AUTH_HEADER` before the function body runs.

| Function | Trigger | `verify_jwt` | Purpose |
|----------|---------|--------------|---------|
| `webhook-processor` | Bland.ai webhook POST | **false** (HMAC via `BLAND_WEBHOOK_SECRET` + `x-webhook-signature`) | Canonical receiver for call completions; writes `call_records`, creates `sample_requests`, invokes `book-appointment`. |
| `process-retry-queue` | pg_cron | true (server-to-server with service-role) | Business-hours retry dialer; resolves pathway via `_shared/pathways.ts`. |
| `book-appointment` | Invoked by `webhook-processor` | true (server-to-server) | Creates Cal.com v2 booking and fills `call_records.booking_id`. |
| `send-sample-confirmation` | Invoked by `webhook-processor` | true (server-to-server) | Sends Resend confirmation email and stamps `sample_requests.email_sent_at`. |
| `sync-cal-bookings` | pg_cron | true | Backfills bookings created on Cal.com but missing from `call_records`. |
| `enrich-practitioners-v2` | Manual / API | true | Runs Firecrawl + LinkedIn enrichment for selected practitioners. |
| `analyze-call` | Invoked post-call | true | Runs Gemini analysis on transcripts; writes to `call_records.analysis_json`. |
| `generate-daily-report` | pg_cron | true | Produces the EOD report served at `/reports`. |

## Project Structure

```
superpatch-frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/                # API routes
│   │   ├── campaign/           # Call center page
│   │   ├── [market]/           # Market-specific pages
│   │   └── ...
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── campaign/           # Call center components
│   │   └── ...
│   ├── hooks/                  # Custom React hooks
│   └── lib/                    # Utilities and helpers
├── docs/                       # Documentation
├── public/                     # Static assets
└── supabase/                   # Database migrations
```

## Documentation

- [Architecture (repo root)](../ARCHITECTURE.md) — End-to-end system flow
- [Lead Pipeline](docs/LEAD_PIPELINE.md) — Ingestion, enrichment, and import
- [Call Center](docs/CALL_CENTER.md) — `/campaign` dialer, qualification, call lifecycle
- [Pathway Variables](docs/PATHWAY_VARIABLES.md) — `extractVars` reference
- [Data Structure](docs/DATA_STRUCTURE.md) — Type definitions and schemas
- [Component Library](docs/COMPONENT_LIBRARY.md) — UI component reference
- [Feature Scope](docs/FEATURE_SCOPE.md) — Historical feature specifications
- [Frontend Changelog](docs/CHANGELOG.md) — Frontend app deltas
- [Backend Changelog (repo root)](../docs/dev/changelog.md) — Backend / system deltas
- [Bland Pathways README](../b2b_sales_enablement/bland_ai_pathways/README.md) — Pathway authoring and deploy

## Deployment

The app is deployed on Vercel with automatic deployments from the main branch.

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Supabase Documentation](https://supabase.com/docs)
- [Bland.ai API Reference](https://docs.bland.ai)

## License

Proprietary - SuperPatch AI
