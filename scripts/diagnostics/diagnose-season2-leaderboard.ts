#!/usr/bin/env tsx
/**
 * Diagnose Season 2 Leaderboard
 *
 * Queries kind 1301 workouts for the 38 hardcoded Season 2 participants
 * within the season timeframe (Jan 1 - Mar 1, 2026) and calculates
 * what the leaderboard SHOULD show.
 *
 * Usage: npx tsx scripts/diagnostics/diagnose-season2-leaderboard.ts
 */

import NDK, { NDKFilter, NDKEvent } from '@nostr-dev-kit/ndk';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

// Season 2 dates
const SEASON_START = '2026-01-01T00:00:00Z';
const SEASON_END = '2026-03-01T23:59:59Z';

// Hardcoded Season 2 participants (from constants/season2.ts)
const SEASON_2_PARTICIPANTS = [
  { pubkey: '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5', name: 'TheWildHustle' },
  { pubkey: '745eb529d0e42d2fa6c904bbc2c10702deae964b4dd3079803ab8b43536dda12', name: 'guy' },
  { pubkey: 'dae73fdd90d98db1a8405bcecac60cd6ce8d10896a6a2c5e04011125e16cd432', name: 'Lhasa Sensei' },
  { pubkey: '43256bc0859462cf14fa7de594a48babdf189b91abe27f88d824abf69b2343c9', name: 'LOPES' },
  { pubkey: 'e7df627c638d934b37548d8408b43dc5d4762fa270c26abec5916bff62aac80d', name: 'KjetilR' },
  { pubkey: '9358c67695d9e78bde2bf3ce1eb0a5059553687632a177e7d25deeff9f2912fc', name: 'Kamo Weasel' },
  { pubkey: 'c9943d8f8e9c2aa9facb6e579af6ec38b7205c0570de1b0fb8f99f65dc5f786e', name: 'Zed' },
  { pubkey: '6b42a3b227b086e850ff659a151863ce070eb60d32bae8a4618928655effc3f6', name: 'JokerHasse' },
  { pubkey: '0c252c138ee446b6f9c0964ff609380fc82e52c8d318529607f293fcdf828bea', name: 'Busch21' },
  { pubkey: 'c8b22b81877eaa54e1ab21e39824f85a29e61f71da9fbabbef8930b171b98da8', name: 'Hoov' },
  { pubkey: '8ce975f57dd070c4293ff8f978b869e20b2cdf4c81f277b46f3676b262c5e823', name: 'clemsy' },
  { pubkey: '9fce3aea32b35637838fb45b75be32595742e16bb3e4742cc82bb3d50f9087e6', name: 'MAKE SONGS LONGER' },
  { pubkey: 'e5237023a5c0929e7ae0e5128d41a8213138400ec110dbe9d8a29278f22b7c13', name: 'Helen Yrmom' },
  { pubkey: '02734f19cae7850e7bca6c0a2bb6a534f152d5acbd86eece1d2bfbd5d6502003', name: 'bitcoin_rene' },
  { pubkey: '939ffb4e552ed5c0fa780985ab7163f441798409ae7ed81c62c07ac4683b4222', name: 'Johan' },
  { pubkey: '5a654b6394bb83ecc1b95f848d6bc44e6d21120de5d832040704d9823b2c0af4', name: 'Drew' },
  { pubkey: '5d405752c1b4ddd0714baf3ce415db52e5506036f345ff575ee16e2b4cf189bf', name: 'Heiunter' },
  { pubkey: '14ca97caaea1565dc3f8277394a8f7d03364745a8d18536d8423dbac3f363b7f', name: 'Satty' },
  { pubkey: 'de7ab932ca17278b2144a6628c3531a0628fcc7b58074111d6e5b949ecb0e377', name: "Harambe's last Bitcoin" },
  { pubkey: 'a80fc4a78634ee26aabcac951b4cfd7b56ae18babd33c5afdcf6bed6dc80ebd1', name: 'Uno' },
  { pubkey: 'a723805cda67251191c8786f4da58f797e6977582301354ba8e91bcb0342dc9c', name: 'Seth' },
  { pubkey: '0ae9dc5f42febd11c5c895b0af0bbabbe02261591b0f24eefe22c0d9ca8d0286', name: 'MoonKaptain' },
  { pubkey: 'fad80b7451b03f686fd9e487b05b69c04c808e26a1db655e59e0e296a5c9f4dd', name: 'means' },
  { pubkey: 'a9046cc9175dc5a45fb93a2c890f9a8b18c707fa6d695771aab9300081d3e21a', name: 'Ben Cousens' },
  { pubkey: '20d29810d6a5f92b045ade02ebbadc9036d741cc686b00415c42b4236fe4ad2f', name: 'negr0' },
  { pubkey: 'ea28488b659ab6433167cd024eb72e01a375ac17ce54a1cdc6e5dce2f6d93923', name: 'johnny9' },
  { pubkey: 'c6f0f4279f12200f77e1943cd26aaedf6081fda8585695f9a923b4723686da12', name: 'Tumbleweed' },
  { pubkey: '661305095522a18a1095b7b86874ef618da9c5d1ba5f4af375688e2129c07317', name: 'Ajax' },
  { pubkey: '933a52008116743cd652eca47209f57e4ca4c439d8c2526d8c48a47bf7072ec7', name: 'Nell' },
  { pubkey: '312f54da0da1cf0cdcf1d6385fa8d6e5d8218f7122297d30b22482edada44649', name: 'HumbleStacker' },
  { pubkey: '9416112efa3cdc0675156e4cb6ae46b2cca51973065c61bcbc002ca99e5dcdf2', name: 'Lat51_Training' },
  { pubkey: '0f563fe2cfdf180cb104586b95873379a0c1fdcfbc301a80c8255f33d15f039d', name: 'Patrick' },
  { pubkey: 'd84517802a434757c56ae8642bffb4d26e5ade0712053750215680f5896e579b', name: 'ObjectiF MooN' },
  { pubkey: 'eeb11961b25442b16389fe6c7ebea9adf0ac36dd596816ea7119e521b8821b9e', name: 'OpenMike' },
  { pubkey: '81b91540daeee031df309460a9bcf5866a54c70217ff173bcdefd1982f12b0ba', name: 'Aaron Tomac' },
  { pubkey: '7ebbce1843a17cd778a5e169e3d2f679f5ac7b5125d1c43d265e190f7b27538c', name: 'Adrien Lacombe' },
  { pubkey: '179154c2b30226578a14ac5a01f50a3efde8d14032df96371550e1210fffd892', name: 'Awakening Mind' },
  { pubkey: '1f698bd4b5dda804316f09773f903ca699cf5b2a0fcd5b3fe6e0709668d58e60', name: 'Dani' },
  { pubkey: '86f7eea066dd4dc574d01b0f9317a03508887f815fb58d8ef66873cc42fe3431', name: 'Taljarn' },
];

