/**
 * NWCManualService - Direct NWC (NIP-47) Protocol Implementation
 * Bypasses @getalby/sdk and implements Nostr Wallet Connect directly
 * Uses React Native WebSocket for reliable connections
 */

import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as secp256k1 from '@noble/secp256k1';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';

interface NWCRequest {
  method: string;
  params?: any;
}

interface NWCResponse {
  result_type?: string;
  result?: any;
  error?: {
    code: string;
    message: string;
  };
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  method: string;
}

/**
 * Manual NWC Service - Implements NIP-47 protocol directly
 * This bypasses the SDK entirely and uses React Native WebSocket
 */
class NWCManualServiceClass {
  private ws: WebSocket | null = null;
  private connectionString: string | null = null;
  private walletPubkey: string | null = null;
  private relayUrl: string | null = null;
  private secret: string | null = null;
  private signer: NDKPrivateKeySigner | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private isConnecting: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private subscriptionId: string | null = null;

  constructor() {
    console.log('[NWC-Manual] Service initialized');
  }

  /**
   * NIP-04 encryption implementation
   */
  private async nip04Encrypt(privkey: string, pubkey: string, text: string): Promise<string> {
    const key = secp256k1.getSharedSecret(privkey, '02' + pubkey, true);
    const normalizedKey = key.slice(1, 33);

    // Generate random IV
    const iv = randomBytes(16);

    // Import crypto for AES encryption
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      normalizedKey,
      { name: 'AES-CBC' },
      false,
      ['encrypt']
    );

