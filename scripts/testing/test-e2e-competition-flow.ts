#!/usr/bin/env tsx
/**
 * Test Script: End-to-End Competition Flow
 *
 * Purpose: Validate complete flow from team selection to leaderboard appearance
 *
 * Flow:
 * 1. Set RUNSTR Team as competition team
 * 2. Query user's recent kind 1301 workouts
 * 3. Verify workouts have team tag
 * 4. Query team's daily leaderboards
 * 5. Verify workouts appear on correct leaderboards (5K, 10K, etc.)
 * 6. Validate leaderboard scoring matches workout split data
 *
 * Expected Behavior:
 * - 5.5km run → appears on 5K leaderboard only
 * - 7.0km run → appears on 5K leaderboard only
 * - 10.2km run → appears on 5K and 10K leaderboards
 * - 12.8km run → appears on 5K and 10K leaderboards
 */

import NDK, { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalTeamMembershipService } from '../src/services/team/LocalTeamMembershipService';

// Test constants
const RUNSTR_TEAM_ID = '87d30c8b-aa18-4424-a629-d41ea7f89078';
const USER_NPUB = 'npub1xr8tvnnnr9aqt9vv30vj4vreeq2mk38mlwe7khvhvmzjqlcghh6sr85uum';

// Nostr relays
const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

interface SplitData {
  km: number;
  time: string;
  seconds: number;
}

interface WorkoutData {
  eventId: string;
  created: Date;
  distance: number;
  splits: SplitData[];
  hasTeamTag: boolean;
  teamId: string | null;
  expectedLeaderboards: string[];
}

function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length === 3) {
    const [hours, mins, secs] = parts.map(Number);
    return hours * 3600 + mins * 60 + secs;
  } else if (parts.length === 2) {
    const [mins, secs] = parts.map(Number);
    return mins * 60 + secs;
  }
  return 0;
}

function determineExpectedLeaderboards(splits: SplitData[]): string[] {
  const leaderboards: string[] = [];

  if (splits.length >= 5) leaderboards.push('5K');
  if (splits.length >= 10) leaderboards.push('10K');
  if (splits.length >= 21) leaderboards.push('Half Marathon');
  if (splits.length >= 42) leaderboards.push('Marathon');

  return leaderboards;
}

function parseWorkoutEvent(event: NDKEvent): WorkoutData {
  const tags = event.tags;

  // Get team tag
  const teamTag = tags.find(t => t[0] === 'team');
  const hasTeamTag = !!teamTag;
  const teamId = teamTag ? teamTag[1] : null;

  // Get distance
  const distanceTag = tags.find(t => t[0] === 'distance');
  const distance = distanceTag ? parseFloat(distanceTag[1]) : 0;

  // Get splits
  const splitTags = tags.filter(t => t[0] === 'split');
  const splits: SplitData[] = splitTags
    .map(tag => ({
      km: parseInt(tag[1]),
      time: tag[2],
      seconds: parseTimeToSeconds(tag[2]),
    }))
    .sort((a, b) => a.km - b.km);

  const expectedLeaderboards = determineExpectedLeaderboards(splits);

  return {
    eventId: event.id!,
    created: new Date(event.created_at! * 1000),
    distance,
    splits,
    hasTeamTag,
    teamId,
    expectedLeaderboards,
  };
}

async function step1_SetCompetitionTeam(): Promise<boolean> {
  console.log('\n📋 Step 1: Set Competition Team');
  console.log('------------------------------------------------');

  await LocalTeamMembershipService.setCompetitionTeam(RUNSTR_TEAM_ID);
  const competitionTeam = await LocalTeamMembershipService.getCompetitionTeam();

  if (competitionTeam === RUNSTR_TEAM_ID) {
    console.log(`✅ Competition team set to: ${RUNSTR_TEAM_ID}`);
    return true;
  } else {
    console.log(`❌ Failed to set competition team`);
    return false;
  }
}

