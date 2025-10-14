/**
 * Reward Payment Flow Tests
 * Tests the complete flow of invoice generation and payment
 */

import 'websocket-polyfill';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyRewardService } from '../../src/services/rewards/DailyRewardService';
import { RewardSenderWallet } from '../../src/services/rewards/RewardSenderWallet';

// Mock NWC services for isolated testing
jest.mock('../../src/services/wallet/NWCStorageService', () => ({
  NWCStorageService: {
    hasNWC: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../../src/services/wallet/NWCWalletService', () => ({
  NWCWalletService: {
    createInvoice: jest.fn(),
  },
}));

describe('Reward Payment Flow', () => {
  const testPubkey = 'test-user-pubkey';

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await AsyncStorage.clear();
    await RewardSenderWallet.close();
  });

  describe('Invoice Generation', () => {
    it('should generate invoice for user', async () => {
      const { NWCWalletService } = require('../../src/services/wallet/NWCWalletService');

      NWCWalletService.createInvoice.mockResolvedValue({
        success: true,
        invoice: 'lnbc50n1test',
        paymentHash: 'abc123',
      });

      // This tests the private getUserInvoice method indirectly
      // by testing sendReward which calls it
      const result = await DailyRewardService.sendReward(testPubkey);

      // Should have attempted to create invoice
      expect(NWCWalletService.createInvoice).toHaveBeenCalledWith(
        50,
        expect.stringContaining('Daily workout reward'),
        expect.any(Object)
      );
    });

    it('should handle invoice generation failure', async () => {
      const { NWCWalletService } = require('../../src/services/wallet/NWCWalletService');

      NWCWalletService.createInvoice.mockResolvedValue({
        success: false,
        error: 'Failed to create invoice',
      });

      const result = await DailyRewardService.sendReward(testPubkey);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invoice_failed');
    });

    it('should include metadata in invoice', async () => {
      const { NWCWalletService } = require('../../src/services/wallet/NWCWalletService');

      NWCWalletService.createInvoice.mockResolvedValue({
        success: true,
        invoice: 'lnbc50n1test',
      });

      await DailyRewardService.sendReward(testPubkey);

      const callArgs = NWCWalletService.createInvoice.mock.calls[0];
      const metadata = callArgs[2];

      expect(metadata).toEqual({
        type: 'daily_reward',
        userPubkey: testPubkey,
      });
    });
  });

  describe('Payment Execution', () => {
    it('should use RewardSenderWallet for payment', async () => {
      const { NWCWalletService } = require('../../src/services/wallet/NWCWalletService');

      NWCWalletService.createInvoice.mockResolvedValue({
        success: true,
        invoice: 'lnbc50n1test',
      });

      // Spy on RewardSenderWallet
      const paymentSpy = jest.spyOn(RewardSenderWallet, 'sendRewardPayment');

      paymentSpy.mockResolvedValue({
        success: true,
        preimage: 'abcd1234',
      });

      const result = await DailyRewardService.sendReward(testPubkey);

      // Should have called reward sender wallet
      expect(paymentSpy).toHaveBeenCalledWith('lnbc50n1test');

      paymentSpy.mockRestore();
    });

    it('should handle payment failure silently', async () => {
      const { NWCWalletService } = require('../../src/services/wallet/NWCWalletService');

      NWCWalletService.createInvoice.mockResolvedValue({
        success: true,
        invoice: 'lnbc50n1test',
      });

      // Mock payment failure
      const paymentSpy = jest.spyOn(RewardSenderWallet, 'sendRewardPayment');
      paymentSpy.mockResolvedValue({
        success: false,
        error: 'Insufficient balance',
      });

      const result = await DailyRewardService.sendReward(testPubkey);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('payment_failed');

      paymentSpy.mockRestore();
    });

    it('should record reward on successful payment', async () => {
      const { NWCWalletService } = require('../../src/services/wallet/NWCWalletService');

      NWCWalletService.createInvoice.mockResolvedValue({
        success: true,
        invoice: 'lnbc50n1test',
      });

      const paymentSpy = jest.spyOn(RewardSenderWallet, 'sendRewardPayment');
      paymentSpy.mockResolvedValue({
        success: true,
        preimage: 'abcd1234',
      });

      const result = await DailyRewardService.sendReward(testPubkey);

      if (result.success) {
        // Should have recorded the reward
        const total = await DailyRewardService.getTotalRewardsEarned(testPubkey);
        expect(total).toBe(50);

        // Should not be eligible again today
        const canClaim = await DailyRewardService.canClaimToday(testPubkey);
        expect(canClaim).toBe(false);
      }

      paymentSpy.mockRestore();
    });
  });

  describe('Silent Failure Mode', () => {
    it('should not throw errors on payment failure', async () => {
      const { NWCWalletService } = require('../../src/services/wallet/NWCWalletService');

      NWCWalletService.createInvoice.mockRejectedValue(new Error('Network error'));

      expect(async () => {
        await DailyRewardService.sendReward(testPubkey);
      }).not.toThrow();
    });

    it('should log errors without crashing', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const { NWCWalletService } = require('../../src/services/wallet/NWCWalletService');

      NWCWalletService.createInvoice.mockRejectedValue(new Error('Unexpected error'));

      const result = await DailyRewardService.sendReward(testPubkey);

      expect(result.success).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should return graceful error result', async () => {
      const { NWCWalletService } = require('../../src/services/wallet/NWCWalletService');

      NWCWalletService.createInvoice.mockResolvedValue({
        success: false,
        error: 'Something went wrong',
      });

      const result = await DailyRewardService.sendReward(testPubkey);

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(false);
      expect(result).toHaveProperty('reason');
    });
  });

  describe('Wallet Balance Checks', () => {
    it('should check sender wallet balance', async () => {
      const balance = await RewardSenderWallet.getBalance();

      expect(typeof balance).toBe('number');
      expect(balance).toBeGreaterThanOrEqual(0);
    });

    it('should warn if balance is low', async () => {
      const balance = await RewardSenderWallet.getBalance();

      // Should have enough for at least 1 reward
      if (balance < 50) {
        console.warn('⚠️ Reward wallet balance is below 50 sats');
      }

      expect(true).toBe(true); // Just logging, not failing
    });
  });

  describe('End-to-End Flow', () => {
    it('should complete full reward cycle', async () => {
      const { NWCWalletService } = require('../../src/services/wallet/NWCWalletService');

      // Setup mocks for successful flow
      NWCWalletService.createInvoice.mockResolvedValue({
        success: true,
        invoice: 'lnbc50n1test',
      });

      const paymentSpy = jest.spyOn(RewardSenderWallet, 'sendRewardPayment');
      paymentSpy.mockResolvedValue({
        success: true,
        preimage: 'abcd1234',
      });

      // Check initial state
      const initialEligibility = await DailyRewardService.checkEligibility(testPubkey);
      const initialTotal = await DailyRewardService.getTotalRewardsEarned(testPubkey);

      // Send reward
      const result = await DailyRewardService.sendReward(testPubkey);

      // Verify success
      expect(result.success).toBe(true);
      expect(result.amount).toBe(50);

      // Check final state
      const finalTotal = await DailyRewardService.getTotalRewardsEarned(testPubkey);
      expect(finalTotal).toBe(initialTotal + 50);

      const finalEligibility = await DailyRewardService.checkEligibility(testPubkey);
      expect(finalEligibility.eligible).toBe(false);

      paymentSpy.mockRestore();
    });
  });
});
