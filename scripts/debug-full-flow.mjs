#!/usr/bin/env node
/**
 * Debug script to test the FULL event flow:
 * 1. Find RSVPs for the event
 * 2. Get participant pubkeys
 * 3. Query their workouts
 * 4. Check if workouts qualify for the event
 *
 * Run with: node scripts/debug-full-flow.mjs
 */

import NDK from '@nostr-dev-kit/ndk';

// Event kinds
const KIND_CALENDAR_RSVP = 31925;
const KIND_CALENDAR_EVENT = 31923;
const KIND_WORKOUT = 1301;

// Default relays (same as app)
const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

// The Satlantis event we're debugging
const EVENT_ID = 'race-mj2q1t9pg5wflh35a';

// Event details (from Satlantis - may need to update)
const EVENT_START_TIME = new Date('2024-12-11T00:00:00Z').getTime() / 1000; // Approximate
const EVENT_END_TIME = new Date('2024-12-18T23:59:59Z').getTime() / 1000; // Approximate

async function main() {
  console.log('🔍 FULL EVENT FLOW DEBUG');
  console.log('========================\n');
  console.log('Event ID:', EVENT_ID);
  console.log('Relays:', RELAYS);
  console.log('\n');

  // Create NDK instance
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });

  console.log('⏳ Connecting to relays...');
  await ndk.connect();
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('✅ Connected\n');

  // STEP 1: Find RSVPs using #d tag (the working method)
  console.log('=== STEP 1: Find RSVPs ===');
  const rsvpFilter = {
    kinds: [KIND_CALENDAR_RSVP],
    '#d': [`rsvp-${EVENT_ID}`],
    limit: 100,
  };
  console.log('Filter:', JSON.stringify(rsvpFilter));

  const rsvpEvents = await ndk.fetchEvents(rsvpFilter);
  console.log('RSVPs found:', rsvpEvents.size);

  const participants = [];
  for (const event of rsvpEvents) {
    const statusTag = event.tags.find(t => t[0] === 'status')?.[1];
    const aTag = event.tags.find(t => t[0] === 'a')?.[1];

    // Only include accepted RSVPs
    if (!statusTag || statusTag.toLowerCase() === 'accepted') {
      participants.push(event.pubkey);
      console.log(`  ✅ Participant: ${event.pubkey.slice(0, 16)}...`);
      console.log(`     Status: ${statusTag || 'accepted (default)'}`);
      console.log(`     a-tag: ${aTag}`);
    }
  }
  console.log(`\nTotal participants: ${participants.length}\n`);

  if (participants.length === 0) {
    console.log('❌ No participants found! Checking if this is an OPEN event...\n');
  }

  // STEP 2: Query workouts for participants (or ALL if open event)
  console.log('=== STEP 2: Query Workouts ===');

  // Calculate time range (last 30 days for testing)
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

  let workoutFilter;
  if (participants.length > 0) {
    // Query by participants
    workoutFilter = {
      kinds: [KIND_WORKOUT],
      authors: participants,
      since: thirtyDaysAgo,
      limit: 100,
    };
    console.log('Querying workouts for', participants.length, 'participants...');
  } else {
    // Open event - query ALL running workouts
    workoutFilter = {
      kinds: [KIND_WORKOUT],
      since: thirtyDaysAgo,
      limit: 200,
    };
    console.log('Querying ALL recent workouts (open event mode)...');
  }

  console.log('Filter:', JSON.stringify(workoutFilter).slice(0, 200) + '...');

  const workoutEvents = await ndk.fetchEvents(workoutFilter);
  console.log('Workouts found:', workoutEvents.size);

  // Parse and display workouts
  const workouts = [];
  for (const event of workoutEvents) {
    const exerciseTag = event.tags.find(t => t[0] === 'exercise')?.[1];
    const distanceTag = event.tags.find(t => t[0] === 'distance');
    const durationTag = event.tags.find(t => t[0] === 'duration')?.[1];

    // Extract distance (may be in meters or with unit)
    let distanceMeters = 0;
    if (distanceTag) {
      const value = parseFloat(distanceTag[1]);
      const unit = distanceTag[2] || 'm';
      if (unit === 'km') {
        distanceMeters = value * 1000;
      } else if (unit === 'mi') {
        distanceMeters = value * 1609.34;
      } else {
        distanceMeters = value;
      }
    }

    const workout = {
      id: event.id,
      pubkey: event.pubkey,
      exercise: exerciseTag || 'unknown',
      distance: distanceMeters,
      duration: durationTag,
      createdAt: event.created_at,
      content: event.content?.slice(0, 50),
    };
    workouts.push(workout);
  }

  // Group by pubkey
  const workoutsByUser = new Map();
  for (const w of workouts) {
    if (!workoutsByUser.has(w.pubkey)) {
      workoutsByUser.set(w.pubkey, []);
    }
    workoutsByUser.get(w.pubkey).push(w);
  }

  console.log('\n--- Workouts by User ---');
  for (const [pubkey, userWorkouts] of workoutsByUser) {
    const isParticipant = participants.includes(pubkey);
    console.log(`\nUser: ${pubkey.slice(0, 16)}... ${isParticipant ? '(RSVP\'d ✅)' : '(No RSVP)'}`);
    console.log(`  Total workouts: ${userWorkouts.length}`);

    // Show running/walking workouts
    const runningWorkouts = userWorkouts.filter(w =>
      w.exercise === 'running' || w.exercise === 'walking' || w.exercise === 'run'
    );
    console.log(`  Running/Walking: ${runningWorkouts.length}`);

    for (const w of runningWorkouts.slice(0, 3)) {
      const distKm = (w.distance / 1000).toFixed(2);
      const date = new Date(w.createdAt * 1000).toISOString().slice(0, 10);
      console.log(`    - ${date}: ${distKm} km, ${w.duration || 'no duration'}`);
    }
  }

  // STEP 3: Check if participant's workouts qualify
  console.log('\n=== STEP 3: Qualification Check ===');

  // For a 5K event, workouts need to be >= 4.75km (95% of 5K)
  const TARGET_DISTANCE_KM = 5;
  const MIN_DISTANCE_M = TARGET_DISTANCE_KM * 1000 * 0.95; // 4750m

  console.log(`Target distance: ${TARGET_DISTANCE_KM} km`);
  console.log(`Minimum qualifying: ${MIN_DISTANCE_M / 1000} km (95%)\n`);

  let qualifyingCount = 0;
  for (const [pubkey, userWorkouts] of workoutsByUser) {
    const runningWorkouts = userWorkouts.filter(w =>
      w.exercise === 'running' || w.exercise === 'walking' || w.exercise === 'run'
    );

    const qualifying = runningWorkouts.filter(w => w.distance >= MIN_DISTANCE_M);

    if (qualifying.length > 0) {
      qualifyingCount++;
      const isParticipant = participants.includes(pubkey);
      console.log(`✅ ${pubkey.slice(0, 16)}... has ${qualifying.length} qualifying workout(s) ${isParticipant ? '(RSVP\'d)' : '(No RSVP - won\'t appear)'}`);

      for (const w of qualifying.slice(0, 2)) {
        const distKm = (w.distance / 1000).toFixed(2);
        console.log(`   - ${distKm} km, ${w.duration}`);
      }
    }
  }

  console.log(`\nTotal users with qualifying workouts: ${qualifyingCount}`);

  // STEP 4: Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Event: ${EVENT_ID}`);
  console.log(`RSVPs found: ${participants.length}`);
  console.log(`Total workouts queried: ${workouts.length}`);
  console.log(`Users with qualifying workouts: ${qualifyingCount}`);

  if (participants.length > 0) {
    const participantsWithQualifying = [...workoutsByUser.entries()]
      .filter(([pubkey, ws]) => {
        const running = ws.filter(w => w.exercise === 'running' || w.exercise === 'walking' || w.exercise === 'run');
        return running.some(w => w.distance >= MIN_DISTANCE_M) && participants.includes(pubkey);
      });
    console.log(`Participants with qualifying workouts: ${participantsWithQualifying.length}`);

    if (participantsWithQualifying.length === 0) {
      console.log('\n⚠️ ISSUE: RSVPs found but no qualifying workouts from participants!');
      console.log('Possible causes:');
      console.log('  1. Workout was too short (< 4.75km for 5K event)');
      console.log('  2. Workout exercise type is not "running" or "walking"');
      console.log('  3. Workout was done outside event time window');
      console.log('  4. Workout pubkey doesn\'t match RSVP pubkey');
    }
  } else {
    console.log('\n⚠️ ISSUE: No RSVPs found!');
    console.log('This is an "open event" - should show ALL qualifying workouts');
    console.log('Check if useSatlantisEventDetail is calling queryOpenEventWorkouts()');
  }

  console.log('\n✅ Debug complete');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
