/**
 * Season2PayoutService - Automatic end-of-season prize distribution
 *
 * Handles automatic payouts when Season II ends (March 1, 2026):
 * - 500k sats bonus giveaway to 1 random participant
 * - ~166k sats each to top charity in running, walking, and cycling
 *
 * Payment Flow:
 * 1. Check if season has ended and payouts not yet processed
 * 2. Get all participants and select random winner
 * 3. Get winner's lightning address from their Nostr profile
 * 4. Get top charity from each activity category
 * 5. Request invoices via LNURL and pay with NWCGatewayService
 * 6. Record results for admin visibility
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Season2Service } from './Season2Service';
import { ProfileService } from '../user/profileService';
import { NWCGatewayService } from '../rewards/NWCGatewayService';
import { getInvoiceFromLightningAddress } from '../../utils/lnurl';
import { getCharityById } from '../../constants/charities';
import {
  SEASON_2_CONFIG,
  SEASON_2_PAYOUT_KEY,
  SEASON_2_PAYOUT_RESULTS_KEY,
  getSeason2Status,
} from '../../constants/season2';
import type { Season2ActivityType, CharityRanking } from '../../types/season2';

// ============================================================================
// Types
// ============================================================================

export interface BonusWinnerPayout {
  pubkey: string;
  name?: string;
  lightningAddress: string;
  amount: number;
  success: boolean;
  error?: string;
  preimage?: string;
}

export interface CharityPayout {
  category: Season2ActivityType;
  charityId: string;
  charityName: string;
  lightningAddress: string;
  amount: number;
  success: boolean;
  error?: string;
  preimage?: string;
}

export interface PayoutResults {
  processedAt: string;
  bonusWinner?: BonusWinnerPayout;
  charityPayouts: CharityPayout[];
  totalSuccess: boolean;
  errors: string[];
}

// ============================================================================
// Service
// ============================================================================

class Season2PayoutServiceClass {
  private isProcessing = false;

  /**
   * Check if payouts have already been processed
   */
  async hasPayoutsBeenProcessed(): Promise<boolean> {
    try {
      const completed = await AsyncStorage.getItem(SEASON_2_PAYOUT_KEY);
      return completed === 'true';
    } catch (error) {
      console.error('[Season2Payout] Error checking payout status:', error);
      return false;
    }
  }

  /**
   * Get stored payout results
   */
  async getPayoutResults(): Promise<PayoutResults | null> {
    try {
      const results = await AsyncStorage.getItem(SEASON_2_PAYOUT_RESULTS_KEY);
      return results ? JSON.parse(results) : null;
    } catch (error) {
      console.error('[Season2Payout] Error getting payout results:', error);
      return null;
    }
  }

  /**
   * Main payout execution - called when Season II ends
   * Returns early if season hasn't ended or payouts already processed
   */
  async executePayouts(): Promise<PayoutResults | null> {
    // Prevent concurrent execution
    if (this.isProcessing) {
      console.log('[Season2Payout] Payout already in progress, skipping...');
      return null;
    }

    // Check if season has ended
    const status = getSeason2Status();
    if (status !== 'ended') {
      console.log(`[Season2Payout] Season status is '${status}', not 'ended'. Skipping payouts.`);
      return null;
    }

    // Check if already processed
    const alreadyProcessed = await this.hasPayoutsBeenProcessed();
    if (alreadyProcessed) {
      console.log('[Season2Payout] Payouts already processed. Returning stored results.');
      return this.getPayoutResults();
    }

    this.isProcessing = true;
    console.log('[Season2Payout] Starting Season II payout execution...');

    const results: PayoutResults = {
      processedAt: new Date().toISOString(),
      charityPayouts: [],
      totalSuccess: false,
      errors: [],
    };

    try {
      // ========================================
      // 1. Select random bonus winner
      // ========================================
      console.log('[Season2Payout] Step 1: Selecting random bonus winner...');

      const participants = await Season2Service.getParticipants();
      if (participants.length === 0) {
        results.errors.push('No participants found for bonus giveaway');
        console.error('[Season2Payout] No participants found!');
      } else {
        const winnerPubkey = this.selectRandomWinner(participants);
        console.log(`[Season2Payout] Random winner selected: ${winnerPubkey.slice(0, 16)}...`);

        // Get winner's profile for lightning address
        const winnerProfile = await ProfileService.getUserProfile(winnerPubkey);
        const winnerLightningAddress = winnerProfile?.lud16;

        if (!winnerLightningAddress) {
          results.errors.push(`Winner ${winnerPubkey.slice(0, 16)}... has no lightning address`);
          results.bonusWinner = {
            pubkey: winnerPubkey,
            name: winnerProfile?.name,
            lightningAddress: '',
            amount: SEASON_2_CONFIG.prizePoolBonus,
            success: false,
            error: 'No lightning address in profile',
          };
        } else {
          // Send bonus prize
          const bonusResult = await this.sendPayment(
            winnerLightningAddress,
            SEASON_2_CONFIG.prizePoolBonus,
            `RUNSTR Season II Bonus Giveaway Winner! Congratulations!`
          );

          results.bonusWinner = {
            pubkey: winnerPubkey,
            name: winnerProfile?.name,
            lightningAddress: winnerLightningAddress,
            amount: SEASON_2_CONFIG.prizePoolBonus,
            success: bonusResult.success,
            error: bonusResult.error,
            preimage: bonusResult.preimage,
          };

          if (bonusResult.success) {
            console.log(`[Season2Payout] Bonus winner paid: ${SEASON_2_CONFIG.prizePoolBonus} sats`);
          } else {
            results.errors.push(`Bonus payout failed: ${bonusResult.error}`);
          }
        }
      }

      // ========================================
      // 2. Pay top charity in each category
      // ========================================
      console.log('[Season2Payout] Step 2: Paying top charities...');

      const categories: Season2ActivityType[] = ['running', 'walking', 'cycling'];
      const charityPrizePerCategory = Math.floor(SEASON_2_CONFIG.prizePoolCharity / 3);

      for (const category of categories) {
        console.log(`[Season2Payout] Processing ${category} category...`);

        const leaderboard = await Season2Service.getLeaderboard(category);
        const topCharity = leaderboard.charityRankings[0];

        if (!topCharity) {
          results.errors.push(`No charity found for ${category} category`);
          results.charityPayouts.push({
            category,
            charityId: '',
            charityName: 'None',
            lightningAddress: '',
            amount: charityPrizePerCategory,
            success: false,
            error: 'No charity in leaderboard',
          });
          continue;
        }

        // Get charity lightning address from constants
        const charity = getCharityById(topCharity.charityId);
        const charityLightningAddress = charity?.lightningAddress || topCharity.lightningAddress;

        if (!charityLightningAddress) {
          results.errors.push(`Charity ${topCharity.charityName} has no lightning address`);
          results.charityPayouts.push({
            category,
            charityId: topCharity.charityId,
            charityName: topCharity.charityName,
            lightningAddress: '',
            amount: charityPrizePerCategory,
            success: false,
            error: 'No lightning address configured',
          });
          continue;
        }

        // Send charity prize
        const charityResult = await this.sendPayment(
          charityLightningAddress,
          charityPrizePerCategory,
          `RUNSTR Season II ${category.charAt(0).toUpperCase() + category.slice(1)} Champion! Thank you for inspiring fitness.`
        );

        results.charityPayouts.push({
          category,
          charityId: topCharity.charityId,
          charityName: topCharity.charityName,
          lightningAddress: charityLightningAddress,
          amount: charityPrizePerCategory,
          success: charityResult.success,
          error: charityResult.error,
          preimage: charityResult.preimage,
        });

        if (charityResult.success) {
          console.log(`[Season2Payout] ${category} charity paid: ${charityPrizePerCategory} sats to ${topCharity.charityName}`);
        } else {
          results.errors.push(`${category} charity payout failed: ${charityResult.error}`);
        }
      }

      // ========================================
      // 3. Determine overall success
      // ========================================
      const bonusSuccess = results.bonusWinner?.success ?? false;
      const charitySuccessCount = results.charityPayouts.filter((p) => p.success).length;
      results.totalSuccess = bonusSuccess && charitySuccessCount === 3;

      console.log('[Season2Payout] Payout execution complete:', {
        bonusSuccess,
        charitySuccessCount,
        totalSuccess: results.totalSuccess,
        errorCount: results.errors.length,
      });

      // ========================================
      // 4. Record results
      // ========================================
      await this.recordPayoutResults(results);

      return results;
    } catch (error) {
      console.error('[Season2Payout] Critical error during payout execution:', error);
      results.errors.push(`Critical error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await this.recordPayoutResults(results);
      return results;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Select random winner from participant list
   * Uses Math.random() - for a more robust solution, consider using
   * cryptographically secure randomness or verifiable randomness
   */
  private selectRandomWinner(participants: string[]): string {
    const randomIndex = Math.floor(Math.random() * participants.length);
    return participants[randomIndex];
  }

  /**
   * Send payment to lightning address
   * Returns success status and optional preimage or error
   */
  private async sendPayment(
    lightningAddress: string,
    amountSats: number,
    description: string
  ): Promise<{ success: boolean; preimage?: string; error?: string }> {
    try {
      console.log(`[Season2Payout] Requesting invoice from ${lightningAddress} for ${amountSats} sats...`);

      // Step 1: Request invoice from lightning address via LNURL
      const { invoice } = await getInvoiceFromLightningAddress(
        lightningAddress,
        amountSats,
        description
      );

      if (!invoice) {
        return { success: false, error: 'Failed to get invoice from lightning address' };
      }

      console.log(`[Season2Payout] Invoice received, sending payment...`);

      // Step 2: Pay invoice using NWCGatewayService
      const paymentResult = await NWCGatewayService.payInvoice(invoice);

      if (paymentResult.success) {
        console.log(`[Season2Payout] Payment successful!`);
        return { success: true, preimage: paymentResult.preimage };
      } else {
        console.error(`[Season2Payout] Payment failed:`, paymentResult.error);
        return { success: false, error: paymentResult.error };
      }
    } catch (error) {
      console.error(`[Season2Payout] Payment error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown payment error',
      };
    }
  }

  /**
   * Record payout results to AsyncStorage
   * Marks payouts as completed even if some failed (to prevent re-runs)
   */
  private async recordPayoutResults(results: PayoutResults): Promise<void> {
    try {
      // Store detailed results
      await AsyncStorage.setItem(
        SEASON_2_PAYOUT_RESULTS_KEY,
        JSON.stringify(results)
      );

      // Mark as completed
      await AsyncStorage.setItem(SEASON_2_PAYOUT_KEY, 'true');

      console.log('[Season2Payout] Results recorded to AsyncStorage');
    } catch (error) {
      console.error('[Season2Payout] Error recording results:', error);
    }
  }

  /**
   * Reset payout status (for testing/admin purposes)
   * WARNING: This allows re-running payouts!
   */
  async resetPayoutStatus(): Promise<void> {
    console.warn('[Season2Payout] RESETTING payout status - payouts can be run again!');
    await AsyncStorage.removeItem(SEASON_2_PAYOUT_KEY);
    await AsyncStorage.removeItem(SEASON_2_PAYOUT_RESULTS_KEY);
  }
}

// Export singleton
export const Season2PayoutService = new Season2PayoutServiceClass();
export default Season2PayoutService;
