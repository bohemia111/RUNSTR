/**
 * Simple Leaderboard Service - MVP Implementation
 * Calculates competition rankings from kind 1301 workout events
 * ✅ UPDATED: Now with 5-minute caching via CompetitionCacheService for 80% fewer queries
 */

import { GlobalNDKService } from '../nostr/GlobalNDKService';
import { CompetitionCacheService } from '../cache/CompetitionCacheService';
import { EventJoinRequestService } from '../events/EventJoinRequestService';
import type { NDKFilter, NDKEvent } from '@nostr-dev-kit/ndk';
import type { League, CompetitionEvent } from './SimpleCompetitionService';

export interface LeaderboardEntry {
  rank: number;
  npub: string;
  name: string;
  score: number;
  formattedScore: string;
  workoutCount: number;
  participationType?: 'in-person' | 'virtual'; // ✅ NEW: Track how user is participating
}

export interface Workout {
  id: string;
  npub: string;
  activityType: string;
  distance: number; // in km
  duration: number; // in seconds
  calories?: number;
  timestamp: number; // Unix timestamp
  splits?: Map<number, number>; // km -> elapsed time in seconds (e.g., km 5 -> 1440s)
  splitPaces?: Map<number, number>; // km -> pace in seconds per km
}

export class SimpleLeaderboardService {
  private static instance: SimpleLeaderboardService;
  private cacheService: CompetitionCacheService;

  private constructor() {
    this.cacheService = CompetitionCacheService.getInstance();
  }

  static getInstance(): SimpleLeaderboardService {
    if (!SimpleLeaderboardService.instance) {
      SimpleLeaderboardService.instance = new SimpleLeaderboardService();
    }
    return SimpleLeaderboardService.instance;
  }

  /**
   * Calculate league leaderboard
   */
  async calculateLeagueLeaderboard(
    league: League,
    teamMembers: string[]
  ): Promise<LeaderboardEntry[]> {
    console.log(`🏆 Calculating leaderboard for league: ${league.name}`);
    console.log(`   Team members: ${teamMembers.length}`);

    // Get workouts for all team members
    const workouts = await this.getWorkouts(
      teamMembers,
      league.activityType,
      new Date(league.startDate),
      new Date(league.endDate)
    );

    console.log(`   Found ${workouts.length} workouts`);

    // Calculate scores by member
    const scoresByMember = this.calculateScores(workouts, league.metric);

    // CRITICAL FIX: Create entries for ALL team members, even those with 0 workouts
    const entries: LeaderboardEntry[] = teamMembers.map((npub) => {
      const memberData = scoresByMember.get(npub);

      if (memberData) {
        // Member has workouts - use their actual scores
        return {
          rank: 0, // Will be set after sorting
          npub,
          name: npub.slice(0, 8) + '...',
          score: memberData.score,
          formattedScore: this.formatScore(memberData.score, league.metric),
          workoutCount: memberData.workoutCount,
        };
      } else {
        // Member has NO workouts - show them with 0 score
        return {
          rank: 0, // Will be set after sorting
          npub,
          name: npub.slice(0, 8) + '...',
          score: 0,
          formattedScore: this.formatScore(0, league.metric),
          workoutCount: 0,
        };
      }
    });

    // Sort by score (descending)
    entries.sort((a, b) => b.score - a.score);

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    console.log(
      `✅ Leaderboard calculated: ${entries.length} entries (${teamMembers.length} team members)`
    );
    return entries;
  }

