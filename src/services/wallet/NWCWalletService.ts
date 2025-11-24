/**
 * NWCWalletService - Nostr Wallet Connect wallet implementation
 * Uses @getalby/sdk for Bitcoin operations with user's NWC connection
 * Simple, safe, reliable - fails gracefully
 */

// Note: Global polyfills are now applied in index.js

import { NWCClient } from '@getalby/sdk';
import { Platform } from 'react-native';
import { NWCStorageService } from './NWCStorageService';

/**
 * Timeout wrapper for SDK calls
 * Prevents hanging on network issues
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Retry wrapper with exponential backoff
 * Retries failed operations up to maxRetries times
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.log(
        `[Retry] Attempt ${attempt}/${maxRetries} failed:`,
        lastError.message
      );

      // Don't delay after last attempt
      if (attempt < maxRetries) {
        const delay = delayMs * attempt; // Exponential backoff: 1s, 2s, 3s
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

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
  private nwcClient: NWCClient | null = null;
  private initializationPromise: Promise<void> | null = null;
  // private appStateSubscription: any = null; // DISABLED: Causes background crashes
  private connectionString: string | null = null;
  private lastActiveTime: number = Date.now();

  constructor() {
    this.setupAppStateHandling();
  }

  /**
   * iOS backgrounding handler - DISABLED to prevent background crashes
   * Network operations while backgrounded cause crashes on both iOS and Android
   */
  private setupAppStateHandling(): void {
    // DISABLED: AppState listener causing background crashes
    // WebSocket operations on killed connections = instant crash
    /*
    if (Platform.OS === 'ios') {
      this.appStateSubscription = AppState.addEventListener(
        'change',
        this.handleAppStateChange
      );
    }
    */
  }

  private handleAppStateChange = async (nextAppState: any): Promise<void> => {
    console.log(`[NWC] App state changed to: ${nextAppState}`);

    if (Platform.OS === 'ios' && nextAppState === 'active') {
      const timeSinceBackground = Date.now() - this.lastActiveTime;

      // If app was backgrounded for more than 30 seconds, check connection
      if (timeSinceBackground > 30000 && this.nwcClient) {
        console.log(
          '[NWC] App became active after background, checking connection...'
        );

        // Wait for iOS to restore network connectivity
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Try a quick operation to test connection
        try {
          await withTimeout(
            this.nwcClient.getBalance(),
            5000,
            'Connection check timeout'
          );
          console.log('[NWC] Connection still active');
        } catch (error) {
          console.log('[NWC] Connection lost, attempting reconnect...');
          await this.reconnect();
        }
      }
    } else if (nextAppState === 'background') {
      this.lastActiveTime = Date.now();
    }
  };

  /**
   * Validate NWC connection string format and components
   * Ensures string has all required parts
   */
  private validateConnectionString(str: string): {
    isValid: boolean;
    error?: string;
    components?: any;
  } {
    try {
      // NWC format: nostr+walletconnect://pubkey?relay=wss://...&secret=...
      if (!str || !str.startsWith('nostr+walletconnect://')) {
        return {
          isValid: false,
          error: 'Invalid protocol, must start with nostr+walletconnect://',
        };
      }

      // Parse URL components
      const url = new URL(str);
      const pubkey = url.host || url.pathname.slice(2); // Handle both formats
      const relay = url.searchParams.get('relay');
      const secret = url.searchParams.get('secret');

      if (!pubkey || pubkey.length < 32) {
        return { isValid: false, error: 'Invalid or missing pubkey' };
      }

      if (!relay) {
        return { isValid: false, error: 'Missing relay parameter' };
      }

      if (!relay.startsWith('wss://') && !relay.startsWith('ws://')) {
        return {
          isValid: false,
          error: 'Invalid relay URL, must be ws:// or wss://',
        };
      }

      if (!secret || secret.length < 32) {
        return { isValid: false, error: 'Invalid or missing secret' };
      }

      // Check for Alby relay specifically
      const isAlbyRelay = relay.includes('relay.getalby.com');
      console.log(
        `[NWC] Using ${isAlbyRelay ? 'Alby' : 'custom'} relay: ${relay}`
      );

      return {
        isValid: true,
        components: { pubkey, relay, secret, isAlbyRelay },
      };
    } catch (error) {
      return { isValid: false, error: `Parse error: ${error.message}` };
    }
  }

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
   * Initialize NWC wallet connection
   * Called when app starts or wallet is first connected
   */
  async initialize(): Promise<void> {
    // Return existing initialization if in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Check if already initialized
    if (this.nwcClient) {
      return;
    }

    // Start new initialization
    this.initializationPromise = this._doInitialize();

    try {
      await this.initializationPromise;
    } catch (error) {
      // Already logged in _doInitialize, just reset promise
      this.initializationPromise = null;
    }
  }

  private async _doInitialize(): Promise<void> {
    try {
      // Get user's NWC connection string from storage
      const nwcString = await NWCStorageService.getNWCString();

      if (!nwcString) {
        throw new Error('No NWC connection string found');
      }

      console.log('[NWC] Initializing user wallet...');

      // Validate connection string format
      const validation = this.validateConnectionString(nwcString);
      if (!validation.isValid) {
        throw new Error(`Invalid NWC string: ${validation.error}`);
      }

      // Store for reconnection
      this.connectionString = nwcString;

      console.log('[NWC] Connecting to relay:', validation.components.relay);

      // PRIMARY: Use SDK implementation (most reliable)
      console.log('[NWC] Using SDK implementation...');

      // Check if NWCClient is available from SDK
      if (!NWCClient) {
        throw new Error(
          'NWCClient not found in @getalby/sdk - check SDK installation'
        );
      }

      // CRITICAL: Pass React Native's WebSocket to the SDK
      // The SDK works in Node.js with 'ws' package, but in React Native
      // we must explicitly provide the global WebSocket
      this.nwcClient = new NWCClient({
        nostrWalletConnectUrl: nwcString,
        websocketImplementation: WebSocket, // React Native's built-in WebSocket
      });

      console.log(
        '[NWC] NWCClient instance created with React Native WebSocket'
      );

      // Don't manipulate relay, just test the connection
      console.log('[NWC] Testing SDK connection...');

      // Implement exponential backoff retry
      let lastError: Error | undefined;
      const delays = [1000, 2000, 4000]; // 1s, 2s, 4s

      for (let attempt = 0; attempt <= delays.length; attempt++) {
        try {
          const info = await withTimeout(
            this.nwcClient.getInfo(),
            10000, // 10 second timeout per attempt
            'NWC connection timeout'
          );

          console.log('[NWC] ✅ Connection successful on attempt', attempt + 1);
          console.log('[NWC] Wallet info:', {
            alias: info.alias || 'Unknown',
            methods: info.methods?.slice(0, 3) || [],
          });
          return; // Success - exit initialization
        } catch (error) {
          lastError =
            error instanceof Error ? error : new Error('Unknown error');
          console.log(
            `[NWC] Attempt ${attempt + 1} failed:`,
            lastError.message
          );

          if (attempt < delays.length) {
            console.log(`[NWC] Retrying in ${delays[attempt]}ms...`);
            await new Promise((resolve) =>
              setTimeout(resolve, delays[attempt])
            );
          }
        }
      }

      // If we get here, all attempts failed
      throw lastError || new Error('Failed to connect after all retries');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(
        '[NWC] ❌ User wallet initialization failed:',
        errorMessage
      );

      // Provide more specific error guidance
      if (errorMessage.includes('publish timed out')) {
        console.error(
          '[NWC] WebSocket connection issue - relay cannot publish events'
        );
        console.error(
          '[NWC] This usually means the WebSocket connection is not fully established'
        );
      } else if (errorMessage.includes('timeout')) {
        console.error(
          '[NWC] Connection timeout - wallet service may be unreachable'
        );
      } else if (errorMessage.includes('NWCClient not found')) {
        console.error(
          '[NWC] SDK import issue - check @getalby/sdk installation'
        );
      }

      // Clean up on failure
      this.nwcClient = null;
      this.initializationPromise = null;

      // Don't throw for initialization failures - return gracefully
      // This prevents app crashes when wallet is not configured
      console.log(
        '[NWC] Wallet will remain disconnected - operations will fail gracefully'
      );
    }
  }

  /**
   * Get wallet balance with retry logic
   * Returns 0 if wallet not configured or error occurs
   * Retries up to 3 times with exponential backoff
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

      // Use SDK implementation directly (most reliable)
      if (!this.nwcClient) {
        return { balance: 0, error: 'Wallet not initialized' };
      }

      // Get balance with retry and timeout
      const result = await withRetry(
        () =>
          withTimeout(
            this.nwcClient!.getBalance(),
            30000, // 30 second timeout
            'Balance fetch timeout'
          ),
        3, // 3 retries
        1000 // 1 second initial delay
      );

      if (result && typeof result.balance === 'number') {
        // SDK returns balance in millisats, convert to sats
        const balanceSats = Math.floor(result.balance / 1000);

        // Update connection status
        await NWCStorageService.updateStatus(true, {
          balance: balanceSats,
        });

        return { balance: balanceSats };
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
  async sendPayment(
    invoice: string,
    amount?: number
  ): Promise<SendPaymentResult> {
    try {
      // Check if NWC configured
      const hasWallet = await this.isAvailable();
      if (!hasWallet) {
        return {
          success: false,
          error:
            'No wallet configured. Please connect your wallet in settings.',
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

      // Send payment using NWC client with timeout
      const result = await withTimeout(
        this.nwcClient.payInvoice({
          invoice,
          amount: amount || undefined,
        }),
        30000, // 30 second timeout for payments
        'Payment timeout - please check your wallet'
      );

      if (result && result.preimage) {
        console.log('[NWC] Payment successful');

        // Update connection status
        await NWCStorageService.updateStatus(true);

        return {
          success: true,
          preimage: result.preimage,
          fee: result.fees_paid, // SDK uses plural "fees_paid"
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
        } else if (
          errorMessage.includes('timeout') ||
          errorMessage.includes('network')
        ) {
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
          error:
            'No wallet configured. Please connect your wallet in settings.',
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

      // SDK expects amount in millisats, convert from sats
      const amountMillisats = amountSats * 1000;

      // Create invoice using NWC client with timeout
      const result = await withTimeout(
        this.nwcClient.makeInvoice({
          amount: amountMillisats,
          description: description || 'RUNSTR payment',
        }),
        30000, // 30 second timeout
        'Invoice creation timeout'
      );

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
  async lookupInvoice(
    invoiceOrHash: string
  ): Promise<{ paid: boolean; success: boolean; error?: string }> {
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
      if (
        invoiceOrHash.startsWith('lnbc') ||
        invoiceOrHash.startsWith('lntb')
      ) {
        // It's a BOLT11 invoice
        lookupParam = { invoice: invoiceOrHash };
      } else {
        // It's a payment hash
        lookupParam = { payment_hash: invoiceOrHash };
      }

      // Lookup invoice using NWC client with timeout
      const result = await withTimeout(
        this.nwcClient.lookupInvoice(lookupParam),
        10000, // 10 second timeout
        'Invoice lookup timeout'
      );

      if (result) {
        return {
          paid: result.state === 'settled', // SDK returns state field, not settled boolean
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
    from?: number; // Start timestamp (unix seconds)
    until?: number; // End timestamp (unix seconds)
    limit?: number; // Max number of transactions
    offset?: number; // Pagination offset
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

      // List transactions using NWC client with timeout
      const result = await withTimeout(
        this.nwcClient.listTransactions(params || {}),
        30000, // 30 second timeout
        'Transaction list timeout'
      );

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
   * Useful if connection is lost or app was backgrounded
   */
  async reconnect(): Promise<void> {
    console.log('[NWC] Reconnecting wallet...');

    // Clean up existing client
    if (this.nwcClient) {
      this.nwcClient = null;
    }

    this.initializationPromise = null;

    // Reconnect using stored connection string
    if (this.connectionString) {
      await this.initialize();
    } else {
      console.log('[NWC] No connection string stored, cannot reconnect');
    }
  }

  /**
   * Close the NWC connection
   * Call this when logging out or disconnecting wallet
   */
  async close(): Promise<void> {
    if (this.nwcClient) {
      console.log('[NWC] Closing NWCClient connection...');
      // NWCClient doesn't have explicit close in current SDK
      // Connection will be cleaned up automatically
      this.nwcClient = null;
    }

    this.initializationPromise = null;
    this.connectionString = null;
  }

  /**
   * Clean up resources (called when app is closing)
   */
  cleanup(): void {
    /* DISABLED: AppState listener removed to prevent crashes
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    */
    this.close();
  }
}

// Export singleton instance
export const NWCWalletService = new NWCWalletServiceClass();
export default NWCWalletService;
