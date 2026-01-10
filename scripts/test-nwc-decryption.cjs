#!/usr/bin/env node
/**
 * Test NWC Encryption/Decryption
 * Verifies that the encrypted NWC can be decrypted correctly
 */

const CryptoJS = require('crypto-js');
require('dotenv').config();

// Same password derivation as the app
const P1 = 'RUNSTR';
const P2 = '2025';
const P3 = 'nwc';
const P4 = 'coinos';
const PASSWORD = [P1, P2, P3, P4].join('-');

console.log('NWC Encryption/Decryption Test');
console.log('='.repeat(50));

// Get values from environment
const encrypted = process.env.EXPO_PUBLIC_ENCRYPTED_REWARD_NWC;
const plaintext = process.env.REWARD_SENDER_NWC;

console.log('\n1. Environment Variables:');
console.log('   EXPO_PUBLIC_ENCRYPTED_REWARD_NWC:', encrypted ? `${encrypted.slice(0, 30)}...` : 'NOT SET');
console.log('   REWARD_SENDER_NWC (plaintext):', plaintext ? `${plaintext.slice(0, 40)}...` : 'NOT SET');

if (!encrypted) {
  console.log('\n❌ ERROR: EXPO_PUBLIC_ENCRYPTED_REWARD_NWC not found in .env');
  console.log('   Run: node scripts/encrypt-nwc-openssl.cjs');
  process.exit(1);
}

console.log('\n2. Decrypting...');
try {
  const decrypted = CryptoJS.AES.decrypt(encrypted, PASSWORD);
  const result = decrypted.toString(CryptoJS.enc.Utf8);

  if (!result) {
    console.log('   ❌ Decryption produced empty result');
    process.exit(1);
  }

  console.log('   Decrypted value:', result.slice(0, 50) + '...');

  // Validate it looks like an NWC string
  if (!result.startsWith('nostr+walletconnect://')) {
    console.log('   ❌ Decrypted value does not look like NWC string');
    process.exit(1);
  }

  console.log('   ✅ Decrypted value is valid NWC format');

  // Compare with plaintext if available
  if (plaintext) {
    if (result === plaintext) {
      console.log('   ✅ Decrypted value matches plaintext REWARD_SENDER_NWC');
    } else {
      console.log('   ⚠️  Decrypted value differs from plaintext REWARD_SENDER_NWC');
      console.log('      This is fine if you updated one but not the other');
    }
  }

  // Extract and show relay for debugging
  try {
    const url = new URL(result);
    console.log('\n3. NWC Details:');
    console.log('   Pubkey:', url.pathname.slice(2, 18) + '...');
    console.log('   Relay:', url.searchParams.get('relay'));
    console.log('   Has secret:', url.searchParams.has('secret') ? 'Yes' : 'No');
    console.log('   Lightning address:', url.searchParams.get('lud16') || 'Not set');
  } catch (e) {
    console.log('\n3. Could not parse NWC URL details');
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ SUCCESS: NWC encryption/decryption is working!');
  console.log('='.repeat(50));
  console.log('\nThe app will decrypt this at runtime using crypto-js.');
  console.log('No plaintext NWC will appear in the compiled app bundle.\n');

} catch (error) {
  console.log('   ❌ Decryption failed:', error.message);
  process.exit(1);
}
