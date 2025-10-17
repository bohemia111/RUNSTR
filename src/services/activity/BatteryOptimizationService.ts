/**
 * BatteryOptimizationService - Dynamic GPS accuracy based on battery level
 * Adjusts tracking parameters to extend battery life
 */

import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BatteryMode = 'high_accuracy' | 'balanced' | 'battery_saver';

export interface BatteryOptimizationConfig {
  mode: BatteryMode;
  accuracy: Location.Accuracy;
  timeInterval: number;
  distanceInterval: number;
  description: string;
}

const BATTERY_CONFIGS: Record<BatteryMode, BatteryOptimizationConfig> = {
  high_accuracy: {
    mode: 'high_accuracy',
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 2000, // 2 seconds
    distanceInterval: 3, // 3 meters (improved accuracy for running)
    description: 'Maximum accuracy, higher battery usage',
  },
  balanced: {
    mode: 'balanced',
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 5000, // 5 seconds
    distanceInterval: 10, // 10 meters
    description: 'Good accuracy with moderate battery usage',
  },
  battery_saver: {
    mode: 'battery_saver',
    accuracy: Location.Accuracy.Low,
    timeInterval: 10000, // 10 seconds
    distanceInterval: 20, // 20 meters
    description: 'Extended battery life, reduced accuracy',
  },
};

const BATTERY_EXEMPTION_PROMPT_KEY = '@runstr:battery_exemption_prompted';

export class BatteryOptimizationService {
  private static instance: BatteryOptimizationService;
  private currentMode: BatteryMode = 'high_accuracy';
  private batteryLevel: number = 100;
  private isCharging: boolean = false;
  private listeners: Set<(mode: BatteryMode, level: number) => void> = new Set();
  private batterySubscription: Battery.PowerState | null = null;

  // Battery warning thresholds
  private readonly CRITICAL_BATTERY = 10;
  private readonly LOW_BATTERY = 20;
  private readonly MEDIUM_BATTERY = 30;

  private constructor() {
    this.initializeBatteryMonitoring();
  }

  static getInstance(): BatteryOptimizationService {
    if (!BatteryOptimizationService.instance) {
      BatteryOptimizationService.instance = new BatteryOptimizationService();
    }
    return BatteryOptimizationService.instance;
  }

  /**
   * Initialize battery monitoring
   */
  private async initializeBatteryMonitoring(): Promise<void> {
    try {
      // Get initial battery state
      const batteryState = await Battery.getBatteryLevelAsync();
      const powerState = await Battery.getPowerStateAsync();

      // Validate and clamp battery level to 0-100 range
      const rawLevel = Math.round((batteryState || 1) * 100);
      this.batteryLevel = Math.max(0, Math.min(100, rawLevel));
      this.isCharging = powerState.batteryState === Battery.BatteryState.CHARGING;

      console.log(`🔋 Battery initialized: ${this.batteryLevel}% (charging: ${this.isCharging})`);

      // Determine initial mode
      this.updateModeBasedOnBattery();

      // Subscribe to battery changes
      Battery.addBatteryLevelListener(({ batteryLevel }) => {
        // Validate and clamp battery level to 0-100 range
        const rawLevel = Math.round(batteryLevel * 100);
        this.batteryLevel = Math.max(0, Math.min(100, rawLevel));
        this.updateModeBasedOnBattery();
      });

      Battery.addBatteryStateListener(({ batteryState }) => {
        this.isCharging = batteryState === Battery.BatteryState.CHARGING;
        this.updateModeBasedOnBattery();
      });
    } catch (error) {
      console.error('Failed to initialize battery monitoring:', error);
      // Set safe default values on error
      this.batteryLevel = 100;
      this.isCharging = false;
    }
  }

  /**
   * Update mode based on battery level and charging status
   */
  private updateModeBasedOnBattery(): void {
    const previousMode = this.currentMode;

    // If charging, always use high accuracy
    if (this.isCharging) {
      this.currentMode = 'high_accuracy';
    } else if (this.batteryLevel > 50) {
      this.currentMode = 'high_accuracy';
    } else if (this.batteryLevel > 20) {
      this.currentMode = 'balanced';
    } else {
      this.currentMode = 'battery_saver';
    }

    // Notify if mode changed
    if (previousMode !== this.currentMode) {
      this.notifyListeners();
    }
  }

