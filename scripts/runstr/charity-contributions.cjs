#!/usr/bin/env node
/**
 * RUNSTR Charity Contributions Report
 *
 * Shows which charities are being supported through RUNSTR workouts.
 * Extracts team tags from workout submissions to track charity activity.
 *
 * Usage: node scripts/runstr/charity-contributions.cjs
 *
 * Output:
 * - Charities with active users
 * - Total workouts per charity
 * - Unique users per charity
 * - Estimated sats impact (workouts × 50 sats)
 */

require('dotenv').config();

// Supabase configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables');
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Known charities (from src/constants/charities.ts)
const CHARITIES = {
  'bitcoin-bay': { name: 'Bitcoin Bay', lightningAddress: 'sats@donate.bitcoinbay.foundation' },
  'bitcoin-ekasi': { name: 'Bitcoin Ekasi', lightningAddress: 'bitcoinekasi@primal.net' },
  'bitcoin-isla': { name: 'Bitcoin Isla', lightningAddress: 'BTCIsla@primal.net' },
  'bitcoin-district': { name: 'Bitcoin District', lightningAddress: 'bdi@strike.me' },
  'bitcoin-beach': { name: 'Bitcoin Beach', lightningAddress: 'bitcoinbeach@primal.net' },
  'bitcoin-jungle': { name: 'Bitcoin Jungle', lightningAddress: 'bitcoinjungle@primal.net' },
  'opensats': { name: 'OpenSats', lightningAddress: 'opensats@vlt.ge' },
  'bitcoin-smiles': { name: 'Bitcoin Smiles', lightningAddress: 'bitcoinsmiles@primal.net' },
  'mi-primer-bitcoin': { name: 'Mi Primer Bitcoin', lightningAddress: 'miPrimerBitcoin@primal.net' },
  'bitcoin-dada': { name: 'Bitcoin Dada', lightningAddress: 'bitcoindada@primal.net' },
};

// Reward amount per workout (from REWARD_CONFIG)
const SATS_PER_WORKOUT = 50;

/**
 * Fetch all workout submissions from Supabase
 */
async function fetchWorkouts() {
  console.log('Fetching workouts from Supabase...');

  // Get count first
  const countUrl = `${SUPABASE_URL}/rest/v1/workout_submissions?select=count`;
  const countResponse = await fetch(countUrl, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'count=exact',
    },
  });

  const totalCount = countResponse.headers.get('content-range')?.split('/')[1] || 'unknown';
  console.log(`Total workouts in database: ${totalCount}`);

  // Fetch all workouts with raw_event
  const url = `${SUPABASE_URL}/rest/v1/workout_submissions?select=npub,raw_event,created_at&limit=10000`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch workouts: ${response.status}`);
  }

  return response.json();
}

/**
 * Extract team tag from a workout's raw_event
 */
function getTeamTag(rawEvent) {
  if (!rawEvent || !rawEvent.tags) return null;

  const teamTag = rawEvent.tags.find((t) => t[0] === 'team');
  return teamTag ? teamTag[1] : null;
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('  RUNSTR Charity Contributions Report');
  console.log('='.repeat(60));
  console.log('');

  const workouts = await fetchWorkouts();
  console.log(`Analyzing ${workouts.length} workouts...\n`);

  // Aggregate by charity
  const charityStats = {};
  let workoutsWithTeam = 0;
  let workoutsWithoutTeam = 0;

  for (const workout of workouts) {
    const teamId = getTeamTag(workout.raw_event);

    if (teamId) {
      workoutsWithTeam++;

      if (!charityStats[teamId]) {
        charityStats[teamId] = {
          workoutCount: 0,
          users: new Set(),
          firstWorkout: workout.created_at,
          lastWorkout: workout.created_at,
        };
      }

      charityStats[teamId].workoutCount++;
      charityStats[teamId].users.add(workout.npub);

      // Track date range
      if (workout.created_at < charityStats[teamId].firstWorkout) {
        charityStats[teamId].firstWorkout = workout.created_at;
      }
      if (workout.created_at > charityStats[teamId].lastWorkout) {
        charityStats[teamId].lastWorkout = workout.created_at;
      }
    } else {
      workoutsWithoutTeam++;
    }
  }

  // Display results
  console.log('-'.repeat(60));
  console.log('  CHARITY ACTIVITY SUMMARY');
  console.log('-'.repeat(60));
  console.log('');

  const sortedCharities = Object.entries(charityStats)
    .map(([id, stats]) => ({
      id,
      name: CHARITIES[id]?.name || id,
      lightningAddress: CHARITIES[id]?.lightningAddress || 'Unknown',
      workoutCount: stats.workoutCount,
      userCount: stats.users.size,
      estimatedSats: stats.workoutCount * SATS_PER_WORKOUT,
    }))
    .sort((a, b) => b.workoutCount - a.workoutCount);

  if (sortedCharities.length === 0) {
    console.log('  No charity-tagged workouts found.\n');
  } else {
    let totalWorkouts = 0;
    let totalUsers = new Set();
    let totalSats = 0;

    for (const charity of sortedCharities) {
      console.log(`  ${charity.name}`);
      console.log(`    ID: ${charity.id}`);
      console.log(`    Lightning: ${charity.lightningAddress}`);
      console.log(`    Workouts: ${charity.workoutCount}`);
      console.log(`    Users: ${charity.userCount}`);
      console.log(`    Est. Impact: ${charity.estimatedSats.toLocaleString()} sats`);
      console.log('');

      totalWorkouts += charity.workoutCount;
      totalSats += charity.estimatedSats;
    }

    console.log('-'.repeat(60));
    console.log('  TOTALS');
    console.log('-'.repeat(60));
    console.log(`  Charities active: ${sortedCharities.length}`);
    console.log(`  Workouts with team tag: ${workoutsWithTeam}`);
    console.log(`  Workouts without team tag: ${workoutsWithoutTeam}`);
    console.log(`  Estimated total impact: ${totalSats.toLocaleString()} sats`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('  NOTE: This shows workout activity, not actual donations.');
  console.log('  Actual donation amounts are tracked locally on devices.');
  console.log('='.repeat(60));
  console.log('');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
