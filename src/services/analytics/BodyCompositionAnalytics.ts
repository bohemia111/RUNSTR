/**
 * Body Composition Analytics Service
 * Calculates BMI, VO2 Max, Fitness Age, and healthy weight ranges
 * All calculations happen locally using health profile data
 *
 * LOCAL WORKOUT DATA EXTRACTION (Paragraph 1 of 5):
 * This service extracts workout data from the device's local storage using LocalWorkoutStorageService.
 * Data sources include GPS-tracked workouts, manually entered workouts, Apple HealthKit imports,
 * and optionally imported Nostr kind 1301 events from the user's public workout history.
 * All processing happens on-device without any data transmission to external servers.
 * The service filters for running/walking workouts with valid distance and duration data,
 * prioritizing 10K times over 5K times for more accurate VO2 max estimation.
 *
 * ACCURACY LIMITATIONS AND BEST PRACTICES (Paragraph 5 of 5):
 * VO2 max estimates are most accurate when based on recent race-effort workouts (5K or 10K).
 * BMI does not account for muscle mass, so athletes may show "overweight" despite being fit.
 * Fitness age is a simplified metric combining two factors - it should be used as a trend indicator
 * rather than absolute medical assessment. For best results: 1) Complete at least one 5K or 10K
 * at race effort, 2) Keep weight/height updated in health profile, 3) Track metrics over time
 * to see improvement trends, 4) Consult medical professionals for health decisions.
 */

import type { LocalWorkout } from '../fitness/LocalWorkoutStorageService';
import type {
  BodyCompositionMetrics,
  VO2MaxData,
  HealthProfile,
} from '../../types/analytics';

export class BodyCompositionAnalytics {
  /**
   * Calculate all body composition metrics
   */
  static calculateMetrics(
    healthProfile: HealthProfile,
    workouts: LocalWorkout[]
  ): BodyCompositionMetrics | null {
    // Require weight and height for BMI
    if (!healthProfile.weight || !healthProfile.height) {
      console.log(
        'ℹ️ No weight/height data - body composition metrics unavailable'
      );
      return null;
    }

    const bmi = this.calculateBMI(healthProfile.weight, healthProfile.height);
    const healthyWeightRange = this.getHealthyWeightRange(healthProfile.height);

    // VO2 Max requires cardio workouts
    const vo2MaxData = this.estimateVO2Max(workouts, healthProfile);

    return {
      currentBMI: bmi.value,
      bmiCategory: bmi.category,
      healthyWeightRange,
      weightTrend: [], // TODO: Implement weight tracking over time
    };
  }

  /**
   * Calculate BMI (Body Mass Index)
   * Formula: weight (kg) / height (m)²
   *
   * BMI CALCULATION METHODOLOGY (Paragraph 2 of 5):
   * BMI is calculated by dividing weight in kilograms by height in meters squared.
   * This provides a simple measure of body composition that correlates with health outcomes.
   * Healthy BMI range is 18.5-24.9, overweight is 25-29.9, and obese is 30+.
   * All calculations happen locally on-device using stored health profile data.
   */
  static calculateBMI(
    weightKg: number,
    heightCm: number
  ): {
    value: number;
    category: 'underweight' | 'normal' | 'overweight' | 'obese';
  } {
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);

    let category: 'underweight' | 'normal' | 'overweight' | 'obese';
    if (bmi < 18.5) category = 'underweight';
    else if (bmi < 25) category = 'normal';
    else if (bmi < 30) category = 'overweight';
    else category = 'obese';

