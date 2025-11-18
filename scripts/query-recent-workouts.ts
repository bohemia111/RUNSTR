#!/usr/bin/env tsx
/**
 * Query Recent Workouts (No Team Filter)
 *
 * Purpose: Query user's recent kind 1301 events without team filter
 * to verify events are actually being published
 */

import NDK, { NDKFilter } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

const USER_NPUB = 'npub1fr6d0wr727nc74d0809yplrwlj66x6y0dns5xaahklwanxyu5jxqy0a73f';

async function main() {
  console.log('🔍 Querying Recent Workouts (No Team Filter)\n');
  console.log('================================================\n');

  // Decode user pubkey
  const decoded = nip19.decode(USER_NPUB);
  const userPubkey = decoded.data as string;

  console.log(`👤 User: ${USER_NPUB}`);
  console.log(`   Hex: ${userPubkey}\n`);

  // Initialize NDK
  console.log('🌐 Connecting to Nostr relays...');
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });

  await ndk.connect();
  console.log(`   ✅ Connected to ${ndk.pool.connectedRelays().length} relays\n`);

  // Query user's recent kind 1301 events (last 24 hours)
  const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;

  const filter: NDKFilter = {
    kinds: [1301],
    authors: [userPubkey],
    since: oneDayAgo,
    limit: 10,
  };

  console.log('🔍 Query Filter:');
  console.log(JSON.stringify(filter, null, 2));
  console.log();

  console.log('📡 Fetching events...\n');

  try {
    const events = await ndk.fetchEvents(filter);
    const eventsArray = Array.from(events).sort((a, b) => b.created_at! - a.created_at!);

    console.log(`✅ Found ${eventsArray.length} workout events\n`);

    if (eventsArray.length === 0) {
      console.log('❌ No workouts found in last 24 hours\n');
      process.exit(0);
    }

    console.log('================================================\n');
    console.log('📋 Workout Events:\n');

    eventsArray.forEach((event, index) => {
      console.log(`Workout ${index + 1}:`);
      console.log(`   ID: ${event.id}`);
      console.log(`   Created: ${new Date(event.created_at! * 1000).toLocaleString()}`);
      console.log(`   Content: ${event.content.substring(0, 60)}...`);

      // Parse tags
      const exerciseTag = event.tags.find(t => t[0] === 'exercise');
      const distanceTag = event.tags.find(t => t[0] === 'distance');
      const durationTag = event.tags.find(t => t[0] === 'duration');
      const teamTag = event.tags.find(t => t[0] === 'team');
      const splitTags = event.tags.filter(t => t[0] === 'split');

      console.log(`   Exercise: ${exerciseTag ? exerciseTag[1] : 'N/A'}`);
      console.log(`   Distance: ${distanceTag ? distanceTag[1] + ' ' + (distanceTag[2] || 'km') : 'N/A'}`);
      console.log(`   Duration: ${durationTag ? durationTag[1] : 'N/A'}`);
      console.log(`   Team: ${teamTag ? teamTag[1] : 'N/A'}`);
      console.log(`   Splits: ${splitTags.length}`);

      if (splitTags.length > 0) {
        console.log(`   Split Preview:`);
        splitTags.slice(0, 3).forEach(split => {
          console.log(`      Split ${split[1]}: ${split[2]}`);
        });
        if (splitTags.length > 3) {
          console.log(`      ... ${splitTags.length - 3} more splits`);
        }
      }

      console.log();
    });

    console.log('✅ Query complete\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Query error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script error:', error);
  process.exit(1);
});
