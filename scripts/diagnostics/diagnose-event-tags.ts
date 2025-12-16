#!/usr/bin/env tsx
/**
 * Diagnose Event Tags
 *
 * Purpose: Check all tags in a specific kind 1301 event to verify splits
 */

import NDK, { NDKFilter} from '@nostr-dev-kit/ndk';

const EVENT_ID = 'd605cd80815a14092d2c1adf330f3ceaf5367fe40c1f41787f6121303fde73a8';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

async function main() {
  console.log('🔍 Diagnosing Event Tags\n');
  console.log('================================================\n');
  console.log(`Event ID: ${EVENT_ID}\n`);

  // Initialize NDK
  console.log('🌐 Connecting to Nostr relays...');
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });

  await ndk.connect();
  console.log(`   ✅ Connected to ${ndk.pool.connectedRelays().length} relays\n`);

  // Query for specific event by ID
  const filter: NDKFilter = {
    ids: [EVENT_ID],
  };

  console.log('📡 Fetching event...\n');

  try {
    const events = await ndk.fetchEvents(filter);
    const eventsArray = Array.from(events);

    if (eventsArray.length === 0) {
      console.log('❌ Event not found\n');
      process.exit(1);
    }

    const event = eventsArray[0];

    console.log('✅ Event found!\n');
    console.log('================================================\n');
    console.log('📋 Event Tags:\n');

    // Count tag types
    const tagCounts = new Map<string, number>();
    event.tags.forEach(tag => {
      const tagName = tag[0];
      tagCounts.set(tagName, (tagCounts.get(tagName) || 0) + 1);
    });

    console.log('📊 Tag Summary:');
    Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => {
        console.log(`   ${name}: ${count} tags`);
      });
    console.log();

    // Show split tags specifically
    const splitTags = event.tags.filter(t => t[0] === 'split');
    console.log(`🏃 Split Tags (${splitTags.length} total):`);
    if (splitTags.length === 0) {
      console.log('   ❌ NO SPLIT TAGS FOUND!\n');
    } else {
      splitTags.forEach(split => {
        console.log(`   Split ${split[1]}: ${split[2]}`);
      });
      console.log();
    }

    // Show all tags
    console.log('📋 All Tags:');
    event.tags.forEach((tag, index) => {
      console.log(`   ${index + 1}. [${tag.map(t => `"${t}"`).join(', ')}]`);
    });
    console.log();

    console.log('✅ Diagnosis complete\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fetching event:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script error:', error);
  process.exit(1);
});
