/**
 * Supabase Competition Service
 *
 * Handles all competition-related backend operations:
 * - Join/leave competitions (participant management)
 * - Submit workouts for competition tracking (workout verification)
 * - Fetch leaderboards (pre-computed from database)
 *
 * Privacy-preserving: Only stores data when users explicitly opt-in
 * by clicking "Join" on a competition or "Compete" on a workout.
 */

import {
  supabase,
  isSupabaseConfigured,
  Competition,
  WorkoutSubmission,
  LeaderboardEntry,
  CharityRanking,
} from '../../utils/supabase';
import { getCharityById } from '../../constants/charities';

// Nostr event type for kind 1301 workouts
interface NostrEvent {
  id: string;
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  pubkey: string;
  sig: string;
}

// Simplified workout data for submission (matches PublishableWorkout structure)
interface WorkoutSubmissionData {
  eventId: string; // Nostr event ID after publishing
  npub: string;
  type: string; // running, walking, cycling, etc.
  distance?: number; // in meters
  duration: number; // in seconds
  calories?: number;
  startTime: string; // ISO timestamp
}

export class SupabaseCompetitionService {
  /**
   * Join a competition - adds user's npub to participant list
   *
   * @param competitionId - The competition UUID or external_id
   * @param npub - User's Nostr public key (npub format)
   * @returns Success status
   */
  static async joinCompetition(
    competitionId: string,
    npub: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) {
      console.warn('[SupabaseCompetitionService] Supabase not configured');
      return { success: false, error: 'Backend not configured' };
    }

