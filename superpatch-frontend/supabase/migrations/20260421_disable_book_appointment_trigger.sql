-- Disable the pg_net book-appointment trigger to eliminate the duplicate
-- downstream path.
--
-- Background:
--   20260116_book_appointment_trigger.sql installed a trigger on call_records
--   that calls the `book-appointment` Edge Function via pg_net whenever
--   appointment_booked flips true. However, the webhook-processor Edge
--   Function (supabase/functions/webhook-processor/index.ts) ALSO calls
--   book-appointment explicitly (with dedup checks) after parsing the Bland
--   webhook. Having both paths fire for the same call_record caused racing /
--   duplicate booking attempts.
--
-- Resolution:
--   webhook-processor remains the single canonical path because it has:
--     - upfront existence check against call_records.booking_id
--     - richer context (transcript extraction, Gemini date parsing)
--     - retries / error handling wired to the rest of the pipeline
--
--   This migration drops the trigger and trigger function. If you ever need
--   the pg_net path back, revert this migration.
--
-- Rule enforced by .cursor/rules/supabase-conventions.mdc: one downstream
-- side-effect path per event (pg_net trigger OR explicit fetch, never both).

DROP TRIGGER IF EXISTS trigger_queue_appointment_booking ON call_records;
DROP FUNCTION IF EXISTS queue_appointment_booking();

-- Safety: if any downstream automation was relying on the trigger, log so
-- observability catches it. Comments on dropped objects are not possible, so
-- record the change in a table-level comment.
COMMENT ON TABLE call_records IS
  'Call records from Bland.ai. Appointment booking is handled exclusively by the webhook-processor Edge Function (see supabase/functions/webhook-processor/index.ts); the pg_net trigger previously installed by 20260116_book_appointment_trigger.sql was removed on 2026-04-21 to eliminate duplicate booking attempts.';
