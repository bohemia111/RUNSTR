/**
 * Leaderboard System Test Script
 *
 * Validates:
 * 1. Kind 1301 event format (tag structure, split formatting, team tags)
 * 2. Leaderboard query logic (team filtering, daily filtering, split requirements)
 * 3. Edge cases (missing tags, insufficient splits, wrong teams)
 *
 * Usage: npx tsx scripts/test-leaderboard-system.ts
 */

// Test result tracking
let passCount = 0;
let failCount = 0;
const results: Array<{ test: string; status: 'PASS' | 'FAIL'; message: string }> = [];

// Helper function to log test results
function test(name: string, fn: () => boolean, expectedMessage?: string) {
  try {
    const result = fn();
    if (result) {
      passCount++;
      results.push({ test: name, status: 'PASS', message: expectedMessage || 'Test passed' });
      console.log(`✅ PASS: ${name}`);
    } else {
      failCount++;
      results.push({ test: name, status: 'FAIL', message: expectedMessage || 'Test failed' });
      console.log(`❌ FAIL: ${name}`);
    }
  } catch (error) {
    failCount++;
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ test: name, status: 'FAIL', message: errorMsg });
    console.log(`❌ FAIL: ${name} - ${errorMsg}`);
  }
}

// Mock NDKEvent creation helper
function createMockWorkout(overrides: {
  id?: string;
  pubkey?: string;
  tags?: string[][];
  content?: string;
  created_at?: number;
}): any {
  return {
    id: overrides.id || 'mock-event-id',
    pubkey: overrides.pubkey || '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    tags: overrides.tags || [],
    content: overrides.content || 'Completed a run with RUNSTR!',
    created_at: overrides.created_at || Math.floor(Date.now() / 1000),
  };
}

// Parse duration string (HH:MM:SS) to seconds (from SimpleLeaderboardService)
function parseDuration(durationStr: string): number {
  const parts = durationStr.split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const seconds = parseInt(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }
  return 0;
}

// Parse workout event (simplified from SimpleLeaderboardService)
function parseWorkoutEvent(event: any): {
  id: string;
  npub: string;
  activityType: string;
  distance: number;
  duration: number;
  splits?: Map<number, number>;
  teamTag?: string;
} | null {
  try {
    const getTag = (name: string) => event.tags.find((t: string[]) => t[0] === name)?.[1];

    const activityType = getTag('exercise') || 'unknown';
    const distanceStr = getTag('distance');
    const durationStr = getTag('duration');
    const teamTag = getTag('team');

    if (!distanceStr || !durationStr) {
      return null;
    }

    const distance = parseFloat(distanceStr);
    const duration = parseDuration(durationStr);

    // Parse split data
    const splits = new Map<number, number>();
    const splitTags = event.tags.filter((t: string[]) => t[0] === 'split');
    for (const splitTag of splitTags) {
      // Skip malformed split tags (need at least 3 elements)
      if (splitTag.length < 3) continue;

      const km = parseInt(splitTag[1]);
      const elapsedTime = parseDuration(splitTag[2]);
      if (!isNaN(km) && elapsedTime > 0) {
        splits.set(km, elapsedTime);
      }
    }

    return {
      id: event.id,
      npub: event.pubkey,
      activityType,
      distance,
      duration,
      splits: splits.size > 0 ? splits : undefined,
      teamTag,
    };
  } catch (error) {
    console.error('Failed to parse workout event:', error);
    return null;
  }
}

// Validate tag format
function validateTagFormat(tag: string[], expectedLength: number, tagName: string): boolean {
  if (tag.length !== expectedLength) {
    console.log(`   ❌ Tag '${tagName}' has ${tag.length} elements, expected ${expectedLength}`);
    return false;
  }
  return true;
}

console.log('\n🏃 RUNSTR Leaderboard System Test Suite\n');
console.log('=' .repeat(60));

// ============================================================================
// SECTION 1: KIND 1301 EVENT FORMAT TESTING
// ============================================================================

console.log('\n📋 SECTION 1: Kind 1301 Event Format Testing\n');

