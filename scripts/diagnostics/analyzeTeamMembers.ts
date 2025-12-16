#!/usr/bin/env tsx
/**
 * Team Member List Analyzer
 *
 * This script analyzes kind 30000 member lists for each hardcoded team.
 * It shows which teams have member lists, how many members, and the actual npubs.
 *
 * Usage:
 *   npx tsx scripts/analyzeTeamMembers.ts
 */

import NDK, { NDKFilter } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load hardcoded teams from file
const hardcodedTeamsPath = path.join(__dirname, '../src/constants/hardcodedTeams.ts');
const hardcodedTeamsContent = fs.readFileSync(hardcodedTeamsPath, 'utf-8');

// Extract HARDCODED_TEAMS array using regex
const match = hardcodedTeamsContent.match(/export const HARDCODED_TEAMS = (\[[\s\S]*?\]);/);
if (!match) {
  throw new Error('Could not find HARDCODED_TEAMS in file');
}

// Parse the JSON array
const HARDCODED_TEAMS = JSON.parse(match[1]);

// Nostr relay configuration
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.wine',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://nostr-pub.wellorder.net',
];

interface TeamMemberAnalysis {
  teamId: string;
  teamName: string;
  captain: string;
  captainHex: string;
  memberListFound: boolean;
  memberCount: number;
  members: Array<{ npub: string; hex: string }>;
  listEventId?: string;
  listCreatedAt?: number;
}

async function analyzeTeamMembers(): Promise<TeamMemberAnalysis[]> {
  console.log('🔍 Connecting to Nostr relays...');
  console.log(`📡 Relays: ${RELAYS.join(', ')}\n`);

  // Initialize NDK
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });

  await ndk.connect();
  console.log('✅ Connected to relays\n');

  console.log(`📋 Analyzing ${HARDCODED_TEAMS.length} teams...\n`);
  console.log('='.repeat(80));

  const results: TeamMemberAnalysis[] = [];

  for (const team of HARDCODED_TEAMS) {
    console.log(`\n🏃 Team: ${team.name}`);
    console.log(`   ID: ${team.id}`);
    console.log(`   Captain: ${team.captain}`);
    console.log(`   Captain Hex: ${team.captainHex}`);

    // Query for kind 30000 member list
    const filter: NDKFilter = {
      kinds: [30000],
      authors: [team.captainHex],
      '#d': [`${team.id}-members`],
      limit: 10, // Should only be 1 member list per team
    };

    console.log(`   🔎 Querying for member list...`);

    try {
      const events = await ndk.fetchEvents(filter);

      if (events.size === 0) {
        console.log(`   ❌ NO MEMBER LIST FOUND`);
        results.push({
          teamId: team.id,
          teamName: team.name,
          captain: team.captain,
          captainHex: team.captainHex,
          memberListFound: false,
          memberCount: 0,
          members: [],
        });
        continue;
      }

      // Get the most recent member list (should only be 1)
      const memberListEvent = Array.from(events).sort(
        (a, b) => (b.created_at || 0) - (a.created_at || 0)
      )[0];

      // Extract member pubkeys from 'p' tags
      const pTags = memberListEvent.tags.filter((tag) => tag[0] === 'p');
      const members = pTags.map((tag) => {
        const hex = tag[1];
        let npub = '';
        try {
          npub = nip19.npubEncode(hex);
        } catch (error) {
          npub = `[invalid: ${hex.substring(0, 8)}...]`;
        }
        return { npub, hex };
      });

      console.log(`   ✅ MEMBER LIST FOUND`);
      console.log(`   📊 Members: ${members.length}`);
      console.log(`   📅 List Created: ${new Date((memberListEvent.created_at || 0) * 1000).toISOString()}`);
      console.log(`   🆔 Event ID: ${memberListEvent.id}`);

      if (members.length > 0) {
        console.log(`   👥 Member List:`);
        members.forEach((member, index) => {
          console.log(`      ${index + 1}. ${member.npub}`);
          console.log(`         (${member.hex})`);
        });
      }

      results.push({
        teamId: team.id,
        teamName: team.name,
        captain: team.captain,
        captainHex: team.captainHex,
        memberListFound: true,
        memberCount: members.length,
        members,
        listEventId: memberListEvent.id,
        listCreatedAt: memberListEvent.created_at,
      });
    } catch (error) {
      console.error(`   ❌ Error querying member list:`, error);
      results.push({
        teamId: team.id,
        teamName: team.name,
        captain: team.captain,
        captainHex: team.captainHex,
        memberListFound: false,
        memberCount: 0,
        members: [],
      });
    }

    console.log('   ' + '-'.repeat(76));
  }

  return results;
}

function printSummary(results: TeamMemberAnalysis[]) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  const teamsWithLists = results.filter((r) => r.memberListFound);
  const teamsWithoutLists = results.filter((r) => !r.memberListFound);
  const totalMembers = results.reduce((sum, r) => sum + r.memberCount, 0);

  console.log(`\n✅ Teams with member lists: ${teamsWithLists.length}/${results.length}`);
  console.log(`❌ Teams without member lists: ${teamsWithoutLists.length}/${results.length}`);
  console.log(`👥 Total members across all teams: ${totalMembers}`);

  if (teamsWithLists.length > 0) {
    console.log(`\n📋 Teams with members:`);
    teamsWithLists
      .sort((a, b) => b.memberCount - a.memberCount)
      .forEach((team) => {
        console.log(`   - ${team.teamName}: ${team.memberCount} members`);
      });
  }

  if (teamsWithoutLists.length > 0) {
    console.log(`\n❌ Teams without member lists:`);
    teamsWithoutLists.forEach((team) => {
      console.log(`   - ${team.teamName} (Captain: ${team.captain})`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('💡 INSIGHTS');
  console.log('='.repeat(80));

  if (teamsWithoutLists.length > 0) {
    console.log(`\n⚠️  ${teamsWithoutLists.length} teams are missing member lists`);
    console.log(`   These teams may be newly created or captains haven't approved members yet`);
  }

  if (totalMembers > 0) {
    const avgMembers = (totalMembers / teamsWithLists.length).toFixed(1);
    console.log(`\n📈 Average members per team (with lists): ${avgMembers}`);
  }

  const largestTeam = results.reduce((max, team) =>
    team.memberCount > max.memberCount ? team : max
  );
  if (largestTeam.memberCount > 0) {
    console.log(`\n🏆 Largest team: ${largestTeam.teamName} (${largestTeam.memberCount} members)`);
  }

  console.log('\n' + '='.repeat(80));
}

async function main() {
  try {
    console.log('=' .repeat(80));
    console.log('📋 RUNSTR Team Member List Analyzer');
    console.log('=' .repeat(80));
    console.log();

    const results = await analyzeTeamMembers();

    printSummary(results);

    console.log('\n✅ Analysis complete!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
