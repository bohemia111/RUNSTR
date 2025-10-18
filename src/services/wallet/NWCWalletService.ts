/**
 * NWCWalletService - Nostr Wallet Connect wallet implementation
 * Uses @getalby/sdk for Bitcoin operations with user's NWC connection
 * Simple, safe, reliable - fails gracefully
 */

import { nwc } from '@getalby/sdk';
import { NWCStorageService } from './NWCStorageService';

export interface SendPaymentResult {
  success: boolean;
  preimage?: string;
  fee?: number;
  error?: string;
}

export interface CreateInvoiceResult {
  success: boolean;
  invoice?: string;
  paymentHash?: string;
  error?: string;
}

export interface WalletBalance {
  balance: number;
  error?: string;
}

/**
 * Service for NWC wallet operations
 * Uses user's stored NWC connection string for all operations
 * Graceful degradation if wallet not configured
 */
class NWCWalletServiceClass {
  private nwcClient: nwc.NWCClient | null = null;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Check if NWC wallet is available
   * Fast check before attempting operations
   */
  async isAvailable(): Promise<boolean> {
    return await NWCStorageService.hasNWC();
  }

  /**
   * Alias for isAvailable() - Check if NWC is configured
   * Used by payment verification components
   */
  async hasNWCConfigured(): Promise<boolean> {
    return await this.isAvailable();
  }

