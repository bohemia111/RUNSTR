/**
 * Test script to validate distance eligibility for rewards
 * Tests that rewards only trigger for workouts >= 1km
 *
 * Usage: node scripts/test-distance-eligibility.cjs
 */

// Reward configuration values
const MIN_WORKOUT_DISTANCE_METERS = 1000;

function checkDistanceEligibility(distanceMeters) {
  return distanceMeters >= MIN_WORKOUT_DISTANCE_METERS;
}

function runTests() {
  console.log('\n🏃 Distance Eligibility Tests\n');
  console.log('==================================================');
  console.log(`Minimum distance for reward: ${MIN_WORKOUT_DISTANCE_METERS}m (1km)`);
  console.log('==================================================\n');

  const testCases = [
    { distance: 0, expected: false, description: '0m workout' },
    { distance: 500, expected: false, description: '500m workout' },
    { distance: 999, expected: false, description: '999m workout (just under)' },
    { distance: 1000, expected: true, description: '1000m workout (exactly 1km)' },
    { distance: 1001, expected: true, description: '1001m workout (just over)' },
    { distance: 2500, expected: true, description: '2.5km workout' },
    { distance: 5000, expected: true, description: '5km workout' },
    { distance: 10000, expected: true, description: '10km workout' },
    { distance: 42195, expected: true, description: 'Marathon distance' },
  ];

  let passed = 0;
  let failed = 0;

  testCases.forEach((test) => {
    const result = checkDistanceEligibility(test.distance);
    const status = result === test.expected ? '✅' : '❌';

    if (result === test.expected) {
      passed++;
    } else {
      failed++;
    }

    const eligibility = result ? 'QUALIFIES' : 'does NOT qualify';
    console.log(`${status} ${test.description} → ${eligibility}`);
  });

  console.log('\n==================================================');
  console.log('📊 Test Results');
  console.log('==================================================');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n✨ All distance eligibility tests passed!\n');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed!\n');
    process.exit(1);
  }
}

runTests();
