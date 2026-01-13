/**
 * RunningBitcoinService - Running Bitcoin Challenge Service
 *
 * A featured charity event honoring Hal Finney (Bitcoin pioneer and ALS patient).
 * Uses Supabase workout_submissions for verified, anti-cheat validated data.
 *
 * Features:
 * - Queries Supabase for verified workouts (anti-cheat validated)
 * - Allows local joining for non-Season II users
 * - Filters for running + walking activities only
 * - Tracks 21km goal completion (finishers)
 * - All finishers earn 1,000 sats (auto-paid on share completion)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { type CachedWorkout } from '../cache/UnifiedWorkoutCache';
import {
  RUNNING_BITCOIN_CONFIG,
  getRunningBitcoinStatus,
  getRunningBitcoinStartTimestamp,
  getRunningBitcoinEndTimestamp,
} from '../../constants/runningBitcoin';
import { SEASON_2_PARTICIPANTS } from '../../constants/season2';
import { RewardLightningAddressService } from '../rewards/RewardLightningAddressService';
import { NWCGatewayService } from '../rewards/NWCGatewayService';
import { getInvoiceFromLightningAddress } from '../../utils/lnurl';
import { GlobalNDKService } from '../nostr/GlobalNDKService';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { SupabaseCompetitionService } from '../backend/SupabaseCompetitionService';
import { ProfileCache } from '../../cache/ProfileCache';
import { nip19 } from 'nostr-tools';

const JOINED_USERS_KEY = '@runstr:running_bitcoin_joined';
const REWARDS_CLAIMED_KEY = '@runstr:running_bitcoin_rewards_claimed';

export interface RunningBitcoinParticipant {
  pubkey: string;
  npub?: string;
  name: string;
  picture?: string;
  totalDistanceKm: number;
  workoutCount: number;
  isFinisher: boolean;
  finisherRank?: number;
  isSeasonParticipant: boolean; // true if Season II member
  isLocalJoin: boolean; // true if joined locally (not Season II)
}

export interface RunningBitcoinLeaderboard {
  participants: RunningBitcoinParticipant[];
  finishers: RunningBitcoinParticipant[];
  totalParticipants: number;
  totalDistanceKm: number;
  lastUpdated: number;
}

export interface RunningBitcoinProgress {
  distanceKm: number;
  goalKm: number;
  percentComplete: number;
  isFinisher: boolean;
  finisherRank?: number;
  workoutCount: number;
}

export interface ShareCompletionResult {
  success: boolean;
  error?: string;
  postEventId?: string;
  rewardPaid: boolean;
  rewardError?: string;
}

class RunningBitcoinServiceClass {
  private static instance: RunningBitcoinServiceClass;

  static getInstance(): RunningBitcoinServiceClass {
    if (!this.instance) {
      this.instance = new RunningBitcoinServiceClass();
    }
    return this.instance;
  }

  /**
   * Get the Running Bitcoin Challenge leaderboard
   * Queries Supabase workout_submissions for verified workouts
   * @param forceRefresh - If true, bypasses cache and fetches fresh data
   */
  async getLeaderboard(forceRefresh: boolean = false): Promise<RunningBitcoinLeaderboard> {
    const startTime = Date.now();
    console.log(`[RunningBitcoin] ========== getLeaderboard(forceRefresh=${forceRefresh}) ==========`);

    // If event hasn't started yet, return empty leaderboard
    const status = getRunningBitcoinStatus();
    if (status === 'upcoming') {
      console.log('[RunningBitcoin] Event is upcoming - returning empty leaderboard');
      return this.emptyLeaderboard();
    }

    try {
      // Get Running Bitcoin date range timestamps
      const startTs = getRunningBitcoinStartTimestamp();
      const endTs = getRunningBitcoinEndTimestamp();
      console.log(`[RunningBitcoin] Date range: ${new Date(startTs * 1000).toLocaleDateString()} - ${new Date(endTs * 1000).toLocaleDateString()}`);

      // Query Supabase for running + walking workouts in date range
      console.log(`[RunningBitcoin] 🔍 Fetching workouts from Supabase (Jan 10+ date range)`);
      const workouts = await this.fetchWorkoutsFromSupabase(startTs, endTs);
      console.log(`[RunningBitcoin] 📊 Total workouts from Supabase: ${workouts.length}`);

      const runningWorkouts = workouts.filter(w => w.activityType === 'running');
      const walkingWorkouts = workouts.filter(w => w.activityType === 'walking');

      console.log(`[RunningBitcoin] 🏃 Running: ${runningWorkouts.length}, 🚶 Walking: ${walkingWorkouts.length}`);

      // Get eligible participants (Season II + locally joined)
      const localJoins = await this.getLocallyJoinedUsers();
      const eligiblePubkeys = new Set([
        ...SEASON_2_PARTICIPANTS.map(p => p.pubkey),
        ...localJoins,
      ]);
      console.log(`[RunningBitcoin] 👥 Eligible participants: ${eligiblePubkeys.size} (S2: ${SEASON_2_PARTICIPANTS.length}, local: ${localJoins.length})`);

      // Fetch Supabase profiles for non-Season II users (single query)
      const supabaseProfiles = await this.getParticipantProfilesFromSupabase();

      // Aggregate distance per participant (convert npub to pubkey for compatibility)
      const stats = new Map<string, { distance: number; workoutCount: number }>();

      for (const w of [...runningWorkouts, ...walkingWorkouts]) {
        // Convert npub to pubkey for eligibility check
        let pubkey = w.pubkey;
        if (w.npub && !pubkey) {
          try {
            const decoded = nip19.decode(w.npub);
            pubkey = decoded.data as string;
          } catch {
            continue; // Skip invalid npub
          }
        }
        if (!pubkey || !eligiblePubkeys.has(pubkey)) continue;

        const existing = stats.get(pubkey) || { distance: 0, workoutCount: 0 };
        existing.distance += w.distance;
        existing.workoutCount += 1;
        stats.set(pubkey, existing);
      }

      console.log(`[RunningBitcoin] ✅ Aggregated stats for ${stats.size} participants`);

      // Build participant entries with profile data
      const participantEntries: RunningBitcoinParticipant[] = [];
      for (const [pubkey, data] of stats) {
        const season2Profile = SEASON_2_PARTICIPANTS.find(p => p.pubkey === pubkey);
        const isSeason2 = !!season2Profile;

        // For non-Season II users, check Supabase profiles
        let name = season2Profile?.name;
        let picture = season2Profile?.picture;
        let npub = season2Profile?.npub;

        if (!isSeason2) {
          // Try to get npub from pubkey
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
          name: name || `User ${pubkey.slice(0, 8)}`,
          picture,
          totalDistanceKm: data.distance,
          workoutCount: data.workoutCount,
          isFinisher: data.distance >= RUNNING_BITCOIN_CONFIG.goalDistanceKm,
          isSeasonParticipant: isSeason2,
          isLocalJoin: !isSeason2,
        });
      }

      // Sort by distance (descending)
      participantEntries.sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);

      // Assign finisher ranks
      let finisherRank = 1;
      for (const participant of participantEntries) {
        if (participant.isFinisher) {
          participant.finisherRank = finisherRank;
          finisherRank++;
        }
      }

      // Get finishers list
      const finishers = participantEntries.filter(p => p.isFinisher);

      // Calculate totals
      const totalDistanceKm = participantEntries.reduce((sum, p) => sum + p.totalDistanceKm, 0);

      console.log(`[RunningBitcoin] Leaderboard built in ${Date.now() - startTime}ms`);
      console.log(`[RunningBitcoin]   - Active participants: ${participantEntries.length}`);
      console.log(`[RunningBitcoin]   - Finishers: ${finishers.length}`);
      console.log(`[RunningBitcoin]   - Total distance: ${totalDistanceKm.toFixed(2)} km`);

      return {
        participants: participantEntries,
        finishers,
        totalParticipants: eligiblePubkeys.size,
        totalDistanceKm,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      console.error('[RunningBitcoin] Error getting leaderboard:', error);
      return this.emptyLeaderboard();
    }
  }

  /**
   * Get a single user's progress in the challenge
   */
  async getUserProgress(pubkey: string): Promise<RunningBitcoinProgress> {
    const leaderboard = await this.getLeaderboard();
    const userEntry = leaderboard.participants.find(p => p.pubkey === pubkey);

    const distanceKm = userEntry?.totalDistanceKm || 0;
    const isFinisher = distanceKm >= RUNNING_BITCOIN_CONFIG.goalDistanceKm;
    const percentComplete = Math.min(100, (distanceKm / RUNNING_BITCOIN_CONFIG.goalDistanceKm) * 100);

    return {
      distanceKm,
      goalKm: RUNNING_BITCOIN_CONFIG.goalDistanceKm,
      percentComplete,
      isFinisher,
      finisherRank: userEntry?.finisherRank,
      workoutCount: userEntry?.workoutCount || 0,
    };
  }

  /**
   * Get list of finishers (those who completed 21K)
   */
  async getFinishers(): Promise<RunningBitcoinParticipant[]> {
    const leaderboard = await this.getLeaderboard();
    return leaderboard.finishers;
  }

  /**
   * Create empty leaderboard structure
   */
  private emptyLeaderboard(): RunningBitcoinLeaderboard {
    return {
      participants: [],
      finishers: [],
      totalParticipants: 0,
      totalDistanceKm: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Fetch workouts from Supabase for Running Bitcoin date range
   * Queries running + walking workouts that have been validated by anti-cheat
   */
  private async fetchWorkoutsFromSupabase(
    startTs: number,
    endTs: number
  ): Promise<Array<{ npub: string; pubkey: string; distance: number; activityType: string; createdAt: number }>> {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[RunningBitcoin] Supabase not configured');
      return [];
    }

    try {
      const startDate = new Date(startTs * 1000).toISOString();
      const endDate = new Date(endTs * 1000).toISOString();

      // Query running + walking workouts in date range
      const url = `${supabaseUrl}/rest/v1/workout_submissions?` +
        `activity_type=in.(running,walking)&` +
        `created_at=gte.${startDate}&` +
        `created_at=lte.${endDate}&` +
        `select=npub,distance_meters,activity_type,created_at`;

      const response = await fetch(url, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      if (!response.ok) {
        console.error('[RunningBitcoin] Failed to fetch workouts:', response.status);
        return [];
      }

      const data = await response.json();
      console.log(`[RunningBitcoin] Fetched ${data.length} workouts from Supabase`);

      // Transform to internal format
      return data.map((row: {
        npub: string;
        distance_meters: number | null;
        activity_type: string;
        created_at: string;
      }) => {
        // Convert npub to pubkey
        let pubkey = '';
        try {
          const decoded = nip19.decode(row.npub);
          pubkey = decoded.data as string;
        } catch {
          // Keep empty if decode fails
        }

        return {
          npub: row.npub,
          pubkey,
          distance: (row.distance_meters || 0) / 1000, // Convert to km
          activityType: row.activity_type,
          createdAt: new Date(row.created_at).getTime() / 1000,
        };
      });
    } catch (error) {
      console.error('[RunningBitcoin] Error fetching workouts from Supabase:', error);
      return [];
    }
  }

  /**
   * Join the Running Bitcoin Challenge
   * Adds user pubkey to local storage AND registers in Supabase
   */
  async joinChallenge(pubkey: string): Promise<boolean> {
    try {
      // Add to local storage for fast UI updates
      const joinedUsers = await this.getLocallyJoinedUsers();
      if (!joinedUsers.includes(pubkey)) {
        joinedUsers.push(pubkey);
        await AsyncStorage.setItem(JOINED_USERS_KEY, JSON.stringify(joinedUsers));
        console.log(`[RunningBitcoin] User ${pubkey.slice(0, 8)} joined the challenge`);
      }

      // Also register in Supabase (fire-and-forget for UX)
      const npub = nip19.npubEncode(pubkey);
      this.registerInSupabase(npub).catch(err => {
        console.warn('[RunningBitcoin] Failed to register in Supabase (non-blocking):', err);
      });

      return true;
    } catch (error) {
      console.error('[RunningBitcoin] Error joining challenge:', error);
      return false;
    }
  }

  /**
   * Check if user has joined the challenge
   */
  async hasJoined(pubkey: string): Promise<boolean> {
    try {
      // Check if user is a Season II participant (auto-joined)
      const isSeason2 = SEASON_2_PARTICIPANTS.some(p => p.pubkey === pubkey);
      if (isSeason2) return true;

      // Check local join list
      const joinedUsers = await this.getLocallyJoinedUsers();
      return joinedUsers.includes(pubkey);
    } catch (error) {
      console.error('[RunningBitcoin] Error checking join status:', error);
      return false;
    }
  }

  /**
   * Get list of locally joined users (not Season II participants)
   */
  async getLocallyJoinedUsers(): Promise<string[]> {
    try {
      const stored = await AsyncStorage.getItem(JOINED_USERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[RunningBitcoin] Error getting joined users:', error);
      return [];
    }
  }

  /**
   * Leave the challenge (remove local join)
   */
  async leaveChallenge(pubkey: string): Promise<boolean> {
    try {
      const joinedUsers = await this.getLocallyJoinedUsers();
      const filtered = joinedUsers.filter(p => p !== pubkey);
      await AsyncStorage.setItem(JOINED_USERS_KEY, JSON.stringify(filtered));
      console.log(`[RunningBitcoin] User ${pubkey.slice(0, 8)} left the challenge`);
      return true;
    } catch (error) {
      console.error('[RunningBitcoin] Error leaving challenge:', error);
      return false;
    }
  }

  /**
   * Get user's validated total distance from Supabase
   * Only counts running + walking workouts within Running Bitcoin date range
   */
  async getUserTotalFromSupabase(npub: string): Promise<number> {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[RunningBitcoin] Supabase not configured');
      return 0;
    }

    try {
      // Get Running Bitcoin date range
      const startDate = RUNNING_BITCOIN_CONFIG.startDate.toISOString();
      const endDate = RUNNING_BITCOIN_CONFIG.endDate.toISOString();

      // Query workout_submissions for this user's running + walking workouts
      // within the Running Bitcoin date range
      const url = `${supabaseUrl}/rest/v1/workout_submissions?npub=eq.${npub}&created_at=gte.${startDate}&created_at=lte.${endDate}&activity_type=in.(running,walking)&select=distance_meters`;

      const response = await fetch(url, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      if (!response.ok) {
        console.error('[RunningBitcoin] Failed to fetch user total:', response.status);
        return 0;
      }

      const workouts = await response.json();

      // Sum up all distance in km
      const totalKm = workouts.reduce((sum: number, w: { distance_meters: number | null }) => {
        return sum + ((w.distance_meters || 0) / 1000);
      }, 0);

      console.log(`[RunningBitcoin] User ${npub.slice(0, 12)} total from Supabase: ${totalKm.toFixed(2)} km`);
      return totalKm;
    } catch (error) {
      console.error('[RunningBitcoin] Error fetching user total:', error);
      return 0;
    }
  }

  /**
   * Check if user has completed 21km and auto-pay reward
   * Called after each successful workout submission to Supabase
   */
  async checkAndAutoPayReward(npub: string): Promise<{ paid: boolean; error?: string }> {
    console.log('[RunningBitcoin] Checking auto-pay eligibility...');

    try {
      // Get user's pubkey from npub for reward tracking
      let pubkey: string;
      try {
        const decoded = nip19.decode(npub);
        pubkey = decoded.data as string;
      } catch {
        console.error('[RunningBitcoin] Invalid npub format');
        return { paid: false, error: 'Invalid npub format' };
      }

      // Check if already claimed
      const alreadyClaimed = await this.hasClaimedReward(pubkey);
      if (alreadyClaimed) {
        console.log('[RunningBitcoin] Reward already claimed');
        return { paid: false };
      }

      // Get validated total from Supabase
      const totalKm = await this.getUserTotalFromSupabase(npub);

      if (totalKm < RUNNING_BITCOIN_CONFIG.goalDistanceKm) {
        console.log(`[RunningBitcoin] User has ${totalKm.toFixed(2)} km - not yet at ${RUNNING_BITCOIN_CONFIG.goalDistanceKm} km goal`);
        return { paid: false };
      }

      console.log(`[RunningBitcoin] 🎉 User completed ${totalKm.toFixed(2)} km! Initiating auto-pay...`);

      // Get user's Lightning address
      const lnAddress = await RewardLightningAddressService.getRewardLightningAddress();
      if (!lnAddress) {
        console.log('[RunningBitcoin] No Lightning address - cannot auto-pay');
        return { paid: false, error: 'No Lightning address configured' };
      }

      // Request invoice from Lightning address
      let invoice: string;
      try {
        const invoiceResult = await getInvoiceFromLightningAddress(
          lnAddress,
          RUNNING_BITCOIN_CONFIG.finisherRewardSats,
          'Running Bitcoin - 21km Finisher Reward!'
        );
        invoice = invoiceResult.invoice;
        console.log('[RunningBitcoin] Got invoice for auto-pay');
      } catch (invoiceError) {
        console.error('[RunningBitcoin] Failed to get invoice:', invoiceError);
        return { paid: false, error: 'Failed to get invoice from Lightning address' };
      }

      // Pay the invoice
      const payResult = await NWCGatewayService.payInvoice(invoice);

      if (payResult.success) {
        // Mark reward as claimed
        await this.markRewardClaimed(pubkey);
        console.log('[RunningBitcoin] ✅ Auto-paid 1000 sats for completing 21km!');
        return { paid: true };
      } else {
        console.error('[RunningBitcoin] Payment failed:', payResult.error);
        return { paid: false, error: payResult.error || 'Payment failed' };
      }
    } catch (error) {
      console.error('[RunningBitcoin] Auto-pay error:', error);
      return { paid: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Register user in Supabase for Running Bitcoin competition
   * Fetches user's Nostr profile and stores name/picture for leaderboard display
   * Called when joining locally or when Season II participant submits workout
   */
  async registerInSupabase(npub: string): Promise<boolean> {
    try {
      // Decode npub to get pubkey for profile lookup
      let pubkey: string;
      try {
        const decoded = nip19.decode(npub);
        pubkey = decoded.data as string;
      } catch {
        console.warn('[RunningBitcoin] Could not decode npub for profile lookup');
        // Still register without profile data
        const result = await SupabaseCompetitionService.joinCompetition('running-bitcoin', npub);
        return result.success;
      }

      // Fetch user's Nostr profile (kind 0) for name and picture
      let profileData: { name?: string; picture?: string } | undefined;
      try {
        const profiles = await ProfileCache.fetchProfiles([pubkey]);
        const profile = profiles.get(pubkey);
        if (profile) {
          profileData = {
            name: profile.name,
            picture: profile.picture,
          };
          console.log(`[RunningBitcoin] Fetched profile for ${npub.slice(0, 12)}: ${profile.name || 'no name'}`);
        }
      } catch (profileError) {
        console.warn('[RunningBitcoin] Profile fetch failed (non-blocking):', profileError);
        // Continue without profile data
      }

      // Register in Supabase with profile data
      const result = await SupabaseCompetitionService.joinCompetition(
        'running-bitcoin',
        npub,
        profileData
      );

      if (result.success) {
        console.log(`[RunningBitcoin] Registered ${npub.slice(0, 12)} in Supabase${profileData?.name ? ` as ${profileData.name}` : ''}`);
      }
      return result.success;
    } catch (error) {
      console.error('[RunningBitcoin] Failed to register in Supabase:', error);
      return false;
    }
  }

  /**
   * Fetch participant profiles from Supabase
   * Returns a map of npub -> { name, picture } for leaderboard display
   */
  async getParticipantProfilesFromSupabase(): Promise<Map<string, { name?: string; picture?: string }>> {
    const profiles = new Map<string, { name?: string; picture?: string }>();

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return profiles;
    }

    try {
      // Query competition_participants for running-bitcoin, including name and picture
      const url = `${supabaseUrl}/rest/v1/competitions?external_id=eq.running-bitcoin&select=id`;

      const compResponse = await fetch(url, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      if (!compResponse.ok) {
        console.warn('[RunningBitcoin] Failed to fetch competition ID');
        return profiles;
      }

      const competitions = await compResponse.json();
      if (!competitions || competitions.length === 0) {
        return profiles;
      }

      const competitionId = competitions[0].id;

      // Now fetch participants with profiles
      const participantsUrl = `${supabaseUrl}/rest/v1/competition_participants?competition_id=eq.${competitionId}&select=npub,name,picture`;

      const participantsResponse = await fetch(participantsUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      if (!participantsResponse.ok) {
        console.warn('[RunningBitcoin] Failed to fetch participant profiles');
        return profiles;
      }

      const participants = await participantsResponse.json();

      for (const p of participants) {
        if (p.npub && (p.name || p.picture)) {
          profiles.set(p.npub, { name: p.name, picture: p.picture });
        }
      }

      console.log(`[RunningBitcoin] Fetched ${profiles.size} participant profiles from Supabase`);
      return profiles;
    } catch (error) {
      console.warn('[RunningBitcoin] Error fetching participant profiles:', error);
      return profiles;
    }
  }

  /**
   * Get all Season II participant pubkeys
   */
  getParticipantPubkeys(): string[] {
    return SEASON_2_PARTICIPANTS.map(p => p.pubkey);
  }

  /**
   * Build leaderboard from workout array (used by hook for fresh data)
   * Filters for Running Bitcoin date range + running/walking activities
   */
  async buildLeaderboardFromWorkouts(
    workouts: CachedWorkout[],
    _currentUserPubkey?: string
  ): Promise<RunningBitcoinLeaderboard> {
    console.log(`[RunningBitcoin] Building leaderboard from ${workouts.length} workouts`);

    // Get Running Bitcoin date range timestamps
    const startTs = getRunningBitcoinStartTimestamp();
    const endTs = getRunningBitcoinEndTimestamp();

    // Get eligible participants (Season II + locally joined)
    const localJoins = await this.getLocallyJoinedUsers();
    const eligiblePubkeys = new Set([
      ...SEASON_2_PARTICIPANTS.map(p => p.pubkey),
      ...localJoins,
    ]);

    // Fetch Supabase profiles for non-Season II users (single query)
    const supabaseProfiles = await this.getParticipantProfilesFromSupabase();

    // Filter workouts for Running Bitcoin date range and eligible activities
    const eligibleWorkouts = workouts.filter(w => {
      const activityLower = w.activityType?.toLowerCase() || '';
      const isEligibleActivity = activityLower === 'running' || activityLower === 'walking';
      const isInDateRange = w.createdAt >= startTs && w.createdAt <= endTs;
      const isEligibleParticipant = eligiblePubkeys.has(w.pubkey);
      return isEligibleActivity && isInDateRange && isEligibleParticipant;
    });

    console.log(`[RunningBitcoin] Eligible workouts: ${eligibleWorkouts.length}`);

    // Aggregate distance per participant
    const stats = new Map<string, { distance: number; workoutCount: number }>();
    for (const w of eligibleWorkouts) {
      const existing = stats.get(w.pubkey) || { distance: 0, workoutCount: 0 };
      existing.distance += w.distance;
      existing.workoutCount += 1;
      stats.set(w.pubkey, existing);
    }

    // Build participant entries with profile data
    const participantEntries: RunningBitcoinParticipant[] = [];
    for (const [pubkey, data] of stats) {
      const season2Profile = SEASON_2_PARTICIPANTS.find(p => p.pubkey === pubkey);
      const isSeason2 = !!season2Profile;

      // For non-Season II users, check Supabase profiles
      let name = season2Profile?.name;
      let picture = season2Profile?.picture;
      let npub = season2Profile?.npub;

      if (!isSeason2) {
        // Try to get npub from pubkey
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
        name: name || `User ${pubkey.slice(0, 8)}`,
        picture,
        totalDistanceKm: data.distance,
        workoutCount: data.workoutCount,
        isFinisher: data.distance >= RUNNING_BITCOIN_CONFIG.goalDistanceKm,
        isSeasonParticipant: isSeason2,
        isLocalJoin: !isSeason2,
      });
    }

    // Sort by distance (descending)
    participantEntries.sort((a, b) => b.totalDistanceKm - a.totalDistanceKm);

    // Assign finisher ranks
    let finisherRank = 1;
    for (const participant of participantEntries) {
      if (participant.isFinisher) {
        participant.finisherRank = finisherRank;
        finisherRank++;
      }
    }

    // Get finishers list
    const finishers = participantEntries.filter(p => p.isFinisher);

    // Calculate totals
    const totalDistanceKm = participantEntries.reduce((sum, p) => sum + p.totalDistanceKm, 0);

    console.log(`[RunningBitcoin] Built leaderboard: ${participantEntries.length} participants, ${finishers.length} finishers`);

    return {
      participants: participantEntries,
      finishers,
      totalParticipants: eligiblePubkeys.size,
      totalDistanceKm,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Share completion to Nostr and claim finisher reward
   * Posts a kind 1 event with completion message and triggers auto-pay
   */
  async shareCompletionAndClaimReward(pubkey: string): Promise<ShareCompletionResult> {
    console.log('[RunningBitcoin] Starting share completion and claim reward...');

    try {
      // Step 1: Verify user is a finisher
      const progress = await this.getUserProgress(pubkey);
      if (!progress.isFinisher) {
        return {
          success: false,
          error: 'You have not completed 21km yet',
          rewardPaid: false,
        };
      }

      // Step 2: Check if reward already claimed
      const alreadyClaimed = await this.hasClaimedReward(pubkey);
      if (alreadyClaimed) {
        return {
          success: false,
          error: 'Reward already claimed',
          rewardPaid: false,
        };
      }

      // Step 3: Post completion to Nostr (kind 1 event)
      let postEventId: string | undefined;
      try {
        postEventId = await this.postCompletionToNostr(pubkey, progress);
        console.log('[RunningBitcoin] Posted completion to Nostr:', postEventId);
      } catch (postError) {
        console.error('[RunningBitcoin] Failed to post to Nostr:', postError);
        // Continue even if post fails - user can still get reward
      }

      // Step 4: Get user's Lightning address
      const lnAddress = await RewardLightningAddressService.getRewardLightningAddress();
      if (!lnAddress) {
        return {
          success: true,
          postEventId,
          rewardPaid: false,
          rewardError: 'No Lightning address configured',
        };
      }

      // Step 5: Request invoice from Lightning address
      let invoice: string;
      try {
        const invoiceResult = await getInvoiceFromLightningAddress(
          lnAddress,
          RUNNING_BITCOIN_CONFIG.finisherRewardSats,
          'Running Bitcoin Challenge - Finisher Reward'
        );
        invoice = invoiceResult.invoice;
        console.log('[RunningBitcoin] Got invoice for reward');
      } catch (invoiceError) {
        console.error('[RunningBitcoin] Failed to get invoice:', invoiceError);
        return {
          success: true,
          postEventId,
          rewardPaid: false,
          rewardError: 'Failed to get invoice from Lightning address',
        };
      }

      // Step 6: Pay the invoice
      try {
        const payResult = await NWCGatewayService.payInvoice(invoice);
        if (payResult.success) {
          // Mark reward as claimed
          await this.markRewardClaimed(pubkey);
          console.log('[RunningBitcoin] ✅ Reward paid successfully!');
          return {
            success: true,
            postEventId,
            rewardPaid: true,
          };
        } else {
          console.error('[RunningBitcoin] Payment failed:', payResult.error);
          return {
            success: true,
            postEventId,
            rewardPaid: false,
            rewardError: payResult.error || 'Payment failed',
          };
        }
      } catch (payError) {
        console.error('[RunningBitcoin] Payment error:', payError);
        return {
          success: true,
          postEventId,
          rewardPaid: false,
          rewardError: 'Payment error occurred',
        };
      }
    } catch (error) {
      console.error('[RunningBitcoin] Share completion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        rewardPaid: false,
      };
    }
  }

  /**
   * Post completion message to Nostr as kind 1 event
   */
  private async postCompletionToNostr(_pubkey: string, progress: RunningBitcoinProgress): Promise<string> {
    const ndk = await GlobalNDKService.getInstance();

    // Get user's nsec from storage for signing
    const nsec = await AsyncStorage.getItem('@runstr:user_nsec');
    if (!nsec) {
      throw new Error('No nsec found - cannot sign event');
    }

    // Create the completion post content
    const content = `I completed the Running Bitcoin Challenge! 🏃‍♂️⚡

${progress.distanceKm.toFixed(1)}km in honor of Hal Finney - the first person to receive a Bitcoin transaction.

${progress.finisherRank ? `Finisher #${progress.finisherRank}` : ''}

#RunningBitcoin #RUNSTR #Bitcoin #HalFinney`;

    // Create kind 1 event
    const event = new NDKEvent(ndk);
    event.kind = 1;
    event.content = content;
    event.tags = [
      ['t', 'RunningBitcoin'],
      ['t', 'RUNSTR'],
      ['t', 'Bitcoin'],
      ['t', 'HalFinney'],
    ];

    // Sign and publish
    await event.sign();
    await event.publish();

    return event.id || 'published';
  }

  /**
   * Check if user has already claimed their reward
   */
  async hasClaimedReward(pubkey: string): Promise<boolean> {
    try {
      const claimed = await AsyncStorage.getItem(REWARDS_CLAIMED_KEY);
      const claimedList = claimed ? JSON.parse(claimed) : [];
      return claimedList.includes(pubkey);
    } catch (error) {
      console.error('[RunningBitcoin] Error checking claimed status:', error);
      return false;
    }
  }

  /**
   * Mark reward as claimed for user
   */
  private async markRewardClaimed(pubkey: string): Promise<void> {
    try {
      const claimed = await AsyncStorage.getItem(REWARDS_CLAIMED_KEY);
      const claimedList = claimed ? JSON.parse(claimed) : [];
      if (!claimedList.includes(pubkey)) {
        claimedList.push(pubkey);
        await AsyncStorage.setItem(REWARDS_CLAIMED_KEY, JSON.stringify(claimedList));
        console.log('[RunningBitcoin] Marked reward as claimed for:', pubkey.slice(0, 8));
      }
    } catch (error) {
      console.error('[RunningBitcoin] Error marking reward claimed:', error);
    }
  }
}

// Export singleton instance
export const RunningBitcoinService = RunningBitcoinServiceClass.getInstance();
