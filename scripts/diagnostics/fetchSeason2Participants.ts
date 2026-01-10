/**
 * Fetch Season 2 Participants Script
 *
 * Queries the kind 30000 participant list and kind 0 profiles
 * to generate a hardcoded TypeScript array for season2.ts
 *
 * Run with: npx ts-node scripts/diagnostics/fetchSeason2Participants.ts
 */

// WebSocket polyfill for Node.js
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebSocket = require('ws');
(global as any).WebSocket = WebSocket;

import NDK, { NDKFilter } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

// RUNSTR admin pubkey (from season2.ts)
const RUNSTR_ADMIN_PUBKEY = '611021eaaa2692741b1236bbcea54c6aa9f20ba30cace316c3a93d45089a7d0f';
const PARTICIPANT_LIST_DTAG = 'runstr-season-2-participants';

// Relays to query
const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

interface ParticipantData {
  pubkey: string;
  npub: string;
  name: string;
  picture?: string;
}

async function main() {
  console.log('🚀 Fetching Season 2 participants...\n');

  // Initialize NDK
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });

  await ndk.connect();
  console.log('✅ Connected to relays\n');

  // Wait for relay connections
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 1: Fetch participant list (kind 30000)
  console.log('📋 Fetching participant list (kind 30000)...');
  const listFilter: NDKFilter = {
    kinds: [30000 as any],
    authors: [RUNSTR_ADMIN_PUBKEY],
    '#d': [PARTICIPANT_LIST_DTAG],
    limit: 1,
  };

  const listEvents = await ndk.fetchEvents(listFilter);

  if (listEvents.size === 0) {
    console.error('❌ No participant list found!');
    process.exit(1);
  }

  // Get the most recent list
  const sortedEvents = Array.from(listEvents).sort(
    (a, b) => (b.created_at || 0) - (a.created_at || 0)
  );
  const listEvent = sortedEvents[0];

  // Extract pubkeys from 'p' tags
  const pubkeys = listEvent.tags
    .filter(t => t[0] === 'p')
    .map(t => t[1]);

  console.log(`✅ Found ${pubkeys.length} participants\n`);

  // Step 2: Fetch profiles (kind 0)
  console.log('👤 Fetching profiles (kind 0)...');
  const profileFilter: NDKFilter = {
    kinds: [0 as any],
    authors: pubkeys,
  };

  const profileEvents = await ndk.fetchEvents(profileFilter);
  console.log(`✅ Received ${profileEvents.size} profile events\n`);

  // Parse profiles
  const profileMap = new Map<string, { name: string; picture?: string }>();

  for (const event of profileEvents) {
    try {
      const content = JSON.parse(event.content);
      // Priority: display_name → name (display_name is usually the human-readable name)
      const name = content.display_name || content.displayName || content.name || 'Unknown';
      profileMap.set(event.pubkey, {
        name,
        picture: content.picture || content.image,
      });
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Step 3: Build participant data array
  const participants: ParticipantData[] = pubkeys.map(pubkey => {
    const profile = profileMap.get(pubkey);
    let npub = '';
    try {
      npub = nip19.npubEncode(pubkey);
    } catch (e) {
      npub = pubkey;
    }

    return {
      pubkey,
      npub,
      name: profile?.name || `User ${pubkey.slice(0, 8)}`,
      picture: profile?.picture,
    };
  });

  // Step 4: Output TypeScript code
  console.log('📝 Generated TypeScript array:\n');
  console.log('// ============================================================================');
  console.log('// HARDCODED SEASON 2 PARTICIPANTS');
  console.log('// Generated on:', new Date().toISOString());
  console.log('// ============================================================================');
  console.log('');
  console.log('export interface Season2ParticipantData {');
  console.log('  pubkey: string;');
  console.log('  npub: string;');
  console.log('  name: string;');
  console.log('  picture?: string;');
  console.log('}');
  console.log('');
  console.log('export const SEASON_2_PARTICIPANTS: Season2ParticipantData[] = [');

  for (const p of participants) {
    console.log('  {');
    console.log(`    pubkey: '${p.pubkey}',`);
    console.log(`    npub: '${p.npub}',`);
    console.log(`    name: '${p.name.replace(/'/g, "\\'")}',`);
    if (p.picture) {
      console.log(`    picture: '${p.picture}',`);
    }
    console.log('  },');
  }

  console.log('];');
  console.log('');

  // Summary
  console.log('\n// ============================================================================');
  console.log(`// Total: ${participants.length} participants`);
  console.log(`// With profiles: ${profileMap.size}`);
  console.log(`// Missing profiles: ${participants.filter(p => !profileMap.has(p.pubkey)).length}`);
  console.log('// ============================================================================');

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
