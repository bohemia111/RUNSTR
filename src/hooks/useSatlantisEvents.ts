/**
 * useSatlantisEvents - React hooks for Satlantis event discovery and detail
 *
 * INSTANT LEADERBOARDS: Uses UnifiedWorkoutCache for instant leaderboard display
 * - UnifiedWorkoutCache fetches Season II participants + user workouts
 * - Leaderboards read from cache (instant) instead of querying Nostr (5-8s)
 * - Pull-to-refresh updates the shared cache across all leaderboards
 * - Keep FrozenEventStore for ended events only
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SatlantisEventService } from '../services/satlantis/SatlantisEventService';
import { SatlantisRSVPService } from '../services/satlantis/SatlantisRSVPService';
import { UnifiedEventParticipantService } from '../services/satlantis/UnifiedEventParticipantService';
import { WorkoutMetrics } from '../services/competition/Competition1301QueryService';
import { SatlantisEventScoringService } from '../services/scoring/SatlantisEventScoringService';
import { UnifiedCacheService } from '../services/cache/UnifiedCacheService';
import { FrozenEventStore } from '../services/cache/FrozenEventStore';
import { AppStateManager } from '../services/core/AppStateManager';
import { UnifiedWorkoutCache, CachedWorkout } from '../services/cache/UnifiedWorkoutCache';
import type {
  SatlantisEvent,
  SatlantisEventFilter,
  SatlantisLeaderboardEntry,
  SatlantisEventStatus,
} from '../types/satlantis';
import type { TeamLeaderboardEntry } from '../types/runstrEvent';
import {
  getEventStatus,
  mapSportToActivityType,
} from '../types/satlantis';

// ============================================================================
// Helper: Normalize pubkey to hex format (fixes duplicate entries)
// ============================================================================

/**
 * Normalize any pubkey format (npub or hex) to hex
 * This prevents duplicate entries when mixing npub and hex formats
 */
function normalizeToHex(pubkey: string): string {
  if (!pubkey) return pubkey;
  if (pubkey.startsWith('npub')) {
    try {
      const { nip19 } = require('@nostr-dev-kit/ndk');
      const decoded = nip19.decode(pubkey);
      return decoded.data as string;
    } catch (err) {
      console.warn(`[normalizeToHex] Failed to decode npub: ${pubkey.slice(0, 16)}...`);
      return pubkey;
    }
  }
  return pubkey;
}

/**
 * Normalize array of pubkeys to hex format and deduplicate
 */
function normalizeAndDeduplicatePubkeys(pubkeys: string[]): string[] {
  const normalized = pubkeys.map(normalizeToHex);
  return [...new Set(normalized)];
}

// ============================================================================
// Helper: Convert CachedWorkout[] from UnifiedWorkoutCache to WorkoutMetrics
// ============================================================================

/**
 * Convert CachedWorkout[] from UnifiedWorkoutCache to Map<string, WorkoutMetrics>
 * format that SatlantisEventScoringService.buildLeaderboard() expects
 *
 * Note: CachedWorkout has distance in km (not meters like StoredWorkout)
 */
