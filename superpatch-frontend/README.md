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

## API Endpoints

### Practitioners
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/practitioners` | List practitioners with filters |
| POST | `/api/practitioners` | Create user-added practitioner |
| PATCH | `/api/practitioners/[id]/dnc` | Mark/restore DNC status |

### Campaign & Calls
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PATCH | `/api/campaign/calls` | Call record management |
| POST | `/api/bland/calls` | Initiate call via Bland.ai |
| GET | `/api/bland/calls/[id]` | Get call status/details |
| POST | `/api/webhooks/bland` | Webhook for call completion |

### Practitioner Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/search/places` | Search Google Maps for practitioners |
| POST | `/api/search/import` | Bulk import practitioners to database |
| POST | `/api/search/enrich` | Enrich practitioner with Firecrawl |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PATCH | `/api/samples` | Sample request management |
| GET/POST | `/api/memory` | Bland.ai memory management |

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

- [Feature Scope](docs/FEATURE_SCOPE.md) - Detailed feature specifications
- [Data Structure](docs/DATA_STRUCTURE.md) - Type definitions and schemas
- [Call Center](docs/CALL_CENTER.md) - Campaign dialer documentation
- [Component Library](docs/COMPONENT_LIBRARY.md) - UI component reference

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