    try {
      // First, resolve competition ID (could be UUID or external_id)
      const resolvedId = await this.resolveCompetitionId(competitionId);
      if (!resolvedId) {
        return { success: false, error: 'Competition not found' };
      }

      const { error } = await supabase!
        .from('competition_participants')
        .upsert(
          { competition_id: resolvedId, npub },
          { onConflict: 'competition_id,npub' }
        );

      if (error) {
        console.error('[SupabaseCompetitionService] Join error:', error);
        return { success: false, error: error.message };
      }

      console.log(
        `[SupabaseCompetitionService] Joined competition: ${competitionId}`
      );
      return { success: true };
    } catch (err) {
      console.error('[SupabaseCompetitionService] Join exception:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Leave a competition - removes user's npub from participant list
   *
   * @param competitionId - The competition UUID or external_id
   * @param npub - User's Nostr public key
   * @returns Success status
   */
  static async leaveCompetition(
    competitionId: string,
    npub: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Backend not configured' };
    }

    try {
      const resolvedId = await this.resolveCompetitionId(competitionId);
      if (!resolvedId) {
        return { success: false, error: 'Competition not found' };
      }

      const { error } = await supabase!
        .from('competition_participants')
        .delete()
        .match({ competition_id: resolvedId, npub });

      if (error) {
        console.error('[SupabaseCompetitionService] Leave error:', error);
        return { success: false, error: error.message };
      }

      console.log(
        `[SupabaseCompetitionService] Left competition: ${competitionId}`
      );
      return { success: true };
    } catch (err) {
      console.error('[SupabaseCompetitionService] Leave exception:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a user is participating in a competition
   *
   * @param competitionId - The competition UUID or external_id
   * @param npub - User's Nostr public key
   * @returns Whether the user is a participant
   */
  static async isParticipant(
    competitionId: string,
    npub: string
  ): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return false;
    }

    try {
      const resolvedId = await this.resolveCompetitionId(competitionId);
      if (!resolvedId) {
        return false;
      }

      const { data, error } = await supabase!
        .from('competition_participants')
        .select('id')
        .match({ competition_id: resolvedId, npub })
        .single();

      return !error && !!data;
    } catch {
      return false;
    }
  }

  /**
   * Submit a workout for competition tracking (from PublishableWorkout + eventId)
   *
   * This is the PRIMARY method - called when user clicks "Compete" button
   * after the workout has been published to Nostr.
   *
   * Now routes through Supabase Edge Function for server-side anti-cheat validation.
   * Valid workouts → workout_submissions table
   * Invalid workouts → flagged_workouts table (for admin review)
   *
   * @param data - Workout submission data (eventId, npub, type, distance, duration, etc.)
   * @returns Success status with optional flagged indicator
   */
  static async submitWorkoutSimple(
    data: WorkoutSubmissionData
  ): Promise<{ success: boolean; error?: string; flagged?: boolean }> {
    if (!isSupabaseConfigured()) {
      console.warn('[SupabaseCompetitionService] Supabase not configured, skipping submission');
      return { success: false, error: 'Backend not configured' };
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[SupabaseCompetitionService] Missing Supabase environment variables');
      return { success: false, error: 'Backend not configured' };
    }

    try {
      // Call Edge Function for server-side validation
      const response = await fetch(
        `${supabaseUrl}/functions/v1/submit-workout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            event_id: data.eventId,
            npub: data.npub,
            activity_type: data.type,
            distance_meters: data.distance || null,
            duration_seconds: data.duration,
            calories: data.calories || null,
            created_at: data.startTime,
            raw_event: {
              event_id: data.eventId,
              type: data.type,
              distance: data.distance,
              duration: data.duration,
              calories: data.calories,
              submitted_via: 'runstr_app',
              submitted_at: new Date().toISOString(),
            },
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        if (result.duplicate) {
          console.log(
            `[SupabaseCompetitionService] ℹ️ Workout already submitted: ${data.eventId}`
          );
        } else {
          console.log(
            `[SupabaseCompetitionService] ✅ Submitted workout to competition backend: ${data.eventId}`
          );
        }
        return { success: true };
      } else {
        // Workout was flagged by anti-cheat
        if (result.flagged) {
          console.warn(
            `[SupabaseCompetitionService] 🚫 Workout flagged: ${data.eventId} - ${result.reason}`
          );
          return { success: false, error: result.reason, flagged: true };
        }

        // Other error (e.g., previously flagged submission)
        console.error(
          `[SupabaseCompetitionService] Submit workout error: ${result.error || result.reason || result.message}`
        );
        return { success: false, error: result.error || result.reason || result.message };
      }
    } catch (err) {
      console.error('[SupabaseCompetitionService] Submit workout exception:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Submit a workout for competition tracking (from raw Nostr event)
   *
   * Alternative method for when you have the full signed Nostr event.
   *
   * @param npub - User's Nostr public key
   * @param event - The signed kind 1301 Nostr event
   * @returns Success status
   */
  static async submitWorkout(
    npub: string,
    event: NostrEvent
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Backend not configured' };
    }

    // Validate event
    if (event.kind !== 1301) {
      return { success: false, error: 'Invalid event kind (must be 1301)' };
    }

    try {
      // Parse workout data from event tags
      const workoutData = this.parseWorkoutEvent(event);

      const { error } = await supabase!.from('workout_submissions').upsert(
        {
          npub,
          event_id: event.id,
          activity_type: workoutData.activityType,
          distance_meters: workoutData.distanceMeters,
          duration_seconds: workoutData.durationSeconds,
          calories: workoutData.calories,
          created_at: new Date(event.created_at * 1000).toISOString(),
          raw_event: event,
        },
        { onConflict: 'event_id' }
      );

      if (error) {
        console.error('[SupabaseCompetitionService] Submit workout error:', error);
        return { success: false, error: error.message };
      }

      console.log(
        `[SupabaseCompetitionService] Submitted workout: ${event.id}`
      );
      return { success: true };
    } catch (err) {
      console.error('[SupabaseCompetitionService] Submit workout exception:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Get the leaderboard for a competition
   *
   * Fetches pre-computed leaderboard from database.
   * Only includes workouts from users who have joined AND submitted via app.
   *
   * @param competitionId - The competition UUID or external_id
   * @param limit - Maximum number of entries to return (default 100)
   * @returns Leaderboard entries sorted by rank, plus charity rankings
   */
  static async getLeaderboard(
    competitionId: string,
    limit: number = 100
  ): Promise<{
    leaderboard: LeaderboardEntry[];
    charityRankings: CharityRanking[];
    competition?: Competition;
    error?: string;
  }> {
    if (!isSupabaseConfigured()) {
      return { leaderboard: [], charityRankings: [], error: 'Backend not configured' };
    }

    try {
      const resolvedId = await this.resolveCompetitionId(competitionId);
      if (!resolvedId) {
        return { leaderboard: [], charityRankings: [], error: 'Competition not found' };
      }

      // Get competition details
      const { data: competition, error: compError } = await supabase!
        .from('competitions')
        .select('*')
        .eq('id', resolvedId)
        .single();

      if (compError || !competition) {
        return { leaderboard: [], charityRankings: [], error: 'Competition not found' };
      }

      // Get participants
      const { data: participants } = await supabase!
        .from('competition_participants')
        .select('npub')
        .eq('competition_id', resolvedId);

      const npubs = participants?.map((p) => p.npub) || [];

      if (npubs.length === 0) {
        return { leaderboard: [], charityRankings: [], competition };
      }

      // Get workouts for participants within date range
      const { data: workouts } = await supabase!
        .from('workout_submissions')
        .select('*')
        .in('npub', npubs)
        .eq('activity_type', competition.activity_type)
        .gte('created_at', competition.start_date)
        .lte('created_at', competition.end_date)
        .order('created_at', { ascending: false }); // Most recent first

      // Aggregate scores and track charity per user
      const scores = new Map<string, {
        score: number;
        workoutCount: number;
        charityId?: string;
        charityName?: string;
        latestWorkoutTime?: string;
      }>();
      npubs.forEach((npub) => scores.set(npub, { score: 0, workoutCount: 0 }));

      // Track charity totals
      const charityTotals = new Map<string, { totalDistance: number; participants: Set<string> }>();

      workouts?.forEach((w: WorkoutSubmission) => {
        const current = scores.get(w.npub) || { score: 0, workoutCount: 0 };
        let scoreIncrement = 0;

        // For baseline rows, workout count is stored in raw_event.workout_count
        // For new individual workout rows, default to 1
        const rawEvent = w.raw_event as Record<string, unknown> | null;
        const rowWorkoutCount = (rawEvent?.workout_count as number) || 1;

        // Extract charity from raw_event.tags
        const charityData = this.extractCharityFromRawEvent(rawEvent);

        switch (competition.scoring_method) {
          case 'total_distance':
            scoreIncrement = w.distance_meters || 0;
            break;
          case 'total_duration':
            scoreIncrement = w.duration_seconds || 0;
            break;
          case 'workout_count':
            scoreIncrement = rowWorkoutCount;
            break;
        }

        // Track the most recent charity for this user (workouts are ordered desc)
        const existingCharity = current.charityId;
        const isNewerWorkout = !current.latestWorkoutTime || w.created_at > current.latestWorkoutTime;

        scores.set(w.npub, {
          score: current.score + scoreIncrement,
          workoutCount: current.workoutCount + rowWorkoutCount,
          charityId: isNewerWorkout && charityData.charityId ? charityData.charityId : existingCharity,
          charityName: isNewerWorkout && charityData.charityName ? charityData.charityName : current.charityName,
          latestWorkoutTime: isNewerWorkout ? w.created_at : current.latestWorkoutTime,
        });

        // Aggregate charity totals (only count distance-based activities)
        if (charityData.charityId && w.distance_meters) {
          const charityStats = charityTotals.get(charityData.charityId) || {
            totalDistance: 0,
            participants: new Set<string>(),
          };
          charityStats.totalDistance += w.distance_meters;
          charityStats.participants.add(w.npub);
          charityTotals.set(charityData.charityId, charityStats);
        }
      });

      // Sort and rank leaderboard
      const leaderboard: LeaderboardEntry[] = Array.from(scores.entries())
        .map(([npub, data]) => ({
          npub,
          score: data.score,
          workout_count: data.workoutCount,
          rank: 0,
          charityId: data.charityId,
          charityName: data.charityName,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      // Build charity rankings sorted by total distance
      const charityRankings: CharityRanking[] = Array.from(charityTotals.entries())
        .map(([charityId, stats]) => {
          const charity = getCharityById(charityId);
          return {
            rank: 0,
            charityId,
            charityName: charity?.name || charityId,
            lightningAddress: charity?.lightningAddress,
            totalDistance: stats.totalDistance,
            participantCount: stats.participants.size,
          };
        })
        .sort((a, b) => b.totalDistance - a.totalDistance)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      return { leaderboard, charityRankings, competition };
    } catch (err) {
      console.error('[SupabaseCompetitionService] Get leaderboard exception:', err);
      return {
        leaderboard: [],
        charityRankings: [],
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Extract charity from raw_event tags
   * Looks for ['team', charityId] or ['charity', charityId, name, address] tags
   * ONLY returns charity data if it matches a known charity from our list
   */
  private static extractCharityFromRawEvent(rawEvent: Record<string, unknown> | null): {
    charityId?: string;
    charityName?: string;
  } {
    if (!rawEvent) return {};

    const tags = rawEvent.tags as string[][] | undefined;
    if (!tags || !Array.isArray(tags)) return {};

    // Look for 'team' tag first (primary)
    const teamTag = tags.find((t) => t[0] === 'team');
    if (teamTag && teamTag[1]) {
      const charity = getCharityById(teamTag[1]);
      // Only return if it's a known charity (not a random team UUID)
      if (charity) {
        return {
          charityId: teamTag[1],
          charityName: charity.name,
        };
      }
    }

    // Fall back to 'charity' tag
    const charityTag = tags.find((t) => t[0] === 'charity');
    if (charityTag && charityTag[1]) {
      const charity = getCharityById(charityTag[1]);
      // Only return if it's a known charity
      if (charity) {
        return {
          charityId: charityTag[1],
          charityName: charity.name,
        };
      }
      // If charity tag has a name in position 2 and it's not a UUID, use it
      if (charityTag[2] && !charityTag[2].includes('-')) {
        return {
          charityId: charityTag[1],
          charityName: charityTag[2],
        };
      }
    }

    return {};
  }

  /**
   * Get all competitions (active and upcoming)
   *
   * @returns List of competitions
   */
  static async getCompetitions(): Promise<Competition[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      const { data, error } = await supabase!
        .from('competitions')
        .select('*')
        .gte('end_date', new Date().toISOString())
        .order('start_date', { ascending: true });

      if (error) {
        console.error('[SupabaseCompetitionService] Get competitions error:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('[SupabaseCompetitionService] Get competitions exception:', err);
      return [];
    }
  }

  /**
   * Get participant count for a competition
   *
   * @param competitionId - The competition UUID or external_id
   * @returns Number of participants
   */
  static async getParticipantCount(competitionId: string): Promise<number> {
    if (!isSupabaseConfigured()) {
      return 0;
    }

    try {
      const resolvedId = await this.resolveCompetitionId(competitionId);
      if (!resolvedId) {
        return 0;
      }

      const { count, error } = await supabase!
        .from('competition_participants')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', resolvedId);

      if (error) {
        console.error('[SupabaseCompetitionService] Get count error:', error);
        return 0;
      }

      return count || 0;
    } catch {
      return 0;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Resolve a competition ID (could be UUID or external_id) to UUID
   */
  private static async resolveCompetitionId(
    idOrExternalId: string
  ): Promise<string | null> {
    // If it looks like a UUID, use it directly
    if (this.isUUID(idOrExternalId)) {
      return idOrExternalId;
    }

    // Otherwise, look up by external_id
    try {
      const { data, error } = await supabase!
        .from('competitions')
        .select('id')
        .eq('external_id', idOrExternalId)
        .single();

      if (error || !data) {
        return null;
      }

      return data.id;
    } catch {
      return null;
    }
  }

  /**
   * Check if a string is a valid UUID
   */
  private static isUUID(str: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * Parse a kind 1301 workout event into structured data
   */
  private static parseWorkoutEvent(event: NostrEvent): {
    activityType: string;
    distanceMeters: number | null;
    durationSeconds: number | null;
    calories: number | null;
  } {
    const tags = event.tags || [];
    const getTag = (name: string): string | undefined =>
      tags.find((t) => t[0] === name)?.[1];

    // Activity type
    const activityType = getTag('exercise') || 'other';

    // Distance - handle unit conversion
    const distanceTag = tags.find((t) => t[0] === 'distance');
    let distanceMeters: number | null = null;
    if (distanceTag) {
      const value = parseFloat(distanceTag[1]);
      const unit = distanceTag[2]?.toLowerCase();
      if (!isNaN(value)) {
        switch (unit) {
          case 'km':
            distanceMeters = value * 1000;
            break;
          case 'mi':
            distanceMeters = value * 1609.34;
            break;
          case 'm':
          default:
            distanceMeters = value;
            break;
        }
      }
    }

    // Duration - parse HH:MM:SS format
    const durationStr = getTag('duration');
    let durationSeconds: number | null = null;
    if (durationStr) {
      const parts = durationStr.split(':').map(Number);
      if (parts.length === 3) {
        durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        durationSeconds = parts[0] * 60 + parts[1];
      }
    }

    // Calories
    const caloriesStr = getTag('calories');
    const calories = caloriesStr ? parseInt(caloriesStr, 10) || null : null;

    return {
      activityType,
      distanceMeters,
      durationSeconds,
      calories,
    };
  }
}

export default SupabaseCompetitionService;
