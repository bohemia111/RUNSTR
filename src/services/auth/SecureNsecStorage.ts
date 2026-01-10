/**
 * SecureNsecStorage - Hardware-backed nsec storage
 *
 * Uses expo-secure-store for hardware-backed encryption:
 * - iOS: Keychain with Secure Enclave
 * - Android: Keystore (hardware-backed when available)
 *
 * Includes backwards-compatible migration from AsyncStorage
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SECURE_NSEC_KEY = 'user_nsec_secure';
const MIGRATION_FLAG_KEY = '@runstr:nsec_migrated_to_secure';

// Legacy AsyncStorage keys for migration
const LEGACY_KEYS = {
  NSEC_PLAIN: '@runstr:user_nsec',
  NSEC_ENCRYPTED: '@runstr:nsec_encrypted',
  ENCRYPTION_KEY: '@runstr:encryption_key',
};

/**
 * Simple XOR decryption for migrating legacy encrypted nsec
 * Must match the encryption in nostrAuth.ts
 */
function decryptLegacyNsec(encrypted: string, key: string): string {
  try {
    const keyPadded = key.slice(0, 32).padEnd(32, '0');

    // Base64 decode
    const base64chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const base64inv: { [key: string]: number } = {};
    for (let i = 0; i < base64chars.length; i++) {
      base64inv[base64chars[i]] = i;
    }

    encrypted = encrypted.replace(/[^A-Za-z0-9+/]/g, '');
    let data = '';
    let bits = 0;
    let value = 0;

    for (let i = 0; i < encrypted.length; i++) {
      const c = encrypted[i];
      if (c === '=') break;

      value = (value << 6) | base64inv[c];
      bits += 6;

      if (bits >= 8) {
        bits -= 8;
        data += String.fromCharCode((value >> bits) & 0xff);
        value &= (1 << bits) - 1;
      }
    }

    let decrypted = '';
    for (let i = 0; i < data.length; i++) {
      decrypted += String.fromCharCode(
        data.charCodeAt(i) ^ keyPadded.charCodeAt(i % keyPadded.length)
      );
    }

    return decrypted;
  } catch (error) {
    console.error('[SecureNsec] Legacy decryption error:', error);
    return '';
  }
}

export const SecureNsecStorage = {
  /**
   * Store nsec in SecureStore (hardware-backed encryption)
   */
  async storeNsec(nsec: string): Promise<boolean> {
    try {
      if (!nsec || !nsec.startsWith('nsec1')) {
        console.error('[SecureNsec] Invalid nsec format');
        return false;
      }

      await SecureStore.setItemAsync(SECURE_NSEC_KEY, nsec);
      await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true');

      console.log('[SecureNsec] Nsec stored securely');
      return true;
    } catch (error) {
      console.error('[SecureNsec] Store error:', error);
      return false;
    }
  },

  /**
   * Get nsec from SecureStore with AsyncStorage fallback for migration
   * Automatically migrates legacy storage to SecureStore
   */
  async getNsec(): Promise<string | null> {
    try {
      // Try SecureStore first (preferred)
      const secureNsec = await SecureStore.getItemAsync(SECURE_NSEC_KEY);
      if (secureNsec && secureNsec.startsWith('nsec1')) {
        return secureNsec;
      }

      // Check migration flag - if true but no SecureStore data, something went wrong
      const migrated = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
      if (migrated === 'true' && !secureNsec) {
        console.warn('[SecureNsec] Migration flag set but no SecureStore data');
      }

      // Fallback: Try legacy plain storage
      console.log('[SecureNsec] Checking legacy AsyncStorage...');
      const plainNsec = await AsyncStorage.getItem(LEGACY_KEYS.NSEC_PLAIN);

      if (plainNsec && plainNsec.startsWith('nsec1')) {
        console.log('[SecureNsec] Found plain nsec, migrating to SecureStore...');
        await this.migrateToSecureStore(plainNsec);
        return plainNsec;
      }

      // Fallback: Try legacy encrypted storage
      const encryptedNsec = await AsyncStorage.getItem(LEGACY_KEYS.NSEC_ENCRYPTED);
      const encryptionKey = await AsyncStorage.getItem(LEGACY_KEYS.ENCRYPTION_KEY);

      if (encryptedNsec && encryptionKey) {
        console.log('[SecureNsec] Found encrypted nsec, decrypting and migrating...');
        const decrypted = decryptLegacyNsec(encryptedNsec, encryptionKey);

        if (decrypted && decrypted.startsWith('nsec1')) {
          await this.migrateToSecureStore(decrypted);
          return decrypted;
        }
      }

      console.log('[SecureNsec] No nsec found in any storage');
      return null;
    } catch (error) {
      console.error('[SecureNsec] Get error:', error);
      return null;
    }
  },

  /**
   * Migrate nsec from AsyncStorage to SecureStore
   * Clears legacy storage after successful migration
   */
  async migrateToSecureStore(nsec: string): Promise<boolean> {
    try {
      // Store in SecureStore
      const stored = await this.storeNsec(nsec);
      if (!stored) {
        console.error('[SecureNsec] Migration failed: Could not store in SecureStore');
        return false;
      }

      // Clear legacy AsyncStorage keys
      await AsyncStorage.multiRemove([
        LEGACY_KEYS.NSEC_PLAIN,
        LEGACY_KEYS.NSEC_ENCRYPTED,
        LEGACY_KEYS.ENCRYPTION_KEY,
      ]);

      console.log('[SecureNsec] Migration complete - legacy storage cleared');
      return true;
    } catch (error) {
      console.error('[SecureNsec] Migration error:', error);
      return false;
    }
  },

  /**
   * Clear nsec from SecureStore
   */
  async clearNsec(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(SECURE_NSEC_KEY);
      await AsyncStorage.removeItem(MIGRATION_FLAG_KEY);

      // Also clear legacy keys in case they still exist
      await AsyncStorage.multiRemove([
        LEGACY_KEYS.NSEC_PLAIN,
        LEGACY_KEYS.NSEC_ENCRYPTED,
        LEGACY_KEYS.ENCRYPTION_KEY,
      ]);

      console.log('[SecureNsec] Cleared nsec from all storage');
    } catch (error) {
      console.error('[SecureNsec] Clear error:', error);
    }
  },

  /**
   * Check if nsec exists in SecureStore
   */
  async hasNsec(): Promise<boolean> {
    try {
      const nsec = await SecureStore.getItemAsync(SECURE_NSEC_KEY);
      return !!nsec && nsec.startsWith('nsec1');
    } catch (error) {
      console.error('[SecureNsec] Has check error:', error);
      return false;
    }
  },

  /**
   * Check if migration has been completed
   */
  async isMigrated(): Promise<boolean> {
    try {
      const flag = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
      return flag === 'true';
    } catch (error) {
      return false;
    }
  },
};

export default SecureNsecStorage;
