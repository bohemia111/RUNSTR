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
import { UnifiedWorkoutCache } from '../cache/UnifiedWorkoutCache';
import { nip19 } from 'nostr-tools';
import type { NDKFilter, NDKEvent } from '@nostr-dev-kit/ndk';
import { NostrFetchLogger } from '../../utils/NostrFetchLogger';
import type {
  Season2ActivityType,
  Season2Participant,
  Season2Leaderboard,
  CharityRanking,
  LocalJoin,
} from '../../types/season2';
import {
  SEASON_2_LOCAL_JOINS_KEY,
  SEASON_2_CACHE_TTL,
  getSeason2Timestamps,
  SEASON_2_PARTICIPANTS,
} from '../../constants/season2';
import { SEASON2_BASELINE, SEASON2_CHARITY_BASELINE, getBaselineTotals } from '../../constants/season2Baseline';
import { getCharityById } from '../../constants/charities';

// NOTE: No default charity - users without a charity tag in their workouts
// will simply show no charity name on the leaderboard

// Timeout for Nostr queries (prevents hanging on slow relays)
const FETCH_TIMEOUT_MS = 6000; // 6 seconds - gives relays more time to respond for accurate results

class Season2ServiceClass {
  private static instance: Season2ServiceClass;

  static getInstance(): Season2ServiceClass {
    if (!this.instance) {
      this.instance = new Season2ServiceClass();
    }
    return this.instance;
  }

  /**
   * Fetch events with aggressive timeout using subscription
   * Returns whatever events we have after timeout - doesn't wait for slow relays
   */
  private async fetchEventsWithTimeout(
    ndk: any,
    filter: NDKFilter,
    timeoutMs: number = FETCH_TIMEOUT_MS
  ): Promise<NDKEvent[]> {
    return new Promise((resolve) => {
      const events = new Map<string, NDKEvent>();
      let resolved = false;
      const startTime = Date.now();
      let lastLoggedCount = 0;

      // Log relay status
      const connectedRelays = ndk.pool?.connectedRelays?.() || [];
      console.log(`[Season2] ========== FETCH START ==========`);
      console.log(`[Season2] Timeout: ${timeoutMs}ms`);
      console.log(`[Season2] Connected relays: ${connectedRelays.length}`);
      connectedRelays.forEach((r: any) => console.log(`[Season2]   - ${r.url}`));
      console.log(`[Season2] Filter: authors=${filter.authors?.length || 0}, since=${filter.since}, until=${filter.until}, limit=${filter.limit}`);

      const finishEarly = (reason: string) => {
        if (!resolved) {
          resolved = true;
          // Remove listeners BEFORE stopping to prevent accumulation
          sub.removeAllListeners('event');
          sub.removeAllListeners('eose');
          sub.stop();
          clearTimeout(timeout);
          const elapsed = Date.now() - startTime;
          console.log(`[Season2] ========== FETCH COMPLETE ==========`);
          console.log(`[Season2] Reason: ${reason}`);
          console.log(`[Season2] Duration: ${elapsed}ms`);
          console.log(`[Season2] Events collected: ${events.size}`);
          console.log(`[Season2] =====================================`);
          resolve(Array.from(events.values()));
        }
      };

      // Create subscription - IMPORTANT: Use explicit relay pool to disable Outbox Model
      // This prevents NDK from connecting to 30+ participant relays (5 connections each!)
      const sub = ndk.subscribe(filter, {
        closeOnEose: false,
        pool: ndk.pool,  // Force use of our 3 explicit relays only
        groupable: false, // Don't group with other subscriptions
      });

      // Collect events as they arrive - CHECK TIMEOUT ON EACH EVENT
      sub.on('event', (event: NDKEvent) => {
        if (resolved) return;

        // Check elapsed time on each event - if over timeout, finish early
        if (Date.now() - startTime >= timeoutMs) {
          finishEarly('Timeout (event-based)');
          return;
        }

        if (event.id) {
          events.set(event.id, event);

          // Log progress every 10 events
          if (events.size - lastLoggedCount >= 10) {
            console.log(`[Season2] ... ${events.size} events received (${Date.now() - startTime}ms)`);
            lastLoggedCount = events.size;
          }
        }
      });

      // Backup setTimeout (may not fire if JS thread blocked)
      const timeout = setTimeout(() => finishEarly('Timeout (setTimeout)'), timeoutMs);

      // Resolve on EOSE if it comes before timeout
      sub.on('eose', () => {
        clearTimeout(timeout);
        finishEarly('EOSE');
      });
    });
  }

  // ============================================================================
  // Participant Management
  // ============================================================================

