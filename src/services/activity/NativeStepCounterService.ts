/**
 * NativeStepCounterService - Native Android step counting
 *
 * Uses expo-android-pedometer for background step tracking on stock Android.
 * Only used when NOT on a privacy ROM (GrapheneOS/CalyxOS use Health Connect instead).
 *
 * This service:
 * - Starts a foreground service with persistent notification
 * - Counts steps via Android's TYPE_STEP_COUNTER sensor
 * - Works even when app is backgrounded or closed
 * - Respects privacy ROM users by not activating on GrapheneOS/CalyxOS
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { privacyROMDetectionService } from '../platform/PrivacyROMDetectionService';

// Storage key for tracking preference
const BACKGROUND_STEP_TRACKING_KEY = '@runstr:background_step_tracking_enabled';

// Lazy import to avoid loading on iOS
let AndroidPedometer: any = null;

export interface NativeStepData {
  steps: number;
  isTracking: boolean;
  startedAt: Date | null;
}

class NativeStepCounterService {
  private static instance: NativeStepCounterService;
  private isInitialized: boolean = false;
  private isTracking: boolean = false;
  private stepCountAtStart: number = 0;
  private trackingStartTime: Date | null = null;

  private constructor() {
    console.log('[NativeStepCounter] Service created');
  }

  static getInstance(): NativeStepCounterService {
    if (!NativeStepCounterService.instance) {
      NativeStepCounterService.instance = new NativeStepCounterService();
    }
    return NativeStepCounterService.instance;
  }

  /**
   * Check if native step counting should be used
   * Returns false for iOS and privacy ROMs
   */
  async shouldUseNativeSteps(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.log('[NativeStepCounter] Not Android - skipping');
      return false;
    }

    const rom = await privacyROMDetectionService.detectROM();
    if (rom.isPrivacyROM) {
      console.log(`[NativeStepCounter] Privacy ROM (${rom.romType}) detected - using Health Connect instead`);
      return false;
    }

    console.log('[NativeStepCounter] Stock Android - native step counting available');
    return true;
  }

  /**
   * Check if background step tracking is enabled by user preference
   */
  async isBackgroundTrackingEnabled(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(BACKGROUND_STEP_TRACKING_KEY);
      // Default to false - user must opt in
      return value === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Set background step tracking preference
   */
  async setBackgroundTrackingEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(BACKGROUND_STEP_TRACKING_KEY, enabled ? 'true' : 'false');
      console.log(`[NativeStepCounter] Background tracking preference set to: ${enabled}`);

      if (enabled) {
        await this.startTracking();
      } else {
        await this.stopTracking();
      }
    } catch (error) {
      console.error('[NativeStepCounter] Failed to save preference:', error);
    }
  }

  /**
   * Initialize the native pedometer (lazy load)
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (Platform.OS !== 'android') return false;

    try {
      // Dynamic import to avoid loading on iOS
      AndroidPedometer = require('expo-android-pedometer');
      this.isInitialized = true;
      console.log('[NativeStepCounter] expo-android-pedometer loaded successfully');
      return true;
    } catch (error) {
      console.error('[NativeStepCounter] Failed to load expo-android-pedometer:', error);
      return false;
    }
  }

  /**
   * Start background step counting
   * Shows persistent notification on Android
   */
  async startTracking(): Promise<boolean> {
    if (this.isTracking) {
      console.log('[NativeStepCounter] Already tracking');
      return true;
    }

    if (!(await this.shouldUseNativeSteps())) {
      console.log('[NativeStepCounter] Skipping - not stock Android');
      return false;
    }

    const initialized = await this.initialize();
    if (!initialized || !AndroidPedometer) {
      console.log('[NativeStepCounter] Failed to initialize');
      return false;
    }

    try {
      // Get current step count as baseline
      const currentSteps = await AndroidPedometer.getStepCountAsync();
      this.stepCountAtStart = currentSteps?.steps || 0;
      this.trackingStartTime = new Date();

      // Start the foreground service
      await AndroidPedometer.startAsync();
      this.isTracking = true;

      console.log(`[NativeStepCounter] Started tracking (baseline: ${this.stepCountAtStart} steps)`);
      return true;
    } catch (error) {
      console.error('[NativeStepCounter] Failed to start:', error);
      return false;
    }
  }

  /**
   * Stop background step counting
   * Returns the number of steps counted during this session
   */
  async stopTracking(): Promise<number> {
    if (!this.isTracking) {
      console.log('[NativeStepCounter] Not currently tracking');
      return 0;
    }

    if (!AndroidPedometer) {
      console.log('[NativeStepCounter] Pedometer not initialized');
      return 0;
    }

    try {
      const finalSteps = await this.getStepsSinceStart();
      await AndroidPedometer.stopAsync();
      this.isTracking = false;
      this.trackingStartTime = null;

      console.log(`[NativeStepCounter] Stopped tracking (${finalSteps} steps recorded)`);
      return finalSteps;
    } catch (error) {
      console.error('[NativeStepCounter] Failed to stop:', error);
      this.isTracking = false;
      return 0;
    }
  }

  /**
   * Get steps counted since tracking started
   * Used during active workouts
   */
  async getStepsSinceStart(): Promise<number> {
    if (!this.isTracking || !AndroidPedometer) {
      return 0;
    }

    try {
      const currentSteps = await AndroidPedometer.getStepCountAsync();
      const totalCurrentSteps = currentSteps?.steps || 0;
      const stepsSinceStart = totalCurrentSteps - this.stepCountAtStart;
      return Math.max(0, stepsSinceStart);
    } catch (error) {
      console.error('[NativeStepCounter] Failed to get steps since start:', error);
      return 0;
    }
  }

  /**
   * Get today's total steps from native sensor
   * Note: This resets on device reboot (Android limitation)
   */
  async getTodaySteps(): Promise<number> {
    if (Platform.OS !== 'android') return 0;

    const initialized = await this.initialize();
    if (!initialized || !AndroidPedometer) return 0;

    try {
      const result = await AndroidPedometer.getStepCountAsync();
      const steps = result?.steps || 0;
      console.log(`[NativeStepCounter] Today's steps: ${steps}`);
      return steps;
    } catch (error) {
      console.error('[NativeStepCounter] Failed to get today steps:', error);
      return 0;
    }
  }

  /**
   * Check if currently tracking
   */
  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  /**
   * Get tracking start time (if tracking)
   */
  getTrackingStartTime(): Date | null {
    return this.trackingStartTime;
  }

  /**
   * Get current tracking status
   */
  getStatus(): NativeStepData {
    return {
      steps: 0, // Will be updated by caller
      isTracking: this.isTracking,
      startedAt: this.trackingStartTime,
    };
  }
}

// Export singleton instance
export const nativeStepCounterService = NativeStepCounterService.getInstance();
