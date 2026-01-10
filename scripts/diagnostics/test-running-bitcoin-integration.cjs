/**
 * Test Running Bitcoin Supabase Integration
 *
 * Tests the full flow without needing the app:
 * 1. Verify competition exists
 * 2. Check participant registration
 * 3. Submit test workout to Edge Function
 * 4. Query user total from Supabase
 * 5. Test duplicate detection
 * 6. Test anti-cheat validation (pace limits)
 *
 * Usage: node scripts/diagnostics/test-running-bitcoin-integration.cjs
 */

require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Test user - using TheWildHustle (Season II participant)
const TEST_NPUB = 'npub1xrwkkyuuwgaqktrvz27jj4q0eesd8y8ldel0k68nv3stpn53w06skmq3kk';

// Generate unique event ID for test
const generateEventId = () => {
  const chars = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 64; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
};

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${status}: ${name}${details ? ` - ${details}` : ''}`);
  results.tests.push({ name, passed, details });
  if (passed) results.passed++;
  else results.failed++;
}

// ============================================================================
// TEST 1: Verify Competition Exists
// ============================================================================
async function testCompetitionExists() {
  console.log('\n📊 TEST 1: Competition Exists');

  const url = `${SUPABASE_URL}/rest/v1/competitions?external_id=eq.running-bitcoin&select=*`;

  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });

  const data = await response.json();

  if (data && data.length > 0) {
    const comp = data[0];
    logTest('Competition found', true, `ID: ${comp.id}`);
    logTest('Activity type is running', comp.activity_type === 'running');
    // Check dates (allow for timezone suffix)
    const startOk = comp.start_date && comp.start_date.startsWith('2026-01-10');
    const endOk = comp.end_date && comp.end_date.startsWith('2026-01-31');
    logTest('Date range correct', startOk && endOk, `${comp.start_date} to ${comp.end_date}`);
    return comp.id;
  } else {
    logTest('Competition found', false, 'Not found in database');
    return null;
  }
}

// ============================================================================
// TEST 2: Check Participant Registration
// ============================================================================
async function testParticipantRegistration(competitionId) {
  console.log('\n👥 TEST 2: Participant Registration');

  if (!competitionId) {
    logTest('Skip - no competition ID', false);
    return;
  }

  // Check total participants
  const countUrl = `${SUPABASE_URL}/rest/v1/competition_participants?competition_id=eq.${competitionId}&select=npub`;

  const countResponse = await fetch(countUrl, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });

  const participants = await countResponse.json();
  logTest('Has participants', participants.length > 0, `${participants.length} registered`);
  logTest('Has 43+ Season II participants', participants.length >= 43, `${participants.length} total`);

  // Check if test user is registered
  const testUserRegistered = participants.some(p => p.npub === TEST_NPUB);
  logTest('Test user (TheWildHustle) registered', testUserRegistered);
}

// ============================================================================
// TEST 3: Submit Valid Workout to Edge Function
// ============================================================================
async function testValidWorkoutSubmission() {
  console.log('\n🏃 TEST 3: Valid Workout Submission');

  const testEventId = generateEventId();
  const now = new Date();

  // Valid 5km run in 30 minutes (6:00/km pace - very reasonable)
  const workout = {
    event_id: testEventId,
    npub: TEST_NPUB,
    activity_type: 'running',
    distance_meters: 5000,
    duration_seconds: 1800, // 30 minutes
    calories: 350,
    created_at: now.toISOString(),
    raw_event: {
      test: true,
      source: 'integration_test',
    },
    source: 'nostr_scan', // Mark as test/migration source
  };

  const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-workout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify(workout),
  });

  const result = await response.json();

  logTest('Edge Function responds', response.ok, `Status: ${response.status}`);
  logTest('Workout accepted', result.success === true, result.message || '');
  logTest('Not flagged', result.flagged !== true);

  return { eventId: testEventId, success: result.success };
}

// ============================================================================
// TEST 4: Test Duplicate Detection
// ============================================================================
async function testDuplicateDetection(originalEventId) {
  console.log('\n🔄 TEST 4: Duplicate Detection');

  if (!originalEventId) {
    logTest('Skip - no original event ID', false);
    return;
  }

  const now = new Date();

  // Try to submit same event ID again
  const duplicateWorkout = {
    event_id: originalEventId, // Same ID as before
    npub: TEST_NPUB,
    activity_type: 'running',
    distance_meters: 5000,
    duration_seconds: 1800,
    created_at: now.toISOString(),
    raw_event: { test: true },
  };

  const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-workout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify(duplicateWorkout),
  });

  const result = await response.json();

  logTest('Duplicate detected', result.duplicate === true, result.message || '');
  logTest('Returns success (idempotent)', result.success === true);
}

// ============================================================================
// TEST 5: Test Time-Overlap Detection
// ============================================================================
async function testTimeOverlapDetection() {
  console.log('\n⏱️ TEST 5: Time-Overlap Detection');

  const now = new Date();
  const eventId1 = generateEventId();
  const eventId2 = generateEventId();

  // Submit first workout: 30 min starting now
  const workout1 = {
    event_id: eventId1,
    npub: TEST_NPUB,
    activity_type: 'walking',
    distance_meters: 3000,
    duration_seconds: 1800, // 30 minutes
    created_at: now.toISOString(),
    raw_event: { test: true, overlap_test: 1 },
    source: 'nostr_scan',
  };

  await fetch(`${SUPABASE_URL}/functions/v1/submit-workout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify(workout1),
  });

  // Submit second workout: overlapping time (starts 10 min after first)
  const overlapStart = new Date(now.getTime() + 10 * 60 * 1000); // 10 min later
  const workout2 = {
    event_id: eventId2,
    npub: TEST_NPUB,
    activity_type: 'running',
    distance_meters: 4000,
    duration_seconds: 1200, // 20 minutes (would end 30 min after start = overlaps)
    created_at: overlapStart.toISOString(),
    raw_event: { test: true, overlap_test: 2 },
    source: 'nostr_scan',
  };

  const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-workout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify(workout2),
  });

  const result = await response.json();

  logTest('Time-overlap detected', result.duplicate === true, result.message || '');
}

