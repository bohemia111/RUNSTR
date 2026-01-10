/**
 * StepPollingService - App-wide step milestone detection
 *
 * Polls for step updates when the app is active (foreground)
 * and triggers milestone rewards automatically.
 *
 * USAGE:
 * - Call start() when app comes to foreground
 * - Call stop() when app goes to background
 * - Typically integrated in App.tsx via AppState listener
 */

import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dailyStepCounterService } from '../activity/DailyStepCounterService';
import { StepRewardService } from './StepRewardService';

// Polling configuration
const POLLING_INTERVAL_MS = 60000; // Check every 60 seconds when app is active

class StepPollingServiceClass {
  private static instance: StepPollingServiceClass;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private isPolling: boolean = false;
  private lastAppState: AppStateStatus = 'active';

  private constructor() {
    console.log('[StepPolling] Service initialized');
  }

  static getInstance(): StepPollingServiceClass {
    if (!StepPollingServiceClass.instance) {
      StepPollingServiceClass.instance = new StepPollingServiceClass();
    }
    return StepPollingServiceClass.instance;
  }

  /**
   * Initialize app state listener and start polling if app is active
   * Call this once on app startup
   */
  initialize(): void {
    // Listen for app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    // Start polling if app is already active
    if (AppState.currentState === 'active') {
      this.start();
    }

    console.log('[StepPolling] Initialized with app state listener');
  }

  /**
   * Clean up listeners and stop polling
   * Call this on app shutdown
   */
  cleanup(): void {
    this.stop();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    console.log('[StepPolling] Cleaned up');
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (this.lastAppState !== 'active' && nextAppState === 'active') {
      // App came to foreground
      console.log('[StepPolling] App came to foreground, starting polling');
      this.start();
    } else if (this.lastAppState === 'active' && nextAppState !== 'active') {
      // App went to background
      console.log('[StepPolling] App went to background, stopping polling');
      this.stop();
    }

    this.lastAppState = nextAppState;
  };

  /**
   * Start polling for step milestones
   */
  start(): void {
    if (this.isPolling) {
      console.log('[StepPolling] Already polling, skipping start');
      return;
    }

    // Check if step rewards are enabled
    if (!StepRewardService.isEnabled()) {
      console.log('[StepPolling] Step rewards disabled, not starting');
      return;
    }

    console.log('[StepPolling] Starting polling (every 60s)');
    this.isPolling = true;

    // Do an immediate check
    this.checkMilestones();

    // Start periodic polling
    this.pollingInterval = setInterval(() => {
      this.checkMilestones();
    }, POLLING_INTERVAL_MS);
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log('[StepPolling] Stopped');
  }

  /**
   * Check current steps and reward milestones
   */
  private async checkMilestones(): Promise<void> {
    try {
      // Get user pubkey
      const pubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');
      if (!pubkey) {
        return;
      }

      // Get current steps
      const stepData = await dailyStepCounterService.getTodaySteps();
      const steps = stepData?.steps ?? 0;

      if (steps <= 0) {
        return;
      }

      // Check and reward milestones
      const rewards = await StepRewardService.checkAndRewardMilestones(steps, pubkey);

      if (rewards.length > 0) {
        const successful = rewards.filter(r => r.success).length;
        console.log(`[StepPolling] Processed ${rewards.length} milestones, ${successful} successful`);
      }
    } catch (error) {
      console.error('[StepPolling] Error checking milestones:', error);
    }
  }

  /**
   * Check if currently polling
   */
  isActive(): boolean {
    return this.isPolling;
  }
}

// Export singleton instance
export const StepPollingService = StepPollingServiceClass.getInstance();
export default StepPollingService;
