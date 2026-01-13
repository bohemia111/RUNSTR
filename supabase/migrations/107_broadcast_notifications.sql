-- Migration: 107_broadcast_notifications.sql
-- Purpose: Create tables for broadcast push notifications (privacy-first)
--
-- PRIVACY DESIGN:
-- - broadcast_tokens stores device tokens WITHOUT npub association
-- - Cannot identify which user receives notifications
-- - Everyone receives the SAME community notifications
--
-- Tables:
-- 1. broadcast_tokens - Anonymous device tokens for push notifications
-- 2. daily_leaderboard_cache - Track what we've already notified about

-- =============================================
-- TABLE: broadcast_tokens
-- Anonymous device tokens for community notifications
-- =============================================

CREATE TABLE IF NOT EXISTS broadcast_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_broadcast_tokens_active
  ON broadcast_tokens(is_active)
  WHERE is_active = true;

-- RLS: Anyone can register their token
ALTER TABLE broadcast_tokens ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (no auth required)
CREATE POLICY "Anyone can register token"
  ON broadcast_tokens
  FOR INSERT
  WITH CHECK (true);

-- Allow updates (for deactivation)
CREATE POLICY "Anyone can update tokens"
  ON broadcast_tokens
  FOR UPDATE
  USING (true);

-- Service role can read all (for Edge Function)
CREATE POLICY "Service role can read all"
  ON broadcast_tokens
  FOR SELECT
  TO service_role
  USING (true);

-- =============================================
-- TABLE: daily_leaderboard_cache
-- Track what we've already notified about to avoid duplicates
-- =============================================

CREATE TABLE IF NOT EXISTS daily_leaderboard_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('5k', '10k', 'half', 'marathon')),
  best_time_seconds INTEGER,
  entry_count INTEGER DEFAULT 0,
  last_notified_at TIMESTAMPTZ,
  UNIQUE(date, category)
);

-- Index for efficient daily lookups
CREATE INDEX IF NOT EXISTS idx_daily_leaderboard_cache_date
  ON daily_leaderboard_cache(date);

-- RLS: Only service role can access
ALTER TABLE daily_leaderboard_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON daily_leaderboard_cache
  FOR ALL
  TO service_role
  USING (true);

-- =============================================
-- CRON JOB: Schedule broadcast-running-update
-- Runs every 5 minutes during active hours (6 AM - 10 PM UTC)
-- =============================================

-- Note: This requires pg_cron and pg_net extensions (already enabled)
-- The cron job calls the Edge Function via HTTP

SELECT cron.schedule(
  'broadcast-running-update',
  '*/5 6-22 * * *',  -- Every 5 minutes, 6 AM - 10 PM UTC
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/broadcast-running-update',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- =============================================
-- CLEANUP: Remove old cache entries (older than 7 days)
-- =============================================

-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_leaderboard_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM daily_leaderboard_cache
  WHERE date < CURRENT_DATE - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule daily cleanup at 3 AM UTC
SELECT cron.schedule(
  'cleanup-leaderboard-cache',
  '0 3 * * *',  -- 3 AM daily
  $$SELECT cleanup_old_leaderboard_cache();$$
);

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

-- Grant necessary permissions to anon role for token registration
GRANT INSERT, UPDATE ON broadcast_tokens TO anon;
GRANT USAGE ON SCHEMA public TO anon;

COMMENT ON TABLE broadcast_tokens IS 'Anonymous device tokens for community push notifications. No user identity stored.';
COMMENT ON TABLE daily_leaderboard_cache IS 'Cache of daily leaderboard state to detect changes and avoid duplicate notifications.';
