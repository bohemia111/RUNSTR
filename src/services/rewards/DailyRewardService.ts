/**
 * DailyRewardService - Automated workout rewards
 *
 * REWARD FLOW:
 * 1. User saves qualifying workout locally (≥1km distance)
 * 2. Check eligibility (once per day limit)
 * 3. Get user's Lightning address (settings first, then profile fallback)
 * 4. Request Lightning invoice from their address via LNURL protocol
 * 5. Reward sender wallet (app's wallet) pays the invoice
 * 6. User receives 21 sats to their Lightning address
 *
 * LIGHTNING ADDRESS PRIORITY:
 * 1. Settings-stored address (same as embedded in kind 1301 notes)
 * 2. Nostr profile lud16 field (fallback)
 *
 * PAYMENT ARCHITECTURE:
 * - User provides: Lightning address in settings or Nostr profile
 * - App requests: Invoice from Lightning address via LNURL
 * - Reward sender wallet: Pays invoice using REWARD_SENDER_NWC
 *
 * SILENT FAILURE: If any step fails, user never sees error
 * Workout publishing always succeeds regardless of reward status
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { REWARD_CONFIG, REWARD_STORAGE_KEYS } from '../../config/rewards';
import { RewardSenderWallet } from './RewardSenderWallet';
import { ProfileService } from '../user/profileService';
import { RewardLightningAddressService } from './RewardLightningAddressService';
import { getInvoiceFromLightningAddress } from '../../utils/lnurl';
import { RewardNotificationManager, DonationSplit } from './RewardNotificationManager';
import { getCharityById, Charity } from '../../constants/charities';
import { DonationTrackingService } from '../donation/DonationTrackingService';
import { PledgeService } from '../pledge/PledgeService';

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
 * Get combined diagnostics from DailyRewardService and RewardSenderWallet
 * Useful for debugging reward issues in Settings
 */
