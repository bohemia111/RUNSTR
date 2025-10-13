/**
 * NWCWalletService - Nostr Wallet Connect wallet implementation
 * Uses Alby MCP tools for Bitcoin operations
 * Simple, safe, reliable - fails gracefully
 */

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
 * All operations check for NWC availability first
 * Graceful degradation if wallet not configured
 */
class NWCWalletServiceClass {
  /**
   * Check if NWC wallet is available
   * Fast check before attempting operations
   */
  async isAvailable(): Promise<boolean> {
    return await NWCStorageService.hasNWC();
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

      // Get balance using Alby MCP
      const result = await mcp__alby__get_balance();

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

      // Send payment using Alby MCP
      const result = await mcp__alby__pay_invoice({
        invoice,
        amount_in_sats: amount || null,
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

      // Create invoice using Alby MCP
      const result = await mcp__alby__make_invoice({
        amount_in_sats: amountSats,
        description: description || 'RUNSTR payment',
        description_hash: null,
        expiry: null,
        metadata: metadata || null,
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
   */
  async lookupInvoice(paymentHash: string): Promise<{ paid: boolean; error?: string }> {
    try {
      const hasWallet = await this.isAvailable();
      if (!hasWallet) {
        return { paid: false, error: 'No wallet configured' };
      }

      // Lookup invoice using Alby MCP
      const result = await mcp__alby__lookup_invoice({
        payment_hash: paymentHash,
        invoice: null,
      });

      if (result) {
        return { paid: result.settled || false };
      }

      return { paid: false, error: 'Failed to lookup invoice' };
    } catch (error) {
      console.error('[NWC] Lookup invoice error:', error);
      return {
        paid: false,
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

      // Get wallet service info using Alby MCP
      const result = await mcp__alby__get_wallet_service_info();

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
   */
  async parseInvoice(invoice: string): Promise<{
    amount?: number;
    description?: string;
    expiry?: number;
    error?: string;
  }> {
    try {
      // Parse invoice using Alby MCP
      const result = await mcp__alby__parse_invoice({ invoice });

      if (result) {
        return {
          amount: result.amount || undefined,
          description: result.description || undefined,
          expiry: result.expiry || undefined,
        };
      }

      return { error: 'Failed to parse invoice' };
    } catch (error) {
      console.error('[NWC] Parse invoice error:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const NWCWalletService = new NWCWalletServiceClass();
export default NWCWalletService;
