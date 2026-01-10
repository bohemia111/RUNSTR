/**
 * Impact Level Service
 * Simple donation-based XP system
 *
 * XP Formula: 1 sat = 1 XP (simple and memorable!)
 * - 21 sat donation = 21 XP
 * - 100 sat donation = 100 XP
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DonationTrackingService, DonationRecord } from '../donation/DonationTrackingService';
import type { ImpactLevel, ImpactStats, ImpactMilestone } from '../../types/impactLevel';
import {
  IMPACT_XP_CONSTANTS,
  DONATION_STREAK_MULTIPLIERS,
  IMPACT_MILESTONES,
} from '../../types/impactLevel';

const CACHE_KEY_PREFIX = '@runstr:impact_level:';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedImpactData {
  stats: ImpactStats;
  timestamp: number;
}

class ImpactLevelServiceClass {
  private static instance: ImpactLevelServiceClass;

  static getInstance(): ImpactLevelServiceClass {
    if (!this.instance) {
      this.instance = new ImpactLevelServiceClass();
    }
    return this.instance;
  }

  /**
   * Get the streak multiplier based on consecutive donation days
   */
  getStreakMultiplier(streakDays: number): number {
    for (const { days, multiplier } of DONATION_STREAK_MULTIPLIERS) {
      if (streakDays >= days) {
        return multiplier;
      }
    }
    return 1.0;
  }

  /**
   * Calculate XP from a donation (1 sat = 1 XP)
   */
  calculateDonationXP(amount: number): number {
    return amount * IMPACT_XP_CONSTANTS.XP_PER_SAT;
  }

  /**
   * Calculate donation streak from donation records
   * Returns consecutive days of donating (at least one donation per day)
   */
  calculateDonationStreak(donations: DonationRecord[]): number {
    if (donations.length === 0) return 0;

    // Get unique donation dates
    const donationDates = new Set<string>();
    donations.forEach((donation) => {
      const date = new Date(donation.timestamp).toISOString().split('T')[0];
      donationDates.add(date);
    });

    const sortedDates = Array.from(donationDates).sort().reverse();
    if (sortedDates.length === 0) return 0;

    // Check if most recent donation is today or yesterday
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
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
   * Get weekly donation activity (Mon-Sun)
   * Returns array of 7 booleans for each day of the current week
   */
  getWeeklyDonationDays(donations: DonationRecord[]): boolean[] {
    // Get start of current ISO week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const mondayStart = new Date(now);
    mondayStart.setHours(0, 0, 0, 0);
    mondayStart.setDate(mondayStart.getDate() - daysFromMonday);

    // Initialize week array (Mon-Sun)
    const weekDays: boolean[] = [false, false, false, false, false, false, false];

    // Check each donation
    donations.forEach((donation) => {
      const donationDate = new Date(donation.timestamp);
      if (donationDate >= mondayStart) {
        const donationDay = donationDate.getDay();
        // Convert to Mon=0, Sun=6
        const weekIndex = donationDay === 0 ? 6 : donationDay - 1;
        if (weekIndex >= 0 && weekIndex < 7) {
          weekDays[weekIndex] = true;
        }
      }
    });

    return weekDays;
  }

  /**
   * Calculate total XP from donation history (1 sat = 1 XP)
   */
  calculateTotalXP(donations: DonationRecord[]): number {
    if (donations.length === 0) return 0;

    // Simple sum: 1 sat = 1 XP
    const totalSats = donations.reduce((sum, d) => sum + d.amount, 0);
    return Math.floor(totalSats * IMPACT_XP_CONSTANTS.XP_PER_SAT);
  }

  /**
   * Get the XP required to complete a specific level (not cumulative)
   * Uses exponential scaling: base * 1.15^(level-1)
   */
  getXPForLevel(level: number): number {
    if (level <= 0) return 0;
    return Math.floor(
      IMPACT_XP_CONSTANTS.LEVEL_SCALING_BASE *
        Math.pow(IMPACT_XP_CONSTANTS.LEVEL_SCALING_FACTOR, level - 1)
    );
  }

  /**
   * Get the total XP required to reach a level from 0
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
    const unlockedMilestones = IMPACT_MILESTONES.filter(
      (m) => level >= m.level
    ).sort((a, b) => b.level - a.level);

    return unlockedMilestones.length > 0
      ? unlockedMilestones[0].title
      : 'Impact Starter';
  }

  /**
   * Calculate level from total XP
   */
  calculateLevel(totalXP: number): ImpactLevel {
    let level = 0;
    let xpUsed = 0;

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
      progress: Math.min(progress, 1),
      title,
    };
  }

  /**
   * Get user's donation history from all charities
   */
  async getUserDonations(pubkey: string): Promise<DonationRecord[]> {
    const allDonations = await DonationTrackingService.getAllCharityDonations();
    return allDonations.filter((d) => d.donorPubkey === pubkey);
  }

  /**
   * Calculate complete impact stats for a user
   */
  async calculateImpactStats(pubkey: string): Promise<ImpactStats> {
    const donations = await this.getUserDonations(pubkey);

    // Get unique charities
    const charityIds = new Set(donations.map((d) => d.charityId));

    // Calculate streak
    const currentStreak = this.calculateDonationStreak(donations);

    // Calculate weekly activity
    const weeklyDonationDays = this.getWeeklyDonationDays(donations);

    // Calculate total XP with streak bonuses
    const totalXP = this.calculateTotalXP(donations);

    // Calculate level from XP
    const level = this.calculateLevel(totalXP);

    // Total sats donated
    const totalSatsDonated = donations.reduce((sum, d) => sum + d.amount, 0);

    return {
      totalDonations: donations.length,
      totalSatsDonated,
      charitiesSupported: charityIds.size,
      currentStreak,
      weeklyDonationDays,
      level,
    };
  }

  /**
   * Get impact stats with caching
   */
  async getImpactStats(pubkey: string, forceRefresh = false): Promise<ImpactStats> {
    const cacheKey = `${CACHE_KEY_PREFIX}${pubkey}`;

    // Check cache first
    if (!forceRefresh) {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const cachedData: CachedImpactData = JSON.parse(cached);
          const age = Date.now() - cachedData.timestamp;

          if (age < CACHE_TTL) {
            console.log(
              `[ImpactLevel] Cache hit: Level ${cachedData.stats.level.level} "${cachedData.stats.level.title}"`
            );
            return cachedData.stats;
          }
        }
      } catch (error) {
        console.warn('[ImpactLevel] Cache read error:', error);
      }
    }

    // Calculate fresh stats
    console.log(`[ImpactLevel] Calculating stats for ${pubkey.slice(0, 12)}...`);
    const stats = await this.calculateImpactStats(pubkey);

    // Cache the results
    try {
      const cacheData: CachedImpactData = {
        stats,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('[ImpactLevel] Cache write error:', error);
    }

    return stats;
  }

  /**
   * Get charity breakdown for user
   */
  async getCharityBreakdown(
    pubkey: string
  ): Promise<Array<{ charityId: string; charityName: string; total: number; count: number }>> {
    const donations = await this.getUserDonations(pubkey);

    const charityMap = new Map<
      string,
      { charityId: string; charityName: string; total: number; count: number }
    >();

    for (const donation of donations) {
      const existing = charityMap.get(donation.charityId);
      if (existing) {
        existing.total += donation.amount;
        existing.count += 1;
      } else {
        charityMap.set(donation.charityId, {
          charityId: donation.charityId,
          charityName: donation.charityName,
          total: donation.amount,
          count: 1,
        });
      }
    }

    return Array.from(charityMap.values()).sort((a, b) => b.total - a.total);
  }

  /**
   * Get unlocked milestones for current level
   */
  getUnlockedMilestones(currentLevel: number): ImpactMilestone[] {
    return IMPACT_MILESTONES.filter((milestone) => currentLevel >= milestone.level);
  }

  /**
   * Get next milestone to unlock
   */
  getNextMilestone(currentLevel: number): ImpactMilestone | null {
    return IMPACT_MILESTONES.find((milestone) => currentLevel < milestone.level) || null;
  }

  /**
   * Format XP for display
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
   * Clear cached impact data
   */
  async clearCache(pubkey: string): Promise<void> {
    const cacheKey = `${CACHE_KEY_PREFIX}${pubkey}`;
    await AsyncStorage.removeItem(cacheKey);
    console.log('[ImpactLevel] Cache cleared');
  }
}

export const ImpactLevelService = ImpactLevelServiceClass.getInstance();
export default ImpactLevelService;
