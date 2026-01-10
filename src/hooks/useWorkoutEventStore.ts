/**
 * useWorkoutEventStore - React hook for accessing the centralized workout store
 *
 * @deprecated This hook is deprecated. Use UnifiedWorkoutCache instead for leaderboards.
 *
 * The UnifiedWorkoutCache is now the single source of truth for:
 * - Season II leaderboards
 * - Satlantis event leaderboards
 * - Distance leaderboards (5K, 10K, Half, Marathon)
 *
 * UnifiedWorkoutCache queries Season II participants + logged-in user,
 * providing faster performance and privacy-aware data access.
 *
 * Migration:
 * ```typescript
 * // OLD (deprecated)
 * const { workouts, refresh } = useWorkoutEventStore();
 *
 * // NEW (use UnifiedWorkoutCache)
 * import { UnifiedWorkoutCache } from '../services/cache/UnifiedWorkoutCache';
 *
 * useEffect(() => {
 *   UnifiedWorkoutCache.ensureLoaded().then(() => {
 *     const workouts = UnifiedWorkoutCache.getWorkoutsByActivity('running');
 *   });
 *   const unsubscribe = UnifiedWorkoutCache.subscribe(() => { ... });
 *   return () => unsubscribe();
 * }, []);
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  WorkoutEventStore,
  StoredWorkout,
} from '../services/fitness/WorkoutEventStore';

export interface UseWorkoutEventStoreResult {
  /** All workouts in the store (sorted by date, newest first) */
  workouts: StoredWorkout[];
  /** Whether the store is currently loading/refreshing */
  isLoading: boolean;
  /** Error message if last operation failed */
  error: string | null;
  /** Trigger a refresh from Nostr relays */
  refresh: () => Promise<void>;
  /** Get workouts filtered by team ID */
  getByTeam: (teamId: string) => StoredWorkout[];
  /** Get workouts filtered by user pubkey */
  getByUser: (pubkey: string) => StoredWorkout[];
  /** Get today's workouts */
  getTodaysWorkouts: () => StoredWorkout[];
  /** Get recent workouts (last 2 days - matches fetch window) */
  getRecentWorkouts: () => StoredWorkout[];
  /** Get today's workouts for a specific team */
  getTodaysTeamWorkouts: (teamId: string) => StoredWorkout[];
  /** Unix timestamp of last fetch */
  lastFetchTime: number;
  /** Store statistics */
  stats: {
    totalWorkouts: number;
    todaysWorkouts: number;
    teamsWithWorkouts: number;
  };
}

export function useWorkoutEventStore(): UseWorkoutEventStoreResult {
  const store = WorkoutEventStore.getInstance();

  const [workouts, setWorkouts] = useState<StoredWorkout[]>([]);
  const [isLoading, setIsLoading] = useState(store.isLoading);
  const [error, setError] = useState<string | null>(store.error);
  const [lastFetchTime, setLastFetchTime] = useState(store.lastFetchTime);

  // Subscribe to store updates
  useEffect(() => {
    const unsubscribe = store.subscribe((updatedWorkouts) => {
      setWorkouts(updatedWorkouts);
      setIsLoading(store.isLoading);
      setError(store.error);
      setLastFetchTime(store.lastFetchTime);
    });

    // Initial load from store
    const initialWorkouts = store.getAllWorkouts();
    setWorkouts(initialWorkouts);
    setIsLoading(store.isLoading);
    setError(store.error);
    setLastFetchTime(store.lastFetchTime);

    // Initialize store if not already done
    store.initialize().catch((err) => {
      console.error('[useWorkoutEventStore] Initialization error:', err);
    });

    return unsubscribe;
  }, []);

  // Refresh function
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await store.refresh();
    } finally {
      setIsLoading(store.isLoading);
      setError(store.error);
    }
  }, []);

  // Filter functions (memoized to prevent unnecessary re-renders)
  const getByTeam = useCallback(
    (teamId: string) => store.getWorkoutsByTeam(teamId),
    [workouts]
  );

  const getByUser = useCallback(
    (pubkey: string) => store.getWorkoutsByUser(pubkey),
    [workouts]
  );

  const getTodaysWorkouts = useCallback(
    () => store.getTodaysWorkouts(),
    [workouts]
  );

  const getRecentWorkouts = useCallback(
    () => store.getRecentWorkouts(),
    [workouts]
  );

  const getTodaysTeamWorkouts = useCallback(
    (teamId: string) => store.getTodaysTeamWorkouts(teamId),
    [workouts]
  );

  // Compute stats
  const stats = useMemo(() => {
    const storeStats = store.getStats();
    return {
      totalWorkouts: storeStats.totalWorkouts,
      todaysWorkouts: storeStats.todaysWorkouts,
      teamsWithWorkouts: storeStats.teamsWithWorkouts,
    };
  }, [workouts]);

  return {
    workouts,
    isLoading,
    error,
    refresh,
    getByTeam,
    getByUser,
    getTodaysWorkouts,
    getRecentWorkouts,
    getTodaysTeamWorkouts,
    lastFetchTime,
    stats,
  };
}

export default useWorkoutEventStore;
