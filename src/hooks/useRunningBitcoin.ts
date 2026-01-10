/**
 * useRunningBitcoin - Hook for Running Bitcoin Challenge
 *
 * BASELINE NOTE ARCHITECTURE (Optimized):
 * - Fetches consolidated baseline note on mount (1 event, instant)
 * - Shows Running Bitcoin leaderboard from baseline immediately
 * - Subscribes to ONLY logged-in user's 1301 events
 * - Merges user's fresh workouts in real-time
 * - Falls back to memory-based approach if no baseline note
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RunningBitcoinService,
  type RunningBitcoinLeaderboard,
} from '../services/challenge/RunningBitcoinService';
import { LeaderboardBaselineService } from '../services/season/LeaderboardBaselineService';
import { GlobalNDKService } from '../services/nostr/GlobalNDKService';
import {
  getRunningBitcoinStartTimestamp,
  getRunningBitcoinEndTimestamp,
} from '../constants/runningBitcoin';
import type { NDKFilter, NDKEvent, NDKSubscription } from '@nostr-dev-kit/ndk';

interface UseRunningBitcoinResult {
  leaderboard: RunningBitcoinLeaderboard | null;
  isLoading: boolean;
  refreshAll: () => Promise<void>;
  currentUserPubkey: string | undefined;
  hasJoined: boolean;
  joinChallenge: () => Promise<boolean>;
  isBaselineOnly: boolean;
}

/**
 * Parse kind 1301 workout event for Running Bitcoin
 * Returns distance if running or walking activity
 */
function parseWorkoutForRunningBitcoin(event: NDKEvent): { distance: number } | null {
  try {
    const getTag = (name: string) => event.tags.find((t) => t[0] === name)?.[1];

    const exerciseType = getTag('exercise')?.toLowerCase();
    const distanceStr = getTag('distance');
    const createdAt = event.created_at || 0;

    if (!exerciseType || !distanceStr) return null;

    // Check if within Running Bitcoin date range
    const startTs = getRunningBitcoinStartTimestamp();
    const endTs = getRunningBitcoinEndTimestamp();
    if (createdAt < startTs || createdAt > endTs) return null;

    // Only running and walking count for Running Bitcoin
    const isRunning = exerciseType.includes('run') || exerciseType.includes('jog');
    const isWalking = exerciseType.includes('walk') || exerciseType.includes('hike');
    if (!isRunning && !isWalking) return null;

    const distance = parseFloat(distanceStr);
    if (isNaN(distance) || distance <= 0) return null;

    return { distance };
  } catch {
    return null;
  }
}

