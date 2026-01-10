/**
 * NWC Decryptor - Runtime decryption of encrypted NWC strings
 *
 * Uses crypto-js for AES-256-CBC decryption (OpenSSL compatible)
 * This works reliably in React Native unlike crypto.subtle
 *
 * The encrypted NWC is stored in .env as EXPO_PUBLIC_ENCRYPTED_REWARD_NWC
 * Encryption done via: node scripts/encrypt-nwc-openssl.cjs
 */

import CryptoJS from 'crypto-js';

// Password parts - split to make extraction slightly harder
// Must match scripts/encrypt-nwc-openssl.cjs
const P1 = 'RUNSTR';
const P2 = '2025';
const P3 = 'nwc';
const P4 = 'coinos';

/**
 * Get the decryption password
 * Assembled from parts to avoid a single greppable string
 */
function getPassword(): string {
  return [P1, P2, P3, P4].join('-');
}

/**
 * Decrypt the reward NWC connection string
 *
 * @returns Decrypted NWC string or null if decryption fails
 */
export function decryptRewardNWC(): string | null {
  try {
    // Get encrypted value from environment
    // Uses EXPO_PUBLIC_ prefix for Expo compatibility
    const encrypted = process.env.EXPO_PUBLIC_ENCRYPTED_REWARD_NWC;

    if (!encrypted) {
      console.warn('[NWCDecryptor] ENCRYPTED_REWARD_NWC not found in environment');
      return null;
    }

    // Decrypt using crypto-js (OpenSSL compatible)
    const password = getPassword();
    const decrypted = CryptoJS.AES.decrypt(encrypted, password);
    const result = decrypted.toString(CryptoJS.enc.Utf8);

    if (!result) {
      console.error('[NWCDecryptor] Decryption produced empty result');
      return null;
    }

    // Validate it looks like an NWC string
    if (!result.startsWith('nostr+walletconnect://')) {
      console.error('[NWCDecryptor] Decrypted value does not look like NWC string');
      return null;
    }

    console.log('[NWCDecryptor] Successfully decrypted NWC');
    return result;
  } catch (error) {
    console.error('[NWCDecryptor] Decryption failed:', error);
    return null;
  }
}

/**
 * Check if encrypted NWC is configured in environment
 */
export function isEncryptedNWCConfigured(): boolean {
  return !!process.env.EXPO_PUBLIC_ENCRYPTED_REWARD_NWC;
}
