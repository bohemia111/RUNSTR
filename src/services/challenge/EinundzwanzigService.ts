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
import { UnifiedWorkoutCache } from '../cache/UnifiedWorkoutCache';
import {
  getEinundzwanzigStatus,
  getEinundzwanzigStartTimestamp,
  getEinundzwanzigEndTimestamp,
  calculateSatsFromDistance,
} from '../../constants/einundzwanzig';
import { CHARITIES, getCharityById } from '../../constants/charities';
import { SEASON_2_PARTICIPANTS } from '../../constants/season2';

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

      // Group participants by charity
      const charityParticipants = new Map<string, EinundzwanzigParticipant[]>();

      for (const record of joinedUsers) {
        const stats = userStats.get(record.pubkey) || {
          distance: 0,
          workoutCount: 0,
        };
        const profile = SEASON_2_PARTICIPANTS.find(
          (p) => p.pubkey === record.pubkey
        );

        const participant: EinundzwanzigParticipant = {
          pubkey: record.pubkey,
          npub: profile?.npub,
          name: profile?.name || `User ${record.pubkey.slice(0, 8)}`,
          picture: profile?.picture,
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

      await AsyncStorage.setItem(JOINED_USERS_KEY, JSON.stringify(joinedUsers));
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
