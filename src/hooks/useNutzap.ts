/**
 * useNutzap Hook - MIGRATED TO NWC
 * This hook now uses NWC (Nostr Wallet Connect) instead of NutZap
 * Provides backward compatibility for existing components
 *
 * @deprecated Use useNWCZap directly for new components
 */

import { useNutzapCompat } from './useNutzapCompat';

interface UseNutzapReturn {
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
 * @deprecated Use useNWCZap directly for new components
 * This is now a wrapper that redirects to NWC implementation
 */
export const useNutzap = (autoInitialize: boolean = true): UseNutzapReturn => {
  console.log('[useNutzap] Using NWC compatibility layer');
  return useNutzapCompat(autoInitialize);
};