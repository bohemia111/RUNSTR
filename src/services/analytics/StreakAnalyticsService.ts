/**
 * Streak Analytics Service
 * Calculates current and best streaks for each activity type
 * A streak = consecutive days with at least one workout of that type
 */

import type { LocalWorkout } from '../fitness/LocalWorkoutStorageService';
import type { WorkoutType } from '../../types/workout';

export interface ActivityStreak {
  activityType: WorkoutType;
  currentStreak: number; // Consecutive days (including today if active)
  bestStreak: number; // Longest streak ever
  lastWorkoutDate: string; // ISO date (YYYY-MM-DD)
  totalWorkouts: number; // Total workouts of this type
  icon: string; // Ionicons name
}

export class StreakAnalyticsService {
  /**
   * Calculate streaks for all activity types user has done
   */
  static calculateActivityStreaks(workouts: LocalWorkout[]): ActivityStreak[] {
    if (workouts.length === 0) {
      return [];
    }

    // Group workouts by activity type
    const workoutsByType = this.groupByActivityType(workouts);

    // Calculate streaks for each activity type
    const streaks: ActivityStreak[] = [];

    for (const [activityType, typeWorkouts] of Object.entries(workoutsByType)) {
      const streak = this.calculateStreakForActivity(
        activityType as WorkoutType,
        typeWorkouts
      );

      if (streak) {
        streaks.push(streak);
      }
    }

    // Sort by current streak (descending)
    return streaks.sort((a, b) => b.currentStreak - a.currentStreak);
  }

  /**
   * Group workouts by activity type
   * Normalizes type to lowercase to prevent duplicates (e.g., "Strength" vs "strength")
   * Filters out "other" type workouts from streak tracking
   */
  private static groupByActivityType(
    workouts: LocalWorkout[]
  ): Record<string, LocalWorkout[]> {
    const grouped: Record<string, LocalWorkout[]> = {};

    for (const workout of workouts) {
      // Normalize type to lowercase to prevent duplicates
      const normalizedType = (workout.type || 'other').toLowerCase().trim();

      // Skip "other" workouts - don't track streaks for miscellaneous activities
      if (normalizedType === 'other') {
        continue;
      }

      if (!grouped[normalizedType]) {
        grouped[normalizedType] = [];
      }
      grouped[normalizedType].push(workout);
    }

    return grouped;
  }

  /**
   * Calculate current and best streak for a single activity type
   */
  private static calculateStreakForActivity(
    activityType: WorkoutType,
    workouts: LocalWorkout[]
  ): ActivityStreak | null {
    if (workouts.length === 0) {
      return null;
    }

    // Get unique dates (YYYY-MM-DD) using local timezone
    const workoutDates = new Set(
      workouts.map((w) => new Date(w.startTime).toLocaleDateString('en-CA'))
    );

    const sortedDates = Array.from(workoutDates).sort();
    const lastWorkoutDate = sortedDates[sortedDates.length - 1];

    // Calculate current streak (counting backwards from today)
    const currentStreak = this.calculateCurrentStreak(sortedDates);

    // Calculate best streak (all-time longest)
    const bestStreak = this.calculateBestStreak(sortedDates);

    // Get icon for activity type
    const icon = this.getActivityIcon(activityType);

    return {
      activityType,
      currentStreak,
      bestStreak,
      lastWorkoutDate,
      totalWorkouts: workouts.length,
      icon,
    };
  }

  /**
   * Calculate current streak (consecutive days from today backwards)
   */
  private static calculateCurrentStreak(sortedDates: string[]): number {
    const today = new Date().toLocaleDateString('en-CA');
    const yesterday = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toLocaleDateString('en-CA');

    // Streak must include today OR yesterday (grace period)
    const lastDate = sortedDates[sortedDates.length - 1];
    if (lastDate !== today && lastDate !== yesterday) {
      return 0; // Streak broken
    }

    let currentStreak = 0;
    let checkDate = new Date();

    // Count backwards from today
    for (let i = sortedDates.length - 1; i >= 0; i--) {
      const expectedDate = checkDate.toLocaleDateString('en-CA');

      if (sortedDates[i] === expectedDate) {
        currentStreak++;
        // Move to previous day
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
      } else {
        // Gap found, streak ends
        break;
      }
    }

    return currentStreak;
  }

  /**
   * Calculate best streak (longest consecutive days ever)
   */
  private static calculateBestStreak(sortedDates: string[]): number {
    if (sortedDates.length === 0) return 0;

    let bestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);

      // Check if consecutive days
      const diffMs = currDate.getTime() - prevDate.getTime();
      const diffDays = diffMs / (24 * 60 * 60 * 1000);

      if (diffDays === 1) {
        // Consecutive day
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        // Gap found, reset streak
        currentStreak = 1;
      }
    }

    return bestStreak;
  }

  /**
   * Get Ionicons name for activity type
   */
  private static getActivityIcon(activityType: WorkoutType): string {
    const iconMap: Record<string, string> = {
      running: 'walk-outline',
      walking: 'walk-outline',
      cycling: 'bicycle-outline',
      hiking: 'trail-sign-outline',
      swimming: 'water-outline',
      rowing: 'boat-outline',
      strength: 'barbell-outline',
      yoga: 'body-outline',
      meditation: 'flower-outline',
      diet: 'restaurant-outline',
      fasting: 'timer-outline',
      other: 'fitness-outline',
    };

    return iconMap[activityType] || 'fitness-outline';
  }

  /**
   * Get display name for activity type
   */
  static getActivityDisplayName(activityType: WorkoutType): string {
    const nameMap: Record<string, string> = {
      running: 'Running',
      walking: 'Walking',
      cycling: 'Cycling',
      hiking: 'Hiking',
      swimming: 'Swimming',
      rowing: 'Rowing',
      strength: 'Strength',
      yoga: 'Yoga',
      meditation: 'Meditation',
      diet: 'Nutrition',
      fasting: 'Fasting',
      other: 'Other',
    };

    return nameMap[activityType] || activityType;
  }
}
