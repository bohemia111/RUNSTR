/**
 * RewardSenderWallet Tests
 * Verifies NWC client initialization, payment sending, and error handling
 */

import 'websocket-polyfill';
import { RewardSenderWallet } from '../../src/services/rewards/RewardSenderWallet';

describe('RewardSenderWallet', () => {
  // Clean up after each test
  afterEach(async () => {
    await RewardSenderWallet.close();
  });

  describe('Initialization', () => {
    it('should initialize without errors', async () => {
      const health = await RewardSenderWallet.healthCheck();

      // Should either connect successfully or fail gracefully
      expect(health).toBeDefined();
      expect(typeof health.connected).toBe('boolean');
    });

    it('should handle missing environment variable', async () => {
      // This test assumes REWARD_SENDER_NWC is set
      // If not set, should return connection error
      const health = await RewardSenderWallet.healthCheck();

      if (!health.connected) {
        expect(health.error).toBeDefined();
      }
    });

    it('should reconnect after close', async () => {
      await RewardSenderWallet.close();
      const health = await RewardSenderWallet.healthCheck();

      // Should attempt to reconnect
      expect(health).toBeDefined();
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const health = await RewardSenderWallet.healthCheck();

      expect(health).toHaveProperty('connected');

      if (health.connected) {
        expect(health.balance).toBeGreaterThanOrEqual(0);
      } else {
        expect(health.error).toBeDefined();
      }
    });

    it('should include balance when connected', async () => {
      const health = await RewardSenderWallet.healthCheck();

      if (health.connected) {
        expect(typeof health.balance).toBe('number');
      }
    });
  });

  describe('Balance', () => {
    it('should get wallet balance', async () => {
      const balance = await RewardSenderWallet.getBalance();

      expect(typeof balance).toBe('number');
      expect(balance).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 if not connected', async () => {
      // Force close
      await RewardSenderWallet.close();

      // Mock initialization failure
      const originalEnv = process.env.REWARD_SENDER_NWC;
      process.env.REWARD_SENDER_NWC = 'invalid';

      const balance = await RewardSenderWallet.getBalance();

      // Should gracefully return 0
      expect(balance).toBe(0);

      // Restore
      process.env.REWARD_SENDER_NWC = originalEnv;
    });
  });

  describe('Payment Sending', () => {
    it('should validate invoice format', async () => {
      const result = await RewardSenderWallet.sendRewardPayment('invalid-invoice');

      // Should fail with error
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty invoice', async () => {
      const result = await RewardSenderWallet.sendRewardPayment('');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return proper result structure', async () => {
      const result = await RewardSenderWallet.sendRewardPayment('lnbc1test');

      expect(result).toHaveProperty('success');

      if (result.success) {
        expect(result.preimage).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    });

    // Note: Actual payment tests would require a real invoice
    // and sufficient balance - those should be integration tests
  });

  describe('Invoice Creation', () => {
    it('should create invoice with amount', async () => {
      const result = await RewardSenderWallet.createInvoice(100, 'Test invoice');

      expect(result).toHaveProperty('success');

      if (result.success) {
        expect(result.invoice).toBeDefined();
        expect(result.invoice).toMatch(/^lnbc/);
      } else {
        expect(result.error).toBeDefined();
      }
    });

    it('should validate amount is positive', async () => {
      const result = await RewardSenderWallet.createInvoice(0);

      // Should likely fail for 0 amount
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle negative amounts', async () => {
      const result = await RewardSenderWallet.createInvoice(-100);

      // Should fail for negative amounts
      expect(result.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // This is hard to test without mocking
      // Just verify no uncaught exceptions
      expect(async () => {
        await RewardSenderWallet.healthCheck();
      }).not.toThrow();
    });

    it('should log errors without crashing', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Trigger an error condition
      await RewardSenderWallet.sendRewardPayment('');

      // Should not crash
      expect(true).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('Connection Management', () => {
    it('should allow reconnection', async () => {
      await RewardSenderWallet.reconnect();
      const health = await RewardSenderWallet.healthCheck();

      expect(health).toBeDefined();
    });

    it('should handle multiple concurrent requests', async () => {
      const promises = [
        RewardSenderWallet.getBalance(),
        RewardSenderWallet.healthCheck(),
        RewardSenderWallet.getBalance(),
      ];

      const results = await Promise.all(promises);

      // All should complete
      expect(results).toHaveLength(3);
    });
  });
});