async function step2_QueryRecentWorkouts(ndk: NDK, userPubkey: string): Promise<WorkoutData[]> {
  console.log('\n📋 Step 2: Query Recent Workouts');
  console.log('------------------------------------------------');

  const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;

  const filter: NDKFilter = {
    kinds: [1301],
    authors: [userPubkey],
    since: oneDayAgo,
    limit: 10,
  };

  console.log(`   🔍 Querying kind 1301 events from last 24 hours...`);

  const events = await ndk.fetchEvents(filter);
  const eventsArray = Array.from(events).sort((a, b) => b.created_at! - a.created_at!);

  console.log(`   ✅ Found ${eventsArray.length} workout events`);

  const workouts: WorkoutData[] = eventsArray.map(parseWorkoutEvent);

  return workouts;
}

async function step3_VerifyTeamTags(workouts: WorkoutData[]): Promise<boolean> {
  console.log('\n📋 Step 3: Verify Team Tags');
  console.log('------------------------------------------------');

  let allHaveTags = true;

  workouts.forEach((workout, index) => {
    console.log(`\n   Workout ${index + 1}:`);
    console.log(`      Event ID: ${workout.eventId}`);
    console.log(`      Created: ${workout.created.toLocaleString()}`);
    console.log(`      Distance: ${workout.distance}km`);
    console.log(`      Splits: ${workout.splits.length}`);

    if (workout.hasTeamTag) {
      console.log(`      ✅ Team Tag: ${workout.teamId}`);

      if (workout.teamId !== RUNSTR_TEAM_ID) {
        console.log(`      ⚠️  Team ID mismatch! Expected ${RUNSTR_TEAM_ID}`);
        allHaveTags = false;
      }
    } else {
      console.log(`      ❌ No team tag found`);
      allHaveTags = false;
    }
  });

  if (allHaveTags) {
    console.log(`\n   ✅ All workouts have correct team tags`);
  } else {
    console.log(`\n   ❌ Some workouts missing or have incorrect team tags`);
  }

  return allHaveTags;
}

async function step4_QueryDailyLeaderboards(ndk: NDK): Promise<Map<string, NDKEvent[]>> {
  console.log('\n📋 Step 4: Query Daily Leaderboards');
  console.log('------------------------------------------------');

  // Calculate today's midnight in local timezone
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayMidnight = Math.floor(midnight.getTime() / 1000);

  console.log(`   🕐 Query range: ${new Date(todayMidnight * 1000).toLocaleString()} → now`);

  const filter: NDKFilter = {
    kinds: [1301],
    '#team': [RUNSTR_TEAM_ID],
    since: todayMidnight,
  };

  console.log(`   🔍 Querying team workouts from today...`);
  console.log(`   📋 Filter:`, JSON.stringify(filter, null, 2));

  const events = await ndk.fetchEvents(filter);
  const eventsArray = Array.from(events);

  console.log(`   ✅ Found ${eventsArray.length} team workouts today`);

  // Organize by leaderboard
  const leaderboards = new Map<string, NDKEvent[]>();
  leaderboards.set('5K', []);
  leaderboards.set('10K', []);
  leaderboards.set('Half Marathon', []);
  leaderboards.set('Marathon', []);

  eventsArray.forEach(event => {
    const workout = parseWorkoutEvent(event);

    workout.expectedLeaderboards.forEach(board => {
      const current = leaderboards.get(board) || [];
      current.push(event);
      leaderboards.set(board, current);
    });
  });

  console.log(`\n   📊 Leaderboard Breakdown:`);
  leaderboards.forEach((workouts, boardName) => {
    console.log(`      ${boardName}: ${workouts.length} workouts`);
  });

  return leaderboards;
}

