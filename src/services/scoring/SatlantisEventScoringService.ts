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
import type { NostrWorkout } from '../../types/nostrWorkout';
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
   * - Uses split data to extract time at target distance (e.g., 5K split from 20K workout)
   * - Filters workouts by target distance (95% threshold)
   * - Lower time = better rank
   */
  private buildFastestTimeLeaderboard(
    metrics: Map<string, WorkoutMetrics>,
    targetDistance?: number
  ): SatlantisLeaderboardEntry[] {
    const entries: SatlantisLeaderboardEntry[] = [];
    const targetDistanceKm = targetDistance || 5; // Default to 5K

    for (const [npub, memberMetrics] of metrics) {
      if (!memberMetrics.workouts || memberMetrics.workouts.length === 0) {
        continue;
      }

      // Filter workouts that cover AT LEAST the target distance (95% threshold)
      // A 20K workout qualifies for a 5K race - we'll extract the 5K split time
      const minDistanceMeters = targetDistanceKm * 1000 * 0.95;
      const relevantWorkouts = memberMetrics.workouts.filter(
        (w) => (w.distance || 0) >= minDistanceMeters
      );

      if (relevantWorkouts.length === 0) {
        continue;
      }

      // Find fastest time AT TARGET DISTANCE (using splits if available)
      let bestTime = Infinity;
      let bestWorkout = relevantWorkouts[0];

      for (const workout of relevantWorkouts) {
        // Extract time at target distance using splits
        const timeAtTarget = this.extractTargetDistanceTime(workout, targetDistanceKm);

        if (timeAtTarget < bestTime) {
          bestTime = timeAtTarget;
          bestWorkout = workout;
        }
      }

      // Log if we used split data
      const originalDuration = bestWorkout.duration || 0;
      if (bestTime !== originalDuration && bestTime < originalDuration) {
        console.log(
          `[Scoring] ✅ Using split time for ${npub.slice(0, 8)}: ` +
          `${formatDuration(bestTime)} (total was ${formatDuration(originalDuration)})`
        );
      }

      entries.push({
        rank: 0, // Assigned after sorting
        npub,
        name: '', // Resolved by UI component
        score: bestTime,
        formattedScore: formatDuration(bestTime),
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

    console.log(`[Scoring] Fastest time: ${entries.length} entries (target: ${targetDistanceKm}km)`);
    return entries;
  }

  /**
   * Extract time at target distance using split data
   * - If splits exist at exact target distance, use that time
   * - If splits exist below target, interpolate to estimate target time
   * - Falls back to average pace estimation if no splits
   */
  private extractTargetDistanceTime(
    workout: NostrWorkout,
    targetDistanceKm: number
  ): number {
    // Parse splits from raw Nostr event tags
    const splits = this.parseSplitsFromWorkout(workout);

    // If no splits available, estimate target time from average pace
    if (splits.size === 0) {
      const distanceKm = (workout.distance || 0) / 1000;
      if (distanceKm > 0) {
        // Calculate estimated target time based on average pace
        // e.g., 5.18km in 31:15 → avgPace = 361.9 sec/km → 5K time = 30:10
        const avgPacePerKm = workout.duration / distanceKm;
        const estimatedTargetTime = avgPacePerKm * targetDistanceKm;
        return Math.round(estimatedTargetTime);
      }
      // No distance either - fall back to total workout time
      return workout.duration;
    }

    // Check if we have an exact split at target distance
    const exactSplit = splits.get(targetDistanceKm);
    if (exactSplit !== undefined) {
      return exactSplit;
    }

    // If no exact match, find closest split <= target distance
    let closestKm = 0;
    let closestTime = 0;

    for (const [km, time] of splits.entries()) {
      if (km <= targetDistanceKm && km > closestKm) {
        closestKm = km;
        closestTime = time;
      }
    }

    // If we found a close split, interpolate to target distance
    if (closestKm > 0 && closestTime > 0) {
      const remainingDistance = targetDistanceKm - closestKm;
      const avgPacePerKm = closestTime / closestKm;
      const estimatedTime = closestTime + remainingDistance * avgPacePerKm;
      // Don't exceed total workout time
      return Math.min(Math.round(estimatedTime), workout.duration);
    }

    // Fall back to full workout time
    return workout.duration;
  }

  /**
   * Parse split tags from a NostrWorkout's raw event
   * Split format: ["split", "5", "00:25:30"] = km 5 completed at 25:30 elapsed
   */
  private parseSplitsFromWorkout(workout: NostrWorkout): Map<number, number> {
    const splits = new Map<number, number>();

    // Try to get tags from raw Nostr event
    const tags = workout.rawNostrEvent?.tags || [];

    for (const tag of tags) {
      if (tag[0] === 'split' && tag.length >= 3) {
        const km = parseInt(tag[1], 10);
        const elapsedTime = this.parseDurationString(tag[2]);
        if (!isNaN(km) && km > 0 && elapsedTime > 0) {
          splits.set(km, elapsedTime);
        }
      }
    }

    return splits;
  }

  /**
   * Parse duration string (HH:MM:SS or MM:SS) to seconds
   */
  private parseDurationString(duration: string): number {
    if (!duration) return 0;

    const parts = duration.split(':').map(p => parseInt(p, 10));

    if (parts.length === 3) {
      // HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      // MM:SS
      return parts[0] * 60 + parts[1];
    }

    return 0;
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
