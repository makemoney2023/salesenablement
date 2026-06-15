-- Normalized phone lookup for practitioners
--
-- webhook-processor.findPractitionerByPhone previously scanned the first 100
-- rows and normalized phones client-side, so a practitioner beyond that window
-- could never be linked to an inbound call. Add a generated, indexed
-- `phone_normalized` column (last 10 digits) so the Edge Function can match
-- DB-side across all rows.

ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT
  GENERATED ALWAYS AS (
    RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '\D', '', 'g'), 10)
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_practitioners_phone_normalized
  ON practitioners (phone_normalized);
