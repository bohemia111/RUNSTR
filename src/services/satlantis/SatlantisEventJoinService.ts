/**
 * SatlantisEventJoinService - Handle event joining with optional payment
 *
 * Coordinates the flow of joining RUNSTR events:
 * - Free events: Direct RSVP publish
 * - Paid events: Generate invoice → User pays → RSVP with payment proof
 *
 * Usage:
 * ```typescript
 * // Free event
 * await SatlantisEventJoinService.joinEvent(event);
 *
 * // Paid event
 * const invoice = await SatlantisEventJoinService.generateEntryInvoice(event);
 * // User pays invoice externally...
 * await SatlantisEventJoinService.joinEvent(event, invoice);
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlobalNDKService } from '../nostr/GlobalNDKService';
import { SatlantisRSVPService } from './SatlantisRSVPService';
import { NWCWalletService } from '../wallet/NWCWalletService';
import UnifiedSigningService from '../auth/UnifiedSigningService';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import type { NDKKind } from '@nostr-dev-kit/ndk';
import type { SatlantisEvent } from '../../types/satlantis';

// NIP-52 Calendar RSVP kind
const KIND_CALENDAR_RSVP = 31925 as NDKKind;

// Storage key for pending joins (payment made but RSVP failed)
const PENDING_JOINS_KEY = '@runstr:pending_event_joins';

export interface JoinEventResult {
  success: boolean;
  error?: string;
  rsvpEventId?: string;
  canRetry?: boolean; // True if payment was made but RSVP failed
}

export interface PaymentVerificationResult {
  isPaid: boolean;
  error?: string;
}

// Pending join - payment made but RSVP failed
export interface PendingJoin {
  eventId: string;
  eventPubkey: string;
  paymentProof: string;
  amountSats: number;
  timestamp: number;
}

export interface InvoiceResult {
  success: boolean;
  invoice?: string;
  paymentHash?: string;
  amountSats?: number;
  error?: string;
}

class SatlantisEventJoinServiceClass {
  private static instance: SatlantisEventJoinServiceClass;

  static getInstance(): SatlantisEventJoinServiceClass {
    if (!this.instance) {
      this.instance = new SatlantisEventJoinServiceClass();
    }
    return this.instance;
  }

  /**
   * Join an event - publishes kind 31925 RSVP
   * @param event - The event to join
   * @param paymentProof - Lightning invoice (for paid events)
   * @param skipVerification - Skip payment verification (for retrying after verification)
   */
  async joinEvent(
    event: SatlantisEvent,
    paymentProof?: string,
    skipVerification?: boolean
  ): Promise<JoinEventResult> {
    try {
      console.log(`[EventJoin] Joining event: ${event.title}`);

      // Validate paid event has payment proof
      if (event.joinMethod === 'paid' && event.entryFeeSats && !paymentProof) {
        return {
          success: false,
          error: 'Payment required for this event',
        };
      }

      // For paid events, verify payment first (unless skipping for retry)
      if (event.joinMethod === 'paid' && paymentProof && !skipVerification) {
        console.log('[EventJoin] Verifying payment before RSVP...');
        const verification = await this.verifyPayment(paymentProof);

        if (!verification.isPaid) {
          console.log('[EventJoin] Payment not confirmed yet');
          return {
            success: false,
            error: verification.error || 'Payment not confirmed. Please wait and try again.',
          };
        }
        console.log('[EventJoin] Payment confirmed!');
      }

      // For paid events, save pending join BEFORE attempting RSVP
      // This ensures we don't lose the payment if RSVP fails
      if (paymentProof && event.entryFeeSats) {
        await this.savePendingJoin({
          eventId: event.id,
          eventPubkey: event.pubkey,
          paymentProof,
          amountSats: event.entryFeeSats,
          timestamp: Date.now(),
        });
      }

      // Get signer
      const signingService = UnifiedSigningService.getInstance();
      const signer = await signingService.getSigner();

      if (!signer) {
        return {
          success: false,
          error: 'Not authenticated',
          canRetry: !!paymentProof, // Can retry if payment was made
        };
      }

      // Build RSVP event
      const ndk = await GlobalNDKService.getInstance();
      const eventRef = `31923:${event.pubkey}:${event.id}`;

      const tags: string[][] = [
        ['a', eventRef],
        ['status', 'accepted'],
        ['d', `rsvp-${event.id}`],
      ];

      // Add payment proof tags if provided
      if (paymentProof) {
        tags.push(['payment_proof', paymentProof]);
        if (event.entryFeeSats) {
          tags.push(['amount', event.entryFeeSats.toString()]);
        }
      }

      const rsvpEvent = new NDKEvent(ndk, {
        kind: KIND_CALENDAR_RSVP,
        content: '',
        tags,
        created_at: Math.floor(Date.now() / 1000),
      });

      // Sign
      await rsvpEvent.sign(signer);

      // Publish with timeout
      console.log('[EventJoin] Publishing RSVP...');
      const publishPromise = rsvpEvent.publish();
      const timeoutPromise = new Promise<Set<any>>((resolve) =>
        setTimeout(() => resolve(new Set()), 10000)
      );

      const relaySet = await Promise.race([publishPromise, timeoutPromise]);
      const publishedCount = relaySet.size;

      if (publishedCount > 0) {
        console.log(`[EventJoin] RSVP published to ${publishedCount} relays`);

        // Remove pending join on success
        await this.removePendingJoin(event.id);

        // Invalidate cache so participant list updates
        await this.invalidateEventCache(event.pubkey, event.id);

        return {
          success: true,
          rsvpEventId: rsvpEvent.id,
        };
      } else {
        // RSVP failed but payment was made - user can retry
        return {
          success: false,
          error: 'Failed to publish RSVP. Your payment is saved - tap Retry.',
          canRetry: !!paymentProof,
        };
      }
    } catch (error) {
      console.error('[EventJoin] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        canRetry: !!paymentProof, // Can retry if payment was made
      };
    }
  }

  /**
   * Generate Lightning invoice for paid event entry
   * Uses the user's NWC wallet to create an invoice
   */
  async generateEntryInvoice(event: SatlantisEvent): Promise<InvoiceResult> {
    try {
      if (!event.entryFeeSats || event.entryFeeSats <= 0) {
        return {
          success: false,
          error: 'Event has no entry fee',
        };
      }

      // Check if user has NWC configured
      const hasNWC = await NWCWalletService.hasNWCConfigured();
      if (!hasNWC) {
        return {
          success: false,
          error: 'No wallet configured. Please set up NWC in Settings.',
        };
      }

      console.log(
        `[EventJoin] Generating invoice for ${event.entryFeeSats} sats`
      );

      const description = `Join event: ${event.title}`;
      const result = await NWCWalletService.createInvoice(
        event.entryFeeSats,
        description
      );

      if (result.success && result.invoice) {
        return {
          success: true,
          invoice: result.invoice,
          paymentHash: result.paymentHash,
          amountSats: event.entryFeeSats,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to create invoice',
        };
      }
    } catch (error) {
      console.error('[EventJoin] Invoice error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if current user has joined an event
   */
  async hasUserJoined(event: SatlantisEvent): Promise<boolean> {
    try {
      const signingService = UnifiedSigningService.getInstance();
      const hexPubkey = await signingService.getUserPubkey();

      if (!hexPubkey) {
        return false;
      }

      return await SatlantisRSVPService.hasUserRSVPd(
        event.pubkey,
        event.id,
        hexPubkey
      );
    } catch (error) {
      console.error('[EventJoin] Error checking join status:', error);
      return false;
    }
  }

  /**
   * Get event join requirements
   */
  getJoinRequirements(event: SatlantisEvent): {
    requiresPayment: boolean;
    entryFee: number;
    canJoin: boolean;
    reason?: string;
  } {
    const now = Math.floor(Date.now() / 1000);

    // Check if event has ended
    if (now > event.endTime) {
      return {
        requiresPayment: false,
        entryFee: 0,
        canJoin: false,
        reason: 'Event has ended',
      };
    }

    // Check join method
    const requiresPayment =
      event.joinMethod === 'paid' && (event.entryFeeSats || 0) > 0;

    return {
      requiresPayment,
      entryFee: event.entryFeeSats || 0,
      canJoin: true,
    };
  }

  /**
   * Verify if a Lightning invoice has been paid
   * Uses NWC wallet to check payment status
   */
  async verifyPayment(invoice: string): Promise<PaymentVerificationResult> {
    try {
      console.log('[EventJoin] Verifying payment...');
      const result = await NWCWalletService.lookupInvoice(invoice);

      if (result.success) {
        console.log(`[EventJoin] Payment verified: ${result.paid ? 'PAID' : 'NOT PAID'}`);
        return {
          isPaid: result.paid,
        };
      } else {
        console.log('[EventJoin] Payment verification failed:', result.error);
        return {
          isPaid: false,
          error: result.error || 'Could not verify payment',
        };
      }
    } catch (error) {
      console.error('[EventJoin] Payment verification error:', error);
      return {
        isPaid: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  /**
   * Save a pending join for retry (payment made but RSVP failed)
   */
  async savePendingJoin(pending: PendingJoin): Promise<void> {
    try {
      const existing = await this.getPendingJoins();
      // Remove any existing pending for this event
      const filtered = existing.filter(p => p.eventId !== pending.eventId);
      filtered.push(pending);
      await AsyncStorage.setItem(PENDING_JOINS_KEY, JSON.stringify(filtered));
      console.log(`[EventJoin] Saved pending join for event: ${pending.eventId}`);
    } catch (error) {
      console.error('[EventJoin] Error saving pending join:', error);
    }
  }

  /**
   * Get all pending joins (payments made but RSVP failed)
   */
  async getPendingJoins(): Promise<PendingJoin[]> {
    try {
      const stored = await AsyncStorage.getItem(PENDING_JOINS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[EventJoin] Error getting pending joins:', error);
      return [];
    }
  }

  /**
   * Remove a pending join after successful RSVP
   */
  async removePendingJoin(eventId: string): Promise<void> {
    try {
      const existing = await this.getPendingJoins();
      const filtered = existing.filter(p => p.eventId !== eventId);
      await AsyncStorage.setItem(PENDING_JOINS_KEY, JSON.stringify(filtered));
      console.log(`[EventJoin] Removed pending join for event: ${eventId}`);
    } catch (error) {
      console.error('[EventJoin] Error removing pending join:', error);
    }
  }

  /**
   * Get pending join for a specific event
   */
  async getPendingJoinForEvent(eventId: string): Promise<PendingJoin | null> {
    const pending = await this.getPendingJoins();
    return pending.find(p => p.eventId === eventId) || null;
  }

  /**
   * Invalidate RSVP cache to refresh participant list
   * Note: Parent component should call refresh() after join to update UI
   */
  private async invalidateEventCache(
    eventPubkey: string,
    eventDTag: string
  ): Promise<void> {
    try {
      // UnifiedCacheService uses setWithCustomTTL, we rely on TTL expiry
      // and parent component refresh() to update the UI
      console.log('[EventJoin] Cache will refresh on next query:', eventDTag);
    } catch (error) {
      console.warn('[EventJoin] Cache note:', error);
    }
  }
}

export const SatlantisEventJoinService =
  SatlantisEventJoinServiceClass.getInstance();
export default SatlantisEventJoinService;
