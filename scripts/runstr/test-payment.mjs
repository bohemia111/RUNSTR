#!/usr/bin/env node
/**
 * Live Payment Test Script
 * Tests the complete reward payment flow to a real Lightning address
 *
 * Usage: node scripts/test-rewards/test-payment-live.mjs [lightning-address] [amount]
 *
 * Examples:
 *   node scripts/test-rewards/test-payment-live.mjs
 *   node scripts/test-rewards/test-payment-live.mjs thewildhustle@strike.me 50
 */

import { NWCClient } from '@getalby/sdk';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Configuration
const DEFAULT_RECIPIENT = 'thewildhustle@strike.me';
const DEFAULT_AMOUNT = 50;

const RECIPIENT = process.argv[2] || DEFAULT_RECIPIENT;
const AMOUNT_SATS = parseInt(process.argv[3]) || DEFAULT_AMOUNT;

// Environment variables
const ENCRYPTION_KEY = process.env.NWC_ENCRYPTION_KEY;
const ENCRYPTED_NWC = process.env.ENCRYPTED_REWARD_NWC;
const PLAINTEXT_NWC = process.env.REWARD_SENDER_NWC;

/**
 * Decrypt NWC string using AES-256-CBC
 */
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
    return null;
  }
}

/**
 * Get NWC URL from environment
 */
function getNWCUrl() {
  // Try encrypted first
  if (ENCRYPTED_NWC && ENCRYPTION_KEY) {
    const decrypted = decryptNWC(ENCRYPTED_NWC, ENCRYPTION_KEY);
    if (decrypted) {
      console.log('  Using encrypted NWC');
      return decrypted;
    }
    console.log('  Decryption failed, trying plaintext...');
  }

  // Fall back to plaintext
  if (PLAINTEXT_NWC && !PLAINTEXT_NWC.includes('YOUR_NWC_STRING_HERE')) {
    console.log('  Using plaintext NWC');
    return PLAINTEXT_NWC;
  }

  return null;
}

/**
 * Request invoice from Lightning address via LNURL
 */
