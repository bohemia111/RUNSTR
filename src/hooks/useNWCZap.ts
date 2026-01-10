/**
 * useNWCZap Hook - Send Bitcoin from NWC wallet to Lightning addresses
 *
 * Payment flow:
 * 1. Captain has NWC wallet configured in app
 * 2. Recipient has Lightning address in their Nostr profile (lud16)
 * 3. Hook requests invoice from Lightning address via LNURL
 * 4. Captain's NWC wallet pays the invoice
 *
 * This replaces NutZap for captain rewards, enabling payments to any Lightning wallet
 */

import { useState, useCallback, useEffect } from 'react';
import { NWCWalletService } from '../services/wallet/NWCWalletService';
import { NWCStorageService } from '../services/wallet/NWCStorageService';
import { ProfileService } from '../services/user/profileService';
import { getInvoiceFromLightningAddress } from '../utils/lnurl';
import { npubToHex } from '../utils/ndkConversion';

interface UseNWCZapReturn {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  balance: number;
  hasWallet: boolean;
  error: string | null;

  // Actions
  sendZap: (
    recipientPubkey: string,
    amount: number,
    memo?: string
  ) => Promise<boolean>;
  refreshBalance: () => Promise<void>;
}

export const useNWCZap = (): UseNWCZapReturn => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [hasWallet, setHasWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize and check wallet status on mount
  // DON'T auto-fetch balance - it blocks UI with NWCClient WebSocket
  useEffect(() => {
    const initializeWallet = async () => {
      try {
        const walletAvailable = await NWCStorageService.hasNWC();
        setHasWallet(walletAvailable);
        // Balance fetched on-demand via refreshBalance() when user triggers action
        setIsInitialized(true);
      } catch (err) {
        console.error('[useNWCZap] Initialization error:', err);
        setIsInitialized(true);
        setError('Failed to initialize wallet');
      }
    };

    initializeWallet();
  }, []);

  /**
   * Send zap to user's Lightning address
   *
   * @param recipientPubkey - Recipient's Nostr pubkey (npub or hex)
   * @param amount - Amount in satoshis
   * @param memo - Optional payment memo
   * @returns Success boolean
   */
  const sendZap = useCallback(
    async (
      recipientPubkey: string,
      amount: number,
      memo?: string
    ): Promise<boolean> => {
      if (!hasWallet) {
        setError(
          'No NWC wallet configured. Please connect your wallet in settings.'
        );
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        let lightningAddress: string;

        // Check if input is already a Lightning address (contains @)
        if (recipientPubkey.includes('@')) {
          // Already a Lightning address - use directly
          lightningAddress = recipientPubkey;
          console.log('[useNWCZap] Using provided Lightning address:', lightningAddress);
        } else {
          // It's a pubkey - look up profile to get Lightning address
          const recipientHex = npubToHex(recipientPubkey) || recipientPubkey;

          console.log(
            '[useNWCZap] Getting recipient Lightning address for:',
            recipientHex.slice(0, 8) + '...'
          );

          // Get recipient's profile to extract Lightning address
          const recipientProfile = await ProfileService.getUserProfile(
            recipientHex
          );

          if (!recipientProfile || !recipientProfile.lud16) {
            setError('Recipient has no Lightning address in their profile');
            setIsLoading(false);
            return false;
          }

          lightningAddress = recipientProfile.lud16;
          console.log('[useNWCZap] Found Lightning address:', lightningAddress);
        }

        // Request invoice from Lightning address via LNURL
        console.log('[useNWCZap] Requesting invoice for', amount, 'sats');
        const { invoice } = await getInvoiceFromLightningAddress(
          lightningAddress,
          amount,
          memo || `Zap from RUNSTR captain`
        );

        if (!invoice) {
          setError('Failed to get invoice from Lightning address');
          setIsLoading(false);
          return false;
        }

        console.log('[useNWCZap] Got invoice, sending payment...');

        // Pay invoice using captain's NWC wallet
        const paymentResult = await NWCWalletService.sendPayment(invoice);

        if (paymentResult.success) {
          console.log('[useNWCZap] ✅ Payment successful!');

          // Update balance
          const newBalance = await NWCWalletService.getBalance();
          setBalance(newBalance.balance);

          setIsLoading(false);
          return true;
        } else {
          setError(paymentResult.error || 'Payment failed');
          setIsLoading(false);
          return false;
        }
      } catch (err) {
        console.error('[useNWCZap] Send error:', err);

        let errorMessage = 'Failed to send payment';
        if (err instanceof Error) {
          if (err.message.includes('timeout')) {
            errorMessage =
              'Request timed out. Lightning address may be offline.';
          } else if (err.message.includes('Invalid Lightning address')) {
            errorMessage = 'Invalid Lightning address format';
          } else if (err.message.includes('Amount too')) {
            errorMessage = err.message; // Min/max amount errors
          } else {
            errorMessage = err.message;
          }
        }

        setError(errorMessage);
        setIsLoading(false);
        return false;
      }
    },
    [hasWallet]
  );

  /**
   * Refresh wallet balance
   */
  const refreshBalance = useCallback(async () => {
    if (!hasWallet) return;

    try {
      const walletBalance = await NWCWalletService.getBalance();
      setBalance(walletBalance.balance);
    } catch (err) {
      console.error('[useNWCZap] Balance refresh error:', err);
    }
  }, [hasWallet]);

  return {
    // State
    isInitialized,
    isLoading,
    balance,
    hasWallet,
    error,

    // Actions
    sendZap,
    refreshBalance,
  };
};
