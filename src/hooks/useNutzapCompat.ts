/**
 * useNutzapCompat Hook - Compatibility wrapper for migrating from NutZap to NWC
 * Maps the useNutzap interface to useNWCZap for backward compatibility
 * Allows gradual migration of components from NutZap to NWC
 */

import { useCallback } from 'react';
import { useNWCZap } from './useNWCZap';
import { npubToHex } from '../utils/ndkConversion';

interface UseNutzapCompatReturn {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  balance: number;
  userPubkey: string;
  error: string | null;

  // Actions
  sendNutzap: (recipientPubkey: string, amount: number, memo?: string) => Promise<boolean>;
  claimNutzaps: () => Promise<{ claimed: number; total: number }>;
  refreshBalance: () => Promise<void>;
  clearWallet: () => Promise<void>;
}

/**
 * Compatibility hook that maps NutZap interface to NWC implementation
 * Drop-in replacement for useNutzap hook
 */
export const useNutzapCompat = (autoInitialize: boolean = true): UseNutzapCompatReturn => {
  const {
    isInitialized,
    isLoading,
    balance,
    hasWallet,
    error,
    sendZap,
    refreshBalance
  } = useNWCZap();

  /**
   * Send payment using NWC (replaces NutZap send)
   * Maps to Lightning address payments via NWC
   */
  const sendNutzap = useCallback(async (
    recipientPubkey: string,
    amount: number,
    memo?: string
  ): Promise<boolean> => {
    if (!isInitialized || !hasWallet) {
      console.warn('[useNutzapCompat] Wallet not ready for sending');
      return false;
    }

    try {
      // Normalize recipient pubkey to hex format
      const recipientHex = npubToHex(recipientPubkey) || recipientPubkey;

      // Use NWC to send to Lightning address
      const result = await sendZap(recipientHex, amount, memo || 'Zap from RUNSTR');

      if (result) {
        console.log(`[useNutzapCompat] Sent ${amount} sats via NWC`);
        return true;
      }

      return false;
    } catch (err) {
      console.error('[useNutzapCompat] Send error:', err);
      return false;
    }
  }, [isInitialized, hasWallet, sendZap]);

  /**
   * Claim incoming payments (no-op for NWC)
   * NWC doesn't have a claim mechanism like NutZap
   */
  const claimNutzaps = useCallback(async (): Promise<{ claimed: number; total: number }> => {
    console.log('[useNutzapCompat] Claim called - no-op for NWC');
    // NWC doesn't need claiming - payments are received directly
    return { claimed: 0, total: 0 };
  }, []);

  /**
   * Clear wallet (no-op for NWC)
   * NWC wallets are external and managed separately
   */
  const clearWallet = useCallback(async () => {
    console.log('[useNutzapCompat] Clear wallet called - no-op for NWC');
    // NWC doesn't store local wallet data to clear
  }, []);

  // Get user pubkey (hardcoded for now - should come from user store)
  const getUserPubkey = (): string => {
    // TODO: Get this from user store or auth context
    return '';
  };

  return {
    // State
    isInitialized: isInitialized && hasWallet,
    isLoading,
    balance,
    userPubkey: getUserPubkey(),
    error,

    // Actions
    sendNutzap,
    claimNutzaps,
    refreshBalance,
    clearWallet,
  };
};