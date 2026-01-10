/**
 * StepRewardService - Automated step milestone rewards
 *
 * REWARD FLOW:
 * 1. App polls steps periodically while active
 * 2. For each 1,000 step milestone crossed, check if already rewarded today
 * 3. If new milestone, request invoice from user's Lightning address
 * 4. Pay 5 sats per milestone via RewardSenderWallet
 * 5. Show toast notification for each reward
 *
 * STORAGE:
 * - Milestones rewarded today stored per-date to auto-reset at midnight
 * - Weekly totals tracked separately for display
 *
 * SILENT FAILURE: If payment fails, milestone is NOT marked as rewarded
 * so it will retry on next poll
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RewardSenderWallet } from './RewardSenderWallet';
import { RewardLightningAddressService } from './RewardLightningAddressService';
import { ProfileService } from '../user/profileService';
import { getInvoiceFromLightningAddress } from '../../utils/lnurl';
import Toast from 'react-native-toast-message';
import { REWARD_CONFIG } from '../../config/rewards';

// Step reward configuration
const STEP_CONFIG = {
  SATS_PER_MILESTONE: 5,      // 5 sats per 1k steps
  MILESTONE_INCREMENT: 1000,  // Every 1,000 steps
  ENABLED: true,
};

// Storage key patterns
const STORAGE_KEYS = {
  // Array of milestones rewarded today: [1000, 2000, 3000...]
  MILESTONES_TODAY: (pubkey: string, date: string) =>
    `@runstr:step_milestones:${date}:${pubkey}`,
  // Weekly step rewards total
  WEEKLY_REWARDS: (pubkey: string, weekKey: string) =>
    `@runstr:step_rewards_weekly:${pubkey}:${weekKey}`,
  // All-time step rewards total
  TOTAL_REWARDS: (pubkey: string) =>
    `@runstr:step_rewards_total:${pubkey}`,
};

export interface MilestoneReward {
  milestone: number;  // e.g., 5000
  amount: number;     // sats paid
  success: boolean;
  error?: string;
}

export interface StepRewardStats {
  todayMilestones: number[];
  todaySats: number;
  weeklySats: number;
  totalSats: number;
}

/**
 * Get today's date string in YYYY-MM-DD format (local timezone)
 */
function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Get current week key in YYYY-WXX format
 */
