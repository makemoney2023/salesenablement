-- Add unique constraint on appointments.call_record_id to prevent duplicate bookings
-- from concurrent webhook processing or race conditions in book-appointment edge function.
-- Only one appointment should exist per call record.

ALTER TABLE appointments
  ADD CONSTRAINT unique_appointment_call_record
  UNIQUE (call_record_id);
