# SuperPatch Sales Enablement App - Feature Scope

> **Status (2026-04-21): Historical.** This scope was written for the original reference-app phase. The app has since grown into a full AI call center. For current architecture, start with `../../ARCHITECTURE.md`. For current surfaces and APIs, see the main [README](../README.md). Preserved here for historical context.

## Overview

**Purpose:** Internal sales team reference app for accessing word tracks, roadmaps, and clinical evidence
**Users:** SuperPatch internal sales team
**Deployment:** Vercel (public, no auth initially)
**Tech Stack:** Next.js 15 (App Router) + shadcn/ui v4 + Tailwind CSS + PWA

---

## 🎨 Design System

### Brand Colors (from brand_styling_reference_config.json)
```css
/* Primary */
--primary: #DD0604           /* SuperPatch Red */
--primary-bright: #F32735    /* Red Bright */

/* Neutrals */
--grey-900: #101010          /* Headlines, Primary Buttons */
--grey-700: #4D4D4D          /* Body Text, Input Borders */
--grey-500: #888888          /* Placeholders */
--grey-300: #C8C8C8          /* Labels (light) */
--grey-100: #DCDCDC          /* Backgrounds (light) */
--grey-25: #F7F7F7           /* Very light backgrounds */
--white: #FFFFFF             /* Backgrounds, Text on Dark */

/* Product Palette */
--teal: #66C9BA              /* 570 c */
--purple: #652F6C            /* 520 c */
--cyan: #009ADE              /* 2925 c */
--blue-dark: #0055B8         /* 2935 c */
--yellow-gold: #FFC629       /* 123 c */
--orange: #FFA400            /* 137 c */
```

### Typography
- **Font Family:** Montserrat (web), Avenir Next (print)
- **Fallbacks:** Helvetica, Arial, sans-serif
- **Weights:**
  - Headlines: 900 (Black) - UPPERCASE
  - Buttons/Subtitles: 700 (Bold) - UPPERCASE
  - Body: 500 (Medium) - Sentence case
- **Code/Scripts:** JetBrains Mono (for copy-friendly text)

