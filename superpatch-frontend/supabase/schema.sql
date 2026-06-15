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
