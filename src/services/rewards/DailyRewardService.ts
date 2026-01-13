/**
 * DailyRewardService - Automated workout rewards
 *
 * REWARD FLOW (v2 - Server-Side):
 * 1. User saves qualifying workout locally (≥1km distance)
 * 2. Check eligibility (once per day limit, local check only for UI)
 * 3. Get user's Lightning address (settings first, then profile fallback)
 * 4. Call Supabase claim-reward function (handles eligibility + payment)
 * 5. Server requests invoice via LNURL and pays via NWC
 * 6. User receives 50 sats to their Lightning address
 *
 * ARCHITECTURE (v2):
 * - NWC credentials stored SERVER-SIDE in Supabase env vars
 * - Rate limiting done SERVER-SIDE by Lightning address hash
 * - Client never sees NWC credentials (more secure)
 * - Can rotate NWC credentials without app update
 *
 * SILENT FAILURE: If any step fails, user never sees error
 * Workout publishing always succeeds regardless of reward status
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { REWARD_CONFIG, REWARD_STORAGE_KEYS } from '../../config/rewards';
import { ProfileService } from '../user/profileService';
import { RewardLightningAddressService } from './RewardLightningAddressService';
import { RewardNotificationManager, DonationSplit } from './RewardNotificationManager';
import { getCharityById, Charity } from '../../constants/charities';
import { DonationTrackingService } from '../donation/DonationTrackingService';
import { PledgeService } from '../pledge/PledgeService';
import { supabase } from '../../utils/supabase';

// Storage keys for donation settings
// Uses same key as TeamsScreen - teams ARE charities (with lightning addresses)
const SELECTED_CHARITY_KEY = '@runstr:selected_team_id';
const DONATION_PERCENTAGE_KEY = '@runstr:donation_percentage';

// DEBUG FLAG: Set to false for production (only shows debug alerts for failures)
const DEBUG_REWARDS = false;

// Workout sources that count as "user-generated" (not imports/syncs)
// Only these sources trigger daily rewards
// Note: 'daily_steps' removed - step rewards come from StepRewardService (5 sats per 1k steps)
const REWARD_ELIGIBLE_SOURCES = ['gps_tracker', 'manual_entry'];

// Cardio activity types that qualify for daily rewards
// Only these workout types earn the 50 sats daily reward
// Non-cardio activities (strength, diet, meditation) do NOT earn rewards
const CARDIO_ACTIVITY_TYPES = ['running', 'walking', 'cycling'];

export interface RewardResult {
  success: boolean;
  amount?: number;
  reason?: string;
}

// Diagnostic entry for reward attempts
export interface RewardDiagnosticEntry {
  timestamp: number;
  userPubkey: string;
  action: 'check' | 'send' | 'pledge';
  success: boolean;
  reason?: string;
  amount?: number;
}

// Maximum diagnostic entries to keep
const MAX_REWARD_DIAGNOSTICS = 30;

// Diagnostic buffer for reward attempts (viewable in Settings)
const rewardDiagnosticLog: RewardDiagnosticEntry[] = [];

/**
 * Add a diagnostic entry to the reward log
 */
function addRewardDiagnostic(
  userPubkey: string,
  action: RewardDiagnosticEntry['action'],
  success: boolean,
  reason?: string,
  amount?: number
): void {
  rewardDiagnosticLog.push({
    timestamp: Date.now(),
    userPubkey: userPubkey.slice(0, 8) + '...',
    action,
    success,
    reason,
    amount,
  });

  // Keep only recent entries
  if (rewardDiagnosticLog.length > MAX_REWARD_DIAGNOSTICS) {
    rewardDiagnosticLog.splice(0, rewardDiagnosticLog.length - MAX_REWARD_DIAGNOSTICS);
  }
}

/**
 * Get diagnostics from DailyRewardService
 * Useful for debugging reward issues in Settings
 */
