/**
 * ChallengeCompletionService
 * Handles challenge expiration, winner determination, and payout invoice generation
 * Monitors active challenges and executes completion flow
 *
 * NEW: Uses Lightning addresses for direct payment flow (no escrow)
 */

import challengeService from '../competition/ChallengeService';
import { challengePaymentService } from './ChallengePaymentService';
import type { ChallengeMetadata, ChallengeParticipant } from '../../types/challenge';

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
      // Get all active challenges from challengeService
      const activeChallenges = await challengeService.getActiveChallenges();

      if (!activeChallenges || activeChallenges.length === 0) {
        console.log('✅ No active challenges to check');
        return;
      }

      console.log(`🔍 Checking ${activeChallenges.length} active challenges...`);

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
          console.error(`Error checking challenge ${challenge.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error checking expired challenges:', error);
    }
  }

  /**
   * Complete a challenge - determine winner and generate payout invoice
   * NEW: Returns invoice for loser to pay winner (no automatic payout)
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

      // We have a winner - determine loser and generate payout invoice
      console.log(`🏆 Winner: ${winnerPubkey.slice(0, 8)}...`);

      // Determine loser pubkey and get Lightning addresses
      const isCreatorWinner = winnerPubkey === challenge.challengerPubkey;
      const loserPubkey = isCreatorWinner ? challenge.challengedPubkey : challenge.challengerPubkey;
      const winnerLightningAddress = isCreatorWinner
        ? challenge.creatorLightningAddress
        : challenge.accepterLightningAddress;
      const loserLightningAddress = isCreatorWinner
        ? challenge.accepterLightningAddress
        : challenge.creatorLightningAddress;

      console.log(`💰 Generating payout invoice from loser to winner...`);
      console.log(`   Winner: ${winnerLightningAddress}`);
      console.log(`   Loser pays: ${challenge.wager * 2} sats`);

      // Generate payout invoice (loser pays winner the full pot)
      const payoutResult = await challengePaymentService.generatePayoutInvoice(
        winnerLightningAddress,
        challenge.wager * 2, // Winner takes all
        challengeId
      );

      if (!payoutResult.success || !payoutResult.invoice) {
        throw new Error(payoutResult.error || 'Failed to generate payout invoice');
      }

      console.log(`✅ Payout invoice generated`);
      console.log(`   Invoice: ${payoutResult.invoice.substring(0, 50)}...`);

      // TODO: Send notification to both participants (kind 1102)
      // - Winner: "You won! Waiting for opponent to pay..."
      // - Loser: "You lost. Please pay the payout invoice."

      // Update challenge status to completed
      await challengeService.updateChallengeStatus(challengeId, 'completed', winnerPubkey);

      return {
        success: true,
        winnerId: winnerPubkey,
        loserId: loserPubkey,
        payoutInvoice: payoutResult.invoice,
        winnerLightningAddress,
        loserLightningAddress,
      };
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
  private async determineWinner(challengeId: string): Promise<string | 'tie' | null> {
    try {
      // Get leaderboard
      const leaderboard = await challengeService.getChallengeLeaderboard(challengeId);

      if (!leaderboard || !leaderboard.participants || leaderboard.participants.length === 0) {
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
  private scoresAreEqual(entry1: ChallengeParticipant, entry2: ChallengeParticipant): boolean {
    // Compare based on current progress
    return Math.abs(entry1.currentProgress - entry2.currentProgress) < 0.01; // Within 0.01 is considered tie
  }

  /**
   * Manually trigger completion for a specific challenge
   * Useful for testing or admin purposes
   */
  async manuallyCompleteChallenge(challengeId: string): Promise<CompletionResult> {
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
    console.log('⚠️ checkPaymentTimeouts is deprecated - no escrow in new payment flow');
  }
}

export const challengeCompletionService = ChallengeCompletionService.getInstance();