  /**
   * Get location options for current battery mode
   */
  getLocationOptions(activityType: 'running' | 'walking' | 'cycling'): Location.LocationTaskOptions {
    const config = BATTERY_CONFIGS[this.currentMode];

    // Adjust based on activity type
    let timeInterval = config.timeInterval;
    let distanceInterval = config.distanceInterval;

    switch (activityType) {
      case 'walking':
        // Walking can use less frequent updates
        timeInterval = Math.min(timeInterval * 1.5, 15000);
        distanceInterval = Math.min(distanceInterval * 1.5, 30);
        break;
      case 'cycling':
        // Cycling needs more frequent updates for speed
        timeInterval = Math.max(timeInterval * 0.8, 1000);
        break;
    }

    // Activity-specific notification messages
    const activityNames = {
      running: 'Run',
      walking: 'Walk',
      cycling: 'Ride'
    };

    return {
      accuracy: config.accuracy,
      timeInterval,
      distanceInterval,
      mayShowUserSettingsDialog: false,
      // iOS-specific: Use fitness-optimized GPS algorithms
      activityType: Location.ActivityType.Fitness,
      // iOS-specific: Don't auto-pause during workouts
      pausesUpdatesAutomatically: false,
      // iOS-specific: Show blue bar when tracking in background (user transparency)
      showsBackgroundLocationIndicator: true,
      // Android-specific: Foreground service to prevent Doze Mode from stopping tracking
      foregroundService: {
        notificationTitle: 'RUNSTR - Activity Tracking',
        notificationBody: `Tracking your ${activityNames[activityType].toLowerCase()} in progress`,
        notificationColor: '#FF6B35', // RUNSTR orange color
      },
    };
  }

  /**
   * Get current battery mode
   */
  getCurrentMode(): BatteryMode {
    return this.currentMode;
  }

  /**
   * Get current battery level
   */
  getBatteryLevel(): number {
    return this.batteryLevel;
  }

  /**
   * Get battery warning if applicable
   */
  getBatteryWarning(): { level: 'critical' | 'low' | 'medium' | null; message: string | null } {
    if (this.isCharging) {
      return { level: null, message: null };
    }

    if (this.batteryLevel <= this.CRITICAL_BATTERY) {
      return {
        level: 'critical',
        message: `Critical battery (${this.batteryLevel}%) - Tracking may stop soon`,
      };
    }

    if (this.batteryLevel <= this.LOW_BATTERY) {
      return {
        level: 'low',
        message: `Low battery (${this.batteryLevel}%) - Tracking accuracy reduced`,
      };
    }

    if (this.batteryLevel <= this.MEDIUM_BATTERY) {
      return {
        level: 'medium',
        message: `Battery at ${this.batteryLevel}% - Consider charging for best tracking`,
      };
    }

    return { level: null, message: null };
  }

  /**
   * Check if battery is low enough to show warning
   */
  shouldShowBatteryWarning(): boolean {
    return !this.isCharging && this.batteryLevel <= this.LOW_BATTERY;
  }

  /**
   * Check if device is charging
   */
  isDeviceCharging(): boolean {
    return this.isCharging;
  }

  /**
   * Get mode description
   */
  getModeDescription(): string {
    return BATTERY_CONFIGS[this.currentMode].description;
  }

  /**
   * Force a specific mode (user override)
   */
  setMode(mode: BatteryMode): void {
    this.currentMode = mode;
    this.notifyListeners();
  }

