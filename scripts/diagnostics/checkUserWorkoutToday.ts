/**
 * Check if a specific user has posted a kind 1301 workout event today
 *
 * Usage: npx ts-node scripts/diagnostics/checkUserWorkoutToday.ts
 */

import { GlobalNDKService } from '../../src/services/nostr/GlobalNDKService';
import { NDKFilter } from '@nostr-dev-kit/ndk';
import { nip19 } from '@nostr-dev-kit/ndk';

async function checkUserWorkoutToday() {
  console.log('🔍 Checking for kind 1301 workout events today...\n');

  // User to check
  const npub = 'npub106auuxzr597dw799u95785hk0866c763yhgug0fxtcvs77e82wxqsac5uf';

  // Decode npub to hex pubkey
  const decoded = nip19.decode(npub);
  const hexPubkey = decoded.data as string;

  console.log(`👤 User: ${npub}`);
  console.log(`🔑 Hex pubkey: ${hexPubkey}\n`);

  // Calculate today's timestamp range (January 1, 2026 UTC)
  const todayStart = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);
  const now = Math.floor(Date.now() / 1000);

  console.log(`📅 Date range: January 1, 2026 00:00:00 UTC → Now`);
  console.log(`⏰ Since timestamp: ${todayStart}`);
  console.log(`⏰ Until timestamp: ${now}\n`);

  try {
    // Get global NDK instance
    console.log('🔗 Connecting to Nostr relays via GlobalNDKService...');
    const ndk = await GlobalNDKService.getInstance();

    // Wait for minimum connection (2 relays)
    const connected = await GlobalNDKService.waitForMinimumConnection(2, 5000);

    if (!connected) {
      console.warn('⚠️ Warning: Less than 2 relays connected, results may be incomplete\n');
    }

    // Query for kind 1301 workout events from this user today
    const filter: NDKFilter = {
      kinds: [1301 as any], // Kind 1301 for workout events
      authors: [hexPubkey],
      since: todayStart,
      until: now,
    };

    console.log('📡 Querying Nostr relays for kind 1301 events...');
    console.log('Filter:', JSON.stringify(filter, null, 2));
    console.log('');

    const events = await ndk.fetchEvents(filter);
    const eventsArray = Array.from(events);

    console.log(`\n📊 Results: Found ${eventsArray.length} workout event(s)\n`);

    if (eventsArray.length === 0) {
      console.log('❌ No kind 1301 workout events found for this user today.');
      console.log('');
      console.log('Possible reasons:');
      console.log('  1. User has not posted a workout today');
      console.log('  2. Event may not have propagated to all relays yet');
      console.log('  3. Relay connection issues (check if 2+ relays connected)');
    } else {
      console.log('✅ Workout event(s) found:\n');

      eventsArray.forEach((event, index) => {
        console.log(`━━━━━ Workout Event #${index + 1} ━━━━━`);
        console.log(`Event ID: ${event.id}`);
        console.log(`Created at: ${new Date(event.created_at! * 1000).toISOString()}`);
        console.log(`Content: ${event.content}`);
        console.log('\nTags:');
        event.tags.forEach(tag => {
          console.log(`  [${tag.join(', ')}]`);
        });
        console.log('');
      });
    }

    // Show relay connection status
    const status = GlobalNDKService.getStatus();
    console.log(`\n🔌 Relay Status: ${status.connectedRelays}/${status.relayCount} relays connected`);

  } catch (error) {
    console.error('❌ Error querying Nostr relays:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
  }
}

// Run the check
checkUserWorkoutToday()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
