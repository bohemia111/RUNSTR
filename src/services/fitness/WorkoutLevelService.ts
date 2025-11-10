/**
 * Workout Level Service
 * Calculates XP, levels, and progression based on charity donations
 * MVP: Levels determined by sats earned for charity (1 XP per 100 sats)
 * Caches level data in AsyncStorage for performance
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NostrWorkout } from '../../types/nostrWorkout';
import type {
  WorkoutLevel,
  XPCalculation,
  LevelStats,
  LevelMilestone,
} from '../../types/workoutLevel';
import { XP_CONSTANTS, LEVEL_MILESTONES } from '../../types/workoutLevel';
import { CharitySelectionService } from '../charity/CharitySelectionService';

const CACHE_KEY_PREFIX = '@runstr:workout_level:';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedLevelData {
  stats: LevelStats;
  timestamp: number;
}

export class WorkoutLevelService {
  private static instance: WorkoutLevelService;

  private constructor() {}

  static getInstance(): WorkoutLevelService {
    if (!WorkoutLevelService.instance) {
      WorkoutLevelService.instance = new WorkoutLevelService();
    }
    return WorkoutLevelService.instance;
  }

  /**
   * Calculate XP earned from a single workout
   * MVP: Returns 0 (XP now based on charity donations, not workouts)
   * Kept for backward compatibility
   */
  calculateWorkoutXP(workout: NostrWorkout): XPCalculation {
    // MVP: XP is now based on charity donations, not workout metrics
    // Return 0s but keep method signature for backward compatibility
    return {
      baseXP: 0,
      distanceBonus: 0,
      durationBonus: 0,
      calorieBonus: 0,
      totalXP: 0,
    };
  }

  /**
   * Calculate level from total XP
   */
  calculateLevel(totalXP: number): WorkoutLevel {
    const level = Math.floor(totalXP / XP_CONSTANTS.XP_PER_LEVEL);
    const currentXP = totalXP % XP_CONSTANTS.XP_PER_LEVEL;
    const xpForNextLevel = XP_CONSTANTS.XP_PER_LEVEL;
    const progress = currentXP / xpForNextLevel;

    return {
      level,
      currentXP,
      xpForNextLevel,
      totalXP,
      progress,
    };
  }

  /**
   * Calculate complete level stats from workout array
   * MVP: XP is now based on charity donations (1 XP per 100 sats)
   * Workouts are still tracked for stats, but don't contribute to XP
   */
  async calculateLevelStats(workouts: NostrWorkout[]): Promise<LevelStats> {
    let totalDistance = 0;
    let totalDuration = 0;
    let totalCalories = 0;

    // Still track workout totals for display
    workouts.forEach((workout) => {
      totalDistance += workout.distance || 0;
      totalDuration += workout.duration || 0;
      totalCalories += workout.calories || 0;
    });

    // Get XP from charity donations instead of workouts
    const charityStats = await CharitySelectionService.getCharityStats();
    const totalSats = charityStats.totalSatsEarned;

    // Calculate XP: 1 XP per 100 sats earned for charity
    const totalXP = Math.floor(totalSats / 100);
    const level = this.calculateLevel(totalXP);

    return {
      totalWorkouts: workouts.length,
      totalDistance,
      totalDuration,
      totalCalories,
      level,
    };
  }

  /**
   * Get level stats with caching (for performance)
   */
  async getLevelStats(
    pubkey: string,
    workouts: NostrWorkout[],
    forceRefresh = false
  ): Promise<LevelStats> {
    const cacheKey = `${CACHE_KEY_PREFIX}${pubkey}`;

    // Check cache first
    if (!forceRefresh) {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const cachedData: CachedLevelData = JSON.parse(cached);
          const age = Date.now() - cachedData.timestamp;

          if (age < CACHE_TTL) {
            console.log(
              `[WorkoutLevel] Cache hit: ${
                cachedData.stats.level.level
              } (age: ${Math.floor(age / 1000)}s)`
            );
            return cachedData.stats;
          }
        }
      } catch (error) {
        console.warn('[WorkoutLevel] Cache read error:', error);
      }
    }

    // Calculate fresh stats (now includes charity XP)
    console.log(
      `[WorkoutLevel] Calculating stats from ${workouts.length} workouts + charity donations...`
    );
    const stats = await this.calculateLevelStats(workouts);

    // Cache the results
    try {
      const cacheData: CachedLevelData = {
        stats,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('[WorkoutLevel] Cache write error:', error);
    }

    return stats;
  }

  /**
   * Get unlocked milestones for current level
   */
  getUnlockedMilestones(currentLevel: number): LevelMilestone[] {
    return LEVEL_MILESTONES.filter(
      (milestone) => currentLevel >= milestone.level
    );
  }

  /**
   * Get next milestone to unlock
   */
  getNextMilestone(currentLevel: number): LevelMilestone | null {
    const nextMilestone = LEVEL_MILESTONES.find(
      (milestone) => currentLevel < milestone.level
    );
    return nextMilestone || null;
  }

  /**
   * Format level for display
   */
  formatLevel(level: number): string {
    return `Level ${level}`;
  }

  /**
   * Format XP for display
   */
  formatXP(xp: number): string {
    if (xp >= 1000) {
      return `${(xp / 1000).toFixed(1)}K XP`;
    }
    return `${xp} XP`;
  }

  /**
   * Clear cached level data (useful for debugging)
   */
  async clearCache(pubkey: string): Promise<void> {
    const cacheKey = `${CACHE_KEY_PREFIX}${pubkey}`;
    await AsyncStorage.removeItem(cacheKey);
    console.log('[WorkoutLevel] Cache cleared');
  }
}

export default WorkoutLevelService.getInstance();