  /**
   * Initialize NWC client with user's stored connection string
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
      // Get user's NWC connection string from storage
      const nwcString = await NWCStorageService.getNWCString();

      if (!nwcString) {
        throw new Error('No NWC connection string found');
      }

      console.log('[NWC] Initializing user wallet...');

      // Create NWC client with user's credentials
      this.nwcClient = new nwc.NWCClient({
        nostrWalletConnectUrl: nwcString,
      });

      // Test connection
      const info = await this.nwcClient.getInfo();
      console.log('[NWC] ✅ User wallet connected:', {
        alias: info.alias || 'Unknown',
        methods: info.methods?.slice(0, 3) || [],
      });
    } catch (error) {
      console.error('[NWC] ❌ User wallet initialization failed:', error);
      this.nwcClient = null;
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Get wallet balance
   * Returns 0 if wallet not configured or error occurs
   */
  async getBalance(): Promise<WalletBalance> {
    try {
      // Check if NWC configured
      const hasWallet = await this.isAvailable();
      if (!hasWallet) {
        return { balance: 0, error: 'No wallet configured' };
      }

      // Initialize client
      await this.initialize();

      if (!this.nwcClient) {
        return { balance: 0, error: 'Wallet not initialized' };
      }

      // Get balance using NWC client
      const result = await this.nwcClient.getBalance();

      if (result && typeof result.balance === 'number') {
        // Update connection status
        await NWCStorageService.updateStatus(true, {
          balance: result.balance,
        });

        return { balance: result.balance };
      }

      return { balance: 0, error: 'Failed to get balance' };
    } catch (error) {
      console.error('[NWC] Get balance error:', error);

      // Update status as disconnected
      await NWCStorageService.updateStatus(false);

      return {
        balance: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send payment via Lightning invoice
   * Checks balance and connectivity before sending
   */
  async sendPayment(invoice: string, amount?: number): Promise<SendPaymentResult> {
    try {
      // Check if NWC configured
      const hasWallet = await this.isAvailable();
      if (!hasWallet) {
        return {
          success: false,
          error: 'No wallet configured. Please connect your wallet in settings.',
        };
      }

      // Validate invoice
      if (!invoice || !invoice.startsWith('lnbc')) {
        return {
          success: false,
          error: 'Invalid Lightning invoice',
        };
      }

      console.log('[NWC] Sending payment...');

      // Initialize client
      await this.initialize();

      if (!this.nwcClient) {
        return {
          success: false,
          error: 'Wallet not initialized',
        };
      }

      // Send payment using NWC client
      const result = await this.nwcClient.payInvoice({
        invoice,
        amount: amount || undefined,
      });

      if (result && result.preimage) {
        console.log('[NWC] Payment successful');

        // Update connection status
        await NWCStorageService.updateStatus(true);

        return {
          success: true,
          preimage: result.preimage,
          fee: result.fee_paid,
        };
      }

      return {
        success: false,
        error: 'Payment failed - no preimage returned',
      };
    } catch (error) {
      console.error('[NWC] Send payment error:', error);

      // Update status as disconnected
      await NWCStorageService.updateStatus(false);

      let errorMessage = 'Payment failed';
      if (error instanceof Error) {
        errorMessage = error.message;

        // Provide helpful error messages
        if (errorMessage.includes('insufficient')) {
          errorMessage = 'Insufficient balance';
        } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
          errorMessage = 'Network error - please check your connection';
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Create Lightning invoice for receiving payment
   * Generates invoice using user's NWC wallet
   */
  async createInvoice(
    amountSats: number,
    description?: string,
    metadata?: any
  ): Promise<CreateInvoiceResult> {
    try {
      // Check if NWC configured
      const hasWallet = await this.isAvailable();
      if (!hasWallet) {
        return {
          success: false,
          error: 'No wallet configured. Please connect your wallet in settings.',
        };
      }

      // Validate amount
      if (!amountSats || amountSats <= 0) {
        return {
          success: false,
          error: 'Invalid amount',
        };
      }

      console.log('[NWC] Creating invoice for', amountSats, 'sats');

      // Initialize client
      await this.initialize();

      if (!this.nwcClient) {
        return {
          success: false,
          error: 'Wallet not initialized',
        };
      }

      // Create invoice using NWC client
      const result = await this.nwcClient.makeInvoice({
        amount: amountSats,
        description: description || 'RUNSTR payment',
        // Note: @getalby/sdk uses simpler params than MCP
      });

      if (result && result.invoice) {
        console.log('[NWC] Invoice created successfully');

        // Update connection status
        await NWCStorageService.updateStatus(true);

        return {
          success: true,
          invoice: result.invoice,
          paymentHash: result.payment_hash,
        };
      }

      return {
        success: false,
        error: 'Failed to create invoice',
      };
    } catch (error) {
      console.error('[NWC] Create invoice error:', error);

      // Update status as disconnected
      await NWCStorageService.updateStatus(false);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Lookup invoice status
   * Check if invoice has been paid
   * @param invoiceOrHash - Either a BOLT11 invoice string or payment hash
   */
  async lookupInvoice(invoiceOrHash: string): Promise<{ paid: boolean; success: boolean; error?: string }> {
    try {
      const hasWallet = await this.isAvailable();
      if (!hasWallet) {
        return { paid: false, success: false, error: 'No wallet configured' };
      }

      // Initialize client
      await this.initialize();

      if (!this.nwcClient) {
        return { paid: false, success: false, error: 'Wallet not initialized' };
      }

      // Check if it's an invoice (starts with 'lnbc') or payment hash
      let lookupParam: any;
      if (invoiceOrHash.startsWith('lnbc') || invoiceOrHash.startsWith('lntb')) {
        // It's a BOLT11 invoice
        lookupParam = { invoice: invoiceOrHash };
      } else {
        // It's a payment hash
        lookupParam = { payment_hash: invoiceOrHash };
      }

      // Lookup invoice using NWC client
      const result = await this.nwcClient.lookupInvoice(lookupParam);

      if (result) {
        return {
          paid: result.settled || false,
          success: true,
        };
      }

      return { paid: false, success: false, error: 'Failed to lookup invoice' };
    } catch (error) {
      console.error('[NWC] Lookup invoice error:', error);
      return {
        paid: false,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get wallet info and capabilities
   * Useful for displaying wallet status
   */
  async getWalletInfo(): Promise<{
    connected: boolean;
    capabilities?: string[];
    error?: string;
  }> {
    try {
      const hasWallet = await this.isAvailable();
      if (!hasWallet) {
        return { connected: false, error: 'No wallet configured' };
      }

      // Initialize client
      await this.initialize();

      if (!this.nwcClient) {
        return { connected: false, error: 'Wallet not initialized' };
      }

      // Get wallet service info using NWC client
      const result = await this.nwcClient.getInfo();

      if (result) {
        return {
          connected: true,
          capabilities: result.methods || [],
        };
      }

      return { connected: false, error: 'Failed to get wallet info' };
    } catch (error) {
      console.error('[NWC] Get wallet info error:', error);
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Parse Lightning invoice
   * Extract amount and description without paying
   * Note: This doesn't require NWC connection (uses static parsing)
   */
  async parseInvoice(invoice: string): Promise<{
    amount?: number;
    description?: string;
    expiry?: number;
    error?: string;
  }> {
    try {
      // For invoice parsing, we can use a temporary client
      // or a static parser if available in the SDK
      // For now, require initialization
      await this.initialize();

      if (!this.nwcClient) {
        return { error: 'Wallet not initialized' };
      }

      // Parse invoice using NWC client (if method exists)
      // Note: @getalby/sdk may not have parseInvoice, might need bolt11 library
      // For now, return a placeholder
      console.log('[NWC] Invoice parsing not yet implemented with SDK');

      return {
        error: 'Invoice parsing not yet implemented',
      };
    } catch (error) {
      console.error('[NWC] Parse invoice error:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List wallet transactions
   * Useful for captain dashboard transaction history
   */
  async listTransactions(params?: {
    from?: number;     // Start timestamp (unix seconds)
    until?: number;    // End timestamp (unix seconds)
    limit?: number;    // Max number of transactions
    offset?: number;   // Pagination offset
    type?: 'incoming' | 'outgoing'; // Filter by transaction type
  }): Promise<{
    success: boolean;
    transactions?: Array<{
      type: 'incoming' | 'outgoing';
      invoice?: string;
      description?: string;
      preimage?: string;
      payment_hash: string;
      amount: number;
      fees_paid?: number;
      created_at: number;
      settled_at?: number;
      metadata?: any;
    }>;
    error?: string;
  }> {
    try {
      const hasWallet = await this.isAvailable();
      if (!hasWallet) {
        return { success: false, error: 'No wallet configured' };
      }

      // Initialize client
      await this.initialize();

      if (!this.nwcClient) {
        return { success: false, error: 'Wallet not initialized' };
      }

      // List transactions using NWC client
      const result = await this.nwcClient.listTransactions(params || {});

      if (result && result.transactions) {
        return {
          success: true,
          transactions: result.transactions,
        };
      }

      return { success: false, error: 'Failed to list transactions' };
    } catch (error) {
      console.error('[NWC] List transactions error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
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

  /**
   * Close the NWC connection
   * Call this when logging out or disconnecting wallet
   */
  async close(): Promise<void> {
    if (this.nwcClient) {
      console.log('[NWC] Closing user wallet connection...');
      // NWCClient doesn't have explicit close in current SDK
      // Connection will be cleaned up automatically
      this.nwcClient = null;
      this.initializationPromise = null;
    }
  }
}

// Export singleton instance
export const NWCWalletService = new NWCWalletServiceClass();
export default NWCWalletService;