  /**
   * Get all participants (hardcoded list + local joins)
   * INSTANT: No network calls - uses hardcoded SEASON_2_PARTICIPANTS
   * @param currentUserPubkey - Current user's pubkey for local join visibility
   * @param localJoins - Pre-fetched local joins (optional, will fetch if not provided)
   */
  async getParticipants(currentUserPubkey?: string, localJoins?: LocalJoin[]): Promise<string[]> {
    // Use hardcoded participants (no network call needed)
    const officialPubkeys = SEASON_2_PARTICIPANTS.map(p => p.pubkey);

    // Use provided local joins or fetch them
    const joins = localJoins ?? await this.getLocalJoins();

    // Merge: hardcoded list + current user's local join (if any)
    const allParticipants = new Set(officialPubkeys);

    // Only add local joins for the current user viewing
    if (currentUserPubkey) {
      const userLocalJoin = joins.find(
        (j) => j.pubkey === currentUserPubkey
      );
      if (userLocalJoin) {
        allParticipants.add(userLocalJoin.pubkey);
      }
    }

    const participantArray = Array.from(allParticipants);

    console.log(
      `[Season2] Loaded ${participantArray.length} participants (${officialPubkeys.length} hardcoded, ${joins.length} local joins)`
    );
    return participantArray;
  }

