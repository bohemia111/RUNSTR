#!/usr/bin/env node
/**
 * Check what events exist and who created them
 */

import NDK from '@nostr-dev-kit/ndk';

const KIND_CALENDAR_EVENT = 31923;

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

const YOUR_PUBKEY = '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5';
const EVENT_1 = 'race-mj2q1t9pg5wflh35a';  // The event you wanted to join
const EVENT_2 = 'midnight-run-mj594lhn-nhcv';  // The event your RSVP references

async function main() {
  console.log('🔍 CHECKING EVENT OWNERSHIP');
  console.log('============================\n');

  const ndk = new NDK({ explicitRelayUrls: RELAYS });
  console.log('⏳ Connecting...');
  await ndk.connect();
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('✅ Connected\n');

  // Check Event 1 (the one you wanted to join)
  console.log(`=== EVENT 1: ${EVENT_1} ===`);
  const filter1 = {
    kinds: [KIND_CALENDAR_EVENT],
    '#d': [EVENT_1],
    limit: 10,
  };
  const events1 = await ndk.fetchEvents(filter1);
  console.log('Events found:', events1.size);

  for (const event of events1) {
    const titleTag = event.tags.find(t => t[0] === 'title' || t[0] === 'name')?.[1];
    const isYours = event.pubkey === YOUR_PUBKEY;
    console.log(`\n  Creator: ${event.pubkey.slice(0, 16)}... ${isYours ? '👉 THIS IS YOU!' : ''}`);
    console.log(`  Title: ${titleTag || 'no title'}`);
    console.log(`  Created: ${new Date(event.created_at * 1000).toISOString()}`);
  }

  // Check Event 2 (the one your RSVP references)
  console.log(`\n\n=== EVENT 2: ${EVENT_2} ===`);
  const filter2 = {
    kinds: [KIND_CALENDAR_EVENT],
    '#d': [EVENT_2],
    limit: 10,
  };
  const events2 = await ndk.fetchEvents(filter2);
  console.log('Events found:', events2.size);

  for (const event of events2) {
    const titleTag = event.tags.find(t => t[0] === 'title' || t[0] === 'name')?.[1];
    const isYours = event.pubkey === YOUR_PUBKEY;
    console.log(`\n  Creator: ${event.pubkey.slice(0, 16)}... ${isYours ? '👉 THIS IS YOU!' : ''}`);
    console.log(`  Title: ${titleTag || 'no title'}`);
    console.log(`  Created: ${new Date(event.created_at * 1000).toISOString()}`);
  }

  // Check all events YOU created
  console.log('\n\n=== ALL EVENTS CREATED BY YOU ===');
  const filter3 = {
    kinds: [KIND_CALENDAR_EVENT],
    authors: [YOUR_PUBKEY],
    limit: 20,
  };
  const events3 = await ndk.fetchEvents(filter3);
  console.log('Events found:', events3.size);

  for (const event of events3) {
    const titleTag = event.tags.find(t => t[0] === 'title' || t[0] === 'name')?.[1];
    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    console.log(`\n  ID (d-tag): ${dTag}`);
    console.log(`  Title: ${titleTag || 'no title'}`);
    console.log(`  Created: ${new Date(event.created_at * 1000).toISOString()}`);
  }

  console.log('\n✅ Debug complete');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
