-- Add call_records.processed_at to support webhook idempotency.
--
-- Why:
--   Bland.ai retries webhook delivery on network errors or missed acks. Before
--   this column, webhook-processor would fully re-execute side effects on the
--   redelivered webhook: a second sample_requests row, a second
--   book-appointment dispatch, a second analyze-call dispatch, a second retry
--   schedule. This was masked while the verify_jwt gateway was 401-ing
--   everything, but now that the pipeline is live the duplicate risk is real.
--
--   The idempotency guard in webhook-processor checks this column at the top
--   of the handler: a non-null processed_at means we've already finished
--   processing this call_id, and the handler short-circuits with 200 +
--   `idempotent skip`. processed_at is set right before the success response
--   is returned.
--
-- Depends on:
--   - call_records.call_id (TEXT UNIQUE) already exists
--
-- Rollback:
--   ALTER TABLE call_records DROP COLUMN IF EXISTS processed_at;

ALTER TABLE call_records
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ NULL;

-- Partial index so the idempotency lookup (call_id where processed_at NOT
-- NULL) stays fast as the table grows. The base call_id index is already
-- UNIQUE which would also work, but a partial saves bytes on millions of
-- rows where most lookups want only "fully processed" rows.
CREATE INDEX IF NOT EXISTS call_records_processed_at_idx
  ON call_records (processed_at)
  WHERE processed_at IS NOT NULL;

-- Refresh PostgREST schema cache so the new column is available immediately.
NOTIFY pgrst, 'reload schema';
