/**
 * EventJoinRequestService - Handle event join request workflow
 * Creates, queries, and processes event join requests using Nostr events
 * Uses kind 1105 for event join requests (different from team requests)
 * Consistent with team join flow but for event-specific participation
 */

import type { Event } from 'nostr-tools';
import { GlobalNDKService } from '../nostr/GlobalNDKService';
import type { NDKFilter, NDKEvent, NDKSubscription } from '@nostr-dev-kit/ndk';

export interface EventJoinRequest {
  id: string;
  requesterId: string;
  requesterName?: string;
  eventId: string;
  eventName: string;
  teamId: string;
  captainPubkey: string;
  message: string;
  timestamp: number;
  status: 'pending' | 'approved' | 'declined';
  nostrEvent: Event;
  // Payment tracking fields
  paymentProof?: string; // Lightning invoice from payment_proof tag
  paymentHash?: string; // Extracted payment hash for NWC verification
  amountPaid?: number; // Amount in sats from amount_paid tag
  paymentTimestamp?: number; // When payment was made (from payment_timestamp tag)
  // ✅ NEW: Participation type tracking
  participationType?: 'in-person' | 'virtual'; // How user will participate
}

export interface EventJoinRequestData {
  eventId: string;
  eventName: string;
  teamId: string;
  captainPubkey: string;
  message: string;
}

export interface EventJoinRequestResponse {
  success: boolean;
  requestId?: string;
  message: string;
}

export class EventJoinRequestService {
  private static instance: EventJoinRequestService;
  private cachedRequests: Map<string, EventJoinRequest[]> = new Map();
  private cacheExpiryMs = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  constructor() {
    // No relay manager needed - uses GlobalNDKService
  }

  static getInstance(): EventJoinRequestService {
    if (!EventJoinRequestService.instance) {
      EventJoinRequestService.instance = new EventJoinRequestService();
    }
    return EventJoinRequestService.instance;
  }

  /**
   * Create an event join request event template (requires external signing)
   */
  prepareEventJoinRequest(
    requestData: EventJoinRequestData,
    requesterPubkey: string
  ): Partial<Event> {
    console.log(
      `📝 Preparing join request for event: ${requestData.eventName}`
    );

    const tags: string[][] = [
      ['e', requestData.eventId], // Reference to event
      ['p', requestData.captainPubkey], // Tag the captain
      ['t', 'event-join-request'],
      ['event-id', requestData.eventId],
      ['event-name', requestData.eventName],
      ['team-id', requestData.teamId],
    ];

    const eventTemplate = {
      kind: 1105, // Custom kind for event join requests (different from team: 1104)
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: requestData.message,
      pubkey: requesterPubkey,
    };

    console.log(
      `✅ Prepared event join request template for: ${requestData.eventName}`
    );
    return eventTemplate;
  }

