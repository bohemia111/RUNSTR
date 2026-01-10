/**
 * Secret Decryptor - Runtime decryption of encrypted secrets
 * Decrypts values that were encrypted at build time by encrypt-secrets.cjs
 *
 * Uses AES-256-GCM with a key derived from multiple obfuscated sources
 * This makes it harder (not impossible) to extract secrets from the APK
 */

import { ENCRYPTED_REWARD_NWC } from '../config/encryptedSecrets';
import { APP_META } from '../constants/appConstants';
import { INTERNAL_FLAGS } from '../config/features';

// Protocol version string (part 4 of key derivation)
const PROTOCOL_VERSION = 'nwc-v1-2025';

// Bundle ID prefix (part 2 of key derivation)
const BUNDLE_PREFIX = 'com.anon';

/**
 * Convert base64 string to Uint8Array
 */
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive decryption key from obfuscated components
 * Must match the algorithm in encrypt-secrets.cjs
 */
async function deriveKey(): Promise<Uint8Array> {
  const part1 = APP_META.buildId;
  const part2 = BUNDLE_PREFIX;
  const part3 = INTERNAL_FLAGS.experimentId;
  const part4 = PROTOCOL_VERSION;

  const combined = `${part1}:${part2}:${part3}:${part4}`;

  // Use SubtleCrypto for SHA-256 (available via polyfills)
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  return new Uint8Array(hashBuffer);
}

/**
 * Decrypt the reward NWC connection string
 * Uses AES-256-GCM with derived key
 *
 * @returns Decrypted NWC string or null if decryption fails
 */
export async function getDecryptedRewardNWC(): Promise<string | null> {
  try {
    const { c, i, t } = ENCRYPTED_REWARD_NWC;

    // Check for placeholder values
    if (c === 'PLACEHOLDER_CIPHERTEXT') {
      console.warn(
        '[SecretDecryptor] Encrypted secrets not generated. Run: npm run prebuild:secrets'
      );
      return null;
    }

    // Derive the decryption key
    const keyBytes = await deriveKey();

    // Import as CryptoKey for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decode base64 values
    const ciphertext = base64ToBytes(c);
    const iv = base64ToBytes(i);
    const authTag = base64ToBytes(t);

    // AES-GCM expects ciphertext + authTag concatenated
    const ciphertextWithTag = new Uint8Array(ciphertext.length + authTag.length);
    ciphertextWithTag.set(ciphertext);
    ciphertextWithTag.set(authTag, ciphertext.length);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertextWithTag
    );

    // Convert to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('[SecretDecryptor] Decryption failed:', error);
    return null;
  }
}

/**
 * Check if encrypted secrets are properly configured
 */
export function areSecretsConfigured(): boolean {
  return ENCRYPTED_REWARD_NWC.c !== 'PLACEHOLDER_CIPHERTEXT';
}
