#!/usr/bin/env tsx
/**
 * Test Leaderboard Query Script
 *
 * Purpose: Test the exact same Nostr query that SimpleLeaderboardService uses
 * to see if we can find the workout events
 */

import NDK, { NDKFilter } from '@nostr-dev-kit/ndk';

const RUNSTR_TEAM_ID = '87d30c8b-aa18-4424-a629-d41ea7f89078';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

async function main() {
  console.log('🧪 Testing Leaderboard Query\n');
  console.log('================================================\n');

  // Calculate today's midnight in local timezone (same as app)
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayMidnight = Math.floor(midnight.getTime() / 1000);

  console.log(`📅 Query Parameters:`);
  console.log(`   Team ID: ${RUNSTR_TEAM_ID}`);
  console.log(`   Since: ${new Date(todayMidnight * 1000).toLocaleString()}`);
  console.log(`   UTC: ${new Date(todayMidnight * 1000).toISOString()}\n`);

  // Initialize NDK
  console.log('🌐 Connecting to Nostr relays...');
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });

  await ndk.connect();
  console.log(`   ✅ Connected to ${ndk.pool.connectedRelays().length} relays\n`);

  // Create the EXACT same filter as SimpleLeaderboardService
  const filter: NDKFilter = {
    kinds: [1301],
    '#team': [RUNSTR_TEAM_ID],
    since: todayMidnight,
  };

  console.log('🔍 Query Filter:');
  console.log(JSON.stringify(filter, null, 2));
  console.log();

  console.log('📡 Fetching events...\n');

  try {
    const events = await ndk.fetchEvents(filter);
    const eventsArray = Array.from(events);

    console.log(`✅ Query complete: Found ${eventsArray.length} events\n`);

    if (eventsArray.length === 0) {
      console.log('❌ No events found!\n');
      console.log('💡 Possible reasons:');
      console.log('   1. Workout not published with team tag');
      console.log('   2. Workout timestamp before today\'s midnight');
      console.log('   3. Relays haven\'t synced yet');
      console.log('   4. Team tag format mismatch\n');

      // Try query WITHOUT team filter to see if ANY kind 1301 events exist today
      console.log('🔄 Retrying without team filter...\n');
      const allEventsFilter: NDKFilter = {
        kinds: [1301],
        since: todayMidnight,
        limit: 10,
      };

      const allEvents = await ndk.fetchEvents(allEventsFilter);
      console.log(`   Found ${allEvents.size} total kind 1301 events today (all authors/teams)\n`);

      if (allEvents.size > 0) {
        console.log('   📋 Sample events:');
        Array.from(allEvents).slice(0, 5).forEach((e, i) => {
          const teamTag = e.tags.find(t => t[0] === 'team');
          console.log(`      ${i + 1}. Event ${e.id?.substring(0, 12)}... team: ${teamTag ? teamTag[1] : 'none'}`);
        });
      }

      process.exit(1);
    }

    // Show found events
    console.log('================================================\n');
    console.log('📋 Found Events:\n');

    eventsArray.forEach((event, index) => {
      console.log(`Event ${index + 1}:`);
      console.log(`   ID: ${event.id}`);
      console.log(`   Created: ${new Date(event.created_at! * 1000).toLocaleString()}`);
      console.log(`   Content: ${event.content.substring(0, 50)}...`);

      // Parse tags
      const distanceTag = event.tags.find(t => t[0] === 'distance');
      const teamTag = event.tags.find(t => t[0] === 'team');
      const splitTags = event.tags.filter(t => t[0] === 'split');

      console.log(`   Distance: ${distanceTag ? distanceTag[1] + ' ' + (distanceTag[2] || 'km') : 'N/A'}`);
      console.log(`   Team: ${teamTag ? teamTag[1] : 'N/A'}`);
      console.log(`   Splits: ${splitTags.length}`);
      console.log();
    });

    console.log('✅ Test complete - events found successfully!\n');
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
