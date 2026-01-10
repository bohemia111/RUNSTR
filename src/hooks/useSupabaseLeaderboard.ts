/**
 * useSupabaseLeaderboard - Fetch leaderboard from Supabase backend
 *
 * This is the NEW database-backed leaderboard system that replaces Nostr queries.
 * Benefits:
 * - Instant response times (~200ms vs 3-5 seconds for Nostr)
 * - Workout verification (only app-submitted workouts count)
 * - Pre-computed rankings (no client-side calculation)
 *
 * IMPORTANT: This leaderboard only includes workouts submitted via the "Compete"
 * button in the app. Historical Nostr workouts are NOT included unless migrated.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nip19 } from 'nostr-tools';
import { SupabaseCompetitionService } from '../services/backend/SupabaseCompetitionService';
import { isSupabaseConfigured, CharityRanking } from '../utils/supabase';
import { ProfileCache } from '../cache/ProfileCache';
import { SEASON_2_PARTICIPANTS } from '../constants/season2';

// Cache keys and TTL
const LEADERBOARD_CACHE_PREFIX = '@runstr:leaderboard:';
const CHARITY_CACHE_PREFIX = '@runstr:charity_rankings:';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedData<T> {
  data: T;
  timestamp: number;
}

/**
 * Load cached leaderboard data
 */
async function loadCachedLeaderboard(
  competitionId: string
): Promise<{ leaderboard: SupabaseLeaderboardEntry[]; charityRankings: CharityRanking[] } | null> {
  try {
    const [leaderboardJson, charityJson] = await Promise.all([
      AsyncStorage.getItem(`${LEADERBOARD_CACHE_PREFIX}${competitionId}`),
      AsyncStorage.getItem(`${CHARITY_CACHE_PREFIX}${competitionId}`),
    ]);

    if (!leaderboardJson) return null;

    const leaderboardCache: CachedData<SupabaseLeaderboardEntry[]> = JSON.parse(leaderboardJson);
    const charityCache: CachedData<CharityRanking[]> | null = charityJson ? JSON.parse(charityJson) : null;

    // Check if cache is still valid
    if (Date.now() - leaderboardCache.timestamp > CACHE_TTL) {
      return null;
    }

    return {
      leaderboard: leaderboardCache.data,
      charityRankings: charityCache?.data || [],
    };
  } catch (e) {
    console.warn('[useSupabaseLeaderboard] Cache load error:', e);
    return null;
  }
}

/**
 * Save leaderboard data to cache
 */
async function saveCachedLeaderboard(
  competitionId: string,
  leaderboard: SupabaseLeaderboardEntry[],
  charityRankings: CharityRanking[]
): Promise<void> {
  try {
    const timestamp = Date.now();
    await Promise.all([
      AsyncStorage.setItem(
        `${LEADERBOARD_CACHE_PREFIX}${competitionId}`,
        JSON.stringify({ data: leaderboard, timestamp })
      ),
      AsyncStorage.setItem(
        `${CHARITY_CACHE_PREFIX}${competitionId}`,
        JSON.stringify({ data: charityRankings, timestamp })
      ),
    ]);
  } catch (e) {
    console.warn('[useSupabaseLeaderboard] Cache save error:', e);
  }
}

/**
 * Convert npub to hex pubkey
 * ProfileCache requires hex format, but Supabase stores npub format
 */
function npubToHex(npubOrHex: string): string {
  if (!npubOrHex) return '';

  // Already hex format (64 chars, no 'npub' prefix)
  if (npubOrHex.length === 64 && !npubOrHex.startsWith('npub')) {
    return npubOrHex;
  }

  // Convert npub to hex
  if (npubOrHex.startsWith('npub')) {
    try {
      const decoded = nip19.decode(npubOrHex);
      if (decoded.type === 'npub') {
        return decoded.data;
      }
    } catch (e) {
      console.warn('[useSupabaseLeaderboard] Failed to decode npub:', npubOrHex);
    }
  }

  return npubOrHex;
}

export interface SupabaseLeaderboardEntry {
  npub: string;
  score: number;
  rank: number;
  workout_count?: number;
  // Enriched fields from profile cache
  name?: string;
  picture?: string;
  displayName?: string;
  // Charity from user's most recent workout
  charityId?: string;
  charityName?: string;
}