function getWeekKey(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

class StepRewardServiceClass {
  private static instance: StepRewardServiceClass;
  private isProcessing: boolean = false;

  private constructor() {
    console.log('[StepReward] Service initialized');
  }

  static getInstance(): StepRewardServiceClass {
    if (!StepRewardServiceClass.instance) {
      StepRewardServiceClass.instance = new StepRewardServiceClass();
    }
    return StepRewardServiceClass.instance;
  }

  /**
   * Check if step rewards are enabled
   */
  isEnabled(): boolean {
    return STEP_CONFIG.ENABLED && (REWARD_CONFIG as any).STEP_REWARDS_ENABLED !== false;
  }

  /**
   * Get milestones already rewarded today
   */
  async getRewardedMilestonesToday(userPubkey: string): Promise<number[]> {
    try {
      const dateKey = getTodayDateString();
      const storageKey = STORAGE_KEYS.MILESTONES_TODAY(userPubkey, dateKey);
      const stored = await AsyncStorage.getItem(storageKey);

      if (!stored) return [];

      const milestones = JSON.parse(stored);
      return Array.isArray(milestones) ? milestones : [];
    } catch (error) {
      console.error('[StepReward] Error getting rewarded milestones:', error);
      return [];
    }
  }

  /**
   * Mark a milestone as rewarded
   */
  private async markMilestoneRewarded(
    userPubkey: string,
    milestone: number
  ): Promise<void> {
    try {
      const dateKey = getTodayDateString();
      const storageKey = STORAGE_KEYS.MILESTONES_TODAY(userPubkey, dateKey);

      const existing = await this.getRewardedMilestonesToday(userPubkey);
      if (!existing.includes(milestone)) {
        existing.push(milestone);
        existing.sort((a, b) => a - b);
        await AsyncStorage.setItem(storageKey, JSON.stringify(existing));
        console.log(`[StepReward] Marked milestone ${milestone} as rewarded`);
      }
    } catch (error) {
      console.error('[StepReward] Error marking milestone:', error);
    }
  }

  /**
   * Get user's Lightning address for rewards
   */
  private async getUserLightningAddress(userPubkey: string): Promise<string | null> {
    try {
      // Priority 1: Settings-stored address
      const settingsAddress = await RewardLightningAddressService.getRewardLightningAddress();
      if (settingsAddress) {
        return settingsAddress;
      }

      // Priority 2: Nostr profile lud16
      const profile = await ProfileService.getUserProfile(userPubkey);
      if (profile?.lud16) {
        return profile.lud16;
      }

      return null;
    } catch (error) {
      console.error('[StepReward] Error getting Lightning address:', error);
      return null;
    }
  }

  /**
   * Request invoice and pay a milestone reward
   */
  private async payMilestoneReward(
    userPubkey: string,
    milestone: number
  ): Promise<MilestoneReward> {
    const amount = STEP_CONFIG.SATS_PER_MILESTONE;

    try {
      // Get user's Lightning address
      const lightningAddress = await this.getUserLightningAddress(userPubkey);
      if (!lightningAddress) {
        console.log('[StepReward] No Lightning address configured');
        return {
          milestone,
          amount,
          success: false,
          error: 'No Lightning address',
        };
      }

      // Request invoice from Lightning address
      console.log(`[StepReward] Requesting invoice for ${amount} sats (milestone ${milestone})`);
      const { invoice } = await getInvoiceFromLightningAddress(
        lightningAddress,
        amount,
        `RUNSTR step reward! ${milestone.toLocaleString()} steps`
      );

      if (!invoice) {
        return {
          milestone,
          amount,
          success: false,
          error: 'Failed to get invoice',
        };
      }

      // Pay the invoice
      const result = await RewardSenderWallet.sendRewardPayment(invoice);

      if (result.success) {
        console.log(`[StepReward] Paid ${amount} sats for milestone ${milestone}`);
        return { milestone, amount, success: true };
      }

      return {
        milestone,
        amount,
        success: false,
        error: result.error || 'Payment failed',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[StepReward] Error paying milestone ${milestone}:`, error);
      return {
        milestone,
        amount,
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Update weekly and total reward counters
   */
  private async updateRewardCounters(
    userPubkey: string,
    satsEarned: number
  ): Promise<void> {
    try {
      const weekKey = getWeekKey();
      const weeklyKey = STORAGE_KEYS.WEEKLY_REWARDS(userPubkey, weekKey);
      const totalKey = STORAGE_KEYS.TOTAL_REWARDS(userPubkey);

      // Update weekly
      const weeklyStr = await AsyncStorage.getItem(weeklyKey);
      const weekly = weeklyStr ? parseInt(weeklyStr) : 0;
      await AsyncStorage.setItem(weeklyKey, String(weekly + satsEarned));

      // Update total
      const totalStr = await AsyncStorage.getItem(totalKey);
      const total = totalStr ? parseInt(totalStr) : 0;
      await AsyncStorage.setItem(totalKey, String(total + satsEarned));

      console.log(`[StepReward] Updated counters: +${satsEarned} sats`);
    } catch (error) {
      console.error('[StepReward] Error updating counters:', error);
    }
  }

  /**
   * Show toast notification for step rewards
   */
  private showRewardToast(milestone: number, amount: number): void {
    Toast.show({
      type: 'stepReward',
      text1: `+${amount} sats!`,
      text2: `${milestone.toLocaleString()} steps reached`,
      position: 'top',
      visibilityTime: 4000,
    });
  }

  /**
   * Main method: Check current steps and reward any new milestones
   * Call this periodically while app is active
   *
   * @param currentSteps - Current step count from DailyStepCounterService
   * @param userPubkey - User's public key
   * @returns Array of milestone rewards (successful and failed)
   */
  async checkAndRewardMilestones(
    currentSteps: number,
    userPubkey: string
  ): Promise<MilestoneReward[]> {
    // Skip if disabled
    if (!this.isEnabled()) {
      return [];
    }

    // Skip if no steps or no user
    if (!currentSteps || currentSteps <= 0 || !userPubkey) {
      return [];
    }

    // Prevent concurrent processing
    if (this.isProcessing) {
      console.log('[StepReward] Already processing, skipping');
      return [];
    }

    this.isProcessing = true;
    const rewards: MilestoneReward[] = [];

    try {
      // Calculate which milestones the user has reached (1000, 2000, 3000...)
      const reachedMilestones: number[] = [];
      for (let m = STEP_CONFIG.MILESTONE_INCREMENT; m <= currentSteps; m += STEP_CONFIG.MILESTONE_INCREMENT) {
        reachedMilestones.push(m);
      }

      if (reachedMilestones.length === 0) {
        return [];
      }

      // Get already rewarded milestones
      const alreadyRewarded = await this.getRewardedMilestonesToday(userPubkey);

      // Find new milestones to reward
      const newMilestones = reachedMilestones.filter(m => !alreadyRewarded.includes(m));

      if (newMilestones.length === 0) {
        return [];
      }

      console.log(`[StepReward] New milestones to reward: ${newMilestones.join(', ')}`);

      // Process each new milestone
      let totalEarned = 0;
      for (const milestone of newMilestones) {
        const result = await this.payMilestoneReward(userPubkey, milestone);
        rewards.push(result);

        if (result.success) {
          // Mark as rewarded ONLY on success
          await this.markMilestoneRewarded(userPubkey, milestone);
          totalEarned += result.amount;

          // Show toast for successful reward
          this.showRewardToast(milestone, result.amount);
        }
      }

      // Update counters if any rewards were paid
      if (totalEarned > 0) {
        await this.updateRewardCounters(userPubkey, totalEarned);
      }

      return rewards;
    } catch (error) {
      console.error('[StepReward] Error in checkAndRewardMilestones:', error);
      return rewards;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get step reward statistics for display
   */
  async getStats(userPubkey: string): Promise<StepRewardStats> {
    try {
      const todayMilestones = await this.getRewardedMilestonesToday(userPubkey);
      const todaySats = todayMilestones.length * STEP_CONFIG.SATS_PER_MILESTONE;

      // Get weekly total
      const weekKey = getWeekKey();
      const weeklyKey = STORAGE_KEYS.WEEKLY_REWARDS(userPubkey, weekKey);
      const weeklyStr = await AsyncStorage.getItem(weeklyKey);
      const weeklySats = weeklyStr ? parseInt(weeklyStr) : 0;

      // Get all-time total
      const totalKey = STORAGE_KEYS.TOTAL_REWARDS(userPubkey);
      const totalStr = await AsyncStorage.getItem(totalKey);
      const totalSats = totalStr ? parseInt(totalStr) : 0;

      return {
        todayMilestones,
        todaySats,
        weeklySats,
        totalSats,
      };
    } catch (error) {
      console.error('[StepReward] Error getting stats:', error);
      return {
        todayMilestones: [],
        todaySats: 0,
        weeklySats: 0,
        totalSats: 0,
      };
    }
  }

  /**
   * Get the next milestone and steps remaining
   */
  getNextMilestone(currentSteps: number): { nextMilestone: number; stepsRemaining: number } {
    const nextMilestone = Math.ceil((currentSteps + 1) / STEP_CONFIG.MILESTONE_INCREMENT) * STEP_CONFIG.MILESTONE_INCREMENT;
    const stepsRemaining = nextMilestone - currentSteps;
    return { nextMilestone, stepsRemaining };
  }

  /**
   * Get reward amount per milestone
   */
  getRewardAmount(): number {
    return STEP_CONFIG.SATS_PER_MILESTONE;
  }

  /**
   * Get milestone increment
   */
  getMilestoneIncrement(): number {
    return STEP_CONFIG.MILESTONE_INCREMENT;
  }
}

// Export singleton instance
export const StepRewardService = StepRewardServiceClass.getInstance();
export default StepRewardService;