async function requestInvoice(lightningAddress, amountSats, comment = 'RUNSTR Reward Test') {
  const [user, domain] = lightningAddress.split('@');
  if (!user || !domain) {
    throw new Error(`Invalid Lightning address format: ${lightningAddress}`);
  }

  // Step 1: Fetch LNURL metadata
  const lnurlUrl = `https://${domain}/.well-known/lnurlp/${user}`;
  console.log(`  LNURL endpoint: ${lnurlUrl}`);

  const metaResponse = await fetch(lnurlUrl, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!metaResponse.ok) {
    throw new Error(`LNURL metadata fetch failed: ${metaResponse.status} ${metaResponse.statusText}`);
  }

  const metadata = await metaResponse.json();
  console.log(`  LNURL tag: ${metadata.tag}`);
  console.log(`  Min sendable: ${metadata.minSendable / 1000} sats`);
  console.log(`  Max sendable: ${metadata.maxSendable / 1000} sats`);

  if (metadata.tag !== 'payRequest') {
    throw new Error(`Invalid LNURL tag: ${metadata.tag} (expected payRequest)`);
  }

  // Step 2: Validate amount
  const amountMsats = amountSats * 1000;
  if (amountMsats < metadata.minSendable) {
    throw new Error(`Amount ${amountSats} sats below minimum ${metadata.minSendable / 1000} sats`);
  }
  if (amountMsats > metadata.maxSendable) {
    throw new Error(`Amount ${amountSats} sats above maximum ${metadata.maxSendable / 1000} sats`);
  }

  // Step 3: Request invoice
  const callbackUrl = new URL(metadata.callback);
  callbackUrl.searchParams.set('amount', amountMsats.toString());
  if (comment && metadata.commentAllowed) {
    callbackUrl.searchParams.set('comment', comment.slice(0, metadata.commentAllowed));
  }

  console.log(`  Requesting invoice for ${amountSats} sats...`);

  const invoiceResponse = await fetch(callbackUrl.toString(), {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!invoiceResponse.ok) {
    throw new Error(`Invoice request failed: ${invoiceResponse.status} ${invoiceResponse.statusText}`);
  }

  const invoiceData = await invoiceResponse.json();

  if (invoiceData.status === 'ERROR') {
    throw new Error(`LNURL error: ${invoiceData.reason || 'Unknown error'}`);
  }

  if (!invoiceData.pr) {
    throw new Error('No invoice (pr) in LNURL response');
  }

  return invoiceData.pr;
}

/**
 * Main test function
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  RUNSTR Reward Payment Test');
  console.log('='.repeat(60));
  console.log(`\nRecipient: ${RECIPIENT}`);
  console.log(`Amount: ${AMOUNT_SATS} sats\n`);

  let client = null;

  try {
    // Step 1: Load NWC configuration
    console.log('Step 1: NWC Configuration');
    console.log('-'.repeat(40));

    const nwcUrl = getNWCUrl();
    if (!nwcUrl) {
      console.log('  No NWC configured!');
      console.log('\n  Fix: Set ENCRYPTED_REWARD_NWC or REWARD_SENDER_NWC in .env');
      process.exit(1);
    }

    // Parse for diagnostics
    try {
      const url = new URL(nwcUrl);
      const relay = url.searchParams.get('relay');
      console.log(`  Relay: ${relay || 'Not specified'}`);
    } catch (e) {
      console.log('  Could not parse NWC URL');
    }
    console.log('');

    // Step 2: Connect to wallet
    console.log('Step 2: Wallet Connection');
    console.log('-'.repeat(40));

    client = new NWCClient({ nostrWalletConnectUrl: nwcUrl });
    console.log('  NWC client created');

    // Get wallet info with timeout
    console.log('  Connecting to wallet...');
    const info = await Promise.race([
      client.getInfo(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout (10s)')), 10000)),
    ]);

    console.log(`  Connected to: ${info.alias || 'Unknown wallet'}`);
    console.log(`  Methods: ${(info.methods || []).slice(0, 5).join(', ')}...`);

    // Check balance (NWC returns millisats)
    console.log('  Checking balance...');
    const balanceResponse = await client.getBalance();
    const balanceMsats = balanceResponse.balance || 0;
    const balanceSats = Math.floor(balanceMsats / 1000);
    console.log(`  Balance: ${balanceSats.toLocaleString()} sats (${balanceMsats.toLocaleString()} msats)`);

    if (balanceSats < AMOUNT_SATS) {
      console.log(`\n  INSUFFICIENT BALANCE!`);
      console.log(`  Need ${AMOUNT_SATS} sats, have ${balanceSats} sats`);
      process.exit(1);
    }
    console.log('');

    // Step 3: Request invoice
    console.log('Step 3: Invoice Request');
    console.log('-'.repeat(40));

    const invoice = await requestInvoice(RECIPIENT, AMOUNT_SATS);
    console.log(`  Invoice: ${invoice.slice(0, 50)}...`);
    console.log('');

    // Step 4: Send payment
    console.log('Step 4: Payment');
    console.log('-'.repeat(40));

    console.log('  Sending payment...');
    const paymentStart = Date.now();

    const response = await Promise.race([
      client.payInvoice({ invoice }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Payment timeout (30s)')), 30000)),
    ]);

    const paymentTime = Date.now() - paymentStart;

    if (response.preimage) {
      console.log(`  PAYMENT SUCCESSFUL!`);
      console.log(`  Preimage: ${response.preimage}`);
      console.log(`  Time: ${paymentTime}ms`);
      console.log('');

      // Final summary
      console.log('='.repeat(60));
      console.log('  RESULT: SUCCESS');
      console.log('='.repeat(60));
      console.log(`\n  Sent ${AMOUNT_SATS} sats to ${RECIPIENT}`);
      console.log(`  Preimage: ${response.preimage}`);
      console.log('');

      process.exit(0);
    } else {
      throw new Error('Payment completed but no preimage returned');
    }
  } catch (error) {
    console.log('');
    console.log('='.repeat(60));
    console.log('  RESULT: FAILED');
    console.log('='.repeat(60));
    console.log(`\n  Error: ${error.message}`);

    if (error.message.includes('timeout')) {
      console.log('\n  Possible causes:');
      console.log('  - NWC relay is slow or unresponsive');
      console.log('  - Network connectivity issues');
      console.log('  - Wallet service is down');
    } else if (error.message.includes('LNURL')) {
      console.log('\n  Possible causes:');
      console.log('  - Lightning address is invalid');
      console.log('  - LNURL service is down');
      console.log('  - Amount outside min/max limits');
    } else if (error.message.includes('INSUFFICIENT')) {
      console.log('\n  Fix: Top up the reward wallet');
    }

    console.log('');
    process.exit(1);
  } finally {
    if (client) {
      try {
        client.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

main();
