#!/usr/bin/env ts-node
/**
 * Fetch Teams from Nostr Script
 *
 * This script queries Nostr relays for all kind 33404 team events
 * and generates a TypeScript constant file for hardcoding into the app.
 *
 * Usage:
 *   npx ts-node scripts/fetchTeams.ts
 *
 * Output:
 *   - Prints formatted TypeScript constant to console
 *   - Copy/paste into src/constants/hardcodedTeams.ts
 */

import NDK, { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';

// Nostr relay configuration (EXACTLY same as NdkTeamService)
const RELAYS = [
  'wss://relay.damus.io', // Primary: Most teams found here
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.wine',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://nostr-pub.wellorder.net',
];

interface TeamMetadata {
  id: string;
  name: string;
  description: string;
  captain: string;
  captainHex: string;
  image?: string;
  charityName?: string;
  charityDescription?: string;
  nwcConnectionString?: string;
  lightningAddress?: string;
  createdAt: number;
  rawEvent: any;
}

async function fetchTeamsFromNostr(): Promise<TeamMetadata[]> {
  console.log('🔍 Connecting to Nostr relays...');
  console.log(`📡 Relays: ${RELAYS.join(', ')}\n`);

  // Initialize NDK
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });

  await ndk.connect();
  console.log('✅ Connected to relays\n');

  // Query for all kind 33404 team events - DUAL QUERY STRATEGY (same as app)
  const limits = [500, 1000]; // Match NdkTeamService exactly
  const allEventsSet = new Set<NDKEvent>();

  for (const limit of limits) {
    console.log(`🔎 Querying for kind 33404 team events (limit: ${limit})...`);

    const filter: NDKFilter = {
      kinds: [33404],
      limit: limit,
      // NO authors - want teams from everyone
      // NO time filters - want teams from all time
    };

    console.log(`Filter: ${JSON.stringify(filter, null, 2)}\n`);

    const events = await ndk.fetchEvents(filter);
    console.log(`📦 Found ${events.size} team events from this query\n`);

    // Add to combined set (automatically deduplicates by event ID)
    for (const event of events) {
      allEventsSet.add(event);
    }

    // Breathing room between queries (same as app)
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log(`📦 Total unique team events across all queries: ${allEventsSet.size}\n`);
  const events = allEventsSet;

  // WHITELIST: Only hardcode these 11 specific teams
  const ALLOWED_TEAMS = [
    'bitcoin runners',
    'runstr',
    'family walks & hikes',
    'family walks and hikes',
    'pleb walkstr',
    'bullish',
    'spain scape',
    'ohio ruckers',
    'ruckstr',
    'x',
    'latam corre',
    'cyclestr',
  ];

  // Parse events into team metadata
  const teams: TeamMetadata[] = [];
  const seenTeamNames = new Set<string>(); // Track team names to prevent duplicates (matches app logic)

  for (const event of events) {
    try {
      const dTag = event.tags.find(t => t[0] === 'd')?.[1];

      if (!dTag) {
        console.warn(`⚠️  Skipping event ${event.id} - missing 'd' tag`);
        continue;
      }

      // Try to parse content as JSON, fall back to tags if plain text
      let content: any = {};
      try {
        content = JSON.parse(event.content);
      } catch {
        // Content is plain text, extract from tags instead
        console.log(`⚠️  Event ${event.id.substring(0, 8)}... has plain text content, using tags`);
      }

      // Extract team name from content or tags
      const nameTag = event.tags.find(t => t[0] === 'name')?.[1];
      const aboutTag = event.tags.find(t => t[0] === 'about')?.[1];
      const captainTag = event.tags.find(t => t[0] === 'captain')?.[1];

      const teamName = content.name || nameTag || 'Unnamed Team';

      // Filter 1: Skip "Deleted" teams (matches app logic from NdkTeamService line 268)
      if (teamName.toLowerCase() === 'deleted') {
        console.log(`🗑️  Skipping deleted team: ${teamName} (ID: ${dTag})`);
        continue;
      }

      // Filter 2: Only include whitelisted teams
      const teamNameLower = teamName.toLowerCase();
      // Check if team name contains any of the allowed team names (fuzzy match for emojis/spacing)
      const isAllowed = ALLOWED_TEAMS.some(allowed =>
        teamNameLower.includes(allowed) || allowed.includes(teamNameLower.replace(/\s+/g, ' ').trim())
      );

      if (!isAllowed) {
        console.log(`🚫  Skipping non-whitelisted team: ${teamName} (ID: ${dTag})`);
        continue;
      }

      // Filter 3: Skip duplicate team names (keep first occurrence) (matches app logic line 273)
      if (seenTeamNames.has(teamNameLower)) {
        console.log(`🔁  Skipping duplicate team name: ${teamName} (ID: ${dTag})`);
        continue;
      }
      seenTeamNames.add(teamNameLower);

      const team: TeamMetadata = {
        id: dTag,
        name: teamName,
        description: content.description || content.about || aboutTag || '',
        captain: content.captain || event.author.npub,
        captainHex: content.captainHex || captainTag || event.pubkey,
        image: content.image,
        charityName: content.charityName,
        charityDescription: content.charityDescription,
        nwcConnectionString: content.nwcConnectionString,
        lightningAddress: content.lightningAddress,
        createdAt: event.created_at || Math.floor(Date.now() / 1000),
        rawEvent: event.rawEvent(),
      };

      teams.push(team);
      console.log(`✅ Parsed team: ${team.name} (ID: ${team.id})`);
    } catch (error) {
      console.error(`❌ Error parsing event ${event.id}:`, error);
    }
  }

  console.log(`\n✅ Successfully parsed ${teams.length} teams\n`);

  return teams;
}

function generateTypeScriptConstant(teams: TeamMetadata[]): string {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  return `/**
 * Hardcoded Teams from Nostr
 *
 * This file contains static team data fetched from Nostr relays.
 * It eliminates the need to query Nostr for team discovery on app startup.
 *
 * Generated: ${timestamp}
 * Teams: ${teams.length}
 *
 * To update:
 *   npx ts-node scripts/fetchTeams.ts > src/constants/hardcodedTeams.ts
 */

export const BUNDLE_UPDATED = '${timestamp}';

export const HARDCODED_TEAMS = ${JSON.stringify(teams, null, 2)};

export interface HardcodedTeam {
  id: string;
  name: string;
  description: string;
  captain: string;
  captainHex: string;
  image?: string;
  charityName?: string;
  charityDescription?: string;
  nwcConnectionString?: string;
  lightningAddress?: string;
  createdAt: number;
  rawEvent: any;
}
`;
}

async function main() {
  try {
    console.log('=' .repeat(60));
    console.log('📋 RUNSTR Team Fetcher');
    console.log('=' .repeat(60));
    console.log();

    const teams = await fetchTeamsFromNostr();

    console.log('=' .repeat(60));
    console.log('📝 Generating TypeScript constant...');
    console.log('=' .repeat(60));
    console.log();

    const tsConstant = generateTypeScriptConstant(teams);

    console.log(tsConstant);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Done! Copy the output above to src/constants/hardcodedTeams.ts');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
