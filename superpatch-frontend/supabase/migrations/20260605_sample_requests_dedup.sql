-- Sample request deduplication
--
-- The webhook-processor could create more than one sample_requests row for the
-- same call when a Bland webhook was redelivered (before processed_at was set)
-- or delivered concurrently. The Edge Function now checks for an existing
-- sample by call_record_id before inserting; this migration adds the DB-level
-- backstop so duplicates are impossible even under a race.
--
-- A partial unique index is used so that unknown-caller samples (call_record_id
-- IS NULL) are still allowed in unlimited quantity.

-- 1. Collapse any pre-existing duplicates, keeping the earliest row per call.
DELETE FROM sample_requests sr
USING sample_requests keep
WHERE sr.call_record_id IS NOT NULL
  AND sr.call_record_id = keep.call_record_id
  AND (
    keep.created_at < sr.created_at
    OR (keep.created_at = sr.created_at AND keep.id < sr.id)
  );

-- 2. Enforce one sample per call record going forward.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sample_requests_call_record_id
  ON sample_requests (call_record_id)
  WHERE call_record_id IS NOT NULL;
