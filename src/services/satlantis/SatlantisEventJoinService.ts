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
import { UnifiedCacheService } from '../cache/UnifiedCacheService';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import type { NDKKind } from '@nostr-dev-kit/ndk';
import type { SatlantisEvent } from '../../types/satlantis';

// NIP-52 Calendar RSVP kind
const KIND_CALENDAR_RSVP = 31925 as NDKKind;

// Storage key for pending joins (payment made but RSVP failed)
const PENDING_JOINS_KEY = '@runstr:pending_event_joins';

// Storage key for local join backup (in case Nostr RSVP query fails)
const LOCAL_JOINS_KEY = '@runstr:local_event_joins';

// Storage key for RSVP event IDs (for direct lookup)
const RSVP_EVENT_IDS_KEY = '@runstr:rsvp_event_ids';

// Interface for local join storage - supports multiple users per event
interface LocalJoinRecord {
  userPubkeys: string[]; // Array of user pubkeys who joined
  timestamps: Record<string, number>; // pubkey → timestamp mapping
}

// Legacy format (single user) - for migration
interface LegacyLocalJoinRecord {
  userPubkey: string;
  timestamp: number;
}

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

      // Debug logging
      console.log('[EventJoin] 📝 Building RSVP event:', {
        eventRef,
        tags: tags.map(t => t.join(':')),
      });

      const rsvpEvent = new NDKEvent(ndk, {
        kind: KIND_CALENDAR_RSVP,
        content: '',
        tags,
        created_at: Math.floor(Date.now() / 1000),
      });

      // Sign
      await rsvpEvent.sign(signer);
      console.log('[EventJoin] ✅ RSVP signed, event ID:', rsvpEvent.id);

      // Publish with timeout
      console.log('[EventJoin] Publishing RSVP...');
      const publishPromise = rsvpEvent.publish();
      const timeoutPromise = new Promise<Set<any>>((resolve) =>
        setTimeout(() => resolve(new Set()), 10000)
      );

      const relaySet = await Promise.race([publishPromise, timeoutPromise]);
      const publishedCount = relaySet.size;

      if (publishedCount > 0) {
        // Log which relays accepted the RSVP
        const relayUrls = Array.from(relaySet).map((r: any) => r.url || r);
        console.log(`[EventJoin] 🎉 RSVP published to ${publishedCount} relays:`, relayUrls);

        // Get current user pubkey for local storage
        const userPubkey = await signingService.getUserPubkey();

        // Save RSVP event ID for direct lookup (most reliable method)
        if (rsvpEvent.id) {
          await this.saveRsvpEventId(event.pubkey, event.id, rsvpEvent.id, userPubkey || '');
          console.log(`[EventJoin] 💾 Saved RSVP event ID: ${rsvpEvent.id.slice(0, 16)}...`);
        }

        // Save join locally as backup (in case Nostr query doesn't find it)
        if (userPubkey) {
          await this.saveLocalJoin(event.id, event.pubkey, userPubkey);
        }

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
        console.log('[EventJoin] ❌ RSVP publish failed - 0 relays accepted');
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
      const eventRef = `31923:${eventPubkey}:${eventDTag}`;
      const cacheKey = `satlantis_rsvps_${eventRef}`;

      // Actually clear the cache so fresh query happens
      await UnifiedCacheService.invalidate(cacheKey);
      console.log('[EventJoin] 🗑️ Cleared RSVP cache:', cacheKey);
    } catch (error) {
      console.warn('[EventJoin] Cache clear error:', error);
    }
  }

  // ============================================================================
  // Local Join Storage (Backup Persistence)
  // ============================================================================

  /**
   * Save join locally as backup (in case Nostr RSVP query fails)
   * Now supports multiple users per event
   */
  async saveLocalJoin(
    eventId: string,
    eventPubkey: string,
    userPubkey: string
  ): Promise<void> {
    try {
      const key = `${eventPubkey}:${eventId}`;
      const joins = await this.getLocalJoins();

      // Get existing record or create new one
      let record = joins[key];
      if (!record) {
        record = { userPubkeys: [], timestamps: {} };
      }

      // Add user if not already present
      if (!record.userPubkeys.includes(userPubkey)) {
        record.userPubkeys.push(userPubkey);
        record.timestamps[userPubkey] = Date.now();
        joins[key] = record;
        await AsyncStorage.setItem(LOCAL_JOINS_KEY, JSON.stringify(joins));
        console.log('[EventJoin] 💾 Saved join locally:', key, '- Total users:', record.userPubkeys.length);
      } else {
        console.log('[EventJoin] 📝 User already in local joins:', key);
      }
    } catch (error) {
      console.error('[EventJoin] Error saving local join:', error);
    }
  }

  /**
   * Check if user has a local join record for an event
   * Handles both new (multi-user) and legacy (single-user) formats
   */
  async hasLocalJoin(
    eventPubkey: string,
    eventId: string,
    userPubkey: string
  ): Promise<boolean> {
    try {
      const key = `${eventPubkey}:${eventId}`;
      const joins = await this.getLocalJoins();
      const record = joins[key];

      if (!record) return false;

      // Check new format (array of pubkeys)
      if (record.userPubkeys && record.userPubkeys.includes(userPubkey)) {
        console.log('[EventJoin] 📍 Found local join backup for:', key);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[EventJoin] Error checking local join:', error);
      return false;
    }
  }

  /**
   * Get all local joins - migrates legacy single-user format to multi-user
   */
  private async getLocalJoins(): Promise<Record<string, LocalJoinRecord>> {
    try {
      const stored = await AsyncStorage.getItem(LOCAL_JOINS_KEY);
      if (!stored) return {};

      const parsed = JSON.parse(stored);
      let needsMigration = false;

      // Migrate legacy records (single userPubkey) to new format (userPubkeys array)
      for (const key of Object.keys(parsed)) {
        const record = parsed[key];
        // Check if this is legacy format (has userPubkey but no userPubkeys array)
        if (record.userPubkey && !record.userPubkeys) {
          console.log('[EventJoin] 🔄 Migrating legacy join record:', key);
          parsed[key] = {
            userPubkeys: [record.userPubkey],
            timestamps: { [record.userPubkey]: record.timestamp || Date.now() },
          };
          needsMigration = true;
        }
      }

      // Save migrated data
      if (needsMigration) {
        await AsyncStorage.setItem(LOCAL_JOINS_KEY, JSON.stringify(parsed));
        console.log('[EventJoin] ✅ Migration complete');
      }

      return parsed;
    } catch (error) {
      console.error('[EventJoin] Error getting local joins:', error);
      return {};
    }
  }

  /**
   * Remove a local join (when we confirm it's on Nostr)
   */
  async removeLocalJoin(eventPubkey: string, eventId: string): Promise<void> {
    try {
      const key = `${eventPubkey}:${eventId}`;
      const joins = await this.getLocalJoins();
      delete joins[key];
      await AsyncStorage.setItem(LOCAL_JOINS_KEY, JSON.stringify(joins));
      console.log('[EventJoin] 🗑️ Removed local join:', key);
    } catch (error) {
      console.error('[EventJoin] Error removing local join:', error);
    }
  }

  /**
   * Get local joins for a specific event (returns array of user pubkeys)
   * Used to include locally-joined users in participant list when Nostr RSVP query fails
   */
  async getLocalJoinsForEvent(
    eventPubkey: string,
    eventId: string
  ): Promise<string[]> {
    try {
      const key = `${eventPubkey}:${eventId}`;
      const joins = await this.getLocalJoins();
      const record = joins[key];

      if (record && record.userPubkeys && record.userPubkeys.length > 0) {
        console.log('[EventJoin] 📍 Found', record.userPubkeys.length, 'local joins for event:', key);
        return record.userPubkeys;
      }
      return [];
    } catch (error) {
      console.error('[EventJoin] Error getting local joins for event:', error);
      return [];
    }
  }

  // ============================================================================
  // Debug Methods (for troubleshooting RSVP issues)
  // ============================================================================

  /**
   * DEBUG: Clear local join for a specific event (allows re-testing join flow)
   */
  async debugClearLocalJoin(
    eventPubkey: string,
    eventId: string
  ): Promise<void> {
    try {
      const key = `${eventPubkey}:${eventId}`;
      const joins = await this.getLocalJoins();

      if (joins[key]) {
        console.log('[EventJoin] 🧹 DEBUG: Clearing local join for:', key);
        delete joins[key];
        await AsyncStorage.setItem(LOCAL_JOINS_KEY, JSON.stringify(joins));
        console.log('[EventJoin] ✅ DEBUG: Local join cleared');
      } else {
        console.log('[EventJoin] ℹ️ DEBUG: No local join found for:', key);
      }

      // Also clear RSVP cache
      const eventRef = `31923:${eventPubkey}:${eventId}`;
      const cacheKey = `satlantis_rsvps_${eventRef}`;
      await UnifiedCacheService.invalidate(cacheKey);
      console.log('[EventJoin] 🗑️ DEBUG: RSVP cache also cleared');
    } catch (error) {
      console.error('[EventJoin] DEBUG: Error clearing local join:', error);
    }
  }

  /**
   * DEBUG: Get all stored local joins (for inspection)
   */
  async debugGetAllLocalJoins(): Promise<Record<string, LocalJoinRecord>> {
    const joins = await this.getLocalJoins();
    console.log('[EventJoin] 🔍 DEBUG: All local joins:', JSON.stringify(joins, null, 2));
    return joins;
  }

  /**
   * DEBUG: Force add a user to local joins (for testing without publishing RSVP)
   */
  async debugForceLocalJoin(
    eventPubkey: string,
    eventId: string,
    userPubkey: string
  ): Promise<void> {
    console.log('[EventJoin] 🔧 DEBUG: Force adding local join...');
    await this.saveLocalJoin(eventId, eventPubkey, userPubkey);
    console.log('[EventJoin] ✅ DEBUG: Force join complete');
  }

  /**
   * DEBUG: Clear ALL local join data (nuclear option)
   */
  async debugClearAllLocalJoins(): Promise<void> {
    console.log('[EventJoin] 💥 DEBUG: Clearing ALL local joins...');
    await AsyncStorage.removeItem(LOCAL_JOINS_KEY);
    console.log('[EventJoin] ✅ DEBUG: All local joins cleared');
  }

  // ============================================================================
  // RSVP Event ID Storage (Direct Lookup - Most Reliable Method)
  // ============================================================================

  /**
   * Storage structure for RSVP event IDs:
   * { "eventPubkey:eventId": { "userPubkey": "rsvpEventId", ... }, ... }
   * This allows direct lookup of RSVPs by event ID instead of unreliable tag queries
   */

  /**
   * Save RSVP event ID for direct lookup
   * This is the most reliable way to find RSVPs since relay tag indexing is unreliable
   */
  async saveRsvpEventId(
    eventPubkey: string,
    eventId: string,
    rsvpEventId: string,
    userPubkey: string
  ): Promise<void> {
    try {
      const key = `${eventPubkey}:${eventId}`;
      const allRsvps = await this.getRsvpEventIds();

      // Get or create record for this event
      if (!allRsvps[key]) {
        allRsvps[key] = {};
      }

      // Store the RSVP event ID for this user
      allRsvps[key][userPubkey] = rsvpEventId;

      await AsyncStorage.setItem(RSVP_EVENT_IDS_KEY, JSON.stringify(allRsvps));
      console.log(`[EventJoin] 💾 Saved RSVP event ID for direct lookup: ${rsvpEventId.slice(0, 16)}...`);
    } catch (error) {
      console.error('[EventJoin] Error saving RSVP event ID:', error);
    }
  }

  /**
   * Get all stored RSVP event IDs
   */
  private async getRsvpEventIds(): Promise<Record<string, Record<string, string>>> {
    try {
      const stored = await AsyncStorage.getItem(RSVP_EVENT_IDS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('[EventJoin] Error getting RSVP event IDs:', error);
      return {};
    }
  }

  /**
   * Get RSVP event IDs for a specific calendar event
   * Returns array of { userPubkey, rsvpEventId } for direct Nostr lookup
   */
  async getRsvpEventIdsForEvent(
    eventPubkey: string,
    eventId: string
  ): Promise<Array<{ userPubkey: string; rsvpEventId: string }>> {
    try {
      const key = `${eventPubkey}:${eventId}`;
      const allRsvps = await this.getRsvpEventIds();
      const eventRsvps = allRsvps[key];

      if (!eventRsvps) {
        return [];
      }

      const result = Object.entries(eventRsvps).map(([userPubkey, rsvpEventId]) => ({
        userPubkey,
        rsvpEventId,
      }));

      console.log(`[EventJoin] 📖 Found ${result.length} stored RSVP event IDs for: ${eventId}`);
      return result;
    } catch (error) {
      console.error('[EventJoin] Error getting RSVP event IDs for event:', error);
      return [];
    }
  }

  /**
   * Get RSVP event ID for a specific user on a specific event
   */
  async getUserRsvpEventId(
    eventPubkey: string,
    eventId: string,
    userPubkey: string
  ): Promise<string | null> {
    try {
      const key = `${eventPubkey}:${eventId}`;
      const allRsvps = await this.getRsvpEventIds();
      const eventRsvps = allRsvps[key];

      if (eventRsvps && eventRsvps[userPubkey]) {
        return eventRsvps[userPubkey];
      }
      return null;
    } catch (error) {
      console.error('[EventJoin] Error getting user RSVP event ID:', error);
      return null;
    }
  }

  /**
   * DEBUG: Clear RSVP event IDs for a specific event
   */
  async debugClearRsvpEventIds(
    eventPubkey: string,
    eventId: string
  ): Promise<void> {
    try {
      const key = `${eventPubkey}:${eventId}`;
      const allRsvps = await this.getRsvpEventIds();

      if (allRsvps[key]) {
        console.log('[EventJoin] 🧹 DEBUG: Clearing RSVP event IDs for:', key);
        delete allRsvps[key];
        await AsyncStorage.setItem(RSVP_EVENT_IDS_KEY, JSON.stringify(allRsvps));
        console.log('[EventJoin] ✅ DEBUG: RSVP event IDs cleared');
      } else {
        console.log('[EventJoin] ℹ️ DEBUG: No RSVP event IDs found for:', key);
      }
    } catch (error) {
      console.error('[EventJoin] DEBUG: Error clearing RSVP event IDs:', error);
    }
  }

  /**
   * DEBUG: Get all stored RSVP event IDs (for inspection)
   */
  async debugGetAllRsvpEventIds(): Promise<Record<string, Record<string, string>>> {
    const rsvps = await this.getRsvpEventIds();
    console.log('[EventJoin] 🔍 DEBUG: All RSVP event IDs:', JSON.stringify(rsvps, null, 2));
    return rsvps;
  }
}

export const SatlantisEventJoinService =
  SatlantisEventJoinServiceClass.getInstance();
export default SatlantisEventJoinService;
