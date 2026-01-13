-- Migration: Per-workout verification codes
-- Purpose: Enable unique verification codes per workout to prevent reuse attacks
-- Date: 2026-01-12

-- Create table for per-workout verification codes
CREATE TABLE IF NOT EXISTS workout_verification_codes (
    workout_id TEXT PRIMARY KEY,
    npub TEXT NOT NULL,
    canonical_hash TEXT NOT NULL,
    verification_code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,

    CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

COMMENT ON TABLE workout_verification_codes IS 'Stores per-workout verification codes for anti-cheat validation';
COMMENT ON COLUMN workout_verification_codes.workout_id IS 'Unique workout ID (d tag from kind 1301)';
COMMENT ON COLUMN workout_verification_codes.canonical_hash IS 'Hash of immutable workout fields for validation';
COMMENT ON COLUMN workout_verification_codes.used IS 'Set to true after workout submission to prevent replay';

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires
ON workout_verification_codes(expires_at);

CREATE INDEX IF NOT EXISTS idx_verification_codes_npub
ON workout_verification_codes(npub);

-- Update verification_status constraint to include new statuses
-- First drop the old constraint, then add new one with additional statuses
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'workout_submissions' AND constraint_name = 'chk_verification_status'
    ) THEN
        ALTER TABLE workout_submissions DROP CONSTRAINT chk_verification_status;
    END IF;

    -- Add updated constraint with new statuses
    ALTER TABLE workout_submissions ADD CONSTRAINT chk_verification_status
        CHECK (verification_status IN (
            'verified',    -- Code valid, hash matches
            'unverified',  -- No code provided (old app version or network failure)
            'invalid',     -- Code provided but doesn't match expected
            'legacy',      -- Pre-verification workouts (grandfathered)
            'expired',     -- Code was valid but expired before submission
            'replay',      -- Code already used for another submission
            'tampered'     -- Hash mismatch (data modified after code generation)
        ));
END $$;

-- Function to clean up expired verification codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM workout_verification_codes
    WHERE expires_at < NOW() - INTERVAL '1 day'
    RETURNING COUNT(*) INTO deleted_count;

    RETURN COALESCE(deleted_count, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_verification_codes() IS 'Removes expired verification codes older than 1 day';
