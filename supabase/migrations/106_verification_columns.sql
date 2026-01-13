-- Migration: Add verification columns to workout_submissions
-- Purpose: Enable workout verification for anti-cheat leaderboard filtering
-- Date: 2026-01-12

-- Add verification columns if they don't exist
DO $$
BEGIN
    -- Add verification_code column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workout_submissions' AND column_name = 'verification_code'
    ) THEN
        ALTER TABLE workout_submissions ADD COLUMN verification_code TEXT;
        COMMENT ON COLUMN workout_submissions.verification_code IS 'HMAC-based verification code from app (16 hex chars)';
    END IF;

    -- Add verification_status column with constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workout_submissions' AND column_name = 'verification_status'
    ) THEN
        ALTER TABLE workout_submissions ADD COLUMN verification_status TEXT DEFAULT 'unverified';

        -- Add check constraint for valid status values
        ALTER TABLE workout_submissions ADD CONSTRAINT chk_verification_status
            CHECK (verification_status IN ('verified', 'unverified', 'invalid', 'legacy'));

        COMMENT ON COLUMN workout_submissions.verification_status IS 'Verification status: verified, unverified, invalid, or legacy';
    END IF;
END $$;

-- Create index for efficient leaderboard filtering by verification status
CREATE INDEX IF NOT EXISTS idx_workout_verification_status
ON workout_submissions(verification_status);

-- Create composite index for common leaderboard query pattern
CREATE INDEX IF NOT EXISTS idx_workout_leaderboard_verified
ON workout_submissions(leaderboard_date, activity_type, verification_status)
WHERE verification_status IN ('verified', 'legacy');

-- Optional: Track app versions for verification pattern management
CREATE TABLE IF NOT EXISTS app_versions (
    version TEXT PRIMARY KEY,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

COMMENT ON TABLE app_versions IS 'Tracks app versions for verification secret management';

-- Insert initial version (will need secret added to Supabase dashboard)
INSERT INTO app_versions (version, is_active, notes)
VALUES ('1.5.0', true, 'First version with verification')
ON CONFLICT (version) DO NOTHING;

-- Mark existing workouts as legacy (grandfathered in)
-- Only run this once during initial deployment
-- UPDATE workout_submissions
-- SET verification_status = 'legacy'
-- WHERE verification_status IS NULL OR verification_status = 'unverified';
