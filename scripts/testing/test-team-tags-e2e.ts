/**
 * End-to-End Integration Test: Team Tags & Leaderboard System
 *
 * Tests the complete flow WITHOUT React Native dependencies:
 * 1. Generate test keypair using NDK
 * 2. Manually publish kind 1301 events with team tags to real Nostr relays
 * 3. Query workouts using team filter
 * 4. Verify team tags are correctly stored and retrieved
 *
 * Usage: npx tsx scripts/test-team-tags-e2e.ts
 *
 * IMPORTANT: This publishes real events to production Nostr relays.
 * Events are permanent and cannot be deleted.
 */

import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';

// Test configuration
const TEST_TEAM_ID = `test-team-bitcoin-${Date.now()}`;
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

// Test result tracking
let passCount = 0;
let failCount = 0;

function test(name: string, condition: boolean, message: string) {
  if (condition) {
    passCount++;
    console.log(`✅ PASS: ${name}`);
  } else {
    failCount++;
    console.log(`❌ FAIL: ${name} - ${message}`);
  }
}

// Helper: Format duration as HH:MM:SS
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Helper: Create kind 1301 workout event
function createWorkoutEvent(
  ndk: NDK,
  signer: NDKPrivateKeySigner,
  workout: {
    distanceKm: number;
    durationSeconds: number;
    activityType: string;
    teamId: string;
    splits: Array<{ km: number; elapsedTime: number }>;
  }
): NDKEvent {
  const event = new NDKEvent(ndk);
  event.kind = 1301;
  event.content = `Completed a ${workout.distanceKm}km ${workout.activityType} with RUNSTR!`;

  // Required tags
  event.tags = [
    ['exercise', workout.activityType],
    ['distance', workout.distanceKm.toString(), 'km'],
    ['duration', formatDuration(workout.durationSeconds)],
    ['team', workout.teamId], // ✅ CRITICAL: Team tag for leaderboard filtering
  ];

  // Add split tags
  for (const split of workout.splits) {
    event.tags.push([
      'split',
      split.km.toString(),
      formatDuration(split.elapsedTime),
    ]);
  }

  return event;
}

