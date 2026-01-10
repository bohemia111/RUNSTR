/**
 * useJanuaryWalking - Hook for January Walking Challenge
 *
 * BASELINE NOTE ARCHITECTURE (Optimized):
 * - Fetches consolidated baseline note on mount (1 event, instant)
 * - Shows January Walking leaderboard from baseline immediately
 * - Subscribes to ONLY logged-in user's 1301 events
 * - Merges user's fresh STEPS in real-time
 * - Falls back to memory-based approach if no baseline note
 *
 * NOTE: This challenge tracks STEPS, not distance.
 * The totalDistanceKm field in JanuaryWalkingParticipant holds STEPS.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  JanuaryWalkingService,
  type JanuaryWalkingLeaderboard,
} from '../services/challenge/JanuaryWalkingService';
import { LeaderboardBaselineService } from '../services/season/LeaderboardBaselineService';
import { GlobalNDKService } from '../services/nostr/GlobalNDKService';
import {
  getJanuaryWalkingStartTimestamp,
  getJanuaryWalkingEndTimestamp,
} from '../constants/januaryWalking';
import type { NDKFilter, NDKEvent, NDKSubscription } from '@nostr-dev-kit/ndk';

interface UseJanuaryWalkingResult {
  leaderboard: JanuaryWalkingLeaderboard | null;
  isLoading: boolean;
  isBaselineOnly: boolean;
  baselineDate: string;
  refreshAll: () => Promise<void>;
  currentUserPubkey: string | undefined;
}

/**
 * Parse kind 1301 workout event for January Walking
 * Returns steps if walking activity with step data
 */
function parseWorkoutForJanuaryWalking(event: NDKEvent): { steps: number } | null {
  try {
    const getTag = (name: string) => event.tags.find((t) => t[0] === name)?.[1];

    const exerciseType = getTag('exercise')?.toLowerCase();
    const stepsStr = getTag('steps');
    const createdAt = event.created_at || 0;

    if (!exerciseType) return null;

    // Check if within January Walking date range
    const startTs = getJanuaryWalkingStartTimestamp();
    const endTs = getJanuaryWalkingEndTimestamp();
    if (createdAt < startTs || createdAt > endTs) return null;

    // Only walking counts for January Walking
    const isWalking = exerciseType.includes('walk') || exerciseType.includes('hike');
    if (!isWalking) return null;

    // Must have steps data
    if (!stepsStr) return null;

    const steps = parseInt(stepsStr, 10);
    if (isNaN(steps) || steps <= 0) return null;

    return { steps };
  } catch {
    return null;
  }
}

