/**
 * useSeason2 - React hooks for RUNSTR Season 2 competition
 *
 * Provides hooks for:
 * - Leaderboard data with loading states
 * - Registration status and join functionality
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Season2Service } from '../services/season/Season2Service';
import { UnifiedCacheService } from '../services/cache/UnifiedCacheService';
import {
  getSeason2Status,
  getSeason2DateRange,
  SEASON_2_CONFIG,
} from '../constants/season2';
import type {
  Season2ActivityType,
  Season2Leaderboard,
  Season2Status,
} from '../types/season2';

// ============================================================================
// useSeason2Leaderboard - Leaderboard data hook
// ============================================================================

interface UseSeason2LeaderboardReturn {
  leaderboard: Season2Leaderboard | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for Season 2 leaderboard data
 * Uses permanent cache - data only refreshes on pull-to-refresh
 * @param activityType - Running, Walking, or Cycling
 */
export function useSeason2Leaderboard(
  activityType: Season2ActivityType
): UseSeason2LeaderboardReturn {
  const [leaderboard, setLeaderboard] = useState<Season2Leaderboard | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  // Use refs to always have the latest values to avoid stale closures
  const activityTypeRef = useRef(activityType);
  activityTypeRef.current = activityType;
  const leaderboardRef = useRef(leaderboard);
  leaderboardRef.current = leaderboard;

  const loadLeaderboard = useCallback(async (forceRefresh = false) => {
    setError(null);

    try {
      const userPubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');
      const currentActivityType = activityTypeRef.current;
      const cacheKey = `season2:leaderboard:${currentActivityType}`;

      // CACHE-FIRST PATTERN: Show cached data instantly, fetch fresh in background
      if (!forceRefresh) {
        const cached = await UnifiedCacheService.get<Season2Leaderboard>(cacheKey);
        if (cached && isMounted.current && activityTypeRef.current === currentActivityType) {
          console.log(`[useSeason2] Cache hit for ${currentActivityType} - showing instantly`);
          setLeaderboard(cached);
          setIsLoading(false); // Stop spinner immediately!

          // Background refresh (non-blocking) - don't show loading state
          Season2Service.getLeaderboard(currentActivityType, userPubkey || undefined, false)
            .then(fresh => {
              if (isMounted.current && activityTypeRef.current === currentActivityType) {
                setLeaderboard(fresh);
              }
            })
            .catch(err => console.warn('[useSeason2] Background refresh failed:', err));
          return;
        }
      }

      // SILENT REFRESH: Only show loading on first-ever load (no existing data)
      // Pull-to-refresh should NOT show spinner - just update silently
      const hasExistingData = leaderboardRef.current !== null;
      if (!hasExistingData) {
        setIsLoading(true);
      }

      const data = await Season2Service.getLeaderboard(
        currentActivityType,
        userPubkey || undefined,
        forceRefresh
      );

      if (isMounted.current && activityTypeRef.current === currentActivityType) {
        setLeaderboard(data);
      }
    } catch (err) {
      console.error('[useSeason2Leaderboard] Error:', err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, []); // Empty deps - uses ref for activityType

  useEffect(() => {
    isMounted.current = true;

    // Don't reset leaderboard to null - let cache-first pattern handle it
    // Only show loading if we don't have any data yet
    if (!leaderboard) {
      setIsLoading(true);
    }

    loadLeaderboard(false); // Initial load - cache-first

    return () => {
      isMounted.current = false;
    };
  }, [activityType, loadLeaderboard]);

  return {
    leaderboard,
    isLoading,
    error,
    refresh: () => loadLeaderboard(true), // Force refresh from Nostr
  };
}

// ============================================================================
// useSeason2Registration - Registration status hook
// ============================================================================

interface UseSeason2RegistrationReturn {
  isRegistered: boolean;
  isOfficial: boolean;
  isLocalOnly: boolean;
  isLoading: boolean;
  joinLocally: () => Promise<void>;
  openPaymentPage: () => void;
  refresh: () => Promise<void>;
}

/**
 * Hook for Season 2 registration status and actions
 */
export function useSeason2Registration(): UseSeason2RegistrationReturn {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isOfficial, setIsOfficial] = useState(false);
  const [isLocalOnly, setIsLocalOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isMounted = useRef(true);

  const checkRegistration = useCallback(async () => {
    setIsLoading(true);

    try {
      const userPubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');
      if (!userPubkey) {
        if (isMounted.current) {
          setIsRegistered(false);
          setIsOfficial(false);
          setIsLocalOnly(false);
        }
        return;
      }

      const status = await Season2Service.isUserRegistered(userPubkey);

      if (isMounted.current) {
        setIsRegistered(status.isRegistered);
        setIsOfficial(status.isOfficial);
        setIsLocalOnly(status.isLocalOnly);
      }
    } catch (err) {
      console.error('[useSeason2Registration] Error:', err);
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const joinLocally = useCallback(async () => {
    try {
      const userPubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');
      if (!userPubkey) {
        throw new Error('User not logged in');
      }

      await Season2Service.joinLocally(userPubkey);

      // Update state
      setIsRegistered(true);
      setIsLocalOnly(true);
    } catch (err) {
      console.error('[useSeason2Registration] Join error:', err);
      throw err;
    }
  }, []);

  const openPaymentPage = useCallback(() => {
    // Import Linking dynamically to avoid React Native import issues
    const { Linking } = require('react-native');

    if (SEASON_2_CONFIG.paymentUrl) {
      Linking.openURL(SEASON_2_CONFIG.paymentUrl);
    } else {
      console.warn('[Season2] Payment URL not configured');
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    checkRegistration();

    return () => {
      isMounted.current = false;
    };
  }, [checkRegistration]);

  return {
    isRegistered,
    isOfficial,
    isLocalOnly,
    isLoading,
    joinLocally,
    openPaymentPage,
    refresh: checkRegistration,
  };
}

// ============================================================================
// useSeason2Status - Season status hook
// ============================================================================

interface UseSeason2StatusReturn {
  status: Season2Status;
  dateRange: string;
  isActive: boolean;
  isUpcoming: boolean;
  isEnded: boolean;
  prizePoolBonus: number;
  prizePoolCharity: number;
  entryFeeSats: number;
}

/**
 * Hook for Season 2 status information
 */
export function useSeason2Status(): UseSeason2StatusReturn {
  const status = getSeason2Status();
  const dateRange = getSeason2DateRange();

  return {
    status,
    dateRange,
    isActive: status === 'active',
    isUpcoming: status === 'upcoming',
    isEnded: status === 'ended',
    prizePoolBonus: SEASON_2_CONFIG.prizePoolBonus,
    prizePoolCharity: SEASON_2_CONFIG.prizePoolCharity,
    entryFeeSats: SEASON_2_CONFIG.entryFeeSats,
  };
}

// ============================================================================
// Exports
// ============================================================================

export type {
  UseSeason2LeaderboardReturn,
  UseSeason2RegistrationReturn,
  UseSeason2StatusReturn,
};
