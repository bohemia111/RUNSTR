-- Migration: Daily Leaderboard Schema
-- Purpose: Add columns for split data, pre-calculated target times, and profile caching
-- to support fast daily leaderboard queries from Supabase instead of Nostr fetching

-- =============================================
-- PHASE 1: Add Split Data Storage
-- =============================================

-- Store raw split data as JSON: {"5": 1920, "10": 3900}
-- Key = km marker, value = elapsed time in seconds
ALTER TABLE workout_submissions
ADD COLUMN IF NOT EXISTS splits_json JSONB;

COMMENT ON COLUMN workout_submissions.splits_json IS 'Split data: {"5": 1920, "10": 3900} where key=km and value=elapsed seconds';

-- =============================================
-- PHASE 2: Pre-calculated Target Distance Times
-- =============================================

-- Store pre-calculated times so leaderboard queries don't need client-side calculation
-- NULL means user didn't reach this distance (or splits unavailable)

-- 5K time (seconds) - most common distance
ALTER TABLE workout_submissions
ADD COLUMN IF NOT EXISTS time_5k_seconds INTEGER;

-- 10K time (seconds)
ALTER TABLE workout_submissions
ADD COLUMN IF NOT EXISTS time_10k_seconds INTEGER;

-- Half Marathon time (seconds) - 21.1km
ALTER TABLE workout_submissions
ADD COLUMN IF NOT EXISTS time_half_seconds INTEGER;

-- Marathon time (seconds) - 42.2km
ALTER TABLE workout_submissions
ADD COLUMN IF NOT EXISTS time_marathon_seconds INTEGER;

COMMENT ON COLUMN workout_submissions.time_5k_seconds IS 'Pre-calculated 5K time from splits or interpolation (NULL if distance < 5km)';
COMMENT ON COLUMN workout_submissions.time_10k_seconds IS 'Pre-calculated 10K time from splits or interpolation (NULL if distance < 10km)';
COMMENT ON COLUMN workout_submissions.time_half_seconds IS 'Pre-calculated half marathon time (NULL if distance < 21.1km)';
COMMENT ON COLUMN workout_submissions.time_marathon_seconds IS 'Pre-calculated marathon time (NULL if distance < 42.2km)';

-- =============================================
-- PHASE 3: Step Count for Walking Leaderboard
-- =============================================

ALTER TABLE workout_submissions
ADD COLUMN IF NOT EXISTS step_count INTEGER;

COMMENT ON COLUMN workout_submissions.step_count IS 'Step count for walking workouts (from HealthKit/Health Connect or Nostr tags)';

-- =============================================
-- PHASE 4: Leaderboard Date for Daily Queries
-- =============================================

-- Store date separately for efficient daily queries
-- Derived from created_at but indexed separately for performance
ALTER TABLE workout_submissions
ADD COLUMN IF NOT EXISTS leaderboard_date DATE;

COMMENT ON COLUMN workout_submissions.leaderboard_date IS 'Date (YYYY-MM-DD) for daily leaderboard queries - derived from created_at';

-- =============================================
-- PHASE 5: Profile Caching for Fast Display
-- =============================================

-- Cache user profile data so leaderboard doesn't need Nostr profile fetches
ALTER TABLE workout_submissions
ADD COLUMN IF NOT EXISTS profile_name TEXT;

ALTER TABLE workout_submissions
ADD COLUMN IF NOT EXISTS profile_picture TEXT;

COMMENT ON COLUMN workout_submissions.profile_name IS 'Cached display name for fast leaderboard rendering';
COMMENT ON COLUMN workout_submissions.profile_picture IS 'Cached avatar URL for fast leaderboard rendering';

-- =============================================
-- PHASE 6: Performance Indexes
-- =============================================

-- Index for 5K daily leaderboard (most common query)
CREATE INDEX IF NOT EXISTS idx_workout_submissions_daily_5k
  ON workout_submissions(leaderboard_date, time_5k_seconds ASC)
  WHERE time_5k_seconds IS NOT NULL AND activity_type = 'running';

-- Index for 10K daily leaderboard
CREATE INDEX IF NOT EXISTS idx_workout_submissions_daily_10k
  ON workout_submissions(leaderboard_date, time_10k_seconds ASC)
  WHERE time_10k_seconds IS NOT NULL AND activity_type = 'running';

-- Index for half marathon daily leaderboard
CREATE INDEX IF NOT EXISTS idx_workout_submissions_daily_half
  ON workout_submissions(leaderboard_date, time_half_seconds ASC)
  WHERE time_half_seconds IS NOT NULL AND activity_type = 'running';

-- Index for marathon daily leaderboard
CREATE INDEX IF NOT EXISTS idx_workout_submissions_daily_marathon
  ON workout_submissions(leaderboard_date, time_marathon_seconds ASC)
  WHERE time_marathon_seconds IS NOT NULL AND activity_type = 'running';

-- Index for steps daily leaderboard (descending - most steps wins)
CREATE INDEX IF NOT EXISTS idx_workout_submissions_daily_steps
  ON workout_submissions(leaderboard_date, step_count DESC)
  WHERE step_count IS NOT NULL AND activity_type = 'walking';

-- Index for leaderboard_date alone (general date filtering)
CREATE INDEX IF NOT EXISTS idx_workout_submissions_leaderboard_date
  ON workout_submissions(leaderboard_date);

-- Index for npub + date (user's daily workouts)
CREATE INDEX IF NOT EXISTS idx_workout_submissions_npub_date
  ON workout_submissions(npub, leaderboard_date);

-- =============================================
-- PHASE 7: Backfill leaderboard_date for Existing Data
-- =============================================

-- Set leaderboard_date from created_at for all existing rows
UPDATE workout_submissions
SET leaderboard_date = DATE(created_at)
WHERE leaderboard_date IS NULL AND created_at IS NOT NULL;
