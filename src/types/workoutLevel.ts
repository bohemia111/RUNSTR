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
  qualifyingWorkouts: number; // Workouts that met distance threshold
  totalDistance: number; // in meters (all workouts)
  qualifyingDistance: number; // in meters (only threshold-meeting workouts)
  level: WorkoutLevel;
}

export interface LevelMilestone {
  level: number;
  title: string;
  description: string;
  icon: string; // Ionicons name
  unlockedAt?: Date;
}

// Distance thresholds - minimum distance to earn XP (in meters)
export const DISTANCE_THRESHOLDS: Record<string, number> = {
  walking: 1000, // 1 km
  running: 2000, // 2 km
  cycling: 3000, // 3 km
};

// XP Constants for distance-based system with exponential scaling
export const XP_CONSTANTS = {
  XP_PER_KM: 10, // 10 XP per kilometer
  LEVEL_SCALING_BASE: 100, // Base XP for level 1
  LEVEL_SCALING_FACTOR: 1.15, // Each level needs 15% more XP
} as const;

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