  /**
   * Get official participants from hardcoded data (INSTANT, no network)
   */
  async getStoredOfficialParticipants(): Promise<string[]> {
    return SEASON_2_PARTICIPANTS.map(p => p.pubkey);
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
   * INSTANT: Uses stored data, no network calls
   */
  async isUserRegistered(pubkey: string): Promise<{
    isRegistered: boolean;
    isOfficial: boolean;
    isLocalOnly: boolean;
  }> {
    // Use stored data (instant, no network call)
    const [localJoins, officialParticipants] = await Promise.all([
      this.getLocalJoins(),
      this.getStoredOfficialParticipants(),
    ]);

    const isLocal = localJoins.some((j) => j.pubkey === pubkey);
    const isOfficial = officialParticipants.includes(pubkey);

    return {
      isRegistered: isLocal || isOfficial,
      isOfficial,
      isLocalOnly: isLocal && !isOfficial,
    };
  }

  /**
   * Quick check if user has a local join (for instant UI)
   */
  async hasLocalJoin(pubkey: string): Promise<boolean> {
    const localJoins = await this.getLocalJoins();
    return localJoins.some((j) => j.pubkey === pubkey);
  }

  // ============================================================================
  // Leaderboard Calculation
  // ============================================================================

  /**
   * Get leaderboard for specific activity type
   * @param activityType - Running, Walking, or Cycling
   * @param currentUserPubkey - Current user's pubkey for local join visibility
   * @param forceRefresh - Skip cache and fetch fresh from Nostr
   */
  async getLeaderboard(
    activityType: Season2ActivityType,
    currentUserPubkey?: string,
    forceRefresh = false
  ): Promise<Season2Leaderboard> {
    const cacheKey = `season2:leaderboard:${activityType}`;
    const startTime = Date.now();

    console.log(`[Season2] ========== getLeaderboard(${activityType}) ==========`);
    console.log(`[Season2] forceRefresh: ${forceRefresh}, currentUserPubkey: ${currentUserPubkey ? 'yes' : 'no'}`);
    console.log(`[Season2] Cache key: ${cacheKey}`);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await UnifiedCacheService.get<Season2Leaderboard>(cacheKey);
      if (cached && !currentUserPubkey) {
        const cacheAge = Date.now() - (cached.lastUpdated || 0);
        console.log(`[Season2] ✅ CACHE HIT for ${activityType}`);
        console.log(`[Season2]   - Cached participants: ${cached.participants?.length || 0}`);
        console.log(`[Season2]   - Cache age: ${Math.round(cacheAge / 1000)}s`);
        console.log(`[Season2]   - Top 3: ${cached.participants?.slice(0, 3).map(p => `${p.name}:${p.totalDistance.toFixed(1)}km`).join(', ') || 'none'}`);
        return cached;
      }
      console.log(`[Season2] ❌ CACHE MISS - ${cached ? 'has currentUserPubkey' : 'no cached data'}`);
    } else {
      console.log(`[Season2] ⏭️ CACHE SKIP - forceRefresh=true`);
    }

    console.log(`[Season2] Fetching fresh data for ${activityType} leaderboard...`);

    // Get local joins first (needed for both participants and marking users)
    const localJoins = await this.getLocalJoins();

    // Get participants (pass local joins to avoid double fetch)
    const participants = await this.getParticipants(currentUserPubkey, localJoins);
    if (participants.length === 0) {
      return this.emptyLeaderboard(activityType);
    }

    // Use hardcoded profiles instead of fetching from Nostr (instant, always accurate)
    console.log('[Season2] Using hardcoded profiles (no Nostr fetch needed)');
    const profiles = new Map(
      SEASON_2_PARTICIPANTS.map(p => [p.pubkey, { name: p.name, picture: p.picture }])
    );

    // Use stored participants (instant, already fetched by getParticipants above)
    const officialParticipants = await this.getStoredOfficialParticipants();

    // Fetch workouts
    const workouts = await this.fetchWorkouts(participants, activityType);
    console.log(`[Season2] Found ${workouts.length} ${activityType} workouts`);

    // Calculate user distances and charity attribution
    const userStats = new Map<
      string,
      { distance: number; workoutCount: number; charityId?: string }
    >();
    const charityDistances = new Map<string, number>();
    // Track ALL charities each user has contributed to (for accurate participant counts)
    const userCharities = new Map<string, Set<string>>();

    for (const workout of workouts) {
      const existing = userStats.get(workout.pubkey) || {
        distance: 0,
        workoutCount: 0,
        charityId: undefined,
      };

      existing.distance += workout.distance;
      existing.workoutCount += 1;
      if (workout.charityId) {
        existing.charityId = workout.charityId;
      }

      userStats.set(workout.pubkey, existing);

      // Track charity distances (only if charity is specified)
      if (workout.charityId) {
        charityDistances.set(
          workout.charityId,
          (charityDistances.get(workout.charityId) || 0) + workout.distance
        );

        // Track this charity for the user (for accurate participant counts)
        if (!userCharities.has(workout.pubkey)) {
          userCharities.set(workout.pubkey, new Set());
        }
        userCharities.get(workout.pubkey)!.add(workout.charityId);
      }
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

        const charityId = stats?.charityId;
        const charity = charityId ? getCharityById(charityId) : undefined;

        // Get profile data from batch fetch (prevents "Anonymous" bug)
        const profile = profiles.get(pubkey);

        return {
          pubkey,
          npub,
          name: profile?.name,
          picture: profile?.picture,
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

    // Log final leaderboard stats
    const usersWithWorkouts = participantEntries.filter(p => p.totalDistance > 0);
    const totalDistance = participantEntries.reduce((sum, p) => sum + p.totalDistance, 0);
    console.log(`[Season2] ========== LEADERBOARD BUILT (${activityType}) ==========`);
    console.log(`[Season2] Total participants: ${participantEntries.length}`);
    console.log(`[Season2] Users with workouts: ${usersWithWorkouts.length}`);
    console.log(`[Season2] Total distance: ${totalDistance.toFixed(2)} km`);
    console.log(`[Season2] Top 5:`);
    participantEntries.slice(0, 5).forEach((p, i) => {
      console.log(`[Season2]   ${i + 1}. ${p.name || p.pubkey.slice(0, 8)}: ${p.totalDistance.toFixed(2)} km (${p.workoutCount} workouts)`);
    });
    console.log(`[Season2] Duration: ${Date.now() - startTime}ms`);

    // Cache results (5 min TTL)
    console.log(`[Season2] Caching with TTL: ${SEASON_2_CACHE_TTL.LEADERBOARD}ms (${SEASON_2_CACHE_TTL.LEADERBOARD / 60000} minutes)`);
    await UnifiedCacheService.setWithCustomTTL(
      cacheKey,
      leaderboard,
      SEASON_2_CACHE_TTL.LEADERBOARD
    );

    return leaderboard;
  }

  /**
   * Get workouts for participants from UnifiedWorkoutCache
   * READS FROM CACHE - No direct Nostr queries
   */
  private async fetchWorkouts(
    participants: string[],
    activityType: Season2ActivityType
  ): Promise<
    Array<{ pubkey: string; distance: number; charityId?: string }>
  > {
    if (participants.length === 0) return [];

    console.log(`[Season2] Reading ${activityType} workouts from UnifiedWorkoutCache...`);

    // CRITICAL: Ensure cache is loaded before reading to prevent zeros
    const cache = UnifiedWorkoutCache;
    await cache.ensureLoaded();
    console.log(`[Season2] fetchWorkouts() - UnifiedWorkoutCache has ${cache.getStats().totalWorkouts} workouts`);

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

    // Read from UnifiedWorkoutCache (instant, no Nostr query)
    const cachedWorkouts = cache.getWorkoutsByActivity(activityType);

    // Filter by participants
    const workouts = cachedWorkouts
      .filter(w => hexPubkeys.includes(w.pubkey))
      .map(w => ({
        pubkey: w.pubkey,
        distance: w.distance,
        charityId: w.charityId,
      }));

    console.log(`[Season2] Found ${workouts.length} ${activityType} workouts from cache (filtered from ${cachedWorkouts.length})`);
    return workouts;
  }

  /**
   * Get ALL workouts for participants from UnifiedWorkoutCache
   * READS FROM CACHE - No direct Nostr queries
   */
  private async fetchAllWorkouts(
    participants: string[]
  ): Promise<
    Array<{ pubkey: string; distance: number; charityId?: string; activityType: Season2ActivityType }>
  > {
    if (participants.length === 0) return [];

    console.log(`[Season2] Reading ALL workouts from UnifiedWorkoutCache...`);

    // CRITICAL: Ensure cache is loaded before reading to prevent zeros
    const cache = UnifiedWorkoutCache;
    await cache.ensureLoaded();
    console.log(`[Season2] fetchAllWorkouts() - UnifiedWorkoutCache has ${cache.getStats().totalWorkouts} workouts`);

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

    // Read from UnifiedWorkoutCache (instant, no Nostr query)
    const allCachedWorkouts = cache.getAllWorkouts();

    // Filter by participants and convert to expected format
    const workouts: Array<{
      pubkey: string;
      distance: number;
      charityId?: string;
      activityType: Season2ActivityType;
    }> = [];

    for (const w of allCachedWorkouts) {
      if (!hexPubkeys.includes(w.pubkey)) continue;

      // Detect activity type
      const type = w.activityType.toLowerCase();
      let activityType: Season2ActivityType | null = null;

      if (type.includes('run') || type.includes('jog') || type === 'running') {
        activityType = 'running';
      } else if (type.includes('walk') || type.includes('hike') || type === 'walking') {
        activityType = 'walking';
      } else if (type.includes('cycl') || type.includes('bike') || type === 'cycling') {
        activityType = 'cycling';
      } else if (type === 'other' && w.distance > 0) {
        activityType = 'running'; // Default "other" with distance to running
      }

      if (activityType) {
        workouts.push({
          pubkey: w.pubkey,
          distance: w.distance,
          charityId: w.charityId,
          activityType,
        });
      }
    }

    console.log(`[Season2] Found ${workouts.length} workouts from cache (filtered from ${allCachedWorkouts.length})`);
    return workouts;
  }

  /**
   * Parse kind 1301 event and detect activity type
   * Returns null if not a valid workout with distance
   */
  private parseWorkoutEventWithType(
    event: NDKEvent
  ): { pubkey: string; distance: number; charityId?: string; activityType: Season2ActivityType } | null {
    try {
      const getTag = (name: string) =>
        event.tags.find((t) => t[0] === name)?.[1];

      const exerciseType = getTag('exercise')?.toLowerCase();
      const distanceStr = getTag('distance');

      if (!exerciseType || !distanceStr) {
        return null;
      }

      // Parse distance
      const distance = parseFloat(distanceStr);
      if (isNaN(distance) || distance <= 0) {
        return null;
      }

      // Detect activity type
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
      } else if (exerciseType === 'other' && distanceStr) {
        activityType = 'running'; // Default "other" with distance to running
      }

      if (!activityType) {
        return null;
      }

      // Parse charity
      const charityTag = event.tags.find((t) => t[0] === 'charity');
      const charityId = charityTag?.[1];

      return {
        pubkey: event.pubkey,
        distance,
        charityId,
        activityType,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get ALL leaderboards at once (running, walking, cycling)
   * READS FROM UnifiedWorkoutCache - no direct Nostr queries
   */
  async getAllLeaderboards(
    currentUserPubkey?: string,
    forceRefresh = false
  ): Promise<{
    running: Season2Leaderboard;
    walking: Season2Leaderboard;
    cycling: Season2Leaderboard;
  }> {
    const t0 = Date.now();
    NostrFetchLogger.start('Season2.getAllLeaderboards', { forceRefresh });

    console.log(`[Season2] ╔══════════════════════════════════════════════════════╗`);
    console.log(`[Season2] ║        getAllLeaderboards() STARTING                 ║`);
    console.log(`[Season2] ╚══════════════════════════════════════════════════════╝`);
    console.log(`[Season2] forceRefresh: ${forceRefresh}`);
    console.log(`[Season2] currentUserPubkey: ${currentUserPubkey ? currentUserPubkey.slice(0, 12) + '...' : 'none'}`);

    // If forceRefresh, refresh the UnifiedWorkoutCache first
    if (forceRefresh) {
      console.log(`[Season2] ⏭️ Force refreshing UnifiedWorkoutCache...`);
      await UnifiedWorkoutCache.refresh();
    }

    // Check leaderboard cache for all three (unless force refresh)
    if (!forceRefresh) {
      console.log(`[Season2] Checking cache for all 3 leaderboards...`);
      const [cachedRunning, cachedWalking, cachedCycling] = await Promise.all([
        UnifiedCacheService.get<Season2Leaderboard>('season2:leaderboard:running'),
        UnifiedCacheService.get<Season2Leaderboard>('season2:leaderboard:walking'),
        UnifiedCacheService.get<Season2Leaderboard>('season2:leaderboard:cycling'),
      ]);

      console.log(`[Season2] Cache check results:`);
      console.log(`[Season2]   - running: ${cachedRunning ? `✅ ${cachedRunning.participants?.length || 0} participants` : '❌ miss'}`);
      console.log(`[Season2]   - walking: ${cachedWalking ? `✅ ${cachedWalking.participants?.length || 0} participants` : '❌ miss'}`);
      console.log(`[Season2]   - cycling: ${cachedCycling ? `✅ ${cachedCycling.participants?.length || 0} participants` : '❌ miss'}`);

      if (cachedRunning && cachedWalking && cachedCycling) {
        const runningTop = cachedRunning.participants?.slice(0, 3).map(p => `${p.name}:${p.totalDistance.toFixed(1)}km`).join(', ');
        const walkingTop = cachedWalking.participants?.slice(0, 3).map(p => `${p.name}:${p.totalDistance.toFixed(1)}km`).join(', ');
        console.log(`[Season2] ✅ ALL CACHE HIT - returning cached data`);
        console.log(`[Season2]   Running top 3: ${runningTop || 'none'}`);
        console.log(`[Season2]   Walking top 3: ${walkingTop || 'none'}`);
        console.log(`[Season2] Duration: ${Date.now() - t0}ms`);
        NostrFetchLogger.cacheHit('Season2.getAllLeaderboards');
        NostrFetchLogger.end('Season2.getAllLeaderboards', cachedRunning.participants?.length || 0, 'cached');
        return {
          running: cachedRunning,
          walking: cachedWalking,
          cycling: cachedCycling,
        };
      }
      NostrFetchLogger.cacheMiss('Season2.getAllLeaderboards');
      console.log(`[Season2] ❌ CACHE MISS - fetching fresh data from Nostr`);
    } else {
      console.log(`[Season2] ⏭️ CACHE SKIP - forceRefresh=true`);
    }

    // PERFORMANCE: Pre-fetch ALL AsyncStorage data BEFORE Nostr query
    // This prevents AsyncStorage reads from being blocked by NDK network activity
    const [localJoins, officialParticipants] = await Promise.all([
      this.getLocalJoins(),
      this.getStoredOfficialParticipants(),
    ]);

    // Get participants (pass pre-fetched localJoins to avoid duplicate read)
    const participants = await this.getParticipants(currentUserPubkey, localJoins);
    if (participants.length === 0) {
      return {
        running: this.emptyLeaderboard('running'),
        walking: this.emptyLeaderboard('walking'),
        cycling: this.emptyLeaderboard('cycling'),
      };
    }

    // Fetch ALL workouts in ONE query
    console.log(`[Season2] Fetching workouts for ${participants.length} participants...`);
    const allWorkouts = await this.fetchAllWorkouts(participants);

    // Split by activity type
    const workoutsByType: Record<Season2ActivityType, typeof allWorkouts> = {
      running: [],
      walking: [],
      cycling: [],
    };

    for (const workout of allWorkouts) {
      workoutsByType[workout.activityType].push(workout);
    }

    // Log workout breakdown
    console.log(`[Season2] ========== WORKOUT BREAKDOWN ==========`);
    console.log(`[Season2] Total workouts fetched: ${allWorkouts.length}`);
    console.log(`[Season2]   - Running: ${workoutsByType.running.length}`);
    console.log(`[Season2]   - Walking: ${workoutsByType.walking.length}`);
    console.log(`[Season2]   - Cycling: ${workoutsByType.cycling.length}`);

    // Log unique users per activity
    const runningUsers = new Set(workoutsByType.running.map(w => w.pubkey));
    const walkingUsers = new Set(workoutsByType.walking.map(w => w.pubkey));
    const cyclingUsers = new Set(workoutsByType.cycling.map(w => w.pubkey));
    console.log(`[Season2] Unique users: running=${runningUsers.size}, walking=${walkingUsers.size}, cycling=${cyclingUsers.size}`);

    // Build all three leaderboards in parallel (now with pre-fetched data)
    const [running, walking, cycling] = await Promise.all([
      this.buildLeaderboardFromWorkouts('running', participants, workoutsByType.running, localJoins, officialParticipants),
      this.buildLeaderboardFromWorkouts('walking', participants, workoutsByType.walking, localJoins, officialParticipants),
      this.buildLeaderboardFromWorkouts('cycling', participants, workoutsByType.cycling, localJoins, officialParticipants),
    ]);

    // Log final results
    console.log(`[Season2] ========== FINAL LEADERBOARDS ==========`);
    const runTop3 = running.participants.filter(p => p.totalDistance > 0).slice(0, 3);
    const walkTop3 = walking.participants.filter(p => p.totalDistance > 0).slice(0, 3);
    const cycleTop3 = cycling.participants.filter(p => p.totalDistance > 0).slice(0, 3);

    console.log(`[Season2] 🏃 RUNNING - ${running.participants.filter(p => p.totalDistance > 0).length} with workouts`);
    runTop3.forEach((p, i) => console.log(`[Season2]   ${i + 1}. ${p.name}: ${p.totalDistance.toFixed(2)} km`));

    console.log(`[Season2] 🚶 WALKING - ${walking.participants.filter(p => p.totalDistance > 0).length} with workouts`);
    walkTop3.forEach((p, i) => console.log(`[Season2]   ${i + 1}. ${p.name}: ${p.totalDistance.toFixed(2)} km`));

    console.log(`[Season2] 🚴 CYCLING - ${cycling.participants.filter(p => p.totalDistance > 0).length} with workouts`);
    cycleTop3.forEach((p, i) => console.log(`[Season2]   ${i + 1}. ${p.name}: ${p.totalDistance.toFixed(2)} km`));

    // TRULY deferred cache writes - use setTimeout to push ALL work off the main thread
    // This prevents JSON.stringify from blocking during the synchronous Promise creation
    const ttlSeconds = Math.floor(SEASON_2_CACHE_TTL.LEADERBOARD / 1000);
    console.log(`[Season2] Caching all leaderboards with TTL: ${ttlSeconds}s (${ttlSeconds / 60} minutes)`);
    setTimeout(() => {
      Promise.all([
        UnifiedCacheService.setWithCustomTTL('season2:leaderboard:running', running, ttlSeconds),
        UnifiedCacheService.setWithCustomTTL('season2:leaderboard:walking', walking, ttlSeconds),
        UnifiedCacheService.setWithCustomTTL('season2:leaderboard:cycling', cycling, ttlSeconds),
      ]).catch(err => console.warn('[Season2] Cache write failed:', err));
    }, 0);

    console.log(`[Season2] ╔══════════════════════════════════════════════════════╗`);
    console.log(`[Season2] ║  getAllLeaderboards() COMPLETE in ${Date.now() - t0}ms`);
    console.log(`[Season2] ╚══════════════════════════════════════════════════════╝`);

    NostrFetchLogger.end('Season2.getAllLeaderboards', running.participants.length, 'fresh');
    return { running, walking, cycling };
  }

  // ============================================================================
  // Memory-Only Methods (No AsyncStorage - for instant UI updates)
  // ============================================================================

  /**
   * Get single leaderboard from in-memory cache ONLY
   * NO AsyncStorage reads/writes - instant after Nostr fetch completes
   *
   * Used by useSeason2.ts hooks for non-blocking UI updates
   */
  async getLeaderboardFromMemory(
    activityType: Season2ActivityType,
    currentUserPubkey?: string
  ): Promise<Season2Leaderboard> {
    const t0 = Date.now();
    console.log(`[Season2] getLeaderboardFromMemory(${activityType}) - building from memory only`);

    // Use hardcoded participants only (no AsyncStorage read for local joins)
    const officialParticipants = SEASON_2_PARTICIPANTS.map(p => p.pubkey);

    // Season II is exclusive - only official participants appear on leaderboard
    // (Other leaderboards like Daily/January Walking can include non-participants)
    const participants = [...officialParticipants];

    const localJoins: LocalJoin[] = []; // Skip local joins to avoid AsyncStorage

    // Read workouts from in-memory cache
    const allWorkouts = await this.fetchAllWorkouts(participants);

    // Filter by activity type
    const workouts = allWorkouts.filter(w => w.activityType === activityType);

    console.log(`[Season2] Found ${workouts.length} ${activityType} workouts from memory`);

    // Build leaderboard
    const leaderboard = this.buildLeaderboardFromWorkouts(
      activityType,
      participants,
      workouts,
      localJoins,
      officialParticipants,
      currentUserPubkey
    );

    console.log(`[Season2] getLeaderboardFromMemory(${activityType}) complete in ${Date.now() - t0}ms`);
    return leaderboard;
  }

  /**
   * Get ALL leaderboards from in-memory cache ONLY
   * NO AsyncStorage reads/writes - instant after Nostr fetch completes
   *
   * Used by useAllSeason2Leaderboards hook for non-blocking UI updates
   */
  async getAllLeaderboardsFromMemory(currentUserPubkey?: string): Promise<{
    running: Season2Leaderboard;
    walking: Season2Leaderboard;
    cycling: Season2Leaderboard;
  }> {
    const t = { start: Date.now(), participants: 0, workouts: 0, split: 0, build: 0 };
    console.log(`[PERF] ========== getAllLeaderboardsFromMemory START ==========`);

    // Use hardcoded participants only (no AsyncStorage read for local joins)
    const officialParticipants = SEASON_2_PARTICIPANTS.map(p => p.pubkey);

    // Season II is exclusive - only official participants appear on leaderboard
    // (Other leaderboards like Daily/January Walking can include non-participants)
    const participants = [...officialParticipants];

    const localJoins: LocalJoin[] = []; // Skip local joins to avoid AsyncStorage
    t.participants = Date.now();
    console.log(`[PERF] Get participants: ${t.participants - t.start}ms (${participants.length} official participants)`);

    // Read ALL workouts from in-memory cache
    const allWorkouts = await this.fetchAllWorkouts(participants);
    t.workouts = Date.now();
    console.log(`[PERF] fetchAllWorkouts: ${t.workouts - t.participants}ms (${allWorkouts.length} workouts)`);

    // Split by activity type
    const workoutsByType: Record<Season2ActivityType, typeof allWorkouts> = {
      running: [],
      walking: [],
      cycling: [],
    };

    for (const workout of allWorkouts) {
      workoutsByType[workout.activityType].push(workout);
    }
    t.split = Date.now();
    console.log(`[PERF] Split by activity: ${t.split - t.workouts}ms`);
    console.log(`[PERF]   Running=${workoutsByType.running.length}, Walking=${workoutsByType.walking.length}, Cycling=${workoutsByType.cycling.length}`);

    // Build all three leaderboards
    const [running, walking, cycling] = await Promise.all([
      this.buildLeaderboardFromWorkouts('running', participants, workoutsByType.running, localJoins, officialParticipants, currentUserPubkey),
      this.buildLeaderboardFromWorkouts('walking', participants, workoutsByType.walking, localJoins, officialParticipants, currentUserPubkey),
      this.buildLeaderboardFromWorkouts('cycling', participants, workoutsByType.cycling, localJoins, officialParticipants, currentUserPubkey),
    ]);
    t.build = Date.now();
    console.log(`[PERF] Build 3 leaderboards: ${t.build - t.split}ms`);

    console.log(`[PERF] getAllLeaderboardsFromMemory TOTAL: ${t.build - t.start}ms`);
    console.log(`[PERF] ========== getAllLeaderboardsFromMemory END ==========`);
    return { running, walking, cycling };
  }

  /**
   * Build leaderboards from fresh workouts (for fast pull-to-refresh)
   *
   * Takes fresh workouts directly from UnifiedWorkoutCache.refreshForLeaderboard()
   * instead of reading from cache. Combines with baseline data for accurate totals.
   *
   * @param freshWorkouts - Fresh workouts from Nostr query
   * @param currentUserPubkey - Current user's pubkey (for highlighting)
   * @returns All three activity leaderboards
   */
  buildLeaderboardsFromFresh(
    freshWorkouts: Array<{
      id: string;
      pubkey: string;
      activityType: string;
      distance: number;
      charityId?: string;
    }>,
    currentUserPubkey?: string
  ): {
    running: Season2Leaderboard;
    walking: Season2Leaderboard;
    cycling: Season2Leaderboard;
  } {
    const t = { start: Date.now(), split: 0, build: 0 };
    console.log(`[PERF] ========== buildLeaderboardsFromFresh START ==========`);
    console.log(`[PERF] Processing ${freshWorkouts.length} fresh workouts`);

    // Use hardcoded participants only
    const officialParticipants = SEASON_2_PARTICIPANTS.map(p => p.pubkey);
    const participants = [...officialParticipants];
    const localJoins: LocalJoin[] = [];

    // Split fresh workouts by activity type
    const workoutsByType: Record<Season2ActivityType, typeof freshWorkouts> = {
      running: [],
      walking: [],
      cycling: [],
    };

    for (const workout of freshWorkouts) {
      const type = workout.activityType.toLowerCase();
      if (type.includes('run') || type.includes('jog') || type === 'running') {
        workoutsByType.running.push(workout);
      } else if (type.includes('walk') || type.includes('hike') || type === 'walking') {
        workoutsByType.walking.push(workout);
      } else if (type.includes('cycl') || type.includes('bike') || type === 'cycling') {
        workoutsByType.cycling.push(workout);
      }
    }
    t.split = Date.now();
    console.log(`[PERF] Split fresh workouts: ${t.split - t.start}ms`);
    console.log(`[PERF]   Running=${workoutsByType.running.length}, Walking=${workoutsByType.walking.length}, Cycling=${workoutsByType.cycling.length}`);

    // Build all three leaderboards (synchronous - no await needed)
    const running = this.buildLeaderboardFromWorkouts(
      'running', participants, workoutsByType.running, localJoins, officialParticipants, currentUserPubkey
    );
    const walking = this.buildLeaderboardFromWorkouts(
      'walking', participants, workoutsByType.walking, localJoins, officialParticipants, currentUserPubkey
    );
    const cycling = this.buildLeaderboardFromWorkouts(
      'cycling', participants, workoutsByType.cycling, localJoins, officialParticipants, currentUserPubkey
    );
    t.build = Date.now();
    console.log(`[PERF] Build 3 leaderboards: ${t.build - t.split}ms`);

    console.log(`[PERF] buildLeaderboardsFromFresh TOTAL: ${t.build - t.start}ms`);
    console.log(`[PERF] ========== buildLeaderboardsFromFresh END ==========`);
    return { running, walking, cycling };
  }

  /**
   * Get official participant pubkeys (for fast refresh query)
   */
  getParticipantPubkeys(): string[] {
    return SEASON_2_PARTICIPANTS.map(p => p.pubkey);
  }

  /**
   * Build leaderboard from pre-fetched workouts
   *
   * BASELINE + INCREMENTAL APPROACH:
   * 1. Initialize with baseline totals (pre-computed historical data)
   * 2. Add fresh workouts on top (fetched from BASELINE_TIMESTAMP onwards)
   * 3. Result: Accurate totals without fetching 182+ events
   *
   * PERFORMANCE: localJoins and officialParticipants are now passed in (fetched once, not 6x)
   */
  private buildLeaderboardFromWorkouts(
    activityType: Season2ActivityType,
    participants: string[],
    workouts: Array<{ pubkey: string; distance: number; charityId?: string }>,
    localJoins: LocalJoin[],
    officialParticipants: string[],
    currentUserPubkey?: string
  ): Season2Leaderboard {
    const t = { start: Date.now(), profiles: 0, baseline: 0, aggregate: 0, map: 0, sort: 0, charity: 0 };

    // Use hardcoded profiles
    const profiles = new Map(
      SEASON_2_PARTICIPANTS.map(p => [p.pubkey, { name: p.name, picture: p.picture }])
    );
    t.profiles = Date.now();

    // Calculate user distances and charity attribution
    const userStats = new Map<string, { distance: number; workoutCount: number; charityId?: string }>();
    const charityDistances = new Map<string, number>();
    const userCharities = new Map<string, Set<string>>();

    // STEP 0: Initialize charity rankings from CHARITY BASELINE
    // This ensures charity rankings appear even when using user baseline data
    for (const charityBaseline of SEASON2_CHARITY_BASELINE) {
      const baselineData = charityBaseline[activityType];
      if (baselineData.distance > 0) {
        charityDistances.set(charityBaseline.charityId, baselineData.distance);
        // Note: We can't restore individual user->charity mappings from baseline
        // but we preserve the distance totals
      }
    }

    // STEP 1: Initialize with USER BASELINE data (pre-computed historical totals)
    for (const pubkey of participants) {
      const baseline = getBaselineTotals(pubkey);
      const baselineTotals = baseline[activityType];

      if (baselineTotals.count > 0 || baselineTotals.distance > 0) {
        userStats.set(pubkey, {
          distance: baselineTotals.distance,
          workoutCount: baselineTotals.count,
          charityId: undefined, // No default - users without charity selection show none
        });

        // NOTE: Don't add baseline distance to charity totals here anymore
        // It's already included in SEASON2_CHARITY_BASELINE above
      }
    }
    t.baseline = Date.now();

    // STEP 2: Add FRESH workouts on top of baseline
    for (const workout of workouts) {
      const existing = userStats.get(workout.pubkey) || {
        distance: 0,
        workoutCount: 0,
        charityId: undefined,
      };

      existing.distance += workout.distance;
      existing.workoutCount += 1;
      if (workout.charityId) {
        existing.charityId = workout.charityId;
      }

      userStats.set(workout.pubkey, existing);

      // Only track charity distances when charity is specified
      if (workout.charityId) {
        charityDistances.set(workout.charityId, (charityDistances.get(workout.charityId) || 0) + workout.distance);

        if (!userCharities.has(workout.pubkey)) {
          userCharities.set(workout.pubkey, new Set());
        }
        userCharities.get(workout.pubkey)!.add(workout.charityId);
      }
    }
    t.aggregate = Date.now();

    // Build participant entries
    const participantEntries: Season2Participant[] = participants.map((pubkey) => {
      const stats = userStats.get(pubkey);
      const isLocalOnly =
        localJoins.some((j) => j.pubkey === pubkey) &&
        !officialParticipants.includes(pubkey);

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

      const charityId = stats?.charityId;
      const charity = charityId ? getCharityById(charityId) : undefined;
      const profile = profiles.get(pubkey);

      // Private competitor = current user who is NOT in official participant list
      // They can see themselves on leaderboard, but others won't see them
      const isPrivateCompetitor =
        currentUserPubkey !== undefined &&
        pubkey === currentUserPubkey &&
        !officialParticipants.includes(pubkey);

      return {
        pubkey,
        npub,
        name: profile?.name,
        picture: profile?.picture,
        totalDistance: stats?.distance || 0,
        workoutCount: stats?.workoutCount || 0,
        charityId,
        charityName: charity?.name,
        isLocalJoin: isLocalOnly,
        isPrivateCompetitor,
      };
    });
    t.map = Date.now();

    participantEntries.sort((a, b) => b.totalDistance - a.totalDistance);
    t.sort = Date.now();

    const charityRankings = this.buildCharityRankings(charityDistances, userCharities);
    t.charity = Date.now();

    console.log(`[PERF] buildLeaderboard(${activityType}): profiles=${t.profiles - t.start}ms, baseline=${t.baseline - t.profiles}ms, fresh=${t.aggregate - t.baseline}ms, map=${t.map - t.aggregate}ms, sort=${t.sort - t.map}ms, charity=${t.charity - t.sort}ms, TOTAL=${t.charity - t.start}ms`);

    return {
      activityType,
      participants: participantEntries,
      charityRankings,
      lastUpdated: Date.now(),
      totalParticipants: participantEntries.length,
    };
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
      } else if (exerciseType === 'other' && distanceStr) {
        // Include "other" workouts with distance in the running category
        activityType = 'running';
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

  /**
   * Get profiles from hardcoded SEASON_2_PARTICIPANTS data
   * No network call needed - instant lookup from hardcoded data
   */
  private async batchFetchProfiles(
    pubkeys: string[]
  ): Promise<Map<string, { name?: string; picture?: string }>> {
    const profileMap = new Map<string, { name?: string; picture?: string }>();

    if (pubkeys.length === 0) return profileMap;

    // Build lookup map from hardcoded participants
    const hardcodedMap = new Map<string, { name: string; picture?: string }>();
    for (const participant of SEASON_2_PARTICIPANTS) {
      hardcodedMap.set(participant.pubkey, {
        name: participant.name,
        picture: participant.picture,
      });
    }

    // Match pubkeys to hardcoded data
    for (const pubkey of pubkeys) {
      // Convert npub to hex if needed for lookup
      let hexPubkey = pubkey;
      if (pubkey.startsWith('npub1')) {
        try {
          const decoded = nip19.decode(pubkey);
          hexPubkey = decoded.data as string;
        } catch (e) {
          continue; // Skip invalid npubs
        }
      }

      const profile = hardcodedMap.get(hexPubkey);
      if (profile) {
        profileMap.set(hexPubkey, profile);
      }
    }

    console.log(`[Season2] Using ${profileMap.size} hardcoded profiles (no network fetch)`);
    return profileMap;
  }
}

// Export singleton instance
export const Season2Service = Season2ServiceClass.getInstance();
export default Season2Service;
