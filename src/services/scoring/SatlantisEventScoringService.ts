/**
 * SatlantisEventScoringService - Multi-scoring leaderboard engine
 *
 * Supports all 3 RUNSTR scoring types:
 * - fastest_time: Race to complete target distance (lowest time wins)
 * - most_distance: Accumulate total distance (highest km wins)
 * - participation: Everyone who completes a qualifying workout ranks equally
 *
 * Usage:
 * ```typescript
 * const entries = SatlantisEventScoringService.buildLeaderboard(
 *   metrics,
 *   'most_distance',
 *   undefined  // targetDistance not needed for most_distance
 * );
 * ```
 */

import type { SatlantisLeaderboardEntry } from '../../types/satlantis';
import type { RunstrScoringType } from '../../types/runstrEvent';
import type { WorkoutMetrics } from '../competition/Competition1301QueryService';
import { formatDuration } from '../../types/satlantis';

class SatlantisEventScoringServiceClass {
  private static instance: SatlantisEventScoringServiceClass;

  static getInstance(): SatlantisEventScoringServiceClass {
    if (!this.instance) {
      this.instance = new SatlantisEventScoringServiceClass();
    }
    return this.instance;
  }

  /**
   * Build leaderboard from workout metrics using specified scoring type
   * @param metrics - Map of npub → member workout metrics
   * @param scoringType - How to score: fastest_time, most_distance, participation
   * @param targetDistance - Target distance in km (required for fastest_time)
   */
  buildLeaderboard(
    metrics: Map<string, WorkoutMetrics>,
    scoringType: RunstrScoringType = 'fastest_time',
    targetDistance?: number
  ): SatlantisLeaderboardEntry[] {
    console.log(
      `[Scoring] Building leaderboard with ${scoringType} scoring, ` +
        `${metrics.size} participants, target: ${targetDistance}km`
    );

    switch (scoringType) {
      case 'fastest_time':
        return this.buildFastestTimeLeaderboard(metrics, targetDistance);
      case 'most_distance':
        return this.buildMostDistanceLeaderboard(metrics);
      case 'participation':
        return this.buildParticipationLeaderboard(metrics);
      default:
        console.warn(`[Scoring] Unknown scoring type: ${scoringType}, using fastest_time`);
        return this.buildFastestTimeLeaderboard(metrics, targetDistance);
    }
  }

  /**
   * Fastest Time Scoring
   * - Finds best (lowest) time to complete target distance
   * - Filters workouts by target distance (95% threshold)
   * - Lower time = better rank
   */
  private buildFastestTimeLeaderboard(
    metrics: Map<string, WorkoutMetrics>,
    targetDistance?: number
  ): SatlantisLeaderboardEntry[] {
    const entries: SatlantisLeaderboardEntry[] = [];

    for (const [npub, memberMetrics] of metrics) {
      if (!memberMetrics.workouts || memberMetrics.workouts.length === 0) {
        continue;
      }

      // Filter workouts by target distance if specified (95% threshold)
      // Distance in workouts is in meters, targetDistance is in km
      let relevantWorkouts = memberMetrics.workouts;
      if (targetDistance) {
        const minDistanceMeters = targetDistance * 1000 * 0.95;
        relevantWorkouts = relevantWorkouts.filter(
          (w) => (w.distance || 0) >= minDistanceMeters
        );
      }

      if (relevantWorkouts.length === 0) {
        continue;
      }

      // Find fastest (lowest duration) workout
      let bestWorkout = relevantWorkouts[0];
      for (const workout of relevantWorkouts) {
        if (workout.duration < bestWorkout.duration) {
          bestWorkout = workout;
        }
      }

      entries.push({
        rank: 0, // Assigned after sorting
        npub,
        name: '', // Resolved by UI component
        score: bestWorkout.duration || 0,
        formattedScore: formatDuration(bestWorkout.duration || 0),
        workoutCount: relevantWorkouts.length,
        workoutId: bestWorkout.id,
      });
    }

    // Sort by time ascending (lowest/fastest first)
    entries.sort((a, b) => a.score - b.score);

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    console.log(`[Scoring] Fastest time: ${entries.length} entries`);
    return entries;
  }

