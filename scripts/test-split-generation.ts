#!/usr/bin/env tsx
/**
 * Test Script: Split Generation Verification
 *
 * Purpose: Validate that SplitTrackingService generates correct number of splits
 *
 * Tests:
 * - 5.0km run → 5 splits
 * - 5.5km run → 5 splits
 * - 7.0km run → 7 splits (user's bug case)
 * - 10.2km run → 10 splits
 * - 12.8km run → 12 splits
 *
 * Expected: Split count should equal floor(distance in km)
 */

import * as SplitModule from '../src/services/activity/SplitTrackingService.js';

const { SplitTrackingService } = SplitModule as any;
type Split = any;

interface TestCase {
  distance: number;
  expectedSplits: number;
  description: string;
}

const testCases: TestCase[] = [
  { distance: 5.0, expectedSplits: 5, description: '5K run (exact kilometer)' },
  { distance: 5.5, expectedSplits: 5, description: '5.5K run (fractional kilometer)' },
  { distance: 7.0, expectedSplits: 7, description: '7K run (USER BUG CASE)' },
  { distance: 10.2, expectedSplits: 10, description: '10.2K run (10K + 200m)' },
  { distance: 12.8, expectedSplits: 12, description: '12.8K run (12K + 800m)' },
];

function simulateWorkout(distanceKm: number): any[] {
  console.log(`\n🏃 Simulating ${distanceKm}km workout...`);

  // Create new service instance for each test
  const service = new SplitTrackingService();
  const startTime = Date.now();
  service.start(startTime);

  // Simulate GPS updates every 100 meters
  const updateIntervalMeters = 100;
  const totalMeters = distanceKm * 1000;
  const numUpdates = Math.ceil(totalMeters / updateIntervalMeters);

  let currentDistanceMeters = 0;
  let elapsedTimeSeconds = 0;

  console.log(`   📍 Simulating ${numUpdates} GPS updates (every ${updateIntervalMeters}m)`);

  for (let i = 0; i < numUpdates; i++) {
    currentDistanceMeters += updateIntervalMeters;
    elapsedTimeSeconds += 30; // Assume 30 seconds per 100m (5:00/km pace)

    // Call update for each GPS update (with 0ms paused duration)
    service.update(currentDistanceMeters, elapsedTimeSeconds, 0);

    // Log when we cross kilometer marks
    const currentKm = Math.floor(currentDistanceMeters / 1000);
    const previousKm = Math.floor((currentDistanceMeters - updateIntervalMeters) / 1000);

    if (currentKm > previousKm && currentKm > 0) {
      console.log(`   ✓ Crossed ${currentKm}km mark at ${elapsedTimeSeconds}s`);
    }
  }

  const splits = service.getSplits();
  console.log(`   📊 Generated ${splits.length} splits`);

  return splits;
}

async function main() {
  console.log('🧪 Split Generation Verification Test\n');
  console.log('================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  for (const testCase of testCases) {
    console.log(`\n📋 Test Case: ${testCase.description}`);
    console.log('------------------------------------------------');

    const splits = simulateWorkout(testCase.distance);
    const actualSplits = splits.length;

    console.log(`\n   Expected splits: ${testCase.expectedSplits}`);
    console.log(`   Actual splits:   ${actualSplits}`);

    if (actualSplits === testCase.expectedSplits) {
      console.log(`   ✅ PASS - Correct split count\n`);
      passedTests++;
    } else {
      console.log(`   ❌ FAIL - Split count mismatch!\n`);
      failedTests++;

      // Show detailed split breakdown
      console.log(`   📋 Generated Splits:`);
      splits.forEach((split) => {
        console.log(`      Split ${split.number}: ${split.elapsedTime}s (pace: ${split.pace})`);
      });
    }
  }

  console.log('\n================================================');
  console.log(`\n📊 Test Results: ${passedTests} passed, ${failedTests} failed`);

  if (failedTests === 0) {
    console.log('\n✅ All tests passed! Split generation working correctly.');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Split generation has bugs.');
    console.log('\n💡 Likely Issues:');
    console.log('   - Off-by-one error in split detection logic');
    console.log('   - GPS update timing may not cross final kilometer mark');
    console.log('   - SplitTrackingService.updateSplit() may have boundary condition bug');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Test error:', error);
  process.exit(1);
});
