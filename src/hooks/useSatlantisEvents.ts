/**
 * useSatlantisEvents - React hooks for Satlantis event discovery and detail
 *
 * Provides hooks for:
 * - Discovery feed (list of sports events)
 * - Event detail with participant list and leaderboard
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SatlantisEventService } from '../services/satlantis/SatlantisEventService';
import { SatlantisRSVPService } from '../services/satlantis/SatlantisRSVPService';
import { Competition1301QueryService } from '../services/competition/Competition1301QueryService';
import { SatlantisEventScoringService } from '../services/scoring/SatlantisEventScoringService';
import type {
  SatlantisEvent,
  SatlantisEventFilter,
  SatlantisLeaderboardEntry,
  SatlantisEventStatus,
} from '../types/satlantis';
import {
  getEventStatus,
  mapSportToActivityType,
} from '../types/satlantis';

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

  const loadEvents = useCallback(async (forceRefresh: boolean = false) => {
    setIsLoading(true);
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
  eventId: string
): UseSatlantisEventDetailReturn {
  const [event, setEvent] = useState<SatlantisEvent | null>(null);
  const [fetchedParticipants, setFetchedParticipants] = useState<string[]>([]);
  const [localParticipants, setLocalParticipants] = useState<string[]>([]); // Optimistic UI
  const [leaderboard, setLeaderboard] = useState<SatlantisLeaderboardEntry[]>([]);
  const [eventStatus, setEventStatus] = useState<SatlantisEventStatus>('upcoming');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  // Merge fetched and local participants (for optimistic UI)
  const participants = useMemo(() => {
    return [...new Set([...fetchedParticipants, ...localParticipants])];
  }, [fetchedParticipants, localParticipants]);

  // Add local participant for optimistic UI
  const addLocalParticipant = useCallback((pubkey: string) => {
    setLocalParticipants(prev => {
      if (prev.includes(pubkey)) return prev;
      return [...prev, pubkey];
    });
  }, []);

  const loadEventDetail = useCallback(async () => {
    if (!eventPubkey || !eventId) return;

    console.log(`[useSatlantisEventDetail] 🚀 Loading event detail...`);
    console.log(`[useSatlantisEventDetail]   - eventPubkey: ${eventPubkey.slice(0, 16)}...`);
    console.log(`[useSatlantisEventDetail]   - eventId: ${eventId}`);

    setIsLoading(true);
    setError(null);

    try {
      // Load event details
      console.log(`[useSatlantisEventDetail] 📥 Fetching event data...`);
      const eventData = await SatlantisEventService.getEventById(eventId, eventPubkey);
      if (!isMounted.current) return;

      if (!eventData) {
        console.log(`[useSatlantisEventDetail] ❌ Event not found!`);
        setError('Event not found');
        setIsLoading(false);
        return;
      }

      console.log(`[useSatlantisEventDetail] ✅ Event found: "${eventData.title}"`);
      setEvent(eventData);
      setEventStatus(getEventStatus(eventData));

      // Load participants from RSVPs
      console.log(`[useSatlantisEventDetail] 👥 Loading participants...`);
      const participantPubkeys = await SatlantisRSVPService.getEventParticipants(
        eventPubkey,
        eventId
      );
      if (!isMounted.current) return;

      console.log(`[useSatlantisEventDetail] 👥 Participants found: ${participantPubkeys.length}`);
      if (participantPubkeys.length > 0) {
        console.log(`[useSatlantisEventDetail]   - Participant pubkeys:`, participantPubkeys.map(p => p.slice(0, 16) + '...'));
      }

      setFetchedParticipants(participantPubkeys);
      setIsLoading(false);

      // Load leaderboard if event has started/ended
      // For open events (no RSVPs), still load the leaderboard - it will query all qualifying workouts
      const now = Math.floor(Date.now() / 1000);

      console.log(`[useSatlantisEventDetail] 📊 Event timing check:`);
      console.log(`   - Now: ${new Date(now * 1000).toISOString()}`);
      console.log(`   - Event start: ${new Date(eventData.startTime * 1000).toISOString()}`);
      console.log(`   - Event end: ${new Date(eventData.endTime * 1000).toISOString()}`);
      console.log(`   - Has started: ${now >= eventData.startTime}`);
      console.log(`   - Participants from RSVPs + local: ${participantPubkeys.length}`);

      if (now >= eventData.startTime) {
        console.log(`[useSatlantisEventDetail] ⏱️ Event has started - loading leaderboard...`);
        await loadLeaderboard(eventData, participantPubkeys);
      } else {
        console.log(`[useSatlantisEventDetail] ⏳ Event hasn't started yet, skipping leaderboard load`);
      }
    } catch (err) {
      console.error('[useSatlantisEventDetail] ❌ Error:', err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to load event');
        setIsLoading(false);
      }
    }
  }, [eventPubkey, eventId]);

  const loadLeaderboard = async (
    eventData: SatlantisEvent,
    participantPubkeys: string[]
  ) => {
    if (!isMounted.current) return;
    setIsLoadingLeaderboard(true);

    console.log(`[useSatlantisEventDetail] 🏁 loadLeaderboard called`);
    console.log(`[useSatlantisEventDetail]   - Event: "${eventData.title}"`);
    console.log(`[useSatlantisEventDetail]   - Participants count: ${participantPubkeys.length}`);
    console.log(`[useSatlantisEventDetail]   - Sport type: ${eventData.sportType}`);
    console.log(`[useSatlantisEventDetail]   - Scoring type: ${eventData.scoringType || 'fastest_time'}`);
    console.log(`[useSatlantisEventDetail]   - Target distance: ${eventData.distance || 'none'}`);

    try {
      const queryService = Competition1301QueryService.getInstance();

      // Map Satlantis sport type to RUNSTR activity type
      const activityType = mapSportToActivityType(eventData.sportType);
      console.log(`[useSatlantisEventDetail]   - Mapped activity type: ${activityType}`);

      // Query workouts - if participants exist, filter to them; otherwise query ALL workouts
      // This matches the website behavior: open events show all qualifying workouts
      let result;

      if (participantPubkeys.length > 0) {
        // RSVPs exist - query only participants' workouts
        console.log(`[useSatlantisEventDetail] 📋 RSVP MODE: Querying ${participantPubkeys.length} participants' workouts`);
        console.log(`[useSatlantisEventDetail]   - Date range: ${new Date(eventData.startTime * 1000).toISOString()} to ${new Date(eventData.endTime * 1000).toISOString()}`);
        result = await queryService.queryMemberWorkouts({
          memberNpubs: participantPubkeys,
          activityType: activityType as any,
          startDate: new Date(eventData.startTime * 1000),
          endDate: new Date(eventData.endTime * 1000),
        });
        console.log(`[useSatlantisEventDetail] 📊 queryMemberWorkouts returned ${result.metrics.size} users with workouts`);
      } else {
        // No RSVPs - query ALL qualifying workouts (open event, like website)
        console.log('[useSatlantisEventDetail] 🌐 OPEN MODE: No participants found - querying ALL qualifying workouts');
        console.log(`[useSatlantisEventDetail]   - This should show anyone who completed a qualifying workout!`);
        console.log(`[useSatlantisEventDetail]   - Date range: ${new Date(eventData.startTime * 1000).toISOString()} to ${new Date(eventData.endTime * 1000).toISOString()}`);
        console.log(`[useSatlantisEventDetail]   - Activity type: ${activityType}`);
        console.log(`[useSatlantisEventDetail]   - Min distance: ${eventData.distance || 'none'}`);
        result = await queryService.queryOpenEventWorkouts({
          activityType: activityType,
          startDate: new Date(eventData.startTime * 1000),
          endDate: new Date(eventData.endTime * 1000),
          minDistance: eventData.distance, // Use event's target distance if set
        });
        console.log(`[useSatlantisEventDetail] 📊 queryOpenEventWorkouts returned ${result.metrics.size} users with workouts`);
      }

      if (!isMounted.current) return;

      // Build leaderboard entries using scoring service
      // Supports: fastest_time, most_distance, participation
      console.log(`[useSatlantisEventDetail] 🧮 Building leaderboard with ${result.metrics.size} users...`);
      const entries = SatlantisEventScoringService.buildLeaderboard(
        result.metrics,
        eventData.scoringType || 'fastest_time',
        eventData.distance
      );

      console.log(
        `[useSatlantisEventDetail] 🏆 Leaderboard built with ${entries.length} entries ` +
          `(scoring: ${eventData.scoringType || 'fastest_time'})`
      );

      if (entries.length > 0) {
        console.log(`[useSatlantisEventDetail] 📋 Leaderboard entries:`);
        entries.slice(0, 5).forEach((e, i) => {
          console.log(`   ${i + 1}. ${e.npub.slice(0, 16)}... - ${e.formattedScore} (${e.workoutCount} workouts)`);
        });
      } else {
        console.log(`[useSatlantisEventDetail] ⚠️ No leaderboard entries! Check workout query.`);
      }

      setLeaderboard(entries);
    } catch (err) {
      console.error('[useSatlantisEventDetail] ❌ Leaderboard error:', err);
    } finally {
      if (isMounted.current) {
        setIsLoadingLeaderboard(false);
      }
    }
  };

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
        // For open events, participants array may be empty but we still load
        loadLeaderboard(event, participants);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [event, eventStatus, participants]);

  return {
    event,
    participants,
    leaderboard,
    eventStatus,
    isLoading,
    isLoadingLeaderboard,
    error,
    refresh: loadEventDetail,
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
