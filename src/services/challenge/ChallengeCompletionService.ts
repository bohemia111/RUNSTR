/**
 * ChallengeCompletionService
 * Handles challenge expiration, winner determination, and payout invoice generation
 * Monitors active challenges and executes completion flow
 *
 * NEW: Uses Lightning addresses for direct payment flow (no escrow)
 */

import { AppStateManager } from '../core/AppStateManager';
import challengeService from '../competition/ChallengeService';
import { challengePaymentService } from './ChallengePaymentService';
import { challengeArbitrationService } from './ChallengeArbitrationService';
import { NWCWalletService } from '../wallet/NWCWalletService';
import { getInvoiceFromLightningAddress } from '../../utils/lnurl';
import type {
  ChallengeMetadata,
  ChallengeParticipant,
} from '../../types/challenge';

export interface CompletionResult {
  success: boolean;
  winnerId?: string;
  loserId?: string;
  isTie?: boolean;
  payoutInvoice?: string; // Invoice for loser to pay winner
  winnerLightningAddress?: string;
  loserLightningAddress?: string;
  error?: string;
}

export class ChallengeCompletionService {
  private static instance: ChallengeCompletionService;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

  private constructor() {}

  static getInstance(): ChallengeCompletionService {
    if (!ChallengeCompletionService.instance) {
      ChallengeCompletionService.instance = new ChallengeCompletionService();
    }
    return ChallengeCompletionService.instance;
  }

  /**
   * Start monitoring active challenges for expiration
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      console.log('⚠️ Challenge monitoring already running');
      return;
    }

    console.log('🔍 Starting challenge completion monitoring...');

    // Check immediately on start
    this.checkExpiredChallenges();

    // Then check every 5 minutes
    this.monitoringInterval = setInterval(() => {
      this.checkExpiredChallenges();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('🛑 Stopped challenge completion monitoring');
    }
  }

  /**
   * Check all active challenges for expiration
   * NEW: Queries Nostr for active challenges instead of escrow records
   */
  private async checkExpiredChallenges(): Promise<void> {
    try {
      // ✅ FIX: Early exit if monitoring is stopped (prevents background execution)
      if (!this.monitoringInterval) {
        console.log('⏸️  Monitoring stopped, skipping challenge check');
        return;
      }

      // ✅ FIX: Check if app can do network operations (prevents Android crash)
      if (!AppStateManager.canDoNetworkOps()) {
        console.log('🔴 App is backgrounded, skipping challenge check');
        return;
      }

      // Get all active challenges from challengeService
      const activeChallenges = await challengeService.getActiveChallenges();

      if (!activeChallenges || activeChallenges.length === 0) {
        console.log('✅ No active challenges to check');
        return;
      }

      console.log(
        `🔍 Checking ${activeChallenges.length} active challenges...`
      );

      const now = Date.now();
      for (const challenge of activeChallenges) {
        try {
          // Check if expired
          const expiresAt = challenge.expiresAt * 1000; // Convert to milliseconds
          if (now >= expiresAt) {
            console.log(`⏰ Challenge expired: ${challenge.id}`);
            await this.completeChallenge(challenge.id);
          }
        } catch (error) {
          console.error(`❌ Error checking challenge ${challenge.id}:`, error);
          // Continue processing other challenges - don't crash entire loop
        }
      }
    } catch (error) {
      console.error('❌ Error checking expired challenges:', error);
      // ✅ FIX: Gracefully handle errors without crashing app
      // This prevents unhandled promise rejections from reaching React
    }
  }

