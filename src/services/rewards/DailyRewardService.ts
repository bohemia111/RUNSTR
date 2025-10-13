/**
 * DailyRewardService - Automated workout rewards
 * Sends 50 sats for first workout of the day
 * Silent failure if payment doesn't work
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { REWARD_CONFIG, REWARD_STORAGE_KEYS } from '../../config/rewards';
import { NWCStorageService } from '../wallet/NWCStorageService';
import { NWCWalletService } from '../wallet/NWCWalletService';

export interface RewardResult {
  success: boolean;
  amount?: number;
  reason?: string;
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
   * Check if user has NWC wallet configured
   * Only current user can be checked
   */
  private async userHasWallet(userPubkey: string): Promise<boolean> {
    try {
      // For now, we can only check if current user has wallet
      // Future: could query user's profile for Lightning address
      const hasNWC = await NWCStorageService.hasNWC();
      return hasNWC;
    } catch (error) {
      console.error('[Reward] Error checking user wallet:', error);
      return false;
    }
  }

  /**
   * Generate or get user's Lightning invoice for reward
   * Creates invoice from user's wallet if they have NWC configured
   */
  private async getUserInvoice(userPubkey: string, amount: number): Promise<string | null> {
    try {
      // User must have NWC configured to receive
      const hasWallet = await this.userHasWallet(userPubkey);
      if (!hasWallet) {
        console.log('[Reward] User has no wallet, cannot create invoice');
        return null;
      }

      // Create invoice using user's NWC
      const result = await NWCWalletService.createInvoice(
        amount,
        `Daily workout reward from RUNSTR! ⚡`,
        { type: 'daily_reward', userPubkey }
      );

      if (result.success && result.invoice) {
        return result.invoice;
      }

      console.log('[Reward] Failed to create user invoice:', result.error);
      return null;
    } catch (error) {
      console.error('[Reward] Error creating user invoice:', error);
      return null;
    }
  }

  /**
   * Record that user claimed reward
   * Saves timestamp for eligibility checking
   */
  private async recordReward(userPubkey: string, amount: number): Promise<void> {
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
   * Send reward to user
   * Main entry point for reward system
   *
   * SILENT FAILURE: If payment fails, just log and return
   * User won't see any error, reward just doesn't happen
   */
  async sendReward(userPubkey: string): Promise<RewardResult> {
    try {
      console.log('[Reward] Checking reward eligibility for', userPubkey.slice(0, 8) + '...');

      // Check if user can claim today
      const canClaim = await this.canClaimToday(userPubkey);
      if (!canClaim) {
        console.log('[Reward] User already claimed today');
        return {
          success: false,
          reason: 'already_claimed_today',
        };
      }

      // Check if user has wallet to receive
      const hasWallet = await this.userHasWallet(userPubkey);
      if (!hasWallet) {
        console.log('[Reward] User has no wallet, skipping reward');
        return {
          success: false,
          reason: 'no_wallet',
        };
      }

      // Get user's invoice for receiving payment
      const userInvoice = await this.getUserInvoice(userPubkey, REWARD_CONFIG.DAILY_WORKOUT_REWARD);
      if (!userInvoice) {
        console.log('[Reward] Could not get user invoice, skipping reward');
        return {
          success: false,
          reason: 'invoice_failed',
        };
      }

      // Send payment using hardcoded sender NWC
      // NOTE: In production, configure Alby MCP to use REWARD_CONFIG.SENDER_NWC
      // For now, this will use whatever NWC is configured in the app
      console.log('[Reward] Sending payment...');

      const paymentResult = await NWCWalletService.sendPayment(userInvoice);

      if (paymentResult.success) {
        // Record reward
        await this.recordReward(userPubkey, REWARD_CONFIG.DAILY_WORKOUT_REWARD);

        console.log('[Reward] ✅ Reward sent successfully:', REWARD_CONFIG.DAILY_WORKOUT_REWARD, 'sats');

        return {
          success: true,
          amount: REWARD_CONFIG.DAILY_WORKOUT_REWARD,
        };
      } else {
        // SILENT FAILURE - just log
        console.log('[Reward] ❌ Payment failed (silent):', paymentResult.error);

        return {
          success: false,
          reason: 'payment_failed',
        };
      }
    } catch (error) {
      // SILENT FAILURE - just log error
      console.error('[Reward] Error sending reward (silent):', error);

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
      const hasWallet = await this.userHasWallet(userPubkey);

      if (!hasWallet) {
        return {
          eligible: false,
          reason: 'no_wallet',
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