export function getRewardDiagnostics(): {
  rewardAttempts: RewardDiagnosticEntry[];
  serverSidePayments: boolean;
} {
  return {
    rewardAttempts: [...rewardDiagnosticLog],
    serverSidePayments: true, // v2: Payments are handled server-side via Supabase
  };
}

/**
 * Service for managing daily workout rewards
 * Tracks eligibility and sends automated payments
 */
class DailyRewardServiceClass {
  /**
   * Check if user can claim reward today
   * Returns true if user hasn't claimed yet today
   */
  async canClaimToday(userPubkey: string): Promise<boolean> {
    try {
      const lastRewardKey = `${REWARD_STORAGE_KEYS.LAST_REWARD_DATE}:${userPubkey}`;
      const lastRewardStr = await AsyncStorage.getItem(lastRewardKey);

      if (!lastRewardStr) {
        // Never claimed before
        return true;
      }

      const lastRewardDate = new Date(lastRewardStr).toDateString();
      const today = new Date().toDateString();

      // Can claim if last reward was on a different day
      return lastRewardDate !== today;
    } catch (error) {
      console.error('[Reward] Error checking claim eligibility:', error);
      // If error, assume not eligible (safer)
      return false;
    }
  }

  /**
   * Check if workout should trigger streak reward
   * Only user-generated cardio workouts on a new day trigger rewards
   *
   * This method combines source filtering with atomic "streak incremented today" tracking
   * to prevent race conditions when multiple workouts are saved concurrently.
   *
   * @param userPubkey - User's public key
   * @param workoutSource - The workout.source field (e.g., 'gps_tracker', 'imported_nostr')
   * @param workoutType - The workout.type field (e.g., 'running', 'strength')
   */
  async checkStreakAndReward(
    userPubkey: string,
    workoutSource: string,
    workoutType?: string
  ): Promise<RewardResult> {
    // Step 1: Filter by source - only user-generated workouts
    if (!REWARD_ELIGIBLE_SOURCES.includes(workoutSource)) {
      console.log(`[Reward] Skipping reward for ${workoutSource} (not user-generated)`);
      return { success: false, reason: 'source_not_eligible' };
    }

    // Step 1.5: Filter by activity type - only cardio workouts earn rewards
    if (workoutType && !CARDIO_ACTIVITY_TYPES.includes(workoutType)) {
      console.log(`[Reward] Skipping reward for ${workoutType} (not cardio activity)`);
      return { success: false, reason: 'activity_type_not_eligible' };
    }

    // Step 2: Atomic streak check - only first workout of the day PER USER
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const streakKey = `@runstr:streak_incremented_today:${today}:${userPubkey}`;

    // Rate limit: Only one reward per day per user
    const alreadyIncremented = await AsyncStorage.getItem(streakKey);
    if (alreadyIncremented) {
      console.log('[Reward] Streak already incremented today, skipping reward');
      return { success: false, reason: 'streak_already_incremented' };
    }

    // Step 3: Mark streak as incremented BEFORE sending reward (prevents race condition)
    await AsyncStorage.setItem(streakKey, new Date().toISOString());
    console.log('[Reward] Streak incremented! Triggering daily reward...');

    // Step 4: Send the reward
    return this.sendReward(userPubkey);
  }

