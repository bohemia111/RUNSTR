/**
 * Migrate Season 2 Baseline to Supabase
 *
 * This script imports the pre-computed baseline data into Supabase so that
 * users don't lose their progress when switching to database-backed leaderboards.
 *
 * Run with: npx tsx scripts/migrate-baseline-to-supabase.ts
 *
 * IMPORTANT: Run this ONCE before switching to Supabase leaderboards.
 * Running multiple times will NOT create duplicates (uses onConflict).
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { nip19 } from 'nostr-tools';
import {
  SEASON2_BASELINE,
  BASELINE_TIMESTAMP,
} from '../src/constants/season2Baseline';

// Load .env file
dotenv.config();

// Supabase configuration - use environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://cvoepeskjueskdfrpsnv.supabase.co';
// Try service role key first, fall back to anon key
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_KEY) {
  console.error('❌ No Supabase key found.');
  console.error('   Option 1: Set SUPABASE_SERVICE_ROLE_KEY (for full access)');
  console.error('   Option 2: Set EXPO_PUBLIC_SUPABASE_ANON_KEY in .env (may work with RLS)');
  process.exit(1);
}

// Warn if using anon key
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('⚠️  Using anon key - inserts may fail if RLS policies block them.');
  console.warn('   For guaranteed success, set SUPABASE_SERVICE_ROLE_KEY\n');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Competition IDs from your Supabase database
const COMPETITION_IDS = {
  running: 'season2-running',
  walking: 'season2-walking',
  cycling: 'season2-cycling',
};

interface MigrationStats {
  participantsAdded: number;
  workoutsAdded: number;
  errors: string[];
}

async function getCompetitionId(externalId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('competitions')
    .select('id')
    .eq('external_id', externalId)
    .single();

  if (error || !data) {
    console.error(`❌ Competition not found: ${externalId}`);
    return null;
  }
  return data.id;
}

function hexToNpub(hex: string): string {
  try {
    return nip19.npubEncode(hex);
  } catch {
    return hex; // Return hex if conversion fails
  }
}

async function migrateBaseline(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    participantsAdded: 0,
    workoutsAdded: 0,
    errors: [],
  };

  console.log('\n🚀 Starting Season 2 Baseline Migration to Supabase\n');
  console.log(`📅 Baseline timestamp: ${new Date(BASELINE_TIMESTAMP * 1000).toISOString()}`);
  console.log(`👥 Users in baseline: ${Object.keys(SEASON2_BASELINE).length}\n`);

  // Get competition UUIDs
  const competitionIds: Record<string, string> = {};
  for (const [activity, externalId] of Object.entries(COMPETITION_IDS)) {
    const id = await getCompetitionId(externalId);
    if (id) {
      competitionIds[activity] = id;
      console.log(`✅ Found competition: ${externalId} -> ${id}`);
    } else {
      stats.errors.push(`Competition not found: ${externalId}`);
    }
  }

  if (Object.keys(competitionIds).length === 0) {
    console.error('\n❌ No competitions found. Please create them first.');
    return stats;
  }

  console.log('\n--- Processing Users ---\n');

  // Process each user in the baseline
  for (const [hexPubkey, userData] of Object.entries(SEASON2_BASELINE)) {
    const npub = hexToNpub(hexPubkey);
    console.log(`\n👤 Processing: ${hexPubkey.slice(0, 12)}...`);

    // Process each activity type
    for (const [activity, totals] of Object.entries(userData)) {
      if (totals.distance === 0 && totals.count === 0) {
        continue; // Skip activities with no data
      }

      const competitionId = competitionIds[activity];
      if (!competitionId) {
        continue;
      }

      // 1. Add as participant
      const { error: participantError } = await supabase
        .from('competition_participants')
        .upsert(
          {
            competition_id: competitionId,
            npub: npub,
            joined_at: new Date(BASELINE_TIMESTAMP * 1000).toISOString(),
          },
          { onConflict: 'competition_id,npub' }
        );

      if (participantError) {
        stats.errors.push(`Participant error for ${hexPubkey.slice(0, 8)}: ${participantError.message}`);
      } else {
        stats.participantsAdded++;
      }

      // 2. Add baseline workout submission
      // Use a deterministic event_id so re-running doesn't create duplicates
      const baselineEventId = `baseline-${hexPubkey}-${activity}`;

      const { error: workoutError } = await supabase
        .from('workout_submissions')
        .upsert(
          {
            npub: npub,
            event_id: baselineEventId,
            activity_type: activity,
            distance_meters: totals.distance * 1000, // Convert km to meters
            duration_seconds: totals.duration,
            calories: null, // Not tracked in baseline
            created_at: new Date(BASELINE_TIMESTAMP * 1000).toISOString(),
            raw_event: {
              type: 'baseline_migration',
              source: 'season2Baseline.ts',
              migrated_at: new Date().toISOString(),
              original_hex_pubkey: hexPubkey,
              workout_count: totals.count,
              note: 'Pre-computed total from Nostr 1301 events',
            },
          },
          { onConflict: 'event_id' }
        );

      if (workoutError) {
        stats.errors.push(`Workout error for ${hexPubkey.slice(0, 8)} ${activity}: ${workoutError.message}`);
      } else {
        stats.workoutsAdded++;
        console.log(`   ✅ ${activity}: ${totals.distance.toFixed(2)} km (${totals.count} workouts)`);
      }
    }
  }

  return stats;
}

async function verifyMigration() {
  console.log('\n--- Verification ---\n');

  // Count participants per competition
  for (const [activity, externalId] of Object.entries(COMPETITION_IDS)) {
    const { data: competition } = await supabase
      .from('competitions')
      .select('id')
      .eq('external_id', externalId)
      .single();

    if (competition) {
      const { count: participantCount } = await supabase
        .from('competition_participants')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', competition.id);

      const { count: workoutCount } = await supabase
        .from('workout_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('activity_type', activity);

      console.log(`${activity}: ${participantCount} participants, ${workoutCount} workout submissions`);
    }
  }

  // Show top 5 by distance for running
  console.log('\n--- Top 5 Running (Verification) ---\n');
  const { data: topRunning } = await supabase
    .from('workout_submissions')
    .select('npub, distance_meters')
    .eq('activity_type', 'running')
    .order('distance_meters', { ascending: false })
    .limit(5);

  topRunning?.forEach((entry, i) => {
    const km = (entry.distance_meters / 1000).toFixed(2);
    console.log(`${i + 1}. ${entry.npub.slice(0, 20)}... - ${km} km`);
  });
}

async function main() {
  try {
    const stats = await migrateBaseline();

    console.log('\n========================================');
    console.log('           MIGRATION COMPLETE          ');
    console.log('========================================\n');
    console.log(`✅ Participants added: ${stats.participantsAdded}`);
    console.log(`✅ Workouts added: ${stats.workoutsAdded}`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors (${stats.errors.length}):`);
      stats.errors.forEach((e) => console.log(`   - ${e}`));
    }

    await verifyMigration();

    console.log('\n✅ Migration complete! You can now use Supabase leaderboards.\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
