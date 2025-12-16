/**
 * Test script to validate daily reward limit logic
 * Tests that users can only claim once per day
 *
 * Usage: node scripts/test-daily-limit.cjs
 */

// Simulated storage (mimics AsyncStorage behavior)
const storage = new Map();

// Storage key pattern from rewards config
const LAST_REWARD_DATE_KEY = '@runstr:last_reward_date';

function getStorageKey(userPubkey) {
  return `${LAST_REWARD_DATE_KEY}:${userPubkey}`;
}

async function canClaimToday(userPubkey) {
  const lastRewardKey = getStorageKey(userPubkey);
  const lastRewardStr = storage.get(lastRewardKey);

  if (!lastRewardStr) {
    // Never claimed before
    return true;
  }

  const lastRewardDate = new Date(lastRewardStr).toDateString();
  const today = new Date().toDateString();

  // Can claim if last reward was on a different day
  return lastRewardDate !== today;
}

async function recordReward(userPubkey) {
  const now = new Date().toISOString();
  const lastRewardKey = getStorageKey(userPubkey);
  storage.set(lastRewardKey, now);
}

function clearStorage() {
  storage.clear();
}

function setLastRewardDate(userPubkey, date) {
  const lastRewardKey = getStorageKey(userPubkey);
  storage.set(lastRewardKey, date.toISOString());
}

async function runTests() {
  console.log('\n📅 Daily Limit Tests\n');
  console.log('==================================================');
  console.log('Testing once-per-day reward restriction');
  console.log('==================================================\n');

  const testUser = 'test-user-pubkey-12345';
  let passed = 0;
  let failed = 0;

  // Test 1: First claim should succeed
  console.log('Test 1: First claim of the day');
  clearStorage();
  let canClaim = await canClaimToday(testUser);
  if (canClaim === true) {
    console.log('  ✅ First claim allowed (no previous claim)');
    passed++;
  } else {
    console.log('  ❌ First claim should be allowed');
    failed++;
  }

  // Test 2: Record reward and try again same day
  console.log('\nTest 2: Second claim same day');
  await recordReward(testUser);
  canClaim = await canClaimToday(testUser);
  if (canClaim === false) {
    console.log('  ✅ Second claim blocked (already claimed today)');
    passed++;
  } else {
    console.log('  ❌ Second claim should be blocked');
    failed++;
  }

  // Test 3: Yesterday's claim should allow today
  console.log('\nTest 3: Claim after yesterday\'s reward');
  clearStorage();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  setLastRewardDate(testUser, yesterday);
  canClaim = await canClaimToday(testUser);
  if (canClaim === true) {
    console.log('  ✅ Claim allowed (last claim was yesterday)');
    passed++;
  } else {
    console.log('  ❌ Claim should be allowed after day reset');
    failed++;
  }

  // Test 4: Claim from 2 days ago should allow
  console.log('\nTest 4: Claim after 2 days');
  clearStorage();
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  setLastRewardDate(testUser, twoDaysAgo);
  canClaim = await canClaimToday(testUser);
  if (canClaim === true) {
    console.log('  ✅ Claim allowed (last claim was 2 days ago)');
    passed++;
  } else {
    console.log('  ❌ Claim should be allowed');
    failed++;
  }

  // Test 5: Different users are independent
  console.log('\nTest 5: Different users have independent limits');
  clearStorage();
  const user1 = 'user-one-pubkey';
  const user2 = 'user-two-pubkey';
  await recordReward(user1);
  const user1CanClaim = await canClaimToday(user1);
  const user2CanClaim = await canClaimToday(user2);
  if (user1CanClaim === false && user2CanClaim === true) {
    console.log('  ✅ User limits are independent');
    passed++;
  } else {
    console.log('  ❌ User limits should be independent');
    failed++;
  }

  // Test 6: Edge case - midnight boundary
  console.log('\nTest 6: Midnight boundary (date comparison)');
  clearStorage();
  // Simulate claim at 11:59 PM yesterday
  const lastNight = new Date();
  lastNight.setDate(lastNight.getDate() - 1);
  lastNight.setHours(23, 59, 59, 999);
  setLastRewardDate(testUser, lastNight);
  canClaim = await canClaimToday(testUser);
  if (canClaim === true) {
    console.log('  ✅ Claim allowed (last claim was before midnight)');
    passed++;
  } else {
    console.log('  ❌ Claim should reset at midnight');
    failed++;
  }

  console.log('\n==================================================');
  console.log('📊 Test Results');
  console.log('==================================================');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n✨ All daily limit tests passed!\n');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed!\n');
    process.exit(1);
  }
}

runTests();
