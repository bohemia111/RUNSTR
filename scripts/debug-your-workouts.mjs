#!/usr/bin/env node
/**
 * Debug script to find workouts for the actual user
 */

import NDK, { NDKUser } from '@nostr-dev-kit/ndk';

const KIND_WORKOUT = 1301;

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

// User's npub (they provided this)
const USER_NPUB = 'npub1xr8tvnnnr9aqt9vv30vj4vreeq2mk38mlwe7khvhvmzjqlcghh6sr85uum';

async function main() {
  console.log('🔍 YOUR WORKOUT DEBUG');
  console.log('=====================\n');
  console.log('Your npub:', USER_NPUB);

  // Convert npub to hex pubkey
  const user = new NDKUser({ npub: USER_NPUB });
  const hexPubkey = user.pubkey;
  console.log('Your hex pubkey:', hexPubkey);

  // Compare with RSVP pubkey
  const RSVP_PUBKEY = 'dd37f18b42c2f7cae30a14fc33894287203e5e8f980dfe9d5268c3d984b38f5d';
  console.log('\nRSVP pubkey:', RSVP_PUBKEY);
  console.log('Match:', hexPubkey === RSVP_PUBKEY ? '✅ YES' : '❌ NO - DIFFERENT USER!');

  console.log('\nRelays:', RELAYS);
  console.log('\n');

  const ndk = new NDK({ explicitRelayUrls: RELAYS });
  console.log('⏳ Connecting...');
  await ndk.connect();
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('✅ Connected\n');

  // Query ALL workouts from YOUR pubkey
  console.log('=== TEST 1: Your workouts (kind 1301) ===');
  const filter1 = {
    kinds: [KIND_WORKOUT],
    authors: [hexPubkey],
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
    }
  } else {
    console.log('\n  ❌ No workouts found for your pubkey!');
    console.log('  This means you haven\'t published any kind 1301 workouts to Nostr');
  }

  // Also query workouts from RSVP pubkey (if different)
  if (hexPubkey !== RSVP_PUBKEY) {
    console.log('\n\n=== TEST 2: Workouts from RSVP pubkey ===');
    const filter2 = {
      kinds: [KIND_WORKOUT],
      authors: [RSVP_PUBKEY],
      limit: 50,
    };
    console.log('Filter:', JSON.stringify(filter2));

    const events2 = await ndk.fetchEvents(filter2);
    console.log('Workouts found:', events2.size);

    if (events2.size > 0) {
      for (const event of events2) {
        const exerciseTag = event.tags.find(t => t[0] === 'exercise')?.[1];
        const distanceTag = event.tags.find(t => t[0] === 'distance');
        const date = new Date(event.created_at * 1000).toISOString();

        console.log(`\n  Workout: ${event.id?.slice(0, 16)}...`);
        console.log(`    Date: ${date}`);
        console.log(`    Exercise: ${exerciseTag}`);
        console.log(`    Distance: ${distanceTag ? distanceTag.join(' ') : 'none'}`);
      }
    }
  }

  // Get profile info for both pubkeys
  console.log('\n\n=== Profile Check ===');

  const filter3 = {
    kinds: [0],
    authors: [hexPubkey, RSVP_PUBKEY],
    limit: 2,
  };
  const profiles = await ndk.fetchEvents(filter3);

  for (const event of profiles) {
    try {
      const profile = JSON.parse(event.content);
      const isYou = event.pubkey === hexPubkey;
      console.log(`\n${isYou ? 'YOUR' : 'RSVP'} profile (${event.pubkey.slice(0, 16)}...):`);
      console.log(`  Name: ${profile.name || profile.display_name || 'unknown'}`);
      console.log(`  NIP-05: ${profile.nip05 || 'none'}`);
    } catch (e) {
      // ignore
    }
  }

  console.log('\n\n=== DIAGNOSIS ===');
  if (hexPubkey !== RSVP_PUBKEY) {
    console.log('⚠️ PUBKEY MISMATCH DETECTED!');
    console.log('');
    console.log('The RSVP was signed by a DIFFERENT pubkey than your current one.');
    console.log('This could happen if:');
    console.log('  1. You logged in with a different nsec when you joined the event');
    console.log('  2. The app was using a different key pair');
    console.log('  3. You have multiple Nostr identities');
    console.log('');
    console.log('To fix: You need to either:');
    console.log('  A) Log in with the nsec that matches the RSVP pubkey, OR');
    console.log('  B) Re-join the event with your current identity');
  }

  console.log('\n✅ Debug complete');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