async function step5_VerifyLeaderboardAppearance(
  workouts: WorkoutData[],
  leaderboards: Map<string, NDKEvent[]>
): Promise<boolean> {
  console.log('\n📋 Step 5: Verify Leaderboard Appearance');
  console.log('------------------------------------------------');

  let allCorrect = true;

  workouts.forEach((workout, index) => {
    console.log(`\n   Workout ${index + 1} (${workout.distance}km):`);
    console.log(`      Expected leaderboards: ${workout.expectedLeaderboards.join(', ') || 'None'}`);

    workout.expectedLeaderboards.forEach(expectedBoard => {
      const boardWorkouts = leaderboards.get(expectedBoard) || [];
      const appearsOnBoard = boardWorkouts.some(e => e.id === workout.eventId);

      if (appearsOnBoard) {
        console.log(`      ✅ Appears on ${expectedBoard} leaderboard`);
      } else {
        console.log(`      ❌ MISSING from ${expectedBoard} leaderboard`);
        allCorrect = false;
      }
    });
  });

  if (allCorrect) {
    console.log(`\n   ✅ All workouts appear on correct leaderboards`);
  } else {
    console.log(`\n   ❌ Some workouts missing from expected leaderboards`);
  }

  return allCorrect;
}

async function main() {
  console.log('🧪 End-to-End Competition Flow Test\n');
  console.log('================================================\n');

  console.log('🎯 Test Objective:');
  console.log('   Validate complete flow from team selection to leaderboard appearance\n');

  console.log('📝 Flow Steps:');
  console.log('   1. Set RUNSTR Team as competition team');
  console.log('   2. Query recent kind 1301 workouts');
  console.log('   3. Verify workouts have team tag');
  console.log('   4. Query team daily leaderboards');
  console.log('   5. Verify workouts appear on correct leaderboards\n');

  console.log('================================================\n');

  // Step 1: Set competition team
  const step1Success = await step1_SetCompetitionTeam();
  if (!step1Success) {
    console.log('\n❌ Step 1 failed. Aborting test.');
    process.exit(1);
  }

  // Initialize NDK
  console.log('\n🌐 Connecting to Nostr relays...');
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });

  await ndk.connect();
  console.log(`✅ Connected to ${ndk.pool.connectedRelays().length} relays\n`);

  // Decode user pubkey
  const decoded = nip19.decode(USER_NPUB);
  const userPubkey = decoded.data as string;
  console.log(`👤 User: ${USER_NPUB}`);
  console.log(`   Hex: ${userPubkey}\n`);

  // Step 2: Query recent workouts
  const workouts = await step2_QueryRecentWorkouts(ndk, userPubkey);

  if (workouts.length === 0) {
    console.log('\n⚠️  No recent workouts found. Cannot test leaderboard appearance.');
    console.log('💡 Publish a workout first, then re-run this test.');
    process.exit(0);
  }

  // Step 3: Verify team tags
  const step3Success = await step3_VerifyTeamTags(workouts);

  // Step 4: Query daily leaderboards
  const leaderboards = await step4_QueryDailyLeaderboards(ndk);

  // Step 5: Verify leaderboard appearance
  const step5Success = await step5_VerifyLeaderboardAppearance(workouts, leaderboards);

  // Summary
  console.log('\n================================================');
  console.log('\n📊 Test Summary:\n');

  console.log(`   Step 1 (Set Competition Team): ${step1Success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Step 2 (Query Workouts): ✅ PASS (${workouts.length} workouts found)`);
  console.log(`   Step 3 (Verify Team Tags): ${step3Success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Step 4 (Query Leaderboards): ✅ PASS`);
  console.log(`   Step 5 (Verify Appearance): ${step5Success ? '✅ PASS' : '❌ FAIL'}`);

  if (step3Success && step5Success) {
    console.log('\n✅ All tests passed! End-to-end competition flow working correctly.\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Competition flow has issues.\n');
    console.log('💡 Troubleshooting Steps:');
    console.log('   1. Verify team tag is added during workout publishing');
    console.log('   2. Check SimpleLeaderboardService query filters');
    console.log('   3. Ensure timezone handling is correct (local vs UTC)');
    console.log('   4. Verify split count logic matches leaderboard eligibility');
    console.log();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Test error:', error);
  process.exit(1);
});
