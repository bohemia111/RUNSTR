#!/usr/bin/env node
/**
 * Verify Reward Wallet Script
 *
 * Checks if the RUNSTR reward wallet is:
 * 1. Configured correctly (NWC string present)
 * 2. Connected to relay
 * 3. Has sufficient balance
 *
 * Usage: node scripts/test-rewards/verify-reward-wallet.cjs
 */

const { NWCClient } = require('@getalby/sdk');
const dotenv = require('dotenv');
const crypto = require('crypto');
const path = require('path');

// Load environment
dotenv.config({ path: path.join(__dirname, '../../.env') });

const ENCRYPTION_KEY = process.env.NWC_ENCRYPTION_KEY;
const ENCRYPTED_NWC = process.env.ENCRYPTED_REWARD_NWC;
const PLAINTEXT_NWC = process.env.REWARD_SENDER_NWC;

// Minimum recommended balance (in sats)
const MIN_BALANCE_WARNING = 1000;
const MIN_BALANCE_CRITICAL = 100;

function decryptNWC(encrypted, key) {
  try {
    const [ivHex, encryptedHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedData = Buffer.from(encryptedHex, 'hex');
    const keyBuffer = Buffer.from(key, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return null;
  }
}

async function verifyWallet() {
  console.log('🔍 RUNSTR Reward Wallet Verification\n');
  console.log('='.repeat(50));

  // Step 1: Check NWC configuration
  console.log('\n📋 Step 1: NWC Configuration\n');

  let nwcUrl = null;

  if (ENCRYPTED_NWC && ENCRYPTION_KEY) {
    console.log('  ✅ Encrypted NWC configured');
    nwcUrl = decryptNWC(ENCRYPTED_NWC, ENCRYPTION_KEY);
    if (nwcUrl) {
      console.log('  ✅ Decryption successful');
    } else {
      console.log('  ❌ Decryption failed');
    }
  } else if (PLAINTEXT_NWC && !PLAINTEXT_NWC.includes('YOUR_NWC_STRING_HERE')) {
    console.log('  ⚠️  Using plaintext NWC (not recommended for production)');
    nwcUrl = PLAINTEXT_NWC;
  } else {
    console.log('  ❌ No NWC configured');
    console.log('\n  Fix: Set ENCRYPTED_REWARD_NWC in .env');
    console.log('       Run: node scripts/encrypt-secrets.cjs');
    process.exit(1);
  }

  // Parse NWC URL for diagnostics
  try {
    const url = new URL(nwcUrl);
    const relay = url.searchParams.get('relay');
    console.log(`  📡 Relay: ${relay || 'Not specified'}`);
  } catch (e) {
    console.log('  ⚠️  Could not parse NWC URL');
  }

  // Step 2: Test connection
  console.log('\n📋 Step 2: Wallet Connection\n');

  let client;
  try {
    client = new NWCClient({ nostrWalletConnectUrl: nwcUrl });
    console.log('  ✅ NWC client created');

    // Test with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    );

    const infoPromise = client.getInfo();
    const info = await Promise.race([infoPromise, timeoutPromise]);

    console.log(`  ✅ Connected to wallet`);
    console.log(`  📛 Alias: ${info.alias || 'Unknown'}`);
    console.log(`  🔧 Methods: ${(info.methods || []).slice(0, 5).join(', ')}...`);
  } catch (error) {
    console.log(`  ❌ Connection failed: ${error.message}`);
    process.exit(1);
  }

  // Step 3: Check balance
  console.log('\n📋 Step 3: Wallet Balance\n');

  try {
    const balanceResponse = await client.getBalance();
    const balance = balanceResponse.balance || 0;

    console.log(`  💰 Balance: ${balance.toLocaleString()} sats`);

    if (balance < MIN_BALANCE_CRITICAL) {
      console.log(`  🚨 CRITICAL: Balance below ${MIN_BALANCE_CRITICAL} sats!`);
      console.log('     Rewards will fail to send.');
    } else if (balance < MIN_BALANCE_WARNING) {
      console.log(`  ⚠️  WARNING: Balance below ${MIN_BALANCE_WARNING} sats`);
      console.log('     Consider topping up soon.');
    } else {
      console.log(`  ✅ Balance healthy`);
    }

    // Estimate how many rewards can be sent
    const dailyRewards = Math.floor(balance / 50);
    const stepRewards = Math.floor(balance / 5);
    console.log(`\n  📊 Estimated capacity:`);
    console.log(`     Daily rewards (50 sats): ${dailyRewards}`);
    console.log(`     Step rewards (5 sats): ${stepRewards}`);
  } catch (error) {
    console.log(`  ❌ Balance check failed: ${error.message}`);
  }

  // Step 4: Test payment capability
  console.log('\n📋 Step 4: Payment Capability\n');

  try {
    // Check if pay_invoice method is available
    const info = await client.getInfo();
    const canPay = info.methods?.includes('pay_invoice');
    const canMakeInvoice = info.methods?.includes('make_invoice');

    console.log(`  ${canPay ? '✅' : '❌'} pay_invoice: ${canPay ? 'Available' : 'Not available'}`);
    console.log(`  ${canMakeInvoice ? '✅' : '❌'} make_invoice: ${canMakeInvoice ? 'Available' : 'Not available'}`);

    if (!canPay) {
      console.log('\n  🚨 Wallet cannot pay invoices - rewards will not work!');
    }
  } catch (error) {
    console.log(`  ❌ Capability check failed: ${error.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('\n✅ Verification complete\n');
}

verifyWallet().catch(error => {
  console.error('\n❌ Verification failed:', error.message);
  process.exit(1);
});
