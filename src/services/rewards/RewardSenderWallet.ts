/**
 * RewardSenderWallet - Dedicated wallet for sending automated rewards
 * Uses Alby SDK's NWCClient with REWARD_SENDER_NWC from environment
 *
 * This service maintains a separate Lightning wallet connection specifically
 * for sending rewards, isolated from user wallets.
 */

import { NWCClient } from '@getalby/sdk';
import { REWARD_CONFIG } from '../../config/rewards';
import { decryptRewardNWC, isEncryptedNWCConfigured } from '../../utils/nwcDecryptor';
import { withTimeout } from '../../utils/nostrTimeout';

// Timeout for NWC connection test (10 seconds)
const NWC_CONNECT_TIMEOUT = 10000;

export interface RewardPaymentResult {
  success: boolean;
  preimage?: string;
  error?: string;
}

export interface WalletHealthStatus {
  connected: boolean;
  balance?: number;
  error?: string;
}

// Diagnostic entry for debugging reward wallet issues
export interface WalletDiagnosticEntry {
  timestamp: number;
  operation: 'init' | 'payment' | 'invoice' | 'balance' | 'health';
  success: boolean;
  error?: string;
  details?: string;
}

// Maximum number of diagnostic entries to keep
const MAX_DIAGNOSTIC_ENTRIES = 50;

/**
 * Service for automated reward payments using NWC
 * Maintains a persistent connection to the reward sender's Lightning wallet
 */
class RewardSenderWalletClass {
  private nwcClient: NWCClient | null = null;
  private initializationPromise: Promise<void> | null = null;
  private lastInitError: string | null = null;
  private diagnosticLog: WalletDiagnosticEntry[] = [];

  /**
   * Add a diagnostic entry to the log
   * Keeps only the most recent MAX_DIAGNOSTIC_ENTRIES entries
   */
  private addDiagnostic(
    operation: WalletDiagnosticEntry['operation'],
    success: boolean,
    error?: string,
    details?: string
  ): void {
    this.diagnosticLog.push({
      timestamp: Date.now(),
      operation,
      success,
      error,
      details,
    });

    // Keep only recent entries
    if (this.diagnosticLog.length > MAX_DIAGNOSTIC_ENTRIES) {
      this.diagnosticLog = this.diagnosticLog.slice(-MAX_DIAGNOSTIC_ENTRIES);
    }
  }

  /**
   * Get diagnostic log for debugging in Settings
   * Returns recent operations with timestamps and errors
   */
  getDiagnostics(): WalletDiagnosticEntry[] {
    return [...this.diagnosticLog];
  }

  /**
   * Get last error for quick status check
   */
  getLastError(): string | null {
    return this.lastInitError;
  }

  /**
   * Check if wallet is initialized
   */
  isInitialized(): boolean {
    return this.nwcClient !== null;
  }

