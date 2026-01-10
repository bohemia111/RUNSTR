/**
 * EinundzwanzigService - Einundzwanzig Fitness Challenge Service
 *
 * A team-based charity fundraiser for the Einundzwanzig community.
 * Participants select a charity and their running/walking distance
 * contributes to that charity's total.
 *
 * Features:
 * - Team-based leaderboard (charities ranked by total distance)
 * - Charity selection on join
 * - Uses UnifiedWorkoutCache for workout data
 * - Local storage for participant tracking
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { nip19 } from 'nostr-tools';
import { UnifiedWorkoutCache } from '../cache/UnifiedWorkoutCache';
import {
  getEinundzwanzigStatus,
  getEinundzwanzigStartTimestamp,
  getEinundzwanzigEndTimestamp,
  calculateSatsFromDistance,
} from '../../constants/einundzwanzig';
import { CHARITIES, getCharityById } from '../../constants/charities';
import { SEASON_2_PARTICIPANTS } from '../../constants/season2';
import { ProfileCache } from '../../cache/ProfileCache';
import { SupabaseCompetitionService } from '../backend/SupabaseCompetitionService';

const JOINED_USERS_KEY = '@runstr:einundzwanzig_joined';

export interface EinundzwanzigJoinRecord {
  pubkey: string;
  charityId: string;
  joinedAt: number;
}

export interface EinundzwanzigParticipant {
  pubkey: string;
  npub?: string;
  name: string;
  picture?: string;
  charityId: string;
  totalDistanceKm: number;
  workoutCount: number;
}

export interface CharityTeam {
  charityId: string;
  charityName: string;
  charityImage?: number;
  lightningAddress?: string;
  totalDistanceKm: number;
  estimatedSats: number;
  participants: EinundzwanzigParticipant[];
  participantCount: number;
}

export interface EinundzwanzigLeaderboard {
  charityTeams: CharityTeam[];
  totalDistanceKm: number;
  totalEstimatedSats: number;
  totalParticipants: number;
  lastUpdated: number;
}

class EinundzwanzigServiceClass {
  private static instance: EinundzwanzigServiceClass;

  static getInstance(): EinundzwanzigServiceClass {
    if (!this.instance) {
      this.instance = new EinundzwanzigServiceClass();
    }
    return this.instance;
  }

  /**
   * Get the Einundzwanzig Challenge leaderboard
   * Returns charity teams ranked by total distance
   */
  async getLeaderboard(): Promise<EinundzwanzigLeaderboard> {
    const startTime = Date.now();
    console.log(`[Einundzwanzig] ========== getLeaderboard() ==========`);

    // If event hasn't started yet, return empty leaderboard
    const status = getEinundzwanzigStatus();
    if (status === 'upcoming') {
      console.log('[Einundzwanzig] Event is upcoming - returning empty leaderboard');
      return this.emptyLeaderboard();
    }

    try {
      // Get date range timestamps
      const startTs = getEinundzwanzigStartTimestamp();
      const endTs = getEinundzwanzigEndTimestamp();
      console.log(
        `[Einundzwanzig] Date range: ${new Date(startTs * 1000).toLocaleDateString()} - ${new Date(endTs * 1000).toLocaleDateString()}`
      );

      // Get workouts from cache, filtered by date range
      const cache = UnifiedWorkoutCache;
      await cache.ensureLoaded();

      const runningWorkouts = cache
        .getWorkoutsByActivity('running')
        .filter((w) => w.createdAt >= startTs && w.createdAt <= endTs);
      const walkingWorkouts = cache
        .getWorkoutsByActivity('walking')
        .filter((w) => w.createdAt >= startTs && w.createdAt <= endTs);

      console.log(
        `[Einundzwanzig] Filtered workouts - Running: ${runningWorkouts.length}, Walking: ${walkingWorkouts.length}`
      );

      // Get all joined users
      const joinedUsers = await this.getJoinedUsers();
      const joinedPubkeys = new Set(joinedUsers.map((u) => u.pubkey));

      // Build map of pubkey -> charityId
      const userCharityMap = new Map<string, string>();
      for (const record of joinedUsers) {
        userCharityMap.set(record.pubkey, record.charityId);
      }

      // Aggregate distance per user
      const userStats = new Map<
        string,
        { distance: number; workoutCount: number }
      >();

      for (const w of [...runningWorkouts, ...walkingWorkouts]) {
        if (!joinedPubkeys.has(w.pubkey)) continue;

        const existing = userStats.get(w.pubkey) || {
          distance: 0,
          workoutCount: 0,
        };
        existing.distance += w.distance;
        existing.workoutCount += 1;
        userStats.set(w.pubkey, existing);
      }

      // Fetch profiles from Supabase for non-Season II users
      const supabaseProfiles = await this.getParticipantProfilesFromSupabase();

      // Group participants by charity
      const charityParticipants = new Map<string, EinundzwanzigParticipant[]>();

      for (const record of joinedUsers) {
        const stats = userStats.get(record.pubkey) || {
          distance: 0,
          workoutCount: 0,
        };

        // Profile resolution chain: Season II → Supabase → fallback
        const season2Profile = SEASON_2_PARTICIPANTS.find(
          (p) => p.pubkey === record.pubkey
        );

        let name = season2Profile?.name;
        let picture = season2Profile?.picture;
        let npub = season2Profile?.npub;

        // If not Season II, try Supabase profiles
        if (!season2Profile) {
          try {
            npub = nip19.npubEncode(record.pubkey);
            const supabaseProfile = supabaseProfiles.get(npub);
            if (supabaseProfile) {
              name = supabaseProfile.name;
              picture = supabaseProfile.picture;
            }
          } catch {
            // Ignore encoding errors
          }
        }

        const participant: EinundzwanzigParticipant = {
          pubkey: record.pubkey,
          npub,
          name: name || 'Anonymous Athlete',
          picture,
          charityId: record.charityId,
          totalDistanceKm: stats.distance,
          workoutCount: stats.workoutCount,
        };

        const existing = charityParticipants.get(record.charityId) || [];
        existing.push(participant);
        charityParticipants.set(record.charityId, existing);
      }

      // Build charity teams
      const charityTeams: CharityTeam[] = [];

      for (const [charityId, participants] of charityParticipants) {
        const charity = getCharityById(charityId);
        const totalDistance = participants.reduce(
          (sum, p) => sum + p.totalDistanceKm,
          0
        );

        // Sort participants by distance within team
        participants.sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);

        charityTeams.push({
          charityId,
          charityName: charity?.name || charityId,
          charityImage: charity?.image,
          lightningAddress: charity?.lightningAddress,
          totalDistanceKm: totalDistance,
          estimatedSats: calculateSatsFromDistance(totalDistance),
          participants,
          participantCount: participants.length,
        });
      }

      // Sort charity teams by total distance (descending)
      charityTeams.sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);

      // Calculate totals
      const totalDistanceKm = charityTeams.reduce(
        (sum, t) => sum + t.totalDistanceKm,
        0
      );
      const totalParticipants = joinedUsers.length;

      console.log(`[Einundzwanzig] Leaderboard built in ${Date.now() - startTime}ms`);
      console.log(`[Einundzwanzig]   - Charity teams: ${charityTeams.length}`);
      console.log(`[Einundzwanzig]   - Total participants: ${totalParticipants}`);
      console.log(`[Einundzwanzig]   - Total distance: ${totalDistanceKm.toFixed(2)} km`);

      return {
        charityTeams,
        totalDistanceKm,
        totalEstimatedSats: calculateSatsFromDistance(totalDistanceKm),
        totalParticipants,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      console.error('[Einundzwanzig] Error getting leaderboard:', error);
      return this.emptyLeaderboard();
    }
  }

  /**
   * Join the Einundzwanzig Challenge with a selected charity
   * Uses local-first pattern with fire-and-forget Supabase registration
   */
  async joinChallenge(pubkey: string, charityId: string): Promise<boolean> {
    try {
      const joinedUsers = await this.getJoinedUsers();

      // Check if already joined
      const existingIndex = joinedUsers.findIndex((u) => u.pubkey === pubkey);
      if (existingIndex >= 0) {
        // Update charity selection
        joinedUsers[existingIndex].charityId = charityId;
        console.log(
          `[Einundzwanzig] User ${pubkey.slice(0, 8)} updated charity to ${charityId}`
        );
      } else {
        // New join
        joinedUsers.push({
          pubkey,
          charityId,
          joinedAt: Date.now(),
        });
        console.log(
          `[Einundzwanzig] User ${pubkey.slice(0, 8)} joined with charity ${charityId}`
        );
      }

      // Save to local storage (instant UX)
      await AsyncStorage.setItem(JOINED_USERS_KEY, JSON.stringify(joinedUsers));

      // Fire-and-forget: Register in Supabase with profile data
      const npub = nip19.npubEncode(pubkey);
      this.registerInSupabase(npub, charityId).catch((err) => {
        console.warn('[Einundzwanzig] Supabase registration failed (non-blocking):', err);
      });

      return true;
    } catch (error) {
      console.error('[Einundzwanzig] Error joining challenge:', error);
      return false;
    }
  }

  /**
   * Check if user has joined the challenge
   */
  async hasJoined(pubkey: string): Promise<boolean> {
    try {
      const joinedUsers = await this.getJoinedUsers();
      return joinedUsers.some((u) => u.pubkey === pubkey);
    } catch (error) {
      console.error('[Einundzwanzig] Error checking join status:', error);
      return false;
    }
  }

  /**
   * Get user's selected charity
   */
  async getUserCharity(pubkey: string): Promise<string | null> {
    try {
      const joinedUsers = await this.getJoinedUsers();
      const record = joinedUsers.find((u) => u.pubkey === pubkey);
      return record?.charityId || null;
    } catch (error) {
      console.error('[Einundzwanzig] Error getting user charity:', error);
      return null;
    }
  }

  /**
   * Leave the challenge
   */
  async leaveChallenge(pubkey: string): Promise<boolean> {
    try {
      const joinedUsers = await this.getJoinedUsers();
      const filtered = joinedUsers.filter((u) => u.pubkey !== pubkey);
      await AsyncStorage.setItem(JOINED_USERS_KEY, JSON.stringify(filtered));
      console.log(`[Einundzwanzig] User ${pubkey.slice(0, 8)} left the challenge`);
      return true;
    } catch (error) {
      console.error('[Einundzwanzig] Error leaving challenge:', error);
      return false;
    }
  }

  /**
   * Get all joined users
   */
  async getJoinedUsers(): Promise<EinundzwanzigJoinRecord[]> {
    try {
      const stored = await AsyncStorage.getItem(JOINED_USERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[Einundzwanzig] Error getting joined users:', error);
      return [];
    }
  }

  /**
   * Get available charities for selection
   */
  getAvailableCharities() {
    return CHARITIES.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      image: c.image,
    }));
  }

  /**
   * Register user in Supabase competition_participants with profile data
   * Fire-and-forget - doesn't block join flow
   */
  async registerInSupabase(npub: string, charityId: string): Promise<boolean> {
    try {
      // Decode npub to get hex pubkey for profile fetch
      let pubkey: string;
      try {
        const decoded = nip19.decode(npub);
        pubkey = decoded.data as string;
      } catch {
        pubkey = npub; // Assume it's already hex
      }

      // Fetch user's Nostr profile (kind 0)
      const profiles = await ProfileCache.fetchProfiles([pubkey]);
      const profile = profiles.get(pubkey);
      const profileData = profile
        ? { name: profile.name || profile.display_name, picture: profile.picture }
        : undefined;

      // Register with profile data
      const result = await SupabaseCompetitionService.joinCompetition(
        'einundzwanzig',
        npub,
        profileData
      );

      if (result.success) {
        console.log(`[Einundzwanzig] ✅ Registered ${npub.slice(0, 12)}... in Supabase`);
      }
      return result.success;
    } catch (error) {
      console.warn('[Einundzwanzig] Failed to register in Supabase:', error);
      return false;
    }
  }

  /**
   * Get participant profiles from Supabase for leaderboard display
   * Returns map of npub → { name, picture }
   */
  async getParticipantProfilesFromSupabase(): Promise<Map<string, { name?: string; picture?: string }>> {
    const profiles = new Map<string, { name?: string; picture?: string }>();

    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.warn('[Einundzwanzig] Supabase not configured');
        return profiles;
      }

      // Get competition ID for einundzwanzig
      const competitionId = await SupabaseCompetitionService.getCompetitionId('einundzwanzig');
      if (!competitionId) {
        console.warn('[Einundzwanzig] Competition not found in Supabase');
        return profiles;
      }

      // Query participants with profile data
      const url = `${supabaseUrl}/rest/v1/competition_participants?competition_id=eq.${competitionId}&select=npub,name,picture`;
      const response = await fetch(url, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });

      if (!response.ok) {
        console.warn('[Einundzwanzig] Failed to fetch profiles from Supabase');
        return profiles;
      }

      const data = await response.json();
      for (const row of data) {
        if (row.npub && (row.name || row.picture)) {
          profiles.set(row.npub, { name: row.name, picture: row.picture });
        }
      }

      console.log(`[Einundzwanzig] Loaded ${profiles.size} profiles from Supabase`);
    } catch (error) {
      console.warn('[Einundzwanzig] Error fetching Supabase profiles:', error);
    }

    return profiles;
  }

  /**
   * Create empty leaderboard structure
   */
  private emptyLeaderboard(): EinundzwanzigLeaderboard {
    return {
      charityTeams: [],
      totalDistanceKm: 0,
      totalEstimatedSats: 0,
      totalParticipants: 0,
      lastUpdated: Date.now(),
    };
  }
}

// Export singleton instance
export const EinundzwanzigService = EinundzwanzigServiceClass.getInstance();