  /**
   * Calculate event leaderboard
   * ✅ UPDATED: Support new scoringType (completion vs fastest_time)
   */
  async calculateEventLeaderboard(
    event: CompetitionEvent,
    teamMembers: string[]
  ): Promise<LeaderboardEntry[]> {
    console.log(`🏆 Calculating leaderboard for event: ${event.name}`);
    console.log(`   Scoring type: ${event.scoringType || event.metric}`);

    // ✅ NEW: Fetch join requests to get participation types
    const participationTypeMap = new Map<string, 'in-person' | 'virtual'>();
    try {
      const joinRequestService = EventJoinRequestService.getInstance();
      const joinRequests = await joinRequestService.getEventJoinRequestsByEventIds([event.id]);
      const eventRequests = joinRequests.get(event.id) || [];

      // Map hex pubkey -> npub for participation type lookup
      const { nip19 } = await import('nostr-tools');
      for (const request of eventRequests) {
        if (request.participationType) {
          try {
            const npub = nip19.npubEncode(request.requesterId);
            participationTypeMap.set(npub, request.participationType);
          } catch (error) {
            console.warn(`Failed to encode npub for ${request.requesterId}:`, error);
          }
        }
      }
      console.log(`   Loaded ${participationTypeMap.size} participation type preferences`);
    } catch (error) {
      console.warn('Failed to fetch participation types (non-critical):', error);
    }

    const eventDate = new Date(event.eventDate);
    const eventStart = new Date(eventDate);
    eventStart.setHours(0, 0, 0, 0);
    const eventEnd = new Date(eventDate);
    eventEnd.setHours(23, 59, 59, 999);

    // Get workouts for event day
    const workouts = await this.getWorkouts(
      teamMembers,
      event.activityType,
      eventStart,
      eventEnd
    );

    console.log(`   Found ${workouts.length} workouts on event day`);

    // Filter workouts by target distance if specified
    let relevantWorkouts = workouts;
    if (event.targetDistance) {
      const minDistance = event.targetDistance * 0.95; // Allow 5% margin
      relevantWorkouts = workouts.filter((w) => w.distance >= minDistance);
      console.log(
        `   ${relevantWorkouts.length} workouts meet distance requirement`
      );

      // Use split data to extract time at target distance for accurate scoring
      // This ensures runners who go beyond target aren't penalized
      relevantWorkouts = relevantWorkouts.map((workout) => {
        const targetTime = this.extractTargetDistanceTime(
          workout,
          event.targetDistance!
        );

        // Log split data usage for transparency
        if (workout.splits && workout.splits.size > 0 && targetTime !== workout.duration) {
          console.log(
            `   ✅ Using split data for ${workout.npub.slice(0, 8)}: ${targetTime}s (was ${workout.duration}s)`
          );
        }

        // Return adjusted workout with target distance time
        return {
          ...workout,
          duration: targetTime, // Override with split-based time
        };
      });
    }

    // ✅ FIX: Use scoringType instead of metric
    const scoringType = event.scoringType || event.metric;
    const scoresByMember = this.calculateScores(relevantWorkouts, scoringType);

    // CRITICAL FIX: Create entries for ALL team members, even those with 0 workouts
    const entries: LeaderboardEntry[] = teamMembers.map((npub) => {
      const memberData = scoresByMember.get(npub);
      const participationType = participationTypeMap.get(npub); // ✅ NEW: Get participation type

      if (memberData) {
        // Member has workouts - use their actual scores
        return {
          rank: 0,
          npub,
          name: npub.slice(0, 8) + '...',
          score: memberData.score,
          formattedScore: this.formatScore(memberData.score, scoringType),
          workoutCount: memberData.workoutCount,
          participationType, // ✅ NEW: Include participation type
        };
      } else {
        // Member has NO workouts - show them with 0 score
        return {
          rank: 0,
          npub,
          name: npub.slice(0, 8) + '...',
          score: 0,
          formattedScore: this.formatScore(0, scoringType),
          workoutCount: 0,
          participationType, // ✅ NEW: Include participation type
        };
      }
    });

    // Sort and rank based on scoring type
    entries.sort((a, b) => {
      // ✅ NEW: For completion events, everyone who completed ranks equally (or by earliest submission)
      if (scoringType === 'completion') {
        // Completed (score > 0) ranks above not completed (score === 0)
        if (a.score > 0 && b.score === 0) return -1;
        if (a.score === 0 && b.score > 0) return 1;
        // Both completed or both not completed - maintain order (stable sort)
        return 0;
      }

      // For time-based metrics (fastest_time), lower is better
      if (scoringType === 'fastest_time' || event.metric === 'fastest_time') {
        // Move zero scores (didn't complete) to bottom
        if (a.score === 0 && b.score > 0) return 1;
        if (a.score > 0 && b.score === 0) return -1;
        return a.score - b.score;
      }

      // For all other metrics, higher is better
      return b.score - a.score;
    });

    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    console.log(
      `✅ Event leaderboard calculated: ${entries.length} entries (${teamMembers.length} team members)`
    );
    return entries;
  }

