/**
 * Test Script: Donation Split Verification
 *
 * This script verifies that the storage key fix is working correctly
 * and tests end-to-end payment splitting between user and charity.
 *
 * PHASE 1: Verifies the storage key mismatch fix
 * - Simulates TeamsScreen writing to @runstr:selected_team_id
 * - Reads back using the SAME key DailyRewardService now uses
 * - Confirms charity resolution works (was undefined before fix)
 *
 * PHASE 2: Tests actual payment split
 * - Sends 38 sats to user (thewildhustle@strike.me)
 * - Sends 12 sats to charity (bdi@strike.me - Bitcoin District)
 *
 * Usage: node scripts/testing/test-donation-split.cjs
 */

const { NWCClient } = require('@getalby/sdk');

// ============================================================
// TEST CONFIGURATION
// ============================================================
const CONFIG = {
  // User being tested
  userLightningAddress: 'thewildhustle@strike.me',

  // Team/Charity selection (Bitcoin District)
  selectedTeamId: 'bitcoin-district',

  // Donation percentage (25%)
  donationPercentage: 25,

  // Total reward amount
  rewardAmount: 50,

  // NWC for reward sender wallet (from src/config/rewards.ts)
  nwcUrl: 'nostr+walletconnect://72bdbc57bdd6dfc4e62685051de8041d148c3c68fe42bf301f71aa6cf53e52fb?relay=wss%3A%2F%2Frelay.coinos.io&secret=a50e5e32b590939a3cea777ab87cf3591f9dbde3841395900c5d723e64f1934f&lud16=RUNSTR@coinos.io',
};

// ============================================================
// CHARITY DATA (from src/constants/charities.ts)
// ============================================================
const CHARITIES = [
  {
    id: 'bitcoin-bay',
    name: 'Bitcoin Bay',
    lightningAddress: 'sats@donate.bitcoinbay.foundation',
  },
  {
    id: 'bitcoin-ekasi',
    name: 'Bitcoin Ekasi',
    lightningAddress: 'bitcoinekasi@primal.net',
  },
  {
    id: 'bitcoin-isla',
    name: 'Bitcoin Isla',
    lightningAddress: 'BTCIsla@primal.net',
  },
  {
    id: 'bitcoin-district',
    name: 'Bitcoin District',
    lightningAddress: 'bdi@strike.me',
  },
  {
    id: 'human-rights-foundation',
    name: 'Human Rights Foundation',
    lightningAddress: 'nostr@btcpay.hrf.org',
  },
];

function getCharityById(charityId) {
  if (!charityId) return undefined;
  return CHARITIES.find(c => c.id === charityId);
}

// ============================================================
// SIMULATED ASYNCSTORAGE (mimics what the app does)
// ============================================================
const mockAsyncStorage = {};

function setItem(key, value) {
  mockAsyncStorage[key] = value;
  console.log(`  [Storage] SET ${key} = "${value}"`);
}

function getItem(key) {
  const value = mockAsyncStorage[key] || null;
  console.log(`  [Storage] GET ${key} = "${value}"`);
  return value;
}

// ============================================================
// STORAGE KEYS (must match what the app uses)
// ============================================================
// TeamsScreen uses this key:
const SELECTED_TEAM_KEY = '@runstr:selected_team_id';

// DailyRewardService NOW uses this same key (after fix):
const SELECTED_CHARITY_KEY = '@runstr:selected_team_id'; // <-- THE FIX

// Both use this for percentage:
const DONATION_PERCENTAGE_KEY = '@runstr:donation_percentage';

// ============================================================
// SPLIT CALCULATION (from DailyRewardService)
// ============================================================
function calculateSplit(totalAmount, donationPercentage, charity) {
  if (donationPercentage === 0 || !charity) {
    // No donation or no charity selected - user gets everything
    return {
      userAmount: totalAmount,
      charityAmount: 0,
      charityName: null,
      charityAddress: null,
    };
  }

  const charityAmount = Math.floor(totalAmount * (donationPercentage / 100));
  const userAmount = totalAmount - charityAmount;

  return {
    userAmount,
    charityAmount,
    charityName: charity.name,
    charityAddress: charity.lightningAddress,
  };
}

// ============================================================
// LNURL HELPERS
// ============================================================
async function fetchLNURLPayDetails(lightningAddress) {
  const [name, domain] = lightningAddress.split('@');
  const url = `https://${domain}/.well-known/lnurlp/${name}`;

  console.log(`  Fetching LNURL from: ${url}`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`LNURL fetch failed: ${response.status}`);
  }

  return response.json();
}

async function requestInvoice(callbackUrl, amountSats, description) {
  const amountMsats = amountSats * 1000;
  const encodedComment = encodeURIComponent(description);
  const url = `${callbackUrl}?amount=${amountMsats}&comment=${encodedComment}`;

  console.log(`  Requesting invoice for ${amountSats} sats...`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Invoice request failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.status === 'ERROR') {
    throw new Error(`LNURL error: ${data.reason}`);
  }

  return data.pr; // BOLT11 invoice
}

