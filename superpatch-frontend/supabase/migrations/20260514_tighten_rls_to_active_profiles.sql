-- Migration: Tighten RLS from "any logged-in user" to "active user with profile"
--
-- Background: 20260130_add_user_profiles_and_auth.sql replaced the original
-- "Allow all operations" RLS on call_records / call_notes / campaign_analytics /
-- practitioners with `USING (auth.uid() IS NOT NULL)`. 20260207 did the same
-- for sample_requests / appointments / follow_up_queue / pathway_suggestions.
--
-- That tightening was correct in spirit (block the anon key) but too loose in
-- practice: any leaked JWT for any signed-up user gives full read/write on
-- every row in every table. A "deactivated" user (is_active=false in
-- user_profiles) likewise still has full access until their JWT expires.
--
-- This migration replaces that predicate with `public.is_active_user()`,
-- which requires the caller to have:
--   1. a valid auth.uid() (i.e. authenticated, not anon), AND
--   2. a matching public.user_profiles row, AND
--   3. is_active = true on that row.
--
-- The service_role bypasses RLS as always, so Edge Functions and admin
-- API routes are unaffected. Anon callers were already blocked.

-- ============================================
-- 1. is_active_user() helper
-- ============================================
-- SECURITY DEFINER so the function can read user_profiles even when the
-- caller's own RLS context wouldn't permit it (the function itself is the
-- gatekeeper, not the inner SELECT).
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND is_active = TRUE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO anon;

-- ============================================
-- 1b. Drop OUT-OF-BAND wide-open policies created via the Supabase dashboard
-- ============================================
-- These policies were created via the Supabase Studio dashboard (not via
-- migrations) and are NOT visible in source control. Multiple are
-- mis-named "Allow service role" / "Allow anon read" but their roles
-- column is `{public}` and qual is `true`, so they apply to anon AND
-- authenticated AND service_role with NO predicate.
--
-- Because PostgreSQL ORs all matching policies on a table for a given
-- command, a single `qual: true` policy on the {public} role makes
-- every other tightening on that table a NO-OP. Without this block the
-- main lock-down below silently does nothing for these four tables.
--
-- service_role bypasses RLS entirely, so dropping these does NOT break
-- the Edge Functions / admin API routes that use the service key.
-- authenticated callers are picked up by the new `is_active_user()`
-- policies below.

DROP POLICY IF EXISTS "Allow anon read access to appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow service role full access to appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow all access to sample_requests" ON public.sample_requests;
DROP POLICY IF EXISTS "Service role can manage follow_up_queue" ON public.follow_up_queue;
DROP POLICY IF EXISTS "Service role can manage pathway_suggestions" ON public.pathway_suggestions;

-- ============================================
-- 2. call_records
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view call records" ON public.call_records;
DROP POLICY IF EXISTS "Authenticated users can insert call records" ON public.call_records;
DROP POLICY IF EXISTS "Authenticated users can update call records" ON public.call_records;
DROP POLICY IF EXISTS "Authenticated users can delete call records" ON public.call_records;
-- Self-drops so the migration is fully idempotent if re-run.
DROP POLICY IF EXISTS "Active users can view call records" ON public.call_records;
DROP POLICY IF EXISTS "Active users can insert call records" ON public.call_records;
DROP POLICY IF EXISTS "Active users can update call records" ON public.call_records;
DROP POLICY IF EXISTS "Active users can delete call records" ON public.call_records;

CREATE POLICY "Active users can view call records"
  ON public.call_records FOR SELECT
  USING (public.is_active_user());

CREATE POLICY "Active users can insert call records"
  ON public.call_records FOR INSERT
  WITH CHECK (public.is_active_user());

CREATE POLICY "Active users can update call records"
  ON public.call_records FOR UPDATE
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY "Active users can delete call records"
  ON public.call_records FOR DELETE
  USING (public.is_active_user());

