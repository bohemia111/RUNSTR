/**
 * Test script to validate the reward payment flow
 * Tests: NWC connection, LNURL invoice request, payment execution
 *
 * Usage: node scripts/test-reward-flow.js
 */

const { NWCClient } = require('@getalby/sdk');

// Test configuration
const NWC_URL = 'nostr+walletconnect://72bdbc57bdd6dfc4e62685051de8041d148c3c68fe42bf301f71aa6cf53e52fb?relay=wss%3A%2F%2Frelay.coinos.io&secret=e827878f1a5b3ab0a65d47fc8301d78a5e3f586c6ab5b5f4f1fd565338c22aa4&lud16=RUNSTR@coinos.io';
const TEST_LIGHTNING_ADDRESS = 'RUNSTR@coinos.io'; // Testing with RUNSTR wallet (sends to self - net zero)
const REWARD_AMOUNT = 21; // sats

async function fetchLNURLPayDetails(lightningAddress) {
  const [name, domain] = lightningAddress.split('@');
  const url = `https://${domain}/.well-known/lnurlp/${name}`;

  console.log('  Fetching LNURL from:', url);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('LNURL fetch failed: ' + response.status);
  }

  return response.json();
}

async function requestInvoice(callbackUrl, amountSats, description) {
  const amountMsats = amountSats * 1000;
  const encodedComment = encodeURIComponent(description);
  const url = callbackUrl + '?amount=' + amountMsats + '&comment=' + encodedComment;

  console.log('  Requesting invoice for', amountSats, 'sats...');
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Invoice request failed: ' + response.status);
  }

  const data = await response.json();
  if (data.status === 'ERROR') {
    throw new Error('LNURL error: ' + data.reason);
  }

  return data.pr; // BOLT11 invoice
}

async function runTests() {
  console.log('\n🧪 RUNSTR Reward Flow Test\n');
  console.log('==================================================');

  let nwcClient;
  let initialBalance;

  // Test 1: NWC Connection
  console.log('\n📡 Test 1: NWC Wallet Connection');
  try {
    nwcClient = new NWCClient({ nostrWalletConnectUrl: NWC_URL });
    const info = await nwcClient.getInfo();
    console.log('  ✅ Connected to:', info.alias || 'Unknown');
    console.log('  Methods:', (info.methods || []).slice(0, 5).join(', '));

    const balanceResult = await nwcClient.getBalance();
    initialBalance = balanceResult.balance;
    console.log('  💰 Balance:', initialBalance.toLocaleString(), 'sats');
  } catch (error) {
    console.log('  ❌ FAILED:', error.message);
    process.exit(1);
  }

  // Test 2: LNURL Resolution
  console.log('\n🔗 Test 2: LNURL Resolution (' + TEST_LIGHTNING_ADDRESS + ')');
  let lnurlDetails;
  try {
    lnurlDetails = await fetchLNURLPayDetails(TEST_LIGHTNING_ADDRESS);
    console.log('  ✅ LNURL resolved');
    console.log('  Min:', lnurlDetails.minSendable / 1000, 'sats');
    console.log('  Max:', lnurlDetails.maxSendable / 1000, 'sats');
    console.log('  Callback:', lnurlDetails.callback.substring(0, 50) + '...');
  } catch (error) {
    console.log('  ❌ FAILED:', error.message);
    process.exit(1);
  }

  // Test 3: Invoice Request
  console.log('\n🧾 Test 3: Invoice Request (' + REWARD_AMOUNT + ' sats)');
  let invoice;
  try {
    invoice = await requestInvoice(
      lnurlDetails.callback,
      REWARD_AMOUNT,
      'RUNSTR Test Reward'
    );
    console.log('  ✅ Invoice received');
    console.log('  Invoice:', invoice.substring(0, 40) + '...');
  } catch (error) {
    console.log('  ❌ FAILED:', error.message);
    process.exit(1);
  }

  // Test 4: Payment Execution
  console.log('\n💸 Test 4: Payment Execution');
  try {
    console.log('  Sending', REWARD_AMOUNT, 'sats to', TEST_LIGHTNING_ADDRESS + '...');
    const paymentResult = await nwcClient.payInvoice({ invoice });

    if (paymentResult.preimage) {
      console.log('  ✅ Payment successful!');
      console.log('  Preimage:', paymentResult.preimage.substring(0, 20) + '...');

      // Check new balance
      const newBalanceResult = await nwcClient.getBalance();
      const spent = initialBalance - newBalanceResult.balance;
      console.log('  💰 New balance:', newBalanceResult.balance.toLocaleString(), 'sats');
      console.log('  📉 Spent:', spent, 'sats (includes routing fees)');
    } else {
      console.log('  ❌ Payment failed - no preimage');
      process.exit(1);
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error.message);
    process.exit(1);
  }

  // Summary
  console.log('\n==================================================');
  console.log('📊 Test Summary');
  console.log('==================================================');
  console.log('  ✅ NWC Connection: Working');
  console.log('  ✅ LNURL Resolution: Working');
  console.log('  ✅ Invoice Generation: Working');
  console.log('  ✅ Payment Execution: Working');
  console.log('\n✨ All reward flow components are functional!\n');
  console.log('The app should be able to send', REWARD_AMOUNT, 'sat rewards');
  console.log('to users with Lightning addresses in their Nostr profiles.\n');

  process.exit(0);
}

// Run tests
runTests().catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