  /**
   * Get user's Lightning address for rewards
   *
   * PRIORITY ORDER:
   * 1. Settings-stored address (same as embedded in kind 1301 notes)
   * 2. Nostr profile lud16 field (fallback)
   *
   * Lightning addresses allow any app to send Bitcoin to users
   * without requiring them to have NWC wallet setup in our app.
   *
   * @param userPubkey - User's public key (npub or hex)
   * @returns Lightning address if found, null otherwise
   */
  private async getUserLightningAddress(
    userPubkey: string
  ): Promise<string | null> {
    try {
      // PRIORITY 1: Check settings-stored address (same as in 1301 notes)
      const settingsAddress =
        await RewardLightningAddressService.getRewardLightningAddress();
      if (settingsAddress) {
        console.log(
          '[Reward] Using settings Lightning address:',
          settingsAddress
        );
        return settingsAddress;
      }

      // PRIORITY 2: Fallback to Nostr profile lud16
      const profile = await ProfileService.getUserProfile(userPubkey);

      if (!profile || !profile.lud16) {
        console.log('[Reward] User has no Lightning address in profile');
        return null;
      }

      console.log('[Reward] Using profile Lightning address:', profile.lud16);
      return profile.lud16;
    } catch (error) {
      console.error('[Reward] Error getting user Lightning address:', error);
      return null;
    }
  }

  /**
   * Load donation settings from AsyncStorage
   * Returns donation percentage and selected charity
   * Note: Team donations disabled until teams have lightning addresses
   *
   * DEFAULT: 100% donation to ALS Network for new users
   */
  private async getDonationSettings(): Promise<{
    donationPercentage: number;
    charity: Charity | undefined;
  }> {
    try {
      const [donationPctStr, charityId] = await Promise.all([
        AsyncStorage.getItem(DONATION_PERCENTAGE_KEY),
        AsyncStorage.getItem(SELECTED_CHARITY_KEY),
      ]);

      // Default to 100% if never set, otherwise use stored value (even if 0)
      const donationPercentage = donationPctStr !== null ? parseInt(donationPctStr) : 100;
      // Default to ALS Network if no charity selected
      const charity = getCharityById(charityId || 'als-foundation');

      console.log('[Reward] Donation settings:', {
        donationPercentage,
        charityId: charity?.id,
      });

      return { donationPercentage, charity };
    } catch (error) {
      console.error('[Reward] Error loading donation settings:', error);
      // Default to 100% to ALS Network on error
      return { donationPercentage: 100, charity: getCharityById('als-foundation') };
    }
  }

  /**
   * Calculate payment split based on donation percentage
   * All donations go to charity (team donations disabled until teams have lightning addresses)
   */
  private calculateSplit(
    totalAmount: number,
    donationPercentage: number,
    charity: Charity | undefined
  ): DonationSplit {
    if (donationPercentage === 0 || !charity) {
      // No donation or no charity selected - user gets everything
      return {
        userAmount: totalAmount,
        charityAmount: 0,
      };
    }

    const charityAmount = Math.floor(totalAmount * (donationPercentage / 100));
    const userAmount = totalAmount - charityAmount;

    return {
      userAmount,
      charityAmount,
      charityName: charity?.name,
    };
  }

