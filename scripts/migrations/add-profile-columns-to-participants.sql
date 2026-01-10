-- Migration: Add profile columns to competition_participants
-- Purpose: Store name and picture so leaderboards don't need to fetch 1000s of Nostr profiles
--
-- Run this in Supabase SQL Editor:
-- 1. Go to your Supabase project dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Paste this SQL and click "Run"

-- Add name column (display name from Nostr profile)
ALTER TABLE competition_participants
ADD COLUMN IF NOT EXISTS name TEXT;

-- Add picture column (avatar URL from Nostr profile)
ALTER TABLE competition_participants
ADD COLUMN IF NOT EXISTS picture TEXT;

-- Add index for faster lookups by competition_id (if not exists)
CREATE INDEX IF NOT EXISTS idx_competition_participants_competition_id
ON competition_participants(competition_id);

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'competition_participants'
ORDER BY ordinal_position;