export function useRunningBitcoin(): UseRunningBitcoinResult {
  const [leaderboard, setLeaderboard] = useState<RunningBitcoinLeaderboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserPubkey, setCurrentUserPubkey] = useState<string | undefined>();
  const [hasJoined, setHasJoined] = useState(false);
  const [isBaselineOnly, setIsBaselineOnly] = useState(true);
  const isMounted = useRef(true);
  const subscriptionRef = useRef<NDKSubscription | null>(null);
  const userWorkoutsRef = useRef<Array<{ distance: number }>>([]);
  const baselineRef = useRef<RunningBitcoinLeaderboard | null>(null);

  // Fetch user pubkey and join status on mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      const pubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');
      if (pubkey && isMounted.current) {
        setCurrentUserPubkey(pubkey);
        const joined = await RunningBitcoinService.hasJoined(pubkey);
        if (isMounted.current) {
          setHasJoined(joined);
        }
      }
    };
    fetchUserInfo();

    return () => {
      isMounted.current = false;
    };
  }, []);

  // Main effect: Fetch baseline + subscribe to user's workouts
  useEffect(() => {
    isMounted.current = true;

    const setup = async () => {
      const t0 = Date.now();
      console.log(`[useRunningBitcoin] ========== BASELINE INIT ==========`);

      try {
        // Step 1: Try to fetch baseline note (1 event, instant)
        // Force refresh to avoid stale cached baseline
        console.log(`[useRunningBitcoin] T+${Date.now() - t0}ms: Fetching baseline note...`);
        const baseline = await LeaderboardBaselineService.fetchBaseline(true);

        if (baseline && isMounted.current) {
          console.log(`[useRunningBitcoin] T+${Date.now() - t0}ms: Baseline found!`);

          baselineRef.current = baseline.runningBitcoin;
          setLeaderboard(baseline.runningBitcoin);
          setIsBaselineOnly(true);

          // Step 2: Subscribe to ONLY current user's 1301 events (if logged in)
          if (currentUserPubkey) {
            console.log(`[useRunningBitcoin] T+${Date.now() - t0}ms: Subscribing to user...`);
            await subscribeToUserWorkouts(currentUserPubkey, baseline.cutoffTimestamp);
          }

          console.log(`[useRunningBitcoin] T+${Date.now() - t0}ms: Setup complete (baseline mode)`);
        } else {
          // No baseline - fall back to memory-based approach
          console.log(`[useRunningBitcoin] T+${Date.now() - t0}ms: No baseline, using fallback...`);
          const data = await RunningBitcoinService.getLeaderboard();
          if (isMounted.current) {
            baselineRef.current = data;
            setLeaderboard(data);
          }
        }
      } catch (err) {
        console.error(`[useRunningBitcoin] Setup error:`, err);
        // Fallback to memory-based approach
        const data = await RunningBitcoinService.getLeaderboard();
        if (isMounted.current) {
          baselineRef.current = data;
          setLeaderboard(data);
        }
      }

      console.log(`[useRunningBitcoin] ========== BASELINE READY ==========`);
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

          const workout = parseWorkoutForRunningBitcoin(event);
          if (!workout) return;

          // Add to user's fresh workouts
          userWorkoutsRef.current.push(workout);

          // Merge and update UI
          if (baselineRef.current) {
            const updated = LeaderboardBaselineService.mergeRunningBitcoinUserWorkouts(
              baselineRef.current,
              userWorkoutsRef.current,
              userPubkey
            );
            setLeaderboard(updated);
            setIsBaselineOnly(false);
            console.log(`[useRunningBitcoin] Merged user workout: +${workout.distance}km`);
          }
        });

        sub.on('eose', () => {
          // Merge any workouts received during initial fetch
          if (baselineRef.current && userWorkoutsRef.current.length > 0 && isMounted.current) {
            const updated = LeaderboardBaselineService.mergeRunningBitcoinUserWorkouts(
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
        console.error(`[useRunningBitcoin] User subscription error:`, err);
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
    console.log(`[useRunningBitcoin] ========== REFRESH START ==========`);
    setIsLoading(true);

    try {
      // Clear user's cached workouts
      userWorkoutsRef.current = [];

      // Re-fetch baseline note
      const baseline = await LeaderboardBaselineService.fetchBaseline(true);

      if (baseline && isMounted.current) {
        baselineRef.current = baseline.runningBitcoin;
        setLeaderboard(baseline.runningBitcoin);
        setIsBaselineOnly(true);

        // Fetch user's workouts since cutoff
        if (currentUserPubkey) {
          const userWorkouts = await fetchUserWorkoutsSinceCutoff(
            currentUserPubkey,
            baseline.cutoffTimestamp
          );

          if (userWorkouts.length > 0 && isMounted.current) {
            userWorkoutsRef.current = userWorkouts;
            const updated = LeaderboardBaselineService.mergeRunningBitcoinUserWorkouts(
              baseline.runningBitcoin,
              userWorkouts,
              currentUserPubkey
            );
            setLeaderboard(updated);
            setIsBaselineOnly(false);
          }
        }
      } else {
        // Fallback to memory-based refresh
        const data = await RunningBitcoinService.getLeaderboard();
        if (isMounted.current) {
          baselineRef.current = data;
          setLeaderboard(data);
        }
      }

      console.log(`[useRunningBitcoin] ========== REFRESH COMPLETE in ${Date.now() - t0}ms ==========`);
    } catch (error) {
      console.error('[useRunningBitcoin] Refresh error:', error);
    } finally {
      setImmediate(() => {
        if (isMounted.current) {
          setIsLoading(false);
        }
      });
    }
  }, [currentUserPubkey]);

  // Join challenge handler
  const joinChallenge = useCallback(async () => {
    if (!currentUserPubkey) return false;

    const success = await RunningBitcoinService.joinChallenge(currentUserPubkey);
    if (success && isMounted.current) {
      setHasJoined(true);
      await refreshAll();
    }
    return success;
  }, [currentUserPubkey, refreshAll]);

  return {
    leaderboard,
    isLoading,
    refreshAll,
    currentUserPubkey,
    hasJoined,
    joinChallenge,
    isBaselineOnly,
  };
}

/**
 * Fetch user's workouts since cutoff (for refresh)
 */
async function fetchUserWorkoutsSinceCutoff(
  userPubkey: string,
  cutoffTimestamp: number
): Promise<Array<{ distance: number }>> {
  const workouts: Array<{ distance: number }> = [];

  try {
    const ndk = await GlobalNDKService.getInstance();

    const filter: NDKFilter = {
      kinds: [1301],
      authors: [userPubkey],
      since: cutoffTimestamp,
    };

    const events = await ndk.fetchEvents(filter);

    for (const event of events) {
      const workout = parseWorkoutForRunningBitcoin(event);
      if (workout) {
        workouts.push(workout);
      }
    }

    console.log(`[useRunningBitcoin] Fetched ${workouts.length} user workouts since cutoff`);
  } catch (err) {
    console.error(`[useRunningBitcoin] Fetch user workouts error:`, err);
  }

  return workouts;
}

export default useRunningBitcoin;
