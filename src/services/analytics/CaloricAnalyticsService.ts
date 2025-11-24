/**
 * Caloric Analytics Service
 * Tracks daily/weekly/monthly calorie intake and burn
 * Calculates surplus/deficit for weight management insights
 * All calculations happen locally using workout calorie data
 */

import type { LocalWorkout } from '../fitness/LocalWorkoutStorageService';

export interface DailyCalorieBalance {
  date: string; // YYYY-MM-DD
  caloriesIn: number; // From diet/meals
  caloriesOut: number; // From activities
  netBalance: number; // In - Out (positive = surplus, negative = deficit)
}

export interface WeeklyCalorieTrend {
  weekLabel: string; // e.g., "Jan 22"
  avgDailyIn: number;
  avgDailyOut: number;
  avgDailyNet: number;
  totalIn: number;
  totalOut: number;
  totalNet: number;
}

export interface MonthlyCalorieSummary {
  monthLabel: string; // e.g., "January 2025"
  avgDailyIn: number;
  avgDailyOut: number;
  avgDailyNet: number;
  totalIn: number;
  totalOut: number;
  totalNet: number;
  daysTracked: number;
}

export interface CaloricMetrics {
  today: DailyCalorieBalance;
  last7Days: DailyCalorieBalance[];
  last30Days: DailyCalorieBalance[];
  weeklyTrends: WeeklyCalorieTrend[];
  monthlySummary: MonthlyCalorieSummary;
  estimatedBMR?: number; // Basal Metabolic Rate (optional with health profile)
}

export class CaloricAnalyticsService {
  /**
   * Calculate all caloric analytics from workouts
   */
  static calculateMetrics(
    workouts: LocalWorkout[],
    healthProfile?: {
      weight?: number;
      height?: number;
      age?: number;
      biologicalSex?: 'male' | 'female';
    }
  ): CaloricMetrics | null {
    if (workouts.length === 0) {
      console.log('ℹ️ No workouts - caloric analytics unavailable');
      return null;
    }

    // Calculate daily balances for last 30 days
    const last30Days = this.calculateLast30Days(workouts);
    const last7Days = last30Days.slice(-7);
    const today =
      last7Days[last7Days.length - 1] ||
      this.getEmptyDayBalance(new Date().toISOString().split('T')[0]);

    // Calculate weekly trends (last 4 weeks)
    const weeklyTrends = this.calculateWeeklyTrends(workouts, 4);

    // Calculate monthly summary (current month)
    const monthlySummary = this.calculateMonthlySummary(workouts);

    // Estimate BMR if health profile available
    const estimatedBMR = healthProfile
      ? this.estimateBMR(healthProfile)
      : undefined;

    return {
      today,
      last7Days,
      last30Days,
      weeklyTrends,
      monthlySummary,
      estimatedBMR,
    };
  }

  /**
   * Calculate daily calorie balance for last N days
   */
  private static calculateLast30Days(
    workouts: LocalWorkout[]
  ): DailyCalorieBalance[] {
    const balances: DailyCalorieBalance[] = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-CA');

      const dayBalance = this.calculateDailyBalance(workouts, dateStr);
      balances.push(dayBalance);
    }

