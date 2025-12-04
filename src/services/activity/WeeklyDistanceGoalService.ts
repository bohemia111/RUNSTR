/**
 * WeeklyDistanceGoalService - Manages weekly distance goals for running and cycling
 * Stores goals in AsyncStorage and provides progress calculation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import LocalWorkoutStorageService from '../fitness/LocalWorkoutStorageService';

type ActivityType = 'running' | 'cycling';

const STORAGE_KEYS = {
  running: '@runstr:weekly_distance_goal_running',
  cycling: '@runstr:weekly_distance_goal_cycling',
};

// Default weekly distance goals in km
const DEFAULT_GOALS = {
  running: 20, // 20km per week
  cycling: 50, // 50km per week
};

export interface DistanceGoalProgress {
  currentDistance: number; // km
  goalDistance: number; // km
  percentage: number; // 0-100
  achieved: boolean;
  remaining: number; // km
}

export class WeeklyDistanceGoalService {
  private static instance: WeeklyDistanceGoalService;
  private cachedGoals: { running: number | null; cycling: number | null } = {
    running: null,
    cycling: null,
  };

  private constructor() {
    console.log('[WeeklyDistanceGoalService] Initialized');
  }

  static getInstance(): WeeklyDistanceGoalService {
    if (!WeeklyDistanceGoalService.instance) {
      WeeklyDistanceGoalService.instance = new WeeklyDistanceGoalService();
    }
    return WeeklyDistanceGoalService.instance;
  }

  /**
   * Get current weekly distance goal for activity type
   */
  async getGoal(activityType: ActivityType): Promise<number> {
    try {
      // Return cached value if available
      if (this.cachedGoals[activityType] !== null) {
        return this.cachedGoals[activityType]!;
      }

      // Read from storage
      const stored = await AsyncStorage.getItem(STORAGE_KEYS[activityType]);

      if (stored) {
        const goal = parseFloat(stored);
        if (!isNaN(goal) && goal > 0) {
          this.cachedGoals[activityType] = goal;
          return goal;
        }
      }

      // No stored goal, return default
      const defaultGoal = DEFAULT_GOALS[activityType];
      this.cachedGoals[activityType] = defaultGoal;
      return defaultGoal;
    } catch (error) {
      console.error('[WeeklyDistanceGoalService] Error getting goal:', error);
      return DEFAULT_GOALS[activityType];
    }
  }

  /**
   * Set new weekly distance goal
   */
  async setGoal(activityType: ActivityType, distanceKm: number): Promise<void> {
    try {
      if (distanceKm <= 0) {
        throw new Error('Distance goal must be greater than 0');
      }

      await AsyncStorage.setItem(
        STORAGE_KEYS[activityType],
        distanceKm.toString()
      );
      this.cachedGoals[activityType] = distanceKm;

      console.log(
        `[WeeklyDistanceGoalService] ✅ ${activityType} goal set to ${distanceKm}km`
      );
    } catch (error) {
      console.error('[WeeklyDistanceGoalService] Error setting goal:', error);
      throw error;
    }
  }

  /**
   * Get start and end of current week (Monday to Sunday)
   */
  getWeekBounds(): { start: Date; end: Date } {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { start: monday, end: sunday };
  }

  /**
   * Get total distance for current week from local workouts
   */
  async getWeeklyDistance(activityType: ActivityType): Promise<number> {
    try {
      const workouts = await LocalWorkoutStorageService.getAllWorkouts();
      const { start, end } = this.getWeekBounds();

      // Filter workouts by type and date range
      const weeklyWorkouts = workouts.filter((workout) => {
        // Check type matches (running or cycling)
        const typeMatches =
          workout.type?.toLowerCase() === activityType ||
          (workout as any).activityType?.toLowerCase() === activityType;

        if (!typeMatches) return false;

        // Check date is within current week
        const workoutDate = new Date(workout.startTime || workout.endTime);
        return workoutDate >= start && workoutDate <= end;
      });

      // Sum up distances (convert meters to km if needed)
      const totalDistance = weeklyWorkouts.reduce((sum, workout) => {
        let distance = workout.distance || 0;

        // If distance is in meters (> 1000), convert to km
        if (distance > 1000) {
          distance = distance / 1000;
        }

        return sum + distance;
      }, 0);

      console.log(
        `[WeeklyDistanceGoalService] ${activityType} weekly distance: ${totalDistance.toFixed(2)}km from ${weeklyWorkouts.length} workouts`
      );

      return totalDistance;
    } catch (error) {
      console.error('[WeeklyDistanceGoalService] Error getting weekly distance:', error);
      return 0;
    }
  }

  /**
   * Calculate progress toward weekly goal
   */
  calculateProgress(
    currentDistance: number,
    goalDistance: number
  ): DistanceGoalProgress {
    const percentage = Math.min(
      Math.round((currentDistance / goalDistance) * 100),
      100
    );
    const achieved = currentDistance >= goalDistance;
    const remaining = Math.max(goalDistance - currentDistance, 0);

    return {
      currentDistance,
      goalDistance,
      percentage,
      achieved,
      remaining,
    };
  }

  /**
   * Get goal presets for activity type
   */
  getGoalPresets(activityType: ActivityType): number[] {
    if (activityType === 'running') {
      return [10, 20, 30, 50, 75, 100]; // km per week
    } else {
      return [25, 50, 100, 150, 200, 300]; // km per week
    }
  }

  /**
   * Get default goal for activity type
   */
  getDefaultGoal(activityType: ActivityType): number {
    return DEFAULT_GOALS[activityType];
  }

  /**
   * Clear cached goals
   */
  clearCache(): void {
    this.cachedGoals = { running: null, cycling: null };
    console.log('[WeeklyDistanceGoalService] Cache cleared');
  }

  /**
   * Reset goal to default for activity type
   */
  async resetToDefault(activityType: ActivityType): Promise<void> {
    await this.setGoal(activityType, DEFAULT_GOALS[activityType]);
    console.log(`[WeeklyDistanceGoalService] ${activityType} goal reset to default`);
  }

  /**
   * Get week number of the year (for display purposes)
   */
  getWeekNumber(): number {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.ceil(diff / oneWeek);
  }
}

// Export singleton instance
export const weeklyDistanceGoalService = WeeklyDistanceGoalService.getInstance();
