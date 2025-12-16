#!/usr/bin/env tsx
/**
 * Publish Test Workout Script
 *
 * Purpose: Publish a synthetic 12km workout to test leaderboard creation
 *
 * This will create:
 * - 12km running workout
 * - 12 kilometer splits (qualifies for 5K + 10K leaderboards)
 * - RUNSTR team tag
 * - All required tags per KIND_1301_SPEC.md
 */

import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

// Configuration
const RUNSTR_TEAM_ID = '87d30c8b-aa18-4424-a629-d41ea7f89078';

// Get nsec from command line argument
const USER_NSEC = process.argv[2];

if (!USER_NSEC || !USER_NSEC.startsWith('nsec1')) {
  console.error('❌ Error: Please provide your nsec as a command line argument');
  console.error('Usage: npx tsx scripts/publish-test-workout.ts nsec1...');
  process.exit(1);
}

// Nostr relays
const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function generateSplits(numKm: number, paceSecondsPerKm: number): Array<[string, string, string]> {
  const splits: Array<[string, string, string]> = [];

  for (let km = 1; km <= numKm; km++) {
    const elapsedSeconds = km * paceSecondsPerKm;
    const timeStr = formatTime(elapsedSeconds);

    splits.push(['split', km.toString(), timeStr]);
  }

  return splits;
}

async function main() {
  console.log('🏃 Publishing Test 12K Workout to Nostr\n');
  console.log('================================================\n');

  // Workout parameters
  const distanceKm = 12.0;
  const paceSecondsPerKm = 300; // 5:00/km pace
  const durationSeconds = distanceKm * paceSecondsPerKm; // 60 minutes
  const caloriesBurned = Math.round(distanceKm * 65); // ~65 cal/km

  console.log('📊 Workout Details:');
  console.log(`   Distance: ${distanceKm}km`);
  console.log(`   Duration: ${formatTime(durationSeconds)} (${durationSeconds}s)`);
  console.log(`   Pace: ${formatTime(paceSecondsPerKm)}/km`);
  console.log(`   Calories: ${caloriesBurned}`);
  console.log(`   Splits: ${distanceKm} kilometers\n`);

  // Generate splits
  const splits = generateSplits(distanceKm, paceSecondsPerKm);

  console.log('🎯 Generated Splits:');
  splits.forEach(([_, km, time]) => {
    const kmNum = parseInt(km);
    const marker = kmNum === 5 ? ' ← 5K TIME' :
                  kmNum === 10 ? ' ← 10K TIME' : '';
    console.log(`   Split ${km}: ${time}${marker}`);
  });
  console.log();

  // Decode nsec
  console.log('🔐 Decoding nsec...');
  const decoded = nip19.decode(USER_NSEC);
  const privateKeyHex = decoded.data as string;

  // Create signer
  const signer = new NDKPrivateKeySigner(privateKeyHex);
  const user = await signer.user();
  const npub = user.npub;

  console.log(`   ✅ User: ${npub}\n`);

  // Initialize NDK
  console.log('🌐 Connecting to Nostr relays...');
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
    signer,
  });

  await ndk.connect();
  console.log(`   ✅ Connected to ${ndk.pool.connectedRelays().length} relays\n`);

  // Create event
  console.log('📝 Creating kind 1301 event...');

  const now = Math.floor(Date.now() / 1000);
  const startTime = now - durationSeconds;

  const content = `Completed a 12.0km run in ${formatTime(durationSeconds)}! 🏃‍♂️`;

  const tags: string[][] = [
    // REQUIRED TAGS (app parser expects these)
    ['d', `workout_${Date.now()}`],               // Unique workout ID
    ['title', 'Test 12K Running Workout'],        // Display name
    ['exercise', 'running'],                      // ⭐ CRITICAL - Activity type (parser requires this)
    ['source', 'RUNSTR'],                         // App identifier
    ['client', 'RUNSTR', '0.8.4'],               // Version tracking

    // CORRECTED EXISTING TAGS
    ['distance', distanceKm.toString(), 'km'],    // Format: ['distance', '12.0', 'km']
    ['duration', formatTime(durationSeconds)],    // Format: ['duration', '01:00:00'] NOT seconds
    ['calories', caloriesBurned.toString()],      // Format: ['calories', '780']
    ['t', 'Running'],                             // Capitalized hashtag (not 'running')
    ['team', RUNSTR_TEAM_ID],                     // Team tag for leaderboards
    ['workout_start_time', startTime.toString()], // Unix timestamp

    // SPLITS (already correct format)
    ...splits,  // Format: ['split', '1', '00:05:00'], ['split', '2', '00:10:00'], etc.
  ];

  const event = new NDKEvent(ndk);
  event.kind = 1301;
  event.content = content;
  event.tags = tags;
  event.created_at = now;

  console.log(`   ✅ Event created\n`);

  console.log('📋 Event Preview:');
  console.log(`   Kind: ${event.kind}`);
  console.log(`   Content: ${event.content}`);
  console.log(`   Tags (${tags.length} total):`);
  console.log(`      - team: ${RUNSTR_TEAM_ID}`);
  console.log(`      - distance: ${distanceKm}km`);
  console.log(`      - duration: ${formatTime(durationSeconds)}`);
  console.log(`      - splits: ${splits.length} kilometers`);
  console.log();

  // Publish event
  console.log('📤 Publishing to Nostr relays...');

  try {
    await event.sign(signer);
    await event.publish();

    console.log(`   ✅ Event published!\n`);
    console.log('📋 Event Details:');
    console.log(`   Event ID: ${event.id}`);
    console.log(`   Author: ${npub}`);
    console.log(`   Timestamp: ${new Date(event.created_at! * 1000).toLocaleString()}\n`);

    console.log('🏆 Expected Leaderboards:');
    console.log('   ✅ 5K Leaderboard (12 splits ≥ 5 required)');
    console.log(`      Your 5K time: ${splits[4][2]} (split #5)`);
    console.log('   ✅ 10K Leaderboard (12 splits ≥ 10 required)');
    console.log(`      Your 10K time: ${splits[9][2]} (split #10)\n`);

    console.log('✨ Next Steps:');
    console.log('   1. Refresh SimpleTeamScreen in the app');
    console.log('   2. Look for "Events" section');
    console.log('   3. Should see TWO leaderboards: 5K and 10K');
    console.log('   4. Your workout should appear in both\n');

    console.log('🔍 Verify on Nostr:');
    console.log(`   https://nostr.band/?q=${event.id}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error publishing event:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script error:', error);
  process.exit(1);
});
