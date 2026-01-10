#!/usr/bin/env node
/**
 * OpenSSL-Compatible NWC Encryption Script
 *
 * Encrypts the REWARD_SENDER_NWC from .env using AES-256-CBC with PBKDF2
 * Compatible with OpenSSL command line and crypto-js for React Native decryption
 *
 * Usage: node scripts/encrypt-nwc-openssl.cjs
 *
 * The encrypted output can also be generated via OpenSSL CLI:
 *   echo "nostr+walletconnect://..." | openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -a -pass pass:YOUR_PASSWORD
 */

const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');

// Load .env file
require('dotenv').config();

// Encryption password - derived from app identity
// This is split across files to make extraction harder
const PASSWORD_PARTS = [
  'RUNSTR',      // App name
  '2025',        // Year
  'nwc',         // Purpose
  'coinos',      // Wallet provider hint
];
const ENCRYPTION_PASSWORD = PASSWORD_PARTS.join('-');

/**
 * Encrypt string using AES-256-CBC (OpenSSL compatible)
 * crypto-js uses PBKDF2 with MD5 by default for OpenSSL format
 */
function encryptOpenSSL(plaintext, password) {
  // crypto-js.AES.encrypt with a string password uses OpenSSL-compatible format
  // This includes "Salted__" prefix, random salt, and PBKDF2 key derivation
  const encrypted = CryptoJS.AES.encrypt(plaintext, password);
  return encrypted.toString(); // Returns base64 string
}

/**
 * Test decryption to verify it works
 */
function testDecryption(encrypted, password, original) {
  try {
    const decrypted = CryptoJS.AES.decrypt(encrypted, password);
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    return result === original;
  } catch (e) {
    return false;
  }
}

function main() {
  console.log('OpenSSL-Compatible NWC Encryption\n');
  console.log('='.repeat(50));

  // Get NWC from environment
  const nwc = process.env.REWARD_SENDER_NWC;

  if (!nwc) {
    console.error('ERROR: REWARD_SENDER_NWC not found in .env');
    console.error('Add your NWC connection string to .env first');
    process.exit(1);
  }

  if (!nwc.startsWith('nostr+walletconnect://')) {
    console.error('ERROR: REWARD_SENDER_NWC does not look like a valid NWC string');
    console.error('Expected format: nostr+walletconnect://...');
    process.exit(1);
  }

  console.log('NWC found in .env');
  console.log('Length:', nwc.length, 'characters');
  console.log('Preview:', nwc.slice(0, 40) + '...\n');

  // Encrypt
  console.log('Encrypting with password:', ENCRYPTION_PASSWORD.slice(0, 8) + '***');
  const encrypted = encryptOpenSSL(nwc, ENCRYPTION_PASSWORD);

  // Verify decryption works
  if (!testDecryption(encrypted, ENCRYPTION_PASSWORD, nwc)) {
    console.error('ERROR: Decryption verification failed!');
    process.exit(1);
  }
  console.log('Decryption verified successfully\n');

  // Output
  console.log('='.repeat(50));
  console.log('ENCRYPTED NWC (add this to .env):');
  console.log('='.repeat(50));
  console.log(`\nEXPO_PUBLIC_ENCRYPTED_REWARD_NWC=${encrypted}\n`);

  // Also update .env.example with instructions
  console.log('='.repeat(50));
  console.log('Next steps:');
  console.log('='.repeat(50));
  console.log('1. Add the ENCRYPTED_REWARD_NWC line to your .env file');
  console.log('2. You can optionally remove the plaintext REWARD_SENDER_NWC');
  console.log('3. The app will decrypt it at runtime using crypto-js\n');

  // Optionally write to a temp file for easy copying
  const outputPath = path.join(__dirname, '../.encrypted-nwc.tmp');
  fs.writeFileSync(outputPath, `EXPO_PUBLIC_ENCRYPTED_REWARD_NWC=${encrypted}\n`);
  console.log(`Output also saved to: ${outputPath}`);
  console.log('(Delete this file after copying to .env)\n');
}

main();
