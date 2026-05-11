-- Repoints pg_cron jobs and fixes their Bearer token. Replaces broken jobs
-- from:
--   20260115_setup_cron_jobs.sql  (process-retry-queue, process-enrichment-queue,
--                                  cleanup-stale-enrichment)
--   20260116_cron_daily_report.sql (generate-daily-report)
--   20260116_cron_sync_cal.sql     (sync-cal-bookings)
--
-- Bugs being fixed:
--   1. process-enrichment-queue targets a non-existent function name
--      (`/functions/v1/enrich-practitioners`); deployed function is
--      `enrich-practitioners-v2`. Every run 404s.
--   2. All HTTP cron jobs build their Bearer header from
--      `current_setting('supabase.service_role_key', true)` which is unset
--      by default and evaluates to NULL, producing the literal header
--      "Bearer " (no token). Every invocation is rejected by
--      verifyServiceAuth.
--
-- Operational pre-req: the `service_role_key` secret must be inserted into
-- vault.secrets before this migration runs. If it is missing, the
-- migration raises early with a clear message so deployment fails fast.
--
--   INSERT INTO vault.secrets (name, secret)
--   VALUES ('service_role_key', '<service_role_key_value>')
--   ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
--
-- IMPORTANT — token never lands in cron.job.command: the scheduled command
-- looks the secret up from `vault.decrypted_secrets` at run time, so the
-- JWT is not embedded in the (world-readable to superuser/postgres) job
-- definition. Earlier drafts of this migration interpolated the token at
-- schedule time via `'Bearer ' || service_token`, which would have
-- persisted the plaintext token into `cron.job`.
--
-- The `cleanup-stale-enrichment` job is a pure SQL job (no HTTP) and is
-- left alone.

DO $$
DECLARE
  job_id BIGINT;
  supabase_url CONSTANT TEXT := 'https://gdwwppwaxyvudsecexuq.supabase.co';
BEGIN
  -- Pre-flight: fail fast if the operator forgot to insert the Vault secret.
  -- The token is NOT captured into a variable here — we only want to verify
  -- it exists. The scheduled commands below resolve it at run time.
  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
      AND decrypted_secret IS NOT NULL
      AND length(decrypted_secret) > 0
  ) THEN
    RAISE EXCEPTION
      'vault.secrets entry "service_role_key" is missing or empty. Insert it before applying this migration. See the comment at the top of 20260512_repoint_cron_jobs.sql.';
  END IF;

  FOR job_id IN
    SELECT jobid FROM cron.job WHERE jobname IN (
      'process-enrichment-queue',
      'process-retry-queue',
      'generate-daily-report',
      'sync-cal-bookings'
    )
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;

  PERFORM cron.schedule(
    'process-enrichment-queue',
    '*/30 * * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'service_role_key'
            LIMIT 1
          )
        ),
        body := jsonb_build_object('source', 'pg_cron', 'scheduled', true)
      ) AS request_id;
    $cron$, supabase_url || '/functions/v1/enrich-practitioners-v2')
  );

  PERFORM cron.schedule(
    'process-retry-queue',
    '*/15 13-23 * * 1-5',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'service_role_key'
            LIMIT 1
          )
        ),
        body := jsonb_build_object('source', 'pg_cron', 'scheduled', true)
      ) AS request_id;
    $cron$, supabase_url || '/functions/v1/process-retry-queue')
  );

  PERFORM cron.schedule(
    'sync-cal-bookings',
    '*/15 * * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'service_role_key'
            LIMIT 1
          )
        ),
        body := jsonb_build_object('source', 'pg_cron', 'scheduled', true)
      ) AS request_id;
    $cron$, supabase_url || '/functions/v1/sync-cal-bookings')
  );

  PERFORM cron.schedule(
    'generate-daily-report',
    '0 8 * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'service_role_key'
            LIMIT 1
          )
        ),
        body := jsonb_build_object('source', 'pg_cron', 'scheduled', true)
      ) AS request_id;
    $cron$, supabase_url || '/functions/v1/generate-daily-report')
  );
END $$;
