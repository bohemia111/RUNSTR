#!/usr/bin/env tsx
/**
 * Test Alternative Query Approach
 *
 * Purpose: Test querying workouts WITHOUT the problematic #team filter
 * Instead: Query user's own workouts and filter client-side
 */

import NDK, { NDKFilter } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

const USER_NPUB = 'npub1fr6d0wr727nc74d0809yplrwlj66x6y0dns5xaahklwanxyu5jxqy0a73f';
const RUNSTR_TEAM_ID = '87d30c8b-aa18-4424-a629-d41ea7f89078';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

async function main() {
  console.log('🧪 Testing Alternative Query (No #team Filter)\n');
  console.log('================================================\n');

  // Decode user pubkey
  const decoded = nip19.decode(USER_NPUB);
  const userPubkey = decoded.data as string;

  console.log(`👤 User: ${USER_NPUB}`);
  console.log(`   Hex: ${userPubkey}\n`);

  // Calculate today's midnight
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayMidnight = Math.floor(midnight.getTime() / 1000);

  console.log(`📅 Query Range:`);
  console.log(`   Since: ${new Date(todayMidnight * 1000).toLocaleString()}`);
  console.log(`   UTC: ${new Date(todayMidnight * 1000).toISOString()}\n`);

  // Initialize NDK
  console.log('🌐 Connecting to Nostr relays...');
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });

  await ndk.connect();
  console.log(`   ✅ Connected to ${ndk.pool.connectedRelays().length} relays\n`);

  // APPROACH 1: Query by author (instead of team tag)
  console.log('📡 APPROACH 1: Query by author (no team filter)...\n');

  const filter1: NDKFilter = {
    kinds: [1301],
    authors: [userPubkey],
    since: todayMidnight,
  };

  console.log('🔍 Query Filter:');
  console.log(JSON.stringify(filter1, null, 2));
  console.log();

  try {
    const events = await ndk.fetchEvents(filter1);
    const eventsArray = Array.from(events);

    console.log(`✅ Query completed: Found ${eventsArray.length} total workouts\n`);

    if (eventsArray.length === 0) {
      console.log('❌ No workouts found from this user today\n');
      process.exit(1);
    }

    // Filter client-side for team tag
    const teamWorkouts = eventsArray.filter(e => {
      const teamTag = e.tags.find(t => t[0] === 'team');
      return teamTag && teamTag[1] === RUNSTR_TEAM_ID;
    });

    console.log(`🎯 Client-side filter: ${teamWorkouts.length} workouts with team tag\n`);

    if (teamWorkouts.length === 0) {
      console.log('⚠️ No workouts with RUNSTR team tag found\n');

      console.log('📋 Workouts without team tags:');
      eventsArray.forEach((e, i) => {
        const teamTag = e.tags.find(t => t[0] === 'team');
        console.log(`   ${i + 1}. Event ${e.id?.substring(0, 12)}... team: ${teamTag ? teamTag[1] : 'NONE'}`);
      });
      console.log();
    } else {
      console.log('================================================\n');
      console.log('📋 Team Workouts Found:\n');

      teamWorkouts.forEach((event, index) => {
        console.log(`Workout ${index + 1}:`);
        console.log(`   ID: ${event.id}`);
        console.log(`   Created: ${new Date(event.created_at! * 1000).toLocaleString()}`);
        console.log(`   Content: ${event.content.substring(0, 60)}...`);

        const exerciseTag = event.tags.find(t => t[0] === 'exercise');
        const distanceTag = event.tags.find(t => t[0] === 'distance');
        const splitTags = event.tags.filter(t => t[0] === 'split');

        console.log(`   Exercise: ${exerciseTag ? exerciseTag[1] : 'N/A'}`);
        console.log(`   Distance: ${distanceTag ? distanceTag[1] + ' ' + (distanceTag[2] || 'km') : 'N/A'}`);
        console.log(`   Splits: ${splitTags.length}`);
        console.log();
      });

      console.log('✅ Alternative query approach WORKS!\n');
      console.log('💡 Solution: Use author-based query + client-side team filter');
      console.log('   instead of problematic #team filter\n');
    }

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