  /**
   * Most Distance Scoring
   * - Sums total distance from all qualifying workouts
   * - Higher total distance = better rank
   */
  private buildMostDistanceLeaderboard(
    metrics: Map<string, WorkoutMetrics>
  ): SatlantisLeaderboardEntry[] {
    const entries: SatlantisLeaderboardEntry[] = [];

    for (const [npub, memberMetrics] of metrics) {
      if (!memberMetrics.workouts || memberMetrics.workouts.length === 0) {
        continue;
      }

      // Sum all workout distances (in meters)
      const totalDistanceMeters = memberMetrics.workouts.reduce(
        (sum, w) => sum + (w.distance || 0),
        0
      );

      if (totalDistanceMeters <= 0) {
        continue;
      }

      // Convert to km for scoring and display
      const totalDistanceKm = totalDistanceMeters / 1000;

      // Find workout with most distance (for reference)
      const bestWorkout = memberMetrics.workouts.reduce(
        (best, w) => ((w.distance || 0) > (best.distance || 0) ? w : best),
        memberMetrics.workouts[0]
      );

      entries.push({
        rank: 0, // Assigned after sorting
        npub,
        name: '', // Resolved by UI component
        score: totalDistanceKm,
        formattedScore: this.formatDistance(totalDistanceKm),
        workoutCount: memberMetrics.workouts.length,
        workoutId: bestWorkout.id,
      });
    }

    // Sort by distance descending (highest first)
    entries.sort((a, b) => b.score - a.score);

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    console.log(`[Scoring] Most distance: ${entries.length} entries`);
    return entries;
  }

  /**
   * Participation Scoring
   * - Everyone who completes at least one qualifying workout is included
   * - All participants share rank 1 (equal standing)
   * - Used for lottery-style payouts where everyone has equal chance
   */
  private buildParticipationLeaderboard(
    metrics: Map<string, WorkoutMetrics>
  ): SatlantisLeaderboardEntry[] {
    const entries: SatlantisLeaderboardEntry[] = [];

    for (const [npub, memberMetrics] of metrics) {
      if (!memberMetrics.workouts || memberMetrics.workouts.length === 0) {
        continue;
      }

      // Count total workouts (for display)
      const workoutCount = memberMetrics.workouts.length;

      // Get first workout as reference
      const firstWorkout = memberMetrics.workouts[0];

      entries.push({
        rank: 1, // All participants share rank 1
        npub,
        name: '', // Resolved by UI component
        score: workoutCount, // Score is workout count for display
        formattedScore: `${workoutCount} workout${workoutCount > 1 ? 's' : ''}`,
        workoutCount,
        workoutId: firstWorkout.id,
      });
    }

    // Sort alphabetically by npub for consistent ordering
    entries.sort((a, b) => a.npub.localeCompare(b.npub));

    console.log(`[Scoring] Participation: ${entries.length} entries (all rank 1)`);
    return entries;
  }

  /**
   * Format distance for display (e.g., "5.2 km")
   */
  private formatDistance(km: number): string {
    if (km >= 10) {
      return `${km.toFixed(1)} km`;
    }
    return `${km.toFixed(2)} km`;
  }

  /**
   * Get scoring type description for UI display
   */
  getScoringDescription(scoringType: RunstrScoringType): string {
    switch (scoringType) {
      case 'fastest_time':
        return 'Fastest time to complete target distance';
      case 'most_distance':
        return 'Highest total distance accumulated';
      case 'participation':
        return 'Complete any qualifying workout to participate';
      default:
        return 'Unknown scoring type';
    }
  }

  /**
   * Get score label for UI column header
   */
  getScoreLabel(scoringType: RunstrScoringType): string {
    switch (scoringType) {
      case 'fastest_time':
        return 'Time';
      case 'most_distance':
        return 'Distance';
      case 'participation':
        return 'Workouts';
      default:
        return 'Score';
    }
  }
}

// Export singleton instance
export const SatlantisEventScoringService =
  SatlantisEventScoringServiceClass.getInstance();
export default SatlantisEventScoringService;
