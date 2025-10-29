/**
 * Nostr Event Verification Script
 *
 * Connects to Nostr relays and searches for events/leagues created in the RUNSTR app.
 * Helps diagnose if events are actually being published to Nostr or failing silently.
 *
 * Usage:
 *   npm run verify:events                          - Search all events
 *   npm run verify:events -- --pubkey=npub1...     - Filter by creator pubkey
 *   npm run verify:events -- --team=team-id        - Filter by team ID
 *   npm run verify:events -- --limit=50            - Set result limit (default: 100)
 */

import NDK, { NDKFilter, NDKEvent } from '@nostr-dev-kit/ndk';
import 'websocket-polyfill';

// Same relays the app uses
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

interface EventData {
  id: string;
  kind: number;
  name: string;
  activityType?: string;
  createdBy: string;
  teamId?: string;
  eventDate?: string;
  entryFee?: number;
  description?: string;
  createdAt: Date;
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: { pubkey?: string; team?: string; limit?: number } = {};

  args.forEach(arg => {
    if (arg.startsWith('--pubkey=')) {
      options.pubkey = arg.split('=')[1];
    } else if (arg.startsWith('--team=')) {
      options.team = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]) || 100;
    }
  });

  return options;
}

// Convert npub to hex if needed
function normalizePublicKey(pubkey: string): string {
  // If it's an npub, we need to convert it (simplified - just remove npub prefix for now)
  // In production, you'd use NDK's nip19 functions
  if (pubkey.startsWith('npub1')) {
    console.warn('⚠️ Note: npub conversion not implemented. Please provide hex pubkey.');
    return pubkey;
  }
  return pubkey;
}

// Parse event from NDK event
function parseEvent(event: NDKEvent): EventData {
  const getTag = (name: string) => event.tags.find(t => t[0] === name)?.[1];

  return {
    id: getTag('d') || event.id,
    kind: event.kind!,
    name: getTag('name') || 'Unnamed',
    activityType: getTag('activity_type'),
    createdBy: event.pubkey,
    teamId: getTag('team') || getTag('team_id'),
    eventDate: getTag('event_date') || getTag('start_date'),
    entryFee: getTag('entry_fee') ? parseInt(getTag('entry_fee')!) : undefined,
    description: getTag('description'),
    createdAt: new Date(event.created_at! * 1000),
  };
}

// Format date for display
function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

// Shorten pubkey for display
function shortenPubkey(pubkey: string): string {
  if (pubkey.length > 16) {
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
  }
  return pubkey;
}

