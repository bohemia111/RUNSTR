#!/usr/bin/env node
/**
 * Debug script to find ALL workouts for a specific user
 */

import NDK from '@nostr-dev-kit/ndk';

const KIND_WORKOUT = 1301;

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

// The participant from RSVP
const USER_PUBKEY = 'dd37f18b42c2f7cae30a14fc33894287203e5e8f980dfe9d5268c3d984b38f5d';

async function main() {
  console.log('🔍 USER WORKOUT DEBUG');
  console.log('=====================\n');
  console.log('User pubkey:', USER_PUBKEY);
  console.log('Relays:', RELAYS);
  console.log('\n');

  const ndk = new NDK({ explicitRelayUrls: RELAYS });
  console.log('⏳ Connecting...');
  await ndk.connect();
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('✅ Connected\n');

  // Query ALL workouts from this user (no time filter)
  console.log('=== TEST 1: All workouts from user (kind 1301) ===');
  const filter1 = {
    kinds: [KIND_WORKOUT],
    authors: [USER_PUBKEY],
    limit: 50,
  };
  console.log('Filter:', JSON.stringify(filter1));

  const events1 = await ndk.fetchEvents(filter1);
  console.log('Workouts found:', events1.size);

  if (events1.size > 0) {
    for (const event of events1) {
      const exerciseTag = event.tags.find(t => t[0] === 'exercise')?.[1];
      const distanceTag = event.tags.find(t => t[0] === 'distance');
      const durationTag = event.tags.find(t => t[0] === 'duration')?.[1];
      const date = new Date(event.created_at * 1000).toISOString();

      console.log(`\n  Workout: ${event.id?.slice(0, 16)}...`);
      console.log(`    Date: ${date}`);
      console.log(`    Exercise: ${exerciseTag}`);
      console.log(`    Distance: ${distanceTag ? distanceTag.join(' ') : 'none'}`);
      console.log(`    Duration: ${durationTag || 'none'}`);
      console.log(`    Content: ${event.content?.slice(0, 80)}...`);
    }
  }

  // Query ALL events from this user (any kind)
  console.log('\n\n=== TEST 2: All events from user (any kind) ===');
  const filter2 = {
    authors: [USER_PUBKEY],
    limit: 20,
  };
  console.log('Filter:', JSON.stringify(filter2));

  const events2 = await ndk.fetchEvents(filter2);
  console.log('Events found:', events2.size);

  // Group by kind
  const byKind = new Map();
  for (const event of events2) {
    const kind = event.kind;
    if (!byKind.has(kind)) {
      byKind.set(kind, []);
    }
    byKind.get(kind).push(event);
  }

  console.log('\nEvents by kind:');
  for (const [kind, events] of [...byKind.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  Kind ${kind}: ${events.length} events`);
  }

  // Check profile (kind 0)
  const profiles = byKind.get(0);
  if (profiles && profiles.length > 0) {
    try {
      const profile = JSON.parse(profiles[0].content);
      console.log('\n  User profile:');
      console.log(`    Name: ${profile.name || profile.display_name || 'unknown'}`);
      console.log(`    NIP-05: ${profile.nip05 || 'none'}`);
    } catch (e) {
      // ignore
    }
  }

  // Query workouts globally to compare
  console.log('\n\n=== TEST 3: Recent global workouts (for comparison) ===');
  const now = Math.floor(Date.now() / 1000);
  const filter3 = {
    kinds: [KIND_WORKOUT],
    since: now - (7 * 24 * 60 * 60), // Last 7 days
    limit: 20,
  };

  const events3 = await ndk.fetchEvents(filter3);
  console.log('Recent workouts found:', events3.size);

  // Show unique authors
  const authors = new Set();
  for (const event of events3) {
    authors.add(event.pubkey);
  }
  console.log('Unique authors:', authors.size);
  console.log('Authors:', [...authors].map(a => a.slice(0, 16) + '...').join(', '));

  // Check if our user is in the recent workouts
  const userWorkouts = [...events3].filter(e => e.pubkey === USER_PUBKEY);
  console.log(`\nOur user's workouts in last 7 days: ${userWorkouts.length}`);

  console.log('\n✅ Debug complete');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
