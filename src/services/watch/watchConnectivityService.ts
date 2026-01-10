/**
 * Watch Connectivity Service
 * Handles communication between iPhone app and Apple Watch via WatchConnectivity
 */

import { NativeModules, Platform } from 'react-native';
import { getAuthenticationData } from '../../utils/nostrAuth';
import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';

const { WatchConnectivityModule } = NativeModules;

export interface WatchState {
  isPaired: boolean;
  isWatchAppInstalled: boolean;
  isReachable: boolean;
  isSupported: boolean;
}

export interface SyncResult {
  success: boolean;
  error?: string;
}

/**
 * Check if WatchConnectivity is available on this platform
 */
export function isWatchConnectivityAvailable(): boolean {
  return Platform.OS === 'ios' && WatchConnectivityModule != null;
}

/**
 * Get current watch connection state
 */
export async function getWatchState(): Promise<WatchState> {
  if (!isWatchConnectivityAvailable()) {
    return {
      isPaired: false,
      isWatchAppInstalled: false,
      isReachable: false,
      isSupported: false,
    };
  }

  try {
    return await WatchConnectivityModule.getWatchState();
  } catch (error) {
    console.error('[WatchConnectivity] Error getting watch state:', error);
    return {
      isPaired: false,
      isWatchAppInstalled: false,
      isReachable: false,
      isSupported: false,
    };
  }
}

/**
 * Sync user's Nostr credentials to Apple Watch
 * Reads from existing AsyncStorage and transfers via WatchConnectivity
 */
export async function syncCredentialsToWatch(): Promise<SyncResult> {
  if (!isWatchConnectivityAvailable()) {
    return { success: false, error: 'WatchConnectivity not available' };
  }

  // Get authentication data from AsyncStorage
  const authData = await getAuthenticationData();
  if (!authData || !authData.nsec) {
    return {
      success: false,
      error: 'No Nostr credentials found. Please log in first.',
    };
  }

  try {
    // Derive hex keys from nsec using NDK
    const signer = new NDKPrivateKeySigner(authData.nsec);
    const user = await signer.user();

    // Transfer to watch
    await WatchConnectivityModule.syncCredentialsToWatch({
      nsec: authData.nsec,
      npub: authData.npub,
      privateKeyHex: signer.privateKey,
      publicKeyHex: user.pubkey,
    });

    console.log('[WatchConnectivity] Credentials synced to watch successfully');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[WatchConnectivity] Sync failed:', message);
    return { success: false, error: message };
  }
}
