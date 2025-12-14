#!/usr/bin/env node
/**
 * Check if a specific npub ever posted an RSVP
 */

import NDK from '@nostr-dev-kit/ndk';

const KIND_CALENDAR_RSVP = 31925;

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

// TheWildHustle's hex pubkey
const USER_PUBKEY = '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5';
const EVENT_ID = 'race-mj2q1t9pg5wflh35a';

async function main() {
  console.log('🔍 CHECKING IF YOUR NPUB POSTED AN RSVP');
  console.log('=======================================\n');
  console.log('Your hex pubkey:', USER_PUBKEY);
  console.log('Event ID:', EVENT_ID);
  console.log('\n');

  const ndk = new NDK({ explicitRelayUrls: RELAYS });
  console.log('⏳ Connecting...');
  await ndk.connect();
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('✅ Connected\n');

  // Query ALL RSVPs from YOUR pubkey
  console.log('=== TEST 1: All RSVPs from your pubkey ===');
  const filter1 = {
    kinds: [KIND_CALENDAR_RSVP],
    authors: [USER_PUBKEY],
    limit: 50,
  };
  console.log('Filter:', JSON.stringify(filter1));

  const events1 = await ndk.fetchEvents(filter1);
  console.log('RSVPs found:', events1.size);

  if (events1.size > 0) {
    for (const event of events1) {
      const aTag = event.tags.find(t => t[0] === 'a')?.[1];
      const dTag = event.tags.find(t => t[0] === 'd')?.[1];
      const statusTag = event.tags.find(t => t[0] === 'status')?.[1];
      const date = new Date(event.created_at * 1000).toISOString();

      const matchesEvent = aTag?.includes(EVENT_ID) || dTag?.includes(EVENT_ID);

      console.log(`\n  RSVP: ${event.id?.slice(0, 16)}...`);
      console.log(`    Date: ${date}`);
      console.log(`    Status: ${statusTag || 'accepted'}`);
      console.log(`    a-tag: ${aTag}`);
      console.log(`    d-tag: ${dTag}`);
      console.log(`    Matches our event: ${matchesEvent ? '✅ YES' : '❌ NO'}`);
    }
  } else {
    console.log('\n  ❌ No RSVPs found from your pubkey!');
    console.log('  This means you never successfully published an RSVP with your current identity.');
  }

  // Query RSVPs for this specific event by d-tag
  console.log('\n\n=== TEST 2: All RSVPs for this event (by d-tag) ===');
  const filter2 = {
    kinds: [KIND_CALENDAR_RSVP],
    '#d': [`rsvp-${EVENT_ID}`],
    limit: 50,
  };
  console.log('Filter:', JSON.stringify(filter2));

  const events2 = await ndk.fetchEvents(filter2);
  console.log('RSVPs found:', events2.size);

  for (const event of events2) {
    const isYou = event.pubkey === USER_PUBKEY;
    const statusTag = event.tags.find(t => t[0] === 'status')?.[1];
    const date = new Date(event.created_at * 1000).toISOString();

    console.log(`\n  RSVP from: ${event.pubkey.slice(0, 16)}... ${isYou ? '👉 THIS IS YOU!' : ''}`);
    console.log(`    Date: ${date}`);
    console.log(`    Status: ${statusTag || 'accepted'}`);
  }

  // Check if you're in the list
  const yourRsvp = [...events2].find(e => e.pubkey === USER_PUBKEY);
  if (yourRsvp) {
    console.log('\n✅ FOUND YOUR RSVP FOR THIS EVENT!');
  } else {
    console.log('\n❌ YOUR PUBKEY HAS NOT RSVP\'D TO THIS EVENT');
    console.log('   You need to use the "Force Re-Join" button to publish an RSVP');
  }

  console.log('\n✅ Debug complete');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
