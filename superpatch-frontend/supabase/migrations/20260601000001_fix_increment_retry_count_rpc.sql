-- Fix increment_retry_count(p_id) RPC so it actually exists in production with
-- the correct argument type.
--
-- Why:
--   The original migration `20260206_add_atomic_retry_increment.sql` declared
--   `p_id UUID`, but `practitioners.id` is TEXT (see schema.sql L106 — many
--   rows have IDs like `place_<google_place_id>` or `user_<timestamp>_<rand>`
--   that are not valid UUIDs). Either the function was never created, or it
--   was created with the wrong signature and PostgREST refuses to dispatch
--   text arguments to a UUID parameter — in production today a direct REST
--   probe returns `PGRST202: Could not find the function public.
--   increment_retry_count(p_id) in the schema cache`.
--
--   Effect of the bug: `webhook-processor/index.ts:1423` calls
--   `supabase.rpc("increment_retry_count", { p_id })`. The supabase-js client
--   returns `{ data: null, error: <PGRST202> }` (it does NOT throw), so the
--   `try { ... } catch { fallback }` block never reaches the fallback. The
--   subsequent line computes `currentRetryCount = (null ?? 1) - 1 = 0`, which
--   means every voicemail/failed call is scheduled as if it were the first
--   retry attempt. Once the Bland → webhook-processor pipeline is healthy
--   (after the 2026-05-13 verify_jwt fix), this would cause infinite retries
--   instead of the configured 3-attempt cap.
--
-- Depends on:
--   - `practitioners.retry_count` column (added in `add_retry_tracking.sql`)
--   - `practitioners.id text` (schema.sql L106)
--
-- Callers (must keep argument name `p_id`):
--   - superpatch-frontend/supabase/functions/process-retry-queue/retry.ts
--   - superpatch-frontend/supabase/functions/webhook-processor/index.ts
--
-- Rollback:
--   `DROP FUNCTION IF EXISTS public.increment_retry_count(text);`
--   then re-run `20260206_add_atomic_retry_increment.sql` if the broken
--   UUID-typed function is required for any reason.

-- 1. Drop any prior signature (UUID, or this one) so CREATE OR REPLACE is
--    unambiguous and PostgREST's schema cache picks up the new function.
DROP FUNCTION IF EXISTS public.increment_retry_count(uuid);
DROP FUNCTION IF EXISTS public.increment_retry_count(text);

-- 2. Create the function with the correct argument type. SECURITY INVOKER is
--    the default and is correct here — only service_role / authenticated
--    callers will reach this RPC (no anon caller exists today).
CREATE FUNCTION public.increment_retry_count(p_id text)
RETURNS integer
LANGUAGE sql
VOLATILE
AS $$
  UPDATE practitioners
  SET retry_count = COALESCE(retry_count, 0) + 1
  WHERE id = p_id
  RETURNING retry_count;
$$;

-- 3. Grant EXECUTE explicitly so the Edge Functions (which run as
--    `service_role`) can dispatch the RPC even after a PostgREST schema-cache
--    refresh. service_role bypasses RLS but still requires function-level
--    grants when default grants are revoked.
GRANT EXECUTE ON FUNCTION public.increment_retry_count(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_retry_count(text) TO authenticated;

-- 4. Force a PostgREST schema-cache reload so the new function is available
--    immediately without a manual restart.
NOTIFY pgrst, 'reload schema';