  /**
   * Calculate team goal progress (for team-total scoring mode)
   * Returns combined team total and percentage of goal
   */
  async calculateTeamGoalProgress(
    event: CompetitionEvent,
    teamMembers: string[]
  ): Promise<{
    current: number;
    goal: number;
    percentage: number;
    formattedCurrent: string;
    formattedGoal: string;
    unit: string;
  }> {
    console.log(`🎯 Calculating team goal progress for: ${event.name}`);
    console.log(`   Team goal: ${event.teamGoal} ${event.targetUnit || 'km'}`);

    const eventDate = new Date(event.eventDate);
    let eventStart: Date;
    let eventEnd: Date;

    // Handle short duration events
    if (event.durationMinutes) {
      eventStart = eventDate;
      eventEnd = new Date(eventDate.getTime() + event.durationMinutes * 60 * 1000);
    } else {
      // Full day event
      eventStart = new Date(eventDate);
      eventStart.setHours(0, 0, 0, 0);
      eventEnd = new Date(eventDate);
      eventEnd.setHours(23, 59, 59, 999);
    }

    // Get workouts for event period
    const workouts = await this.getWorkouts(
      teamMembers,
      event.activityType,
      eventStart,
      eventEnd
    );

    console.log(`   Found ${workouts.length} workouts`);

    // Calculate total based on metric type
    let total = 0;
    const metric = event.scoringType || event.metric;

    for (const workout of workouts) {
      switch (metric) {
        case 'total_distance':
        case 'fastest_time': // For races, sum all distances
          total += workout.distance;
          break;
        case 'total_duration':
          total += workout.duration;
          break;
        case 'total_calories':
          total += workout.calories || 0;
          break;
        case 'most_workouts':
          total += 1;
          break;
        default:
          total += workout.distance; // Default to distance
      }
    }

    const goal = event.teamGoal || 0;
    const percentage = goal > 0 ? (total / goal) * 100 : 0;
    const unit = event.targetUnit || 'km';

    // Format numbers based on metric
    const formattedCurrent = this.formatTeamGoalValue(total, metric, unit);
    const formattedGoal = this.formatTeamGoalValue(goal, metric, unit);

    console.log(
      `✅ Team progress: ${formattedCurrent} / ${formattedGoal} (${percentage.toFixed(1)}%)`
    );

    return {
      current: total,
      goal,
      percentage,
      formattedCurrent,
      formattedGoal,
      unit,
    };
  }

  /**
   * Format team goal values for display
   */
  private formatTeamGoalValue(
    value: number,
    metric: string,
    unit: string
  ): string {
    switch (metric) {
      case 'total_distance':
      case 'fastest_time':
        return `${value.toFixed(1)} ${unit}`;
      case 'total_duration':
        const hours = Math.floor(value / 3600);
        const minutes = Math.floor((value % 3600) / 60);
        return `${hours}h ${minutes}m`;
      case 'total_calories':
        return `${Math.round(value)} cal`;
      case 'most_workouts':
        return `${Math.round(value)} workouts`;
      default:
        return `${value.toFixed(1)} ${unit}`;
    }
  }