// Main test execution
async function runTests() {
  console.log('\n🧪 Starting End-to-End Team Tags & Leaderboard Test\n');
  console.log('=' .repeat(60));
  console.log(`Test Team ID: ${TEST_TEAM_ID}`);
  console.log(`Relays: ${RELAYS.join(', ')}`);
  console.log('=' .repeat(60) + '\n');

  let testNpub: string | null = null;
  let publishedEventIds: string[] = [];

  try {
    // ========================================
    // PHASE 1: SETUP
    // ========================================
    console.log('📋 PHASE 1: Setup\n');

    // 1.1 Initialize NDK
    console.log('1.1 Initializing NDK with test relays...');
    const ndk = new NDK({
      explicitRelayUrls: RELAYS,
    });

    await ndk.connect();

    // Wait for at least one relay to connect
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const connectedRelays = Array.from(ndk.pool.relays.values()).filter(
      (r) => r.status === 1 // Connected
    );

    test(
      'NDK connected to relays',
      connectedRelays.length > 0,
      `Connected to ${connectedRelays.length}/${RELAYS.length} relays`
    );

    // 1.2 Generate test keypair
    console.log('1.2 Generating test keypair...');
    const signer = NDKPrivateKeySigner.generate();
    ndk.signer = signer;

    const user = await signer.user();
    testNpub = user.npub;

    test(
      'Test keypair generated',
      testNpub.startsWith('npub1'),
      `Generated npub: ${testNpub.slice(0, 20)}...`
    );

    console.log('\n✅ Phase 1 Complete\n');

    // ========================================
    // PHASE 2: PUBLISHING
    // ========================================
    console.log('📤 PHASE 2: Publishing Synthetic Workouts with Team Tags\n');

    const workouts = [
      {
        name: '5K run',
        distanceKm: 5,
        durationSeconds: 1500, // 25:00
        activityType: 'running',
        teamId: TEST_TEAM_ID,
        splits: [
          { km: 1, elapsedTime: 300 },
          { km: 2, elapsedTime: 600 },
          { km: 3, elapsedTime: 900 },
          { km: 4, elapsedTime: 1200 },
          { km: 5, elapsedTime: 1500 },
        ],
      },
      {
        name: '10K run',
        distanceKm: 10,
        durationSeconds: 3000, // 50:00
        activityType: 'running',
        teamId: TEST_TEAM_ID,
        splits: Array.from({ length: 10 }, (_, i) => ({
          km: i + 1,
          elapsedTime: (i + 1) * 300,
        })),
      },
      {
        name: 'Half marathon',
        distanceKm: 21.1,
        durationSeconds: 6330, // 1:45:30
        activityType: 'running',
        teamId: TEST_TEAM_ID,
        splits: Array.from({ length: 21 }, (_, i) => ({
          km: i + 1,
          elapsedTime: (i + 1) * 300,
        })),
      },
    ];

    for (const workout of workouts) {
      console.log(`2.${workouts.indexOf(workout) + 1} Publishing ${workout.name}...`);

      const event = createWorkoutEvent(ndk, signer, workout);

      try {
        await event.sign(signer);
        const publishedRelays = await event.publish();
        const relayCount = publishedRelays.size;

        if (relayCount > 0) {
          publishedEventIds.push(event.id);
          test(
            `${workout.name} published with team tag`,
            true,
            `Event ID: ${event.id.slice(0, 16)}... (${relayCount} relays)`
          );

          // Verify team tag is in event
          const hasTeamTag = event.tags.some(
            (tag) => tag[0] === 'team' && tag[1] === TEST_TEAM_ID
          );
          test(
            `${workout.name} has team tag`,
            hasTeamTag,
            `Team tag "${TEST_TEAM_ID}" found in event tags`
          );

          // Verify splits count
          const splitTags = event.tags.filter((tag) => tag[0] === 'split');
          test(
            `${workout.name} has ${workout.splits.length} splits`,
            splitTags.length === workout.splits.length,
            `Found ${splitTags.length} split tags`
          );
        } else {
          test(
            `${workout.name} published with team tag`,
            false,
            'No relays accepted the event'
          );
        }
      } catch (error) {
        test(
          `${workout.name} published with team tag`,
          false,
          error instanceof Error ? error.message : String(error)
        );
      }

      // Small delay between publishes
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log('\n✅ Phase 2 Complete\n');

    // ========================================
    // PHASE 3: QUERY VERIFICATION
    // ========================================
    console.log('🔍 PHASE 3: Query & Verify Team Tags\n');

    // Wait for events to propagate
    console.log('⏳ Waiting 3 seconds for events to propagate to relays...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 3.1 Query workouts WITH team filter
    console.log('3.1 Querying workouts WITH team filter...');
    const teamFilter = {
      kinds: [1301],
      authors: [user.pubkey],
      '#team': [TEST_TEAM_ID],
      since: Math.floor((Date.now() - 60000) / 1000), // Last minute
    };

    const teamEvents = await ndk.fetchEvents(teamFilter);
    const teamEventsArray = Array.from(teamEvents);

    test(
      'Team-filtered query returns workouts',
      teamEventsArray.length === 3,
      `Found ${teamEventsArray.length}/3 workouts with team tag "${TEST_TEAM_ID}"`
    );

    // 3.2 Query workouts WITHOUT team filter (should return same events)
    console.log('3.2 Querying workouts WITHOUT team filter...');
    const noTeamFilter = {
      kinds: [1301],
      authors: [user.pubkey],
      since: Math.floor((Date.now() - 60000) / 1000),
    };

    const allEvents = await ndk.fetchEvents(noTeamFilter);
    const allEventsArray = Array.from(allEvents);

    test(
      'Unfiltered query returns same workouts',
      allEventsArray.length === 3,
      `Found ${allEventsArray.length} total workouts`
    );

    // 3.3 Verify ALL events have team tag
    console.log('3.3 Verifying all events have correct team tag...');
    const allHaveTeamTag = allEventsArray.every((event) =>
      event.tags.some((tag) => tag[0] === 'team' && tag[1] === TEST_TEAM_ID)
    );

    test(
      'All events have correct team tag',
      allHaveTeamTag,
      `${allEventsArray.length} events verified with team tag "${TEST_TEAM_ID}"`
    );

    // 3.4 Query with WRONG team filter (should return 0 events)
    console.log('3.4 Querying with WRONG team filter...');
    const wrongTeamFilter = {
      kinds: [1301],
      authors: [user.pubkey],
      '#team': ['wrong-team-id'],
      since: Math.floor((Date.now() - 60000) / 1000),
    };

    const wrongTeamEvents = await ndk.fetchEvents(wrongTeamFilter);
    const wrongTeamEventsArray = Array.from(wrongTeamEvents);

    test(
      'Wrong team filter returns zero results',
      wrongTeamEventsArray.length === 0,
      `Query with wrong team ID returned ${wrongTeamEventsArray.length} events (expected 0)`
    );

    // 3.5 Verify split requirements for leaderboard eligibility
    console.log('3.5 Verifying split counts for leaderboard eligibility...');

    const splitRequirements = [
      { distance: 5, requiredSplits: 5 },
      { distance: 10, requiredSplits: 10 },
      { distance: 21, requiredSplits: 21 },
    ];

    for (const { distance, requiredSplits } of splitRequirements) {
      const event = teamEventsArray.find((e) => {
        const distanceTag = e.tags.find((t) => t[0] === 'distance');
        return distanceTag && parseFloat(distanceTag[1]) >= distance && parseFloat(distanceTag[1]) < distance + 1;
      });

      if (event) {
        const splitCount = event.tags.filter((tag) => tag[0] === 'split').length;
        test(
          `${distance}K workout has ≥${requiredSplits} splits`,
          splitCount >= requiredSplits,
          `Found ${splitCount} splits (required: ${requiredSplits})`
        );
      } else {
        test(
          `${distance}K workout has ≥${requiredSplits} splits`,
          false,
          `Event not found in query results`
        );
      }
    }

    console.log('\n✅ Phase 3 Complete\n');

  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    test(
      'Test execution',
      false,
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    // ========================================
    // FINAL REPORT
    // ========================================
    console.log('=' .repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Total Tests: ${passCount + failCount}`);
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`Success Rate: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
    console.log('=' .repeat(60));

    if (publishedEventIds.length > 0) {
      console.log('\n📝 Published Event IDs (permanent on Nostr relays):');
      publishedEventIds.forEach((id, i) => {
        console.log(`   ${i + 1}. ${id}`);
      });
    }

    console.log('\n🔗 Test Keypair (ephemeral, for this test only):');
    console.log(`   npub: ${testNpub}`);
    console.log('\n⚠️  Note: Published events are permanent and cannot be deleted from relays.\n');

    // Exit with appropriate code
    process.exit(failCount > 0 ? 1 : 0);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