function convertCachedWorkoutsToMetrics(
  cachedWorkouts: CachedWorkout[],
  activityType: string
): Map<string, WorkoutMetrics> {
  const metrics = new Map<string, WorkoutMetrics>();

  // Group workouts by pubkey
  const grouped = new Map<string, CachedWorkout[]>();
  for (const workout of cachedWorkouts) {
    // Filter by activity type
    const type = workout.activityType.toLowerCase();
    const targetType = activityType.toLowerCase();

    // Match activity type (same logic as UnifiedWorkoutCache.getWorkoutsByActivity)
    let matches = false;
    if (targetType === 'running') {
      matches = type.includes('run') || type.includes('jog') || type === 'running';
    } else if (targetType === 'walking') {
      matches = type.includes('walk') || type.includes('hike') || type === 'walking';
    } else if (targetType === 'cycling') {
      matches = type.includes('cycl') || type.includes('bike') || type === 'cycling';
    } else {
      matches = type === targetType;
    }

    if (!matches) continue;

    const pubkey = workout.pubkey;
    if (!grouped.has(pubkey)) {
      grouped.set(pubkey, []);
    }
    grouped.get(pubkey)!.push(workout);
  }

  // Convert each group to WorkoutMetrics format
  for (const [pubkey, workouts] of grouped) {
    // Convert CachedWorkout to NostrWorkout-like format for scoring service
    const nostrWorkouts = workouts.map(cached => ({
      id: cached.id,
      source: 'nostr' as const,
      type: cached.activityType,
      activityType: cached.activityType,
      startTime: new Date(cached.createdAt * 1000).toISOString(),
      endTime: new Date((cached.createdAt + (cached.duration || 0)) * 1000).toISOString(),
      duration: cached.duration || 0,                    // seconds
      distance: (cached.distance || 0) * 1000,           // km → meters for NostrWorkout format
      calories: 0,                                        // Not tracked in CachedWorkout
      averageHeartRate: 0,
      maxHeartRate: 0,
      nostrEventId: cached.id,
      nostrPubkey: cached.pubkey,
      nostrCreatedAt: cached.createdAt,
      unitSystem: 'metric' as const,
      dataSource: 'RUNSTR' as const,
      splits: undefined,                                  // Not tracked in CachedWorkout
    }));

    // Calculate aggregated metrics
    let totalDistance = 0;
    let totalDuration = 0;
    const activeDaysSet = new Set<string>();

    for (const workout of nostrWorkouts) {
      totalDistance += (workout.distance || 0) / 1000;  // Convert to km
      totalDuration += (workout.duration || 0) / 60;     // Convert to minutes
      const workoutDate = new Date(workout.startTime).toDateString();
      activeDaysSet.add(workoutDate);
    }

    metrics.set(pubkey, {
      npub: pubkey,
      totalDistance,
      totalDuration,
      totalCalories: 0, // Not tracked in CachedWorkout
      workoutCount: workouts.length,
      activeDays: activeDaysSet.size,
      longestDistance: Math.max(...nostrWorkouts.map(w => (w.distance || 0) / 1000)),
      longestDuration: Math.max(...nostrWorkouts.map(w => (w.duration || 0) / 60)),
      averagePace: totalDistance > 0 ? totalDuration / totalDistance : 0,
      averageSpeed: totalDuration > 0 ? (totalDistance / totalDuration) * 60 : 0,
      lastActivityDate: nostrWorkouts[0]?.startTime,
      streakDays: 0,
      workouts: nostrWorkouts as any, // Cast to avoid complex type issues
    });
  }

  return metrics;
}

// ============================================================================
// useSatlantisEvents - Discovery feed hook
// ============================================================================

