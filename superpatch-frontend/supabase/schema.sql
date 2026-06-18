-- Supabase Database Schema for Sales Enablement
-- Run this in the Supabase SQL Editor to set up the database

-- 1. Call Records (main table)
CREATE TABLE IF NOT EXISTS call_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  practitioner_id TEXT NOT NULL,
  practitioner_name TEXT NOT NULL,
  practitioner_type TEXT,
  phone TEXT NOT NULL,
  address TEXT,
  city TEXT,
  province TEXT,
  
  -- Bland.ai call data
  call_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'not_called',
  call_started_at TIMESTAMPTZ,
  call_ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  -- Conversation data
  transcript TEXT,
  summary TEXT,
  
  -- Appointment data
  appointment_booked BOOLEAN DEFAULT FALSE,
  appointment_time TIMESTAMPTZ,
  calendar_invite_sent BOOLEAN DEFAULT FALSE,
  practitioner_email TEXT,
  booking_id TEXT,
  
  -- User notes (simple field for single note)
  notes TEXT,

  -- Webhook idempotency marker. Set by webhook-processor immediately before
  -- returning a successful 2xx so duplicate Bland.ai redeliveries short-circuit
  -- without re-firing side effects (sample emails, Cal.com bookings, retries).
  -- See migration 20260514_add_call_records_processed_at.sql.
  processed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Call Notes (separate table for multiple notes per call)