// ============================================================================
// TEST 6: Test Anti-Cheat (Impossible Pace)
// ============================================================================
async function testAntiCheatPaceValidation() {
  console.log('\n🚫 TEST 6: Anti-Cheat Pace Validation');

  // Use a date far in the past to avoid overlap with other tests
  const pastDate = new Date('2026-01-15T06:00:00Z');

  // Superhuman pace: 10km in 10 minutes = 1:00/km (world record is ~2:30/km)
  const superhumanWorkout = {
    event_id: generateEventId(),
    npub: TEST_NPUB,
    activity_type: 'running',
    distance_meters: 10000, // 10km
    duration_seconds: 600,  // 10 minutes = 1:00/km pace
    created_at: pastDate.toISOString(),
    raw_event: { test: true, anticheat_test: 'superhuman_pace' },
  };

  const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-workout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify(superhumanWorkout),
  });

  const result = await response.json();

  logTest('Superhuman pace flagged', result.flagged === true, result.reason || '');
  logTest('Not accepted as valid', result.success === false);
}

// ============================================================================
// TEST 7: Query User Total from Supabase
// ============================================================================
async function testUserTotalQuery() {
  console.log('\n📈 TEST 7: User Total Query');

  // Query workout_submissions for test user (running + walking)
  const startDate = '2026-01-10T00:00:00Z';
  const endDate = '2026-01-31T23:59:59Z';

  const url = `${SUPABASE_URL}/rest/v1/workout_submissions?npub=eq.${TEST_NPUB}&created_at=gte.${startDate}&created_at=lte.${endDate}&activity_type=in.(running,walking)&select=distance_meters,activity_type,created_at`;

  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });

  const workouts = await response.json();

  logTest('Query succeeds', response.ok);
  logTest('Returns array', Array.isArray(workouts), `${workouts.length} workouts found`);

  // Calculate total
  const totalKm = workouts.reduce((sum, w) => sum + ((w.distance_meters || 0) / 1000), 0);
  console.log(`  📊 Total distance for ${TEST_NPUB.slice(0, 20)}...: ${totalKm.toFixed(2)} km`);

  // Count by activity type
  const runCount = workouts.filter(w => w.activity_type === 'running').length;
  const walkCount = workouts.filter(w => w.activity_type === 'walking').length;
  console.log(`  📊 Running workouts: ${runCount}, Walking workouts: ${walkCount}`);

  return totalKm;
}

// ============================================================================
// TEST 8: Cleanup Test Data
// ============================================================================
async function cleanupTestData() {
  console.log('\n🧹 TEST 8: Cleanup Test Data');

  // Delete test workouts (those with raw_event.test = true)
  // Note: This requires service role key

  const deleteUrl = `${SUPABASE_URL}/rest/v1/workout_submissions?raw_event->>test=eq.true`;

  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });

  logTest('Cleanup completed', response.ok, `Status: ${response.status}`);

  // Also clean up flagged test workouts
  const deleteFlaggedUrl = `${SUPABASE_URL}/rest/v1/flagged_workouts?raw_event->>test=eq.true`;

  await fetch(deleteFlaggedUrl, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log('='.repeat(60));
  console.log('  RUNNING BITCOIN SUPABASE INTEGRATION TEST');
  console.log('='.repeat(60));
  console.log(`\nTest User: ${TEST_NPUB.slice(0, 30)}...`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);

  try {
    // Run all tests
    const competitionId = await testCompetitionExists();
    await testParticipantRegistration(competitionId);
    const { eventId } = await testValidWorkoutSubmission();
    await testDuplicateDetection(eventId);
    await testTimeOverlapDetection();
    await testAntiCheatPaceValidation();
    await testUserTotalQuery();
    await cleanupTestData();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('  TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`  ✅ Passed: ${results.passed}`);
    console.log(`  ❌ Failed: ${results.failed}`);
    console.log(`  📊 Total:  ${results.passed + results.failed}`);
    console.log('='.repeat(60));

    if (results.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      results.tests.filter(t => !t.passed).forEach(t => {
        console.log(`  - ${t.name}: ${t.details}`);
      });
    }

    process.exit(results.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n💥 Test error:', error);
    process.exit(1);
  }
}

main();
