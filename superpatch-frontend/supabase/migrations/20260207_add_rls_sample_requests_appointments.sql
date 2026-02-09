-- Migration: Add RLS policies for sample_requests and appointments tables
-- These tables were missing RLS policies, creating a security risk

-- ============================================
-- 1. Enable RLS on sample_requests
-- ============================================
ALTER TABLE IF EXISTS sample_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Authenticated users can view sample requests" ON sample_requests;
DROP POLICY IF EXISTS "Authenticated users can insert sample requests" ON sample_requests;
DROP POLICY IF EXISTS "Authenticated users can update sample requests" ON sample_requests;
DROP POLICY IF EXISTS "Authenticated users can delete sample requests" ON sample_requests;
DROP POLICY IF EXISTS "Service role has full access to sample requests" ON sample_requests;

-- Authenticated users can read all sample requests
CREATE POLICY "Authenticated users can view sample requests"
  ON sample_requests FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can create sample requests
CREATE POLICY "Authenticated users can insert sample requests"
  ON sample_requests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users can update sample requests (e.g., mark as shipped)
CREATE POLICY "Authenticated users can update sample requests"
  ON sample_requests FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can delete sample requests
CREATE POLICY "Authenticated users can delete sample requests"
  ON sample_requests FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Service role bypass (for Edge Functions like webhook-processor, send-sample-confirmation)
-- Note: service_role key bypasses RLS by default in Supabase, so this is for documentation

-- ============================================
-- 2. Enable RLS on appointments
-- ============================================
ALTER TABLE IF EXISTS appointments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Authenticated users can view appointments" ON appointments;
DROP POLICY IF EXISTS "Authenticated users can insert appointments" ON appointments;
DROP POLICY IF EXISTS "Authenticated users can update appointments" ON appointments;
DROP POLICY IF EXISTS "Authenticated users can delete appointments" ON appointments;

-- Authenticated users can read all appointments
CREATE POLICY "Authenticated users can view appointments"
  ON appointments FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can create appointments
CREATE POLICY "Authenticated users can insert appointments"
  ON appointments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users can update appointments (e.g., reschedule, cancel)
CREATE POLICY "Authenticated users can update appointments"
  ON appointments FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can delete appointments
CREATE POLICY "Authenticated users can delete appointments"
  ON appointments FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- 3. Enable RLS on follow_up_queue (if not already)
-- ============================================
ALTER TABLE IF EXISTS follow_up_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view follow up queue" ON follow_up_queue;
DROP POLICY IF EXISTS "Authenticated users can insert follow up queue" ON follow_up_queue;
DROP POLICY IF EXISTS "Authenticated users can update follow up queue" ON follow_up_queue;
DROP POLICY IF EXISTS "Authenticated users can delete follow up queue" ON follow_up_queue;

CREATE POLICY "Authenticated users can view follow up queue"
  ON follow_up_queue FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert follow up queue"
  ON follow_up_queue FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update follow up queue"
  ON follow_up_queue FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete follow up queue"
  ON follow_up_queue FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- 4. Enable RLS on pathway_suggestions (if not already)
-- ============================================
ALTER TABLE IF EXISTS pathway_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view pathway suggestions" ON pathway_suggestions;
DROP POLICY IF EXISTS "Authenticated users can insert pathway suggestions" ON pathway_suggestions;
DROP POLICY IF EXISTS "Authenticated users can update pathway suggestions" ON pathway_suggestions;
DROP POLICY IF EXISTS "Authenticated users can delete pathway suggestions" ON pathway_suggestions;

CREATE POLICY "Authenticated users can view pathway suggestions"
  ON pathway_suggestions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert pathway suggestions"
  ON pathway_suggestions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update pathway suggestions"
  ON pathway_suggestions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete pathway suggestions"
  ON pathway_suggestions FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- 5. Grant table access to authenticated role
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON sample_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON follow_up_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pathway_suggestions TO authenticated;
