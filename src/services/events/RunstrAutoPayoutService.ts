/**
 * RunstrAutoPayoutService - Automated prize payouts for RUNSTR events
 *
 * Handles payout calculation and execution for user-created events:
 * - Calculate winner payouts based on payout scheme
 * - Execute Lightning payments to winners
 * - Track payout status and history
 *
 * Payout Schemes:
 * - winner_takes_all: 1st place gets 100%
 * - top_3_split: 60% / 25% / 15%
 * - random_lottery: Random participant wins 100%
 * - fixed_amount: Each participant gets fixed sats
 *
 * Usage:
 * ```typescript
 * const payouts = RunstrAutoPayoutService.calculatePayouts(event, leaderboard);
 * const results = await RunstrAutoPayoutService.executePayouts(event, payouts);
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import lightningZapService from '../nutzap/LightningZapService';
import { NWCWalletService } from '../wallet/NWCWalletService';
import type { SatlantisEvent, SatlantisLeaderboardEntry } from '../../types/satlantis';
import type { RunstrPayoutScheme } from '../../types/runstrEvent';
import { nip19 } from 'nostr-tools';

const PAYOUT_STATUS_PREFIX = '@runstr:event_payout_';

// Payout calculation result
export interface PayoutCalculation {
  npub: string;
  rank: number;
  amountSats: number;
  percentage?: number;
}

// Individual payout result
export interface PayoutResult {
  npub: string;
  amountSats: number;
  success: boolean;
  error?: string;
  txId?: string;
}

// Full payout execution result
export interface PayoutExecutionResult {
  eventId: string;
  totalPaid: number;
  totalFailed: number;
  results: PayoutResult[];
  executedAt: number;
}

// Payout status stored in AsyncStorage
export interface PayoutStatus {
  eventId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'partial' | 'failed';
  totalPrize: number;
  paidAmount: number;
  results: PayoutResult[];
  startedAt?: number;
  completedAt?: number;
}

class RunstrAutoPayoutServiceClass {
  private static instance: RunstrAutoPayoutServiceClass;

  private constructor() {}

  static getInstance(): RunstrAutoPayoutServiceClass {
    if (!this.instance) {
      this.instance = new RunstrAutoPayoutServiceClass();
    }
    return this.instance;
  }

  /**
   * Calculate payouts based on event configuration and leaderboard
   * @param event - The event with payout configuration
   * @param leaderboard - Leaderboard entries to pay out
   */
  calculatePayouts(
    event: SatlantisEvent,
    leaderboard: SatlantisLeaderboardEntry[]
  ): PayoutCalculation[] {
    const prizePool = event.prizePoolSats || 0;
    const payoutScheme = event.payoutScheme || 'winner_takes_all';

    if (prizePool <= 0 || leaderboard.length === 0) {
      console.log('[AutoPayout] No prize pool or no participants');
      return [];
    }

    console.log(
      `[AutoPayout] Calculating payouts: ${prizePool} sats, scheme: ${payoutScheme}, ` +
        `participants: ${leaderboard.length}`
    );

    switch (payoutScheme) {
      case 'winner_takes_all':
        return this.calculateWinnerTakesAll(prizePool, leaderboard);
      case 'top_3_split':
        return this.calculateTop3Split(prizePool, leaderboard);
      case 'random_lottery':
        return this.calculateRandomLottery(prizePool, leaderboard);
      case 'fixed_amount':
        return this.calculateFixedAmount(prizePool, leaderboard, event.fixedPayoutSats);
      default:
        console.warn(`[AutoPayout] Unknown payout scheme: ${payoutScheme}`);
        return this.calculateWinnerTakesAll(prizePool, leaderboard);
    }
  }

  private calculateWinnerTakesAll(
    prizePool: number,
    leaderboard: SatlantisLeaderboardEntry[]
  ): PayoutCalculation[] {
    const winner = leaderboard.find((e) => e.rank === 1);
    if (!winner) return [];

    return [
      {
        npub: winner.npub,
        rank: 1,
        amountSats: prizePool,
        percentage: 100,
      },
    ];
  }

  private calculateTop3Split(
    prizePool: number,
    leaderboard: SatlantisLeaderboardEntry[]
  ): PayoutCalculation[] {
    const payouts: PayoutCalculation[] = [];
    const splits = [0.6, 0.25, 0.15]; // 60%, 25%, 15%

    for (let rank = 1; rank <= Math.min(3, leaderboard.length); rank++) {
      const entry = leaderboard.find((e) => e.rank === rank);
      if (entry) {
        const percentage = splits[rank - 1] * 100;
        const amount = Math.floor(prizePool * splits[rank - 1]);

        payouts.push({
          npub: entry.npub,
          rank,
          amountSats: amount,
          percentage,
        });
      }
    }

    return payouts;
  }

  private calculateRandomLottery(
    prizePool: number,
    leaderboard: SatlantisLeaderboardEntry[]
  ): PayoutCalculation[] {
    // Random selection from all participants
    const randomIndex = Math.floor(Math.random() * leaderboard.length);
    const winner = leaderboard[randomIndex];

    return [
      {
        npub: winner.npub,
        rank: winner.rank,
        amountSats: prizePool,
        percentage: 100,
      },
    ];
  }

  private calculateFixedAmount(
    prizePool: number,
    leaderboard: SatlantisLeaderboardEntry[],
    fixedAmount?: number
  ): PayoutCalculation[] {
    if (!fixedAmount || fixedAmount <= 0) {
      console.warn('[AutoPayout] Fixed amount not set');
      return [];
    }

    const payouts: PayoutCalculation[] = [];
    let remainingPool = prizePool;

    for (const entry of leaderboard) {
      if (remainingPool < fixedAmount) {
        break; // Not enough for another payout
      }

      payouts.push({
        npub: entry.npub,
        rank: entry.rank,
        amountSats: fixedAmount,
      });

      remainingPool -= fixedAmount;
    }

    return payouts;
  }

  /**
   * Execute payouts to winners
   * Sends Lightning payments using LightningZapService
   */
  async executePayouts(
    event: SatlantisEvent,
    payouts: PayoutCalculation[]
  ): Promise<PayoutExecutionResult> {
    console.log(`[AutoPayout] Executing ${payouts.length} payouts for event: ${event.id}`);

    // Check if creator has NWC configured
    const hasNWC = await NWCWalletService.hasNWCConfigured();
    if (!hasNWC) {
      console.log('[AutoPayout] Creator does not have NWC configured');
      return {
        eventId: event.id,
        totalPaid: 0,
        totalFailed: payouts.length,
        results: payouts.map((p) => ({
          npub: p.npub,
          amountSats: p.amountSats,
          success: false,
          error: 'No wallet configured. Please set up NWC to auto-payout.',
        })),
        executedAt: Math.floor(Date.now() / 1000),
      };
    }

    // Update status to in_progress
    await this.updatePayoutStatus(event.id, {
      eventId: event.id,
      status: 'in_progress',
      totalPrize: event.prizePoolSats || 0,
      paidAmount: 0,
      results: [],
      startedAt: Math.floor(Date.now() / 1000),
    });

    const results: PayoutResult[] = [];
    let totalPaid = 0;
    let totalFailed = 0;

    for (const payout of payouts) {
      try {
        // Convert npub to hex pubkey for LightningZapService
        let hexPubkey: string;
        if (payout.npub.startsWith('npub')) {
          const decoded = nip19.decode(payout.npub);
          hexPubkey = decoded.data as string;
        } else {
          hexPubkey = payout.npub;
        }

        console.log(
          `[AutoPayout] Sending ${payout.amountSats} sats to ${payout.npub.substring(0, 12)}...`
        );

        // Use LightningZapService to send payment
        const zapResult = await lightningZapService.sendLightningZap(
          hexPubkey,
          payout.amountSats,
          `Prize payout for ${event.title}`
        );

        if (zapResult.success) {
          console.log(`[AutoPayout] ✅ Payment successful to ${payout.npub.substring(0, 12)}`);
          results.push({
            npub: payout.npub,
            amountSats: payout.amountSats,
            success: true,
          });
          totalPaid += payout.amountSats;
        } else {
          console.log(`[AutoPayout] ❌ Payment failed: ${zapResult.error}`);
          results.push({
            npub: payout.npub,
            amountSats: payout.amountSats,
            success: false,
            error: zapResult.error,
          });
          totalFailed++;
        }
      } catch (error) {
        console.error(`[AutoPayout] Error paying ${payout.npub}:`, error);
        results.push({
          npub: payout.npub,
          amountSats: payout.amountSats,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        totalFailed++;
      }

      // Small delay between payments to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Determine final status
    const finalStatus: PayoutStatus['status'] =
      totalFailed === 0
        ? 'completed'
        : totalFailed === payouts.length
          ? 'failed'
          : 'partial';

    // Update final status
    await this.updatePayoutStatus(event.id, {
      eventId: event.id,
      status: finalStatus,
      totalPrize: event.prizePoolSats || 0,
      paidAmount: totalPaid,
      results,
      startedAt: Math.floor(Date.now() / 1000),
      completedAt: Math.floor(Date.now() / 1000),
    });

    console.log(
      `[AutoPayout] Payout execution complete: ${totalPaid} sats paid, ` +
        `${totalFailed} failed, status: ${finalStatus}`
    );

    return {
      eventId: event.id,
      totalPaid,
      totalFailed,
      results,
      executedAt: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Check if event has been paid out
   */
  async getPayoutStatus(eventId: string): Promise<PayoutStatus | null> {
    try {
      const key = `${PAYOUT_STATUS_PREFIX}${eventId}`;
      const stored = await AsyncStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('[AutoPayout] Error getting payout status:', error);
      return null;
    }
  }

  /**
   * Update payout status in storage
   */
  private async updatePayoutStatus(
    eventId: string,
    status: PayoutStatus
  ): Promise<void> {
    try {
      const key = `${PAYOUT_STATUS_PREFIX}${eventId}`;
      await AsyncStorage.setItem(key, JSON.stringify(status));
    } catch (error) {
      console.error('[AutoPayout] Error saving payout status:', error);
    }
  }

  /**
   * Check if event is eligible for auto-payout
   */
  canAutoPayoutEvent(event: SatlantisEvent): {
    canPayout: boolean;
    reason?: string;
  } {
    // Check if event has ended
    const now = Math.floor(Date.now() / 1000);
    if (now <= event.endTime) {
      return { canPayout: false, reason: 'Event has not ended yet' };
    }

    // Check if has prize pool
    if (!event.prizePoolSats || event.prizePoolSats <= 0) {
      return { canPayout: false, reason: 'No prize pool configured' };
    }

    // Check if creator has NWC (for auto-payout)
    if (!event.creatorHasNWC) {
      return { canPayout: false, reason: 'Creator wallet not configured' };
    }

    return { canPayout: true };
  }

  /**
   * Get payout scheme description for display
   */
  getPayoutSchemeDescription(scheme: RunstrPayoutScheme): string {
    switch (scheme) {
      case 'winner_takes_all':
        return '1st place wins entire prize pool';
      case 'top_3_split':
        return '60% / 25% / 15% split for top 3';
      case 'random_lottery':
        return 'Random participant wins prize pool';
      case 'fixed_amount':
        return 'Fixed amount per participant';
      default:
        return 'Unknown payout scheme';
    }
  }
}

// Export singleton instance
export const RunstrAutoPayoutService = RunstrAutoPayoutServiceClass.getInstance();
export default RunstrAutoPayoutService;
