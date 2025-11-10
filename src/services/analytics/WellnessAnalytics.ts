/**
 * Wellness Analytics Service
 * Analyzes meditation and wellness workout data for consistency, duration, and patterns
 * All calculations happen locally on-device
 */

import type { LocalWorkout } from '../fitness/LocalWorkoutStorageService';
import type {
  WellnessMetrics,
  ConsistencyData,
  SessionDurationData,
  MeditationTypePreferences,
  TimeOfDayPattern,
  CorrelationData,
} from '../../types/analytics';

export class WellnessAnalytics {
  /**
   * Calculate all wellness metrics from workout data
   */
  static calculateMetrics(workouts: LocalWorkout[]): WellnessMetrics | null {
    const wellnessWorkouts = this.filterWellnessWorkouts(workouts);

    if (wellnessWorkouts.length === 0) {
      return null;
    }

    return {
      meditationConsistency: this.calculateConsistency(wellnessWorkouts),
      sessionDuration: this.calculateSessionDuration(wellnessWorkouts),
      typePreferences: this.calculateTypePreferences(wellnessWorkouts),
      timeOfDayPatterns: this.calculateTimeOfDayPatterns(wellnessWorkouts),
      recoveryCorrelation: this.calculateRecoveryCorrelation(
        workouts,
        wellnessWorkouts
      ),
    };
  }

  /**
   * Filter workouts to only meditation/wellness activities
   */
  private static filterWellnessWorkouts(
    workouts: LocalWorkout[]
  ): LocalWorkout[] {
    return workouts
      .filter(
        (w) =>
          w.type === 'meditation' || w.type === 'wellness'
      )
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
  }