    const encrypted = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-CBC', iv },
      cryptoKey,
      new TextEncoder().encode(text)
    );

    return (
      bytesToHex(new Uint8Array(encrypted)) +
      '?iv=' +
      bytesToHex(iv)
    );
  }

  /**
   * NIP-04 decryption implementation
   */
  private async nip04Decrypt(privkey: string, pubkey: string, data: string): Promise<string> {
    const [ciphertext, ivStr] = data.split('?iv=');
    const key = secp256k1.getSharedSecret(privkey, '02' + pubkey, true);
    const normalizedKey = key.slice(1, 33);

    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      normalizedKey,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    );

    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: hexToBytes(ivStr) },
      cryptoKey,
      hexToBytes(ciphertext)
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Calculate Nostr event ID (hash)
   */
  private getEventHash(event: any): string {
    const serialized = JSON.stringify([
      0, // Reserved for future use
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content,
    ]);
    return bytesToHex(sha256(new TextEncoder().encode(serialized)));
  }

  /**
   * Sign Nostr event
   */
  private async signEvent(event: any, privkey: string): Promise<string> {
    const eventHash = hexToBytes(event.id || this.getEventHash(event));
    const sig = await secp256k1.sign(eventHash, privkey);
    // sig is a Signature object, convert to hex string
    return sig.toCompactHex();
  }

  /**
   * Parse NWC connection string
   */
  private parseConnectionString(connectionString: string): {
    pubkey: string;
    relay: string;
    secret: string;
    lud16?: string;
  } {
    const url = new URL(connectionString);
    const pubkey = url.hostname || url.pathname.slice(2);
    const relay = url.searchParams.get('relay');
    const secret = url.searchParams.get('secret');
    const lud16 = url.searchParams.get('lud16');

    if (!pubkey || !relay || !secret) {
      throw new Error('Invalid NWC connection string');
    }

    return { pubkey, relay, secret, lud16 };
  }

  /**
   * Initialize connection with NWC string
   */
  async connect(connectionString: string): Promise<boolean> {
    try {
      if (this.isConnecting) {
        console.log('[NWC-Manual] Connection already in progress');
        return false;
      }

      this.isConnecting = true;
      console.log('[NWC-Manual] Starting connection...');

      // Parse connection string
      const parsed = this.parseConnectionString(connectionString);
      this.walletPubkey = parsed.pubkey;
      this.relayUrl = parsed.relay;
      this.secret = parsed.secret;
      this.connectionString = connectionString;

      console.log('[NWC-Manual] Connecting to relay:', this.relayUrl);
      console.log('[NWC-Manual] Wallet pubkey:', this.walletPubkey);

      // Create signer from secret
      this.signer = new NDKPrivateKeySigner(this.secret);
      const userPubkey = await this.signer.user();
      console.log('[NWC-Manual] User pubkey:', userPubkey.pubkey);

      // Create WebSocket connection
      return await this.connectWebSocket();
    } catch (error) {
      console.error('[NWC-Manual] Connection error:', error);
      this.isConnecting = false;
      return false;
    }
  }

  /**
   * Connect WebSocket and setup handlers
   */
  private connectWebSocket(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.relayUrl) {
        resolve(false);
        return;
      }

      console.log('[NWC-Manual] Creating WebSocket to:', this.relayUrl);

      // Use React Native's global WebSocket
      this.ws = new WebSocket(this.relayUrl, ['nostr']);

      // Set timeout for connection
      const connectionTimeout = setTimeout(() => {
        console.log('[NWC-Manual] Connection timeout');
        if (this.ws?.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
        this.isConnecting = false;
        resolve(false);
      }, 10000);

      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('[NWC-Manual] ✅ WebSocket connected!');
        this.isConnecting = false;

        // Subscribe to NWC responses
        this.subscribeToResponses();

        // Store connection
        this.storeConnection();

        resolve(true);
      };

      this.ws.onerror = (event: any) => {
        clearTimeout(connectionTimeout);
        console.error('[NWC-Manual] WebSocket error:', event.message || 'Unknown error');
        this.isConnecting = false;
        resolve(false);
      };

      this.ws.onclose = () => {
        console.log('[NWC-Manual] WebSocket closed');
        this.isConnecting = false;

        // Clear pending requests
        for (const [id, request] of this.pendingRequests) {
          clearTimeout(request.timeout);
          request.reject(new Error('Connection closed'));
        }
        this.pendingRequests.clear();

        // Attempt reconnection
        this.scheduleReconnect();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data);
      };
    });
  }

  /**
   * Subscribe to NWC response events
   */
  private subscribeToResponses(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[NWC-Manual] Cannot subscribe - WebSocket not open');
      return;
    }

    if (!this.signer) {
      console.error('[NWC-Manual] Cannot subscribe - no signer');
      return;
    }

    // Generate subscription ID
    this.subscriptionId = Math.random().toString(36).substring(7);

    // Get user pubkey synchronously (we already have it from connect)
    this.signer.user().then((user) => {
      const filter = {
        kinds: [23195], // NWC response kind
        authors: [this.walletPubkey!], // From wallet
        '#p': [user.pubkey], // To us
        since: Math.floor(Date.now() / 1000) - 10 // Last 10 seconds
      };

      const subMessage = JSON.stringify(['REQ', this.subscriptionId, filter]);
      console.log('[NWC-Manual] Subscribing to responses:', subMessage);

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(subMessage);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(data: string): Promise<void> {
    try {
      const message = JSON.parse(data);

      if (!Array.isArray(message)) {
        return;
      }

      const [type, ...rest] = message;

      switch (type) {
        case 'EVENT':
          const [, event] = rest;
          if (event.kind === 23195) {
            await this.handleNWCResponse(event);
          }
          break;

        case 'EOSE':
          console.log('[NWC-Manual] End of stored events');
          break;

        case 'OK':
          const [eventId, success, msg] = rest;
          if (success) {
            console.log('[NWC-Manual] Event published:', eventId);
          } else {
            console.error('[NWC-Manual] Publish failed:', msg);
          }
          break;

        case 'NOTICE':
          console.log('[NWC-Manual] Relay notice:', rest[0]);
          break;
      }
    } catch (error) {
      console.error('[NWC-Manual] Message parsing error:', error);
    }
  }

  /**
   * Handle NWC response event
   */
  private async handleNWCResponse(event: any): Promise<void> {
    try {
      if (!this.signer) {
        return;
      }

      // Decrypt the response using our NIP-04 implementation
      const decrypted = await this.nip04Decrypt(this.secret!, this.walletPubkey!, event.content);
      const response: NWCResponse = JSON.parse(decrypted);

      console.log('[NWC-Manual] Received response:', response);

      // Find the e tag which contains the request event ID
      const requestId = event.tags.find((tag: string[]) => tag[0] === 'e')?.[1];

      if (requestId && this.pendingRequests.has(requestId)) {
        const pending = this.pendingRequests.get(requestId)!;
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(requestId);

        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
    } catch (error) {
      console.error('[NWC-Manual] Failed to handle response:', error);
    }
  }

  /**
   * Send NWC request
   */
  async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Try to reconnect
      console.log('[NWC-Manual] WebSocket not open, attempting to reconnect...');
      const connected = await this.reconnect();
      if (!connected) {
        throw new Error('Not connected to wallet');
      }
    }

    if (!this.signer || !this.walletPubkey) {
      throw new Error('Not initialized');
    }

    try {
      const user = await this.signer.user();

      // Create NWC request
      const request: NWCRequest = {
        method,
        params: params || {}
      };

      console.log('[NWC-Manual] Sending request:', request);

      // Encrypt request using our NIP-04 implementation
      const encrypted = await this.nip04Encrypt(this.secret!, this.walletPubkey, JSON.stringify(request));

      // Create Nostr event (kind 23194 - NWC request)
      const event: any = {
        kind: 23194,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['p', this.walletPubkey] // To wallet
        ],
        content: encrypted,
        pubkey: user.pubkey
      };

      // Calculate event ID
      event.id = this.getEventHash(event);

      // Sign event
      event.sig = await this.signEvent(event, this.secret!);

      // Send to relay
      const eventMessage = JSON.stringify(['EVENT', event]);
      this.ws.send(eventMessage);

      // Wait for response
      return await this.waitForResponse(event.id, method);
    } catch (error) {
      console.error('[NWC-Manual] Request failed:', error);
      throw error;
    }
  }

  /**
   * Wait for NWC response
   */
  private waitForResponse(requestId: string, method: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${method}`));
      }, 15000); // 15 second timeout

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout,
        method
      });
    });
  }

  /**
   * Get wallet info
   */
  async getInfo(): Promise<any> {
    return await this.sendRequest('get_info');
  }

  /**
   * Get balance
   */
  async getBalance(): Promise<{ balance: number }> {
    const result = await this.sendRequest('get_balance');
    return { balance: result.balance_msat / 1000 }; // Convert to sats
  }

  /**
   * Create invoice
   */
  async makeInvoice(amountSats: number, description?: string): Promise<any> {
    return await this.sendRequest('make_invoice', {
      amount: amountSats * 1000, // Convert to millisats
      description: description || 'RUNSTR payment'
    });
  }

  /**
   * Pay invoice
   */
  async payInvoice(invoice: string): Promise<any> {
    return await this.sendRequest('pay_invoice', { invoice });
  }

  /**
   * List transactions
   */
  async listTransactions(params?: any): Promise<any> {
    return await this.sendRequest('list_transactions', params || {});
  }

  /**
   * Lookup invoice
   */
  async lookupInvoice(invoice: string): Promise<any> {
    return await this.sendRequest('lookup_invoice', { invoice });
  }

  /**
   * Store connection for persistence
   */
  private async storeConnection(): Promise<void> {
    try {
      if (this.connectionString) {
        await AsyncStorage.setItem('nwc_manual_connection', this.connectionString);
        console.log('[NWC-Manual] Connection stored');
      }
    } catch (error) {
      console.error('[NWC-Manual] Failed to store connection:', error);
    }
  }

  /**
   * Restore connection from storage
   */
  async restore(): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem('nwc_manual_connection');
      if (stored) {
        console.log('[NWC-Manual] Restoring connection...');
        return await this.connect(stored);
      }
      return false;
    } catch (error) {
      console.error('[NWC-Manual] Failed to restore connection:', error);
      return false;
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      console.log('[NWC-Manual] Attempting reconnection...');
      this.reconnect();
    }, 3000);
  }

  /**
   * Reconnect to relay
   */
  async reconnect(): Promise<boolean> {
    if (this.connectionString) {
      // Close existing connection
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      // Reconnect
      return await this.connect(this.connectionString);
    }
    return false;
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Clear pending requests
    for (const [id, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('Disconnected'));
    }
    this.pendingRequests.clear();

    this.connectionString = null;
    this.walletPubkey = null;
    this.relayUrl = null;
    this.secret = null;
    this.signer = null;
    this.subscriptionId = null;

    console.log('[NWC-Manual] Disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export const NWCManualService = new NWCManualServiceClass();
export default NWCManualService;