CREATE TABLE IF NOT EXISTS call_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_record_id UUID REFERENCES call_records(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by TEXT, -- For future multi-user support
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Campaign Analytics (aggregated daily stats)
CREATE TABLE IF NOT EXISTS campaign_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_calls INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  booked INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_records_practitioner_id ON call_records(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_call_records_call_id ON call_records(call_id);
CREATE INDEX IF NOT EXISTS idx_call_records_status ON call_records(status);
CREATE INDEX IF NOT EXISTS idx_call_records_created_at ON call_records(created_at);
CREATE INDEX IF NOT EXISTS call_records_processed_at_idx ON call_records (processed_at) WHERE processed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_notes_call_record_id ON call_notes(call_record_id);

-- Enable Row Level Security (for future auth)
ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_analytics ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (no auth yet)
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations on call_records" ON call_records;
DROP POLICY IF EXISTS "Allow all operations on call_notes" ON call_notes;
DROP POLICY IF EXISTS "Allow all operations on campaign_analytics" ON campaign_analytics;

CREATE POLICY "Allow all operations on call_records" ON call_records FOR ALL USING (true);
CREATE POLICY "Allow all operations on call_notes" ON call_notes FOR ALL USING (true);
CREATE POLICY "Allow all operations on campaign_analytics" ON campaign_analytics FOR ALL USING (true);

-- Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS call_records_updated_at ON call_records;
CREATE TRIGGER call_records_updated_at
  BEFORE UPDATE ON call_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable realtime for call_records table
ALTER PUBLICATION supabase_realtime ADD TABLE call_records;

-- ============================================
-- 4. Practitioners Table (main practitioner data)
-- ============================================
CREATE TABLE IF NOT EXISTS practitioners (
  id TEXT PRIMARY KEY,  -- Use existing ID from JSON data
  name TEXT NOT NULL,
  practitioner_type TEXT NOT NULL,
  address TEXT,
  city TEXT,
  province TEXT,
  phone TEXT,
  -- Generated last-10-digit phone for DB-side normalized lookup (webhook-processor)
  phone_normalized TEXT GENERATED ALWAYS AS (
    RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '\D', '', 'g'), 10)
  ) STORED,
  website TEXT,
  rating DECIMAL(2,1),
  review_count INTEGER,
  business_status TEXT,
  google_maps_uri TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  scraped_at TIMESTAMPTZ,
  notes TEXT,
  
  -- Enrichment data (JSONB for flexibility)
  -- Contains: practitioners, services, emails, languages, etc.
  enrichment JSONB,
  enrichment_status TEXT DEFAULT 'pending', -- pending, success, failed, skipped
  enriched_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common practitioner queries
CREATE INDEX IF NOT EXISTS idx_practitioners_province ON practitioners(province);
CREATE INDEX IF NOT EXISTS idx_practitioners_city ON practitioners(city);
CREATE INDEX IF NOT EXISTS idx_practitioners_type ON practitioners(practitioner_type);
CREATE INDEX IF NOT EXISTS idx_practitioners_phone ON practitioners(phone);
CREATE INDEX IF NOT EXISTS idx_practitioners_phone_normalized ON practitioners(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_practitioners_rating ON practitioners(rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_practitioners_enrichment_status ON practitioners(enrichment_status);

-- Full-text search index for name and address
CREATE INDEX IF NOT EXISTS idx_practitioners_name_trgm ON practitioners USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_practitioners_address_trgm ON practitioners USING gin(address gin_trgm_ops);

-- Enable trigram extension for fuzzy search (run once)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable Row Level Security
ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth yet)
DROP POLICY IF EXISTS "Allow all operations on practitioners" ON practitioners;
CREATE POLICY "Allow all operations on practitioners" ON practitioners FOR ALL USING (true);

-- Auto-update updated_at trigger for practitioners
DROP TRIGGER IF EXISTS practitioners_updated_at ON practitioners;
CREATE TRIGGER practitioners_updated_at
  BEFORE UPDATE ON practitioners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Call records can exist without a practitioner
-- ============================================
-- Note: practitioner_id can be:
-- 1. A valid practitioners.id (for known practitioners)
-- 2. NULL (for unknown callers - data still tracked from call)
-- We DO NOT use a foreign key to allow tracking calls to unknown numbers

-- Remove FK constraint if it exists (we want to allow unknown callers)
ALTER TABLE call_records DROP CONSTRAINT IF EXISTS fk_practitioner;

-- Make practitioner_id nullable for unknown callers
ALTER TABLE call_records ALTER COLUMN practitioner_id DROP NOT NULL;

-- ============================================
-- call_records analysis / scoring columns
-- ============================================
-- These columns were originally added directly in the Supabase dashboard
-- (no tracked CREATE/ALTER migration). They are mirrored in
-- src/lib/db/types.ts (the canonical DB types mirror) and consumed by
-- analyze-call / generate-daily-report / the campaign UI. Reflected here so
-- the snapshot matches the live table.
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2);
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS sentiment_label TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS lead_score INTEGER NOT NULL DEFAULT 0;
-- Gemini transcript analysis (see analyze-call Edge Function)
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS llm_analysis JSONB;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS llm_lead_score INTEGER;
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS llm_analyzed_at TIMESTAMPTZ;
-- pending | processing | completed | failed
ALTER TABLE call_records ADD COLUMN IF NOT EXISTS analysis_status TEXT;

-- ============================================
-- 5. Sample Requests
-- ============================================
-- NOTE: The base sample_requests / appointments / follow_up_queue /
-- pathway_suggestions tables were created directly in the Supabase dashboard
-- before the tracked migrations folder existed, so there is no CREATE TABLE
-- migration for them. The column lists below are reconstructed from the
-- canonical DB types mirror (src/lib/db/types.ts) and the constraints / RLS /
-- indexes are copied from the applied migrations:
--   20260116_sample_confirmation_tracking.sql (confirmation_sent[_at])
--   20260207_add_rls_sample_requests_appointments.sql (RLS for all four)
--   20260206_add_unique_appointment_constraint.sql (appointments unique)
--   20260605000002_sample_requests_dedup.sql (uq_sample_requests_call_record_id)
-- migrations/ + types.ts remain the source of truth.
CREATE TABLE IF NOT EXISTS sample_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_record_id UUID REFERENCES call_records(id) ON DELETE SET NULL,
  practitioner_id TEXT,
  requester_name TEXT NOT NULL,
  practice_name TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_province TEXT,
  shipping_postal_code TEXT,
  sample_type TEXT,
  products_requested TEXT[],
  quantity INTEGER DEFAULT 1,
  notes TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, shipped, delivered, cancelled
  tracking_number TEXT,
  shipped_at TIMESTAMPTZ,
  confirmation_sent BOOLEAN DEFAULT FALSE,
  confirmation_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One sample per call record (unknown-caller samples with NULL call_record_id
-- are exempt). Source: 20260605000002_sample_requests_dedup.sql.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sample_requests_call_record_id
  ON sample_requests (call_record_id)
  WHERE call_record_id IS NOT NULL;

ALTER TABLE sample_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. Appointments
-- ============================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  practitioner_id TEXT,
  call_record_id UUID REFERENCES call_records(id) ON DELETE SET NULL,
  type TEXT DEFAULT 'demo', -- demo, follow_up, in_person, other
  title TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  status TEXT DEFAULT 'scheduled', -- scheduled, confirmed, completed, cancelled, no_show, rescheduled
  cal_booking_id TEXT,
  cal_booking_uid TEXT,
  calendar_invite_sent BOOLEAN DEFAULT FALSE,
  attendee_name TEXT,
  attendee_email TEXT,
  attendee_phone TEXT,
  location_type TEXT, -- in_person, phone, video
  location_address TEXT,
  notes TEXT,
  products_interested TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  -- One appointment per call record. Source: 20260206_add_unique_appointment_constraint.sql
  CONSTRAINT unique_appointment_call_record UNIQUE (call_record_id)
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. Follow-up Queue (LLM-drafted follow-up content awaiting send)
-- ============================================
CREATE TABLE IF NOT EXISTS follow_up_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_record_id UUID REFERENCES call_records(id) ON DELETE SET NULL,
  practitioner_id TEXT,
  type TEXT NOT NULL, -- email, sms, callback_notes
  subject TEXT,
  content TEXT NOT NULL,
  context_data JSONB,
  status TEXT DEFAULT 'draft', -- draft, approved, sent, failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE follow_up_queue ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. Pathway Suggestions (LLM-generated pathway improvement suggestions)
-- ============================================
CREATE TABLE IF NOT EXISTS pathway_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_record_id UUID REFERENCES call_records(id) ON DELETE SET NULL,
  practitioner_type TEXT NOT NULL,
  suggestion_type TEXT NOT NULL, -- node_prompt, edge_label, missing_edge, missing_node, knowledge_base_gap
  node_id TEXT,
  node_name TEXT,
  edge_id TEXT,
  current_content TEXT,
  suggested_content TEXT NOT NULL,
  reasoning TEXT,
  transcript_excerpt TEXT,
  severity TEXT DEFAULT 'medium', -- low, medium, high, critical
  frequency_count INTEGER DEFAULT 1,
  similar_call_ids TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'new', -- new, approved, reviewed, implemented, dismissed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  implemented_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pathway_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS policies for the four tables above (authenticated read/write; service
-- role bypasses RLS). Source: 20260207_add_rls_sample_requests_appointments.sql.
-- Note: 20260601000002_tighten_rls_to_active_profiles.sql later narrows these
-- to is_active_user(); see that migration for the current production policies.
