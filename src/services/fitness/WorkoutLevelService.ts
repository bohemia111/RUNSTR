/**
 * Workout Level Service
 * Universal XP system for ALL workout types
 *
 * XP Formula:
 * - Base: 100 XP per qualifying workout
 * - Duration bonus: 10 XP per 10 minutes
 * - Distance bonus: 10 XP per km (cardio only: running, walking, cycling, hiking)
 * - Streak bonus: Up to +100 XP for 30-day streaks
 *
 * Minimum thresholds: 5 minutes duration OR 0.5km distance (cardio)
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
  MIN_DURATION_SECONDS,
  MIN_DISTANCE_METERS,
  CARDIO_ACTIVITIES,
  STREAK_BONUSES,
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
   * Check if a workout type is a cardio activity (eligible for distance bonus)
   */
  isCardioActivity(workoutType: string): boolean {
    const normalizedType = workoutType.toLowerCase();
    return CARDIO_ACTIVITIES.includes(normalizedType);
  }

  /**
   * Check if a workout meets the minimum threshold for XP
   * Requires: 5+ minutes duration OR 0.5+ km distance (for cardio)
   */
  meetsMinimumThreshold(
    durationSeconds: number,
    distanceMeters: number,
    isCardio: boolean
  ): boolean {
    // Duration threshold: 5 minutes
    if (durationSeconds >= MIN_DURATION_SECONDS) {
      return true;
    }

    // Distance threshold (cardio only): 0.5 km
    if (isCardio && distanceMeters >= MIN_DISTANCE_METERS) {
      return true;
    }

    return false;
  }

  /**
   * Calculate XP from a single workout using universal formula
   *
   * Formula:
   * - Base: 100 XP per qualifying workout
   * - Duration bonus: 10 XP per 10 minutes
   * - Distance bonus: 10 XP per km (cardio only)
   *
   * Note: Streak bonus is calculated separately in calculateLevelStats
   */
  calculateWorkoutXP(workout: LocalWorkout): XPCalculation {
    const workoutType = workout.type?.toLowerCase() || '';
    const distance = workout.distance || 0;
    const duration = workout.duration || 0;
    const isCardio = this.isCardioActivity(workoutType);

    // Check if meets minimum threshold
    if (!this.meetsMinimumThreshold(duration, distance, isCardio)) {
      return {
        distanceXP: 0,
        totalXP: 0,
        qualifyingDistance: 0,
      };
    }

    // Base XP for every qualifying workout
    let totalXP = XP_CONSTANTS.BASE_XP_PER_WORKOUT;

    // Duration bonus: 10 XP per 10 minutes
    const durationMinutes = duration / 60;
    const durationBonus = Math.floor(
      (durationMinutes / 10) * XP_CONSTANTS.DURATION_XP_PER_10_MIN
    );
    totalXP += durationBonus;

    // Distance bonus (cardio only): 10 XP per km
    let distanceXP = 0;
    if (isCardio && distance > 0) {
      const distanceKm = distance / 1000;
      distanceXP = Math.floor(distanceKm * XP_CONSTANTS.DISTANCE_XP_PER_KM);
      totalXP += distanceXP;
    }

    return {
      distanceXP,
      totalXP,
      qualifyingDistance: isCardio ? distance : 0,
    };
  }

  /**
   * Calculate streak bonus based on consecutive workout days
   */
  calculateStreakBonus(streakDays: number): number {
    for (const { days, bonus } of STREAK_BONUSES) {
      if (streakDays >= days) {
        return bonus;
      }
    }
    return 0;
  }

  /**
   * Calculate current workout streak from workouts
   * Returns the number of consecutive days with at least one workout
   */
  calculateStreak(workouts: LocalWorkout[]): number {
    if (workouts.length === 0) return 0;

    // Sort workouts by date (newest first)
    const sortedWorkouts = [...workouts].sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    // Get unique workout dates
    const workoutDates = new Set<string>();
    sortedWorkouts.forEach((workout) => {
      const date = new Date(workout.startTime).toISOString().split('T')[0];
      workoutDates.add(date);
    });

    const sortedDates = Array.from(workoutDates).sort().reverse();

    if (sortedDates.length === 0) return 0;

    // Check if most recent workout is today or yesterday
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split('T')[0];
    const mostRecentDate = sortedDates[0];

    if (mostRecentDate !== today && mostRecentDate !== yesterday) {
      return 0; // Streak broken
    }

    // Count consecutive days
    let streak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const currentDate = new Date(sortedDates[i - 1]);
      const prevDate = new Date(sortedDates[i]);
      const diffDays = Math.floor(
        (currentDate.getTime() - prevDate.getTime()) / 86400000
      );

      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
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
   * Includes streak bonus calculation for current streak
   */
  calculateLevelStats(workouts: LocalWorkout[]): LevelStats {
    let totalDistance = 0;
    let qualifyingDistance = 0;
    let qualifyingWorkouts = 0;
    let totalXP = 0;

    // Calculate base XP from workouts
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

    // Calculate current streak and add streak bonus per qualifying workout
    const currentStreak = this.calculateStreak(workouts);
    const streakBonus = this.calculateStreakBonus(currentStreak);
    totalXP += streakBonus * qualifyingWorkouts;

    const level = this.calculateLevel(totalXP);

    return {
      totalWorkouts: workouts.length,
      qualifyingWorkouts,
      totalDistance,
      qualifyingDistance,
      level,
      currentStreak,
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