interface UseSupabaseLeaderboardReturn {
  leaderboard: SupabaseLeaderboardEntry[];
  charityRankings: CharityRanking[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  currentUserRank?: number;
  currentUserPubkey?: string;
  isSupabaseAvailable: boolean;
}

/**
 * Hook to fetch leaderboard from Supabase
 *
 * @param competitionId - The competition ID (UUID or external_id like "season2-2025")
 * @param enrichProfiles - Whether to fetch profile data for participants (default: true)
 */
export function useSupabaseLeaderboard(
  competitionId: string,
  enrichProfiles: boolean = true
): UseSupabaseLeaderboardReturn {
  // For Season II competitions, use hardcoded participants as initial data
  // This eliminates loading placeholders - users see data immediately
  const isSeason2 = competitionId.startsWith('season2-');
  const initialLeaderboard = useMemo<SupabaseLeaderboardEntry[]>(() => {
    if (!isSeason2) return [];
    // Show hardcoded participants with 0 score initially
    return SEASON_2_PARTICIPANTS.map((p, index) => ({
      npub: p.npub,
      score: 0,
      rank: index + 1,
      workout_count: 0,
      name: p.name,
      picture: p.picture,
      displayName: p.name,
    }));
  }, [isSeason2]);

  const [leaderboard, setLeaderboard] = useState<SupabaseLeaderboardEntry[]>(initialLeaderboard);
  const [charityRankings, setCharityRankings] = useState<CharityRanking[]>([]);
  const [isLoading, setIsLoading] = useState(!isSeason2); // Don't show loading for Season II (we have initial data)
  const [error, setError] = useState<string | null>(null);
  const [currentUserPubkey, setCurrentUserPubkey] = useState<string | undefined>();
  const [currentUserRank, setCurrentUserRank] = useState<number | undefined>();
  const isMounted = useRef(true);
  const lastFetchTime = useRef<number>(0);
  const MIN_REFETCH_INTERVAL = 30000; // 30 seconds minimum between refetches

  // Check if Supabase is available
  const isSupabaseAvailable = isSupabaseConfigured();

  // Load from cache immediately on mount, fallback to initial data
  useEffect(() => {
    const loadFromCache = async () => {
      const cached = await loadCachedLeaderboard(competitionId);
      if (cached && cached.leaderboard.length > 0 && isMounted.current) {
        console.log(`[useSupabaseLeaderboard] Loaded ${cached.leaderboard.length} entries from cache for ${competitionId}`);
        setLeaderboard(cached.leaderboard);
        setCharityRankings(cached.charityRankings);
      } else if (isSeason2 && isMounted.current) {
        // No cache - use initial data with 0 scores
        setLeaderboard(initialLeaderboard);
        setCharityRankings([]);
      }
    };
    loadFromCache();
  }, [competitionId, isSeason2, initialLeaderboard]);

  // Get current user pubkey
  useEffect(() => {
    const fetchUserPubkey = async () => {
      const npub = await AsyncStorage.getItem('@runstr:npub');
      if (npub && isMounted.current) {
        setCurrentUserPubkey(npub);
      }
    };
    fetchUserPubkey();
  }, []);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async (force: boolean = false) => {
    if (!isSupabaseAvailable) {
      setError('Supabase not configured');
      setIsLoading(false);
      return;
    }

    // Throttle refetches to prevent flickering (unless forced)
    const now = Date.now();
    if (!force && lastFetchTime.current > 0 && now - lastFetchTime.current < MIN_REFETCH_INTERVAL) {
      console.log('[useSupabaseLeaderboard] Skipping refetch - too soon since last fetch');
      return;
    }

    try {
      // Only show loading state for initial fetch (prevents flickering on refresh)
      if (lastFetchTime.current === 0) {
        setIsLoading(true);
      }
      setError(null);

      const result = await SupabaseCompetitionService.getLeaderboard(competitionId);
      lastFetchTime.current = Date.now();

      if (result.error) {
        setError(result.error);
        setLeaderboard([]);
        setCharityRankings([]);
        return;
      }

      let enrichedLeaderboard: SupabaseLeaderboardEntry[] = result.leaderboard;

      // Enrich with profile data if requested
      if (enrichProfiles && result.leaderboard.length > 0) {
        // Create fallback map from hardcoded SEASON_2_PARTICIPANTS data
        const hardcodedMap = new Map(
          SEASON_2_PARTICIPANTS.map((p) => [p.npub, { name: p.name, picture: p.picture }])
        );

        // Convert npubs to hex pubkeys for ProfileCache (requires hex format)
        const hexPubkeys = result.leaderboard
          .map((e) => npubToHex(e.npub))
          .filter((hex) => hex.length === 64); // Only valid hex keys

        // Create npub -> hex mapping for lookups
        const npubToHexMap = new Map<string, string>();
        result.leaderboard.forEach((e) => {
          const hex = npubToHex(e.npub);
          if (hex.length === 64) {
            npubToHexMap.set(e.npub, hex);
          }
        });

        // Fetch profiles using hex pubkeys
        const profilesMap = await ProfileCache.fetchProfiles(hexPubkeys);

        // For Season II, filter to only include participants from hardcoded list
        // This removes any test/extra entries not in official participant list
        const filteredLeaderboard = isSeason2
          ? result.leaderboard.filter((entry) => hardcodedMap.has(entry.npub))
          : result.leaderboard;

        enrichedLeaderboard = filteredLeaderboard.map((entry) => {
          const hexKey = npubToHexMap.get(entry.npub);
          const profile = hexKey ? profilesMap.get(hexKey) : undefined;
          // Fallback to hardcoded data if Nostr profile not found
          const hardcoded = hardcodedMap.get(entry.npub);
          return {
            ...entry,
            name: profile?.name || hardcoded?.name || 'Anonymous',
            picture: profile?.picture || hardcoded?.picture,
            displayName: profile?.name || hardcoded?.name || 'Anonymous',
            // Pass through charity data from service
            charityId: entry.charityId,
            charityName: entry.charityName,
          };
        });
      }

      if (isMounted.current) {
        // For Season II, ensure ALL participants appear (even those with 0 in this category)
        let finalLeaderboard = enrichedLeaderboard;
        if (isSeason2) {
          const existingNpubs = new Set(enrichedLeaderboard.map(e => e.npub));
          const missingParticipants: SupabaseLeaderboardEntry[] = SEASON_2_PARTICIPANTS
            .filter(p => !existingNpubs.has(p.npub))
            .map(p => ({
              npub: p.npub,
              score: 0,
              rank: 0, // Will be assigned below
              workout_count: 0,
              name: p.name,
              picture: p.picture,
              displayName: p.name,
            }));

          // Combine and re-rank (active participants first, then 0-score alphabetically)
          finalLeaderboard = [
            ...enrichedLeaderboard,
            ...missingParticipants.sort((a, b) => (a.name || '').localeCompare(b.name || '')),
          ].map((entry, index) => ({ ...entry, rank: index + 1 }));
        }

        setLeaderboard(finalLeaderboard);
        setCharityRankings(result.charityRankings || []);

        // Save to cache for instant display on next visit
        saveCachedLeaderboard(competitionId, finalLeaderboard, result.charityRankings || []);

        // Find current user's rank
        if (currentUserPubkey) {
          const userEntry = enrichedLeaderboard.find(
            (e) => e.npub === currentUserPubkey
          );
          setCurrentUserRank(userEntry?.rank);
        }
      }
    } catch (err) {
      console.error('[useSupabaseLeaderboard] Error:', err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [competitionId, enrichProfiles, currentUserPubkey, isSupabaseAvailable, isSeason2]);

  // Initial fetch
  useEffect(() => {
    isMounted.current = true;
    fetchLeaderboard();

    return () => {
      isMounted.current = false;
    };
  }, [fetchLeaderboard]);

  // Auto-refresh when screen gains focus (e.g., after submitting a workout)
  // This ensures users see their newly submitted workouts immediately
  useFocusEffect(
    useCallback(() => {
      // Only refresh if data has been fetched before (avoid double-fetch on mount)
      if (!isLoading) {
        fetchLeaderboard();
      }
    }, [fetchLeaderboard, isLoading])
  );

  // Refresh function (forced - bypasses throttle)
  const refresh = useCallback(async () => {
    await fetchLeaderboard(true);
  }, [fetchLeaderboard]);

  return {
    leaderboard,
    charityRankings,
    isLoading,
    error,
    refresh,
    currentUserRank,
    currentUserPubkey,
    isSupabaseAvailable,
  };
}

/**
 * Hook to check if user is participating in a competition
 */
export function useCompetitionParticipation(competitionId: string) {
  const [isParticipating, setIsParticipating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkParticipation = async () => {
      try {
        const npub = await AsyncStorage.getItem('@runstr:npub');
        if (!npub) {
          setIsParticipating(false);
          setIsLoading(false);
          return;
        }

        const participating = await SupabaseCompetitionService.isParticipant(
          competitionId,
          npub
        );
        setIsParticipating(participating);
      } catch (err) {
        console.error('[useCompetitionParticipation] Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkParticipation();
  }, [competitionId]);

  const join = useCallback(async () => {
    const npub = await AsyncStorage.getItem('@runstr:npub');
    if (!npub) return false;

    const result = await SupabaseCompetitionService.joinCompetition(
      competitionId,
      npub
    );
    if (result.success) {
      setIsParticipating(true);
    }
    return result.success;
  }, [competitionId]);

  const leave = useCallback(async () => {
    const npub = await AsyncStorage.getItem('@runstr:npub');
    if (!npub) return false;

    const result = await SupabaseCompetitionService.leaveCompetition(
      competitionId,
      npub
    );
    if (result.success) {
      setIsParticipating(false);
    }
    return result.success;
  }, [competitionId]);

  return {
    isParticipating,
    isLoading,
    join,
    leave,
  };
}

export default useSupabaseLeaderboard;