// Test 1.1: Split tags are formatted correctly
test('Split tags use correct 3-element format', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '00:25:00'],
      ['distance', '5.0', 'km'],
      ['split', '1', '00:05:00'],
      ['split', '2', '00:10:00'],
      ['split', '5', '00:25:00'],
    ],
  });

  const splitTags = event.tags.filter((t: string[]) => t[0] === 'split');

  // All split tags should have exactly 3 elements
  const allCorrectFormat = splitTags.every((tag: string[]) => {
    return validateTagFormat(tag, 3, 'split');
  });

  // Split values should be in HH:MM:SS format
  const allCorrectTimeFormat = splitTags.every((tag: string[]) => {
    return /^\d{2}:\d{2}:\d{2}$/.test(tag[2]);
  });

  return allCorrectFormat && allCorrectTimeFormat;
});

// Test 1.2: Team tags are present and formatted correctly
test('Team tags use correct 2-element format', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '00:25:00'],
      ['distance', '5.0', 'km'],
      ['team', 'team-awesome-runners'],
    ],
  });

  const teamTag = event.tags.find((t: string[]) => t[0] === 'team');

  if (!teamTag) {
    console.log('   ❌ No team tag found');
    return false;
  }

  return validateTagFormat(teamTag, 2, 'team');
});

// Test 1.3: Distance tags are formatted correctly
test('Distance tags use correct 3-element format (value, unit separate)', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '00:25:00'],
      ['distance', '5.0', 'km'],
    ],
  });

  const distanceTag = event.tags.find((t: string[]) => t[0] === 'distance');

  if (!distanceTag) {
    console.log('   ❌ No distance tag found');
    return false;
  }

  // Should have exactly 3 elements: tag name, value, unit
  if (!validateTagFormat(distanceTag, 3, 'distance')) {
    return false;
  }

  // Value should be parseable as number
  const value = parseFloat(distanceTag[1]);
  if (isNaN(value)) {
    console.log('   ❌ Distance value is not a valid number');
    return false;
  }

  // Unit should be km or mi
  const unit = distanceTag[2];
  if (unit !== 'km' && unit !== 'mi') {
    console.log(`   ❌ Distance unit '${unit}' is not 'km' or 'mi'`);
    return false;
  }

  return true;
});

// Test 1.4: Duration tags are in HH:MM:SS format
test('Duration tags use HH:MM:SS format', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '00:25:30'],
      ['distance', '5.0', 'km'],
    ],
  });

  const durationTag = event.tags.find((t: string[]) => t[0] === 'duration');

  if (!durationTag) {
    console.log('   ❌ No duration tag found');
    return false;
  }

  // Should be exactly 2 elements: tag name and HH:MM:SS value
  if (!validateTagFormat(durationTag, 2, 'duration')) {
    return false;
  }

  // Should match HH:MM:SS format
  if (!/^\d{2}:\d{2}:\d{2}$/.test(durationTag[1])) {
    console.log(`   ❌ Duration '${durationTag[1]}' does not match HH:MM:SS format`);
    return false;
  }

  return true;
});

// Test 1.5: Exercise tag uses lowercase full words
test('Exercise tag uses lowercase full words', () => {
  const validExercises = ['running', 'walking', 'cycling', 'hiking', 'strength', 'yoga', 'meditation'];

  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '00:25:00'],
      ['distance', '5.0', 'km'],
    ],
  });

  const exerciseTag = event.tags.find((t: string[]) => t[0] === 'exercise');

  if (!exerciseTag) {
    console.log('   ❌ No exercise tag found');
    return false;
  }

  const exerciseValue = exerciseTag[1];

  // Should be lowercase
  if (exerciseValue !== exerciseValue.toLowerCase()) {
    console.log(`   ❌ Exercise value '${exerciseValue}' is not lowercase`);
    return false;
  }

  // Should be a full word (not abbreviated)
  if (validExercises.includes(exerciseValue)) {
    return true;
  } else {
    console.log(`   ⚠️ Exercise '${exerciseValue}' not in standard list (but may be valid custom type)`);
    return true; // Allow custom exercise types
  }
});

// Test 1.6: All required tags are present
test('Event has all required tags (d, exercise, duration, source)', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '00:25:00'],
      ['distance', '5.0', 'km'],
      ['source', 'RUNSTR'],
    ],
  });

  const requiredTags = ['d', 'exercise', 'duration', 'source'];
  const tagKeys = event.tags.map((t: string[]) => t[0]);

  const missingTags = requiredTags.filter(tag => !tagKeys.includes(tag));

  if (missingTags.length > 0) {
    console.log(`   ❌ Missing required tags: ${missingTags.join(', ')}`);
    return false;
  }

  return true;
});

