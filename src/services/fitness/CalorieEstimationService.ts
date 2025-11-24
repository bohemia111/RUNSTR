/**
 * CalorieEstimationService - Simple calorie estimation for all activity types
 * Uses default values when user profile unavailable (privacy-preserving)
 * All calculations happen on-device
 */

// Default assumptions for average adult (used when no user profile)
const DEFAULT_WEIGHT_KG = 70; // 154 lbs
const DEFAULT_HEIGHT_CM = 170; // 5'7"
const DEFAULT_AGE = 30;

// Meal calorie lookup table (no user data needed)
const MEAL_CALORIES = {
  breakfast: { small: 350, medium: 550, large: 750, xl: 950 },
  lunch: { small: 400, medium: 650, large: 900, xl: 1150 },
  dinner: { small: 450, medium: 700, large: 950, xl: 1200 },
  snack: { small: 150, medium: 250, large: 400, xl: 550 },
};

export type MealSize = 'small' | 'medium' | 'large' | 'xl';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export class CalorieEstimationService {
  private static instance: CalorieEstimationService;

  private constructor() {}

  static getInstance(): CalorieEstimationService {
    if (!CalorieEstimationService.instance) {
      CalorieEstimationService.instance = new CalorieEstimationService();
    }
    return CalorieEstimationService.instance;
  }

  /**
   * Estimate calories for strength training
   * Volume-based formula: accounts for weight × reps (total work performed)
   * Formula: (total_volume × conversion_factor) + (duration × base_rate)
   */
  estimateStrengthCalories(
    reps: number,
    sets: number,
    durationSeconds: number,
    userWeight?: number,
    averageExerciseWeight?: number
  ): number {
    const bodyWeight = userWeight || DEFAULT_WEIGHT_KG;
    const bodyWeightLbs = bodyWeight * 2.20462; // Convert kg to lbs
    const durationMinutes = durationSeconds / 60;

    // For bodyweight exercises (no weight specified), use user's body weight
    const weightUsed = averageExerciseWeight || bodyWeightLbs;

    // Calculate total volume (total pounds moved)
    const totalVolume = reps * weightUsed;

    // Volume-based calorie calculation
    // Research: ~0.002-0.003 calories per pound moved through typical ROM
    // Using 0.0025 as middle ground (generous for user motivation)
    const volumeCalories = totalVolume * 0.0025;

    // Add time component for rest periods and metabolic overhead
    // 3 cal/min accounts for elevated heart rate between sets
    const timeCalories = durationMinutes * 3;

    return Math.round(volumeCalories + timeCalories);
  }

  /**
   * Estimate calories for meditation/breathwork
   * Uses resting metabolic rate (RMR)
   */
  estimateMeditationCalories(
    durationSeconds: number,
    userWeight?: number
  ): number {
    const weight = userWeight || DEFAULT_WEIGHT_KG;
    const durationMinutes = durationSeconds / 60;

    // RMR: ~1 calorie per minute for average person at rest
    // Scale by weight
    const rmrPerMinute = 1 * (weight / DEFAULT_WEIGHT_KG);

    return Math.round(durationMinutes * rmrPerMinute);
  }

  /**
   * Estimate calories for meals based on size and type
   * No user data needed - uses lookup table
   */
  estimateMealCalories(mealSize: MealSize, mealType: MealType): number {
    return MEAL_CALORIES[mealType][mealSize];
  }

  /**
   * Calculate BMI from weight and height
   * Formula: weight (kg) / (height (m))^2
   */
  calculateBMI(
    weightKg: number,
    heightCm: number
  ): {
    value: number;
    category: string;
  } {
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);

    let category: string;
    if (bmi < 18.5) category = 'Underweight';
    else if (bmi < 25) category = 'Normal';
    else if (bmi < 30) category = 'Overweight';
    else category = 'Obese';

    return { value: bmi, category };
  }

  /**
   * Estimate VO2 max from running performance
   * Uses Cooper 12-minute test formula
   */
  estimateVO2Max(
    distanceMeters: number,
    durationSeconds: number
  ): {
    estimate: number;
    category: string;
  } | null {
    // Convert to 12-minute equivalent distance
    const durationMinutes = durationSeconds / 60;
    if (durationMinutes <= 0) return null;

    const distance12Min = (distanceMeters / durationMinutes) * 12;

    // Cooper formula: VO2 max = (distance in meters - 504.9) / 44.73
    const vo2Max = (distance12Min - 504.9) / 44.73;

    // Categorize (general adult ranges)
    let category: string;
    if (vo2Max < 25) category = 'Poor';
    else if (vo2Max < 35) category = 'Fair';
    else if (vo2Max < 45) category = 'Good';
    else if (vo2Max < 55) category = 'Excellent';
    else category = 'Superior';

    return { estimate: vo2Max, category };
  }

  /**
   * Calculate daily calorie balance from workouts
   * Returns intake (meals) vs output (activity)
   */
  calculateDailyBalance(
    workouts: Array<{
      type: string;
      calories?: number;
      startTime: string;
    }>,
    date: string
  ): {
    caloriesIn: number;
    caloriesOut: number;
    netBalance: number;
  } {
    // Filter workouts for specific date
    const dateWorkouts = workouts.filter((w) => {
      const workoutDate = new Date(w.startTime).toISOString().split('T')[0];
      return workoutDate === date;
    });

    // Sum calories by type
    let caloriesIn = 0; // Meals
    let caloriesOut = 0; // Activities

    for (const workout of dateWorkouts) {
      if (!workout.calories) continue;

      if (workout.type === 'diet') {
        caloriesIn += workout.calories;
      } else if (workout.type === 'fasting') {
        // Fasting doesn't add intake
        continue;
      } else {
        // All other activities burn calories
        caloriesOut += workout.calories;
      }
    }

    return {
      caloriesIn,
      caloriesOut,
      netBalance: caloriesIn - caloriesOut,
    };
  }

  /**
   * Calculate weekly calorie trends
   * Returns 7-day data for graphing
   */
  calculateWeeklyTrends(
    workouts: Array<{
      type: string;
      calories?: number;
      startTime: string;
    }>
  ): Array<{
    date: string;
    caloriesIn: number;
    caloriesOut: number;
    netBalance: number;
  }> {
    const trends: Array<{
      date: string;
      caloriesIn: number;
      caloriesOut: number;
      netBalance: number;
    }> = [];

    // Get last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const balance = this.calculateDailyBalance(workouts, dateStr);
      trends.push({
        date: dateStr,
        ...balance,
      });
    }

    return trends;
  }
}

export default CalorieEstimationService.getInstance();
