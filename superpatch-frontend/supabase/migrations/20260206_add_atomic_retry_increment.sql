-- Atomic retry count increment to prevent race conditions when multiple
-- webhooks fire for the same practitioner concurrently.
-- Returns the new retry count after incrementing.

CREATE OR REPLACE FUNCTION increment_retry_count(p_id UUID)
RETURNS INTEGER
LANGUAGE SQL
VOLATILE
AS $$
  UPDATE practitioners
  SET retry_count = COALESCE(retry_count, 0) + 1
  WHERE id = p_id
  RETURNING retry_count;
$$;
