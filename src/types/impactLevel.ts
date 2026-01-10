/**
 * Impact Level System Type Definitions
 * Donation-based XP system that rewards consistent daily giving
 */

export interface ImpactLevel {
  level: number;
  currentXP: number; // XP progress within current level
  xpForNextLevel: number; // XP needed to reach next level
  totalXP: number; // Lifetime XP earned
  progress: number; // 0-1 for UI progress bar
  title: string; // Current milestone title (e.g., "Champion")
}

export interface ImpactStats {
  totalDonations: number; // Count of donations
  totalSatsDonated: number; // Total sats donated
  charitiesSupported: number; // Unique charities
  currentStreak: number; // Consecutive donation days
  weeklyDonationDays: boolean[]; // Mon-Sun donation activity
  level: ImpactLevel;
}

export interface ImpactMilestone {
  level: number;
  title: string;
  description: string;
  icon: string; // Ionicons name
}

// XP Constants for Impact Level System
export const IMPACT_XP_CONSTANTS = {
  // Base XP per sat donated (1:1 ratio - simple and memorable!)
  XP_PER_SAT: 1.0,
  // Level scaling
  LEVEL_SCALING_BASE: 100, // Base XP for level 1
  LEVEL_SCALING_FACTOR: 1.15, // Each level needs 15% more XP
} as const;

// Streak multipliers - the key differentiator!
// Daily donations earn more XP than sporadic giving
export const DONATION_STREAK_MULTIPLIERS: { days: number; multiplier: number }[] = [
  { days: 30, multiplier: 3.0 },
  { days: 14, multiplier: 2.5 },
  { days: 7, multiplier: 2.0 },
  { days: 3, multiplier: 1.5 },
  { days: 1, multiplier: 1.0 },
];

// Impact Level milestones with donation-themed titles
export const IMPACT_MILESTONES: ImpactMilestone[] = [
  {
    level: 1,
    title: 'Impact Starter',
    description: 'Beginning your giving journey',
    icon: 'heart-outline',
  },
  {
    level: 5,
    title: 'Supporter',
    description: 'Building habits of generosity',
    icon: 'hand-left-outline',
  },
  {
    level: 10,
    title: 'Contributor',
    description: 'Making a real difference',
    icon: 'gift-outline',
  },
  {
    level: 20,
    title: 'Champion',
    description: 'Consistent community impact',
    icon: 'trophy-outline',
  },
  {
    level: 50,
    title: 'Legend',
    description: 'Inspiring others to give',
    icon: 'star-outline',
  },
  {
    level: 100,
    title: 'Philanthropist',
    description: 'Legendary generosity',
    icon: 'diamond-outline',
  },
];