    return balances;
  }

  /**
   * Calculate calorie balance for a specific date
   */
  static calculateDailyBalance(
    workouts: LocalWorkout[],
    date: string // YYYY-MM-DD
  ): DailyCalorieBalance {
    // Filter workouts for this date using local timezone
    const dayWorkouts = workouts.filter((w) => {
      const workoutDate = new Date(w.startTime).toLocaleDateString('en-CA');
      return workoutDate === date;
    });

    let caloriesIn = 0;
    let caloriesOut = 0;

    for (const workout of dayWorkouts) {
      // Validate calorie data exists and is a positive number
      if (
        !workout.calories ||
        workout.calories < 0 ||
        isNaN(workout.calories)
      ) {
        continue;
      }

      if (workout.type === 'diet') {
        // Meals add calories
        caloriesIn += Math.abs(workout.calories);
      } else if (workout.type === 'fasting') {
        // Fasting doesn't add intake (already 0)
        continue;
      } else {
        // All other activities burn calories
        caloriesOut += Math.abs(workout.calories);
      }
    }

    return {
      date,
      caloriesIn,
      caloriesOut,
      netBalance: caloriesIn - caloriesOut,
    };
  }

  /**
   * Calculate weekly calorie trends
   */
  private static calculateWeeklyTrends(
    workouts: LocalWorkout[],
    numWeeks: number
  ): WeeklyCalorieTrend[] {
    const trends: WeeklyCalorieTrend[] = [];
    const now = new Date();

    for (let i = numWeeks - 1; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);

      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - i * 7);

      const weekWorkouts = workouts.filter((w) => {
        const workoutDate = new Date(w.startTime);
        return workoutDate >= weekStart && workoutDate < weekEnd;
      });

      let totalIn = 0;
      let totalOut = 0;

      for (const workout of weekWorkouts) {
        if (!workout.calories) continue;

        if (workout.type === 'diet') {
          totalIn += workout.calories;
        } else if (workout.type !== 'fasting') {
          totalOut += workout.calories;
        }
      }

      const totalNet = totalIn - totalOut;
      const daysInWeek = 7;

      trends.push({
        weekLabel: this.formatWeekLabel(weekStart),
        avgDailyIn: Math.round(totalIn / daysInWeek),
        avgDailyOut: Math.round(totalOut / daysInWeek),
        avgDailyNet: Math.round(totalNet / daysInWeek),
        totalIn,
        totalOut,
        totalNet,
      });
    }

    return trends;
  }

  /**
   * Calculate monthly calorie summary (current month)
   */
  private static calculateMonthlySummary(
    workouts: LocalWorkout[]
  ): MonthlyCalorieSummary {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthWorkouts = workouts.filter((w) => {
      const workoutDate = new Date(w.startTime);
      return workoutDate >= monthStart && workoutDate <= monthEnd;
    });

    let totalIn = 0;
    let totalOut = 0;

    // Track which days have data
    const daysWithData = new Set<string>();

    for (const workout of monthWorkouts) {
      if (!workout.calories) continue;

      const workoutDate = workout.startTime.split('T')[0];
      daysWithData.add(workoutDate);

      if (workout.type === 'diet') {
        totalIn += workout.calories;
      } else if (workout.type !== 'fasting') {
        totalOut += workout.calories;
      }
    }

    const totalNet = totalIn - totalOut;
    const daysTracked = daysWithData.size || 1; // Avoid division by zero

    return {
      monthLabel: this.formatMonthLabel(monthStart),
      avgDailyIn: Math.round(totalIn / daysTracked),
      avgDailyOut: Math.round(totalOut / daysTracked),
      avgDailyNet: Math.round(totalNet / daysTracked),
      totalIn,
      totalOut,
      totalNet,
      daysTracked,
    };
  }

  /**
   * Estimate Basal Metabolic Rate (BMR)
   * Uses Mifflin-St Jeor equation
   */
  private static estimateBMR(healthProfile: {
    weight?: number;
    height?: number;
    age?: number;
    biologicalSex?: 'male' | 'female';
  }): number | undefined {
    if (!healthProfile.weight || !healthProfile.height || !healthProfile.age) {
      return undefined;
    }

    const { weight, height, age, biologicalSex } = healthProfile;

    // Mifflin-St Jeor equation
    // Men: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age + 5
    // Women: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age - 161

    const baseBMR = 10 * weight + 6.25 * height - 5 * age;
    const bmr = biologicalSex === 'female' ? baseBMR - 161 : baseBMR + 5;

    return Math.round(bmr);
  }

  /**
   * Get empty day balance (no workouts)
   */
  private static getEmptyDayBalance(date: string): DailyCalorieBalance {
    return {
      date,
      caloriesIn: 0,
      caloriesOut: 0,
      netBalance: 0,
    };
  }

  /**
   * Format week label for display
   */
  private static formatWeekLabel(date: Date): string {
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  }

  /**
   * Format month label for display
   */
  private static formatMonthLabel(date: Date): string {
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  /**
   * Calculate weekly average (for simple display)
   * Uses same date-based logic as calculateDailyBalance for timezone consistency
   */
  static calculateWeeklyAverage(workouts: LocalWorkout[]): {
    in: number;
    out: number;
    net: number;
    daysWithData: number;
  } {
    const now = new Date();
    const last7Days: DailyCalorieBalance[] = [];

    // Calculate balance for each of the last 7 days (including today)
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-CA');
      const dayBalance = this.calculateDailyBalance(workouts, dateStr);
      last7Days.push(dayBalance);
    }

    // Count days with any calorie data
    const daysWithData = last7Days.filter(
      (day) => day.caloriesIn > 0 || day.caloriesOut > 0
    ).length;

    // Sum totals across all 7 days
    const totalIn = last7Days.reduce((sum, day) => sum + day.caloriesIn, 0);
    const totalOut = last7Days.reduce((sum, day) => sum + day.caloriesOut, 0);

    return {
      in: Math.round(totalIn / 7),
      out: Math.round(totalOut / 7),
      net: Math.round((totalIn - totalOut) / 7),
      daysWithData,
    };
  }
}
