-- Add LinkedIn profiles column to practitioners table
-- Stores LinkedIn profile URLs discovered via Firecrawl search

-- Add the linkedin_profiles JSONB column
ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS linkedin_profiles JSONB;

-- Structure:
-- {
--   "clinic_url": "https://linkedin.com/company/...",
--   "team_members": [
--     {
--       "name": "Dr. Sarah Chen",
--       "linkedin_url": "https://linkedin.com/in/...",
--       "confidence": 0.85,
--       "search_query": "...",
--       "title": "...",
--       "description": "...",
--       "found_at": "2026-01-20T..."
--     }
--   ],
--   "enriched_at": "2026-01-20T...",
--   "total_found": 3,
--   "total_searched": 5
-- }

-- Add index for querying practitioners with LinkedIn profiles
CREATE INDEX IF NOT EXISTS idx_practitioners_linkedin_profiles 
ON practitioners USING gin(linkedin_profiles);

-- Add column to track LinkedIn enrichment status
ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS linkedin_enrichment_status TEXT DEFAULT 'pending';

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_practitioners_linkedin_status 
ON practitioners(linkedin_enrichment_status);

COMMENT ON COLUMN practitioners.linkedin_profiles IS 'LinkedIn profile URLs and metadata for team members, discovered via Firecrawl search';
COMMENT ON COLUMN practitioners.linkedin_enrichment_status IS 'Status of LinkedIn enrichment: pending, in_progress, completed, failed, skipped';
