#!/usr/bin/env npx ts-node
/**
 * Debug script to test RSVP queries directly against Nostr relays
 *
 * Run with: npx ts-node scripts/debug-rsvp-query.ts
 */

import NDK, { NDKFilter, NDKKind } from '@nostr-dev-kit/ndk';

// RSVP kind (NIP-52)
const KIND_CALENDAR_RSVP = 31925 as NDKKind;
const KIND_CALENDAR_EVENT = 31923 as NDKKind;

// Default relays (same as app)
const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

// The Satlantis event we're debugging
// Update these values based on your actual event
const EVENT_PUBKEY = 'd2c0fc276cd766ed9247c7f3dc7aa8bc3bfe45c2dbd5ff1dd3a0543beb38a20a'; // Satlantis pubkey
const EVENT_ID = 'race-mj2q1t9pg5wflh35a'; // Event d-tag

async function main() {
  console.log('🔍 RSVP Debug Query Script');
  console.log('==========================\n');
  console.log('Event pubkey:', EVENT_PUBKEY);
  console.log('Event ID:', EVENT_ID);
  console.log('Relays:', RELAYS);
  console.log('\n');

  // Create NDK instance
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });

  console.log('⏳ Connecting to relays...');
  await ndk.connect();

  // Wait for relay connections
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('✅ Connected\n');

  const eventRef = `31923:${EVENT_PUBKEY}:${EVENT_ID}`;

  // Test 1: Query by #a tag (the standard method)
  console.log('=== TEST 1: Query by #a tag ===');
  console.log('Filter: { kinds: [31925], "#a": ["' + eventRef + '"] }');
  try {
    const filter1: NDKFilter = {
      kinds: [KIND_CALENDAR_RSVP],
      '#a': [eventRef],
      limit: 100,
    };
    const events1 = await ndk.fetchEvents(filter1);
    console.log('Result:', events1.size, 'events found');
    if (events1.size > 0) {
      for (const event of events1) {
        console.log('  - ID:', event.id?.slice(0, 16) + '...');
        console.log('    Pubkey:', event.pubkey?.slice(0, 16) + '...');
        console.log('    Tags:', JSON.stringify(event.tags.slice(0, 4)));
      }
    }
  } catch (error) {
    console.log('Error:', error);
  }
  console.log('\n');

  // Test 2: Query by #d tag (our d-tag format)
  console.log('=== TEST 2: Query by #d tag ===');
  console.log('Filter: { kinds: [31925], "#d": ["rsvp-' + EVENT_ID + '"] }');
  try {
    const filter2: NDKFilter = {
      kinds: [KIND_CALENDAR_RSVP],
      '#d': [`rsvp-${EVENT_ID}`],
      limit: 100,
    };
    const events2 = await ndk.fetchEvents(filter2);
    console.log('Result:', events2.size, 'events found');
    if (events2.size > 0) {
      for (const event of events2) {
        console.log('  - ID:', event.id?.slice(0, 16) + '...');
        console.log('    Pubkey:', event.pubkey?.slice(0, 16) + '...');
        console.log('    Tags:', JSON.stringify(event.tags.slice(0, 4)));
      }
    }
  } catch (error) {
    console.log('Error:', error);
  }
  console.log('\n');

  // Test 3: Query ALL RSVPs (kind 31925) in last 24 hours - see what's out there
  console.log('=== TEST 3: Query ALL recent RSVPs ===');
  console.log('Filter: { kinds: [31925], since: 24h ago, limit: 50 }');
  try {
    const since = Math.floor(Date.now() / 1000) - 24 * 60 * 60; // 24 hours ago
    const filter3: NDKFilter = {
      kinds: [KIND_CALENDAR_RSVP],
      since,
      limit: 50,
    };
    const events3 = await ndk.fetchEvents(filter3);
    console.log('Result:', events3.size, 'RSVPs found in last 24h');

    // Check if any match our event
    let matchCount = 0;
    for (const event of events3) {
      const aTag = event.tags.find(t => t[0] === 'a')?.[1];
      if (aTag?.includes(EVENT_ID) || aTag?.includes(EVENT_PUBKEY)) {
        matchCount++;
        console.log('  🎯 MATCH FOUND:');
        console.log('    - ID:', event.id?.slice(0, 16) + '...');
        console.log('    - Pubkey:', event.pubkey?.slice(0, 16) + '...');
        console.log('    - a tag:', aTag);
      }
    }
    if (matchCount === 0) {
      console.log('  No RSVPs found matching our event in the last 24h');
    }
  } catch (error) {
    console.log('Error:', error);
  }
  console.log('\n');

  // Test 4: Query the calendar event itself to verify it exists
  console.log('=== TEST 4: Verify calendar event exists ===');
  console.log('Filter: { kinds: [31923], "#d": ["' + EVENT_ID + '"], authors: ["' + EVENT_PUBKEY.slice(0, 16) + '..."] }');
  try {
    const filter4: NDKFilter = {
      kinds: [KIND_CALENDAR_EVENT],
      '#d': [EVENT_ID],
      authors: [EVENT_PUBKEY],
      limit: 10,
    };
    const events4 = await ndk.fetchEvents(filter4);
    console.log('Result:', events4.size, 'events found');
    if (events4.size > 0) {
      for (const event of events4) {
        console.log('  ✅ Calendar event found:');
        console.log('    - ID:', event.id?.slice(0, 16) + '...');
        const titleTag = event.tags.find(t => t[0] === 'title' || t[0] === 'name')?.[1];
        console.log('    - Title:', titleTag || '(no title tag)');
      }
    } else {
      console.log('  ❌ Calendar event NOT FOUND!');
    }
  } catch (error) {
    console.log('Error:', error);
  }
  console.log('\n');

  // Test 5: Query by specific user (if we know the user pubkey)
  // You can add a test user pubkey here if known
  console.log('=== TEST 5: Query RSVPs by status tag ===');
  console.log('Filter: { kinds: [31925], "#status": ["accepted"], limit: 50 }');
  try {
    const filter5: NDKFilter = {
      kinds: [KIND_CALENDAR_RSVP],
      '#status': ['accepted'],
      limit: 50,
    };
    const events5 = await ndk.fetchEvents(filter5);
    console.log('Result:', events5.size, 'accepted RSVPs found');

    // Check if any reference our event
    let matchCount = 0;
    for (const event of events5) {
      const aTag = event.tags.find(t => t[0] === 'a')?.[1];
      if (aTag === eventRef) {
        matchCount++;
        console.log('  🎯 MATCH:');
        console.log('    - Pubkey:', event.pubkey?.slice(0, 16) + '...');
      }
    }
    if (matchCount === 0) {
      console.log('  No accepted RSVPs matching our event');
    }
  } catch (error) {
    console.log('Error:', error);
  }
  console.log('\n');

  console.log('=== Summary ===');
  console.log('Expected eventRef for RSVPs:', eventRef);
  console.log('\nIf no RSVPs were found, possible causes:');
  console.log('1. RSVP was never published successfully');
  console.log('2. RSVP was published to different relays');
  console.log('3. Relay doesn\'t index #a tag for kind 31925');
  console.log('4. RSVP event has wrong tag format');

  console.log('\n✅ Debug script complete');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
