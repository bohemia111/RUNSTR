/**
 * useWorkoutEventStore - React hook for accessing the centralized workout store
 *
 * Provides reactive access to the WorkoutEventStore singleton.
 * Components using this hook will automatically re-render when the store updates.
 *
 * Usage:
 * ```typescript
 * const { workouts, isLoading, refresh, getTodaysWorkouts } = useWorkoutEventStore();
 *
 * // Get today's workouts for a specific team
 * const teamWorkouts = workouts.filter(w => w.teamId === teamId);
 * const todaysTeamWorkouts = teamWorkouts.filter(w => isToday(w.createdAt));
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
    console.log('[useWorkoutEventStore] Setting up subscription...');
    const unsubscribe = store.subscribe((updatedWorkouts) => {
      console.log(`[useWorkoutEventStore] 📥 Subscription callback fired - received ${updatedWorkouts.length} workouts`);
      setWorkouts(updatedWorkouts);
      setIsLoading(store.isLoading);
      setError(store.error);
      setLastFetchTime(store.lastFetchTime);
    });

    // Initial load from store
    const initialWorkouts = store.getAllWorkouts();
    console.log(`[useWorkoutEventStore] Initial load from store: ${initialWorkouts.length} workouts`);
    setWorkouts(initialWorkouts);
    setIsLoading(store.isLoading);
    setError(store.error);
    setLastFetchTime(store.lastFetchTime);

    // Initialize store if not already done
    console.log('[useWorkoutEventStore] Calling store.initialize()...');
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