  /**
   * Subscribe to mode changes
   */
  subscribe(listener: (mode: BatteryMode, level: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      listener(this.currentMode, this.batteryLevel);
    });
  }

  /**
   * Should stop tracking due to low battery
   */
  shouldStopTracking(): boolean {
    return this.batteryLevel <= 5 && !this.isCharging;
  }

  /**
   * Get battery warning message (simple string version)
   */
  getBatteryWarningMessage(): string | null {
    if (this.batteryLevel <= 5) {
      return 'Battery critical! Tracking will stop soon.';
    } else if (this.batteryLevel <= 10) {
      return 'Battery very low. Consider ending your workout.';
    } else if (this.batteryLevel <= 20) {
      return 'Battery low. Switched to battery saver mode.';
    }
    return null;
  }

  /**
   * Check if battery optimization exemption has been requested
   * Android 14+ requires this for reliable background location tracking
   */
  async checkBatteryOptimizationStatus(): Promise<{
    exempted: boolean;
    prompted: boolean;
  }> {
    // iOS doesn't have battery optimization issues, return true
    if (Platform.OS !== 'android') {
      return { exempted: true, prompted: false };
    }

    // Check if we've already prompted the user
    const hasPrompted = await AsyncStorage.getItem(BATTERY_EXEMPTION_PROMPT_KEY);

    // Note: We can't directly check Android battery optimization status without native module
    // For now, we track whether we've prompted the user
    return {
      exempted: hasPrompted === 'true', // Assume exempted if user was prompted
      prompted: hasPrompted === 'true',
    };
  }

  /**
   * Request battery optimization exemption for reliable background tracking
   * Android 14+ requirement for apps that need to track location when backgrounded
   *
   * @returns true if exemption granted or already requested, false if user declined
   */
  async requestBatteryOptimizationExemption(): Promise<boolean> {
    // iOS doesn't need this, return true
    if (Platform.OS !== 'android') {
      return true;
    }

    // Check if already prompted
    const status = await this.checkBatteryOptimizationStatus();
    if (status.prompted) {
      console.log('✅ Battery optimization exemption already requested');
      return true;
    }

    // Show alert explaining why this is needed
    return new Promise((resolve) => {
      Alert.alert(
        'Background Tracking Required',
        'To accurately track your workouts while using other apps (like music players), RUNSTR needs to be exempted from battery optimization.\n\n' +
        'This allows GPS to continue working when the app is in the background.\n\n' +
        'You will be taken to Android settings to enable "Unrestricted" battery mode for RUNSTR.',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: async () => {
              console.log('⚠️ User declined battery optimization exemption');
              // Still mark as prompted so we don't spam them
              await AsyncStorage.setItem(BATTERY_EXEMPTION_PROMPT_KEY, 'declined');
              resolve(false);
            },
          },
          {
            text: 'Open Settings',
            onPress: async () => {
              try {
                // Mark as prompted
                await AsyncStorage.setItem(BATTERY_EXEMPTION_PROMPT_KEY, 'true');

                // Open Android battery optimization settings
                // Note: This opens the battery optimization settings screen
                // User needs to find RUNSTR and select "Unrestricted"
                const url = 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS';
                const canOpen = await Linking.canOpenURL(url);

                if (canOpen) {
                  await Linking.openSettings();
                  console.log('✅ Opened battery optimization settings');
                  resolve(true);
                } else {
                  // Fallback to general settings
                  await Linking.openSettings();
                  console.log('⚠️ Opened general settings (specific battery optimization not available)');
                  resolve(true);
                }
              } catch (error) {
                console.error('Failed to open settings:', error);
                // Still mark as prompted and resolve true so tracking can continue
                resolve(true);
              }
            },
          },
        ],
        { cancelable: false }
      );
    });
  }

  /**
   * Show reminder about battery optimization if tracking has issues
   * Call this when GPS signal is frequently lost or tracking stops unexpectedly
   */
  async showBatteryOptimizationReminder(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    Alert.alert(
      'Background Tracking Issue Detected',
      'RUNSTR may have been paused by Android battery optimization.\n\n' +
      'To fix this:\n' +
      '1. Open Settings > Apps > RUNSTR\n' +
      '2. Tap Battery\n' +
      '3. Select "Unrestricted"\n\n' +
      'This ensures tracking continues while using other apps.',
      [
        { text: 'Dismiss', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => Linking.openSettings(),
        },
      ]
    );
  }

  /**
   * Cleanup subscriptions
   */
  cleanup(): void {
    // Battery listeners are automatically cleaned up by Expo
    this.listeners.clear();
  }
}