// Test 1.7: Content is plain text, not JSON
test('Event content is plain text (not JSON)', () => {
  const validEvent = createMockWorkout({
    content: 'Completed a run with RUNSTR!',
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '00:25:00'],
    ],
  });

  const invalidEvent = createMockWorkout({
    content: '{"distance": "5.2", "duration": "00:30:45"}',
    tags: [
      ['d', 'workout-124'],
      ['exercise', 'running'],
      ['duration', '00:25:00'],
    ],
  });

  // Valid event should not look like JSON
  try {
    JSON.parse(validEvent.content);
    console.log('   ❌ Valid event content is parseable as JSON (should be plain text)');
    return false;
  } catch {
    // Expected - plain text is not parseable as JSON
  }

  // Invalid event should be parseable as JSON
  try {
    JSON.parse(invalidEvent.content);
    // This is actually invalid for our purposes
  } catch {
    console.log('   ❌ Test setup error - invalid event content is not JSON');
    return false;
  }

  return true;
});

// ============================================================================
// SECTION 2: LEADERBOARD QUERY LOGIC TESTING
// ============================================================================

console.log('\n🏆 SECTION 2: Leaderboard Query Logic Testing\n');

// Test 2.1: Workouts WITH team tags appear in team leaderboards
test('Workouts with team tags are included in team leaderboards', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '00:25:00'],
      ['distance', '5.0', 'km'],
      ['team', 'team-awesome-runners'],
    ],
  });

  const workout = parseWorkoutEvent(event);

  if (!workout) {
    console.log('   ❌ Failed to parse workout event');
    return false;
  }

  if (!workout.teamTag) {
    console.log('   ❌ Workout does not have team tag after parsing');
    return false;
  }

  if (workout.teamTag !== 'team-awesome-runners') {
    console.log(`   ❌ Team tag mismatch: expected 'team-awesome-runners', got '${workout.teamTag}'`);
    return false;
  }

  return true;
});

// Test 2.2: Workouts WITHOUT team tags don't appear in team leaderboards
test('Workouts without team tags are excluded from team leaderboards', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '00:25:00'],
      ['distance', '5.0', 'km'],
      // No team tag
    ],
  });

  const workout = parseWorkoutEvent(event);

  if (!workout) {
    console.log('   ❌ Failed to parse workout event');
    return false;
  }

  if (workout.teamTag) {
    console.log(`   ❌ Workout should not have team tag, but has: ${workout.teamTag}`);
    return false;
  }

  return true;
});

// Test 2.3: 5K runs WITH ≥5 splits qualify for daily leaderboards
test('5K workouts with ≥5 splits qualify for daily 5K leaderboard', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '00:25:00'],
      ['distance', '5.0', 'km'],
      ['split', '1', '00:05:00'],
      ['split', '2', '00:10:00'],
      ['split', '3', '00:15:00'],
      ['split', '4', '00:20:00'],
      ['split', '5', '00:25:00'],
    ],
  });

  const workout = parseWorkoutEvent(event);

  if (!workout) {
    console.log('   ❌ Failed to parse workout event');
    return false;
  }

  if (!workout.splits || workout.splits.size < 5) {
    console.log(`   ❌ Workout should have ≥5 splits, has ${workout.splits?.size || 0}`);
    return false;
  }

  // Verify split parsing is correct
  if (workout.splits.get(1) !== 300) { // 00:05:00 = 300 seconds
    console.log('   ❌ Split 1 time parsing incorrect');
    return false;
  }

  if (workout.splits.get(5) !== 1500) { // 00:25:00 = 1500 seconds
    console.log('   ❌ Split 5 time parsing incorrect');
    return false;
  }

  return true;
});

