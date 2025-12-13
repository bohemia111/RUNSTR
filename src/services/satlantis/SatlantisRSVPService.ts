/**
 * SatlantisRSVPService - Fetch RSVPs (kind 31925) for calendar events
 *
 * RSVPs are separate Nostr events that reference calendar events via the `a` tag.
 * This service fetches and parses RSVPs to get participant lists for events.
 *
 * Usage:
 * ```typescript
 * const rsvps = await SatlantisRSVPService.getEventRSVPs(pubkey, dTag);
 * const participants = await SatlantisRSVPService.getEventParticipants(pubkey, dTag);
 * ```
 */

import { GlobalNDKService } from '../nostr/GlobalNDKService';
import { UnifiedCacheService } from '../cache/UnifiedCacheService';
import type { NDKFilter, NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
import type { SatlantisRSVP, SatlantisRSVPStatus } from '../../types/satlantis';

// NIP-52 Calendar RSVP kind (not in NDK's standard kinds)
const KIND_CALENDAR_RSVP = 31925 as NDKKind;

// Cache TTL in seconds
const CACHE_TTL_RSVPS = 300; // 5 minutes

class SatlantisRSVPServiceClass {
  private static instance: SatlantisRSVPServiceClass;

  static getInstance(): SatlantisRSVPServiceClass {
    if (!this.instance) {
      this.instance = new SatlantisRSVPServiceClass();
    }
    return this.instance;
  }

  /**
   * Get all RSVPs for an event
   * @param eventPubkey - Event organizer's pubkey (hex format)
   * @param eventDTag - Event's d-tag identifier
   */
  async getEventRSVPs(
    eventPubkey: string,
    eventDTag: string
  ): Promise<SatlantisRSVP[]> {
    const eventRef = `31923:${eventPubkey}:${eventDTag}`;
    const cacheKey = `satlantis_rsvps_${eventRef}`;

    // Check cache (5-minute TTL)
    try {
      const cached = await UnifiedCacheService.get<SatlantisRSVP[]>(cacheKey);
      if (cached) {
        console.log(`[Satlantis RSVP] Cache hit: ${cached.length} RSVPs`);
        return cached;
      }
    } catch (error) {
      console.warn('[Satlantis RSVP] Cache read error:', error);
    }

    const ndk = await GlobalNDKService.getInstance();

    const filter: NDKFilter = {
      kinds: [KIND_CALENDAR_RSVP],
      '#a': [eventRef],
      limit: 500,
    };

    console.log(`[Satlantis RSVP] Querying RSVPs for event ${eventDTag}`);

    let events: Set<NDKEvent>;
    try {
      events = await Promise.race([
        ndk.fetchEvents(filter),
        new Promise<Set<NDKEvent>>((resolve) =>
          setTimeout(() => resolve(new Set()), 8000)
        ),
      ]);
    } catch (error) {
      console.error('[Satlantis RSVP] Query error:', error);
      events = new Set();
    }

    const rsvps: SatlantisRSVP[] = [];

    for (const event of events) {
      const rsvp = this.parseRSVP(event, eventRef);
      if (rsvp) {
        rsvps.push(rsvp);
      }
    }

    // Deduplicate by pubkey (keep most recent RSVP per user)
    const deduped = this.deduplicateRSVPs(rsvps);

    // Cache results
    try {
      await UnifiedCacheService.setWithCustomTTL(
        cacheKey,
        deduped,
        CACHE_TTL_RSVPS
      );
    } catch (error) {
      console.warn('[Satlantis RSVP] Cache write error:', error);
    }

    console.log(
      `[Satlantis RSVP] Found ${deduped.length} unique RSVPs for event ${eventDTag}`
    );
    return deduped;
  }

  /**
   * Get accepted participants (pubkeys) for an event
   * This is a convenience method that filters for accepted RSVPs only
   */
  async getEventParticipants(
    eventPubkey: string,
    eventDTag: string
  ): Promise<string[]> {
    const rsvps = await this.getEventRSVPs(eventPubkey, eventDTag);

    return rsvps
      .filter((r) => r.status === 'accepted')
      .map((r) => r.pubkey);
  }

  /**
   * Get participant count for an event (for display in event cards)
   */
  async getParticipantCount(
    eventPubkey: string,
    eventDTag: string
  ): Promise<number> {
    const participants = await this.getEventParticipants(eventPubkey, eventDTag);
    return participants.length;
  }

  /**
   * Check if a specific user has RSVP'd to an event
   */
  async hasUserRSVPd(
    eventPubkey: string,
    eventDTag: string,
    userPubkey: string
  ): Promise<boolean> {
    const participants = await this.getEventParticipants(eventPubkey, eventDTag);
    return participants.includes(userPubkey);
  }

  /**
   * Parse RSVP event (kind 31925)
   */
  private parseRSVP(
    event: NDKEvent,
    expectedEventRef: string
  ): SatlantisRSVP | null {
    try {
      const getTag = (name: string) =>
        event.tags.find((t) => t[0] === name)?.[1];

      const aTag = getTag('a');
      const statusTag = getTag('status');

      // Verify this RSVP is for the correct event
      if (aTag !== expectedEventRef) {
        return null;
      }

      // Parse status - default to 'accepted' if not specified
      let status: SatlantisRSVPStatus = 'accepted';
      if (statusTag) {
        const lowerStatus = statusTag.toLowerCase();
        if (
          lowerStatus === 'accepted' ||
          lowerStatus === 'declined' ||
          lowerStatus === 'tentative'
        ) {
          status = lowerStatus as SatlantisRSVPStatus;
        }
      }

      return {
        pubkey: event.pubkey,
        eventRef: aTag,
        status,
        createdAt: event.created_at || 0,
      };
    } catch (error) {
      console.error('[Satlantis RSVP] Failed to parse:', error);
      return null;
    }
  }

  /**
   * Deduplicate RSVPs - keep most recent per user
   * Users can update their RSVP status, so we need the latest one
   */
  private deduplicateRSVPs(rsvps: SatlantisRSVP[]): SatlantisRSVP[] {
    const byPubkey = new Map<string, SatlantisRSVP>();

    for (const rsvp of rsvps) {
      const existing = byPubkey.get(rsvp.pubkey);
      if (!existing || rsvp.createdAt > existing.createdAt) {
        byPubkey.set(rsvp.pubkey, rsvp);
      }
    }

    return Array.from(byPubkey.values());
  }
}

// Export singleton instance
export const SatlantisRSVPService = SatlantisRSVPServiceClass.getInstance();
export default SatlantisRSVPService;
