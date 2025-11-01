/**
 * NWCStorageService - Manages Nostr Wallet Connect connection strings
 * Handles storage, validation, and connection testing
 * Uses SecureStore for hardware-backed encryption
 * Simple, safe, and reliable - fails gracefully
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NWCClient } from '@getalby/sdk';

// SecureStore has key length limits, use shorter keys
const SECURE_KEYS = {
  NWC_STRING: 'nwc_string', // The sensitive NWC connection string
} as const;

// Non-sensitive data can stay in AsyncStorage
const STORAGE_KEYS = {
  NWC_STATUS: '@runstr:nwc_status',
  LAST_CONNECTION_TEST: '@runstr:nwc_last_test',
} as const;

export interface NWCStatus {
  connected: boolean;
  lastTested: number;
  walletInfo?: {
    balance: number;
    alias?: string;
  };
}

/**
 * Service for managing NWC connection strings
 * All operations fail gracefully - app continues to work without NWC
 */
class NWCStorageServiceClass {
  /**
   * Migrate existing NWC from AsyncStorage to SecureStore
   * Called automatically on first access
   */
  private async migrateFromAsyncStorage(): Promise<void> {
    try {
      // Check if we have an old NWC string in AsyncStorage
      const oldKey = '@runstr:nwc_string';
      const oldNwcString = await AsyncStorage.getItem(oldKey);

      if (oldNwcString) {
        console.log('[NWC] Migrating from AsyncStorage to SecureStore...');

        // Save to SecureStore
        await SecureStore.setItemAsync(SECURE_KEYS.NWC_STRING, oldNwcString);

        // Remove from AsyncStorage
        await AsyncStorage.removeItem(oldKey);

        console.log('[NWC] Migration completed successfully');
      }
    } catch (error) {
      console.error('[NWC] Migration failed:', error);
      // Continue without migration - don't break the app
    }
  }
  /**
   * Validate NWC connection string format
   * Checks basic format without network calls
   */
  validateFormat(nwcString: string): boolean {
    try {
      // Basic format validation
      if (!nwcString || typeof nwcString !== 'string') {
        return false;
      }

      // Must start with correct protocol
      if (!nwcString.startsWith('nostr+walletconnect://')) {
        return false;
      }

      // Must be reasonable length (avoid empty or malformed strings)
      if (nwcString.length < 50) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('[NWC] Format validation error:', error);
      return false;
    }
  }

  /**
   * Test NWC connection using Alby SDK
   * Returns true if connection works, false otherwise
   */
  async testConnection(nwcString: string): Promise<boolean> {
    let testClient: NWCClient | null = null;

    try {
      // Format check first
      if (!this.validateFormat(nwcString)) {
        console.log('[NWC] Invalid format, skipping connection test');
        return false;
      }

      console.log('[NWC] Testing connection with Alby SDK...');

      // Create temporary NWC client
      testClient = new NWCClient({
        nostrWalletConnectUrl: nwcString,
      });

      // Test connection with 15-second timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection test timeout')), 15000)
      );

      const infoPromise = testClient.getInfo();
      const info = await Promise.race([infoPromise, timeoutPromise]);

      console.log('[NWC] Connection test successful:', {
        alias: info.alias || 'Unknown',
        methods: info.methods?.slice(0, 3) || [],
      });

      return true;
    } catch (error) {
      console.error('[NWC] Connection test failed:', error);
      return false;
    } finally {
      // Clean up test client connection
      if (testClient) {
        try {
          // Only close if relay is connected (prevents closing half-initialized connections)
          if (testClient.relay && testClient.connected) {
            testClient.close();
          }
        } catch (closeError) {
          // Ignore close errors - connection cleanup is best-effort
          console.warn('[NWC] Test client close warning:', closeError);
        }
      }
    }
  }

  /**
   * Save NWC connection string
   * Validates format and saves directly to SecureStore
   * Connection test happens when wallet is actually used
   */
  async saveNWCString(
    nwcString: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[NWC] Attempting to save connection string');

      // Validate format only
      if (!this.validateFormat(nwcString)) {
        return {
          success: false,
          error: 'Invalid NWC format. Must start with nostr+walletconnect://',
        };
      }

      // Save directly to SecureStore (hardware-backed encryption)
      await SecureStore.setItemAsync(SECURE_KEYS.NWC_STRING, nwcString);

      // Save connection status
      const status: NWCStatus = {
        connected: true,
        lastTested: Date.now(),
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS.NWC_STATUS,
        JSON.stringify(status)
      );

      console.log('[NWC] Connection string saved successfully');
      return { success: true };
    } catch (error) {
      console.error('[NWC] Save failed:', error);
      return {
        success: false,
        error: 'Failed to save connection string',
      };
    }
  }

  /**
   * Get stored NWC connection string
   * Returns null if not configured
   */
  async getNWCString(): Promise<string | null> {
    try {
      // Check for migration on first access
      await this.migrateFromAsyncStorage();

      const nwcString = await SecureStore.getItemAsync(SECURE_KEYS.NWC_STRING);
      return nwcString;
    } catch (error) {
      console.error('[NWC] Failed to get connection string:', error);
      return null;
    }
  }

  /**
   * Check if user has NWC configured
   * Fast check for gating Bitcoin features
   */
  async hasNWC(): Promise<boolean> {
    try {
      const nwcString = await this.getNWCString();
      return nwcString !== null && nwcString.length > 0;
    } catch (error) {
      console.error('[NWC] Has NWC check failed:', error);
      return false;
    }
  }

  /**
   * Get connection status
   * Returns cached status with last test time
   */
  async getStatus(): Promise<NWCStatus> {
    try {
      const statusStr = await AsyncStorage.getItem(STORAGE_KEYS.NWC_STATUS);
      if (!statusStr) {
        return { connected: false, lastTested: 0 };
      }

      const status: NWCStatus = JSON.parse(statusStr);
      return status;
    } catch (error) {
      console.error('[NWC] Get status failed:', error);
      return { connected: false, lastTested: 0 };
    }
  }

  /**
   * Update connection status
   * Call this after successful/failed operations
   */
  async updateStatus(
    connected: boolean,
    walletInfo?: { balance: number; alias?: string }
  ): Promise<void> {
    try {
      const status: NWCStatus = {
        connected,
        lastTested: Date.now(),
        walletInfo,
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS.NWC_STATUS,
        JSON.stringify(status)
      );
    } catch (error) {
      console.error('[NWC] Update status failed:', error);
    }
  }

  /**
   * Clear NWC configuration
   * Used for wallet disconnection or logout
   */
  async clearNWC(): Promise<void> {
    try {
      // Remove from SecureStore
      await SecureStore.deleteItemAsync(SECURE_KEYS.NWC_STRING);

      // Remove status from AsyncStorage
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.NWC_STATUS,
        STORAGE_KEYS.LAST_CONNECTION_TEST,
      ]);
      console.log('[NWC] Connection string cleared');
    } catch (error) {
      console.error('[NWC] Clear failed:', error);
    }
  }

  /**
   * Refresh connection test
   * Call periodically to ensure wallet is still connected
   */
  async refreshConnection(): Promise<boolean> {
    try {
      const nwcString = await this.getNWCString();
      if (!nwcString) {
        await this.updateStatus(false);
        return false;
      }

      const isConnected = await this.testConnection(nwcString);
      await this.updateStatus(isConnected);

      return isConnected;
    } catch (error) {
      console.error('[NWC] Refresh connection failed:', error);
      await this.updateStatus(false);
      return false;
    }
  }
}

// Export singleton instance
export const NWCStorageService = new NWCStorageServiceClass();
export default NWCStorageService;