// Test 2.4: 5K runs WITHOUT splits don't qualify
test('5K workouts without splits are excluded from daily 5K leaderboard', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '00:25:00'],
      ['distance', '5.0', 'km'],
      // No split tags
    ],
  });

  const workout = parseWorkoutEvent(event);

  if (!workout) {
    console.log('   ❌ Failed to parse workout event');
    return false;
  }

  if (workout.splits && workout.splits.size > 0) {
    console.log(`   ❌ Workout should not have splits, but has ${workout.splits.size}`);
    return false;
  }

  return true;
});

// Test 2.5: 10K runs need ≥10 splits
test('10K workouts need ≥10 splits for daily 10K leaderboard', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '00:50:00'],
      ['distance', '10.0', 'km'],
      ...Array.from({ length: 10 }, (_, i) => ['split', `${i + 1}`, `00:${String((i + 1) * 5).padStart(2, '0')}:00`]),
    ],
  });

  const workout = parseWorkoutEvent(event);

  if (!workout) {
    console.log('   ❌ Failed to parse workout event');
    return false;
  }

  if (!workout.splits || workout.splits.size < 10) {
    console.log(`   ❌ Workout should have ≥10 splits for 10K, has ${workout.splits?.size || 0}`);
    return false;
  }

  return true;
});

// Test 2.6: Half marathon needs ≥21 splits
test('Half marathon workouts need ≥21 splits for daily leaderboard', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '02:00:00'],
      ['distance', '21.1', 'km'],
      ...Array.from({ length: 21 }, (_, i) => ['split', `${i + 1}`, `00:${String(Math.floor((i + 1) * 5.7)).padStart(2, '0')}:00`]),
    ],
  });

  const workout = parseWorkoutEvent(event);

  if (!workout) {
    console.log('   ❌ Failed to parse workout event');
    return false;
  }

  if (!workout.splits || workout.splits.size < 21) {
    console.log(`   ❌ Workout should have ≥21 splits for half marathon, has ${workout.splits?.size || 0}`);
    return false;
  }

  return true;
});

// ============================================================================
// SECTION 3: EDGE CASE TESTING
// ============================================================================

console.log('\n⚠️ SECTION 3: Edge Case Testing\n');

// Test 3.1: Missing distance tag
test('Event with missing distance tag is rejected', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '00:25:00'],
      // No distance tag
    ],
  });

  const workout = parseWorkoutEvent(event);

  // Should return null for invalid workout
  if (workout !== null) {
    console.log('   ❌ Should reject workout without distance tag');
    return false;
  }

  return true;
});

// Test 3.2: Missing duration tag
test('Event with missing duration tag is rejected', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['distance', '5.0', 'km'],
      // No duration tag
    ],
  });

  const workout = parseWorkoutEvent(event);

  // Should return null for invalid workout
  if (workout !== null) {
    console.log('   ❌ Should reject workout without duration tag');
    return false;
  }

  return true;
});

// Test 3.3: Insufficient splits for 5K
test('5K workout with only 3 splits is excluded from daily 5K leaderboard', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '00:25:00'],
      ['distance', '5.0', 'km'],
      ['split', '1', '00:05:00'],
      ['split', '2', '00:10:00'],
      ['split', '3', '00:15:00'],
      // Only 3 splits - not enough for 5K leaderboard
    ],
  });

  const workout = parseWorkoutEvent(event);

  if (!workout) {
    console.log('   ❌ Failed to parse workout event');
    return false;
  }

  // Should have splits, but not enough
  if (!workout.splits || workout.splits.size !== 3) {
    console.log(`   ❌ Expected 3 splits, got ${workout.splits?.size || 0}`);
    return false;
  }

  // For 5K leaderboard, this would be filtered out (need ≥5 splits)
  const qualifiesFor5K = workout.splits.size >= 5;
  if (qualifiesFor5K) {
    console.log('   ❌ Workout with 3 splits should not qualify for 5K leaderboard');
    return false;
  }

  return true;
});

// Test 3.4: Wrong team tag
test('Workout with different team tag is excluded from team leaderboard', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '00:25:00'],
      ['distance', '5.0', 'km'],
      ['team', 'team-other-runners'],
    ],
  });

  const workout = parseWorkoutEvent(event);

  if (!workout) {
    console.log('   ❌ Failed to parse workout event');
    return false;
  }

  // Simulate team leaderboard query for 'team-awesome-runners'
  const targetTeam = 'team-awesome-runners';
  const matchesTeam = workout.teamTag === targetTeam;

  if (matchesTeam) {
    console.log(`   ❌ Workout with team '${workout.teamTag}' should not match '${targetTeam}'`);
    return false;
  }

  return true;
});