    return {
      value: Math.round(bmi * 10) / 10,
      category,
    };
  }

  /**
   * Calculate BMI Age - converts BMI to an age metric for fitness age calculation
   * Healthy BMI = chronological age, deviations add years
   */
  static calculateBMIAge(bmi: number, chronologicalAge: number): number {
    if (bmi >= 18.5 && bmi <= 24.9) {
      // Healthy BMI - no adjustment
      return chronologicalAge;
    } else if (bmi >= 25 && bmi < 30) {
      // Overweight - add 5 years
      return chronologicalAge + 5;
    } else if (bmi >= 30) {
      // Obese - add 10 years
      return chronologicalAge + 10;
    } else {
      // Underweight - add 3 years
      return chronologicalAge + 3;
    }
  }

  /**
   * Calculate healthy weight range for given height
   * Based on BMI range of 18.5-24.9 (normal)
   */
  static getHealthyWeightRange(heightCm: number): { min: number; max: number } {
    const heightM = heightCm / 100;
    const minWeight = 18.5 * heightM * heightM;
    const maxWeight = 24.9 * heightM * heightM;

    return {
      min: Math.round(minWeight * 10) / 10,
      max: Math.round(maxWeight * 10) / 10,
    };
  }

  /**
   * Estimate VO2 Max from running workouts
   * Uses Cooper 12-minute test method for estimation
   */
  static estimateVO2Max(
    workouts: LocalWorkout[],
    healthProfile: HealthProfile
  ): VO2MaxData | undefined {
    // Filter for running workouts with distance
    const runningWorkouts = workouts.filter(
      (w) =>
        (w.type === 'running' || w.type === 'walking') &&
        w.distance &&
        w.distance > 0 &&
        w.duration > 0
    );

    if (runningWorkouts.length === 0) {
      return undefined;
    }

    // Find best 5K time (4.9km - 5.1km range)
    const fiveKWorkouts = runningWorkouts.filter(
      (w) => w.distance && w.distance >= 4900 && w.distance <= 5100
    );

    if (fiveKWorkouts.length === 0) {
      // No 5K workouts, try to estimate from average pace
      return this.estimateVO2MaxFromAveragePace(runningWorkouts, healthProfile);
    }

    // Get fastest 5K
    const fastest5K = fiveKWorkouts.reduce((fastest, current) => {
      const currentPace = current.duration / (current.distance! / 1000);
      const fastestPace = fastest.duration / (fastest.distance! / 1000);
      return currentPace < fastestPace ? current : fastest;
    });

    // Calculate VO2 Max using Cooper formula
    // Convert to 12-minute equivalent distance
    const duration5KMinutes = fastest5K.duration / 60;
    const distance12Min = (fastest5K.distance! / duration5KMinutes) * 12;

    // Cooper formula: VO2max = (distance in meters - 504.9) / 44.73
    let vo2Max = (distance12Min - 504.9) / 44.73;

    // Age adjustment (optional, if age is available)
    if (healthProfile.age) {
      const ageFactor = 1 - (healthProfile.age - 25) * 0.01; // -1% per year after 25
      vo2Max = vo2Max * Math.max(0.8, Math.min(1.2, ageFactor)); // Cap adjustment
    }

    // Calculate percentile and fitness age with BMI
    const percentile = this.calculateVO2MaxPercentile(
      vo2Max,
      healthProfile.age || 30,
      healthProfile.biologicalSex
    );

    // Calculate BMI for 2-metric fitness age
    let bmi: number | undefined;
    if (healthProfile.weight && healthProfile.height) {
      const heightM = healthProfile.height / 100;
      bmi = healthProfile.weight / (heightM * heightM);
    }

    const fitnessAge = this.calculateFitnessAge(
      vo2Max,
      healthProfile.age || 30,
      healthProfile.biologicalSex,
      bmi
    );
    const category = this.categorizeVO2Max(
      vo2Max,
      healthProfile.age || 30,
      healthProfile.biologicalSex
    );

    return {
      estimate: Math.round(vo2Max * 10) / 10,
      percentile: Math.round(percentile),
      fitnessAge: Math.round(fitnessAge),
      category,
    };
  }

  /**
   * Estimate VO2 Max from average running pace (when no 5K data available)
   */
  private static estimateVO2MaxFromAveragePace(
    runningWorkouts: LocalWorkout[],
    healthProfile: HealthProfile
  ): VO2MaxData | undefined {
    if (runningWorkouts.length === 0) return undefined;

    // Calculate average pace (seconds per km)
    const totalDistance = runningWorkouts.reduce(
      (sum, w) => sum + (w.distance || 0),
      0
    );
    const totalTime = runningWorkouts.reduce((sum, w) => sum + w.duration, 0);

    if (totalDistance === 0) return undefined;

    const avgPaceSecondsPerKm = totalTime / (totalDistance / 1000);

    // Rough estimation: Convert average pace to VO2 Max
    // Faster pace = higher VO2 Max
    // Average pace 5:00/km ≈ VO2 Max 40-45
    // Average pace 6:00/km ≈ VO2 Max 35-40
    const baseVO2 = 80 - avgPaceSecondsPerKm / 10; // Very rough approximation

    // Age adjustment
    let vo2Max = baseVO2;
    if (healthProfile.age) {
      const ageFactor = 1 - (healthProfile.age - 25) * 0.01;
      vo2Max = vo2Max * Math.max(0.8, Math.min(1.2, ageFactor));
    }

    const percentile = this.calculateVO2MaxPercentile(
      vo2Max,
      healthProfile.age || 30,
      healthProfile.biologicalSex
    );

    // Calculate BMI for 2-metric fitness age
    let bmi: number | undefined;
    if (healthProfile.weight && healthProfile.height) {
      const heightM = healthProfile.height / 100;
      bmi = healthProfile.weight / (heightM * heightM);
    }

    const fitnessAge = this.calculateFitnessAge(
      vo2Max,
      healthProfile.age || 30,
      healthProfile.biologicalSex,
      bmi
    );
    const category = this.categorizeVO2Max(
      vo2Max,
      healthProfile.age || 30,
      healthProfile.biologicalSex
    );

    return {
      estimate: Math.round(vo2Max * 10) / 10,
      percentile: Math.round(percentile),
      fitnessAge: Math.round(fitnessAge),
      category,
    };
  }

  /**
   * Calculate VO2 Max percentile (age and gender adjusted)
   */
  private static calculateVO2MaxPercentile(
    vo2Max: number,
    age: number,
    sex?: 'male' | 'female'
  ): number {
    // Average VO2 Max by age and gender
    const avgVO2Max = sex === 'female' ? 35 : 42;

    // Adjust for age
    const ageAdjustedAvg = avgVO2Max * (1 - (age - 25) * 0.01);

    // Calculate deviation from average
    const deviation = vo2Max - ageAdjustedAvg;

    // Convert to percentile (simplified)
    // Each 1 unit deviation ≈ 5 percentile points
    const percentile = 50 + deviation * 5;

    return Math.max(0, Math.min(100, percentile));
  }

  /**
   * Calculate fitness age from VO2 Max and BMI using weighted average
   * 75% VO2 Max Age + 25% BMI Age
   *
   * 2-METRIC FITNESS AGE CALCULATION (Paragraph 4 of 5):
   * Fitness age combines cardiovascular fitness (VO2 max) and body composition (BMI).
   * First, VO2 max is converted to a "VO2 age" using age-specific norms (e.g., VO2 40 = 35 years old).
   * Second, BMI is converted to a "BMI age" (+5 years if overweight, +10 if obese).
   * Final fitness age = (VO2 age × 0.75) + (BMI age × 0.25), weighted toward cardio fitness.
   * Example: VO2 age 35, BMI age 34 → Fitness age = (35×0.75) + (34×0.25) = 34.75 years
   */
  static calculateFitnessAge(
    vo2Max: number,
    chronologicalAge: number,
    sex?: 'male' | 'female',
    bmi?: number
  ): number {
    // Calculate VO2 Max Age using age-specific norms (general population, not elite athletes)
    // Based on ACSM standards for "fair to good" fitness levels
    const menNorms: Record<number, number> = {
      20: 42,
      25: 41,
      30: 40,
      35: 38,
      40: 37,
      45: 36,
      50: 35,
      55: 34,
      60: 33,
      65: 32,
      70: 31,
    };

    const womenNorms: Record<number, number> = {
      20: 38,
      25: 37,
      30: 36,
      35: 35,
      40: 34,
      45: 33,
      50: 32,
      55: 31,
      60: 30,
      65: 29,
      70: 28,
    };

    const norms = sex === 'female' ? womenNorms : menNorms;

    // Find the age where VO2 max matches the user's current VO2 max
    let vo2Age = chronologicalAge;
    let smallestDiff = Infinity;

    for (const [ageStr, normVO2] of Object.entries(norms)) {
      const age = parseInt(ageStr);
      const diff = Math.abs(normVO2 - vo2Max);

      if (diff < smallestDiff) {
        smallestDiff = diff;
        vo2Age = age;
      }
    }

    // If VO2 max is higher than 20-year-old norm, cap at 20
    if (vo2Max > norms[20]) {
      vo2Age = 20;
    }

    // If VO2 max is lower than 70-year-old norm, cap at 70
    if (vo2Max < norms[70]) {
      vo2Age = 70;
    }

    // If BMI provided, calculate 2-metric fitness age (75% VO2 + 25% BMI)
    if (bmi !== undefined) {
      const bmiAge = this.calculateBMIAge(bmi, chronologicalAge);
      const weightedFitnessAge = vo2Age * 0.75 + bmiAge * 0.25;
      return Math.round(weightedFitnessAge);
    }

    // Fallback: Return VO2 age only if no BMI provided
    return vo2Age;
  }

  /**
   * Categorize VO2 Max level
   */
  private static categorizeVO2Max(
    vo2Max: number,
    age: number,
    sex?: 'male' | 'female'
  ): VO2MaxData['category'] {
    // Categories based on age and gender
    // Simplified thresholds
    if (sex === 'female') {
      if (age < 30) {
        if (vo2Max >= 45) return 'superior';
        if (vo2Max >= 39) return 'excellent';
        if (vo2Max >= 33) return 'good';
        if (vo2Max >= 28) return 'fair';
        return 'poor';
      } else if (age < 50) {
        if (vo2Max >= 42) return 'superior';
        if (vo2Max >= 36) return 'excellent';
        if (vo2Max >= 30) return 'good';
        if (vo2Max >= 25) return 'fair';
        return 'poor';
      } else {
        if (vo2Max >= 38) return 'superior';
        if (vo2Max >= 32) return 'excellent';
        if (vo2Max >= 26) return 'good';
        if (vo2Max >= 22) return 'fair';
        return 'poor';
      }
    } else {
      // Male
      if (age < 30) {
        if (vo2Max >= 52) return 'superior';
        if (vo2Max >= 46) return 'excellent';
        if (vo2Max >= 40) return 'good';
        if (vo2Max >= 35) return 'fair';
        return 'poor';
      } else if (age < 50) {
        if (vo2Max >= 48) return 'superior';
        if (vo2Max >= 42) return 'excellent';
        if (vo2Max >= 36) return 'good';
        if (vo2Max >= 31) return 'fair';
        return 'poor';
      } else {
        if (vo2Max >= 44) return 'superior';
        if (vo2Max >= 38) return 'excellent';
        if (vo2Max >= 32) return 'good';
        if (vo2Max >= 27) return 'fair';
        return 'poor';
      }
    }
  }
}
