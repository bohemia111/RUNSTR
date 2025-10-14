/**
 * RewardSenderWallet - Dedicated wallet for sending automated rewards
 * Uses Alby SDK's NWCClient with REWARD_SENDER_NWC from environment
 *
 * This service maintains a separate Lightning wallet connection specifically
 * for sending rewards, isolated from user wallets.
 */

import { nwc } from '@getalby/sdk';
import { REWARD_CONFIG } from '../../config/rewards';

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

/**
 * Service for automated reward payments using NWC
 * Maintains a persistent connection to the reward sender's Lightning wallet
 */
class RewardSenderWalletClass {
  private nwcClient: nwc.NWCClient | null = null;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Initialize NWC client with reward sender connection string
   * Lazy initialization on first use
   */
  private async initialize(): Promise<void> {
    // Return existing initialization if in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start new initialization
    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      const nwcUrl = REWARD_CONFIG.SENDER_NWC;

      // Validate NWC URL
      if (!nwcUrl || nwcUrl === 'nostr+walletconnect://YOUR_NWC_STRING_HERE') {
        throw new Error('REWARD_SENDER_NWC not configured in environment');
      }

      console.log('[RewardWallet] Initializing NWC client...');

      // Create NWC client with reward sender credentials
      this.nwcClient = new nwc.NWCClient({
        nostrWalletConnectUrl: nwcUrl,
      });

      // Test connection
      const info = await this.nwcClient.getInfo();
      console.log('[RewardWallet] ✅ Connected to reward wallet:', {
        alias: info.alias || 'Unknown',
        methods: info.methods?.slice(0, 3) || [],
      });
    } catch (error) {
      console.error('[RewardWallet] ❌ Initialization failed:', error);
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
        return {
          success: false,
          error: 'Reward wallet not initialized',
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
        return {
          success: true,
          preimage: response.preimage,
        };
      }

      return {
        success: false,
        error: 'Payment failed - no preimage returned',
      };
    } catch (error) {
      console.error('[RewardWallet] ❌ Payment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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

      // Try to get info to verify connection
      const info = await this.nwcClient.getInfo();
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
   * Create an invoice (for receiving payments, not typically used for rewards)
   * Included for completeness
   */
  async createInvoice(
    amountSats: number,
    description?: string
  ): Promise<{ success: boolean; invoice?: string; error?: string }> {
    try {
      await this.initialize();

      if (!this.nwcClient) {
        return {
          success: false,
          error: 'Reward wallet not initialized',
        };
      }

      const response = await this.nwcClient.makeInvoice({
        amount: amountSats,
        description: description || 'RUNSTR Reward',
      });

      if (response.invoice) {
        return {
          success: true,
          invoice: response.invoice,
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
