/**
 * Personal Records Service
 * Calculates lifetime achievement records across all workout types
 * Used by the Achievements card in Advanced Analytics
 */

import type { LocalWorkout } from '../fitness/LocalWorkoutStorageService';

export interface CardioPR {
  fastest5K?: { time: number; date: string; workout: LocalWorkout };
  fastest10K?: { time: number; date: string; workout: LocalWorkout };
  fastestHalfMarathon?: { time: number; date: string; workout: LocalWorkout };
  fastestMarathon?: { time: number; date: string; workout: LocalWorkout };
  longestStreak: number; // consecutive days
}

export interface StrengthPR {
  maxWeight?: { weight: number; date: string; workout: LocalWorkout };
  bestWeightRepCombo?: {
    weight: number;
    reps: number;
    score: number;
    date: string;
    workout: LocalWorkout;
  };
  longestStreak: number;
}

export interface WellnessPR {
  longestStreak: number; // consecutive meditation/yoga days
}

export interface DietPR {
  longestMealStreak: number; // consecutive days logging meals
  maxFastingHours?: {
    hours: number;
    date: string;
    workout: LocalWorkout;
  };
}

export interface AllPersonalRecords {
  cardio: CardioPR;
  strength: StrengthPR;
  wellness: WellnessPR;
  diet: DietPR;
}

export class PersonalRecordsService {
  /**
   * Get all personal records across all categories
   */
  static getAllPRs(workouts: LocalWorkout[]): AllPersonalRecords {
    return {
      cardio: this.getCardioPRs(workouts),
      strength: this.getStrengthPRs(workouts),
      wellness: this.getWellnessPRs(workouts),
      diet: this.getDietPRs(workouts),
    };
  }

  /**
   * Calculate cardio personal records
   * - Fastest 5K/10K/Half/Marathon
   * - Longest consecutive streak
   */
  static getCardioPRs(workouts: LocalWorkout[]): CardioPR {
    const cardioWorkouts = workouts.filter((w) =>
      [
        'running',
        'walking',
        'cycling',
        'hiking',
        'swimming',
        'rowing',
      ].includes(w.type.toLowerCase())
    );

    const pr: CardioPR = {
      longestStreak: this.calculateStreak(cardioWorkouts),
    };

    // Find fastest times for standard distances
    // 5K = 5000m, 10K = 10000m, Half = 21097.5m, Marathon = 42195m
    const distanceTargets = [
      { key: 'fastest5K' as const, distance: 5000, tolerance: 100 },
      { key: 'fastest10K' as const, distance: 10000, tolerance: 200 },
      {
        key: 'fastestHalfMarathon' as const,
        distance: 21097.5,
        tolerance: 500,
      },
      { key: 'fastestMarathon' as const, distance: 42195, tolerance: 1000 },
    ];

    for (const target of distanceTargets) {
      const matchingWorkouts = cardioWorkouts.filter(
        (w) =>
          w.distance &&
          Math.abs(w.distance - target.distance) <= target.tolerance
      );

      if (matchingWorkouts.length > 0) {
        // Find fastest (minimum duration)
        const fastest = matchingWorkouts.reduce((best, current) =>
          current.duration < best.duration ? current : best
        );

        pr[target.key] = {
          time: fastest.duration,
          date: fastest.startTime,
          workout: fastest,
        };
      }
    }

    return pr;
  }

  /**
   * Calculate strength personal records
   * - Max single weight lifted
   * - Best weight×rep combination
   * - Longest consecutive streak
   */
  static getStrengthPRs(workouts: LocalWorkout[]): StrengthPR {
    const strengthWorkouts = workouts.filter(
      (w) => w.type.toLowerCase() === 'strength'
    );

    const pr: StrengthPR = {
      longestStreak: this.calculateStreak(strengthWorkouts),
    };

    // Find max single weight
    const workoutsWithWeight = strengthWorkouts.filter(
      (w) => w.weight && w.weight > 0
    );

    if (workoutsWithWeight.length > 0) {
      const maxWeightWorkout = workoutsWithWeight.reduce((best, current) =>
        (current.weight || 0) > (best.weight || 0) ? current : best
      );

      pr.maxWeight = {
        weight: maxWeightWorkout.weight!,
        date: maxWeightWorkout.startTime,
        workout: maxWeightWorkout,
      };
    }

    // Find best weight×reps combination
    const workoutsWithWeightAndReps = strengthWorkouts.filter(
      (w) => w.weight && w.weight > 0 && w.reps && w.reps > 0
    );

    if (workoutsWithWeightAndReps.length > 0) {
      const bestCombo = workoutsWithWeightAndReps.reduce((best, current) => {
        const currentScore = (current.weight || 0) * (current.reps || 0);
        const bestScore = (best.weight || 0) * (best.reps || 0);
        return currentScore > bestScore ? current : best;
      });

      pr.bestWeightRepCombo = {
        weight: bestCombo.weight!,
        reps: bestCombo.reps!,
        score: bestCombo.weight! * bestCombo.reps!,
        date: bestCombo.startTime,
        workout: bestCombo,
      };
    }

    return pr;
  }

  /**
   * Calculate wellness personal records
   * - Longest meditation/yoga streak
   */
  static getWellnessPRs(workouts: LocalWorkout[]): WellnessPR {
    const wellnessWorkouts = workouts.filter((w) =>
      ['meditation', 'yoga'].includes(w.type.toLowerCase())
    );

    return {
      longestStreak: this.calculateStreak(wellnessWorkouts),
    };
  }

  /**
   * Calculate diet personal records
   * - Longest meal logging streak
   * - Maximum fasting duration
   */
  static getDietPRs(workouts: LocalWorkout[]): DietPR {
    const dietWorkouts = workouts.filter((w) =>
      ['diet', 'fasting'].includes(w.type.toLowerCase())
    );

    // Meal logging streak
    const mealWorkouts = workouts.filter(
      (w) => w.type.toLowerCase() === 'diet' && w.mealType
    );

    // Max fasting duration
    const fastingWorkouts = workouts.filter(
      (w) => w.type.toLowerCase() === 'fasting' && w.fastingDuration
    );

    const pr: DietPR = {
      longestMealStreak: this.calculateStreak(mealWorkouts),
    };

    if (fastingWorkouts.length > 0) {
      const maxFastingWorkout = fastingWorkouts.reduce((best, current) =>
        (current.fastingDuration || 0) > (best.fastingDuration || 0)
          ? current
          : best
      );

      pr.maxFastingHours = {
        hours: (maxFastingWorkout.fastingDuration || 0) / 3600, // Convert seconds to hours
        date: maxFastingWorkout.startTime,
        workout: maxFastingWorkout,
      };
    }

    return pr;
  }

  /**
   * Calculate longest consecutive day streak for a set of workouts
   * Uses same algorithm as StreakAnalyticsService
   */
  private static calculateStreak(workouts: LocalWorkout[]): number {
    if (workouts.length === 0) return 0;

    // Get unique dates (YYYY-MM-DD)
    const workoutDates = new Set(
      workouts.map((w) => new Date(w.startTime).toLocaleDateString('en-CA'))
    );

    const sortedDates = Array.from(workoutDates).sort();

    // Calculate best streak (all-time longest)
    let bestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);

      // Check if consecutive days
      const diffMs = currDate.getTime() - prevDate.getTime();
      const diffDays = diffMs / (24 * 60 * 60 * 1000);

      if (diffDays === 1) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return bestStreak;
  }

  /**
   * Format duration in seconds to MM:SS or HH:MM:SS
   */
  static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }

    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format date for display
   */
  static formatDate(isoDate: string): string {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
