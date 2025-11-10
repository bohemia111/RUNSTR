/**
 * PaymentRouter - Routes payments between NWC and Cashu based on feature flags
 *
 * ARCHITECTURE:
 * - Checks FEATURES.ENABLE_NWC_WALLET flag to determine payment method
 * - Routes to NWCWalletService (user's Lightning wallet)
 * - Falls back to WalletCore (Cashu) if NWC disabled
 * - Provides unified interface for all payment operations
 *
 * USAGE:
 * Replace direct WalletCore calls with PaymentRouter in:
 * - LightningZapService
 * - nutzapService
 * - Any other payment flows
 */

import { FEATURES } from '../../config/features';
import { NWCWalletService } from './NWCWalletService';
// import { WalletCore } from '../nutzap/WalletCore';

export interface PaymentResult {
  success: boolean;
  fee?: number;
  error?: string;
  preimage?: string;
}

export interface InvoiceResult {
  success: boolean;
  invoice?: string;
  paymentHash?: string;
  error?: string;
}

export interface BalanceResult {
  balance: number;
  error?: string;
}

/**
 * Payment Router Service
 * Routes between NWC and Cashu wallets based on feature flags
 */
export class PaymentRouter {
  /**
   * Pay Lightning invoice
   * Routes to NWC if enabled, otherwise Cashu
   */
  static async payInvoice(
    invoice: string,
    amount?: number
  ): Promise<PaymentResult> {
    try {
      console.log('[PaymentRouter] Routing payment...', {
        nwcEnabled: FEATURES.ENABLE_NWC_WALLET,
        cashuEnabled: FEATURES.ENABLE_CASHU_WALLET,
      });

      if (FEATURES.ENABLE_NWC_WALLET) {
        // Route to NWC wallet (user's Lightning wallet)
        console.log('[PaymentRouter] → Using NWC wallet');
        const result = await NWCWalletService.sendPayment(invoice, amount);

        return {
          success: result.success,
          fee: result.fee,
          error: result.error,
          preimage: result.preimage,
        };
      } else if (FEATURES.ENABLE_CASHU_WALLET) {
        // Route to Cashu wallet (legacy)
        console.log('[PaymentRouter] → Using Cashu wallet');
        const walletCore = WalletCore.getInstance();
        const result = await walletCore.payLightningInvoice(invoice);

        return {
          success: result.success,
          fee: result.fee,
          error: result.error,
        };
      } else {
        // No wallet enabled
        console.log('[PaymentRouter] ❌ No wallet enabled');
        return {
          success: false,
          error: 'No wallet enabled. Please configure a wallet in settings.',
        };
      }
    } catch (error) {
      console.error('[PaymentRouter] Payment routing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed',
      };
    }
  }

  /**
   * Create Lightning invoice for receiving payment
   * Routes to NWC if enabled, otherwise Cashu
   */
  static async createInvoice(
    amountSats: number,
    description?: string,
    metadata?: any
  ): Promise<InvoiceResult> {
    try {
      console.log('[PaymentRouter] Creating invoice...', {
        amount: amountSats,
        nwcEnabled: FEATURES.ENABLE_NWC_WALLET,
      });

      if (FEATURES.ENABLE_NWC_WALLET) {
        // Route to NWC wallet
        console.log('[PaymentRouter] → Using NWC wallet for invoice');
        const result = await NWCWalletService.createInvoice(
          amountSats,
          description,
          metadata
        );

        return {
          success: result.success,
          invoice: result.invoice,
          paymentHash: result.paymentHash,
          error: result.error,
        };
      } else if (FEATURES.ENABLE_CASHU_WALLET) {
        // Cashu doesn't support invoice creation the same way
        // For now, return error - this could be enhanced later
        console.log(
          '[PaymentRouter] ⚠️ Cashu wallet does not support invoice creation'
        );
        return {
          success: false,
          error: 'Invoice creation not supported with Cashu wallet',
        };
      } else {
        return {
          success: false,
          error: 'No wallet enabled',
        };
      }
    } catch (error) {
      console.error('[PaymentRouter] Invoice creation error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Invoice creation failed',
      };
    }
  }

  /**
   * Get wallet balance
   * Routes to appropriate wallet based on feature flags
   */
  static async getBalance(): Promise<BalanceResult> {
    try {
      if (FEATURES.ENABLE_NWC_WALLET) {
        const result = await NWCWalletService.getBalance();
        return {
          balance: result.balance,
          error: result.error,
        };
      } else if (FEATURES.ENABLE_CASHU_WALLET) {
        const walletCore = WalletCore.getInstance();
        // WalletCore doesn't have async getBalance, uses store
        // This would need adjustment based on actual implementation
        console.log(
          '[PaymentRouter] Cashu balance check - needs implementation'
        );
        return {
          balance: 0,
          error: 'Balance check not implemented for Cashu',
        };
      } else {
        return {
          balance: 0,
          error: 'No wallet enabled',
        };
      }
    } catch (error) {
      console.error('[PaymentRouter] Balance check error:', error);
      return {
        balance: 0,
        error: error instanceof Error ? error.message : 'Balance check failed',
      };
    }
  }

  /**
   * Check if wallet is available and configured
   */
  static async isWalletAvailable(): Promise<boolean> {
    try {
      if (FEATURES.ENABLE_NWC_WALLET) {
        return await NWCWalletService.isAvailable();
      } else if (FEATURES.ENABLE_CASHU_WALLET) {
        // Check if Cashu wallet is initialized
        // This would need adjustment based on actual implementation
        return true; // Placeholder
      }
      return false;
    } catch (error) {
      console.error('[PaymentRouter] Wallet availability check error:', error);
      return false;
    }
  }

  /**
   * Get active wallet type
   * Useful for UI to show which wallet is being used
   */
  static getActiveWalletType(): 'nwc' | 'cashu' | 'none' {
    if (FEATURES.ENABLE_NWC_WALLET) {
      return 'nwc';
    } else if (FEATURES.ENABLE_CASHU_WALLET) {
      return 'cashu';
    }
    return 'none';
  }
}

export default PaymentRouter;