  /**
   * Attempt automatic payout via captain's NWC wallet
   * Includes safety nets and fallback to manual
   */
  private async attemptAutomaticPayout(
    challengeId: string,
    winnerPubkey: string,
    winnerLightningAddress: string,
    wagerAmount: number,
    arbitratorCaptainPubkey: string
  ): Promise<{ success: boolean; payoutHash?: string; error?: string }> {
    try {
      console.log(
        `🤖 Attempting automatic payout for challenge: ${challengeId}`
      );

      // SAFETY NET 1: Check if both participants paid
      const fullyFunded = await challengeArbitrationService.checkFullyFunded(
        challengeId
      );
      if (!fullyFunded) {
        const reason =
          'Challenge not fully funded - both participants must pay before payout';
        console.warn(`⚠️ ${reason}`);
        return { success: false, error: reason };
      }

      // SAFETY NET 2: Validate winner has Lightning address
      if (!winnerLightningAddress || !winnerLightningAddress.includes('@')) {
        const reason =
          'Winner does not have valid Lightning address configured';
        console.warn(`⚠️ ${reason}`);
        return { success: false, error: reason };
      }

      // Get captain's NWC wallet
      const nwcService = NWCWalletService.getInstance();
      const walletInfo = await nwcService.getWalletInfo();

      if (!walletInfo) {
        const reason = 'Captain NWC wallet not configured';
        console.warn(`⚠️ ${reason}`);
        return { success: false, error: reason };
      }

      // SAFETY NET 3: Check captain's wallet balance
      const balance = await nwcService.getBalance();
      const totalPot = wagerAmount * 2;
      const arbitrationFee = Math.floor(totalPot * 0.05); // 5% fee
      const winnerPayout = totalPot - arbitrationFee;

      if (!balance || balance < winnerPayout) {
        const reason = `Insufficient captain wallet balance (has ${balance} sats, needs ${winnerPayout} sats)`;
        console.warn(`⚠️ ${reason}`);
        return { success: false, error: reason };
      }

      console.log(`💰 Payout calculation:`);
      console.log(`   Total pot: ${totalPot} sats`);
      console.log(`   Arbitration fee (5%): ${arbitrationFee} sats`);
      console.log(`   Winner payout: ${winnerPayout} sats`);

      // Generate invoice from winner's Lightning address
      console.log(
        `⚡ Generating invoice from winner's address: ${winnerLightningAddress}`
      );
      const invoiceResult = await getInvoiceFromLightningAddress(
        winnerLightningAddress,
        winnerPayout,
        `Challenge ${challengeId.slice(0, 16)} winnings`
      );

      if (!invoiceResult.invoice) {
        const reason =
          'Failed to generate invoice from winner Lightning address';
        console.error(`❌ ${reason}`);
        return { success: false, error: reason };
      }

      console.log(
        `✅ Invoice generated: ${invoiceResult.invoice.substring(0, 50)}...`
      );

      // RETRY LOGIC: Attempt payment with 3 retries
      let lastError: string | undefined;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`🔄 Payment attempt ${attempt}/3...`);

          const paymentResult = await nwcService.payInvoice(
            invoiceResult.invoice
          );

          if (paymentResult.preimage) {
            console.log(`✅ Automatic payout successful!`);
            console.log(`   Payment hash: ${paymentResult.preimage}`);

            // Record successful auto-payout
            await challengeArbitrationService.markAutoPayoutComplete(
              challengeId,
              winnerPubkey,
              paymentResult.preimage,
              winnerPayout,
              arbitrationFee
            );

            return {
              success: true,
              payoutHash: paymentResult.preimage,
            };
          } else {
            lastError = 'Payment succeeded but no preimage returned';
            console.warn(`⚠️ Attempt ${attempt}: ${lastError}`);
          }
        } catch (error) {
          lastError =
            error instanceof Error ? error.message : 'Unknown payment error';
          console.error(`❌ Attempt ${attempt} failed:`, lastError);

          if (attempt < 3) {
            // Wait 5 seconds before retry
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }
      }

