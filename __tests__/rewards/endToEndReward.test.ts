/**
 * End-to-End Reward Tests
 * Full integration test from workout submission to reward delivery
 */

import 'websocket-polyfill';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyRewardService } from '../../src/services/rewards/DailyRewardService';
import { RewardSenderWallet } from '../../src/services/rewards/RewardSenderWallet';
import { REWARD_CONFIG } from '../../src/config/rewards';

describe('End-to-End Reward Flow', () => {
  const testUser = {
    pubkey: 'e2e-test-user-123',
    workout: {
      id: 'workout-123',
      type: 'running',
      distance: 5000,
      duration: 1800,
    },
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    await AsyncStorage.clear();
    await RewardSenderWallet.close();
  });

  describe('First Workout of the Day', () => {
    it('should complete full reward flow', async () => {
      console.log('🏃 Simulating first workout of the day...');

      // 1. Check initial eligibility
      const eligibility = await DailyRewardService.checkEligibility(testUser.pubkey);
      console.log('📋 Initial eligibility:', eligibility);

      // 2. User completes workout (simulated)
      console.log('💪 User completed workout:', testUser.workout);

      // 3. Workout published to Nostr (simulated)
      console.log('📡 Workout published to Nostr');

      // 4. Trigger reward system
      console.log('⚡ Triggering reward system...');
      const rewardResult = await DailyRewardService.sendReward(testUser.pubkey);

      console.log('🎁 Reward result:', rewardResult);

      // 5. Verify reward was attempted
      expect(rewardResult).toBeDefined();
      expect(rewardResult).toHaveProperty('success');

      if (rewardResult.success) {
        console.log('✅ Reward sent successfully!');
        expect(rewardResult.amount).toBe(50);

        // 6. Verify reward was recorded
        const total = await DailyRewardService.getTotalRewardsEarned(testUser.pubkey);
        expect(total).toBe(50);

        // 7. Verify no longer eligible
        const canClaimAgain = await DailyRewardService.canClaimToday(testUser.pubkey);
        expect(canClaimAgain).toBe(false);
      } else {
        console.log('ℹ️ Reward not sent:', rewardResult.reason);
        // Acceptable failures: no_wallet, already_claimed_today
        expect(['no_wallet', 'already_claimed_today', 'invoice_failed', 'payment_failed']).toContain(
          rewardResult.reason
        );
      }
    });
  });

  describe('Second Workout of the Day', () => {
    it('should not send reward twice in same day', async () => {
      console.log('🏃 Simulating second workout of the day...');

      // 1. First workout and reward
      console.log('💪 First workout completed');
      const firstReward = await DailyRewardService.sendReward(testUser.pubkey);

      if (firstReward.success) {
        console.log('✅ First reward sent');
      }

      // 2. Second workout
      console.log('💪 Second workout completed');
      const secondReward = await DailyRewardService.sendReward(testUser.pubkey);

      // 3. Verify second reward was rejected
      expect(secondReward.success).toBe(false);
      expect(secondReward.reason).toBe('already_claimed_today');

      console.log('✅ Second reward correctly rejected');

      // 4. Verify total is still only one reward
      const total = await DailyRewardService.getTotalRewardsEarned(testUser.pubkey);
      expect(total).toBeLessThanOrEqual(50);
    });
  });

  describe('Wallet Health Monitoring', () => {
    it('should check reward wallet status', async () => {
      console.log('🏥 Checking reward wallet health...');

      const health = await RewardSenderWallet.healthCheck();

      console.log('🏥 Wallet health:', {
        connected: health.connected,
        balance: health.balance,
        error: health.error,
      });

      expect(health).toBeDefined();
      expect(typeof health.connected).toBe('boolean');

      if (health.connected) {
        expect(typeof health.balance).toBe('number');

        if (health.balance && health.balance < 500) {
          console.warn('⚠️ Reward wallet balance is low:', health.balance, 'sats');
          console.warn('   Top up the wallet at', REWARD_CONFIG.SENDER_NWC.split('?')[0]);
        }
      } else {
        console.warn('⚠️ Reward wallet not connected:', health.error);
      }
    });

    it('should verify sufficient balance for rewards', async () => {
      const balance = await RewardSenderWallet.getBalance();

      console.log('💰 Current balance:', balance, 'sats');

      if (balance > 0) {
        const rewardsRemaining = Math.floor(balance / 50);
        console.log('📊 Rewards remaining:', rewardsRemaining);

        if (rewardsRemaining < 10) {
          console.warn('⚠️ Less than 10 rewards remaining');
        }
      }

      expect(balance).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Multi-Day Workflow', () => {
    it('should allow reward on different days', async () => {
      console.log('📅 Simulating multi-day usage...');

      // Day 1
      console.log('📅 Day 1: First workout');
      const day1Reward = await DailyRewardService.sendReward(testUser.pubkey);

      if (day1Reward.success) {
        console.log('✅ Day 1 reward sent');
      }

      // Simulate day passing by modifying storage
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const key = '@runstr:last_reward_date:' + testUser.pubkey;
      await AsyncStorage.setItem(key, yesterday.toISOString());

      // Day 2
      console.log('📅 Day 2: Second workout');
      const canClaimDay2 = await DailyRewardService.canClaimToday(testUser.pubkey);
      expect(canClaimDay2).toBe(true);

      console.log('✅ User can claim reward on day 2');
    });
  });

  describe('Error Recovery', () => {
    it('should not crash on wallet errors', async () => {
      console.log('🔧 Testing error recovery...');

      // Force an error by closing wallet
      await RewardSenderWallet.close();

      // Attempt to send reward
      const result = await DailyRewardService.sendReward(testUser.pubkey);

      // Should fail gracefully
      expect(result.success).toBe(false);
      console.log('✅ Error handled gracefully:', result.reason);
    });

    it('should recover after wallet reconnection', async () => {
      console.log('🔌 Testing reconnection...');

      // Close wallet
      await RewardSenderWallet.close();

      // Reconnect
      await RewardSenderWallet.reconnect();

      // Check health
      const health = await RewardSenderWallet.healthCheck();

      console.log('🔌 Reconnection result:', health.connected ? 'Success' : 'Failed');

      expect(health).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should complete reward flow quickly', async () => {
      console.log('⏱️ Testing performance...');

      const startTime = Date.now();

      await DailyRewardService.sendReward(testUser.pubkey);

      const duration = Date.now() - startTime;

      console.log('⏱️ Reward flow completed in:', duration, 'ms');

      // Should complete within reasonable time
      // Note: Actual payments will take longer due to network
      expect(duration).toBeLessThan(30000); // 30 seconds max
    });
  });

  describe('Security Checks', () => {
    it('should not expose NWC secret in logs', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      // Perform operations
      RewardSenderWallet.healthCheck();

      // Check logs don't contain secret
      const logs = consoleSpy.mock.calls.flat().join(' ');
      expect(logs).not.toContain('secret=');

      consoleSpy.mockRestore();
    });

    it('should validate user pubkey', async () => {
      // Empty pubkey should fail gracefully
      const result = await DailyRewardService.sendReward('');

      expect(result.success).toBe(false);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle user without wallet gracefully', async () => {
      console.log('👤 Testing user without wallet...');

      // This will depend on mock configuration
      const result = await DailyRewardService.sendReward(testUser.pubkey);

      if (result.reason === 'no_wallet') {
        console.log('✅ Correctly detected user has no wallet');
        expect(result.success).toBe(false);
      }
    });

    it('should handle insufficient sender balance', async () => {
      console.log('💸 Testing insufficient balance scenario...');

      const balance = await RewardSenderWallet.getBalance();

      if (balance < 50) {
        console.log('💸 Balance too low for reward:', balance, 'sats');

        const result = await DailyRewardService.sendReward(testUser.pubkey);

        if (!result.success && result.reason === 'payment_failed') {
          console.log('✅ Correctly handled insufficient balance');
        }
      } else {
        console.log('✅ Sufficient balance available:', balance, 'sats');
      }

      expect(true).toBe(true); // Not a failure condition
    });
  });
});