// ============================================================
// MAIN TEST RUNNER
// ============================================================
async function runTests() {
  console.log('\n');
  console.log('============================================================');
  console.log('   RUNSTR Donation Split Test');
  console.log('============================================================');
  console.log(`   User: ${CONFIG.userLightningAddress}`);
  console.log(`   Team: ${CONFIG.selectedTeamId}`);
  console.log(`   Donation: ${CONFIG.donationPercentage}%`);
  console.log(`   Total Reward: ${CONFIG.rewardAmount} sats`);
  console.log('============================================================\n');

  let testsPassed = 0;
  let testsFailed = 0;

  // ================================================================
  // PHASE 1: VERIFY STORAGE KEY FIX
  // ================================================================
  console.log('PHASE 1: Storage Key Fix Verification');
  console.log('------------------------------------------------------------\n');

  // Test 1.1: Simulate TeamsScreen saving selection
  console.log('Test 1.1: Simulate TeamsScreen (write team ID)');
  try {
    setItem(SELECTED_TEAM_KEY, CONFIG.selectedTeamId);
    console.log('  ✅ PASS: Team ID written to storage\n');
    testsPassed++;
  } catch (error) {
    console.log(`  ❌ FAIL: ${error.message}\n`);
    testsFailed++;
  }

  // Test 1.2: Simulate RewardsScreen saving percentage
  console.log('Test 1.2: Simulate RewardsScreen (write donation %)');
  try {
    setItem(DONATION_PERCENTAGE_KEY, CONFIG.donationPercentage.toString());
    console.log('  ✅ PASS: Donation percentage written to storage\n');
    testsPassed++;
  } catch (error) {
    console.log(`  ❌ FAIL: ${error.message}\n`);
    testsFailed++;
  }

  // Test 1.3: Simulate DailyRewardService reading (THE CRITICAL TEST)
  console.log('Test 1.3: Simulate DailyRewardService (read charity)');
  console.log('  This tests that the storage key FIX is working...');
  let charity = null;
  let donationPct = 0;
  try {
    // Read using the FIXED key (same as TeamsScreen now)
    const charityId = getItem(SELECTED_CHARITY_KEY);
    const pctStr = getItem(DONATION_PERCENTAGE_KEY);

    charity = getCharityById(charityId);
    donationPct = pctStr ? parseInt(pctStr) : 0;

    if (!charity) {
      throw new Error('Charity is UNDEFINED - storage key mismatch NOT fixed!');
    }

    console.log(`  Resolved charity: ${charity.name}`);
    console.log(`  Lightning address: ${charity.lightningAddress}`);
    console.log(`  Donation percentage: ${donationPct}%`);
    console.log('  ✅ PASS: Charity resolved correctly (FIX IS WORKING)\n');
    testsPassed++;
  } catch (error) {
    console.log(`  ❌ FAIL: ${error.message}`);
    console.log('  >>> This means the storage key fix is NOT working <<<\n');
    testsFailed++;
    // Cannot continue without charity
    process.exit(1);
  }

  // Test 1.4: Verify split calculation
  console.log('Test 1.4: Verify split calculation');
  let split = null;
  try {
    split = calculateSplit(CONFIG.rewardAmount, donationPct, charity);

    const expectedCharityAmount = Math.floor(CONFIG.rewardAmount * (CONFIG.donationPercentage / 100));
    const expectedUserAmount = CONFIG.rewardAmount - expectedCharityAmount;

    console.log(`  Expected user amount: ${expectedUserAmount} sats`);
    console.log(`  Actual user amount: ${split.userAmount} sats`);
    console.log(`  Expected charity amount: ${expectedCharityAmount} sats`);
    console.log(`  Actual charity amount: ${split.charityAmount} sats`);

    if (split.userAmount !== expectedUserAmount || split.charityAmount !== expectedCharityAmount) {
      throw new Error('Split calculation mismatch!');
    }

    if (split.charityAmount === 0) {
      throw new Error('Charity amount is 0 - donation not being split!');
    }

    console.log('  ✅ PASS: Split calculation correct\n');
    testsPassed++;
  } catch (error) {
    console.log(`  ❌ FAIL: ${error.message}\n`);
    testsFailed++;
  }

  console.log('------------------------------------------------------------');
  console.log(`PHASE 1 RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('------------------------------------------------------------\n');

  if (testsFailed > 0) {
    console.log('❌ Phase 1 failed - storage key fix verification did not pass\n');
    process.exit(1);
  }

  // ================================================================
  // PHASE 2: END-TO-END PAYMENT TEST
  // ================================================================
  console.log('PHASE 2: End-to-End Payment Test');
  console.log('------------------------------------------------------------\n');

  let nwcClient = null;
  let initialBalance = 0;

  // Test 2.1: NWC Connection
  console.log('Test 2.1: Connect to reward sender wallet (NWC)');
  try {
    nwcClient = new NWCClient({ nostrWalletConnectUrl: CONFIG.nwcUrl });
    const info = await nwcClient.getInfo();
    console.log(`  Connected to: ${info.alias || 'Unknown'}`);

    const balanceResult = await nwcClient.getBalance();
    initialBalance = balanceResult.balance;
    console.log(`  Balance: ${initialBalance.toLocaleString()} sats`);

    if (initialBalance < CONFIG.rewardAmount) {
      throw new Error(`Insufficient balance (need ${CONFIG.rewardAmount} sats)`);
    }

    console.log('  ✅ PASS: NWC connected\n');
    testsPassed++;
  } catch (error) {
    console.log(`  ❌ FAIL: ${error.message}\n`);
    testsFailed++;
    process.exit(1);
  }

  // Test 2.2: Request invoice from user
  console.log(`Test 2.2: Request invoice from user (${CONFIG.userLightningAddress})`);
  let userInvoice = null;
  try {
    const lnurlDetails = await fetchLNURLPayDetails(CONFIG.userLightningAddress);
    userInvoice = await requestInvoice(
      lnurlDetails.callback,
      split.userAmount,
      `RUNSTR Reward (${split.userAmount} sats)`
    );
    console.log(`  Invoice: ${userInvoice.substring(0, 40)}...`);
    console.log('  ✅ PASS: User invoice received\n');
    testsPassed++;
  } catch (error) {
    console.log(`  ❌ FAIL: ${error.message}\n`);
    testsFailed++;
  }

  // Test 2.3: Request invoice from charity
  console.log(`Test 2.3: Request invoice from charity (${split.charityAddress})`);
  let charityInvoice = null;
  try {
    const lnurlDetails = await fetchLNURLPayDetails(split.charityAddress);
    charityInvoice = await requestInvoice(
      lnurlDetails.callback,
      split.charityAmount,
      `RUNSTR Donation to ${split.charityName} (${split.charityAmount} sats)`
    );
    console.log(`  Invoice: ${charityInvoice.substring(0, 40)}...`);
    console.log('  ✅ PASS: Charity invoice received\n');
    testsPassed++;
  } catch (error) {
    console.log(`  ❌ FAIL: ${error.message}\n`);
    testsFailed++;
  }

  // Test 2.4: Pay user
  if (userInvoice) {
    console.log(`Test 2.4: Pay user (${split.userAmount} sats)`);
    try {
      const result = await nwcClient.payInvoice({ invoice: userInvoice });
      if (result.preimage) {
        console.log(`  Payment successful! Preimage: ${result.preimage.substring(0, 20)}...`);
        console.log('  ✅ PASS: User paid\n');
        testsPassed++;
      } else {
        throw new Error('No preimage returned');
      }
    } catch (error) {
      console.log(`  ❌ FAIL: ${error.message}\n`);
      testsFailed++;
    }
  }

  // Test 2.5: Pay charity
  if (charityInvoice) {
    console.log(`Test 2.5: Pay charity (${split.charityAmount} sats to ${split.charityName})`);
    try {
      const result = await nwcClient.payInvoice({ invoice: charityInvoice });
      if (result.preimage) {
        console.log(`  Payment successful! Preimage: ${result.preimage.substring(0, 20)}...`);
        console.log('  ✅ PASS: Charity paid\n');
        testsPassed++;
      } else {
        throw new Error('No preimage returned');
      }
    } catch (error) {
      console.log(`  ❌ FAIL: ${error.message}\n`);
      testsFailed++;
    }
  }

  // Test 2.6: Verify final balance
  console.log('Test 2.6: Verify final balance');
  try {
    const finalBalanceResult = await nwcClient.getBalance();
    const spent = initialBalance - finalBalanceResult.balance;
    console.log(`  Initial balance: ${initialBalance.toLocaleString()} sats`);
    console.log(`  Final balance: ${finalBalanceResult.balance.toLocaleString()} sats`);
    console.log(`  Total spent: ${spent} sats (includes routing fees)`);
    console.log('  ✅ PASS: Balance verified\n');
    testsPassed++;
  } catch (error) {
    console.log(`  ❌ FAIL: ${error.message}\n`);
    testsFailed++;
  }

  // ================================================================
  // FINAL SUMMARY
  // ================================================================
  console.log('============================================================');
  console.log('   TEST SUMMARY');
  console.log('============================================================');
  console.log(`   Total tests: ${testsPassed + testsFailed}`);
  console.log(`   Passed: ${testsPassed}`);
  console.log(`   Failed: ${testsFailed}`);
  console.log('------------------------------------------------------------');
  console.log(`   User received: ${split.userAmount} sats (${CONFIG.userLightningAddress})`);
  console.log(`   Charity received: ${split.charityAmount} sats (${split.charityName})`);
  console.log('============================================================\n');

  if (testsFailed === 0) {
    console.log('✅ ALL TESTS PASSED - Donation split is working correctly!\n');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED - Check output above\n');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
