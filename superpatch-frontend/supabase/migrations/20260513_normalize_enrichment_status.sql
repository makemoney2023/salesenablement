-- The enrich-practitioners-v2 Edge Function writes
-- `enrichment_status = 'enriched'` (see supabase/functions/enrich-practitioners-v2/index.ts:381),
-- but several legacy readers — `generate-daily-report`, the
-- `get_enrichment_stats` RPC, the `queue_practitioners_for_enrichment` RPC,
-- and the `useRealtimePractitioners` hook — filtered on the older
-- `'completed'` value. The drift caused enrichment counts to display as
-- zero on dashboards and let already-enriched practitioners be re-queued.
--
-- This migration:
--   1. Backfills any legacy 'completed' rows to the canonical 'enriched'.
--   2. Adds a CHECK constraint pinning the column to a known domain so the
--      drift can't reopen.
--   3. Recreates both helper RPCs to filter on 'enriched'. The
--      get_enrichment_stats return shape keeps the column name `completed`
--      to avoid breaking existing consumers (useRealtimePractitioners' UI
--      treats it as "count of practitioners that finished enrichment").

-- Legacy writers used three different "success" sentinels: 'completed'
-- (early enrich-practitioners), 'success' (the bulk-enrichment Python
-- jobs in b2b_sales_enablement/practitioner_enrichment/), and the
-- canonical 'enriched' from enrich-practitioners-v2. Collapse all three
-- to 'enriched' before adding the CHECK constraint below; otherwise the
-- ALTER TABLE blows up on prod data (~10k 'success' rows observed).
UPDATE practitioners
SET enrichment_status = 'enriched'
WHERE enrichment_status IN ('completed', 'success');

ALTER TABLE practitioners
  DROP CONSTRAINT IF EXISTS practitioners_enrichment_status_check;

ALTER TABLE practitioners
  ADD CONSTRAINT practitioners_enrichment_status_check
  CHECK (
    enrichment_status IS NULL
    OR enrichment_status IN ('pending', 'in_progress', 'enriched', 'failed', 'skipped')
  );

-- Stats RPC: same return shape, but the "completed" column now counts
-- rows whose enrichment_status is 'enriched'.
CREATE OR REPLACE FUNCTION get_enrichment_stats()
RETURNS TABLE (
  total bigint,
  pending bigint,
  in_progress bigint,
  completed bigint,
  failed bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE enrichment_status = 'pending')::bigint AS pending,
    COUNT(*) FILTER (WHERE enrichment_status = 'in_progress')::bigint AS in_progress,
    COUNT(*) FILTER (WHERE enrichment_status = 'enriched')::bigint AS completed,
    COUNT(*) FILTER (WHERE enrichment_status = 'failed')::bigint AS failed
  FROM practitioners;
$$;

GRANT EXECUTE ON FUNCTION get_enrichment_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_enrichment_stats() TO anon;

COMMENT ON FUNCTION get_enrichment_stats() IS
  'Returns counts of practitioners by enrichment status for dashboard stats. The "completed" column counts rows in the canonical "enriched" state.';

-- Queue RPC: skip practitioners already in the canonical 'enriched' state.
CREATE OR REPLACE FUNCTION queue_practitioners_for_enrichment(practitioner_ids UUID[])
RETURNS TABLE(
  queued_count INTEGER,
  already_enriched INTEGER,
  no_website INTEGER
) AS $$
DECLARE
  v_queued INTEGER := 0;
  v_enriched INTEGER := 0;
  v_no_website INTEGER := 0;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_enriched
  FROM practitioners
  WHERE id = ANY(practitioner_ids) AND enrichment_status = 'enriched';

  SELECT COUNT(*)::INTEGER INTO v_no_website
  FROM practitioners
  WHERE id = ANY(practitioner_ids) AND website IS NULL;

  WITH updated AS (
    UPDATE practitioners
    SET
      enrichment_status = 'pending',
      enrichment_queued_at = NOW()
    WHERE
      id = ANY(practitioner_ids)
      AND website IS NOT NULL
      AND enrichment_status NOT IN ('enriched', 'in_progress')
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_queued FROM updated;

  RETURN QUERY SELECT v_queued, v_enriched, v_no_website;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION queue_practitioners_for_enrichment(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION queue_practitioners_for_enrichment(UUID[]) TO service_role;