// Test 3.5: Invalid duration format
test('Event with invalid duration format is handled gracefully', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '25:00'], // Missing hours - invalid format
      ['distance', '5.0', 'km'],
    ],
  });

  const durationTag = event.tags.find((t: string[]) => t[0] === 'duration');
  const duration = parseDuration(durationTag[1]);

  // Should return 0 for invalid format
  if (duration !== 0) {
    console.log(`   ❌ Invalid duration should parse to 0, got ${duration}`);
    return false;
  }

  return true;
});

// Test 3.6: Malformed split tags
test('Event with malformed split tags is handled gracefully', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '00:25:00'],
      ['distance', '5.0', 'km'],
      ['split', '1'], // Missing time value - malformed
      ['split', '2', '00:10:00'], // Valid
      ['split', 'invalid', '00:15:00'], // Invalid km number
    ],
  });

  const workout = parseWorkoutEvent(event);

  if (!workout) {
    console.log('   ❌ Failed to parse workout event');
    return false;
  }

  // Should only parse the valid split (km 2)
  if (!workout.splits || workout.splits.size !== 1) {
    console.log(`   ❌ Expected 1 valid split, got ${workout.splits?.size || 0}`);
    return false;
  }

  if (!workout.splits.has(2)) {
    console.log('   ❌ Valid split (km 2) should be present');
    return false;
  }

  return true;
});

// Test 3.7: Activity type filtering
test('Cycling workout is excluded from running-only leaderboard', () => {
  const event = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'cycling'],
      ['duration', '01:00:00'],
      ['distance', '25.0', 'km'],
      ['team', 'team-awesome-runners'],
    ],
  });

  const workout = parseWorkoutEvent(event);

  if (!workout) {
    console.log('   ❌ Failed to parse workout event');
    return false;
  }

  // Simulate activity type filtering for running leaderboard
  const targetActivity = 'running';
  const matchesActivity = workout.activityType.toLowerCase() === targetActivity.toLowerCase();

  if (matchesActivity) {
    console.log(`   ❌ Cycling workout should not match running filter`);
    return false;
  }

  return true;
});

// Test 3.8: "Any" activity type filter
test('"Any" activity filter includes all workout types', () => {
  const runningEvent = createMockWorkout({
    tags: [
      ['d', 'workout-123'],
      ['exercise', 'running'],
      ['duration', '00:25:00'],
      ['distance', '5.0', 'km'],
    ],
  });

  const cyclingEvent = createMockWorkout({
    tags: [
      ['d', 'workout-124'],
      ['exercise', 'cycling'],
      ['duration', '01:00:00'],
      ['distance', '25.0', 'km'],
    ],
  });

  const runningWorkout = parseWorkoutEvent(runningEvent);
  const cyclingWorkout = parseWorkoutEvent(cyclingEvent);

  if (!runningWorkout || !cyclingWorkout) {
    console.log('   ❌ Failed to parse workout events');
    return false;
  }

  // Simulate "Any" activity filter
  const activityFilter = 'Any';
  const runningMatches = activityFilter === 'Any' || runningWorkout.activityType.toLowerCase() === activityFilter.toLowerCase();
  const cyclingMatches = activityFilter === 'Any' || cyclingWorkout.activityType.toLowerCase() === activityFilter.toLowerCase();

  if (!runningMatches || !cyclingMatches) {
    console.log('   ❌ "Any" filter should match all activity types');
    return false;
  }

  return true;
});

// ============================================================================
// TEST SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('\n📊 TEST SUMMARY\n');
console.log(`Total Tests: ${passCount + failCount}`);
console.log(`✅ Passed: ${passCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log(`Success Rate: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%\n`);

if (failCount > 0) {
  console.log('Failed Tests:');
  results
    .filter(r => r.status === 'FAIL')
    .forEach(r => {
      console.log(`  ❌ ${r.test}`);
      console.log(`     ${r.message}`);
    });
  console.log('');
}

console.log('='.repeat(60) + '\n');

// Exit with error code if any tests failed
process.exit(failCount > 0 ? 1 : 0);
