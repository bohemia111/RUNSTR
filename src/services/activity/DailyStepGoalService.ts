/**
 * DailyStepGoalService - Manages daily step goals
 * Stores goal in AsyncStorage and provides progress calculation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@runstr:daily_step_goal';
const DEFAULT_GOAL = 10000; // Industry standard daily step goal

export interface StepGoalProgress {
  currentSteps: number;
  goalSteps: number;
  percentage: number; // 0-100
  achieved: boolean;
  remaining: number;
}

export class DailyStepGoalService {
  private static instance: DailyStepGoalService;
  private cachedGoal: number | null = null;

  private constructor() {
    console.log('[DailyStepGoalService] Initialized');
  }

  static getInstance(): DailyStepGoalService {
    if (!DailyStepGoalService.instance) {
      DailyStepGoalService.instance = new DailyStepGoalService();
    }
    return DailyStepGoalService.instance;
  }

  /**
   * Get current daily step goal
   * Returns cached value if available, otherwise reads from storage
   */
  async getGoal(): Promise<number> {
    try {
      // Return cached value if available
      if (this.cachedGoal !== null) {
        return this.cachedGoal;
      }

      // Read from storage
      const stored = await AsyncStorage.getItem(STORAGE_KEY);

      if (stored) {
        const goal = parseInt(stored, 10);
        if (!isNaN(goal) && goal > 0) {
          this.cachedGoal = goal;
          return goal;
        }
      }

      // No stored goal, return default
      this.cachedGoal = DEFAULT_GOAL;
      return DEFAULT_GOAL;
    } catch (error) {
      console.error('[DailyStepGoalService] Error getting goal:', error);
      return DEFAULT_GOAL;
    }
  }

  /**
   * Set new daily step goal
   */
  async setGoal(steps: number): Promise<void> {
    try {
      if (steps <= 0) {
        throw new Error('Step goal must be greater than 0');
      }

      await AsyncStorage.setItem(STORAGE_KEY, steps.toString());
      this.cachedGoal = steps;

      console.log(`[DailyStepGoalService] ✅ Goal set to ${steps} steps`);
    } catch (error) {
      console.error('[DailyStepGoalService] Error setting goal:', error);
      throw error;
    }
  }

  /**
   * Calculate progress toward daily goal
   */
  calculateProgress(currentSteps: number, goalSteps: number): StepGoalProgress {
    const percentage = Math.min(
      Math.round((currentSteps / goalSteps) * 100),
      100
    );
    const achieved = currentSteps >= goalSteps;
    const remaining = Math.max(goalSteps - currentSteps, 0);

    return {
      currentSteps,
      goalSteps,
      percentage,
      achieved,
      remaining,
    };
  }

  /**
   * Get suggested goal based on user's average
   * (Future enhancement: analyze past week's averages)
   */
  async getSuggestedGoal(averageSteps: number): Promise<number> {
    // Round up to nearest 1000
    const suggested = Math.ceil(averageSteps / 1000) * 1000;

    // Ensure minimum goal of 5000
    return Math.max(suggested, 5000);
  }

  /**
   * Get common goal presets
   */
  getGoalPresets(): number[] {
    return [
      5000, // Beginner
      7500, // Moderate
      10000, // Standard (WHO recommendation)
      12500, // Active
      15000, // Very Active
    ];
  }

  /**
   * Clear cached goal (force re-read from storage)
   */
  clearCache(): void {
    this.cachedGoal = null;
    console.log('[DailyStepGoalService] Cache cleared');
  }

  /**
   * Reset goal to default
   */
  async resetToDefault(): Promise<void> {
    await this.setGoal(DEFAULT_GOAL);
    console.log('[DailyStepGoalService] Goal reset to default');
  }

  /**
   * Get default goal value
   */
  getDefaultGoal(): number {
    return DEFAULT_GOAL;
  }
}

// Export singleton instance
export const dailyStepGoalService = DailyStepGoalService.getInstance();
