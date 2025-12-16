/**
 * Test script to validate Lightning address priority logic
 * Tests that settings address takes priority over profile address
 *
 * Priority order:
 * 1. Settings-stored address (same as in kind 1301 notes)
 * 2. Nostr profile lud16 field (fallback)
 *
 * Usage: node scripts/test-lightning-address-priority.cjs
 */

// Simulated storage for settings address
let settingsAddress = null;

// Simulated profile data
const profiles = {
  'user-with-both': {
    lud16: 'profile@getalby.com',
  },
  'user-profile-only': {
    lud16: 'onlyprofile@strike.me',
  },
  'user-no-lightning': {
    // No lud16 field
  },
};

// Mock functions matching actual service behavior
function getSettingsLightningAddress() {
  return settingsAddress;
}

function setSettingsLightningAddress(address) {
  settingsAddress = address;
}

function clearSettingsAddress() {
  settingsAddress = null;
}

function getProfileLightningAddress(userPubkey) {
  const profile = profiles[userPubkey];
  return profile?.lud16 || null;
}

/**
 * Get Lightning address with correct priority
 * This mimics DailyRewardService.getUserLightningAddress()
 */
function getUserLightningAddress(userPubkey) {
  // PRIORITY 1: Check settings-stored address
  const settingsAddr = getSettingsLightningAddress();
  if (settingsAddr) {
    return { address: settingsAddr, source: 'settings' };
  }

  // PRIORITY 2: Fallback to Nostr profile lud16
  const profileAddr = getProfileLightningAddress(userPubkey);
  if (profileAddr) {
    return { address: profileAddr, source: 'profile' };
  }

  return { address: null, source: 'none' };
}

function runTests() {
  console.log('\n⚡ Lightning Address Priority Tests\n');
  console.log('==================================================');
  console.log('Priority: 1) Settings address  2) Profile lud16');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Settings address takes priority over profile
  console.log('Test 1: Settings address takes priority');
  clearSettingsAddress();
  setSettingsLightningAddress('settings@coinos.io');
  let result = getUserLightningAddress('user-with-both');
  if (result.address === 'settings@coinos.io' && result.source === 'settings') {
    console.log('  ✅ Settings address used: settings@coinos.io');
    passed++;
  } else {
    console.log(`  ❌ Expected settings@coinos.io, got ${result.address} from ${result.source}`);
    failed++;
  }

  // Test 2: Profile address used when no settings
  console.log('\nTest 2: Profile address used when no settings');
  clearSettingsAddress();
  result = getUserLightningAddress('user-with-both');
  if (result.address === 'profile@getalby.com' && result.source === 'profile') {
    console.log('  ✅ Profile address used: profile@getalby.com');
    passed++;
  } else {
    console.log(`  ❌ Expected profile@getalby.com, got ${result.address} from ${result.source}`);
    failed++;
  }

  // Test 3: Profile-only user gets profile address
  console.log('\nTest 3: User with only profile address');
  clearSettingsAddress();
  result = getUserLightningAddress('user-profile-only');
  if (result.address === 'onlyprofile@strike.me' && result.source === 'profile') {
    console.log('  ✅ Profile address used: onlyprofile@strike.me');
    passed++;
  } else {
    console.log(`  ❌ Expected onlyprofile@strike.me, got ${result.address}`);
    failed++;
  }

  // Test 4: User with no Lightning address
  console.log('\nTest 4: User with no Lightning address');
  clearSettingsAddress();
  result = getUserLightningAddress('user-no-lightning');
  if (result.address === null && result.source === 'none') {
    console.log('  ✅ No address found (correct - user has no Lightning)');
    passed++;
  } else {
    console.log(`  ❌ Expected null, got ${result.address}`);
    failed++;
  }

  // Test 5: Settings address used even if profile has one
  console.log('\nTest 5: Settings always preferred over profile');
  setSettingsLightningAddress('mysettings@wallet.com');
  result = getUserLightningAddress('user-with-both');
  if (result.address === 'mysettings@wallet.com' && result.source === 'settings') {
    console.log('  ✅ Settings preferred: mysettings@wallet.com');
    passed++;
  } else {
    console.log(`  ❌ Expected settings address`);
    failed++;
  }

  // Test 6: Unknown user with settings address
  console.log('\nTest 6: Unknown user but has settings address');
  setSettingsLightningAddress('known@address.com');
  result = getUserLightningAddress('unknown-user-pubkey');
  if (result.address === 'known@address.com' && result.source === 'settings') {
    console.log('  ✅ Settings address used for unknown user');
    passed++;
  } else {
    console.log(`  ❌ Expected settings address`);
    failed++;
  }

  // Test 7: Unknown user without settings address
  console.log('\nTest 7: Unknown user without settings address');
  clearSettingsAddress();
  result = getUserLightningAddress('unknown-user-pubkey');
  if (result.address === null && result.source === 'none') {
    console.log('  ✅ No address found for unknown user');
    passed++;
  } else {
    console.log(`  ❌ Expected null`);
    failed++;
  }

  console.log('\n==================================================');
  console.log('📊 Test Results');
  console.log('==================================================');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n✨ All Lightning address priority tests passed!\n');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed!\n');
    process.exit(1);
  }
}

runTests();
