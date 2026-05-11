BEGIN;
SELECT plan(1);

-- Should succeed; if the broken trigger is active, this INSERT throws
-- column "practitioner_name" does not exist.
SELECT lives_ok(
  $$INSERT INTO sample_requests (requester_name, phone, sample_type, quantity)
    VALUES ('Test Requester', '+15555551212', 'standard_kit', 1)$$,
  'sample_requests insert fires notification without error'
);

SELECT * FROM finish();
ROLLBACK;
