-- Migration: Daily reward claims tracking
-- Purpose: Rate limit rewards by Lightning address to prevent farming abuse
-- Date: 2026-01-12

-- Create table for tracking daily reward claims by Lightning address hash
CREATE TABLE IF NOT EXISTS daily_reward_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lightning_address_hash TEXT NOT NULL,  -- SHA256 hash, not plaintext for privacy
    reward_date DATE NOT NULL DEFAULT CURRENT_DATE,
    workout_claimed BOOLEAN NOT NULL DEFAULT FALSE,
    step_sats_claimed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One record per LN address hash per day
    CONSTRAINT unique_ln_hash_date UNIQUE (lightning_address_hash, reward_date),

    -- Ensure step sats don't exceed daily cap
    CONSTRAINT chk_step_sats_cap CHECK (step_sats_claimed >= 0 AND step_sats_claimed <= 50)
);

COMMENT ON TABLE daily_reward_claims IS 'Tracks daily reward claims by hashed Lightning address to prevent farming abuse';
COMMENT ON COLUMN daily_reward_claims.lightning_address_hash IS 'SHA256 hash of Lightning address (lowercase, trimmed) - privacy preserving';
COMMENT ON COLUMN daily_reward_claims.workout_claimed IS 'Whether the daily workout reward (50 sats) has been claimed';
COMMENT ON COLUMN daily_reward_claims.step_sats_claimed IS 'Total step reward sats claimed today (capped at 50)';

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ln_hash_date
ON daily_reward_claims(lightning_address_hash, reward_date);

-- Create index for cleanup of old records
CREATE INDEX IF NOT EXISTS idx_reward_date
ON daily_reward_claims(reward_date);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_daily_reward_claims_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_daily_reward_claims_updated_at ON daily_reward_claims;
CREATE TRIGGER trigger_update_daily_reward_claims_updated_at
    BEFORE UPDATE ON daily_reward_claims
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_reward_claims_updated_at();

-- Function to clean up old records (optional, can run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_reward_claims()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Keep 30 days of history for analytics, delete older
    DELETE FROM daily_reward_claims
    WHERE reward_date < CURRENT_DATE - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_reward_claims() IS 'Removes reward claim records older than 30 days';