async function main() {
  console.log('🔍 RUNSTR Nostr Event Verification Tool\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const options = parseArgs();
  const limit = options.limit || 100;

  // Display search parameters
  console.log('📋 Search Parameters:');
  console.log(`   Relays: ${RELAYS.length} (${RELAYS.join(', ')})`);
  if (options.pubkey) {
    console.log(`   Filter by creator: ${shortenPubkey(options.pubkey)}`);
  }
  if (options.team) {
    console.log(`   Filter by team: ${options.team}`);
  }
  console.log(`   Result limit: ${limit}`);
  console.log('');

  // Initialize NDK
  console.log('🔌 Connecting to Nostr relays...');
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
    autoConnectUserRelays: false,
    autoFetchUserMutelist: false,
  });

  try {
    await ndk.connect(10000); // 10 second timeout

    const stats = ndk.pool?.stats();
    const connectedCount = stats?.connected || 0;

    if (connectedCount === 0) {
      console.error('❌ Failed to connect to any relays');
      process.exit(1);
    }

    console.log(`✅ Connected to ${connectedCount}/${RELAYS.length} relays\n`);

    // Search for Events (kind 30101)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 Searching for Events (kind 30101)...\n');

    const eventFilter: NDKFilter = {
      kinds: [30101],
      limit,
    };

    if (options.pubkey) {
      eventFilter.authors = [normalizePublicKey(options.pubkey)];
    }

    if (options.team) {
      eventFilter['#team'] = [options.team];
    }

    // ✅ FIX: Add explicit timeout to prevent hanging
    const eventEvents = await Promise.race([
      ndk.fetchEvents(eventFilter),
      new Promise<Set<NDKEvent>>((resolve) => setTimeout(() => resolve(new Set()), 5000)) // 5s timeout
    ]);
    const events: EventData[] = [];

    eventEvents.forEach(event => {
      try {
        events.push(parseEvent(event));
      } catch (error) {
        console.warn(`⚠️ Failed to parse event: ${event.id}`);
      }
    });

    if (events.length === 0) {
      console.log('❌ No events found matching your criteria\n');
    } else {
      console.log(`✅ Found ${events.length} events:\n`);

      // Sort by creation date (most recent first)
      events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      events.forEach((event, index) => {
        console.log(`${index + 1}. ${event.name}`);
        console.log(`   ID: ${event.id}`);
        console.log(`   Activity: ${event.activityType || 'N/A'}`);
        console.log(`   Creator: ${shortenPubkey(event.createdBy)}`);
        console.log(`   Team: ${event.teamId || 'N/A'}`);
        console.log(`   Event Date: ${formatDate(event.eventDate)}`);
        console.log(`   Entry Fee: ${event.entryFee ? `${event.entryFee} sats` : 'Free'}`);
        console.log(`   Created: ${event.createdAt.toLocaleString()}`);
        if (event.description) {
          console.log(`   Description: ${event.description.substring(0, 60)}${event.description.length > 60 ? '...' : ''}`);
        }
        console.log('');
      });
    }

    // Search for Leagues (kind 30100)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏆 Searching for Leagues (kind 30100)...\n');

    const leagueFilter: NDKFilter = {
      kinds: [30100],
      limit,
    };

    if (options.pubkey) {
      leagueFilter.authors = [normalizePublicKey(options.pubkey)];
    }

    if (options.team) {
      leagueFilter['#team'] = [options.team];
    }

    // ✅ FIX: Add explicit timeout to prevent hanging
    const leagueEvents = await Promise.race([
      ndk.fetchEvents(leagueFilter),
      new Promise<Set<NDKEvent>>((resolve) => setTimeout(() => resolve(new Set()), 5000)) // 5s timeout
    ]);
    const leagues: EventData[] = [];

    leagueEvents.forEach(event => {
      try {
        leagues.push(parseEvent(event));
      } catch (error) {
        console.warn(`⚠️ Failed to parse league: ${event.id}`);
      }
    });

    if (leagues.length === 0) {
      console.log('❌ No leagues found matching your criteria\n');
    } else {
      console.log(`✅ Found ${leagues.length} leagues:\n`);

      // Sort by creation date (most recent first)
      leagues.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      leagues.forEach((league, index) => {
        console.log(`${index + 1}. ${league.name}`);
        console.log(`   ID: ${league.id}`);
        console.log(`   Activity: ${league.activityType || 'N/A'}`);
        console.log(`   Creator: ${shortenPubkey(league.createdBy)}`);
        console.log(`   Team: ${league.teamId || 'N/A'}`);
        console.log(`   Start Date: ${formatDate(league.eventDate)}`);
        console.log(`   Created: ${league.createdAt.toLocaleString()}`);
        if (league.description) {
          console.log(`   Description: ${league.description.substring(0, 60)}${league.description.length > 60 ? '...' : ''}`);
        }
        console.log('');
      });
    }

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Summary:\n');
    console.log(`   Total Events (kind 30101): ${events.length}`);
    console.log(`   Total Leagues (kind 30100): ${leagues.length}`);
    console.log(`   Total Competition Items: ${events.length + leagues.length}`);

    if (events.length > 0) {
      const now = new Date();
      const upcomingEvents = events.filter(e => e.eventDate && new Date(e.eventDate) > now).length;
      const pastEvents = events.filter(e => e.eventDate && new Date(e.eventDate) <= now).length;
      console.log(`   Upcoming Events: ${upcomingEvents}`);
      console.log(`   Past Events: ${pastEvents}`);
    }

    if (events.length > 0 || leagues.length > 0) {
      const allItems = [...events, ...leagues];
      const uniqueCreators = new Set(allItems.map(item => item.createdBy));
      const uniqueTeams = new Set(allItems.map(item => item.teamId).filter(id => id));
      console.log(`   Unique Creators: ${uniqueCreators.size}`);
      console.log(`   Unique Teams: ${uniqueTeams.size}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Verification complete!\n');

    // Cleanup
    for (const relay of ndk.pool.relays.values()) {
      relay.disconnect();
    }

  } catch (error) {
    console.error('❌ Error during verification:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