  /**
   * Calculate meditation consistency metrics
   */
  private static calculateConsistency(
    workouts: LocalWorkout[]
  ): ConsistencyData {
    if (workouts.length === 0) {
      return {
        currentMonth: 0,
        frequency: 0,
        streak: 0,
        longestStreak: 0,
        trend: 'stable',
      };
    }

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Current month sessions
    const currentMonthWorkouts = workouts.filter(
      (w) => new Date(w.startTime) >= currentMonthStart
    );

    // Calculate frequency (percentage of days with meditation)
    const daysInMonth = now.getDate(); // Days elapsed in current month
    const uniqueDays = new Set(
      currentMonthWorkouts.map(
        (w) => new Date(w.startTime).toISOString().split('T')[0]
      )
    );
    const frequency = (uniqueDays.size / daysInMonth) * 100;

    // Calculate current streak
    const streak = this.calculateCurrentStreak(workouts);

    // Calculate longest streak
    const longestStreak = this.calculateLongestStreak(workouts);

    // Calculate trend (compare last 30 days vs previous 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recent30Days = workouts.filter((w) => {
      const date = new Date(w.startTime);
      return date >= thirtyDaysAgo && date <= now;
    }).length;

    const previous30Days = workouts.filter((w) => {
      const date = new Date(w.startTime);
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    }).length;

    const change =
      previous30Days > 0
        ? ((recent30Days - previous30Days) / previous30Days) * 100
        : 0;

    const trend: ConsistencyData['trend'] =
      change > 10 ? 'improving' : change < -10 ? 'declining' : 'stable';

    return {
      currentMonth: currentMonthWorkouts.length,
      frequency: Math.round(frequency),
      streak,
      longestStreak,
      trend,
    };
  }

  /**
   * Calculate current meditation streak (consecutive days)
   */
  private static calculateCurrentStreak(workouts: LocalWorkout[]): number {
    if (workouts.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentStreak = 0;
    let checkDate = new Date(today);

    // Get unique days with meditation
    const meditationDays = new Set(
      workouts.map((w) => {
        const date = new Date(w.startTime);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      })
    );

    // Count backwards from today
    while (true) {
      if (meditationDays.has(checkDate.getTime())) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // Allow one day gap if today has no meditation yet
        if (currentStreak === 0 && checkDate.getTime() === today.getTime()) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
        break;
      }
    }

    return currentStreak;
  }

  /**
   * Calculate longest meditation streak ever
   */
  private static calculateLongestStreak(workouts: LocalWorkout[]): number {
    if (workouts.length === 0) return 0;

    // Get unique days sorted
    const meditationDays = Array.from(
      new Set(
        workouts.map((w) => {
          const date = new Date(w.startTime);
          date.setHours(0, 0, 0, 0);
          return date.getTime();
        })
      )
    ).sort((a, b) => a - b);

    let longestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < meditationDays.length; i++) {
      const daysDiff =
        (meditationDays[i] - meditationDays[i - 1]) / (24 * 60 * 60 * 1000);

      if (daysDiff === 1) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return longestStreak;
  }

  /**
   * Calculate session duration trends
   */
  private static calculateSessionDuration(
    workouts: LocalWorkout[]
  ): SessionDurationData {
    if (workouts.length === 0) {
      return {
        avgDuration: 0,
        trend: 'stable',
        weeklyAvgs: [],
      };
    }

    // Calculate average duration (in seconds)
    const totalDuration = workouts.reduce((sum, w) => sum + w.duration, 0);
    const avgDuration = totalDuration / workouts.length;

    // Calculate weekly averages for last 8 weeks
    const weeklyAvgs = this.calculateWeeklyAverages(workouts, 8);

    // Calculate trend (compare recent 4 weeks vs previous 4 weeks)
    const recentAvg =
      weeklyAvgs.slice(-4).reduce((sum, w) => sum + w.avgDuration, 0) / 4;
    const previousAvg =
      weeklyAvgs.slice(-8, -4).reduce((sum, w) => sum + w.avgDuration, 0) / 4;

    const change =
      previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;

    const trend: SessionDurationData['trend'] =
      change > 10 ? 'increasing' : change < -10 ? 'decreasing' : 'stable';

    return {
      avgDuration: Math.round(avgDuration),
      trend,
      weeklyAvgs,
    };
  }

  /**
   * Calculate weekly average durations
   */
  private static calculateWeeklyAverages(
    workouts: LocalWorkout[],
    weeks: number
  ): Array<{ week: string; avgDuration: number }> {
    const result: Array<{ week: string; avgDuration: number }> = [];
    const now = new Date();

    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = new Date(
        now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000
      );
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);

      const weekWorkouts = workouts.filter((w) => {
        const date = new Date(w.startTime);
        return date >= weekStart && date < weekEnd;
      });

      const avgDuration =
        weekWorkouts.length > 0
          ? weekWorkouts.reduce((sum, w) => sum + w.duration, 0) /
            weekWorkouts.length
          : 0;

      result.push({
        week: this.formatWeek(weekStart),
        avgDuration: Math.round(avgDuration),
      });
    }

    return result;
  }

  /**
   * Calculate meditation type preferences
   * Prioritizes dedicated meditationType field over note parsing
   */
  private static calculateTypePreferences(
    workouts: LocalWorkout[]
  ): MeditationTypePreferences {
    const typeCounts = {
      guided: 0,
      unguided: 0,
      breathwork: 0,
      bodyScan: 0,
      lovingKindness: 0,
    };

    workouts.forEach((w) => {
      // Check for dedicated meditationType field first (preferred)
      if (w.meditationType) {
        switch (w.meditationType) {
          case 'guided':
            typeCounts.guided++;
            break;
          case 'unguided':
            typeCounts.unguided++;
            break;
          case 'breathwork':
            typeCounts.breathwork++;
            break;
          case 'body_scan':
            typeCounts.bodyScan++;
            break;
          case 'gratitude':
            typeCounts.lovingKindness++; // Map gratitude to loving kindness
            break;
        }
        return;
      }

      // Fallback: Parse meditation type from notes
      const notes = (w.notes || '').toLowerCase();

      if (notes.includes('guided')) {
        typeCounts.guided++;
      } else if (notes.includes('unguided') || notes.includes('silent')) {
        typeCounts.unguided++;
      } else if (notes.includes('breath') || notes.includes('pranayama')) {
        typeCounts.breathwork++;
      } else if (notes.includes('body scan') || notes.includes('body-scan')) {
        typeCounts.bodyScan++;
      } else if (notes.includes('loving kindness') || notes.includes('metta')) {
        typeCounts.lovingKindness++;
      } else {
        // Default to unguided if no type specified
        typeCounts.unguided++;
      }
    });

    const total = Object.values(typeCounts).reduce((sum, val) => sum + val, 0);

    if (total === 0) {
      return {
        guided: 0,
        unguided: 0,
        breathwork: 0,
        bodyScan: 0,
        lovingKindness: 0,
        favorite: 'unguided',
      };
    }

    // Calculate percentages
    const percentages = {
      guided: (typeCounts.guided / total) * 100,
      unguided: (typeCounts.unguided / total) * 100,
      breathwork: (typeCounts.breathwork / total) * 100,
      bodyScan: (typeCounts.bodyScan / total) * 100,
      lovingKindness: (typeCounts.lovingKindness / total) * 100,
    };

    // Find favorite type
    const favorite = Object.entries(typeCounts).reduce(
      (max, [type, count]) => (count > max.count ? { type, count } : max),
      { type: 'unguided', count: 0 }
    ).type;

    return {
      ...percentages,
      favorite,
    };
  }

  /**
   * Calculate time-of-day patterns for meditation
   */
  private static calculateTimeOfDayPatterns(
    workouts: LocalWorkout[]
  ): TimeOfDayPattern[] {
    const patterns: Record<string, { count: number; totalDuration: number }> = {
      '5am-8am': { count: 0, totalDuration: 0 },
      '8am-12pm': { count: 0, totalDuration: 0 },
      '12pm-5pm': { count: 0, totalDuration: 0 },
      '5pm-9pm': { count: 0, totalDuration: 0 },
      '9pm-12am': { count: 0, totalDuration: 0 },
    };

    workouts.forEach((w) => {
      const hour = new Date(w.startTime).getHours();
      let timeRange: string;

      if (hour >= 5 && hour < 8) {
        timeRange = '5am-8am';
      } else if (hour >= 8 && hour < 12) {
        timeRange = '8am-12pm';
      } else if (hour >= 12 && hour < 17) {
        timeRange = '12pm-5pm';
      } else if (hour >= 17 && hour < 21) {
        timeRange = '5pm-9pm';
      } else {
        timeRange = '9pm-12am';
      }

      patterns[timeRange].count++;
      patterns[timeRange].totalDuration += w.duration;
    });

    return Object.entries(patterns)
      .map(([timeRange, data]) => ({
        timeRange,
        count: data.count,
        avgDuration:
          data.count > 0 ? Math.round(data.totalDuration / data.count) : 0,
      }))
      .filter((p) => p.count > 0) // Only include time ranges with sessions
      .sort((a, b) => b.count - a.count); // Sort by most frequent first
  }

  /**
   * Calculate correlation between meditation and workout recovery
   */
  private static calculateRecoveryCorrelation(
    allWorkouts: LocalWorkout[],
    meditationWorkouts: LocalWorkout[]
  ): CorrelationData | undefined {
    // Need at least 10 meditation sessions and 10 workouts for meaningful correlation
    const cardioWorkouts = allWorkouts.filter((w) =>
      ['running', 'cycling', 'walking', 'hiking'].includes(w.type)
    );

    if (meditationWorkouts.length < 10 || cardioWorkouts.length < 10) {
      return undefined;
    }

    // For each cardio workout, check if meditation happened within 24 hours before
    const workoutsWithMeditation: Array<{
      hadMeditation: boolean;
      performance: number;
    }> = [];

    cardioWorkouts.forEach((workout) => {
      const workoutTime = new Date(workout.startTime).getTime();
      const twentyFourHoursBefore = workoutTime - 24 * 60 * 60 * 1000;

      // Check if meditation happened in 24h before workout
      const hadMeditation = meditationWorkouts.some((med) => {
        const medTime = new Date(med.startTime).getTime();
        return medTime >= twentyFourHoursBefore && medTime < workoutTime;
      });

      // Use pace as performance metric (lower is better, so invert)
      // Note: distance stored in meters, divide by 1000 for km
      const pace =
        workout.distance && workout.duration > 0
          ? workout.duration / 60 / (workout.distance / 1000) // min/km
          : 0;

      if (pace > 0) {
        workoutsWithMeditation.push({
          hadMeditation,
          performance: 1 / pace, // Invert so higher is better
        });
      }
    });

    if (workoutsWithMeditation.length < 10) {
      return undefined;
    }

    // Calculate average performance for workouts with and without meditation
    const withMed = workoutsWithMeditation.filter((w) => w.hadMeditation);
    const withoutMed = workoutsWithMeditation.filter((w) => !w.hadMeditation);

    if (withMed.length < 5 || withoutMed.length < 5) {
      return undefined;
    }

    const avgWithMed =
      withMed.reduce((sum, w) => sum + w.performance, 0) / withMed.length;
    const avgWithoutMed =
      withoutMed.reduce((sum, w) => sum + w.performance, 0) / withoutMed.length;

    // Simple correlation: positive if meditation improves performance
    const percentDiff = ((avgWithMed - avgWithoutMed) / avgWithoutMed) * 100;

    let coefficient: number;
    let strength: CorrelationData['strength'];
    let direction: CorrelationData['direction'];
    let insight: string;

    if (Math.abs(percentDiff) < 2) {
      coefficient = 0;
      strength = 'none';
      direction = 'none';
      insight =
        'No significant correlation between meditation and next-day workout performance';
    } else if (Math.abs(percentDiff) < 5) {
      coefficient = percentDiff > 0 ? 0.3 : -0.3;
      strength = 'weak';
      direction = percentDiff > 0 ? 'positive' : 'negative';
      insight =
        percentDiff > 0
          ? 'Slight improvement in workout performance after meditation'
          : 'Slight decrease in workout performance after meditation';
    } else if (Math.abs(percentDiff) < 10) {
      coefficient = percentDiff > 0 ? 0.6 : -0.6;
      strength = 'moderate';
      direction = percentDiff > 0 ? 'positive' : 'negative';
      insight =
        percentDiff > 0
          ? 'Meditation appears to moderately improve next-day workout performance'
          : 'Meditation appears to moderately decrease next-day workout performance';
    } else {
      coefficient = percentDiff > 0 ? 0.8 : -0.8;
      strength = 'strong';
      direction = percentDiff > 0 ? 'positive' : 'negative';
      insight =
        percentDiff > 0
          ? 'Strong correlation: Meditation significantly improves next-day workout performance'
          : 'Strong correlation: Meditation significantly decreases next-day workout performance';
    }

    return {
      coefficient,
      strength,
      direction,
      insight,
    };
  }

  /**
   * Format week for display
   */
  private static formatWeek(date: Date): string {
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  }
}
