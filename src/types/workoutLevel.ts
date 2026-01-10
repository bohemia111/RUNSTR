/**
 * Workout Level System Type Definitions
 * Distance-based XP system with exponential level scaling
 */

export interface WorkoutLevel {
  level: number;
  currentXP: number; // XP progress within current level
  xpForNextLevel: number; // XP needed to reach next level
  totalXP: number; // Lifetime XP earned
  progress: number; // 0-1 for UI progress bar
  title: string; // Current milestone title (e.g., "Veteran")
}

export interface XPCalculation {
  distanceXP: number; // XP from distance (10 XP per km)
  totalXP: number;
  qualifyingDistance: number; // Distance that met threshold (meters)
}

export interface LevelStats {
  totalWorkouts: number;
  qualifyingWorkouts: number; // Workouts that met minimum threshold
  totalDistance: number; // in meters (all workouts)
  qualifyingDistance: number; // in meters (only cardio workouts)
  level: WorkoutLevel;
  currentStreak?: number; // Current consecutive workout days
}

export interface LevelMilestone {
  level: number;
  title: string;
  description: string;
  icon: string; // Ionicons name
  unlockedAt?: Date;
}

// Minimum thresholds for qualifying workouts
export const MIN_DURATION_SECONDS = 300; // 5 minutes
export const MIN_DISTANCE_METERS = 500; // 0.5 km (alternative for cardio)

// Cardio activity types (eligible for distance bonus)
export const CARDIO_ACTIVITIES = ['running', 'walking', 'cycling', 'hiking'];

// XP Constants for universal workout system
export const XP_CONSTANTS = {
  // Base XP for every qualifying workout
  BASE_XP_PER_WORKOUT: 100,
  // Duration bonus: XP per 10 minutes
  DURATION_XP_PER_10_MIN: 10,
  // Distance bonus (cardio only): XP per kilometer
  DISTANCE_XP_PER_KM: 10,
  // Level scaling
  LEVEL_SCALING_BASE: 100, // Base XP for level 1
  LEVEL_SCALING_FACTOR: 1.10, // Each level needs 10% more XP (easier progression)
} as const;

// Streak bonus thresholds
export const STREAK_BONUSES: { days: number; bonus: number }[] = [
  { days: 30, bonus: 100 },
  { days: 14, bonus: 75 },
  { days: 7, bonus: 50 },
  { days: 3, bonus: 25 },
];

// Predefined milestones (unlimited levels supported)
export const LEVEL_MILESTONES: LevelMilestone[] = [
  {
    level: 1,
    title: 'Beginner',
    description: 'Just getting started',
    icon: 'walk-outline',
  },
  {
    level: 5,
    title: 'Rookie',
    description: 'Building momentum',
    icon: 'footsteps-outline',
  },
  {
    level: 10,
    title: 'Athlete',
    description: 'Dedicated fitness enthusiast',
    icon: 'fitness-outline',
  },
  {
    level: 20,
    title: 'Veteran',
    description: 'Experienced competitor',
    icon: 'barbell-outline',
  },
  {
    level: 30,
    title: 'Champion',
    description: 'Rising to the top',
    icon: 'trophy-outline',
  },
  {
    level: 50,
    title: 'Legend',
    description: 'Elite performer',
    icon: 'flame-outline',
  },
  {
    level: 75,
    title: 'Master',
    description: 'Peak achievement',
    icon: 'star-outline',
  },
  {
    level: 100,
    title: 'Elite',
    description: 'Top 1% of athletes',
    icon: 'medal-outline',
  },
  {
    level: 150,
    title: 'Grandmaster',
    description: 'Extraordinary dedication',
    icon: 'diamond-outline',
  },
  {
    level: 200,
    title: 'Mythic',
    description: 'Legendary status',
    icon: 'rocket-outline',
  },
];
