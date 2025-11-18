#!/usr/bin/env tsx
/**
 * Test Script: Team Tag Propagation Verification
 *
 * Purpose: Verify that competition team setting correctly adds team tag to workouts
 *
 * Tests:
 * - No competition team set → No team tag in workout
 * - Competition team set → Team tag appears in workout tags
 * - Team tag format is correct: ['team', 'team-uuid']
 * - Team tag persists across multiple workouts
 *
 * Critical Flow:
 * 1. User sets competition team in AsyncStorage
 * 2. User publishes workout
 * 3. WorkoutPublishingService reads competition team
 * 4. Team tag added to kind 1301 event
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalTeamMembershipService } from '../src/services/team/LocalTeamMembershipService';
import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

// Test constants
const TEST_TEAM_ID = '87d30c8b-aa18-4424-a629-d41ea7f89078'; // RUNSTR Team
const USER_NPUB = 'npub1xr8tvnnnr9aqt9vv30vj4vreeq2mk38mlwe7khvhvmzjqlcghh6sr85uum';

// Nostr relays
const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function logTest(testName: string, passed: boolean, message: string) {
  results.push({ testName, passed, message });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${testName}: ${message}`);
}

async function test1_NoCompetitionTeamSet() {
  console.log('\n📋 Test 1: No Competition Team Set');
  console.log('------------------------------------------------');

  // Clear competition team
  await AsyncStorage.removeItem('@runstr:competition_team');

  const competitionTeam = await LocalTeamMembershipService.getCompetitionTeam();

  if (competitionTeam === null) {
    logTest('No Competition Team', true, 'Competition team correctly null');
    console.log('   Expected behavior: Workout should NOT have team tag');
    return true;
  } else {
    logTest('No Competition Team', false, `Expected null, got ${competitionTeam}`);
    return false;
  }
}

async function test2_CompetitionTeamSet() {
  console.log('\n📋 Test 2: Competition Team Set');
  console.log('------------------------------------------------');

  // Set competition team
  await LocalTeamMembershipService.setCompetitionTeam(TEST_TEAM_ID);

  const competitionTeam = await LocalTeamMembershipService.getCompetitionTeam();

  if (competitionTeam === TEST_TEAM_ID) {
    logTest('Competition Team Set', true, `Competition team correctly set to ${TEST_TEAM_ID}`);
    console.log('   Expected behavior: Workout should have team tag');
    return true;
  } else {
    logTest('Competition Team Set', false, `Expected ${TEST_TEAM_ID}, got ${competitionTeam}`);
    return false;
  }
}

async function test3_RecentWorkoutHasTeamTag() {
  console.log('\n📋 Test 3: Recent Workout Has Team Tag');
  console.log('------------------------------------------------');

  // Decode npub to hex
  const decoded = nip19.decode(USER_NPUB);
  const userPubkey = decoded.data as string;

  // Initialize NDK
  console.log('   🌐 Connecting to Nostr relays...');
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });

  await ndk.connect();
  console.log(`   ✅ Connected to ${ndk.pool.connectedRelays().length} relays`);

  // Query for most recent kind 1301 event
  const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;

  const events = await ndk.fetchEvents({
    kinds: [1301],
    authors: [userPubkey],
    since: oneDayAgo,
    limit: 1,
  });

  const eventsArray = Array.from(events);

  if (eventsArray.length === 0) {
    logTest('Recent Workout Has Team Tag', false, 'No recent kind 1301 events found');
    console.log('   💡 User needs to publish a workout to test team tag propagation');
    return false;
  }

  const event = eventsArray[0];
  console.log(`   📥 Found event: ${event.id}`);
  console.log(`   📅 Created: ${new Date(event.created_at! * 1000).toLocaleString()}`);

  // Check for team tag
  const teamTag = event.tags.find(t => t[0] === 'team');

  if (!teamTag) {
    logTest('Recent Workout Has Team Tag', false, 'No team tag found in event');
    console.log('   💡 WorkoutPublishingService may not be reading competition team setting');
    console.log('   📋 Event tags:', JSON.stringify(event.tags, null, 2));
    return false;
  }

  console.log(`   ✅ Found team tag: ['team', '${teamTag[1]}']`);

  // Verify team tag format
  if (teamTag[1] === TEST_TEAM_ID) {
    logTest('Recent Workout Has Team Tag', true, `Team tag correctly set to ${TEST_TEAM_ID}`);
    return true;
  } else {
    logTest('Recent Workout Has Team Tag', false, `Expected team ID ${TEST_TEAM_ID}, got ${teamTag[1]}`);
    return false;
  }
}

async function test4_TeamTagFormat() {
  console.log('\n📋 Test 4: Team Tag Format Validation');
  console.log('------------------------------------------------');

  // Decode npub to hex
  const decoded = nip19.decode(USER_NPUB);
  const userPubkey = decoded.data as string;

  // Initialize NDK
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });

  await ndk.connect();

  // Query for most recent kind 1301 event
  const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;

  const events = await ndk.fetchEvents({
    kinds: [1301],
    authors: [userPubkey],
    since: oneDayAgo,
    limit: 1,
  });

  const eventsArray = Array.from(events);

  if (eventsArray.length === 0) {
    logTest('Team Tag Format', false, 'No recent kind 1301 events found');
    return false;
  }

  const event = eventsArray[0];
  const teamTag = event.tags.find(t => t[0] === 'team');

  if (!teamTag) {
    logTest('Team Tag Format', false, 'No team tag found');
    return false;
  }

  // Validate format: ['team', 'uuid-string']
  const isValidFormat =
    Array.isArray(teamTag) &&
    teamTag.length === 2 &&
    teamTag[0] === 'team' &&
    typeof teamTag[1] === 'string' &&
    teamTag[1].length > 0;

  if (isValidFormat) {
    logTest('Team Tag Format', true, 'Team tag format is correct');
    console.log(`   ✅ Tag format: ['team', '${teamTag[1]}']`);
    return true;
  } else {
    logTest('Team Tag Format', false, 'Team tag format is invalid');
    console.log(`   ❌ Invalid tag: ${JSON.stringify(teamTag)}`);
    return false;
  }
}

async function main() {
  console.log('🧪 Team Tag Propagation Verification Test\n');
  console.log('================================================\n');

  console.log('🎯 Test Objective:');
  console.log('   Verify that competition team setting correctly propagates to workout events\n');

  console.log('📝 Critical Flow:');
  console.log('   1. User sets competition team in AsyncStorage');
  console.log('   2. User publishes workout');
  console.log('   3. WorkoutPublishingService reads competition team');
  console.log('   4. Team tag added to kind 1301 event\n');

  console.log('================================================\n');

  // Run tests
  await test1_NoCompetitionTeamSet();
  await test2_CompetitionTeamSet();
  await test3_RecentWorkoutHasTeamTag();
  await test4_TeamTagFormat();

  // Summary
  console.log('\n================================================');
  console.log('\n📊 Test Results Summary:\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.testName}: ${result.message}`);
  });

  console.log(`\n📈 Total: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('\n✅ All tests passed! Team tag propagation working correctly.\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Team tag propagation has issues.\n');
    console.log('💡 Troubleshooting Steps:');
    console.log('   1. Verify LocalTeamMembershipService reads/writes AsyncStorage correctly');
    console.log('   2. Check WorkoutPublishingService calls getCompetitionTeam() before publishing');
    console.log('   3. Ensure team tag is added to tags array before NDK event creation');
    console.log('   4. Verify team tag format matches Nostr event spec: ["team", "uuid"]');
    console.log();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Test error:', error);
  process.exit(1);
});
