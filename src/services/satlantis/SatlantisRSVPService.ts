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
// SatlantisEventJoinService imported dynamically to avoid circular dependency
import type { NDKFilter, NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
import type { SatlantisRSVP, SatlantisRSVPStatus } from '../../types/satlantis';

// NIP-52 Calendar RSVP kind (not in NDK's standard kinds)
const KIND_CALENDAR_RSVP = 31925 as NDKKind;

// Cache TTL in seconds (7 days - refresh via pull-to-refresh)
const CACHE_TTL_RSVPS = 604800; // 7 days

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
   * @param skipCache - Skip cache read (useful for refresh)
   */
  async getEventRSVPs(
    eventPubkey: string,
    eventDTag: string,
    skipCache: boolean = false
  ): Promise<SatlantisRSVP[]> {
    // Note: We use eventDTag for cache key since pubkey might vary between API sources
    const cacheKey = `satlantis_rsvps_${eventDTag}`;

    // Check cache (5-minute TTL) unless skip requested
    if (!skipCache) {
      try {
        const cached = await UnifiedCacheService.get<SatlantisRSVP[]>(cacheKey);
        if (cached && cached.length > 0) {
          // Only use cache if we have actual RSVPs (don't cache empty results)
          console.log(`[Satlantis RSVP] Cache hit: ${cached.length} RSVPs`);
          return cached;
        }
      } catch (error) {
        console.warn('[Satlantis RSVP] Cache read error:', error);
      }
    } else {
      console.log('[Satlantis RSVP] ⏭️ Skipping cache (skipCache=true)');
    }

    const ndk = await GlobalNDKService.getInstance();

    // PRIMARY query: by #d tag (MOST RELIABLE - actually works!)
    // Our RSVPs use d-tag format: rsvp-{eventId}
    // This bypasses the relay indexing issues with #a tag
    const primaryFilter: NDKFilter = {
      kinds: [KIND_CALENDAR_RSVP],
      '#d': [`rsvp-${eventDTag}`],
      limit: 500,
    };

    console.log(`[Satlantis RSVP] Querying RSVPs for event ${eventDTag}`);
    console.log('[Satlantis RSVP] 🔍 PRIMARY query filter (#d tag):', JSON.stringify(primaryFilter));

    let events: Set<NDKEvent> = new Set();
    try {
      events = await Promise.race([
        ndk.fetchEvents(primaryFilter),
        new Promise<Set<NDKEvent>>((resolve) =>
          setTimeout(() => resolve(new Set()), 8000)
        ),
      ]);
    } catch (error) {
      console.error('[Satlantis RSVP] Primary query error:', error);
    }

    console.log('[Satlantis RSVP] 📦 Primary #d query result:', events.size, 'events');

    // SECONDARY query: by #a tag (less reliable but may find additional RSVPs)
    // Only try if we haven't found any RSVPs yet
    if (events.size === 0) {
      const eventRef = `31923:${eventPubkey}:${eventDTag}`;
      console.log('[Satlantis RSVP] 🔍 Secondary query filter (#a tag):', JSON.stringify({
        kinds: [KIND_CALENDAR_RSVP],
        '#a': [eventRef],
      }));

      try {
        const aTagFilter: NDKFilter = {
          kinds: [KIND_CALENDAR_RSVP],
          '#a': [eventRef],
          limit: 500,
        };
        const aTagEvents = await Promise.race([
          ndk.fetchEvents(aTagFilter),
          new Promise<Set<NDKEvent>>((resolve) =>
            setTimeout(() => resolve(new Set()), 8000)
          ),
        ]);
        console.log('[Satlantis RSVP] 📦 Secondary #a query result:', aTagEvents.size, 'events');

        for (const event of aTagEvents) {
          events.add(event);
        }
      } catch (error) {
        console.error('[Satlantis RSVP] Secondary query error:', error);
      }
    }

    // Log all found events for debugging
    if (events.size > 0) {
      for (const event of events) {
        console.log('[Satlantis RSVP] Event:', {
          id: event.id?.slice(0, 16) + '...',
          pubkey: event.pubkey?.slice(0, 16) + '...',
          tags: event.tags?.slice(0, 3),
        });
      }
    }

    const rsvps: SatlantisRSVP[] = [];

    for (const event of events) {
      const rsvp = this.parseRSVP(event, eventDTag);
      if (rsvp) {
        rsvps.push(rsvp);
      }
    }

    // Deduplicate by pubkey (keep most recent RSVP per user)
    const deduped = this.deduplicateRSVPs(rsvps);

    // Only cache if we found RSVPs (don't cache empty results)
    if (deduped.length > 0) {
      try {
        await UnifiedCacheService.setWithCustomTTL(
          cacheKey,
          deduped,
          CACHE_TTL_RSVPS
        );
        console.log('[Satlantis RSVP] 💾 Cached', deduped.length, 'RSVPs');
      } catch (error) {
        console.warn('[Satlantis RSVP] Cache write error:', error);
      }
    } else {
      console.log('[Satlantis RSVP] ⏭️ Not caching empty results');
    }

    console.log(
      `[Satlantis RSVP] Found ${deduped.length} unique RSVPs for event ${eventDTag}`
    );
    return deduped;
  }

  /**
   * Get accepted participants (pubkeys) for an event
   * Merges Nostr RSVPs with local joins (in case RSVP didn't propagate to relays)
   * @param eventPubkey - Event organizer's pubkey
   * @param eventDTag - Event d-tag identifier
   * @param skipCache - If true, bypasses cache and queries Nostr directly
   */
  async getEventParticipants(
    eventPubkey: string,
    eventDTag: string,
    skipCache: boolean = false
  ): Promise<string[]> {
    const rsvps = await this.getEventRSVPs(eventPubkey, eventDTag, skipCache);

    // Get participants from Nostr RSVPs
    const nostrParticipants = rsvps
      .filter((r) => r.status === 'accepted')
      .map((r) => r.pubkey);

    // Dynamic import to avoid circular dependency
    console.log('[Satlantis RSVP] 🔍 Checking for local joins to merge...');
    const { SatlantisEventJoinService } = await import('./SatlantisEventJoinService');

    // Merge with local joins (in case Nostr RSVP didn't propagate)
    const localJoins = await SatlantisEventJoinService.getLocalJoinsForEvent(
      eventPubkey,
      eventDTag
    );
    console.log(`[Satlantis RSVP] Local joins found: ${localJoins.length}, Nostr RSVPs: ${nostrParticipants.length}`);

    // Combine and deduplicate
    const allParticipants = [...new Set([...nostrParticipants, ...localJoins])];

    if (localJoins.length > 0) {
      console.log(`[Satlantis RSVP] 📍 Added ${localJoins.length} local join(s) to participant list`);
      console.log(`[Satlantis RSVP] Total participants after merge: ${allParticipants.length}`);
    }

    return allParticipants;
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
   * First checks Nostr, then falls back to local storage
   */
  async hasUserRSVPd(
    eventPubkey: string,
    eventDTag: string,
    userPubkey: string
  ): Promise<boolean> {
    // First check Nostr
    const participants = await this.getEventParticipants(eventPubkey, eventDTag);
    if (participants.includes(userPubkey)) {
      return true;
    }

    // Fallback: check local storage (in case Nostr RSVP didn't propagate)
    // Dynamic import to avoid circular dependency
    const { SatlantisEventJoinService } = await import('./SatlantisEventJoinService');
    const locallyJoined = await SatlantisEventJoinService.hasLocalJoin(
      eventPubkey,
      eventDTag,
      userPubkey
    );
    if (locallyJoined) {
      console.log('[Satlantis RSVP] 📍 Found local join backup - Nostr RSVP may not have propagated');
      return true;
    }

    return false;
  }

  /**
   * Bulk prefetch participants for multiple events
   * Called during app background initialization for instant event detail screens
   * @param events - Array of events to prefetch participants for
   */
  async prefetchParticipantsForEvents(
    events: { pubkey: string; id: string }[]
  ): Promise<void> {
    console.log(`[Satlantis RSVP] 👥 Bulk prefetching participants for ${events.length} events...`);

    let successCount = 0;
    let errorCount = 0;

    for (const event of events) {
      try {
        // Use skipCache=false to leverage existing cache where available
        await this.getEventParticipants(event.pubkey, event.id, false);
        successCount++;
      } catch (error) {
        console.warn(`[Satlantis RSVP] ⚠️ Failed to prefetch participants for ${event.id}:`, error);
        errorCount++;
      }
    }

    console.log(`[Satlantis RSVP] ✅ Bulk prefetch complete: ${successCount} success, ${errorCount} errors`);
  }

  /**
   * Parse RSVP event (kind 31925)
   *
   * Note: We match by eventDTag (event ID) rather than full eventRef because:
   * - The pubkey in the 'a' tag may differ between API sources and the actual Nostr event
   * - The eventDTag (e.g., "race-mj2q1t9pg5wflh35a") is unique enough to identify the event
   */
  private parseRSVP(
    event: NDKEvent,
    eventDTag: string
  ): SatlantisRSVP | null {
    try {
      const getTag = (name: string) =>
        event.tags.find((t) => t[0] === name)?.[1];

      const aTag = getTag('a');
      const dTag = getTag('d');
      const statusTag = getTag('status');

      // Verify this RSVP is for the correct event
      // Match by event ID in 'a' tag OR by d-tag (more flexible than exact eventRef match)
      const matchesEvent = aTag?.endsWith(`:${eventDTag}`) || dTag === `rsvp-${eventDTag}`;

      if (!matchesEvent) {
        console.log('[Satlantis RSVP] ⚠️ RSVP does not match event:', {
          aTag,
          dTag,
          expectedEventDTag: eventDTag,
        });
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

      console.log('[Satlantis RSVP] ✅ Parsed RSVP:', {
        pubkey: event.pubkey?.slice(0, 16) + '...',
        status,
        aTag: aTag?.slice(0, 50) + '...',
      });

      return {
        pubkey: event.pubkey,
        eventRef: aTag || `unknown:${eventDTag}`,
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
