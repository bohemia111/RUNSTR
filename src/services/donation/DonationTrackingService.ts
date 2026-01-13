/**
 * DonationTrackingService - Track and forward charitable donations
 *
 * When users donate to a charity via the app:
 * 1. Payment goes to RUNSTR's NWC wallet
 * 2. This service records the donation (donor, amount, charity)
 * 3. Forwards the donation to the charity's Lightning address
 * 4. Enables donation leaderboards per charity
 *
 * Storage: @runstr:charity_donations:{charityId}
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NWCGatewayService } from '../rewards/NWCGatewayService';
import { getInvoiceFromLightningAddress } from '../../utils/lnurl';
import { getCharityById } from '../../constants/charities';

const STORAGE_PREFIX = '@runstr:charity_donations:';
const FORWARD_QUEUE_KEY = '@runstr:donation_forward_queue';

export interface DonationRecord {
  id: string;
  donorPubkey: string;
  donorName?: string;
  amount: number; // sats
  charityId: string;
  charityName: string;
  timestamp: number;
  forwardedAt?: number;
  forwardFailed?: boolean;
  paymentHash?: string;
}

export interface DonationLeaderboardEntry {
  donorPubkey: string;
  donorName?: string;
  totalAmount: number;
  donationCount: number;
  lastDonationAt: number;
}

interface QueuedForward {
  donationId: string;
  charityId: string;
  charityLightningAddress: string;
  amount: number;
  donorName?: string;
  retryCount: number;
  createdAt: number;
}

class DonationTrackingServiceClass {
  private static instance: DonationTrackingServiceClass;

  static getInstance(): DonationTrackingServiceClass {
    if (!this.instance) {
      this.instance = new DonationTrackingServiceClass();
    }
    return this.instance;
  }

  /**
   * Record a donation (without forwarding)
   * Used for daily reward charity donations that are already paid
   */
  async recordDonation(params: {
    donorPubkey: string;
    donorName?: string;
    amount: number;
    charityId: string;
    charityName?: string;
  }): Promise<void> {
    const { donorPubkey, donorName, amount, charityId, charityName } = params;

    // Get charity info if name not provided
    const charity = getCharityById(charityId);
    const resolvedCharityName = charityName || charity?.name || charityId;

    console.log(`[DonationTracking] Recording donation: ${amount} sats to ${resolvedCharityName}`);

    // Create donation record
    const donation: DonationRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      donorPubkey,
      donorName,
      amount,
      charityId,
      charityName: resolvedCharityName,
      timestamp: Date.now(),
      forwardedAt: Date.now(), // Mark as already forwarded (paid directly)
    };

    // Save donation record
    await this.saveDonation(donation);
    console.log(`[DonationTracking] Donation recorded: ${donation.id}`);
  }

  /**
   * Record a donation and forward to charity
   */
  async recordAndForward(params: {
    donorPubkey: string;
    donorName?: string;
    amount: number;
    charityId: string;
    charityLightningAddress: string;
    paymentHash?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { donorPubkey, donorName, amount, charityId, charityLightningAddress, paymentHash } = params;

    console.log(`[DonationTracking] Recording donation: ${amount} sats to ${charityId} from ${donorPubkey.slice(0, 12)}...`);

    // Get charity info
    const charity = getCharityById(charityId);
    const charityName = charity?.name || charityId;

    // Create donation record
    const donation: DonationRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      donorPubkey,
      donorName,
      amount,
      charityId,
      charityName,
      timestamp: Date.now(),
      paymentHash,
    };

    // Save donation record
    await this.saveDonation(donation);
    console.log(`[DonationTracking] Donation recorded: ${donation.id}`);

    // Forward to charity
    try {
      const forwardResult = await this.forwardToCharity(
        donation.id,
        charityLightningAddress,
        amount,
        donorName
      );

      if (forwardResult.success) {
        // Mark as forwarded
        donation.forwardedAt = Date.now();
        await this.saveDonation(donation);
        console.log(`[DonationTracking] Donation forwarded successfully`);
        return { success: true };
      } else {
        // Queue for retry
        donation.forwardFailed = true;
        await this.saveDonation(donation);
        await this.queueForRetry({
          donationId: donation.id,
          charityId,
          charityLightningAddress,
          amount,
          donorName,
          retryCount: 0,
          createdAt: Date.now(),
        });
        console.warn(`[DonationTracking] Forward failed, queued for retry: ${forwardResult.error}`);
        return { success: true }; // Still success for the donation recording
      }
    } catch (error) {
      console.error(`[DonationTracking] Forward error:`, error);
      donation.forwardFailed = true;
      await this.saveDonation(donation);
      await this.queueForRetry({
        donationId: donation.id,
        charityId,
        charityLightningAddress,
        amount,
        donorName,
        retryCount: 0,
        createdAt: Date.now(),
      });
      return { success: true }; // Still success for the donation recording
    }
  }

  /**
   * Forward donation to charity's Lightning address
   */
  private async forwardToCharity(
    _donationId: string,
    charityLightningAddress: string,
    amount: number,
    donorName?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Create memo with donor attribution
      const memo = donorName
        ? `RUNSTR Donation from @${donorName}`
        : `RUNSTR Donation`;

      console.log(`[DonationTracking] Requesting invoice from ${charityLightningAddress} for ${amount} sats`);

      // Get invoice from charity's Lightning address
      const { invoice } = await getInvoiceFromLightningAddress(
        charityLightningAddress,
        amount,
        memo
      );

      if (!invoice) {
        return { success: false, error: 'Failed to get invoice' };
      }

      // Pay the invoice using RUNSTR's wallet (which received the donation)
      console.log(`[DonationTracking] Paying invoice via NWCGatewayService...`);
      const paymentResult = await NWCGatewayService.payInvoice(invoice);

      if (paymentResult.success) {
        console.log(`[DonationTracking] ✅ Payment forwarded to charity: ${paymentResult.preimage?.slice(0, 16)}...`);
        return { success: true };
      } else {
        return { success: false, error: paymentResult.error || 'Payment failed' };
      }
    } catch (error: any) {
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Get donation leaderboard for a charity
   * Aggregates donations by donor and sorts by total amount
   */
  async getDonationLeaderboard(charityId: string): Promise<DonationLeaderboardEntry[]> {
    const donations = await this.getDonations(charityId);

    // Aggregate by donor
    const donorTotals = new Map<string, DonationLeaderboardEntry>();

    for (const donation of donations) {
      const existing = donorTotals.get(donation.donorPubkey);

      if (existing) {
        existing.totalAmount += donation.amount;
        existing.donationCount += 1;
        if (donation.timestamp > existing.lastDonationAt) {
          existing.lastDonationAt = donation.timestamp;
          // Update name if we have a newer one
          if (donation.donorName) {
            existing.donorName = donation.donorName;
          }
        }
      } else {
        donorTotals.set(donation.donorPubkey, {
          donorPubkey: donation.donorPubkey,
          donorName: donation.donorName,
          totalAmount: donation.amount,
          donationCount: 1,
          lastDonationAt: donation.timestamp,
        });
      }
    }

    // Convert to array and sort by total amount (descending)
    const leaderboard = Array.from(donorTotals.values());
    leaderboard.sort((a, b) => b.totalAmount - a.totalAmount);

    return leaderboard;
  }

  /**
   * Get total donated to a charity
   */
  async getTotalDonated(charityId: string): Promise<number> {
    const donations = await this.getDonations(charityId);
    return donations.reduce((sum, d) => sum + d.amount, 0);
  }

  /**
   * Get a user's total donations to a charity
   */
  async getUserDonationTotal(charityId: string, pubkey: string): Promise<number> {
    const donations = await this.getDonations(charityId);
    return donations
      .filter(d => d.donorPubkey === pubkey)
      .reduce((sum, d) => sum + d.amount, 0);
  }

  /**
   * Get all donations for a charity
   */
  async getDonations(charityId: string): Promise<DonationRecord[]> {
    try {
      const key = `${STORAGE_PREFIX}${charityId}`;
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error(`[DonationTracking] Error loading donations:`, error);
      return [];
    }
  }

  /**
   * Save a donation record
   */
  private async saveDonation(donation: DonationRecord): Promise<void> {
    const key = `${STORAGE_PREFIX}${donation.charityId}`;
    const existing = await this.getDonations(donation.charityId);

    // Find and update or add
    const index = existing.findIndex(d => d.id === donation.id);
    if (index >= 0) {
      existing[index] = donation;
    } else {
      existing.push(donation);
    }

    // Keep only last 1000 donations per charity
    const trimmed = existing.slice(-1000);

    await AsyncStorage.setItem(key, JSON.stringify(trimmed));
  }

  /**
   * Queue a failed forward for retry
   */
  private async queueForRetry(item: QueuedForward): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(FORWARD_QUEUE_KEY);
      const queue: QueuedForward[] = stored ? JSON.parse(stored) : [];
      queue.push(item);
      await AsyncStorage.setItem(FORWARD_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error(`[DonationTracking] Error queueing for retry:`, error);
    }
  }

  /**
   * Get all donations across all charities (for global leaderboard)
   */
  async getAllCharityDonations(): Promise<DonationRecord[]> {
    try {
      // Get all storage keys
      const allKeys = await AsyncStorage.getAllKeys();
      const donationKeys = allKeys.filter(k => k.startsWith(STORAGE_PREFIX));

      const allDonations: DonationRecord[] = [];

      for (const key of donationKeys) {
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const donations: DonationRecord[] = JSON.parse(stored);
          allDonations.push(...donations);
        }
      }

      // Sort by timestamp (newest first)
      return allDonations.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('[DonationTracking] Error getting all donations:', error);
      return [];
    }
  }

  /**
   * Get total donated across all charities
   */
  async getGlobalDonationTotal(): Promise<number> {
    const allDonations = await this.getAllCharityDonations();
    return allDonations.reduce((sum, d) => sum + d.amount, 0);
  }

  /**
   * Get summary of donations by charity (for leaderboard display)
   */
  async getCharitySummaries(): Promise<Array<{
    charityId: string;
    charityName: string;
    totalAmount: number;
    donationCount: number;
  }>> {
    try {
      const allDonations = await this.getAllCharityDonations();

      const charityMap = new Map<string, {
        charityId: string;
        charityName: string;
        totalAmount: number;
        donationCount: number;
      }>();

      for (const donation of allDonations) {
        const existing = charityMap.get(donation.charityId);
        if (existing) {
          existing.totalAmount += donation.amount;
          existing.donationCount += 1;
        } else {
          charityMap.set(donation.charityId, {
            charityId: donation.charityId,
            charityName: donation.charityName,
            totalAmount: donation.amount,
            donationCount: 1,
          });
        }
      }

      // Sort by total amount descending
      return Array.from(charityMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount);
    } catch (error) {
      console.error('[DonationTracking] Error getting charity summaries:', error);
      return [];
    }
  }

  /**
   * Process retry queue (called on app startup)
   */
  async processRetryQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(FORWARD_QUEUE_KEY);
      if (!stored) return;

      const queue: QueuedForward[] = JSON.parse(stored);
      if (queue.length === 0) return;

      console.log(`[DonationTracking] Processing retry queue: ${queue.length} items`);

      const remaining: QueuedForward[] = [];

      for (const item of queue) {
        if (item.retryCount >= 3) {
          console.warn(`[DonationTracking] Max retries exceeded for donation ${item.donationId}`);
          continue; // Drop after 3 retries
        }

        const result = await this.forwardToCharity(
          item.donationId,
          item.charityLightningAddress,
          item.amount,
          item.donorName
        );

        if (result.success) {
          // Mark donation as forwarded
          const donations = await this.getDonations(item.charityId);
          const donation = donations.find(d => d.id === item.donationId);
          if (donation) {
            donation.forwardedAt = Date.now();
            donation.forwardFailed = false;
            await this.saveDonation(donation);
          }
          console.log(`[DonationTracking] Retry successful for ${item.donationId}`);
        } else {
          // Keep in queue with incremented retry count
          item.retryCount += 1;
          remaining.push(item);
          console.warn(`[DonationTracking] Retry failed for ${item.donationId}: ${result.error}`);
        }
      }

      // Save remaining queue
      await AsyncStorage.setItem(FORWARD_QUEUE_KEY, JSON.stringify(remaining));
      console.log(`[DonationTracking] Retry queue processed: ${queue.length - remaining.length} succeeded, ${remaining.length} remaining`);
    } catch (error) {
      console.error(`[DonationTracking] Error processing retry queue:`, error);
    }
  }
}

// Export singleton instance
export const DonationTrackingService = DonationTrackingServiceClass.getInstance();
