/**
 * JanuaryWalkingService - January Walking Contest Service
 *
 * A walking-only challenge for January 2026.
 * Top 3 participants with the longest walking distance win 1k sats each.
 *
 * Features:
 * - Open to everyone (all joined users eligible for prizes)
 * - Season II members auto-appear if they have walking data
 * - Uses Running Bitcoin pattern: local join + Supabase registration
 * - Profile resolution: Season II → Supabase → "Anonymous Athlete"
 * - Walking activity type only
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { nip19 } from 'nostr-tools';
import { UnifiedWorkoutCache } from '../cache/UnifiedWorkoutCache';
import {
  JANUARY_WALKING_JOINED_KEY,
  getJanuaryWalkingStatus,
  getJanuaryWalkingStartTimestamp,
  getJanuaryWalkingEndTimestamp,
} from '../../constants/januaryWalking';
import { SEASON_2_PARTICIPANTS } from '../../constants/season2';
import { getBaselineTotals } from '../../constants/season2Baseline';
import type { CachedWorkout } from '../cache/UnifiedWorkoutCache';
import { ProfileCache } from '../../cache/ProfileCache';
import { SupabaseCompetitionService } from '../backend/SupabaseCompetitionService';

// Key for storing ALL joined users (not just current user)
const JOINED_USERS_KEY = '@runstr:january_walking_joined_users';

export interface JanuaryWalkingParticipant {
  pubkey: string;
  npub?: string;
  name: string;
  picture?: string;
  totalDistanceKm: number;
  workoutCount: number;
  isSeasonParticipant: boolean; // Eligible for prize
  isLocalJoin: boolean; // Joined locally but not Season II
  rank: number;
}

export interface JanuaryWalkingLeaderboard {
  participants: JanuaryWalkingParticipant[]; // Top 25 (Season II only)
  currentUserEntry?: JanuaryWalkingParticipant; // If user joined but not in top 25
  currentUserRank?: number;
  totalParticipants: number;
  totalDistanceKm: number;
  lastUpdated: number;
}


class JanuaryWalkingServiceClass {
  private static instance: JanuaryWalkingServiceClass;

  static getInstance(): JanuaryWalkingServiceClass {
    if (!this.instance) {
      this.instance = new JanuaryWalkingServiceClass();
    }
    return this.instance;
  }

  /**
   * Get the January Walking Contest leaderboard
   * @param currentUserPubkey - The logged-in user's pubkey (to include them privately if joined)
   */
  async getLeaderboard(currentUserPubkey?: string): Promise<JanuaryWalkingLeaderboard> {
    const startTime = Date.now();
    console.log(`[JanuaryWalking] ========== getLeaderboard() ==========`);

    // If event hasn't started yet, return empty leaderboard
    const status = getJanuaryWalkingStatus();
    if (status === 'upcoming') {
      console.log('[JanuaryWalking] Event is upcoming - returning empty leaderboard');
      return this.emptyLeaderboard();
    }

    try {
      // Get January date range timestamps
      const startTs = getJanuaryWalkingStartTimestamp();
      const endTs = getJanuaryWalkingEndTimestamp();
      console.log(`[JanuaryWalking] Date range: ${new Date(startTs * 1000).toLocaleDateString()} - ${new Date(endTs * 1000).toLocaleDateString()}`);

      // Get walking workouts from cache, filtered by January date range
      const cache = UnifiedWorkoutCache;
      await cache.ensureLoaded();

      const walkingWorkouts = cache.getWorkoutsByActivity('walking')
        .filter(w => w.createdAt >= startTs && w.createdAt <= endTs);

      console.log(`[JanuaryWalking] Walking workouts in January: ${walkingWorkouts.length}`);

      // Get eligible participants: Season II + locally joined users
      const season2Pubkeys = new Set(SEASON_2_PARTICIPANTS.map(p => p.pubkey));
      const locallyJoined = await this.getJoinedUsers();
      const eligiblePubkeys = new Set([...season2Pubkeys, ...locallyJoined]);

      // Fetch Supabase profiles for non-Season II users
      const supabaseProfiles = await this.getParticipantProfilesFromSupabase();

      // Aggregate distance per participant (ALL eligible users)
      const stats = new Map<string, { distance: number; workoutCount: number }>();

      for (const w of walkingWorkouts) {
        if (!eligiblePubkeys.has(w.pubkey)) continue;

        const existing = stats.get(w.pubkey) || { distance: 0, workoutCount: 0 };
        existing.distance += w.distance;
        existing.workoutCount += 1;
        stats.set(w.pubkey, existing);
      }

      // Build participant entries with profile resolution chain
      const participantEntries: JanuaryWalkingParticipant[] = [];
      for (const [pubkey, data] of stats) {
        if (data.workoutCount === 0) continue;

        // Profile resolution: Season II → Supabase → fallback
        const season2Profile = SEASON_2_PARTICIPANTS.find(p => p.pubkey === pubkey);
        const isSeason2 = !!season2Profile;

        let name = season2Profile?.name;
        let picture = season2Profile?.picture;
        let npub = season2Profile?.npub;

        // For non-Season II, check Supabase profiles
        if (!season2Profile) {
          try {
            npub = nip19.npubEncode(pubkey);
            const supabaseProfile = supabaseProfiles.get(npub);
            if (supabaseProfile) {
              name = supabaseProfile.name;
              picture = supabaseProfile.picture;
            }
          } catch {
            // Ignore encoding errors
          }
        }

        participantEntries.push({
          pubkey,
          npub,
          name: name || 'Anonymous Athlete',
          picture,
          totalDistanceKm: data.distance,
          workoutCount: data.workoutCount,
          isSeasonParticipant: isSeason2,
          isLocalJoin: !isSeason2,
          rank: 0,
        });
      }

      // Sort by distance (descending) and assign ranks
      participantEntries.sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);
      participantEntries.forEach((p, index) => {
        p.rank = index + 1;
      });

      // Check if current user should be included privately
      let currentUserEntry: JanuaryWalkingParticipant | undefined;
      let currentUserRank: number | undefined;

      if (currentUserPubkey) {
        // Check if user has joined locally
        const hasJoined = await this.hasJoined(currentUserPubkey);
        const isSeasonParticipant = season2Pubkeys.has(currentUserPubkey);

        if (hasJoined || isSeasonParticipant) {
          // Get user's walking data
          const userWorkouts = walkingWorkouts.filter(w => w.pubkey === currentUserPubkey);
          const userDistance = userWorkouts.reduce((sum, w) => sum + w.distance, 0);
          const userWorkoutCount = userWorkouts.length;

          if (userWorkoutCount > 0) {
            // Find user's rank among all participants (including non-displayed ones)
            const allDistances = [...stats.values()].map(s => s.distance);

            // If user is local join, add their distance to the comparison
            if (!isSeasonParticipant) {
              allDistances.push(userDistance);
            }

            allDistances.sort((a, b) => b - a);
            const userRankIndex = allDistances.findIndex(d => d === userDistance);
            currentUserRank = userRankIndex + 1;

            // Check if user is already in the top 25
            const existingEntry = participantEntries.find(p => p.pubkey === currentUserPubkey);

            if (!existingEntry) {
              // User is not in top 25 or not a Season II member - create private entry
              const profile = SEASON_2_PARTICIPANTS.find(p => p.pubkey === currentUserPubkey);
              currentUserEntry = {
                pubkey: currentUserPubkey,
                npub: profile?.npub,
                name: profile?.name || `User ${currentUserPubkey.slice(0, 8)}`,
                picture: profile?.picture,
                totalDistanceKm: userDistance,
                workoutCount: userWorkoutCount,
                isSeasonParticipant,
                isLocalJoin: !isSeasonParticipant,
                rank: currentUserRank,
              };
            } else {
              currentUserRank = existingEntry.rank;
            }
          }
        }
      }

      // Calculate totals
      const totalDistanceKm = participantEntries.reduce((sum, p) => sum + p.totalDistanceKm, 0);

      console.log(`[JanuaryWalking] Leaderboard built in ${Date.now() - startTime}ms`);
      console.log(`[JanuaryWalking]   - Season II participants with data: ${participantEntries.length}`);
      console.log(`[JanuaryWalking]   - Total distance: ${totalDistanceKm.toFixed(2)} km`);

      return {
        participants: participantEntries.slice(0, 25), // Top 25
        currentUserEntry,
        currentUserRank,
        totalParticipants: participantEntries.length,
        totalDistanceKm,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      console.error('[JanuaryWalking] Error getting leaderboard:', error);
      return this.emptyLeaderboard();
    }
  }

  /**
   * Get all locally joined users
   */
  async getJoinedUsers(): Promise<string[]> {
    try {
      const stored = await AsyncStorage.getItem(JOINED_USERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[JanuaryWalking] Error getting joined users:', error);
      return [];
    }
  }

  /**
   * Register user in Supabase with profile data
   * Fire-and-forget - doesn't block join flow
   */
  async registerInSupabase(npub: string): Promise<boolean> {
    try {
      let pubkey: string;
      try {
        const decoded = nip19.decode(npub);
        pubkey = decoded.data as string;
      } catch {
        pubkey = npub;
      }

      // Fetch user's Nostr profile
      const profiles = await ProfileCache.fetchProfiles([pubkey]);
      const profile = profiles.get(pubkey);
      const profileData = profile
        ? { name: profile.name || profile.display_name, picture: profile.picture }
        : undefined;

      const result = await SupabaseCompetitionService.joinCompetition(
        'january-walking',
        npub,
        profileData
      );

      if (result.success) {
        console.log(`[JanuaryWalking] ✅ Registered ${npub.slice(0, 12)}... in Supabase`);
      }
      return result.success;
    } catch (error) {
      console.warn('[JanuaryWalking] Failed to register in Supabase:', error);
      return false;
    }
  }

  /**
   * Get participant profiles from Supabase
   */
  async getParticipantProfilesFromSupabase(): Promise<Map<string, { name?: string; picture?: string }>> {
    const profiles = new Map<string, { name?: string; picture?: string }>();

    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return profiles;
      }

      const competitionId = await SupabaseCompetitionService.getCompetitionId('january-walking');
      if (!competitionId) {
        return profiles;
      }

      const url = `${supabaseUrl}/rest/v1/competition_participants?competition_id=eq.${competitionId}&select=npub,name,picture`;
      const response = await fetch(url, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });

      if (!response.ok) return profiles;

      const data = await response.json();
      for (const row of data) {
        if (row.npub && (row.name || row.picture)) {
          profiles.set(row.npub, { name: row.name, picture: row.picture });
        }
      }

      console.log(`[JanuaryWalking] Loaded ${profiles.size} profiles from Supabase`);
    } catch (error) {
      console.warn('[JanuaryWalking] Error fetching Supabase profiles:', error);
    }

    return profiles;
  }

  /**
   * Create empty leaderboard structure
   */
  private emptyLeaderboard(): JanuaryWalkingLeaderboard {
    return {
      participants: [],
      totalParticipants: 0,
      totalDistanceKm: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Join the January Walking Contest
   * Uses local-first pattern with fire-and-forget Supabase registration
   */
  async join(pubkey: string): Promise<boolean> {
    try {
      // Get existing joined users
      const joinedUsers = await this.getJoinedUsers();

      // Add user if not already joined
      if (!joinedUsers.includes(pubkey)) {
        joinedUsers.push(pubkey);
        await AsyncStorage.setItem(JOINED_USERS_KEY, JSON.stringify(joinedUsers));
        console.log(`[JanuaryWalking] User ${pubkey.slice(0, 8)} joined the contest`);
      }

      // Fire-and-forget: Register in Supabase with profile data
      const npub = nip19.npubEncode(pubkey);
      this.registerInSupabase(npub).catch((err) => {
        console.warn('[JanuaryWalking] Supabase registration failed (non-blocking):', err);
      });

      return true;
    } catch (error) {
      console.error('[JanuaryWalking] Error joining contest:', error);
      return false;
    }
  }

  /**
   * Check if user has joined the contest
   */
  async hasJoined(pubkey: string): Promise<boolean> {
    try {
      const joinedUsers = await this.getJoinedUsers();
      return joinedUsers.includes(pubkey);
    } catch (error) {
      console.error('[JanuaryWalking] Error checking join status:', error);
      return false;
    }
  }

  /**
   * Check if user is a Season II participant (eligible for prize)
   */
  isSeasonParticipant(pubkey: string): boolean {
    return SEASON_2_PARTICIPANTS.some(p => p.pubkey === pubkey);
  }

  /**
   * Leave the contest (remove local join)
   */
  async leave(pubkey: string): Promise<boolean> {
    try {
      const joinedUsers = await this.getJoinedUsers();
      const filtered = joinedUsers.filter((p) => p !== pubkey);
      await AsyncStorage.setItem(JOINED_USERS_KEY, JSON.stringify(filtered));
      console.log(`[JanuaryWalking] User ${pubkey.slice(0, 8)} left the contest`);
      return true;
    } catch (error) {
      console.error('[JanuaryWalking] Error leaving contest:', error);
      return false;
    }
  }

  /**
   * Get all participant pubkeys (Season II participants)
   */
  getParticipantPubkeys(): string[] {
    return SEASON_2_PARTICIPANTS.map(p => p.pubkey);
  }

  /**
   * Build leaderboard from baseline data only (instant load)
   * Uses walking totals from Season II baseline
   */
  buildLeaderboardFromBaseline(currentUserPubkey?: string): JanuaryWalkingLeaderboard {
    console.log('[JanuaryWalking] Building leaderboard from baseline data');

    const participants: JanuaryWalkingParticipant[] = [];

    for (const participant of SEASON_2_PARTICIPANTS) {
      const baseline = getBaselineTotals(participant.pubkey);
      const walkingDistance = baseline.walking.distance;
      const walkingCount = baseline.walking.count;

      // Only include participants with walking data
      if (walkingCount > 0) {
        participants.push({
          pubkey: participant.pubkey,
          npub: participant.npub,
          name: participant.name,
          picture: participant.picture,
          totalDistanceKm: walkingDistance,
          workoutCount: walkingCount,
          isSeasonParticipant: true,
          isLocalJoin: false,
          rank: 0,
        });
      }
    }

    // Sort by distance and assign ranks
    participants.sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);
    participants.forEach((p, index) => {
      p.rank = index + 1;
    });

    // Find current user entry if outside visible range
    let currentUserEntry: JanuaryWalkingParticipant | undefined;
    let currentUserRank: number | undefined;

    if (currentUserPubkey) {
      const userIndex = participants.findIndex(p => p.pubkey === currentUserPubkey);
      if (userIndex >= 0) {
        currentUserRank = userIndex + 1;
      }
    }

    const totalDistanceKm = participants.reduce((sum, p) => sum + p.totalDistanceKm, 0);

    console.log(`[JanuaryWalking] Baseline: ${participants.length} participants, ${totalDistanceKm.toFixed(2)} km total`);

    return {
      participants,
      currentUserEntry,
      currentUserRank,
      totalParticipants: participants.length,
      totalDistanceKm,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Build leaderboard from baseline + fresh workouts
   * Fresh workouts are added on top of baseline totals
   */
  buildLeaderboardFromFresh(
    freshWorkouts: CachedWorkout[],
    currentUserPubkey?: string
  ): JanuaryWalkingLeaderboard {
    console.log(`[JanuaryWalking] Building leaderboard from baseline + ${freshWorkouts.length} fresh workouts`);

    // Start with baseline data
    const stats = new Map<string, { distance: number; workoutCount: number }>();

    for (const participant of SEASON_2_PARTICIPANTS) {
      const baseline = getBaselineTotals(participant.pubkey);
      stats.set(participant.pubkey, {
        distance: baseline.walking.distance,
        workoutCount: baseline.walking.count,
      });
    }

    // Add fresh walking workouts on top
    for (const workout of freshWorkouts) {
      const activityLower = workout.activityType?.toLowerCase() || '';
      if (!activityLower.includes('walk')) continue;

      const existing = stats.get(workout.pubkey);
      if (existing) {
        existing.distance += workout.distance;
        existing.workoutCount += 1;
      }
    }

    // Build participant entries
    const participants: JanuaryWalkingParticipant[] = [];

    for (const participant of SEASON_2_PARTICIPANTS) {
      const data = stats.get(participant.pubkey);
      if (!data || data.workoutCount === 0) continue;

      participants.push({
        pubkey: participant.pubkey,
        npub: participant.npub,
        name: participant.name,
        picture: participant.picture,
        totalDistanceKm: data.distance,
        workoutCount: data.workoutCount,
        isSeasonParticipant: true,
        isLocalJoin: false,
        rank: 0,
      });
    }

    // Sort by distance and assign ranks
    participants.sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);
    participants.forEach((p, index) => {
      p.rank = index + 1;
    });

    // Find current user entry
    let currentUserEntry: JanuaryWalkingParticipant | undefined;
    let currentUserRank: number | undefined;

    if (currentUserPubkey) {
      const userIndex = participants.findIndex(p => p.pubkey === currentUserPubkey);
      if (userIndex >= 0) {
        currentUserRank = userIndex + 1;
      }
    }

    const totalDistanceKm = participants.reduce((sum, p) => sum + p.totalDistanceKm, 0);

    console.log(`[JanuaryWalking] Fresh: ${participants.length} participants, ${totalDistanceKm.toFixed(2)} km total`);

    return {
      participants,
      currentUserEntry,
      currentUserRank,
      totalParticipants: participants.length,
      totalDistanceKm,
      lastUpdated: Date.now(),
    };
  }
}

// Export singleton instance
export const JanuaryWalkingService = JanuaryWalkingServiceClass.getInstance();
