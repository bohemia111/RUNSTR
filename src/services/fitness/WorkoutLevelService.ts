/**
 * Workout Level Service
 * Distance-based XP system with exponential level scaling
 * XP earned: 10 XP per km for qualifying workouts (walking >= 1km, running >= 2km, cycling >= 3km)
 * Level scaling: Each level requires 15% more XP than the previous
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  WorkoutLevel,
  XPCalculation,
  LevelStats,
  LevelMilestone,
} from '../../types/workoutLevel';
import {
  XP_CONSTANTS,
  LEVEL_MILESTONES,
  DISTANCE_THRESHOLDS,
} from '../../types/workoutLevel';

const CACHE_KEY_PREFIX = '@runstr:workout_level:';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedLevelData {
  stats: LevelStats;
  timestamp: number;
}

// Workout interface for local workouts
interface LocalWorkout {
  id: string;
  type: string;
  distance?: number; // in meters
  duration?: number;
  startTime: string;
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
   * Check if a workout type is eligible for XP
   */
  isEligibleActivity(workoutType: string): boolean {
    const normalizedType = workoutType.toLowerCase();
    return ['walking', 'running', 'cycling'].includes(normalizedType);
  }

  /**
   * Check if a workout meets the minimum distance threshold for its type
   */
  meetsDistanceThreshold(workoutType: string, distanceMeters: number): boolean {
    const normalizedType = workoutType.toLowerCase();
    const threshold = DISTANCE_THRESHOLDS[normalizedType];

    if (!threshold) {
      return false;
    }

    return distanceMeters >= threshold;
  }

  /**
   * Calculate XP from a single workout based on distance
   * Only awards XP if workout meets minimum distance threshold
   */
  calculateWorkoutXP(workout: LocalWorkout): XPCalculation {
    const workoutType = workout.type?.toLowerCase() || '';
    const distance = workout.distance || 0;

    // Check if eligible activity type
    if (!this.isEligibleActivity(workoutType)) {
      return {
        distanceXP: 0,
        totalXP: 0,
        qualifyingDistance: 0,
      };
    }

    // Check if meets minimum distance threshold
    if (!this.meetsDistanceThreshold(workoutType, distance)) {
      return {
        distanceXP: 0,
        totalXP: 0,
        qualifyingDistance: 0,
      };
    }

    // Calculate XP: 10 XP per kilometer
    const distanceKm = distance / 1000;
    const distanceXP = Math.floor(distanceKm * XP_CONSTANTS.XP_PER_KM);

    return {
      distanceXP,
      totalXP: distanceXP,
      qualifyingDistance: distance,
    };
  }

  /**
   * Get the XP required to complete a specific level (not cumulative)
   * Uses exponential scaling: base * 1.15^(level-1)
   */
  getXPForLevel(level: number): number {
    if (level <= 0) return 0;
    return Math.floor(
      XP_CONSTANTS.LEVEL_SCALING_BASE *
        Math.pow(XP_CONSTANTS.LEVEL_SCALING_FACTOR, level - 1)
    );
  }

  /**
   * Get the total XP required to reach a level from 0
   * Sum of all XP requirements from level 1 to target level
   */
  getTotalXPForLevel(level: number): number {
    if (level <= 0) return 0;

    let total = 0;
    for (let i = 1; i <= level; i++) {
      total += this.getXPForLevel(i);
    }
    return total;
  }

  /**
   * Get the current milestone title for a level
   */
  getMilestoneTitle(level: number): string {
    // Find the highest milestone that the user has reached
    const unlockedMilestones = LEVEL_MILESTONES.filter(
      (m) => level >= m.level
    ).sort((a, b) => b.level - a.level);

    return unlockedMilestones.length > 0
      ? unlockedMilestones[0].title
      : 'Beginner';
  }

  /**
   * Calculate level from total XP using exponential scaling
   */
  calculateLevel(totalXP: number): WorkoutLevel {
    let level = 0;
    let xpUsed = 0;

    // Find the level by summing up XP requirements
    while (xpUsed + this.getXPForLevel(level + 1) <= totalXP) {
      level++;
      xpUsed += this.getXPForLevel(level);
    }

    const currentXP = totalXP - xpUsed;
    const xpForNextLevel = this.getXPForLevel(level + 1);
    const progress = xpForNextLevel > 0 ? currentXP / xpForNextLevel : 0;
    const title = this.getMilestoneTitle(level);

    return {
      level,
      currentXP,
      xpForNextLevel,
      totalXP,
      progress: Math.min(progress, 1), // Cap at 1
      title,
    };
  }

  /**
   * Calculate complete level stats from local workout array
   */
  calculateLevelStats(workouts: LocalWorkout[]): LevelStats {
    let totalDistance = 0;
    let qualifyingDistance = 0;
    let qualifyingWorkouts = 0;
    let totalXP = 0;

    workouts.forEach((workout) => {
      const distance = workout.distance || 0;
      totalDistance += distance;

      const xpCalc = this.calculateWorkoutXP(workout);
      if (xpCalc.totalXP > 0) {
        qualifyingWorkouts++;
        qualifyingDistance += xpCalc.qualifyingDistance;
        totalXP += xpCalc.totalXP;
      }
    });

    const level = this.calculateLevel(totalXP);

    return {
      totalWorkouts: workouts.length,
      qualifyingWorkouts,
      totalDistance,
      qualifyingDistance,
      level,
    };
  }

  /**
   * Get level stats with caching (for performance)
   */
  async getLevelStats(
    pubkey: string,
    workouts: LocalWorkout[],
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
              `[WorkoutLevel] Cache hit: Level ${
                cachedData.stats.level.level
              } "${cachedData.stats.level.title}" (age: ${Math.floor(
                age / 1000
              )}s)`
            );
            return cachedData.stats;
          }
        }
      } catch (error) {
        console.warn('[WorkoutLevel] Cache read error:', error);
      }
    }

    // Calculate fresh stats
    console.log(
      `[WorkoutLevel] Calculating stats from ${workouts.length} workouts...`
    );
    const stats = this.calculateLevelStats(workouts);

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
   * Format XP for display with K suffix for large numbers
   */
  formatXP(xp: number): string {
    if (xp >= 10000) {
      return `${(xp / 1000).toFixed(1)}K`;
    }
    if (xp >= 1000) {
      return xp.toLocaleString();
    }
    return `${xp}`;
  }

  /**
   * Clear cached level data
   */
  async clearCache(pubkey: string): Promise<void> {
    const cacheKey = `${CACHE_KEY_PREFIX}${pubkey}`;
    await AsyncStorage.removeItem(cacheKey);
    console.log('[WorkoutLevel] Cache cleared');
  }
}

export default WorkoutLevelService.getInstance();