  /**
   * Timeout wrapper for async operations
   */
  private async fetchWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutError: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(timeoutError)), timeoutMs)
      ),
    ]);
  }

  /**
   * Get workouts for members within date range
   * ✅ PERFORMANCE: Now with 5-minute caching for instant revisits
   */
  private async getWorkouts(
    memberNpubs: string[],
    activityType: string,
    startDate: Date,
    endDate: Date
  ): Promise<Workout[]> {
    if (memberNpubs.length === 0) {
      console.log('No members to query workouts for');
      return [];
    }

    // ✅ NEW: Check cache first
    const cachedWorkouts =
      await this.cacheService.getCachedLeaderboardWorkouts<Workout>(
        memberNpubs,
        activityType,
        startDate,
        endDate
      );

    if (cachedWorkouts) {
      console.log(
        `💾 Returning ${cachedWorkouts.length} cached workouts (instant load)`
      );
      return cachedWorkouts;
    }

    // Cache miss - fetch from Nostr
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);

    try {
      // Progressive: Accept 2/4 relays for faster leaderboard loading
      const connected = await GlobalNDKService.waitForMinimumConnection(
        2,
        4000
      );
      if (!connected) {
        console.warn(
          '⚠️ Proceeding with minimal relay connectivity for workout query'
        );
      }

      const ndk = await GlobalNDKService.getInstance();

      const filter: NDKFilter = {
        kinds: [1301],
        authors: memberNpubs,
        since: startTimestamp,
        until: endTimestamp,
        limit: 1000,
      };

      // Add 5-second timeout to prevent UI freeze
      console.log(
        `⏱️ Fetching workouts with 5s timeout for ${memberNpubs.length} members...`
      );
      const events = await this.fetchWithTimeout(
        ndk.fetchEvents(filter),
        5000,
        'Workout fetch timeout'
      );

      const workouts: Workout[] = [];

      // ✅ PERFORMANCE: Batch process events to avoid blocking UI (runstr-github pattern)
      const BATCH_SIZE = 100;
      const eventsArray = Array.from(events);

      for (let i = 0; i < eventsArray.length; i += BATCH_SIZE) {
        const batch = eventsArray.slice(i, i + BATCH_SIZE);

        batch.forEach((event) => {
          const workout = this.parseWorkoutEvent(event);
          if (workout) {
            // Filter by activity type if not "Any"
            if (
              activityType === 'Any' ||
              workout.activityType.toLowerCase() === activityType.toLowerCase()
            ) {
              workouts.push(workout);
            }
          }
        });

        // Yield to UI thread between batches (runstr-github pattern)
        if (i + BATCH_SIZE < eventsArray.length) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      // ✅ NEW: Cache the results for 5 minutes
      if (workouts.length > 0) {
        await this.cacheService.cacheLeaderboardWorkouts(
          memberNpubs,
          activityType,
          startDate,
          endDate,
          workouts
        );
      }

      return workouts;
    } catch (error) {
      if (error instanceof Error && error.message === 'Workout fetch timeout') {
        console.warn(
          '⚠️ Workout fetch timed out after 5 seconds - showing empty leaderboard'
        );
        console.warn(
          '   This may indicate slow relay connections or large result set'
        );
        return [];
      }
      console.error('Failed to fetch workouts:', error);
      return [];
    }
  }

  /**
   * Parse kind 1301 event into Workout
   */
  private parseWorkoutEvent(event: NDKEvent): Workout | null {
    try {
      const getTag = (name: string) =>
        event.tags.find((t) => t[0] === name)?.[1];

      const activityType = getTag('exercise') || 'unknown';
      const distanceStr = getTag('distance');
      const durationStr = getTag('duration');

      if (!distanceStr || !durationStr) {
        return null;
      }

      // Parse distance (could be in km or miles, assume km for now)
      const distance = parseFloat(distanceStr);

      // Parse duration (format: HH:MM:SS)
      const duration = this.parseDuration(durationStr);

      const caloriesStr = getTag('calories');

      // Parse split data (multiple split tags: ["split", "1", "00:05:12"])
      const splits = new Map<number, number>();
      const splitTags = event.tags.filter((t) => t[0] === 'split');
      for (const splitTag of splitTags) {
        const km = parseInt(splitTag[1]);
        const elapsedTime = this.parseDuration(splitTag[2]);
        if (!isNaN(km) && elapsedTime > 0) {
          splits.set(km, elapsedTime);
        }
      }

      // Parse split pace data (multiple split_pace tags: ["split_pace", "1", "360"])
      const splitPaces = new Map<number, number>();
      const splitPaceTags = event.tags.filter((t) => t[0] === 'split_pace');
      for (const paceTag of splitPaceTags) {
        const km = parseInt(paceTag[1]);
        const pace = parseInt(paceTag[2]);
        if (!isNaN(km) && !isNaN(pace)) {
          splitPaces.set(km, pace);
        }
      }

      return {
        id: event.id,
        npub: event.pubkey,
        activityType,
        distance,
        duration,
        calories: caloriesStr ? parseInt(caloriesStr) : undefined,
        timestamp: event.created_at,
        splits: splits.size > 0 ? splits : undefined,
        splitPaces: splitPaces.size > 0 ? splitPaces : undefined,
      };
    } catch (error) {
      console.error('Failed to parse workout event:', error);
      return null;
    }
  }

  /**
   * Parse duration string (HH:MM:SS) to seconds
   */
  private parseDuration(durationStr: string): number {
    const parts = durationStr.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      const seconds = parseInt(parts[2]);
      return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
  }

  /**
   * Extract time at target distance using split data
   * Returns the elapsed time when runner reached the target distance
   * Falls back to full workout time if splits unavailable
   */
  private extractTargetDistanceTime(
    workout: Workout,
    targetDistanceKm: number
  ): number {
    // If no splits available, use full workout time
    if (!workout.splits || workout.splits.size === 0) {
      return workout.duration;
    }

    // Check if we have an exact split at target distance
    const exactSplit = workout.splits.get(targetDistanceKm);
    if (exactSplit !== undefined) {
      return exactSplit;
    }

    // If no exact match, find closest split <= target distance
    // (e.g., for 5k target with splits at 1,2,3,4, use split 4)
    let closestKm = 0;
    let closestTime = 0;

    for (const [km, time] of workout.splits.entries()) {
      if (km <= targetDistanceKm && km > closestKm) {
        closestKm = km;
        closestTime = time;
      }
    }

    // If we found a close split, interpolate to target distance
    if (closestKm > 0 && closestTime > 0) {
      // Calculate remaining distance and estimated time
      const remainingDistance = targetDistanceKm - closestKm;
      const avgPacePerKm = closestTime / closestKm; // Average pace up to this point
      const estimatedTime = closestTime + remainingDistance * avgPacePerKm;

      // Don't exceed total workout time
      return Math.min(estimatedTime, workout.duration);
    }

    // Fall back to full workout time
    return workout.duration;
  }

  /**
   * Calculate scores for each member based on metric
   */
  private calculateScores(
    workouts: Workout[],
    metric: string
  ): Map<string, { score: number; workoutCount: number }> {
    const scoresByMember = new Map<
      string,
      { score: number; workoutCount: number }
    >();

    for (const workout of workouts) {
      const existing = scoresByMember.get(workout.npub) || {
        score: 0,
        workoutCount: 0,
      };

      let score = existing.score;

      switch (metric) {
        case 'completion':
          // ✅ NEW: Binary completion scoring - 1 if completed, 0 if not
          // For completion events, just having ANY workout counts as completed
          score = 1;
          break;

        case 'total_distance':
          score += workout.distance;
          break;

        case 'most_workouts':
          score += 1;
          break;

        case 'total_duration':
          score += workout.duration;
          break;

        case 'total_calories':
          score += workout.calories || 0;
          break;

        case 'fastest_time':
          // For fastest time, we want the LOWEST duration
          if (existing.score === 0 || workout.duration < existing.score) {
            score = workout.duration;
          }
          break;

        case 'average_pace':
          // Calculate pace (min/km) - lower is better
          if (workout.distance > 0) {
            const paceMinutesPerKm = workout.duration / 60 / workout.distance;
            // Take the best pace
            if (existing.score === 0 || paceMinutesPerKm < existing.score) {
              score = paceMinutesPerKm;
            }
          }
          break;

        default:
          // Default to total distance
          score += workout.distance;
      }

      scoresByMember.set(workout.npub, {
        score,
        workoutCount: existing.workoutCount + 1,
      });
    }

    return scoresByMember;
  }

  /**
   * Format score for display
   * ✅ UPDATED: Support completion scoring type
   */
  private formatScore(score: number, metric: string): string {
    switch (metric) {
      case 'completion':
        // ✅ NEW: Binary completion display
        return score > 0 ? 'Completed ✓' : 'Not completed';

      case 'total_distance':
        return `${score.toFixed(2)} km`;

      case 'most_workouts':
        return `${score} workouts`;

      case 'total_duration':
        const hours = Math.floor(score / 3600);
        const minutes = Math.floor((score % 3600) / 60);
        return `${hours}h ${minutes}m`;

      case 'total_calories':
        return `${Math.round(score)} cal`;

      case 'fastest_time':
        if (score === 0) return 'Did not complete';
        const mins = Math.floor(score / 60);
        const secs = Math.floor(score % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;

      case 'average_pace':
        const paceMinutes = Math.floor(score);
        const paceSeconds = Math.floor((score % 1) * 60);
        return `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')} /km`;

      default:
        return score.toFixed(2);
    }
  }
}

export default SimpleLeaderboardService.getInstance();