-- ============================================
-- 3. call_notes
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view call notes" ON public.call_notes;
DROP POLICY IF EXISTS "Authenticated users can insert call notes" ON public.call_notes;
DROP POLICY IF EXISTS "Authenticated users can update call notes" ON public.call_notes;
DROP POLICY IF EXISTS "Authenticated users can delete call notes" ON public.call_notes;
DROP POLICY IF EXISTS "Active users can view call notes" ON public.call_notes;
DROP POLICY IF EXISTS "Active users can insert call notes" ON public.call_notes;
DROP POLICY IF EXISTS "Active users can update call notes" ON public.call_notes;
DROP POLICY IF EXISTS "Active users can delete call notes" ON public.call_notes;

CREATE POLICY "Active users can view call notes"
  ON public.call_notes FOR SELECT
  USING (public.is_active_user());

CREATE POLICY "Active users can insert call notes"
  ON public.call_notes FOR INSERT
  WITH CHECK (public.is_active_user());

CREATE POLICY "Active users can update call notes"
  ON public.call_notes FOR UPDATE
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY "Active users can delete call notes"
  ON public.call_notes FOR DELETE
  USING (public.is_active_user());

-- ============================================
-- 4. campaign_analytics
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view analytics" ON public.campaign_analytics;
DROP POLICY IF EXISTS "Authenticated users can insert analytics" ON public.campaign_analytics;
DROP POLICY IF EXISTS "Authenticated users can update analytics" ON public.campaign_analytics;
DROP POLICY IF EXISTS "Active users can view analytics" ON public.campaign_analytics;
DROP POLICY IF EXISTS "Active users can insert analytics" ON public.campaign_analytics;
DROP POLICY IF EXISTS "Active users can update analytics" ON public.campaign_analytics;

CREATE POLICY "Active users can view analytics"
  ON public.campaign_analytics FOR SELECT
  USING (public.is_active_user());

CREATE POLICY "Active users can insert analytics"
  ON public.campaign_analytics FOR INSERT
  WITH CHECK (public.is_active_user());

CREATE POLICY "Active users can update analytics"
  ON public.campaign_analytics FOR UPDATE
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

-- ============================================
-- 5. practitioners
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view practitioners" ON public.practitioners;
DROP POLICY IF EXISTS "Authenticated users can insert practitioners" ON public.practitioners;
DROP POLICY IF EXISTS "Authenticated users can update practitioners" ON public.practitioners;
DROP POLICY IF EXISTS "Authenticated users can delete practitioners" ON public.practitioners;
DROP POLICY IF EXISTS "Active users can view practitioners" ON public.practitioners;
DROP POLICY IF EXISTS "Active users can insert practitioners" ON public.practitioners;
DROP POLICY IF EXISTS "Active users can update practitioners" ON public.practitioners;
DROP POLICY IF EXISTS "Active users can delete practitioners" ON public.practitioners;

CREATE POLICY "Active users can view practitioners"
  ON public.practitioners FOR SELECT
  USING (public.is_active_user());

CREATE POLICY "Active users can insert practitioners"
  ON public.practitioners FOR INSERT
  WITH CHECK (public.is_active_user());

CREATE POLICY "Active users can update practitioners"
  ON public.practitioners FOR UPDATE
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY "Active users can delete practitioners"
  ON public.practitioners FOR DELETE
  USING (public.is_active_user());

-- ============================================
-- 6. sample_requests
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view sample_requests" ON public.sample_requests;
DROP POLICY IF EXISTS "Authenticated users can insert sample_requests" ON public.sample_requests;
DROP POLICY IF EXISTS "Authenticated users can update sample_requests" ON public.sample_requests;
DROP POLICY IF EXISTS "Authenticated users can delete sample_requests" ON public.sample_requests;
DROP POLICY IF EXISTS "Active users can view sample_requests" ON public.sample_requests;
DROP POLICY IF EXISTS "Active users can insert sample_requests" ON public.sample_requests;
DROP POLICY IF EXISTS "Active users can update sample_requests" ON public.sample_requests;
DROP POLICY IF EXISTS "Active users can delete sample_requests" ON public.sample_requests;