export function useJanuaryWalking(): UseJanuaryWalkingResult {
  const [leaderboard, setLeaderboard] = useState<JanuaryWalkingLeaderboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBaselineOnly, setIsBaselineOnly] = useState(true);
  const [baselineDate, setBaselineDate] = useState('');
  const [currentUserPubkey, setCurrentUserPubkey] = useState<string | undefined>();
  const isMounted = useRef(true);
  const subscriptionRef = useRef<NDKSubscription | null>(null);
  const userWorkoutsRef = useRef<Array<{ steps: number }>>([]);
  const baselineRef = useRef<JanuaryWalkingLeaderboard | null>(null);

  // Fetch user pubkey on mount
  useEffect(() => {
    const fetchUserPubkey = async () => {
      const pubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');
      if (pubkey && isMounted.current) {
        setCurrentUserPubkey(pubkey);
      }
    };
    fetchUserPubkey();

    return () => {
      isMounted.current = false;
    };
  }, []);

  // Main effect: Fetch baseline + subscribe to user's workouts
  useEffect(() => {
    isMounted.current = true;

    const setup = async () => {
      const t0 = Date.now();
      console.log(`[useJanuaryWalking] ========== BASELINE INIT ==========`);

      try {
        // Step 1: Try to fetch baseline note (1 event, instant)
        console.log(`[useJanuaryWalking] T+${Date.now() - t0}ms: Fetching baseline note...`);
        const baseline = await LeaderboardBaselineService.fetchBaseline();

        if (baseline && isMounted.current) {
          console.log(`[useJanuaryWalking] T+${Date.now() - t0}ms: Baseline found!`);

          const cutoffDate = new Date(baseline.cutoffTimestamp * 1000);
          setBaselineDate(
            `${(cutoffDate.getMonth() + 1).toString().padStart(2, '0')}/${cutoffDate.getDate().toString().padStart(2, '0')}/${cutoffDate.getFullYear()}`
          );

          baselineRef.current = baseline.januaryWalking;
          setLeaderboard(baseline.januaryWalking);
          setIsBaselineOnly(true);

          // Step 2: Subscribe to ONLY current user's 1301 events (if logged in)
          if (currentUserPubkey) {
            console.log(`[useJanuaryWalking] T+${Date.now() - t0}ms: Subscribing to user...`);
            await subscribeToUserWorkouts(currentUserPubkey, baseline.cutoffTimestamp);
          }

          console.log(`[useJanuaryWalking] T+${Date.now() - t0}ms: Setup complete (baseline mode)`);
        } else {
          // No baseline - fall back to memory-based approach
          console.log(`[useJanuaryWalking] T+${Date.now() - t0}ms: No baseline, using fallback...`);
          const data = JanuaryWalkingService.buildLeaderboardFromBaseline(currentUserPubkey);
          if (isMounted.current) {
            baselineRef.current = data;
            setLeaderboard(data);
            setBaselineDate('Memory');
          }
        }
      } catch (err) {
        console.error(`[useJanuaryWalking] Setup error:`, err);
        // Fallback to memory-based approach
        const data = JanuaryWalkingService.buildLeaderboardFromBaseline(currentUserPubkey);
        if (isMounted.current) {
          baselineRef.current = data;
          setLeaderboard(data);
          setBaselineDate('Memory');
        }
      }

      console.log(`[useJanuaryWalking] ========== BASELINE READY ==========`);
    };

    const subscribeToUserWorkouts = async (userPubkey: string, cutoffTimestamp: number) => {
      try {
        const ndk = await GlobalNDKService.getInstance();

        const filter: NDKFilter = {
          kinds: [1301],
          authors: [userPubkey],
          since: cutoffTimestamp,
        };

        // Clean up existing subscription
        if (subscriptionRef.current) {
          subscriptionRef.current.stop();
        }

        const sub = ndk.subscribe(filter, {
          closeOnEose: false,
          pool: ndk.pool,
        });

        sub.on('event', (event: NDKEvent) => {
          if (!isMounted.current) return;

          const workout = parseWorkoutForJanuaryWalking(event);
          if (!workout) return;

          // Add to user's fresh workouts
          userWorkoutsRef.current.push(workout);

          // Merge and update UI
          if (baselineRef.current) {
            const updated = LeaderboardBaselineService.mergeJanuaryWalkingUserWorkouts(
              baselineRef.current,
              userWorkoutsRef.current,
              userPubkey
            );
            setLeaderboard(updated);
            setIsBaselineOnly(false);
            console.log(`[useJanuaryWalking] Merged user workout: +${workout.steps} steps`);
          }
        });

        sub.on('eose', () => {
          // Merge any workouts received during initial fetch
          if (baselineRef.current && userWorkoutsRef.current.length > 0 && isMounted.current) {
            const updated = LeaderboardBaselineService.mergeJanuaryWalkingUserWorkouts(
              baselineRef.current,
              userWorkoutsRef.current,
              userPubkey
            );
            setLeaderboard(updated);
            setIsBaselineOnly(false);
          }
        });

        subscriptionRef.current = sub;
      } catch (err) {
        console.error(`[useJanuaryWalking] User subscription error:`, err);
      }
    };

    setup();

    return () => {
      isMounted.current = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
        subscriptionRef.current = null;
      }
    };
  }, [currentUserPubkey]);

  // Pull-to-refresh: Re-fetch baseline + user workouts
  const refreshAll = useCallback(async () => {
    const t0 = Date.now();
    console.log(`[useJanuaryWalking] ========== REFRESH START ==========`);
    setIsLoading(true);

    try {
      // Clear user's cached workouts
      userWorkoutsRef.current = [];

      // Re-fetch baseline note
      const baseline = await LeaderboardBaselineService.fetchBaseline(true);

      if (baseline && isMounted.current) {
        const cutoffDate = new Date(baseline.cutoffTimestamp * 1000);
        setBaselineDate(
          `${(cutoffDate.getMonth() + 1).toString().padStart(2, '0')}/${cutoffDate.getDate().toString().padStart(2, '0')}/${cutoffDate.getFullYear()}`
        );

        baselineRef.current = baseline.januaryWalking;
        setLeaderboard(baseline.januaryWalking);
        setIsBaselineOnly(true);

        // Fetch user's workouts since cutoff
        if (currentUserPubkey) {
          const userWorkouts = await fetchUserWorkoutsSinceCutoff(
            currentUserPubkey,
            baseline.cutoffTimestamp
          );

          if (userWorkouts.length > 0 && isMounted.current) {
            userWorkoutsRef.current = userWorkouts;
            const updated = LeaderboardBaselineService.mergeJanuaryWalkingUserWorkouts(
              baseline.januaryWalking,
              userWorkouts,
              currentUserPubkey
            );
            setLeaderboard(updated);
            setIsBaselineOnly(false);
          }
        }
      } else {
        // Fallback to memory-based refresh
        const data = JanuaryWalkingService.buildLeaderboardFromBaseline(currentUserPubkey);
        if (isMounted.current) {
          baselineRef.current = data;
          setLeaderboard(data);
          setBaselineDate('Memory');
        }
      }

      console.log(`[useJanuaryWalking] ========== REFRESH COMPLETE in ${Date.now() - t0}ms ==========`);
    } catch (error) {
      console.error('[useJanuaryWalking] Refresh error:', error);
    } finally {
      setImmediate(() => {
        if (isMounted.current) {
          setIsLoading(false);
        }
      });
    }
  }, [currentUserPubkey]);

  return {
    leaderboard,
    isLoading,
    isBaselineOnly,
    baselineDate,
    refreshAll,
    currentUserPubkey,
  };
}

/**
 * Fetch user's workouts since cutoff (for refresh)
 */
async function fetchUserWorkoutsSinceCutoff(
  userPubkey: string,
  cutoffTimestamp: number
): Promise<Array<{ steps: number }>> {
  const workouts: Array<{ steps: number }> = [];

  try {
    const ndk = await GlobalNDKService.getInstance();

    const filter: NDKFilter = {
      kinds: [1301],
      authors: [userPubkey],
      since: cutoffTimestamp,
    };

    const events = await ndk.fetchEvents(filter);

    for (const event of events) {
      const workout = parseWorkoutForJanuaryWalking(event);
      if (workout) {
        workouts.push(workout);
      }
    }

    console.log(`[useJanuaryWalking] Fetched ${workouts.length} user workouts since cutoff`);
  } catch (err) {
    console.error(`[useJanuaryWalking] Fetch user workouts error:`, err);
  }

  return workouts;
}

export default useJanuaryWalking;