export function getRewardDiagnostics(): {
  rewardAttempts: RewardDiagnosticEntry[];
  walletDiagnostics: import('./RewardSenderWallet').WalletDiagnosticEntry[];
  walletStatus: {
    initialized: boolean;
    lastError: string | null;
  };
} {
  return {
    rewardAttempts: [...rewardDiagnosticLog],
    walletDiagnostics: RewardSenderWallet.getDiagnostics(),
    walletStatus: {
      initialized: RewardSenderWallet.isInitialized(),
      lastError: RewardSenderWallet.getLastError(),
    },
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
   * Only user-generated workouts on a new day trigger rewards
   *
   * This method combines source filtering with atomic "streak incremented today" tracking
   * to prevent race conditions when multiple workouts are saved concurrently.
   *
   * @param userPubkey - User's public key
   * @param workoutSource - The workout.source field (e.g., 'gps_tracker', 'imported_nostr')
   */
  async checkStreakAndReward(
    userPubkey: string,
    workoutSource: string
  ): Promise<RewardResult> {
    // Step 1: Filter by source - only user-generated workouts
    if (!REWARD_ELIGIBLE_SOURCES.includes(workoutSource)) {
      console.log(`[Reward] Skipping reward for ${workoutSource} (not user-generated)`);
      return { success: false, reason: 'source_not_eligible' };
    }

    // Step 2: Atomic streak check - only first workout of the day
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const streakKey = `@runstr:streak_incremented_today:${today}`;

    // Rate limit: Only one reward per day
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

      const donationPercentage = donationPctStr ? parseInt(donationPctStr) : 0;
      const charity = getCharityById(charityId || undefined);

      console.log('[Reward] Donation settings:', {
        donationPercentage,
        charityId: charity?.id,
      });

      return { donationPercentage, charity };
    } catch (error) {
      console.error('[Reward] Error loading donation settings:', error);
      return { donationPercentage: 0, charity: undefined };
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
   * Request Lightning invoice from user's Lightning address
   *
   * Uses LNURL protocol to request an invoice from any Lightning address.
   * This allows us to pay users without them having NWC setup.
   *
   * PAYMENT FLOW:
   * 1. Get Lightning address from user profile (e.g., alice@getalby.com)
   * 2. Use LNURL to request invoice for 50 sats
   * 3. Receive BOLT11 invoice that can be paid by any Lightning wallet
   *
   * @param lightningAddress - User's Lightning address
   * @param amount - Amount in satoshis
   * @returns Invoice string if successful, null otherwise
   */
  private async requestInvoiceFromUserAddress(
    lightningAddress: string,
    amount: number
  ): Promise<string | null> {
    try {
      console.log(
        '[Reward] Requesting invoice from Lightning address:',
        lightningAddress
      );

      // Request invoice via LNURL protocol
      const { invoice } = await getInvoiceFromLightningAddress(
        lightningAddress,
        amount,
        `Daily workout reward from RUNSTR! ⚡`
      );

      if (invoice) {
        console.log('[Reward] Successfully got invoice from Lightning address');
        return invoice;
      }

      console.log('[Reward] Failed to get invoice from Lightning address');
      return null;
    } catch (error) {
      console.error(
        '[Reward] Error getting invoice from Lightning address:',
        error
      );
      return null;
    }
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
   * Send reward to pledge destination (captain or charity)
   * Called when user has an active pledge - bypasses normal charity split
   *
   * PLEDGE FLOW:
   * 1. Request invoice from pledge destination's Lightning address
   * 2. Pay full reward amount (no split - user's charity % is paused)
   * 3. Increment pledge progress
   * 4. Show pledge-specific notification
   * 5. If pledge complete, show completion notification
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

      // Request invoice from pledge destination
      const invoice = await this.requestInvoiceFromUserAddress(
        pledge.destinationAddress,
        totalAmount
      );

      if (!invoice) {
        console.log('[Reward] Failed to get invoice from pledge destination');
        return {
          success: false,
          reason: 'pledge_invoice_failed',
        };
      }

      // Pay the invoice
      const paymentResult = await RewardSenderWallet.sendRewardPayment(invoice);

      if (!paymentResult.success) {
        console.log('[Reward] Failed to pay pledge invoice');
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
        RewardNotificationManager.showPledgeRewardSent(
          totalAmount,
          pledge.eventName,
          pledge.destinationName,
          newCompletedCount,
          pledge.totalWorkouts
        );
      } else {
        RewardNotificationManager.showPledgeRewardSent(
          totalAmount,
          pledge.eventName,
          pledge.destinationName,
          newCompletedCount,
          pledge.totalWorkouts
        );
      }

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

      // 1. Pay user their portion (required)
      if (split.userAmount > 0) {
        const userInvoice = await this.requestInvoiceFromUserAddress(
          lightningAddress,
          split.userAmount
        );
        if (userInvoice) {
          const result = await RewardSenderWallet.sendRewardPayment(userInvoice);
          userPaymentSuccess = result.success;
          console.log('[Reward] User payment:', userPaymentSuccess ? '✅' : '❌');
        }
      } else {
        // If user amount is 0 (100% donation), skip user payment
        userPaymentSuccess = true;
      }

      // 2. Pay charity (if amount > 0)
      if (split.charityAmount > 0 && charity?.lightningAddress) {
        try {
          const charityInvoice = await this.requestInvoiceFromUserAddress(
            charity.lightningAddress,
            split.charityAmount
          );
          if (charityInvoice) {
            const result = await RewardSenderWallet.sendRewardPayment(charityInvoice);
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
          }
        } catch (error) {
          console.error('[Reward] Charity payment error:', error);
        }
      }

      // Note: Team payments disabled until teams have lightning addresses configured

      // Consider reward successful if user payment worked
      if (userPaymentSuccess || split.userAmount === 0) {
        // Record the full reward amount (for stats)
        await this.recordReward(userPubkey, totalAmount);

        console.log(
          '[Reward] ✅ Reward sent successfully:',
          `User: ${split.userAmount}, Charity: ${split.charityAmount}`
        );

        // Log success
        addRewardDiagnostic(userPubkey, 'send', true, undefined, totalAmount);

        // Show branded reward notification with donation split info
        // Only show charity in split if charity payment actually succeeded
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
          Alert.alert('Reward Debug', 'User payment failed!\n\nPossible causes:\n- Reward wallet empty\n- NWC connection failed\n- Invoice expired');
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
