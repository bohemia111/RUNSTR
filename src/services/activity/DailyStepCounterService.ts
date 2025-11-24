/**
 * DailyStepCounterService - Cross-platform daily step counting
 * Uses Expo Pedometer API to query steps from device health data
 * Works on both iOS (HealthKit) and Android (Google Fit)
 */

import { Pedometer } from 'expo-sensors';
import { Platform, PermissionsAndroid, Linking } from 'react-native';

export interface DailyStepData {
  steps: number;
  startTime: Date;
  endTime: Date;
  lastUpdated: Date;
}

export class DailyStepCounterService {
  private static instance: DailyStepCounterService;
  private cachedSteps: DailyStepData | null = null;
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    console.log('[DailyStepCounterService] Initialized');
  }

  static getInstance(): DailyStepCounterService {
    if (!DailyStepCounterService.instance) {
      DailyStepCounterService.instance = new DailyStepCounterService();
    }
    return DailyStepCounterService.instance;
  }

  /**
   * Check if pedometer is available on the device
   */
  async isAvailable(): Promise<boolean> {
    try {
      const available = await Pedometer.isAvailableAsync();
      console.log(
        `[DailyStepCounterService] Pedometer available: ${available}`
      );
      return available;
    } catch (error) {
      console.error(
        '[DailyStepCounterService] Error checking availability:',
        error
      );
      return false;
    }
  }

  /**
   * Request permissions for motion/activity data
   * iOS: Automatically handled by Pedometer API
   * Android: Requires ACTIVITY_RECOGNITION permission (Android 10+)
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const available = await this.isAvailable();
      if (!available) {
        console.warn(
          '[DailyStepCounterService] Pedometer not available on this device'
        );
        return false;
      }

      // Android 10+ (API 29+) requires explicit ACTIVITY_RECOGNITION permission
      if (Platform.OS === 'android' && Platform.Version >= 29) {
        console.log(
          '[DailyStepCounterService] Requesting ACTIVITY_RECOGNITION permission (Android 10+)'
        );

        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
          {
            title: 'Motion Permission Required',
            message:
              'RUNSTR needs access to your motion data to count your daily steps and track walking activities.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn('[DailyStepCounterService] Motion permission denied');
          return false;
        }

        console.log(
          '[DailyStepCounterService] ACTIVITY_RECOGNITION permission granted'
        );
      }

      // Test if we can access step data (iOS auto-prompts here)
      const now = new Date();
      const testStart = new Date(now.getTime() - 1000); // 1 second ago
      await Pedometer.getStepCountAsync(testStart, now);

      console.log(
        '[DailyStepCounterService] Permissions granted - step data accessible'
      );
      return true;
    } catch (error) {
      console.error('[DailyStepCounterService] Permission error:', error);
      return false;
    }
  }

  /**
   * Check if motion permission is currently granted (Android only)
   */
  async checkPermissionStatus(): Promise<
    'granted' | 'denied' | 'never_ask_again' | 'unknown'
  > {
    if (Platform.OS !== 'android' || Platform.Version < 29) {
      return 'granted'; // iOS or older Android versions don't need explicit permission
    }

    try {
      const result = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
      );

      if (result) {
        return 'granted';
      }

      // Permission not granted - check if we can request it
      const requestResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
        {
          title: 'Motion Permission Required',
          message:
            'RUNSTR needs access to your motion data to count your daily steps.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );

      if (requestResult === PermissionsAndroid.RESULTS.GRANTED) {
        return 'granted';
      } else if (requestResult === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        return 'never_ask_again';
      } else {
        return 'denied';
      }
    } catch (error) {
      console.error(
        '[DailyStepCounterService] Error checking permission:',
        error
      );
      return 'unknown';
    }
  }

  /**
   * Open device settings for manual permission grant (Android)
   */
  openSettings(): void {
    if (Platform.OS === 'android') {
      console.log('[DailyStepCounterService] Opening app settings');
      Linking.openSettings();
    }
  }

  /**
   * Get today's step count (from midnight to now)
   * Uses cached value if less than 5 minutes old
   */
  async getTodaySteps(): Promise<DailyStepData | null> {
    try {
      // Check cache validity
      if (this.cachedSteps && this.isCacheValid()) {
        console.log('[DailyStepCounterService] Returning cached steps');
        return this.cachedSteps;
      }

      // Calculate today's time range (midnight to now)
      const start = new Date();
      start.setHours(0, 0, 0, 0); // Midnight today
      const end = new Date(); // Now

      console.log(
        `[DailyStepCounterService] Querying steps from ${start.toISOString()} to ${end.toISOString()}`
      );

      // Query pedometer data
      const result = await Pedometer.getStepCountAsync(start, end);

      if (!result) {
        console.warn('[DailyStepCounterService] No step data returned');
        return null;
      }

      const stepData: DailyStepData = {
        steps: result.steps,
        startTime: start,
        endTime: end,
        lastUpdated: new Date(),
      };

      // Update cache
      this.cachedSteps = stepData;

      console.log(
        `[DailyStepCounterService] ✅ Today's steps: ${result.steps}`
      );
      return stepData;
    } catch (error) {
      console.error('[DailyStepCounterService] Error getting steps:', error);
      return null;
    }
  }

  /**
   * Get step count for a specific date range
   */
  async getSteps(start: Date, end: Date): Promise<number | null> {
    try {
      const result = await Pedometer.getStepCountAsync(start, end);
      return result ? result.steps : null;
    } catch (error) {
      console.error(
        '[DailyStepCounterService] Error getting steps for range:',
        error
      );
      return null;
    }
  }

  /**
   * Clear cached step data (forces fresh query on next call)
   */
  clearCache(): void {
    this.cachedSteps = null;
    console.log('[DailyStepCounterService] Cache cleared');
  }

  /**
   * Check if cached data is still valid (less than 5 minutes old)
   */
  private isCacheValid(): boolean {
    if (!this.cachedSteps) return false;

    const age = Date.now() - this.cachedSteps.lastUpdated.getTime();
    return age < this.cacheExpiry;
  }

  /**
   * Subscribe to live step updates (real-time)
   * Returns unsubscribe function
   */
  subscribeLiveSteps(callback: (steps: number) => void): () => void {
    let subscription: any = null;

    const startSubscription = async () => {
      try {
        subscription = Pedometer.watchStepCount((result) => {
          console.log(
            `[DailyStepCounterService] Live step update: ${result.steps}`
          );
          callback(result.steps);
        });
      } catch (error) {
        console.error(
          '[DailyStepCounterService] Error subscribing to live steps:',
          error
        );
      }
    };

    startSubscription();

    // Return unsubscribe function
    return () => {
      if (subscription) {
        subscription.remove();
        console.log('[DailyStepCounterService] Unsubscribed from live steps');
      }
    };
  }

  /**
   * Get platform-specific info for debugging
   */
  getPlatformInfo(): { platform: string; available: boolean } {
    return {
      platform: Platform.OS,
      available: false, // Will be updated by isAvailable()
    };
  }
}

// Export singleton instance
export const dailyStepCounterService = DailyStepCounterService.getInstance();