type ActivityType = 'running' | 'walking' | 'cycling';

interface ParsedWorkout {
  id: string;
  pubkey: string;
  name: string;
  activityType: ActivityType;
  distance: number; // km
  createdAt: number;
  charityId?: string;
}

interface LeaderboardEntry {
  rank: number;
  pubkey: string;
  name: string;
  totalDistance: number;
  workoutCount: number;
}

let ndk: NDK;
const participantMap = new Map(SEASON_2_PARTICIPANTS.map(p => [p.pubkey, p.name]));

async function main() {
  console.log('🏃 RUNSTR Season 2 Leaderboard Diagnostics');
  console.log('==========================================\n');
  console.log(`📅 Season dates: ${SEASON_START} to ${SEASON_END}`);
  console.log(`👥 Participants: ${SEASON_2_PARTICIPANTS.length} hardcoded users\n`);

  // Initialize NDK
  console.log('🌐 Connecting to Nostr relays...');
  ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });

  await ndk.connect();
  await new Promise(resolve => setTimeout(resolve, 2000));

  const connectedRelays = ndk.pool.connectedRelays();
  console.log(`   ✅ Connected to ${connectedRelays.length} relays\n`);

  // Calculate timestamps
  const since = Math.floor(new Date(SEASON_START).getTime() / 1000);
  const until = Math.floor(new Date(SEASON_END).getTime() / 1000);

  console.log('📊 Query Parameters:');
  console.log(`   Since: ${new Date(since * 1000).toISOString()}`);
  console.log(`   Until: ${new Date(until * 1000).toISOString()}`);
  console.log(`   Authors: ${SEASON_2_PARTICIPANTS.length} pubkeys`);
  console.log();

  // Query workouts for all participants
  const hexPubkeys = SEASON_2_PARTICIPANTS.map(p => p.pubkey);

  const filter: NDKFilter = {
    kinds: [1301 as any],
    authors: hexPubkeys,
    since,
    until,
    limit: 3000,
  };

  console.log('📡 Fetching kind 1301 workout events...\n');

  const events = await fetchWithTimeout(filter, 15000);
  console.log(`✅ Found ${events.size} total workout events\n`);

  // Parse all workouts
  const allWorkouts: ParsedWorkout[] = [];
  const parseErrors: string[] = [];

  for (const event of events) {
    const workout = parseWorkoutEvent(event);
    if (workout) {
      allWorkouts.push(workout);
    } else {
      parseErrors.push(event.id.slice(0, 8));
    }
  }

  console.log(`📋 Parsed ${allWorkouts.length} valid workouts (${parseErrors.length} skipped)\n`);

  // Show raw event stats
  console.log('============================================================');
  console.log('📊 RAW WORKOUT BREAKDOWN');
  console.log('============================================================\n');

  // Count by activity type
  const byType = { running: 0, walking: 0, cycling: 0, other: 0 };
  for (const w of allWorkouts) {
    if (w.activityType in byType) {
      byType[w.activityType]++;
    }
  }
  console.log('Workouts by activity type:');
  console.log(`   Running: ${byType.running}`);
  console.log(`   Walking: ${byType.walking}`);
  console.log(`   Cycling: ${byType.cycling}`);
  console.log();

  // Count unique users with workouts
  const uniqueUsers = new Set(allWorkouts.map(w => w.pubkey));
  console.log(`Unique users with workouts: ${uniqueUsers.size}/${SEASON_2_PARTICIPANTS.length}\n`);

  // Show all individual workouts
  console.log('============================================================');
  console.log('📋 ALL WORKOUTS (sorted by date, newest first)');
  console.log('============================================================\n');

  allWorkouts.sort((a, b) => b.createdAt - a.createdAt);

  for (let i = 0; i < Math.min(allWorkouts.length, 100); i++) {
    const w = allWorkouts[i];
    const date = new Date(w.createdAt * 1000).toISOString().split('T')[0];
    const time = new Date(w.createdAt * 1000).toTimeString().split(' ')[0];
    console.log(`${i + 1}. [${date} ${time}] ${w.name}`);
    console.log(`   ${w.activityType.toUpperCase()} - ${w.distance.toFixed(2)} km`);
    console.log(`   Event ID: ${w.id.slice(0, 16)}...`);
    console.log();
  }

  if (allWorkouts.length > 100) {
    console.log(`... and ${allWorkouts.length - 100} more workouts\n`);
  }

  // Calculate leaderboards for each activity type
  console.log('============================================================');
  console.log('🏆 CALCULATED LEADERBOARDS');
  console.log('============================================================\n');

  for (const activityType of ['running', 'walking', 'cycling'] as ActivityType[]) {
    const typeWorkouts = allWorkouts.filter(w => w.activityType === activityType);
    const leaderboard = calculateLeaderboard(typeWorkouts, activityType);

    console.log(`\n🏃 ${activityType.toUpperCase()} LEADERBOARD`);
    console.log('─'.repeat(50));
    console.log(`Total workouts: ${typeWorkouts.length}`);
    console.log(`Users with workouts: ${leaderboard.length}\n`);

    if (leaderboard.length === 0) {
      console.log('   (No workouts recorded)');
    } else {
      for (const entry of leaderboard.slice(0, 20)) {
        const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank.toString().padStart(2)}`;
        console.log(`   ${medal} ${entry.name.padEnd(20)} ${entry.totalDistance.toFixed(2).padStart(8)} km (${entry.workoutCount} workouts)`);
      }
      if (leaderboard.length > 20) {
        console.log(`   ... and ${leaderboard.length - 20} more participants`);
      }
    }
  }

  // Summary
  console.log('\n============================================================');
  console.log('📊 SUMMARY');
  console.log('============================================================\n');

  const runningTotal = allWorkouts.filter(w => w.activityType === 'running').reduce((sum, w) => sum + w.distance, 0);
  const walkingTotal = allWorkouts.filter(w => w.activityType === 'walking').reduce((sum, w) => sum + w.distance, 0);
  const cyclingTotal = allWorkouts.filter(w => w.activityType === 'cycling').reduce((sum, w) => sum + w.distance, 0);

  console.log(`Total Running Distance: ${runningTotal.toFixed(2)} km`);
  console.log(`Total Walking Distance: ${walkingTotal.toFixed(2)} km`);
  console.log(`Total Cycling Distance: ${cyclingTotal.toFixed(2)} km`);
  console.log(`Combined Total: ${(runningTotal + walkingTotal + cyclingTotal).toFixed(2)} km\n`);

  // Show users with NO workouts
  const usersWithWorkouts = new Set(allWorkouts.map(w => w.pubkey));
  const usersWithNoWorkouts = SEASON_2_PARTICIPANTS.filter(p => !usersWithWorkouts.has(p.pubkey));

  if (usersWithNoWorkouts.length > 0) {
    console.log(`⚠️ Participants with NO workouts (${usersWithNoWorkouts.length}):`);
    for (const user of usersWithNoWorkouts) {
      console.log(`   - ${user.name} (${user.pubkey.slice(0, 12)}...)`);
    }
  }

  console.log('\n✅ Diagnostics complete\n');
  process.exit(0);
}

async function fetchWithTimeout(filter: NDKFilter, timeoutMs: number): Promise<Set<NDKEvent>> {
  return new Promise((resolve) => {
    const collectedEvents = new Set<NDKEvent>();
    let eoseReceived = false;

    const subscription = ndk.subscribe(filter, {
      closeOnEose: false,
    });

    subscription.on('event', (event: NDKEvent) => {
      collectedEvents.add(event);
    });

    subscription.on('eose', () => {
      eoseReceived = true;
    });

    const checkInterval = setInterval(() => {
      if (eoseReceived) {
        clearInterval(checkInterval);
        subscription.stop();
        resolve(collectedEvents);
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkInterval);
      subscription.stop();
      if (!eoseReceived) {
        console.log(`   ⚠️ Timeout before EOSE - collected ${collectedEvents.size} events`);
      }
      resolve(collectedEvents);
    }, timeoutMs);
  });
}

function parseWorkoutEvent(event: NDKEvent): ParsedWorkout | null {
  try {
    const getTag = (name: string) => event.tags.find(t => t[0] === name)?.[1];

    const exerciseType = getTag('exercise')?.toLowerCase();
    const distanceStr = getTag('distance');

    if (!exerciseType || !distanceStr) {
      return null;
    }

    // Parse distance
    const distance = parseFloat(distanceStr);
    if (isNaN(distance) || distance <= 0) {
      return null;
    }

    // Detect activity type (same logic as Season2Service)
    let activityType: ActivityType | null = null;
    if (exerciseType.includes('run') || exerciseType.includes('jog') || exerciseType === 'running') {
      activityType = 'running';
    } else if (exerciseType.includes('walk') || exerciseType.includes('hike') || exerciseType === 'walking') {
      activityType = 'walking';
    } else if (exerciseType.includes('cycl') || exerciseType.includes('bike') || exerciseType === 'cycling') {
      activityType = 'cycling';
    } else if (exerciseType === 'other' && distanceStr) {
      activityType = 'running'; // Default "other" with distance to running
    }

    if (!activityType) {
      return null;
    }

    const charityTag = event.tags.find(t => t[0] === 'charity');
    const name = participantMap.get(event.pubkey) || event.pubkey.slice(0, 12) + '...';

    return {
      id: event.id,
      pubkey: event.pubkey,
      name,
      activityType,
      distance,
      createdAt: event.created_at || 0,
      charityId: charityTag?.[1],
    };
  } catch (error) {
    return null;
  }
}

function calculateLeaderboard(workouts: ParsedWorkout[], activityType: ActivityType): LeaderboardEntry[] {
  // Aggregate by user
  const userStats = new Map<string, { distance: number; count: number }>();

  for (const workout of workouts) {
    const existing = userStats.get(workout.pubkey) || { distance: 0, count: 0 };
    existing.distance += workout.distance;
    existing.count += 1;
    userStats.set(workout.pubkey, existing);
  }

  // Build entries
  const entries: LeaderboardEntry[] = [];
  for (const [pubkey, stats] of userStats) {
    entries.push({
      rank: 0,
      pubkey,
      name: participantMap.get(pubkey) || pubkey.slice(0, 12) + '...',
      totalDistance: stats.distance,
      workoutCount: stats.count,
    });
  }

  // Sort by distance (descending)
  entries.sort((a, b) => b.totalDistance - a.totalDistance);

  // Assign ranks
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
}

main().catch((error) => {
  console.error('❌ Script error:', error);
  process.exit(1);
});