interface UseSatlantisEventsReturn {
  events: SatlantisEvent[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for discovering Satlantis sports events
 */
export function useSatlantisEvents(
  filter?: SatlantisEventFilter
): UseSatlantisEventsReturn {
  const [events, setEvents] = useState<SatlantisEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  // Ref to track current events for silent refresh pattern
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const loadEvents = useCallback(async (forceRefresh: boolean = false) => {
    // SILENT REFRESH: Only show loading on first-ever load (no existing data)
    // Pull-to-refresh and foreground return should NOT show spinner
    const hasExistingData = eventsRef.current.length > 0;
    if (!hasExistingData) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const discovered = await SatlantisEventService.discoverSportsEvents(filter, forceRefresh);
      if (isMounted.current) {
        setEvents(discovered);
      }
    } catch (err) {
      console.error('[useSatlantisEvents] Error:', err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to load events');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [JSON.stringify(filter)]);

  // Refresh function that bypasses cache
  const refresh = useCallback(async () => {
    await loadEvents(true);
  }, [loadEvents]);

  useEffect(() => {
    isMounted.current = true;
    loadEvents(false); // Use cache on initial load

    return () => {
      isMounted.current = false;
    };
  }, [loadEvents]);

  // Refresh events when app returns to foreground
  useEffect(() => {
    const unsubscribe = AppStateManager.onStateChange((isActive) => {
      if (isActive && isMounted.current) {
        console.log('[useSatlantisEvents] App returned to foreground - refreshing events');
        loadEvents(true); // Force refresh from relays
      }
    });

    return () => unsubscribe();
  }, [loadEvents]);

  return {
    events,
    isLoading,
    error,
    refresh,
  };
}

// ============================================================================
// useSatlantisEventDetail - Event detail with leaderboard hook
// ============================================================================

interface UseSatlantisEventDetailReturn {
  event: SatlantisEvent | null;
  participants: string[];
  leaderboard: SatlantisLeaderboardEntry[];
  teamLeaderboard: TeamLeaderboardEntry[];
  eventStatus: SatlantisEventStatus;
  isLoading: boolean;
  isLoadingLeaderboard: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addLocalParticipant: (pubkey: string) => void; // Optimistic UI - add participant locally
}

/**
 * Hook for single event detail with leaderboard
 */
export function useSatlantisEventDetail(
  eventPubkey: string,
  eventId: string,
  viewerPubkey?: string // Current user's hex pubkey for visibility filtering
): UseSatlantisEventDetailReturn {
  const [event, setEvent] = useState<SatlantisEvent | null>(null);
  const [fetchedParticipants, setFetchedParticipants] = useState<string[]>([]);
  const [localParticipants, setLocalParticipants] = useState<string[]>([]); // Optimistic UI
  const [leaderboard, setLeaderboard] = useState<SatlantisLeaderboardEntry[]>([]);
  const [teamLeaderboard, setTeamLeaderboard] = useState<TeamLeaderboardEntry[]>([]);
  const [eventStatus, setEventStatus] = useState<SatlantisEventStatus>('upcoming');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  // Refs for silent refresh pattern (avoid stale closures)
  const eventRef = useRef(event);
  eventRef.current = event;
  const leaderboardRef = useRef(leaderboard);
  leaderboardRef.current = leaderboard;
  const teamLeaderboardRef = useRef(teamLeaderboard);
  teamLeaderboardRef.current = teamLeaderboard;
  const viewerPubkeyRef = useRef(viewerPubkey);
  viewerPubkeyRef.current = viewerPubkey;

  // Merge fetched and local participants (for optimistic UI)
  // IMPORTANT: Normalize all pubkeys to hex to prevent duplicates
  const participants = useMemo(() => {
    const merged = [...fetchedParticipants, ...localParticipants];
    const normalized = normalizeAndDeduplicatePubkeys(merged);
    if (merged.length !== normalized.length) {
      console.log(`[Participants] Deduped ${merged.length} → ${normalized.length} (normalized to hex)`);
    }
    return normalized;
  }, [fetchedParticipants, localParticipants]);

  // Add local participant for optimistic UI (normalize to hex)
  const addLocalParticipant = useCallback((pubkey: string) => {
    const normalizedPubkey = normalizeToHex(pubkey);
    setLocalParticipants(prev => {
      if (prev.includes(normalizedPubkey)) return prev;
      console.log(`[Participants] Added local participant: ${normalizedPubkey.slice(0, 16)}...`);
      return [...prev, normalizedPubkey];
    });
  }, []);

  const loadEventDetail = useCallback(async (forceRefresh: boolean = false) => {
    if (!eventPubkey || !eventId) return;

    const totalStartTime = Date.now();
    console.log(`[Perf] 🚀 START loadEventDetail`);
    console.log(`[Perf]   - eventPubkey: ${eventPubkey.slice(0, 16)}...`);
    console.log(`[Perf]   - eventId: ${eventId}`);
    console.log(`[Perf]   - forceRefresh: ${forceRefresh}`);

    // NOTE: Do NOT clear local participants on refresh
    // The useMemo merge already deduplicates, and clearing causes RSVP to "disappear"
    // while the Nostr query is in progress (user sees themselves removed temporarily)

    setError(null);

    try {
      // ============================================================================
      // FROZEN EVENT CHECK: Return permanently stored data for ended events
      // ============================================================================
      if (!forceRefresh) {
        const frozenCheckStart = Date.now();
        const frozenData = await FrozenEventStore.get(eventId);
        console.log(`[Perf] ❄️ FrozenEventStore.get() took ${Date.now() - frozenCheckStart}ms`);

        if (frozenData) {
          console.log(`[Perf] ❄️ HIT! Using frozen data for ended event`);
          console.log(`[Perf]   - Participants: ${frozenData.participants.length}`);
          console.log(`[Perf]   - Leaderboard entries: ${frozenData.leaderboard.length}`);
          console.log(`[Perf] ✅ TOTAL loadEventDetail: ${Date.now() - totalStartTime}ms (frozen path)`);

          // Load event metadata from cache (just for display, frozen data is authoritative)
          const cachedEvent = await SatlantisEventService.getEventById(eventId, eventPubkey, false);
          if (cachedEvent) {
            setEvent(cachedEvent);
            setEventStatus('ended');
          }

          setFetchedParticipants(frozenData.participants);
          setLeaderboard(frozenData.leaderboard);
          setIsLoading(false);
          setIsLoadingLeaderboard(false);
          return; // Done - frozen data is permanent
        }
      }

      // ============================================================================
      // CACHE-FIRST PATTERN: Show cached data immediately, refresh in background
      // ============================================================================

      // Step 1: Try to load cached data immediately (no network, instant display)
      if (!forceRefresh) {
        console.log(`[Perf] 📦 Checking event cache...`);
        const cacheCheckStart = Date.now();
        const cachedEvent = await SatlantisEventService.getEventById(eventId, eventPubkey, false);
        console.log(`[Perf] 📦 Event cache check took ${Date.now() - cacheCheckStart}ms`);

        if (cachedEvent) {
          console.log(`[Perf] ✅ Event cache HIT! Showing cached data instantly`);
          setEvent(cachedEvent);
          setEventStatus(getEventStatus(cachedEvent));

          // Load cached participants (normalized)
          const rsvpStart = Date.now();
          const rawParticipants = await SatlantisRSVPService.getEventParticipants(
            eventPubkey,
            eventId,
            false // Don't skip cache
          );
          const cachedParticipants = normalizeAndDeduplicatePubkeys(rawParticipants);
          console.log(`[Perf] 👥 RSVP cache took ${Date.now() - rsvpStart}ms (${cachedParticipants.length} participants)`);

          setFetchedParticipants(cachedParticipants);
          setIsLoading(false); // Stop spinner - user sees cached data immediately!

          // Load cached leaderboard if event has started
          const now = Math.floor(Date.now() / 1000);
          if (now >= cachedEvent.startTime) {
            await loadLeaderboard(cachedEvent, cachedParticipants, false);
          }

          // IMPORTANT: If participants is empty, trigger background refresh
          // This handles the case where relay was down when RSVPs were initially fetched
          if (cachedParticipants.length === 0) {
            console.log(`[Perf] ⚠️ Cached participants empty - triggering background refresh`);
            // Don't await - let it run in background while user sees cached event data
            SatlantisRSVPService.getEventParticipants(eventPubkey, eventId, true)
              .then((rawFresh) => {
                const freshParticipants = normalizeAndDeduplicatePubkeys(rawFresh);
                if (isMounted.current && freshParticipants.length > 0) {
                  console.log(`[Perf] 🔄 Background refresh found ${freshParticipants.length} participants!`);
                  setFetchedParticipants(freshParticipants);
                  // Also refresh leaderboard with new participants
                  if (now >= cachedEvent.startTime) {
                    loadLeaderboard(cachedEvent, freshParticipants, true);
                  }
                }
              })
              .catch((err) => {
                console.warn(`[Perf] Background refresh failed:`, err);
              });
          }

          console.log(`[Perf] ✅ TOTAL loadEventDetail: ${Date.now() - totalStartTime}ms (cache path)`);
          return; // Done! User sees cached data instantly
        }
      }

      // Step 2: No cache or forceRefresh - need to load fresh data
      console.log(`[Perf] 🌐 Loading fresh data from Nostr...`);
      // SILENT REFRESH: Only show loading on first-ever load (no existing event data)
      // Pull-to-refresh and foreground return should NOT show spinner
      if (!eventRef.current) {
        setIsLoading(true);
      }

      // Load event details with retry logic for relay latency
      const eventFetchStart = Date.now();
      console.log(`[Perf] 📥 Fetching event data...`);
      let eventData = await SatlantisEventService.getEventById(eventId, eventPubkey, true);

      // Retry up to 3 times with exponential backoff if event not found
      if (!eventData) {
        const retryDelays = [1000, 2000, 4000]; // 1s, 2s, 4s
        for (let i = 0; i < retryDelays.length && !eventData; i++) {
          console.log(`[Perf] ⏳ Event not found, retry ${i + 1}/3 in ${retryDelays[i]}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
          if (!isMounted.current) return;
          eventData = await SatlantisEventService.getEventById(eventId, eventPubkey, true);
        }
      }

      console.log(`[Perf] 📥 Event fetch took ${Date.now() - eventFetchStart}ms`);
      if (!isMounted.current) return;

      if (!eventData) {
        console.log(`[Perf] ❌ Event not found after retries!`);
        setError('Event not found');
        setIsLoading(false);
        return;
      }

      console.log(`[Perf] ✅ Event found: "${eventData.title}"`);
      setEvent(eventData);
      setEventStatus(getEventStatus(eventData));

      // Load participants from RSVPs (fresh data) - NORMALIZE to hex
      const rsvpFetchStart = Date.now();
      console.log(`[Perf] 👥 Loading participants (fresh)...`);
      const rawParticipants = await SatlantisRSVPService.getEventParticipants(
        eventPubkey,
        eventId,
        true // Skip cache for fresh data
      );
      const participantPubkeys = normalizeAndDeduplicatePubkeys(rawParticipants);
      console.log(`[Perf] 👥 RSVP fetch took ${Date.now() - rsvpFetchStart}ms`);
      console.log(`[Perf] 👥 Participants: ${rawParticipants.length} raw → ${participantPubkeys.length} normalized`);

      if (!isMounted.current) return;

      setFetchedParticipants(participantPubkeys);
      setIsLoading(false);

      // Load leaderboard if event has started/ended
      const now = Math.floor(Date.now() / 1000);
      const hasStarted = now >= eventData.startTime;

      console.log(`[Perf] 📊 Event timing: started=${hasStarted}, participants=${participantPubkeys.length}`);

      if (hasStarted) {
        console.log(`[Perf] ⏱️ Event has started - loading leaderboard...`);
        await loadLeaderboard(eventData, participantPubkeys, true);
      } else {
        console.log(`[Perf] ⏳ Event hasn't started yet, skipping leaderboard load`);
      }

      console.log(`[Perf] ✅ TOTAL loadEventDetail: ${Date.now() - totalStartTime}ms (fresh path)`);
    } catch (err) {
      console.error('[Perf] ❌ Error:', err);
      console.log(`[Perf] ❌ TOTAL loadEventDetail: ${Date.now() - totalStartTime}ms (error)`);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to load event');
        setIsLoading(false);
      }
    }
  }, [eventPubkey, eventId]);

  /**
   * UNIFIED PARTICIPANT LEADERBOARD: Only shows users who clicked "Join"
   * - Season II participants who joined = public (visible to all)
   * - Non-Season II participants who joined = private (visible only to self)
   * - Workouts filtered to only include joined participants
   */
  const loadLeaderboard = async (
    eventData: SatlantisEvent,
    participantPubkeys: string[], // Legacy param, now uses UnifiedEventParticipantService
    forceRefresh: boolean = false
  ) => {
    if (!isMounted.current) return;
    // SILENT REFRESH: Only show loading on first-ever load (no existing leaderboard data)
    // Pull-to-refresh should NOT show spinner
    const hasExistingLeaderboard = leaderboardRef.current.length > 0;
    if (!hasExistingLeaderboard) {
      setIsLoadingLeaderboard(true);
    }

    const leaderboardStartTime = Date.now();
    const cacheKey = `satlantis_leaderboard_${eventData.id}`;
    const now = Math.floor(Date.now() / 1000);
    const isCompleted = eventData.endTime < now;

    console.log(`[Perf] 🏁 loadLeaderboard START`);
    console.log(`[Perf]   - Event: "${eventData.title}"`);
    console.log(`[Perf]   - Participants: ${participantPubkeys.length}`);
    console.log(`[Perf]   - Scoring: ${eventData.scoringType || 'fastest_time'}`);
    console.log(`[Perf]   - Completed: ${isCompleted}, ForceRefresh: ${forceRefresh}`);

    try {
      // Check cache first (unless forceRefresh)
      if (!forceRefresh) {
        const cacheCheckStart = Date.now();
        const cached = await UnifiedCacheService.get<SatlantisLeaderboardEntry[]>(cacheKey);
        console.log(`[Perf] 💾 Leaderboard cache check: ${Date.now() - cacheCheckStart}ms`);

        if (cached !== null && cached !== undefined) {
          console.log(`[Perf] 💾 CACHE HIT: ${cached.length} entries`);
          console.log(`[Perf] ✅ loadLeaderboard TOTAL: ${Date.now() - leaderboardStartTime}ms (cache)`);
          setLeaderboard(cached);
          setIsLoadingLeaderboard(false);
          return;
        }
        console.log(`[Perf] 📭 Cache miss - querying Nostr directly...`);
      }

      // Map Satlantis sport type to RUNSTR activity type
      const activityType = mapSportToActivityType(eventData.sportType);

      // UNIFIED PARTICIPANT SERVICE: Get pubkeys of users who clicked "Join"
      // Only these users will appear on the leaderboard
      const currentViewerPubkey = viewerPubkeyRef.current || '';
      console.log(`[Perf] 🔐 Getting joined pubkeys for leaderboard (viewer: ${currentViewerPubkey.slice(0, 12)}...)`);

      const joinedPubkeys = await UnifiedEventParticipantService.getJoinedPubkeys(
        eventData.id,
        currentViewerPubkey
      );
      console.log(`[Perf] 👥 Joined pubkeys: ${joinedPubkeys.length} users eligible for leaderboard`);

      // INSTANT LEADERBOARDS: Read from UnifiedWorkoutCache (Season II participants + user)
      let metrics: Map<string, WorkoutMetrics>;
      let cachedWorkouts: CachedWorkout[] = [];

      // UNIFIED CACHE: All workouts are pre-fetched from Season II participants + user
      // This provides instant reads without any Nostr queries
      console.log(`[Perf] 🔍 Reading workouts from UnifiedWorkoutCache (instant)`);
      console.log(`[Perf]   - Event ID: ${eventData.id}`);
      console.log(`[Perf]   - Activity: ${activityType}`);
      console.log(`[Perf]   - Date range: ${new Date(eventData.startTime * 1000).toISOString().split('T')[0]} to ${new Date(eventData.endTime * 1000).toISOString().split('T')[0]}`);

      const workoutQueryStart = Date.now();

      // Read from UnifiedWorkoutCache (instant - pre-cached)
      const cache = UnifiedWorkoutCache;
      const allWorkoutsInRange = cache.getWorkoutsInDateRange(
        eventData.startTime,     // unix timestamp seconds
        eventData.endTime        // unix timestamp seconds
      );

      console.log(`[Perf] 📦 All cached workouts in date range: ${allWorkoutsInRange.length} in ${Date.now() - workoutQueryStart}ms`);

      // CRITICAL: Filter workouts to ONLY include users who clicked "Join"
      // This is the key change - only joined participants appear on leaderboard
      cachedWorkouts = allWorkoutsInRange.filter(w => joinedPubkeys.includes(w.pubkey));
      console.log(`[Perf] 🔒 After join filter: ${cachedWorkouts.length} workouts from joined participants`);

      // SECONDARY FILTER: Check for workouts tagged with this event ID (#e tag)
      // Some workouts may be explicitly tagged with the event they belong to
      const eventTaggedWorkouts = cachedWorkouts.filter(w =>
        w.eventIds?.includes(eventData.id)
      );
      if (eventTaggedWorkouts.length > 0) {
        console.log(`[Perf] 🏷️ Found ${eventTaggedWorkouts.length} event-tagged workouts`);
      }

      // Convert to WorkoutMetrics format (filters by activity type internally)
      metrics = convertCachedWorkoutsToMetrics(cachedWorkouts, activityType);

      console.log(`[Perf] 🔍 Converted to ${metrics.size} users with ${activityType} workouts`);

      if (!isMounted.current) return;

      // Build leaderboard entries using scoring service
      const buildStart = Date.now();

      // TEAM COMPETITION: Build team leaderboard instead of individual
      if (eventData.isTeamCompetition) {
        console.log(`[Perf] 🏆 Building TEAM leaderboard for team competition`);
        const teamEntries = SatlantisEventScoringService.buildTeamLeaderboard(
          cachedWorkouts as any[], // CachedWorkout compatible with scoring service
          eventData.scoringType || 'most_distance',
          eventData.distance
        );
        console.log(`[Perf] 🧮 Team leaderboard build took ${Date.now() - buildStart}ms`);
        console.log(`[Perf] 🏆 Result: ${teamEntries.length} team entries`);

        if (teamEntries.length > 0) {
          console.log(`[Perf] 📋 Top 5 teams:`);
          teamEntries.slice(0, 5).forEach((t, i) => {
            console.log(`   ${i + 1}. ${t.teamName} - ${t.formattedScore} (${t.memberCount} members)`);
          });
        }

        // Cache the team leaderboard
        const cacheStart = Date.now();
        const cacheTTL = isCompleted ? 86400 : 300;
        await UnifiedCacheService.setWithCustomTTL(cacheKey + '_team', teamEntries, cacheTTL);
        console.log(`[Perf] 💾 Team cache write: ${Date.now() - cacheStart}ms (TTL: ${isCompleted ? '24h' : '5min'})`);

        console.log(`[Perf] ✅ loadLeaderboard TOTAL: ${Date.now() - leaderboardStartTime}ms`);
        setTeamLeaderboard(teamEntries);
        setLeaderboard([]); // Clear individual leaderboard for team competitions
      } else {
        // INDIVIDUAL COMPETITION: Standard leaderboard
        // Pass joined pubkeys so only joined participants are included
        const rawEntries = SatlantisEventScoringService.buildLeaderboard(
          metrics,
          eventData.scoringType || 'fastest_time',
          eventData.distance,
          joinedPubkeys  // Only include participants who clicked "Join"
        );

        // Add isPrivate flag to each entry
        // Private = non-Season II user (only visible to themselves)
        const entries: SatlantisLeaderboardEntry[] = rawEntries.map(entry => ({
          ...entry,
          isPrivate: !UnifiedEventParticipantService.isPublicParticipant(entry.npub),
        }));

        console.log(`[Perf] 🧮 Leaderboard build took ${Date.now() - buildStart}ms`);
        console.log(`[Perf] 🏆 Result: ${entries.length} entries (${entries.filter(e => e.isPrivate).length} private)`);

        if (entries.length > 0) {
          console.log(`[Perf] 📋 Top 5 entries:`);
          entries.slice(0, 5).forEach((e, i) => {
            const privacyIcon = e.isPrivate ? '🔒' : '🌐';
            console.log(`   ${i + 1}. ${privacyIcon} ${e.npub.slice(0, 16)}... - ${e.formattedScore} (${e.workoutCount} workouts)`);
          });
        }

        // Cache the leaderboard result
        // Completed events: 24 hours | Active events: 5 minutes (live competition)
        const cacheStart = Date.now();
        const cacheTTL = isCompleted ? 86400 : 300;
        await UnifiedCacheService.setWithCustomTTL(cacheKey, entries, cacheTTL);
        console.log(`[Perf] 💾 Cache write: ${Date.now() - cacheStart}ms (TTL: ${isCompleted ? '24h' : '5min'})`);

        // FREEZE completed events permanently (never re-query)
        if (isCompleted && !await FrozenEventStore.isFrozen(eventData.id)) {
          const freezeStart = Date.now();
          console.log(`[Perf] ❄️ Freezing completed event...`);
          await FrozenEventStore.freeze(
            eventData.id,
            eventData.pubkey,
            participantPubkeys,
            entries,
            eventData.endTime
          );
          console.log(`[Perf] ❄️ Freeze took ${Date.now() - freezeStart}ms`);
        }

        console.log(`[Perf] ✅ loadLeaderboard TOTAL: ${Date.now() - leaderboardStartTime}ms`);
        setLeaderboard(entries);
        setTeamLeaderboard([]); // Clear team leaderboard for individual competitions
      }
    } catch (err) {
      console.error('[Perf] ❌ Leaderboard error:', err);
      console.log(`[Perf] ❌ loadLeaderboard TOTAL: ${Date.now() - leaderboardStartTime}ms (error)`);
    } finally {
      if (isMounted.current) {
        setIsLoadingLeaderboard(false);
      }
    }
  };

  /**
   * UNIFIED REFRESH: Refreshes UnifiedWorkoutCache then reloads leaderboard
   * All events share the same workout cache for instant cross-event navigation
   */
  const refreshWorkoutsOnly = useCallback(async () => {
    if (!event) {
      console.log('[Perf] ⚠️ No event cached - doing full refresh');
      await loadEventDetail(true);
      return;
    }

    const refreshStart = Date.now();
    console.log('[Perf] 🔄 Pull-to-refresh START (UnifiedWorkoutCache)');

    // UNIFIED REFRESH: Refresh the shared workout cache
    // This updates all leaderboards across Season II and Satlantis events
    await UnifiedWorkoutCache.refresh();
    console.log(`[Perf] 🔄 UnifiedWorkoutCache refreshed in ${Date.now() - refreshStart}ms`);

    // Now reload leaderboard from refreshed cache
    const now = Math.floor(Date.now() / 1000);
    if (now >= event.startTime) {
      await loadLeaderboard(event, participants, true); // forceRefresh = true
    }

    // Background RSVP check (non-blocking) - catches new registrations
    SatlantisRSVPService.getEventParticipants(eventPubkey, eventId, true)
      .then((rawParticipants) => {
        const freshParticipants = normalizeAndDeduplicatePubkeys(rawParticipants);
        if (isMounted.current && freshParticipants.length !== fetchedParticipants.length) {
          console.log(`[Perf] 🔔 Background RSVP: ${fetchedParticipants.length} → ${freshParticipants.length} participants`);
          setFetchedParticipants(freshParticipants);
          // Rebuild leaderboard with updated participant list
          if (now >= event.startTime) {
            loadLeaderboard(event, freshParticipants, true);
          }
        }
      })
      .catch((err) => {
        console.warn('[Perf] Background RSVP check failed:', err);
      });

    console.log(`[Perf] ✅ Pull-to-refresh TOTAL: ${Date.now() - refreshStart}ms`);
  }, [event, participants, fetchedParticipants, eventPubkey, eventId, loadEventDetail]);

  useEffect(() => {
    isMounted.current = true;
    loadEventDetail();

    return () => {
      isMounted.current = false;
    };
  }, [loadEventDetail]);

  // Update status periodically for live events
  useEffect(() => {
    if (!event) return;

    const interval = setInterval(() => {
      const newStatus = getEventStatus(event);
      if (newStatus !== eventStatus) {
        setEventStatus(newStatus);
        // Reload leaderboard when event goes live or ends
        loadLeaderboard(event, participants);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [event, eventStatus, participants]);

  // Refresh event detail when app returns to foreground
  useEffect(() => {
    const unsubscribe = AppStateManager.onStateChange((isActive) => {
      if (isActive && isMounted.current && eventPubkey && eventId) {
        console.log('[useSatlantisEventDetail] App returned to foreground - refreshing event detail');
        loadEventDetail(true); // Force refresh from relays
      }
    });

    return () => unsubscribe();
  }, [loadEventDetail, eventPubkey, eventId]);

  return {
    event,
    participants,
    leaderboard,
    teamLeaderboard,
    eventStatus,
    isLoading,
    isLoadingLeaderboard,
    error,
    refresh: refreshWorkoutsOnly, // Pull-to-refresh: only updates workouts, not event/RSVPs
    addLocalParticipant,
  };
}


// ============================================================================
// Exports
// ============================================================================

export type {
  UseSatlantisEventsReturn,
  UseSatlantisEventDetailReturn,
};