  /**
   * Initialize NWC client with reward sender connection string
   * Lazy initialization on first use
   */
  private async initialize(): Promise<void> {
    // Return existing initialization if in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start new initialization with total timeout protection (20 seconds max)
    this.initializationPromise = withTimeout(
      this._doInitialize(),
      20000,
      'NWC total initialization'
    ).catch((error) => {
      // Reset promise on failure so next attempt starts fresh
      this.initializationPromise = null;
      throw error;
    });
    return this.initializationPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      // Clear any previous error
      this.lastInitError = null;

      let nwcUrl: string | null = null;

      // Priority 1: Try encrypted NWC (most secure)
      if (isEncryptedNWCConfigured()) {
        console.log('[RewardWallet] Decrypting NWC from ENCRYPTED_REWARD_NWC...');
        nwcUrl = decryptRewardNWC();
        if (nwcUrl) {
          console.log('[RewardWallet] ✅ NWC decrypted successfully');
        } else {
          console.warn('[RewardWallet] ⚠️ Decryption failed, trying fallback...');
        }
      }

      // Priority 2: Fallback to plaintext config (for dev/testing)
      if (!nwcUrl) {
        nwcUrl = REWARD_CONFIG.SENDER_NWC;
        if (nwcUrl && nwcUrl !== 'nostr+walletconnect://YOUR_NWC_STRING_HERE') {
          console.log('[RewardWallet] Using plaintext NWC from config (dev mode)');
        }
      }

      // Log NWC info for debugging
      if (nwcUrl && nwcUrl !== 'nostr+walletconnect://YOUR_NWC_STRING_HERE') {
        console.log('[RewardWallet] NWC URL preview:', nwcUrl.slice(0, 60) + '...');
        try {
          const url = new URL(nwcUrl);
          console.log('[RewardWallet] Relay:', url.searchParams.get('relay'));
        } catch (e) {
          console.log('[RewardWallet] Could not parse NWC URL');
        }
      }

      // Validate NWC URL
      if (!nwcUrl || nwcUrl === 'nostr+walletconnect://YOUR_NWC_STRING_HERE') {
        const error = 'REWARD_SENDER_NWC not configured - run npm run prebuild:secrets';
        this.lastInitError = error;
        throw new Error(error);
      }

      console.log('[RewardWallet] Initializing NWC client...');

      // Create NWC client with reward sender credentials
      // NWCClient constructor can hang if relay is slow
      try {
        this.nwcClient = new NWCClient({
          nostrWalletConnectUrl: nwcUrl,
        });
        console.log('[RewardWallet] NWC client created');
      } catch (clientError) {
        console.error('[RewardWallet] ❌ NWC client creation failed:', clientError);
        throw clientError;
      }

      // Test connection WITH TIMEOUT PROTECTION
      // This prevents indefinite hangs if relay is unresponsive
      console.log('[RewardWallet] Testing connection...');
      const info = await withTimeout(
        this.nwcClient.getInfo(),
        NWC_CONNECT_TIMEOUT,
        'NWC getInfo'
      );
      console.log('[RewardWallet] ✅ Connected to reward wallet:', {
        alias: info.alias || 'Unknown',
        methods: info.methods?.slice(0, 3) || [],
      });

      // Log successful initialization
      this.addDiagnostic('init', true, undefined, `Connected: ${info.alias || 'Unknown'}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown initialization error';
      this.lastInitError = errorMsg;
      console.error('[RewardWallet] ❌ Initialization failed:', errorMsg);

      // Log failed initialization
      this.addDiagnostic('init', false, errorMsg);

      this.nwcClient = null;
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Send a reward payment by paying a Lightning invoice
   *
   * @param invoice - BOLT11 Lightning invoice to pay
   * @param amountSats - Optional amount if invoice is zero-amount
   * @returns Payment result with preimage on success
   */
  async sendRewardPayment(
    invoice: string,
    amountSats?: number
  ): Promise<RewardPaymentResult> {
    try {
      // Ensure initialized
      await this.initialize();

      if (!this.nwcClient) {
        const error = this.lastInitError || 'Reward wallet not initialized';
        this.addDiagnostic('payment', false, error, 'Client not initialized');
        return {
          success: false,
          error,
        };
      }

      console.log('[RewardWallet] Sending reward payment...', {
        invoice: invoice.slice(0, 20) + '...',
        amount: amountSats,
      });

      // Send payment via NWC
      const response = await this.nwcClient.payInvoice({
        invoice,
        amount: amountSats,
      });

      if (response.preimage) {
        console.log('[RewardWallet] ✅ Payment successful');
        this.addDiagnostic('payment', true, undefined, `Paid: ${amountSats || 'invoice amount'} sats`);
        return {
          success: true,
          preimage: response.preimage,
        };
      }

      const error = 'Payment failed - no preimage returned';
      this.addDiagnostic('payment', false, error);
      return {
        success: false,
        error,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[RewardWallet] ❌ Payment error:', error);
      this.addDiagnostic('payment', false, errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Get the balance of the reward sender wallet
   * Useful for monitoring if the wallet needs to be topped up
   */
  async getBalance(): Promise<number> {
    try {
      await this.initialize();

      if (!this.nwcClient) {
        console.warn('[RewardWallet] Cannot get balance - not initialized');
        return 0;
      }

      const response = await this.nwcClient.getBalance();
      const balance = response.balance || 0;

      console.log('[RewardWallet] Current balance:', balance, 'sats');
      return balance;
    } catch (error) {
      console.error('[RewardWallet] Error getting balance:', error);
      return 0;
    }
  }

  /**
   * Health check for the reward wallet
   * Returns connection status and balance
   */
  async healthCheck(): Promise<WalletHealthStatus> {
    try {
      await this.initialize();

      if (!this.nwcClient) {
        return {
          connected: false,
          error: 'Not initialized',
        };
      }

      // Try to get info to verify connection (throws if disconnected)
      await this.nwcClient.getInfo();
      const balance = await this.getBalance();

      return {
        connected: true,
        balance,
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }

  /**
   * Create an invoice for receiving payments
   * Returns invoice string and payment hash for verification polling
   */
  async createInvoice(
    amountSats: number,
    description?: string
  ): Promise<{ success: boolean; invoice?: string; paymentHash?: string; error?: string }> {
    try {
      await this.initialize();

      if (!this.nwcClient) {
        return {
          success: false,
          error: 'Reward wallet not initialized',
        };
      }

      // NIP-47 makeInvoice expects amount in millisatoshis
      const amountMsats = amountSats * 1000;
      const response = await this.nwcClient.makeInvoice({
        amount: amountMsats,
        description: description || 'RUNSTR Reward',
      });

      if (response.invoice) {
        console.log('[RewardWallet] Invoice created:', {
          amount: amountSats,
          paymentHash: response.payment_hash?.slice(0, 16) + '...',
        });
        return {
          success: true,
          invoice: response.invoice,
          paymentHash: response.payment_hash,
        };
      }

      return {
        success: false,
        error: 'Failed to create invoice',
      };
    } catch (error) {
      console.error('[RewardWallet] Error creating invoice:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Look up an invoice by payment hash to check if it's been paid
   * Used for polling payment verification
   */
  async lookupInvoice(paymentHash: string): Promise<{
    settled: boolean;
    settledAt?: number;
    amount?: number;
    error?: string;
  }> {
    try {
      await this.initialize();

      if (!this.nwcClient) {
        return {
          settled: false,
          error: 'Reward wallet not initialized',
        };
      }

      console.log('[RewardWallet] Looking up invoice:', paymentHash.slice(0, 16) + '...');

      const response = await this.nwcClient.lookupInvoice({
        payment_hash: paymentHash,
      });

      // Check if invoice is settled by looking at settled_at timestamp
      // NIP-47 spec: settled_at is present and non-zero when invoice is paid
      const isSettled = !!response.settled_at && response.settled_at > 0;

      if (isSettled) {
        console.log('[RewardWallet] ✅ Invoice settled!');
      }

      return {
        settled: isSettled,
        settledAt: response.settled_at,
        amount: response.amount,
      };
    } catch (error) {
      console.error('[RewardWallet] Error looking up invoice:', error);
      return {
        settled: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Close the NWC connection
   * Call this when shutting down the app
   */
  async close(): Promise<void> {
    if (this.nwcClient) {
      console.log('[RewardWallet] Closing connection...');
      // NWCClient doesn't have explicit close in current SDK
      // Connection will be cleaned up automatically
      this.nwcClient = null;
      this.initializationPromise = null;
    }
  }

  /**
   * Force reconnection
   * Useful if connection is lost
   */
  async reconnect(): Promise<void> {
    this.nwcClient = null;
    this.initializationPromise = null;
    await this.initialize();
  }
}

// Export singleton instance
export const RewardSenderWallet = new RewardSenderWalletClass();
export default RewardSenderWallet;