CREATE POLICY "Active users can view sample_requests"
  ON public.sample_requests FOR SELECT
  USING (public.is_active_user());

CREATE POLICY "Active users can insert sample_requests"
  ON public.sample_requests FOR INSERT
  WITH CHECK (public.is_active_user());

CREATE POLICY "Active users can update sample_requests"
  ON public.sample_requests FOR UPDATE
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY "Active users can delete sample_requests"
  ON public.sample_requests FOR DELETE
  USING (public.is_active_user());

-- ============================================
-- 7. appointments
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can delete appointments" ON public.appointments;
DROP POLICY IF EXISTS "Active users can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Active users can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Active users can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Active users can delete appointments" ON public.appointments;

CREATE POLICY "Active users can view appointments"
  ON public.appointments FOR SELECT
  USING (public.is_active_user());

CREATE POLICY "Active users can insert appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (public.is_active_user());

CREATE POLICY "Active users can update appointments"
  ON public.appointments FOR UPDATE
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY "Active users can delete appointments"
  ON public.appointments FOR DELETE
  USING (public.is_active_user());

-- ============================================
-- 8. follow_up_queue
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view follow_up_queue" ON public.follow_up_queue;
DROP POLICY IF EXISTS "Authenticated users can insert follow_up_queue" ON public.follow_up_queue;
DROP POLICY IF EXISTS "Authenticated users can update follow_up_queue" ON public.follow_up_queue;
DROP POLICY IF EXISTS "Authenticated users can delete follow_up_queue" ON public.follow_up_queue;
DROP POLICY IF EXISTS "Active users can view follow_up_queue" ON public.follow_up_queue;
DROP POLICY IF EXISTS "Active users can insert follow_up_queue" ON public.follow_up_queue;
DROP POLICY IF EXISTS "Active users can update follow_up_queue" ON public.follow_up_queue;
DROP POLICY IF EXISTS "Active users can delete follow_up_queue" ON public.follow_up_queue;

CREATE POLICY "Active users can view follow_up_queue"
  ON public.follow_up_queue FOR SELECT
  USING (public.is_active_user());

CREATE POLICY "Active users can insert follow_up_queue"
  ON public.follow_up_queue FOR INSERT
  WITH CHECK (public.is_active_user());

CREATE POLICY "Active users can update follow_up_queue"
  ON public.follow_up_queue FOR UPDATE
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY "Active users can delete follow_up_queue"
  ON public.follow_up_queue FOR DELETE
  USING (public.is_active_user());

-- ============================================
-- 9. pathway_suggestions
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view pathway_suggestions" ON public.pathway_suggestions;
DROP POLICY IF EXISTS "Authenticated users can insert pathway_suggestions" ON public.pathway_suggestions;
DROP POLICY IF EXISTS "Authenticated users can update pathway_suggestions" ON public.pathway_suggestions;
DROP POLICY IF EXISTS "Authenticated users can delete pathway_suggestions" ON public.pathway_suggestions;
DROP POLICY IF EXISTS "Active users can view pathway_suggestions" ON public.pathway_suggestions;
DROP POLICY IF EXISTS "Active users can insert pathway_suggestions" ON public.pathway_suggestions;
DROP POLICY IF EXISTS "Active users can update pathway_suggestions" ON public.pathway_suggestions;
DROP POLICY IF EXISTS "Active users can delete pathway_suggestions" ON public.pathway_suggestions;

CREATE POLICY "Active users can view pathway_suggestions"
  ON public.pathway_suggestions FOR SELECT
  USING (public.is_active_user());

CREATE POLICY "Active users can insert pathway_suggestions"
  ON public.pathway_suggestions FOR INSERT
  WITH CHECK (public.is_active_user());

CREATE POLICY "Active users can update pathway_suggestions"
  ON public.pathway_suggestions FOR UPDATE
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY "Active users can delete pathway_suggestions"
  ON public.pathway_suggestions FOR DELETE
  USING (public.is_active_user());

-- Reload PostgREST schema cache so the new policies are picked up immediately.
NOTIFY pgrst, 'reload schema';