      // All retries failed
      const finalError = `Payment failed after 3 attempts: ${lastError}`;
      console.error(`❌ ${finalError}`);
      return { success: false, error: finalError };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Automatic payout error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Complete a challenge - determine winner and execute payout
   * NEW: Automatic payout via captain's NWC wallet for arbitrated challenges
   * FALLBACK: Manual payout invoice for P2P challenges or if automatic fails
   */
  async completeChallenge(challengeId: string): Promise<CompletionResult> {
    try {
      console.log(`🏁 Completing challenge: ${challengeId}`);

      // Get challenge metadata
      const challenge = await challengeService.getChallenge(challengeId);
      if (!challenge) {
        throw new Error('Challenge not found');
      }

      // Validate Lightning addresses are present
      if (!challenge.creatorLightningAddress) {
        throw new Error('Creator Lightning address not found');
      }
      if (!challenge.accepterLightningAddress) {
        throw new Error('Accepter Lightning address not found');
      }

      // Determine winner from leaderboard
      const winnerPubkey = await this.determineWinner(challengeId);

      if (!winnerPubkey) {
        console.log('⚠️ No workouts found - no payout generated');
        return {
          success: true,
          error: 'No workouts found - challenge abandoned',
        };
      }

      if (winnerPubkey === 'tie') {
        console.log('🤝 Tie detected - no payout');
        // TODO: Send notification to both participants about tie
        return {
          success: true,
          isTie: true,
        };
      }

      // We have a winner - determine loser and get Lightning addresses
      console.log(`🏆 Winner: ${winnerPubkey.slice(0, 8)}...`);

      // Determine loser pubkey and get Lightning addresses
      const isCreatorWinner = winnerPubkey === challenge.challengerPubkey;
      const loserPubkey = isCreatorWinner
        ? challenge.challengedPubkey
        : challenge.challengerPubkey;
      const winnerLightningAddress = isCreatorWinner
        ? challenge.creatorLightningAddress
        : challenge.accepterLightningAddress;
      const loserLightningAddress = isCreatorWinner
        ? challenge.accepterLightningAddress
        : challenge.creatorLightningAddress;

      // Check if challenge has arbitrator
      const arbitrationRecord =
        await challengeArbitrationService.getArbitrationStatus(challengeId);
      const hasArbitrator = !!arbitrationRecord;

      if (hasArbitrator && arbitrationRecord) {
        console.log(
          `💰 Challenge has arbitrator - attempting automatic payout...`
        );

        // Attempt automatic payout via captain's NWC wallet
        const payoutResult = await this.attemptAutomaticPayout(
          challengeId,
          winnerPubkey,
          winnerLightningAddress,
          challenge.wager,
          arbitrationRecord.arbitratorCaptainPubkey
        );

        if (payoutResult.success) {
          console.log(`✅ Automatic payout complete!`);

          // TODO: Send notifications (kind 1102)
          // - Winner: "You won! Payment sent automatically."
          // - Captain: "Challenge complete. You earned X sats arbitration fee."

          // Update challenge status to completed
          await challengeService.updateChallengeStatus(
            challengeId,
            'completed',
            winnerPubkey
          );

          return {
            success: true,
            winnerId: winnerPubkey,
            loserId: loserPubkey,
            winnerLightningAddress,
            loserLightningAddress,
          };
        } else {
          // Automatic payout failed - mark for manual intervention
          console.warn(`⚠️ Automatic payout failed: ${payoutResult.error}`);
          console.log(`📋 Marking challenge for manual payout...`);

          const totalPot = challenge.wager * 2;
          const arbitrationFee = Math.floor(totalPot * 0.05);
          const winnerPayout = totalPot - arbitrationFee;

          await challengeArbitrationService.markManualRequired(
            challengeId,
            winnerPubkey,
            winnerPayout,
            arbitrationFee,
            payoutResult.error || 'Automatic payout failed'
          );

          // TODO: Send notification to captain (kind 1102)
          // - Captain: "Manual payout required for challenge X. Winner: Y, Amount: Z sats."

          // Update challenge status to completed (captain will handle payout manually)
          await challengeService.updateChallengeStatus(
            challengeId,
            'completed',
            winnerPubkey
          );

          return {
            success: true,
            winnerId: winnerPubkey,
            loserId: loserPubkey,
            winnerLightningAddress,
            loserLightningAddress,
            error: `Automatic payout failed: ${payoutResult.error}. Captain must pay manually.`,
          };
        }
      } else {
        // No arbitrator - use P2P payout flow (loser pays winner)
        console.log(`💰 No arbitrator - generating P2P payout invoice...`);
        console.log(`   Winner: ${winnerLightningAddress}`);
        console.log(`   Loser pays: ${challenge.wager * 2} sats`);

        // Generate payout invoice (loser pays winner the full pot)
        const payoutResult =
          await challengePaymentService.generatePayoutInvoice(
            challengeId,
            winnerLightningAddress,
            winnerPubkey
          );

        if (!payoutResult.success || !payoutResult.invoice) {
          throw new Error(
            payoutResult.error || 'Failed to generate payout invoice'
          );
        }

        console.log(`✅ P2P payout invoice generated`);
        console.log(`   Invoice: ${payoutResult.invoice.substring(0, 50)}...`);

        // TODO: Send notification to both participants (kind 1102)
        // - Winner: "You won! Waiting for opponent to pay..."
        // - Loser: "You lost. Please pay the payout invoice."

        // Update challenge status to completed
        await challengeService.updateChallengeStatus(
          challengeId,
          'completed',
          winnerPubkey
        );

        return {
          success: true,
          winnerId: winnerPubkey,
          loserId: loserPubkey,
          payoutInvoice: payoutResult.invoice,
          winnerLightningAddress,
          loserLightningAddress,
        };
      }
    } catch (error) {
      console.error('Failed to complete challenge:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Determine winner from leaderboard
   * Returns pubkey of winner, 'tie', or null if no workouts
   */
  private async determineWinner(
    challengeId: string
  ): Promise<string | 'tie' | null> {
    try {
      // Get leaderboard
      const leaderboard = await challengeService.getChallengeLeaderboard(
        challengeId
      );

      if (
        !leaderboard ||
        !leaderboard.participants ||
        leaderboard.participants.length === 0
      ) {
        console.log('No workouts found for challenge');
        return null;
      }

      const participants = leaderboard.participants;

      if (participants.length === 1) {
        // Only one participant posted workouts
        return participants[0].pubkey;
      }

      // Check for tie
      const firstPlace = participants[0];
      const secondPlace = participants[1];

      if (this.scoresAreEqual(firstPlace, secondPlace)) {
        console.log('Scores are tied');
        return 'tie';
      }

      // Clear winner
      return firstPlace.pubkey;
    } catch (error) {
      console.error('Failed to determine winner:', error);
      return null;
    }
  }

  /**
   * Check if two leaderboard entries have equal scores
   */
  private scoresAreEqual(
    entry1: ChallengeParticipant,
    entry2: ChallengeParticipant
  ): boolean {
    // Compare based on current progress
    return Math.abs(entry1.currentProgress - entry2.currentProgress) < 0.01; // Within 0.01 is considered tie
  }

  /**
   * Manually trigger completion for a specific challenge
   * Useful for testing or admin purposes
   */
  async manuallyCompleteChallenge(
    challengeId: string
  ): Promise<CompletionResult> {
    console.log(`🔧 Manually completing challenge: ${challengeId}`);
    return this.completeChallenge(challengeId);
  }

  /**
   * Get all challenges that are ready for completion
   * (expired and active)
   * NEW: Queries active challenges from Nostr instead of payment records
   */
  async getExpiredChallenges(): Promise<string[]> {
    try {
      const activeChallenges = await challengeService.getActiveChallenges();

      const expiredIds: string[] = [];
      const now = Date.now();

      for (const challenge of activeChallenges) {
        try {
          const expiresAt = challenge.expiresAt * 1000;
          if (now >= expiresAt) {
            expiredIds.push(challenge.id);
          }
        } catch (error) {
          console.error(`Error checking challenge ${challenge.id}:`, error);
        }
      }

      return expiredIds;
    } catch (error) {
      console.error('Failed to get expired challenges:', error);
      return [];
    }
  }

  /**
   * DEPRECATED: No payment timeouts in new Lightning address flow
   * Payments are direct between users, not held in escrow
   */
  async checkPaymentTimeouts(): Promise<void> {
    console.log(
      '⚠️ checkPaymentTimeouts is deprecated - no escrow in new payment flow'
    );
  }
}

export const challengeCompletionService =
  ChallengeCompletionService.getInstance();
