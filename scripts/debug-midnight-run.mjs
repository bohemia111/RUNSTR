#!/usr/bin/env node
/**
 * Debug the Midnight Run event - check RSVPs and workouts
 */

import NDK from '@nostr-dev-kit/ndk';

const KIND_CALENDAR_RSVP = 31925;
const KIND_WORKOUT = 1301;

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

// Midnight Run event (created by you)
const EVENT_ID = 'midnight-run-mj594lhn-nhcv';
const EVENT_PUBKEY = '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5'; // Your pubkey

async function main() {
  console.log('🔍 MIDNIGHT RUN EVENT DEBUG');
  console.log('============================\n');
  console.log('Event ID:', EVENT_ID);
  console.log('Event Creator (your pubkey):', EVENT_PUBKEY);
  console.log('\n');

  const ndk = new NDK({ explicitRelayUrls: RELAYS });
  console.log('⏳ Connecting...');
  await ndk.connect();
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('✅ Connected\n');

  // STEP 1: Find RSVPs for Midnight Run using #d tag
  console.log('=== STEP 1: Find RSVPs (using #d tag) ===');
  const filter1 = {
    kinds: [KIND_CALENDAR_RSVP],
    '#d': [`rsvp-${EVENT_ID}`],
    limit: 50,
  };
  console.log('Filter:', JSON.stringify(filter1));

  const rsvpEvents = await ndk.fetchEvents(filter1);
  console.log('RSVPs found:', rsvpEvents.size);

  const participants = [];
  for (const event of rsvpEvents) {
    const aTag = event.tags.find(t => t[0] === 'a')?.[1];
    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    const statusTag = event.tags.find(t => t[0] === 'status')?.[1];

    participants.push(event.pubkey);
    console.log(`\n  RSVP from: ${event.pubkey.slice(0, 16)}...`);
    console.log(`    Status: ${statusTag || 'accepted'}`);
    console.log(`    a-tag: ${aTag}`);
    console.log(`    d-tag: ${dTag}`);
  }

  // STEP 2: Also try #a tag query
  console.log('\n\n=== STEP 2: Find RSVPs (using #a tag) ===');
  const eventRef = `31923:${EVENT_PUBKEY}:${EVENT_ID}`;
  const filter2 = {
    kinds: [KIND_CALENDAR_RSVP],
    '#a': [eventRef],
    limit: 50,
  };
  console.log('Filter:', JSON.stringify(filter2));
  console.log('Expected eventRef:', eventRef);

  const rsvpEvents2 = await ndk.fetchEvents(filter2);
  console.log('RSVPs found:', rsvpEvents2.size);

  // STEP 3: Query workouts for participants
  console.log('\n\n=== STEP 3: Query Workouts ===');
  if (participants.length === 0) {
    console.log('❌ No participants found - cannot query workouts');
  } else {
    const workoutFilter = {
      kinds: [KIND_WORKOUT],
      authors: participants,
      limit: 50,
    };
    console.log('Filter:', JSON.stringify(workoutFilter).slice(0, 200));

    const workouts = await ndk.fetchEvents(workoutFilter);
    console.log('Workouts found:', workouts.size);

    // Show running workouts
    let runningCount = 0;
    for (const w of workouts) {
      const exerciseTag = w.tags.find(t => t[0] === 'exercise')?.[1];
      const distanceTag = w.tags.find(t => t[0] === 'distance');
      const durationTag = w.tags.find(t => t[0] === 'duration')?.[1];

      if (exerciseTag === 'running' || exerciseTag === 'walking') {
        runningCount++;
        const date = new Date(w.created_at * 1000).toISOString();
        console.log(`\n  ${exerciseTag}: ${date}`);
        console.log(`    Distance: ${distanceTag ? distanceTag.join(' ') : 'none'}`);
        console.log(`    Duration: ${durationTag || 'none'}`);
      }
    }
    console.log(`\nTotal running/walking workouts: ${runningCount}`);
  }

  // STEP 4: Check what app would query
  console.log('\n\n=== STEP 4: What the app queries ===');
  console.log('The app uses useSatlantisEventDetail hook which:');
  console.log('1. Queries RSVPs using getEventRSVPs(eventPubkey, eventId)');
  console.log('2. Gets participants from RSVPs with status "accepted"');
  console.log('3. Queries kind 1301 workouts from those participants');
  console.log('4. Filters by activity type and date range');
  console.log('\nIf RSVPs are found but workouts don\'t appear, check:');
  console.log('- Event date range (startTime, endTime)');
  console.log('- Activity type filter (sportType)');
  console.log('- Minimum distance requirement');

  console.log('\n✅ Debug complete');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
