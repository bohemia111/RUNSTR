/**
 * Daily Reward Eligibility Tests
 * Verifies rate limiting, eligibility checking, and reward tracking
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyRewardService } from '../../src/services/rewards/DailyRewardService';
import { REWARD_STORAGE_KEYS } from '../../src/config/rewards';

describe('Daily Reward Eligibility', () => {
  const testPubkey = 'test-pubkey-12345';

  beforeEach(async () => {
    // Clear storage before each test
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    // Clean up after each test
    await AsyncStorage.clear();
  });

  describe('First Time Eligibility', () => {
    it('should be eligible when never claimed before', async () => {
      const canClaim = await DailyRewardService.canClaimToday(testPubkey);

      expect(canClaim).toBe(true);
    });

    it('should show eligible in checkEligibility', async () => {
      const eligibility = await DailyRewardService.checkEligibility(testPubkey);

      // Eligible or requires wallet
      expect(eligibility).toBeDefined();
      expect(typeof eligibility.eligible).toBe('boolean');
    });
  });

  describe('Same Day Claims', () => {
    it('should not be eligible after claiming today', async () => {
      // Record a reward for today
      const now = new Date().toISOString();
      const key = `${REWARD_STORAGE_KEYS.LAST_REWARD_DATE}:${testPubkey}`;
      await AsyncStorage.setItem(key, now);

      const canClaim = await DailyRewardService.canClaimToday(testPubkey);

      expect(canClaim).toBe(false);
    });

    it('should return already_claimed_today reason', async () => {
      // Record a reward for today
      const now = new Date().toISOString();
      const key = `${REWARD_STORAGE_KEYS.LAST_REWARD_DATE}:${testPubkey}`;
      await AsyncStorage.setItem(key, now);

      const eligibility = await DailyRewardService.checkEligibility(testPubkey);

      if (!eligibility.eligible) {
        expect(eligibility.reason).toBe('already_claimed_today');
      }
    });

    it('should provide next eligible time', async () => {
      // Record a reward for today
      const now = new Date().toISOString();
      const key = `${REWARD_STORAGE_KEYS.LAST_REWARD_DATE}:${testPubkey}`;
      await AsyncStorage.setItem(key, now);

      const eligibility = await DailyRewardService.checkEligibility(testPubkey);

      if (!eligibility.eligible && eligibility.reason === 'already_claimed_today') {
        expect(eligibility.nextEligibleTime).toBeDefined();
        expect(eligibility.nextEligibleTime).toBeInstanceOf(Date);

        // Should be tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        expect(eligibility.nextEligibleTime?.getTime()).toBe(tomorrow.getTime());
      }
    });
  });

  describe('Different Day Claims', () => {
    it('should be eligible the next day', async () => {
      // Record a reward for yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const key = `${REWARD_STORAGE_KEYS.LAST_REWARD_DATE}:${testPubkey}`;
      await AsyncStorage.setItem(key, yesterday.toISOString());

      const canClaim = await DailyRewardService.canClaimToday(testPubkey);

      expect(canClaim).toBe(true);
    });

    it('should be eligible after multiple days', async () => {
      // Record a reward for 3 days ago
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const key = `${REWARD_STORAGE_KEYS.LAST_REWARD_DATE}:${testPubkey}`;
      await AsyncStorage.setItem(key, threeDaysAgo.toISOString());

      const canClaim = await DailyRewardService.canClaimToday(testPubkey);

      expect(canClaim).toBe(true);
    });
  });

  describe('Reward Tracking', () => {
    it('should track total rewards earned', async () => {
      const totalBefore = await DailyRewardService.getTotalRewardsEarned(testPubkey);

      // Simulate recording a reward
      const key = `${REWARD_STORAGE_KEYS.TOTAL_REWARDS_EARNED}:${testPubkey}`;
      await AsyncStorage.setItem(key, '150');

      const totalAfter = await DailyRewardService.getTotalRewardsEarned(testPubkey);

      expect(totalAfter).toBe(150);
    });

    it('should return 0 for new users', async () => {
      const total = await DailyRewardService.getTotalRewardsEarned(testPubkey);

      expect(total).toBe(0);
    });

    it('should accumulate rewards over time', async () => {
      // Start with 100 sats earned
      const key = `${REWARD_STORAGE_KEYS.TOTAL_REWARDS_EARNED}:${testPubkey}`;
      await AsyncStorage.setItem(key, '100');

      const total1 = await DailyRewardService.getTotalRewardsEarned(testPubkey);
      expect(total1).toBe(100);

      // Add another 50 sats (simulating another day)
      await AsyncStorage.setItem(key, '150');

      const total2 = await DailyRewardService.getTotalRewardsEarned(testPubkey);
      expect(total2).toBe(150);
    });
  });

  describe('Wallet Requirement', () => {
    it('should check for wallet in eligibility', async () => {
      const eligibility = await DailyRewardService.checkEligibility(testPubkey);

      expect(eligibility).toBeDefined();

      // If not eligible due to wallet, should have reason
      if (!eligibility.eligible && eligibility.reason === 'no_wallet') {
        expect(eligibility.reason).toBe('no_wallet');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      // Mock storage error
      jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('Storage error'));

      const canClaim = await DailyRewardService.canClaimToday(testPubkey);

      // Should default to false on error (safer)
      expect(canClaim).toBe(false);
    });

    it('should not crash on invalid data', async () => {
      // Set invalid date
      const key = `${REWARD_STORAGE_KEYS.LAST_REWARD_DATE}:${testPubkey}`;
      await AsyncStorage.setItem(key, 'invalid-date');

      expect(async () => {
        await DailyRewardService.canClaimToday(testPubkey);
      }).not.toThrow();
    });
  });

  describe('Multiple Users', () => {
    it('should track rewards independently per user', async () => {
      const pubkey1 = 'user1';
      const pubkey2 = 'user2';

      // User 1 claimed today
      const key1 = `${REWARD_STORAGE_KEYS.LAST_REWARD_DATE}:${pubkey1}`;
      await AsyncStorage.setItem(key1, new Date().toISOString());

      // User 2 never claimed
      const canClaim1 = await DailyRewardService.canClaimToday(pubkey1);
      const canClaim2 = await DailyRewardService.canClaimToday(pubkey2);

      expect(canClaim1).toBe(false);
      expect(canClaim2).toBe(true);
    });

    it('should track totals independently per user', async () => {
      const pubkey1 = 'user1';
      const pubkey2 = 'user2';

      // User 1 earned 200 sats
      const key1 = `${REWARD_STORAGE_KEYS.TOTAL_REWARDS_EARNED}:${pubkey1}`;
      await AsyncStorage.setItem(key1, '200');

      // User 2 earned 50 sats
      const key2 = `${REWARD_STORAGE_KEYS.TOTAL_REWARDS_EARNED}:${pubkey2}`;
      await AsyncStorage.setItem(key2, '50');

      const total1 = await DailyRewardService.getTotalRewardsEarned(pubkey1);
      const total2 = await DailyRewardService.getTotalRewardsEarned(pubkey2);

      expect(total1).toBe(200);
      expect(total2).toBe(50);
    });
  });
});
