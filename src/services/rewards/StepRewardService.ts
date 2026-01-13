/**
 * StepRewardService - Automated step milestone rewards
 *
 * REWARD FLOW (v2 - Server-Side):
 * 1. App polls steps periodically while active
 * 2. For each 1,000 step milestone crossed, check if already rewarded locally
 * 3. Call Supabase claim-reward function (handles eligibility + payment)
 * 4. Server enforces 50 sat daily cap and pays via NWC
 * 5. Show toast notification for each reward
 *
 * ARCHITECTURE (v2):
 * - NWC credentials stored SERVER-SIDE in Supabase env vars
 * - Daily 50 sat cap enforced SERVER-SIDE by Lightning address hash
 * - Local milestone tracking for UI only (server is source of truth)
 *
 * SILENT FAILURE: If payment fails, milestone is NOT marked as rewarded
 * so it will retry on next poll
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RewardLightningAddressService } from './RewardLightningAddressService';
import { ProfileService } from '../user/profileService';
import Toast from 'react-native-toast-message';
import { REWARD_CONFIG } from '../../config/rewards';
import { supabase } from '../../utils/supabase';

// Step reward configuration
const STEP_CONFIG = {
  SATS_PER_MILESTONE: 5,        // 5 sats per 1k steps
  MILESTONE_INCREMENT: 1000,    // Every 1,000 steps
  MAX_DAILY_SATS: 50,           // Server-enforced cap (10 milestones max)
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
   * Call Supabase claim-reward edge function for step rewards
   * Server handles: eligibility check (50 sat cap), LNURL invoice, NWC payment
   */
  private async claimStepRewardViaSupabase(
    lightningAddress: string,
    amountSats: number
  ): Promise<{
    success: boolean;
    amount_paid?: number;
    reason?: string;
    remaining_step_allowance?: number;
  }> {
    try {
      if (!supabase) {
        console.error('[StepReward] Supabase not configured');
        return { success: false, reason: 'supabase_not_configured' };
      }

      console.log(`[StepReward] Calling claim-reward: steps ${amountSats} sats`);

      const { data, error } = await supabase.functions.invoke('claim-reward', {
        body: {
          lightning_address: lightningAddress,
          reward_type: 'steps',
          amount_sats: amountSats,
        },
      });

      if (error) {
        console.error('[StepReward] Supabase function error:', error);
        return { success: false, reason: 'supabase_error' };
      }

      console.log('[StepReward] claim-reward response:', data);
      return data;
    } catch (error) {
      console.error('[StepReward] Error calling claim-reward:', error);
      return { success: false, reason: 'network_error' };
    }
  }

  /**
   * Pay a milestone reward via Supabase
   * Server handles invoice request and NWC payment with 50 sat daily cap
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

      // Call Supabase to handle payment (server enforces 50 sat cap)
      console.log(`[StepReward] Claiming ${amount} sats for milestone ${milestone}`);
      const result = await this.claimStepRewardViaSupabase(lightningAddress, amount);

      if (result.success) {
        const amountPaid = result.amount_paid || amount;
        console.log(`[StepReward] ✅ Milestone ${milestone} paid: ${amountPaid} sats to user`);
        return { milestone, amount: amountPaid, success: true };
      }

      // Check if daily cap reached
      if (result.reason === 'daily_cap_reached') {
        console.log('[StepReward] Daily step cap reached (50 sats)');
        return {
          milestone,
          amount: 0,
          success: false,
          error: 'Daily cap reached',
        };
      }

      return {
        milestone,
        amount,
        success: false,
        error: result.reason || 'Payment failed',
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

      // Process each new milestone (stop if daily cap reached)
      let totalEarned = 0;
      let dailyCapReached = false;

      for (const milestone of newMilestones) {
        // Skip remaining milestones if cap reached
        if (dailyCapReached) {
          console.log(`[StepReward] Skipping milestone ${milestone} - daily cap reached`);
          break;
        }

        const result = await this.payMilestoneReward(userPubkey, milestone);
        rewards.push(result);

        if (result.success) {
          // Mark as rewarded ONLY on success
          await this.markMilestoneRewarded(userPubkey, milestone);
          totalEarned += result.amount;

          // Show toast for successful reward
          this.showRewardToast(milestone, result.amount);
        } else if (result.error === 'Daily cap reached') {
          // Server said cap reached, stop processing
          dailyCapReached = true;
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

  /**
   * Get max daily sats from step rewards
   */
  getMaxDailySats(): number {
    return STEP_CONFIG.MAX_DAILY_SATS;
  }
}

// Export singleton instance
export const StepRewardService = StepRewardServiceClass.getInstance();
export default StepRewardService;