  /**
   * Record that user claimed reward
   * Saves timestamp for eligibility checking and updates weekly total
   */
  private async recordReward(
    userPubkey: string,
    amount: number
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const lastRewardKey = `${REWARD_STORAGE_KEYS.LAST_REWARD_DATE}:${userPubkey}`;
      const totalKey = `${REWARD_STORAGE_KEYS.TOTAL_REWARDS_EARNED}:${userPubkey}`;

      // Save last reward date
      await AsyncStorage.setItem(lastRewardKey, now);

      // Update total rewards earned
      const totalStr = await AsyncStorage.getItem(totalKey);
      const currentTotal = totalStr ? parseInt(totalStr) : 0;
      const newTotal = currentTotal + amount;
      await AsyncStorage.setItem(totalKey, newTotal.toString());

      // Update weekly rewards earned
      await this.addWeeklyReward(userPubkey, amount);

      console.log('[Reward] Recorded reward:', {
        user: userPubkey.slice(0, 8) + '...',
        amount,
        totalEarned: newTotal,
      });
    } catch (error) {
      console.error('[Reward] Error recording reward:', error);
    }
  }

  /**
   * Get total rewards earned by user
   * Returns cumulative amount of all rewards
   */
  async getTotalRewardsEarned(userPubkey: string): Promise<number> {
    try {
      const totalKey = `${REWARD_STORAGE_KEYS.TOTAL_REWARDS_EARNED}:${userPubkey}`;
      const totalStr = await AsyncStorage.getItem(totalKey);
      return totalStr ? parseInt(totalStr) : 0;
    } catch (error) {
      console.error('[Reward] Error getting total rewards:', error);
      return 0;
    }
  }

  /**
   * Get current ISO week number (Mon-Sun)
   */
  private getCurrentWeekNumber(): string {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor(
      (now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
    );
    const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${weekNum}`;
  }

  /**
   * Get weekly rewards earned by user
   * Resets automatically when a new week starts (Monday)
   */
  async getWeeklyRewardsEarned(userPubkey: string): Promise<number> {
    try {
      const weeklyKey = `${REWARD_STORAGE_KEYS.WEEKLY_REWARDS_EARNED}:${userPubkey}`;
      const weekKey = `${REWARD_STORAGE_KEYS.WEEKLY_REWARDS_WEEK}:${userPubkey}`;

      const currentWeek = this.getCurrentWeekNumber();
      const savedWeek = await AsyncStorage.getItem(weekKey);

      // If new week, reset weekly total
      if (savedWeek !== currentWeek) {
        await AsyncStorage.setItem(weekKey, currentWeek);
        await AsyncStorage.setItem(weeklyKey, '0');
        return 0;
      }

      const weeklyStr = await AsyncStorage.getItem(weeklyKey);
      return weeklyStr ? parseInt(weeklyStr) : 0;
    } catch (error) {
      console.error('[Reward] Error getting weekly rewards:', error);
      return 0;
    }
  }

  /**
   * Add to weekly rewards total
   */
  private async addWeeklyReward(
    userPubkey: string,
    amount: number
  ): Promise<void> {
    try {
      const weeklyKey = `${REWARD_STORAGE_KEYS.WEEKLY_REWARDS_EARNED}:${userPubkey}`;
      const weekKey = `${REWARD_STORAGE_KEYS.WEEKLY_REWARDS_WEEK}:${userPubkey}`;
      const currentWeek = this.getCurrentWeekNumber();

      const savedWeek = await AsyncStorage.getItem(weekKey);
      let currentTotal = 0;

      // If same week, get current total
      if (savedWeek === currentWeek) {
        const weeklyStr = await AsyncStorage.getItem(weeklyKey);
        currentTotal = weeklyStr ? parseInt(weeklyStr) : 0;
      } else {
        // New week - save week identifier
        await AsyncStorage.setItem(weekKey, currentWeek);
      }

      const newTotal = currentTotal + amount;
      await AsyncStorage.setItem(weeklyKey, newTotal.toString());

      console.log('[Reward] Updated weekly total:', newTotal, 'sats');
    } catch (error) {
      console.error('[Reward] Error updating weekly rewards:', error);
    }
  }

  /**
   * Call Supabase claim-reward edge function
   * Server handles: eligibility check, LNURL invoice request, NWC payment
   *
   * @param lightningAddress - Recipient's Lightning address
   * @param rewardType - 'workout' or 'steps'
   * @param amountSats - For steps, amount being claimed (default: 5)
   * @returns Result with success status and amount paid
   */
  private async claimRewardViaSupabase(
    lightningAddress: string,
    rewardType: 'workout' | 'steps',
    amountSats?: number
  ): Promise<{
    success: boolean;
    amount_paid?: number;
    reason?: string;
    remaining_step_allowance?: number;
  }> {
    try {
      if (!supabase) {
        console.error('[Reward] Supabase not configured');
        return { success: false, reason: 'supabase_not_configured' };
      }

      console.log(`[Reward] Calling claim-reward: ${rewardType} to ${lightningAddress}`);

      const { data, error } = await supabase.functions.invoke('claim-reward', {
        body: {
          lightning_address: lightningAddress,
          reward_type: rewardType,
          amount_sats: amountSats,
        },
      });

      if (error) {
        console.error('[Reward] Supabase function error:', error);
        return { success: false, reason: 'supabase_error' };
      }

      console.log('[Reward] claim-reward response:', data);
      return data;
    } catch (error) {
      console.error('[Reward] Error calling claim-reward:', error);
      return { success: false, reason: 'network_error' };
    }
  }

  /**
   * Send reward to pledge destination (captain or charity)
   * Called when user has an active pledge - bypasses normal charity split
   *
   * PLEDGE FLOW (v2 - Server-Side):
   * 1. Call Supabase claim-reward with pledge destination's Lightning address
   * 2. Server handles invoice request and NWC payment
   * 3. Increment pledge progress locally
   * 4. Show pledge-specific notification
   *
   * @param userPubkey - User's public key
   * @param pledge - Active pledge from PledgeService
   */
  private async sendPledgeReward(
    userPubkey: string,
    pledge: import('../../types/pledge').Pledge
  ): Promise<RewardResult> {
    try {
      const totalAmount = REWARD_CONFIG.DAILY_WORKOUT_REWARD;

      console.log(
        `[Reward] Sending ${totalAmount} sats to pledge destination:`,
        pledge.destinationName
      );

      if (DEBUG_REWARDS) {
        Alert.alert(
          'Pledge Reward Debug',
          `Routing ${totalAmount} sats to:\n` +
            `Destination: ${pledge.destinationName}\n` +
            `Address: ${pledge.destinationAddress}\n` +
            `Progress: ${pledge.completedWorkouts + 1}/${pledge.totalWorkouts}`
        );
      }

      // Call Supabase edge function to handle payment
      const result = await this.claimRewardViaSupabase(
        pledge.destinationAddress,
        'workout'
      );

      if (!result.success) {
        console.log('[Reward] Failed to pay pledge via Supabase:', result.reason);
        return {
          success: false,
          reason: 'pledge_payment_failed',
        };
      }

      // Increment pledge progress
      const updatedPledge = await PledgeService.incrementPledgeProgress(
        userPubkey
      );

      // Record the reward (for stats - counts as earned even though routed to pledge)
      await this.recordReward(userPubkey, totalAmount);

      // Show notification
      const newCompletedCount = updatedPledge
        ? updatedPledge.completedWorkouts
        : pledge.completedWorkouts + 1;
      const isComplete = newCompletedCount >= pledge.totalWorkouts;

      if (isComplete) {
        console.log('[Reward] Pledge completed!');
      }

      RewardNotificationManager.showPledgeRewardSent(
        totalAmount,
        pledge.eventName,
        pledge.destinationName,
        newCompletedCount,
        pledge.totalWorkouts
      );

      console.log(
        `[Reward] ✅ Pledge reward sent:`,
        `${totalAmount} sats to ${pledge.destinationName}`,
        `(${newCompletedCount}/${pledge.totalWorkouts})`
      );

      return {
        success: true,
        amount: totalAmount,
      };
    } catch (error) {
      console.error('[Reward] Error sending pledge reward:', error);
      return {
        success: false,
        reason: 'pledge_error',
      };
    }
  }

  /**
   * Send reward to user (and optionally team/charity based on donation settings)
   * Main entry point for reward system
   *
   * SILENT FAILURE PHILOSOPHY:
   * - Rewards are a BONUS feature, never a blocker
   * - If reward fails, user's workout still publishes successfully
   * - User never sees error messages about reward failures
   * - Failures are logged for debugging but don't affect user experience
   * - This ensures workout publishing is reliable regardless of payment status
   *
   * USER EXPERIENCE:
   * - Success: User sees "You earned X sats!" popup after workout
   * - With donation: Shows breakdown (e.g., "25 sats to you, 12 to OpenSats, 13 to team")
   * - Failure: User sees nothing (workout still posts normally)
   *
   * DONATION SPLIT FLOW:
   * 1. Load donation settings (percentage, team, charity)
   * 2. Calculate split amounts
   * 3. Pay user their portion
   * 4. Pay charity (if selected and donation > 0)
   * 5. Pay team (if has Lightning address and donation > 0)
   *
   * PLEDGE OVERRIDE:
   * If user has an active pledge, bypasses this flow entirely and calls sendPledgeReward()
   */
  async sendReward(userPubkey: string): Promise<RewardResult> {
    try {
      console.log(
        '[Reward] Checking reward eligibility for',
        userPubkey.slice(0, 8) + '...'
      );

      if (DEBUG_REWARDS) {
        Alert.alert('Reward Debug', `🚀 Reward triggered!\n\nUser: ${userPubkey.slice(0, 8)}...`);
      }

      // Check if user already claimed today (one reward per day limit)
      const canClaim = await this.canClaimToday(userPubkey);
      if (!canClaim) {
        console.log('[Reward] User already claimed today');
        addRewardDiagnostic(userPubkey, 'check', false, 'already_claimed_today');
        if (DEBUG_REWARDS) {
          Alert.alert('Reward Debug', 'Already claimed today - only 1 reward per day allowed');
        }
        return {
          success: false,
          reason: 'already_claimed_today',
        };
      }

      // Get user's Lightning address from their Nostr profile
      const lightningAddress = await this.getUserLightningAddress(userPubkey);
      if (!lightningAddress) {
        console.log(
          '[Reward] User has no Lightning address in profile, skipping reward'
        );
        addRewardDiagnostic(userPubkey, 'check', false, 'no_lightning_address');
        if (DEBUG_REWARDS) {
          Alert.alert('Reward Debug', 'No Lightning address found!\n\nSet one in Settings → Rewards, or add lud16 to your Nostr profile');
        }
        return {
          success: false,
          reason: 'no_lightning_address',
        };
      }

      // ===== PLEDGE CHECK =====
      // If user has active pledge, route reward to pledge destination
      const activePledge = await PledgeService.getActivePledge(userPubkey);
      if (activePledge) {
        console.log(
          '[Reward] Active pledge found, routing to:',
          activePledge.destinationName
        );
        return this.sendPledgeReward(userPubkey, activePledge);
      }
      // ===== END PLEDGE CHECK =====

      // Load donation settings and calculate split (charity only - no team payments)
      const { donationPercentage, charity } = await this.getDonationSettings();
      const totalAmount = REWARD_CONFIG.DAILY_WORKOUT_REWARD;
      const split = this.calculateSplit(totalAmount, donationPercentage, charity);

      console.log('[Reward] Payment split:', split);

      if (DEBUG_REWARDS) {
        Alert.alert('Reward Debug',
          `Split calculation:\n` +
          `Total: ${totalAmount} sats\n` +
          `Donation %: ${donationPercentage}%\n` +
          `User: ${split.userAmount} sats\n` +
          `Charity: ${split.charityAmount} sats`
        );
      }

      // Track payment results
      let userPaymentSuccess = false;
      let charityPaymentSuccess = false;

      // 1. Pay user their portion via Supabase (server handles rate limiting)
      if (split.userAmount > 0) {
        const result = await this.claimRewardViaSupabase(
          lightningAddress,
          'workout'
        );

        if (result.success) {
          userPaymentSuccess = true;
          console.log('[Reward] User payment: ✅');
        } else if (result.reason === 'already_claimed') {
          // Already claimed today via another device or reinstall
          console.log('[Reward] Already claimed today (server-side check)');
          return { success: false, reason: 'already_claimed_today' };
        } else {
          console.log('[Reward] User payment: ❌', result.reason);
        }
      } else {
        // If user amount is 0 (100% donation), skip user payment
        userPaymentSuccess = true;
      }

      // 2. Pay charity (if amount > 0 and user payment succeeded)
      if (userPaymentSuccess && split.charityAmount > 0 && charity?.lightningAddress) {
        try {
          const result = await this.claimRewardViaSupabase(
            charity.lightningAddress,
            'workout'
          );
          charityPaymentSuccess = result.success;
          console.log(`[Reward] Charity (${charity.name}) payment:`, charityPaymentSuccess ? '✅' : '❌');

          // Track successful charity donations for leaderboard
          if (charityPaymentSuccess) {
            await DonationTrackingService.recordDonation({
              donorPubkey: userPubkey,
              amount: split.charityAmount,
              charityId: charity.id,
              charityName: charity.name,
            });
          }
        } catch (error) {
          console.error('[Reward] Charity payment error:', error);
        }
      }

      // Consider reward successful if user payment worked
      if (userPaymentSuccess || split.userAmount === 0) {
        // Record the full reward amount locally (for stats/UI)
        await this.recordReward(userPubkey, totalAmount);

        console.log(
          '[Reward] ✅ Reward sent successfully:',
          `User: ${split.userAmount}, Charity: ${split.charityAmount}`
        );

        // Log success
        addRewardDiagnostic(userPubkey, 'send', true, undefined, totalAmount);

        // Show branded reward notification with donation split info
        const donationSplit: DonationSplit = {
          userAmount: split.userAmount,
          charityAmount: charityPaymentSuccess ? split.charityAmount : 0,
          charityName: charityPaymentSuccess && split.charityAmount > 0 ? charity?.name : undefined,
        };

        console.log('[Reward] 📢 About to show toast notification:', { totalAmount, donationSplit });
        RewardNotificationManager.showRewardEarned(totalAmount, donationSplit);
        console.log('[Reward] ✅ Toast notification triggered');

        return {
          success: true,
          amount: totalAmount,
        };
      } else {
        // SILENT FAILURE - just log
        console.log('[Reward] ❌ User payment failed (silent)');
        addRewardDiagnostic(userPubkey, 'send', false, 'payment_failed');

        if (DEBUG_REWARDS) {
          Alert.alert('Reward Debug', 'User payment failed!\n\nPossible causes:\n- Reward service unavailable\n- Lightning address issue');
        }

        return {
          success: false,
          reason: 'payment_failed',
        };
      }
    } catch (error) {
      // SILENT FAILURE - just log error
      const errorMsg = error instanceof Error ? error.message : 'unknown_error';
      console.error('[Reward] Error sending reward (silent):', error);
      addRewardDiagnostic(userPubkey, 'send', false, errorMsg);

      if (DEBUG_REWARDS) {
        Alert.alert('Reward Debug', `Unexpected error!\n\n${error instanceof Error ? error.message : String(error)}`);
      }

      return {
        success: false,
        reason: 'error',
      };
    }
  }

  /**
   * Check reward eligibility without sending
   * Useful for UI to show "Earn X sats" prompts
   */
  async checkEligibility(userPubkey: string): Promise<{
    eligible: boolean;
    reason?: string;
    nextEligibleTime?: Date;
  }> {
    try {
      const canClaim = await this.canClaimToday(userPubkey);
      const lightningAddress = await this.getUserLightningAddress(userPubkey);

      if (!lightningAddress) {
        return {
          eligible: false,
          reason: 'no_lightning_address',
        };
      }

      if (!canClaim) {
        // Calculate next eligible time (tomorrow midnight)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        return {
          eligible: false,
          reason: 'already_claimed_today',
          nextEligibleTime: tomorrow,
        };
      }

      return {
        eligible: true,
      };
    } catch (error) {
      console.error('[Reward] Error checking eligibility:', error);
      return {
        eligible: false,
        reason: 'error',
      };
    }
  }
}

// Export singleton instance
export const DailyRewardService = new DailyRewardServiceClass();
export default DailyRewardService;
