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

// DEBUG FLAG: Set to true to show visible alerts for debugging reward failures
const DEBUG_REWARDS = true;

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
   * Saves timestamp for eligibility checking
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
   * SILENT FAILURE PHILOSOPHY:
   * - Rewards are a BONUS feature, never a blocker
   * - If reward fails, user's workout still publishes successfully
   * - User never sees error messages about reward failures
   * - Failures are logged for debugging but don't affect user experience
   * - This ensures workout publishing is reliable regardless of payment status
   *
   * USER EXPERIENCE:
   * - Success: User sees "You earned 50 sats!" popup after workout
   * - Failure: User sees nothing (workout still posts normally)
   *
   * NEW PAYMENT FLOW:
   * - No longer requires user to have NWC wallet in app
   * - Pays directly to Lightning address from user's Nostr profile
   * - Works with any Lightning wallet that supports LNURL
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

      // Check if user can claim today
      const canClaim = await this.canClaimToday(userPubkey);
      if (!canClaim) {
        console.log('[Reward] User already claimed today');
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
        if (DEBUG_REWARDS) {
          Alert.alert('Reward Debug', 'No Lightning address found!\n\nSet one in Settings → Rewards, or add lud16 to your Nostr profile');
        }
        return {
          success: false,
          reason: 'no_lightning_address',
        };
      }

      // Request invoice from user's Lightning address
      if (DEBUG_REWARDS) {
        Alert.alert('Reward Debug', `Requesting invoice from ${lightningAddress} for ${REWARD_CONFIG.DAILY_WORKOUT_REWARD} sats...`);
      }
      const userInvoice = await this.requestInvoiceFromUserAddress(
        lightningAddress,
        REWARD_CONFIG.DAILY_WORKOUT_REWARD
      );
      if (!userInvoice) {
        console.log(
          '[Reward] Could not get invoice from Lightning address, skipping reward'
        );
        if (DEBUG_REWARDS) {
          Alert.alert('Reward Debug', `LNURL invoice request failed!\n\nCould not get invoice from ${lightningAddress}.\n\nPossible causes:\n- Lightning address provider is down\n- Network timeout\n- Invalid address format`);
        }
        return {
          success: false,
          reason: 'invoice_failed',
        };
      }

      // Send payment using app's dedicated reward sender wallet
      //
      // PAYMENT ARCHITECTURE:
      // - User provides: Lightning address in their Nostr profile (lud16 field)
      // - App requests: Invoice from Lightning address via LNURL protocol
      // - RewardSenderWallet: Pays invoice using REWARD_SENDER_NWC from .env
      // - User receives: 50 sats directly to their Lightning wallet
      console.log(
        '[Reward] Sending payment to Lightning address:',
        lightningAddress
      );

      const paymentResult = await RewardSenderWallet.sendRewardPayment(
        userInvoice
      );

      if (paymentResult.success) {
        // Record reward
        await this.recordReward(userPubkey, REWARD_CONFIG.DAILY_WORKOUT_REWARD);

        console.log(
          '[Reward] ✅ Reward sent successfully:',
          REWARD_CONFIG.DAILY_WORKOUT_REWARD,
          'sats'
        );

        if (DEBUG_REWARDS) {
          Alert.alert('Reward Success! 🎉', `${REWARD_CONFIG.DAILY_WORKOUT_REWARD} sats sent to ${lightningAddress}!`);
        }

        return {
          success: true,
          amount: REWARD_CONFIG.DAILY_WORKOUT_REWARD,
        };
      } else {
        // SILENT FAILURE - just log
        console.log(
          '[Reward] ❌ Payment failed (silent):',
          paymentResult.error
        );

        if (DEBUG_REWARDS) {
          Alert.alert('Reward Debug', `Payment failed!\n\nError: ${paymentResult.error || 'Unknown error'}\n\nPossible causes:\n- Reward wallet empty\n- NWC connection failed\n- Invoice expired`);
        }

        return {
          success: false,
          reason: 'payment_failed',
        };
      }
    } catch (error) {
      // SILENT FAILURE - just log error
      console.error('[Reward] Error sending reward (silent):', error);

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