### Button Style
- **Shape:** Pill (fully rounded corners)
- **Primary:** Dark bg (#101010), White text
- **Secondary:** White bg, Dark text, Grey stroke
- **Animation:** Fill left-to-right on hover (300ms ease-out)

---

## 📱 Page Structure

### 1. Landing/Home Page (`/`)
**Purpose:** Quick navigation hub with search

**Components Used:**
- `Command` - Global search (⌘K)
- `Card` - Market selector cards (D2C, B2B, Canadian)
- `Badge` - Product category tags
- `Button` - Quick access buttons

**Features:**
- [ ] Market selector (D2C / B2B Practitioners / Canadian Business)
- [ ] Quick access buttons for common sections
- [ ] Global search trigger
- [ ] Recently viewed (localStorage)

---

### 2. Products Index (`/[market]/products`)
**Purpose:** Browse all products for selected market

**Components Used:**
- `Card` - Product cards with emoji/icon
- `Badge` - Category badges (Pain, Sleep, Energy, etc.)
- `Input` - Filter/search
- `Tabs` - Category filter tabs

**Features:**
- [ ] Product grid with cards
- [ ] Category filter (tabs or pills)
- [ ] Search/filter input
- [ ] Clinical evidence badge for products with studies

---

### 3. Product Detail (`/[market]/products/[product]`)
**Purpose:** Full word track for a product

**Components Used:**
- `Tabs` - Section navigation
- `Accordion` - Expandable sections
- `Card` - Script cards with copy button
- `Button` - Copy to clipboard
- `Badge` - Section labels
- `Breadcrumb` - Navigation path
- `Tooltip` - Help text

**Sections (as tabs or accordion):**
1. **Overview** - Product summary, mechanism, differentiators
2. **Practitioner Profile** - Target practitioners, pain points
3. **Opening Scripts** - 5 scenario scripts
4. **Discovery Questions** - Categorized questions
5. **Presentation** - 2-minute P-A-S-E script
6. **Objections** - 8 objections with responses
7. **Closing** - 5 closing techniques
8. **Follow-Up** - Day 1, 3-4, 7, 14 sequences
9. **Testimonials** - Prompts for collecting
10. **Quick Reference** - Cheat sheet card

**Features:**
- [ ] Tab/section navigation
- [ ] Copy individual scripts to clipboard
- [ ] Copy entire section
- [ ] Expandable/collapsible sections
- [ ] Link to roadmap image

---

### 4. Roadmaps Gallery (`/[market]/roadmaps`)
**Purpose:** View sales roadmap infographics

**Components Used:**
- `Card` - Roadmap thumbnails
- `Dialog` - Full-screen roadmap viewer
- `Button` - Download/share

**Features:**
- [ ] Thumbnail grid
- [ ] Click to view full-size in modal
- [ ] Pinch-to-zoom on mobile
- [ ] Download button

---

### 5. Clinical Evidence Hub (`/evidence`)
**Purpose:** Quick access to study stats and talking points

**Components Used:**
- `Card` - Study summary cards
- `Table` - Results data
- `Accordion` - Study details
- `Badge` - Product tags

**Studies to feature:**
- RESTORE (Freedom/Pain)
- HARMONI (REM/Sleep)
- Balance Study (Liberty)

**Features:**
- [ ] Study summary cards
- [ ] Key stats for each study
- [ ] Practitioner talking points
- [ ] Link to relevant product pages

---

### 6. Practice Mode (`/practice`)
**Purpose:** Flashcard-style learning for objection handling

**Components Used:**
- `Card` - Flashcard container
- `Button` - Flip/Next/Previous
- `Progress` - Session progress
- `Badge` - Difficulty/category

**Features:**
- [ ] Flashcard flip interaction
- [ ] Show objection → reveal response
- [ ] Random order option
- [ ] Filter by product or category
- [ ] Progress tracking (localStorage)

---

### 7. Favorites/Bookmarks (`/favorites`)
**Purpose:** Quick access to saved scripts

**Components Used:**
- `Card` - Saved item cards
- `Button` - Remove from favorites
- `Empty` - Empty state

**Features:**
- [ ] List of bookmarked scripts
- [ ] Remove from favorites
- [ ] Persist in localStorage

---

## 📱 Mobile-Specific Features

### Bottom Navigation (Mobile Only)
Fixed bottom nav bar with 5 items:
1. **Home** - Landing page
2. **Products** - Product grid
3. **Search** - Opens search palette
4. **Practice** - Flashcard mode
5. **Favorites** - Saved items

### Sharing & Deep Links
- **Share Script:** Native share API (text/email)
- **Deep Links:** `/b2b/products/freedom#objections` links directly to section
- **Copy Link:** Copy shareable URL to specific content

### Personal Notes
- Add personal notes to any script/objection
- LocalStorage persistence
- Quick access from content cards

---

## 🧩 Custom Component Library

### Core Components (shadcn base)
| Component | shadcn Base | Purpose |
|-----------|-------------|---------|
| `Sidebar` | sidebar | Main navigation |
| `Command` | command | Global search (⌘K) |
| `Accordion` | accordion | Collapsible sections |
| `Tabs` | tabs | Section navigation |
| `Card` | card | Content containers |
| `Badge` | badge | Category/status tags |
| `Button` | button | Actions |
| `Tooltip` | tooltip | Help text |
| `Dialog` | dialog | Modals/overlays |
| `Breadcrumb` | breadcrumb | Navigation path |
| `ScrollArea` | scroll-area | Scrollable content |
| `Sonner` | sonner | Toast notifications |

### Custom Components (to build)
| Component | Description | Based On |
|-----------|-------------|----------|
| `ScriptCard` | Copyable script with header | Card |
| `ObjectionCard` | Objection + Response flipper | Card |
| `ProductCard` | Product thumbnail with badge | Card |
| `RoadmapViewer` | Zoomable image modal | Dialog |
| `MarketSwitcher` | D2C/B2B/Canadian switcher | Tabs |
| `CopyButton` | Copy to clipboard with toast | Button |
| `FavoriteButton` | Add/remove favorite | Button |
| `Flashcard` | Flip card for practice | Card |
| `QuickRefCard` | Cheat sheet display | Card |
| `SearchPalette` | Global search overlay | Command |
| `BottomNav` | Mobile navigation bar | Custom |
| `ShareButton` | Native share API trigger | Button |
| `NotesPopover` | Personal notes editor | Popover |
| `DeepLink` | Shareable URL generator | Utility |

---

## 🗂 Data Structure

### Content Types
```typescript
interface Product {
  id: string
  name: string
  tagline: string
  category: 'pain' | 'sleep' | 'energy' | 'balance' | 'focus' | 'mood' | 'immunity' | 'metabolism' | 'habits' | 'stress' | 'beauty' | 'mens' | 'performance'
  emoji: string
  hasClinicalStudy: boolean
  studyName?: string
}

interface Market {
  id: 'd2c' | 'b2b' | 'canadian'
  name: string
  description: string
}

interface WordTrackSection {
  id: string
  title: string
  content: string // Markdown
  copyable: boolean
}

interface Objection {
  id: string
  objection: string
  response: string
  psychology: string
  productId: string
}

interface Script {
  id: string
  title: string
  scenario: string
  content: string
  productId: string
  section: 'opening' | 'closing' | 'followup'
}
```

### File Structure
```
superpatch-frontend/
├── app/
│   ├── layout.tsx           # Root layout with sidebar
│   ├── page.tsx             # Landing page
│   ├── [market]/
│   │   ├── page.tsx         # Market landing
│   │   ├── products/
│   │   │   ├── page.tsx     # Products grid
│   │   │   └── [product]/
│   │   │       └── page.tsx # Product detail
│   │   └── roadmaps/
│   │       └── page.tsx     # Roadmap gallery
│   ├── evidence/
│   │   └── page.tsx         # Clinical evidence hub
│   ├── practice/
│   │   └── page.tsx         # Flashcard practice
│   └── favorites/
│       └── page.tsx         # Saved items
├── components/
│   ├── ui/                  # shadcn components
│   ├── layout/
│   │   ├── app-sidebar.tsx
│   │   ├── market-switcher.tsx
│   │   └── search-palette.tsx
│   ├── products/
│   │   ├── product-card.tsx
│   │   ├── product-grid.tsx
│   │   └── category-filter.tsx
│   ├── wordtrack/
│   │   ├── script-card.tsx
│   │   ├── objection-card.tsx
│   │   ├── section-tabs.tsx
│   │   └── quick-ref-card.tsx
│   ├── roadmaps/
│   │   ├── roadmap-gallery.tsx
│   │   └── roadmap-viewer.tsx
│   ├── evidence/
│   │   ├── study-card.tsx
│   │   └── stats-table.tsx
│   └── practice/
│       └── flashcard.tsx
├── content/                 # Markdown content (copied from SalesEnablement)
│   ├── d2c/
│   ├── b2b/
│   └── canadian/
├── lib/
│   ├── utils.ts
│   ├── content.ts           # Content loading utilities
│   └── favorites.ts         # localStorage helpers
└── public/
    ├── roadmaps/            # Roadmap images
    └── manifest.json        # PWA manifest
```

---

## 🔧 Features Implementation Plan

### Phase 1: Foundation (MVP)
- [ ] Next.js 15 project setup
- [ ] shadcn/ui installation and configuration
- [ ] Sidebar layout with navigation
- [ ] Market switcher (D2C/B2B/Canadian)
- [ ] Basic routing structure
- [ ] Import existing markdown content

### Phase 2: Core Features
- [ ] Products index page with cards
- [ ] Product detail page with tabs
- [ ] Script cards with copy functionality
- [ ] Accordion sections for word track
- [ ] Toast notifications for copy success

### Phase 3: Search & Navigation
- [ ] Global search (⌘K) with Command
- [ ] Search across all content
- [ ] Breadcrumb navigation
- [ ] Recently viewed (localStorage)

### Phase 4: Roadmaps & Evidence
- [ ] Roadmap gallery page
- [ ] Full-screen roadmap viewer
- [ ] Clinical evidence hub
- [ ] Study stats cards

### Phase 5: Practice & Favorites
- [ ] Flashcard practice mode
- [ ] Favorites/bookmarks
- [ ] LocalStorage persistence

### Phase 6: PWA & Polish
- [ ] PWA manifest
- [ ] Offline support (service worker)
- [ ] Mobile optimization
- [ ] Dark mode toggle
- [ ] Loading states & skeletons

---

## 📱 Mobile Considerations

- **Touch targets:** Minimum 44x44px
- **Copy button:** Large, accessible
- **Swipe navigation:** Between sections
- **Bottom nav:** Quick access on mobile
- **Font sizes:** Readable on small screens
- **Offline:** PWA with cached content

---

## 🚀 Deployment

### Vercel Configuration
- **Framework:** Next.js 15
- **Build command:** `npm run build`
- **Output:** `.next`
- **Environment:** Production

### Domain Options
- `sales.superpatch.com` (custom)
- `superpatch-sales.vercel.app` (default)

---

## 📊 Success Metrics

- [ ] Page load < 2s
- [ ] Time to first content < 1s
- [ ] Works offline (PWA)
- [ ] Copy-to-clipboard success rate
- [ ] Mobile usability score > 90

---

## 📞 Call Center / Campaign Dialer

### Overview
AI-powered voice agent call center for outbound B2B practitioner outreach, integrated with Bland.ai for automated calling.

### Core Features

**Practitioner Management**
- [x] Database of Canadian healthcare practitioners (chiropractors, naturopaths, massage therapists, etc.)
- [x] User-added practitioners via Quick Call with "User Added" badge
- [x] Enrichment data from website scraping (team members, emails, services)
- [x] Filtering by province, city, type, rating, enrichment status
- [x] Sortable columns with column visibility controls
- [x] Virtual scrolling for large datasets

**Campaign Dialer**
- [x] Batch calling with queue management
- [x] Pathway-based AI conversations (per practitioner type)
- [x] Real-time call status tracking
- [x] Sentiment analysis and lead scoring
- [x] Call recording playback
- [x] Bland.ai Memory for cross-call context

**Quick Call**
- [x] Manual phone entry with practitioner details
- [x] Automatic practitioner creation on successful call
- [x] Pathway selection for conversation context

**Sample Request Tracking**
- [x] Automatic detection from call transcripts
- [x] Product-specific or sample kit requests
- [x] Status workflow (pending → approved → shipped → delivered)
- [x] CSV export functionality

### Do Not Call (DNC) System

**Automatic Detection**
- AI analysis of call transcripts for DNC phrases:
  - "don't call", "do not call", "stop calling"
  - "remove me", "take me off", "not interested"
  - "never call again", "unsubscribe"
- Auto-flags practitioners when detected
- Stores detection source and matched phrase

**Manual Management**
- Mark practitioner as DNC from drawer actions
- Requires reason input for audit trail
- 2-step confirmation for accidental prevention

**Restore Process**
- 2-step confirmation: Click → Confirm with consent checkbox
- Clears DNC flag and restores to active list
- Audit trail maintained

**Filtering**
- Hide DNC practitioners by default
- Filter option to show DNC only for management
- Visual badges and row styling for DNC practitioners

### Practitioner Detail Drawer

**Redesigned UI**
- Sticky header with avatar, badges, and lead score
- Tabbed navigation: Overview, History, Notes
- Call timeline with expandable transcripts
- Audio player for call recordings
- Google Maps integration for addresses

**Actions Menu**
- Add to Queue
- Copy Phone / Copy Address
- Edit Practitioner
- Export to CSV
- Send Email
- Mark as Do Not Call
- Delete Practitioner

### Bland.ai Integration

**Webhooks**
- Call completion webhook for status updates
- Transcript and summary extraction
- Sentiment analysis integration
- Sample request detection
- DNC phrase detection

**Memory System**
- Cross-call context retention
- Practitioner history awareness
- Conversation continuity

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/practitioners` | GET | List practitioners with filters |
| `/api/practitioners` | POST | Create user-added practitioner |
| `/api/practitioners/[id]/dnc` | PATCH | Mark/restore DNC status |
| `/api/campaign/calls` | GET/PATCH | Call record management |
| `/api/bland/calls` | POST | Initiate call via Bland.ai |
| `/api/bland/calls/[id]` | GET | Get call status |
| `/api/webhooks/bland` | POST/GET | Retired 2026-05-12 — returns HTTP 410. Canonical webhook is `/functions/v1/webhook-processor`. |
| `/api/samples` | GET/PATCH | Sample request management |
| `/api/memory` | GET/POST | Bland.ai memory management |

---

## Next Steps

1. **Review this scope** - Confirm features and priorities
2. **Create Next.js project** - In `superpatch-frontend/`
3. **Install shadcn/ui** - Configure with brand colors
4. **Build component library** - Starting with core components
5. **Import content** - Convert markdown to structured data
6. **Build pages** - Following the phase plan
7. **Deploy to Vercel** - With preview deployments

Ready to proceed?

