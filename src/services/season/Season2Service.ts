/**
 * Season2Service - RUNSTR Season 2 Competition Service
 *
 * Two-month distance-based competition with charity integration.
 * January 1 - March 1, 2025
 *
 * Features:
 * - Participant management (local joins + official kind 30000 list)
 * - Leaderboard calculation by activity type
 * - Charity rankings aggregation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlobalNDKService } from '../nostr/GlobalNDKService';
import { UnifiedCacheService } from '../cache/UnifiedCacheService';
import { nip19 } from 'nostr-tools';
import type { NDKFilter, NDKEvent } from '@nostr-dev-kit/ndk';
import type {
  Season2ActivityType,
  Season2Participant,
  Season2Leaderboard,
  CharityRanking,
  LocalJoin,
} from '../../types/season2';
import {
  SEASON_2_CONFIG,
  SEASON_2_LOCAL_JOINS_KEY,
  SEASON_2_CACHE_TTL,
  getSeason2Timestamps,
} from '../../constants/season2';
import { CHARITIES, getCharityById } from '../../constants/charities';

// Default charity when none specified
const DEFAULT_CHARITY_ID = 'opensats';

class Season2ServiceClass {
  private static instance: Season2ServiceClass;

  static getInstance(): Season2ServiceClass {
    if (!this.instance) {
      this.instance = new Season2ServiceClass();
    }
    return this.instance;
  }

  // ============================================================================
  // Participant Management
  // ============================================================================

  /**
   * Get all participants (local joins + official list)
   * Local joins are only visible to the user who joined
   */
  async getParticipants(currentUserPubkey?: string): Promise<string[]> {
    const cacheKey = 'season2:participants';

    // Check cache first
    const cached = await UnifiedCacheService.get<string[]>(cacheKey);
    if (cached && !currentUserPubkey) {
      console.log(`[Season2] Cache hit: ${cached.length} participants`);
      return cached;
    }

    // Fetch official list from Nostr
    const officialParticipants = await this.fetchOfficialParticipants();

    // Get local joins
    const localJoins = await this.getLocalJoins();

    // Merge: official list + current user's local join (if any)
    const allParticipants = new Set(officialParticipants);

    // Only add local joins for the current user viewing
    if (currentUserPubkey) {
      const userLocalJoin = localJoins.find(
        (j) => j.pubkey === currentUserPubkey
      );
      if (userLocalJoin) {
        allParticipants.add(userLocalJoin.pubkey);
      }
    }

    const participantArray = Array.from(allParticipants);

    // Cache official participants only (5 min TTL)
    if (officialParticipants.length > 0) {
      await UnifiedCacheService.setWithCustomTTL(
        cacheKey,
        officialParticipants,
        SEASON_2_CACHE_TTL.PARTICIPANTS
      );
    }

    console.log(
      `[Season2] Loaded ${participantArray.length} participants (${officialParticipants.length} official, ${localJoins.length} local)`
    );
    return participantArray;
  }

  /**
   * Fetch official participants from kind 30000 list
   */
  private async fetchOfficialParticipants(): Promise<string[]> {
    try {
      const connected = await GlobalNDKService.waitForMinimumConnection(2, 4000);
      if (!connected) {
        console.warn('[Season2] Proceeding with minimal relay connectivity');
      }

      const ndk = await GlobalNDKService.getInstance();

      const filter: NDKFilter = {
        kinds: [30000],
        authors: [SEASON_2_CONFIG.adminPubkey],
        '#d': [SEASON_2_CONFIG.participantListDTag],
        limit: 1,
      };

      console.log('[Season2] Fetching official participant list...');

      const events = await Promise.race([
        ndk.fetchEvents(filter),
        new Promise<Set<NDKEvent>>((resolve) =>
          setTimeout(() => resolve(new Set()), 8000)
        ),
      ]);

      if (events.size === 0) {
        console.log('[Season2] No official participant list found');
        return [];
      }

      // Get the most recent event
      const sortedEvents = Array.from(events).sort(
        (a, b) => (b.created_at || 0) - (a.created_at || 0)
      );
      const listEvent = sortedEvents[0];

      // Extract pubkeys from 'p' tags
      const participants = listEvent.tags
        .filter((t) => t[0] === 'p')
        .map((t) => t[1]);

      console.log('[Season2] Official participants:', {
        count: participants.length,
        sample: participants.slice(0, 3).map(p => p.slice(0, 16) + '...'),
        adminPubkey: SEASON_2_CONFIG.adminPubkey.slice(0, 16) + '...',
        dTag: SEASON_2_CONFIG.participantListDTag,
      });
      return participants;
    } catch (error) {
      console.error('[Season2] Error fetching official participants:', error);
      return [];
    }
  }

  /**
   * Get local joins from AsyncStorage
   */
  async getLocalJoins(): Promise<LocalJoin[]> {
    try {
      const stored = await AsyncStorage.getItem(SEASON_2_LOCAL_JOINS_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error('[Season2] Error reading local joins:', error);
      return [];
    }
  }

  /**
   * Add user to local joins (called when user clicks "I Already Paid")
   */
  async joinLocally(pubkey: string): Promise<void> {
    try {
      const localJoins = await this.getLocalJoins();

      // Check if already joined
      if (localJoins.some((j) => j.pubkey === pubkey)) {
        console.log('[Season2] User already joined locally');
        return;
      }

      const newJoin: LocalJoin = {
        pubkey,
        joinedAt: Date.now(),
      };

      localJoins.push(newJoin);
      await AsyncStorage.setItem(
        SEASON_2_LOCAL_JOINS_KEY,
        JSON.stringify(localJoins)
      );

      console.log(`[Season2] User joined locally: ${pubkey.slice(0, 12)}...`);
    } catch (error) {
      console.error('[Season2] Error saving local join:', error);
      throw error;
    }
  }

  /**
   * Check if user is registered (local or official)
   */
  async isUserRegistered(pubkey: string): Promise<{
    isRegistered: boolean;
    isOfficial: boolean;
    isLocalOnly: boolean;
  }> {
    const [localJoins, officialParticipants] = await Promise.all([
      this.getLocalJoins(),
      this.fetchOfficialParticipants(),
    ]);

    const isLocal = localJoins.some((j) => j.pubkey === pubkey);
    const isOfficial = officialParticipants.includes(pubkey);

    return {
      isRegistered: isLocal || isOfficial,
      isOfficial,
      isLocalOnly: isLocal && !isOfficial,
    };
  }

  // ============================================================================
  // Leaderboard Calculation
  // ============================================================================

  /**
   * Get leaderboard for specific activity type
   */
  async getLeaderboard(
    activityType: Season2ActivityType,
    currentUserPubkey?: string
  ): Promise<Season2Leaderboard> {
    const cacheKey = `season2:leaderboard:${activityType}`;

    // Check cache first (but include current user's local status)
    const cached = await UnifiedCacheService.get<Season2Leaderboard>(cacheKey);
    if (cached && !currentUserPubkey) {
      console.log(`[Season2] Cache hit for ${activityType} leaderboard`);
      return cached;
    }

    console.log(`[Season2] Calculating ${activityType} leaderboard...`);

    // Get participants
    const participants = await this.getParticipants(currentUserPubkey);
    if (participants.length === 0) {
      return this.emptyLeaderboard(activityType);
    }

    // Get local joins for marking local-only users
    const localJoins = await this.getLocalJoins();
    const officialParticipants = await this.fetchOfficialParticipants();

    // Fetch workouts
    const workouts = await this.fetchWorkouts(participants, activityType);
    console.log(`[Season2] Found ${workouts.length} ${activityType} workouts`);

    // Calculate user distances and charity attribution
    const userStats = new Map<
      string,
      { distance: number; workoutCount: number; charityId: string }
    >();
    const charityDistances = new Map<string, number>();
    // Track ALL charities each user has contributed to (for accurate participant counts)
    const userCharities = new Map<string, Set<string>>();

    for (const workout of workouts) {
      const existing = userStats.get(workout.pubkey) || {
        distance: 0,
        workoutCount: 0,
        charityId: DEFAULT_CHARITY_ID,
      };

      existing.distance += workout.distance;
      existing.workoutCount += 1;
      if (workout.charityId) {
        existing.charityId = workout.charityId;
      }

      userStats.set(workout.pubkey, existing);

      // Track charity distances
      const charityId = workout.charityId || DEFAULT_CHARITY_ID;
      charityDistances.set(
        charityId,
        (charityDistances.get(charityId) || 0) + workout.distance
      );

      // Track this charity for the user (for accurate participant counts)
      if (!userCharities.has(workout.pubkey)) {
        userCharities.set(workout.pubkey, new Set());
      }
      userCharities.get(workout.pubkey)!.add(charityId);
    }

    // Build participant entries (including those with 0 workouts)
    const participantEntries: Season2Participant[] = participants.map(
      (pubkey) => {
        const stats = userStats.get(pubkey);
        const isLocalOnly =
          localJoins.some((j) => j.pubkey === pubkey) &&
          !officialParticipants.includes(pubkey);

        // Convert hex to npub if needed
        let npub: string | undefined;
        try {
          if (pubkey.length === 64 && /^[0-9a-f]+$/i.test(pubkey)) {
            npub = nip19.npubEncode(pubkey);
          } else if (pubkey.startsWith('npub1')) {
            npub = pubkey;
          }
        } catch (e) {
          // Ignore encoding errors
        }

        const charityId = stats?.charityId || DEFAULT_CHARITY_ID;
        const charity = getCharityById(charityId);

        return {
          pubkey,
          npub,
          totalDistance: stats?.distance || 0,
          workoutCount: stats?.workoutCount || 0,
          charityId,
          charityName: charity?.name,
          isLocalJoin: isLocalOnly,
        };
      }
    );

    // Sort by total distance (descending)
    participantEntries.sort((a, b) => b.totalDistance - a.totalDistance);

    // Build charity rankings (pass userCharities for accurate participant counts)
    const charityRankings = this.buildCharityRankings(
      charityDistances,
      userCharities
    );

    const leaderboard: Season2Leaderboard = {
      activityType,
      participants: participantEntries,
      charityRankings,
      lastUpdated: Date.now(),
      totalParticipants: participantEntries.length,
    };

    // Cache results (5 min TTL)
    await UnifiedCacheService.setWithCustomTTL(
      cacheKey,
      leaderboard,
      SEASON_2_CACHE_TTL.LEADERBOARD
    );

    return leaderboard;
  }

  /**
   * Fetch workouts for participants within season date range
   */
  private async fetchWorkouts(
    participants: string[],
    activityType: Season2ActivityType
  ): Promise<
    Array<{ pubkey: string; distance: number; charityId?: string }>
  > {
    if (participants.length === 0) return [];

    const { since, until } = getSeason2Timestamps();

    try {
      const ndk = await GlobalNDKService.getInstance();

      // Convert npubs to hex if needed
      const hexPubkeys: string[] = [];
      for (const pubkey of participants) {
        if (pubkey.startsWith('npub1')) {
          try {
            const decoded = nip19.decode(pubkey);
            hexPubkeys.push(decoded.data as string);
          } catch (e) {
            console.warn(`[Season2] Failed to decode npub: ${pubkey}`);
          }
        } else if (pubkey.length === 64 && /^[0-9a-f]+$/i.test(pubkey)) {
          hexPubkeys.push(pubkey);
        }
      }

      if (hexPubkeys.length === 0) {
        console.warn('[Season2] No valid pubkeys for workout query');
        return [];
      }

      const filter: NDKFilter = {
        kinds: [1301 as any],
        authors: hexPubkeys,
        since,
        until,
        limit: 1000,
      };

      console.log('[Season2] Workout query:', {
        participant_count: hexPubkeys.length,
        sample_authors: hexPubkeys.slice(0, 2).map(p => p.slice(0, 16) + '...'),
        since: new Date(since * 1000).toISOString(),
        until: new Date(until * 1000).toISOString(),
        activityType,
      });

      // Use subscription with timeout and deduplication
      const events: NDKEvent[] = [];
      const seenEventIds = new Set<string>();
      const subscription = ndk.subscribe(filter, { closeOnEose: false });

      subscription.on('event', (event: NDKEvent) => {
        // Deduplicate events from multiple relays
        if (event.id && !seenEventIds.has(event.id)) {
          seenEventIds.add(event.id);
          events.push(event);
        }
      });

      // Wait 5 seconds then stop
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          subscription.stop();
          resolve();
        }, 5000);
      });

      console.log('[Season2] Raw events received:', {
        uniqueCount: events.length,
        duplicatesFiltered: seenEventIds.size - events.length,
        sample: events.slice(0, 3).map(e => ({
          id: e.id?.slice(0, 12),
          pubkey: e.pubkey?.slice(0, 12),
          tags: e.tags?.slice(0, 5).map(t => [t[0], t[1]?.slice(0, 20)]),
        })),
      });

      // Parse workouts
      const workouts: Array<{
        pubkey: string;
        distance: number;
        charityId?: string;
      }> = [];

      for (const event of events) {
        const parsed = this.parseWorkoutEvent(event, activityType);
        if (parsed) {
          workouts.push(parsed);
        }
      }

      console.log(`[Season2] Parsed ${workouts.length}/${events.length} events as ${activityType}`);
      return workouts;
    } catch (error) {
      console.error('[Season2] Error fetching workouts:', error);
      return [];
    }
  }

  /**
   * Parse kind 1301 workout event
   */
  private parseWorkoutEvent(
    event: NDKEvent,
    targetActivityType: Season2ActivityType
  ): { pubkey: string; distance: number; charityId?: string } | null {
    try {
      const getTag = (name: string) =>
        event.tags.find((t) => t[0] === name)?.[1];

      const exerciseType = getTag('exercise')?.toLowerCase();
      const distanceStr = getTag('distance');

      // Debug: log what we're parsing
      console.log('[Season2] Parsing event:', {
        id: event.id?.slice(0, 12),
        exerciseTag: exerciseType,
        distanceTag: distanceStr,
        targetType: targetActivityType,
      });

      // Filter by activity type
      if (!exerciseType) {
        console.log('[Season2] SKIP: No exercise tag');
        return null;
      }

      // Map exercise types to our activity types
      let activityType: Season2ActivityType | null = null;
      if (
        exerciseType.includes('run') ||
        exerciseType.includes('jog') ||
        exerciseType === 'running'
      ) {
        activityType = 'running';
      } else if (
        exerciseType.includes('walk') ||
        exerciseType.includes('hike') ||
        exerciseType === 'walking'
      ) {
        activityType = 'walking';
      } else if (
        exerciseType.includes('cycl') ||
        exerciseType.includes('bike') ||
        exerciseType === 'cycling'
      ) {
        activityType = 'cycling';
      }

      if (activityType !== targetActivityType) {
        console.log(`[Season2] SKIP: Type mismatch (${exerciseType} -> ${activityType}, want ${targetActivityType})`);
        return null;
      }

      // Parse distance
      if (!distanceStr) {
        console.log('[Season2] SKIP: No distance tag');
        return null;
      }
      const distance = parseFloat(distanceStr);
      if (isNaN(distance) || distance <= 0) {
        console.log(`[Season2] SKIP: Invalid distance (${distanceStr})`);
        return null;
      }

      // Parse charity
      const charityTag = event.tags.find((t) => t[0] === 'charity');
      const charityId = charityTag?.[1];

      console.log(`[Season2] MATCH: ${exerciseType} ${distance}km`);
      return {
        pubkey: event.pubkey,
        distance,
        charityId,
      };
    } catch (error) {
      console.error('[Season2] Parse error:', error);
      return null;
    }
  }

  /**
   * Build charity rankings from aggregated distances
   * Uses userCharities map to correctly count participants per charity
   */
  private buildCharityRankings(
    charityDistances: Map<string, number>,
    userCharities: Map<string, Set<string>>
  ): CharityRanking[] {
    // Count participants per charity (count users who contributed to each charity)
    const charityParticipants = new Map<string, number>();
    for (const [_pubkey, charities] of userCharities) {
      for (const charityId of charities) {
        charityParticipants.set(
          charityId,
          (charityParticipants.get(charityId) || 0) + 1
        );
      }
    }

    // Build rankings
    const rankings: CharityRanking[] = [];

    for (const [charityId, totalDistance] of charityDistances) {
      const charity = getCharityById(charityId);
      if (!charity) continue;

      rankings.push({
        rank: 0, // Will be set after sorting
        charityId,
        charityName: charity.name,
        lightningAddress: charity.lightningAddress,
        totalDistance,
        participantCount: charityParticipants.get(charityId) || 0,
      });
    }

    // Sort by total distance (descending)
    rankings.sort((a, b) => b.totalDistance - a.totalDistance);

    // Assign ranks
    rankings.forEach((r, i) => {
      r.rank = i + 1;
    });

    return rankings;
  }

  /**
   * Return empty leaderboard structure
   */
  private emptyLeaderboard(activityType: Season2ActivityType): Season2Leaderboard {
    return {
      activityType,
      participants: [],
      charityRankings: [],
      lastUpdated: Date.now(),
      totalParticipants: 0,
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    console.log('[Season2] Clearing caches...');
    await Promise.all([
      UnifiedCacheService.invalidate('season2:participants'),
      UnifiedCacheService.invalidate('season2:leaderboard:running'),
      UnifiedCacheService.invalidate('season2:leaderboard:walking'),
      UnifiedCacheService.invalidate('season2:leaderboard:cycling'),
    ]);
  }

  /**
   * Format distance for display
   */
  formatDistance(meters: number): string {
    const km = meters;
    if (km >= 1000) {
      return `${(km / 1000).toFixed(0)}k km`;
    }
    return `${km.toFixed(1)} km`;
  }
}

// Export singleton instance
export const Season2Service = Season2ServiceClass.getInstance();
export default Season2Service;
