-- =============================================
-- Migration 105: Schedule sync-nostr-workouts function
-- =============================================
--
-- This migration sets up pg_cron to call the sync-nostr-workouts
-- edge function every 2 minutes, ensuring near real-time
-- leaderboard updates.
--
-- Prerequisites:
-- 1. pg_cron extension enabled (Supabase Pro plan or higher)
-- 2. pg_net extension enabled (for HTTP requests)
-- 3. Edge function deployed: supabase functions deploy sync-nostr-workouts
-- 4. Service role key stored in Vault
--
-- IMPORTANT: Run this AFTER deploying the edge function.
-- You can also set this up manually in the Supabase Dashboard.
-- =============================================

-- 1. Enable required extensions (may already be enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Store secrets in Vault (one-time setup)
-- NOTE: These MUST be run manually with actual values!
-- Without these, the cron job will silently fail.
--
-- Run these in SQL Editor with your actual values:
-- SELECT vault.create_secret('https://cvoepeskjueskdfrpsnv.supabase.co', 'project_url');
-- SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');
--
-- IMPORTANT: The project_url MUST include https:// prefix!

-- 3. Create the sync function that pg_cron will call
-- This function uses pg_net to make an HTTP request to the edge function
CREATE OR REPLACE FUNCTION public.trigger_nostr_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_url text;
  service_key text;
BEGIN
  -- Get secrets from vault
  SELECT decrypted_secret INTO project_url
  FROM vault.decrypted_secrets
  WHERE name = 'project_url';

  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key';

  -- Make HTTP request to edge function with 15 second timeout
  -- (default 5s is too short, sync function takes ~8-10s)
  IF project_url IS NOT NULL AND service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := project_url || '/functions/v1/sync-nostr-workouts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'triggered_at', now(),
        'source', 'pg_cron'
      ),
      timeout_milliseconds := 15000
    );

    RAISE LOG 'Triggered sync-nostr-workouts at %', now();
  ELSE
    RAISE WARNING 'Missing vault secrets for sync-nostr-workouts';
  END IF;
END;
$$;

-- 4. Schedule the sync job to run every 2 minutes
-- This creates a cron job that calls our trigger function
SELECT cron.schedule(
  'sync-nostr-workouts',           -- Job name
  '*/2 * * * *',                   -- Every 2 minutes
  $$SELECT public.trigger_nostr_sync()$$
);

-- 5. Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT EXECUTE ON FUNCTION public.trigger_nostr_sync() TO postgres;

-- =============================================
-- Verification queries (run after migration):
-- =============================================
--
-- Check if job is scheduled:
-- SELECT * FROM cron.job WHERE jobname = 'sync-nostr-workouts';
--
-- Check recent job runs:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--
-- Check pg_net HTTP responses (should show status_code=200):
-- SELECT id, status_code, created, error_msg FROM net._http_response ORDER BY created DESC LIMIT 10;
--
-- Check vault secrets are configured:
-- SELECT name, created_at FROM vault.secrets WHERE name IN ('project_url', 'service_role_key');
--
-- Manually trigger sync:
-- SELECT public.trigger_nostr_sync();
--
-- Remove the scheduled job:
-- SELECT cron.unschedule('sync-nostr-workouts');
-- =============================================