  /**
   * Get pending event join requests for a captain
   */
  async getEventJoinRequests(
    captainPubkey: string,
    eventId?: string
  ): Promise<EventJoinRequest[]> {
    const cacheKey = `${captainPubkey}:${eventId || 'all'}`;

    // Check cache first
    if (this.isCacheValid() && this.cachedRequests.has(cacheKey)) {
      console.log(`💾 Retrieved cached event join requests for captain`);
      return this.cachedRequests.get(cacheKey)!;
    }

    console.log(`🔍 Fetching event join requests for captain`);

    try {
      // Get GlobalNDK instance
      const ndk = await GlobalNDKService.getInstance();

      const filter: NDKFilter = {
        kinds: [1105 as any], // Custom event kind
        '#p': [captainPubkey],
        ...(eventId && { '#event-id': [eventId] }),
        limit: 100,
      };

      // ✅ FIXED: Use fetchEvents instead of subscription to prevent Android crashes
      // Old code used subscribe() with 2-second wait, which crashes if app backgrounds mid-wait
      const events = await ndk.fetchEvents(filter);

      const requests: EventJoinRequest[] = [];
      for (const event of events) {
        try {
          const nostrEvent = this.ndkEventToEvent(event);
          const joinRequest = this.parseJoinRequest(nostrEvent);
          if (joinRequest && (!eventId || joinRequest.eventId === eventId)) {
            requests.push(joinRequest);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to parse event join request:`, error);
        }
      }

      // Sort by timestamp (newest first)
      requests.sort((a, b) => b.timestamp - a.timestamp);

      // Update cache
      this.cachedRequests.set(cacheKey, requests);
      this.lastCacheUpdate = Date.now();

      console.log(`✅ Found ${requests.length} event join requests`);
      return requests;
    } catch (error) {
      console.error('❌ Failed to fetch event join requests:', error);
      return [];
    }
  }

  /**
   * Get join requests for specific events
   */
  async getEventJoinRequestsByEventIds(
    eventIds: string[]
  ): Promise<Map<string, EventJoinRequest[]>> {
    const requestsByEvent = new Map<string, EventJoinRequest[]>();

    try {
      // Get GlobalNDK instance
      const ndk = await GlobalNDKService.getInstance();

      const filter: NDKFilter = {
        kinds: [1105 as any], // Custom event kind
        '#event-id': eventIds,
        limit: 500,
      };

      // ✅ FIXED: Use fetchEvents instead of subscription to prevent Android crashes
      const events = await ndk.fetchEvents(filter);

      const allRequests: EventJoinRequest[] = [];
      for (const event of events) {
        try {
          const nostrEvent = this.ndkEventToEvent(event);
          const joinRequest = this.parseJoinRequest(nostrEvent);
          if (joinRequest) {
            allRequests.push(joinRequest);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to parse event join request:`, error);
        }
      }

      // Group requests by event
      for (const request of allRequests) {
        const eventRequests = requestsByEvent.get(request.eventId) || [];
        eventRequests.push(request);
        requestsByEvent.set(request.eventId, eventRequests);
      }

      return requestsByEvent;
    } catch (error) {
      console.error('❌ Failed to fetch event join requests by IDs:', error);
      return requestsByEvent;
    }
  }

  /**
   * Subscribe to real-time event join requests
   *
   * ⚠️ DEPRECATED: This method creates persistent subscriptions that cause Android crashes
   * Use getEventJoinRequests() with pull-to-refresh pattern instead
   *
   * If you must use this (e.g., for opt-in notifications), ensure:
   * 1. User explicitly enables real-time notifications in settings
   * 2. Subscription is stopped when app backgrounds
   * 3. AppStateManager checks are in place
   */
  async subscribeToEventJoinRequests(
    captainPubkey: string,
    callback: (joinRequest: EventJoinRequest) => void
  ): Promise<NDKSubscription> {
    console.warn(`⚠️ Using deprecated subscribeToEventJoinRequests - prefer getEventJoinRequests() instead`);
    console.log(`🔔 Subscribing to event join requests for captain`);

    // Get GlobalNDK instance
    const ndk = await GlobalNDKService.getInstance();

    const filter: NDKFilter = {
      kinds: [1105 as any], // Custom event kind
      '#p': [captainPubkey],
      since: Math.floor(Date.now() / 1000),
    };

    const subscription = ndk.subscribe(filter, { closeOnEose: false });

    subscription.on('event', async (event: NDKEvent) => {
      // ✅ CRITICAL: Check if app is active before processing
      const { AppStateManager } = await import('../core/AppStateManager');
      if (!AppStateManager.canDoNetworkOps()) {
        console.log('🔴 App backgrounded, skipping event join request processing');
        return;
      }

      try {
        const nostrEvent = this.ndkEventToEvent(event);
        const joinRequest = this.parseJoinRequest(nostrEvent);
        if (joinRequest) {
          callback(joinRequest);
          console.log(
            `📥 New event join request received: ${joinRequest.eventName}`
          );
        }
      } catch (error) {
        console.warn(`⚠️ Failed to parse real-time event join request:`, error);
      }
    });

    return subscription;
  }

  /**
   * Convert NDKEvent to our Event interface format
   */
  private ndkEventToEvent(ndkEvent: NDKEvent): Event {
    return {
      id: ndkEvent.id || '',
      pubkey: ndkEvent.pubkey || '',
      created_at: ndkEvent.created_at || Math.floor(Date.now() / 1000),
      kind: ndkEvent.kind,
      tags: ndkEvent.tags || [],
      content: ndkEvent.content || '',
      sig: ndkEvent.sig || '',
    };
  }

