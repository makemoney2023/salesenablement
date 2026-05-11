-- Repairs new_sample_request notification trigger to use the real column
-- names on sample_requests (see 20260115_add_sample_requests_columns.sql and
-- src/lib/db/types.ts:378-402).
--
-- The 20260115 trigger references columns that do not exist on
-- sample_requests (practitioner_name, practitioner_type, products,
-- address, requester_role). Every AFTER INSERT throws
--   "column ... does not exist"
-- and rolls the insert back, so no sample requests have been persisting
-- since the trigger was deployed.

CREATE OR REPLACE FUNCTION notify_new_sample_request()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'new_sample_request',
    json_build_object(
      'id', NEW.id,
      'call_record_id', NEW.call_record_id,
      'practitioner_id', NEW.practitioner_id,
      'requester_name', NEW.requester_name,
      'practice_name', NEW.practice_name,
      'email', NEW.email,
      'phone', NEW.phone,
      'sample_type', NEW.sample_type,
      'products_requested', NEW.products_requested,
      'quantity', NEW.quantity,
      'shipping_address', NEW.shipping_address,
      'shipping_city', NEW.shipping_city,
      'status', NEW.status,
      'created_at', NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop both the legacy trigger name (from 20260115_sample_notification_trigger.sql)
-- and the new canonical name so this migration is idempotent.
DROP TRIGGER IF EXISTS trigger_notify_new_sample ON sample_requests;
DROP TRIGGER IF EXISTS trg_notify_new_sample_request ON sample_requests;

CREATE TRIGGER trg_notify_new_sample_request
AFTER INSERT ON sample_requests
FOR EACH ROW EXECUTE FUNCTION notify_new_sample_request();

COMMENT ON FUNCTION notify_new_sample_request() IS 'Sends pg_notify when a new sample request is created (repaired 2026-05-12 to use real column names).';
