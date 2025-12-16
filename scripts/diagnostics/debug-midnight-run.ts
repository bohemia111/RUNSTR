/**
 * Debug Midnight Run Event - Check all data sources
 *
 * This script checks:
 * 1. RSVPs on Nostr (kind 31925)
 * 2. Workouts from participants (kind 1301)
 * 3. The specific pubkey that has the workout
 */

import NDK, { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

const KIND_CALENDAR_RSVP = 31925;
const KIND_WORKOUT = 1301;

// Midnight Run Event Details
const EVENT_ID = 'midnight-run-mj594lhn-nhcv';
const EVENT_PUBKEY = '30ceb64e73197a0558bc8f1cf5a08a0ec5d64dd6fcb1a2b5f8dc77a1f7a04b0d';
const EVENT_START = 1734152136; // 2025-12-14T04:55:36
const EVENT_END = 1734238536;   // 2025-12-15T04:55:36

// Known RSVPed users
const RSVP_USER_1 = 'f993b4d99ee1cc11'; // First 16 chars
const RSVP_USER_2 = '30ceb64e73197a05'; // First 16 chars (event creator)

async function main() {
  console.log('🔍 Debugging Midnight Run Event...\n');

  const ndk = new NDK({
    explicitRelayUrls: DEFAULT_RELAYS,
  });

  console.log('📡 Connecting to relays...');
  await ndk.connect();
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check relay connections
  const connectedRelays = Array.from(ndk.pool.relays.values()).filter((r: any) => r.status === 1);
  console.log(`✅ Connected to ${connectedRelays.length} relays\n`);

  // ========================================
  // STEP 1: Query RSVPs by d-tag
  // ========================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 STEP 1: Query RSVPs by #d tag');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const rsvpDTagFilter: NDKFilter = {
    kinds: [KIND_CALENDAR_RSVP as any],
    '#d': [`rsvp-${EVENT_ID}`],
    limit: 500,
  };
  console.log('Filter:', JSON.stringify(rsvpDTagFilter, null, 2));

  const rsvpsByDTag = await ndk.fetchEvents(rsvpDTagFilter);
  console.log(`\nFound ${rsvpsByDTag.size} RSVPs by #d tag\n`);

  for (const rsvp of rsvpsByDTag) {
    console.log(`RSVP from: ${rsvp.pubkey}`);
    console.log(`  - d-tag: ${rsvp.tags.find(t => t[0] === 'd')?.[1]}`);
    console.log(`  - status: ${rsvp.tags.find(t => t[0] === 'status')?.[1]}`);
    console.log(`  - created: ${new Date(rsvp.created_at! * 1000).toISOString()}`);
    console.log(`  - id: ${rsvp.id}`);
    console.log('');
  }

  // ========================================
  // STEP 2: Query workouts from RSVP user 2
  // ========================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 STEP 2: Query workouts from event creator');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get full pubkey for event creator
  const creatorPubkey = EVENT_PUBKEY;
  console.log(`Querying workouts for: ${creatorPubkey.slice(0, 16)}...`);
  console.log(`Date range: ${new Date(EVENT_START * 1000).toISOString()} to ${new Date(EVENT_END * 1000).toISOString()}\n`);

  const workoutFilter: NDKFilter = {
    kinds: [KIND_WORKOUT as any],
    authors: [creatorPubkey],
    since: EVENT_START,
    until: EVENT_END,
    limit: 100,
  };
  console.log('Filter:', JSON.stringify(workoutFilter, null, 2));

  const creatorWorkouts = await ndk.fetchEvents(workoutFilter);
  console.log(`\nFound ${creatorWorkouts.size} workouts from event creator\n`);

  for (const workout of creatorWorkouts) {
    const tags = workout.tags;
    const exercise = tags.find(t => t[0] === 'exercise')?.[1] || 'unknown';
    const distanceTag = tags.find(t => t[0] === 'distance');
    const distance = distanceTag ? `${distanceTag[1]} ${distanceTag[2] || 'km'}` : 'N/A';
    const duration = tags.find(t => t[0] === 'duration')?.[1] || 'N/A';
    const source = tags.find(t => t[0] === 'source')?.[1] || 'undefined';

    console.log(`Workout: ${exercise}`);
    console.log(`  - Distance: ${distance}`);
    console.log(`  - Duration: ${duration}`);
    console.log(`  - Source: ${source} (${source === 'manual' ? '❌ EXCLUDED from leaderboard' : '✅ Included'})`);
    console.log(`  - Created: ${new Date(workout.created_at! * 1000).toISOString()}`);
    console.log(`  - ID: ${workout.id}`);
    console.log('');
  }

  // ========================================
  // STEP 3: Query ALL kind 1301 in time window
  // ========================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 STEP 3: Query ALL workouts in event time window');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const allWorkoutsFilter: NDKFilter = {
    kinds: [KIND_WORKOUT as any],
    since: EVENT_START,
    until: EVENT_END,
    limit: 500,
  };
  console.log('Filter:', JSON.stringify(allWorkoutsFilter, null, 2));

  const allWorkouts = await ndk.fetchEvents(allWorkoutsFilter);
  console.log(`\nFound ${allWorkouts.size} total workouts in time window\n`);

  // Find running workouts >= 10km
  let qualifyingCount = 0;
  for (const workout of allWorkouts) {
    const tags = workout.tags;
    const exercise = (tags.find(t => t[0] === 'exercise')?.[1] || '').toLowerCase();
    const distanceTag = tags.find(t => t[0] === 'distance');
    const source = tags.find(t => t[0] === 'source')?.[1] || 'undefined';

    // Check if running
    if (exercise !== 'running') continue;

    // Check if >= 10km
    if (!distanceTag) continue;
    let distanceKm = parseFloat(distanceTag[1]) || 0;
    const unit = distanceTag[2] || 'km';
    if (unit === 'mi' || unit === 'miles') distanceKm *= 1.60934;

    if (distanceKm < 10 * 0.95) continue; // 5% tolerance

    // Check if not manual
    if (source === 'manual') {
      console.log(`⚠️ Manual entry excluded: ${workout.pubkey.slice(0, 16)}... - ${distanceKm.toFixed(2)} km`);
      continue;
    }

    qualifyingCount++;
    console.log(`✅ QUALIFYING: ${workout.pubkey.slice(0, 16)}... - ${distanceKm.toFixed(2)} km running`);
  }

  console.log(`\n📊 Total qualifying workouts: ${qualifyingCount}`);

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`RSVPs found: ${rsvpsByDTag.size}`);
  console.log(`Event creator workouts: ${creatorWorkouts.size}`);
  console.log(`Total workouts in window: ${allWorkouts.size}`);
  console.log(`Qualifying running workouts (>=10km, non-manual): ${qualifyingCount}`);

  console.log('\n✅ Debug complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