  /**
   * Parse a Nostr event into EventJoinRequest
   */
  private parseJoinRequest(event: Event): EventJoinRequest | null {
    try {
      // Check if this is a challenge request, not an event join
      const hasActivityTag = event.tags.some((t) => t[0] === 'activity');
      const hasChallengeTypeTag = event.tags.some((t) => t[0] === 'challenge-type');
      if (hasActivityTag || hasChallengeTypeTag) {
        // This is a challenge request, not an event join - skip it
        return null;
      }

      // Verify this is an event join request
      const hasEventJoinTag = event.tags.some(
        (t) => t[0] === 't' && t[1] === 'event-join-request'
      );
      if (!hasEventJoinTag) {
        // Not properly tagged as event join request
        return null;
      }

      const eventIdTag = event.tags.find((t) => t[0] === 'event-id');
      const eventNameTag = event.tags.find((t) => t[0] === 'event-name');
      const teamIdTag = event.tags.find((t) => t[0] === 'team-id');
      const captainTag = event.tags.find((t) => t[0] === 'p');

      if (!eventIdTag || !eventNameTag || !captainTag) {
        return null;
      }

      // Extract payment tags
      const paymentProofTag = event.tags.find((t) => t[0] === 'payment_proof');
      const amountPaidTag = event.tags.find((t) => t[0] === 'amount_paid');
      const paymentTimestampTag = event.tags.find(
        (t) => t[0] === 'payment_timestamp'
      );

      // ✅ NEW: Extract participation type tag
      const participationTypeTag = event.tags.find((t) => t[0] === 'participation_type');

      // Extract payment hash from invoice if present
      let paymentHash: string | undefined;
      if (paymentProofTag?.[1]) {
        paymentHash = this.extractPaymentHashFromInvoice(paymentProofTag[1]);
      }

      return {
        id: event.id || '',
        requesterId: event.pubkey,
        eventId: eventIdTag[1],
        eventName: eventNameTag[1],
        teamId: teamIdTag?.[1] || '',
        captainPubkey: captainTag[1],
        message: event.content || '',
        timestamp: event.created_at || Math.floor(Date.now() / 1000),
        status: 'pending',
        nostrEvent: event,
        // Payment fields
        paymentProof: paymentProofTag?.[1],
        paymentHash,
        amountPaid: amountPaidTag?.[1]
          ? parseInt(amountPaidTag[1], 10)
          : undefined,
        paymentTimestamp: paymentTimestampTag?.[1]
          ? parseInt(paymentTimestampTag[1], 10)
          : undefined,
        // ✅ NEW: Participation type field
        participationType: participationTypeTag?.[1] as 'in-person' | 'virtual' | undefined,
      };
    } catch (error) {
      console.error('❌ Failed to parse event join request:', error);
      return null;
    }
  }

  /**
   * Extract payment hash from Lightning invoice (BOLT11)
   * Payment hash is used for NWC verification via lookupInvoice()
   */
  private extractPaymentHashFromInvoice(invoice: string): string | undefined {
    try {
      // BOLT11 invoices have payment hash embedded in the data section
      // We'll use a simple extraction based on the invoice structure
      // Format: lnbc<amount>1<separator><data><signature>

      // Remove protocol prefix if present
      const cleanInvoice = invoice.toLowerCase().replace(/^lightning:/, '');

      // Find the data section (after first '1' and before last '1')
      const parts = cleanInvoice.split('1');
      if (parts.length < 3) {
        console.warn('⚠️ Invalid invoice format - not enough parts');
        return undefined;
      }

      // The payment hash is encoded in the data section
      // For now, we'll return undefined and rely on the full invoice
      // Real implementation would decode bech32 properly
      // This is a placeholder - Alby SDK can handle full invoices
      return undefined;
    } catch (error) {
      console.error('❌ Failed to extract payment hash from invoice:', error);
      return undefined;
    }
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheExpiryMs;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cachedRequests.clear();
    this.lastCacheUpdate = 0;
  }
}

export default EventJoinRequestService.getInstance();
