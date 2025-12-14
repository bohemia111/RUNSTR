/**
 * AppPermissionService - Centralized permission management
 * Checks and requests all required permissions on app startup
 *
 * Required permissions:
 * 1. Location (foreground + background) - for workout tracking
 * 2. Battery optimization exemption (Android) - prevent Doze Mode from killing tracking
 *
 * Note: Notification permission removed - tracking works without it
 */

import { Platform } from 'react-native';
import { locationPermissionService } from '../activity/LocationPermissionService';
import { BatteryOptimizationService } from '../activity/BatteryOptimizationService';

export interface PermissionStatus {
  location: boolean;
  batteryOptimization: boolean;
  allGranted: boolean;
}

export class AppPermissionService {
  private static instance: AppPermissionService;

  private constructor() {}

  static getInstance(): AppPermissionService {
    if (!AppPermissionService.instance) {
      AppPermissionService.instance = new AppPermissionService();
    }
    return AppPermissionService.instance;
  }

  /**
   * Check status of all required permissions
   * Fast check - doesn't request, just checks current status
   */
  async checkAllPermissions(): Promise<PermissionStatus> {
    // Check location permissions (foreground + background) - required for both iOS and Android
    const locationStatus =
      await locationPermissionService.checkPermissionStatus();

    // iOS: Foreground-only is acceptable (background is optional)
    // Android: Both foreground and background required for full tracking
    const locationGranted =
      Platform.OS === 'ios'
        ? locationStatus.foreground === 'granted'
        : locationStatus.foreground === 'granted' &&
          locationStatus.background === 'granted';

    // Check battery optimization exemption (Android only)
    let batteryGranted = true;
    if (Platform.OS === 'android') {
      const batteryService = BatteryOptimizationService.getInstance();
      const batteryStatus =
        await batteryService.checkBatteryOptimizationStatus();
      batteryGranted = batteryStatus.prompted; // User was prompted (may have granted or declined)
    }

    const allGranted = locationGranted && batteryGranted;

    console.log('[AppPermissionService] Permission status:', {
      location: locationGranted,
      battery: batteryGranted,
      allGranted,
    });

    return {
      location: locationGranted,
      batteryOptimization: batteryGranted,
      allGranted,
    };
  }

  /**
   * Request all required permissions in sequence
   * Shows system dialogs for each permission (platform-specific)
   *
   * @returns true if all permissions granted, false otherwise
   */
  async requestAllPermissions(): Promise<boolean> {
    try {
      console.log('[AppPermissionService] Starting permission request flow...');

      // Step 1: Request location permissions (foreground first, then background)
      console.log('[AppPermissionService] Requesting location permissions...');
      const foregroundGranted =
        await locationPermissionService.requestForegroundPermission();

      if (!foregroundGranted) {
        console.error(
          '[AppPermissionService] Foreground location permission denied'
        );
        return false;
      }

      const backgroundGranted =
        await locationPermissionService.requestBackgroundPermission();

      if (!backgroundGranted) {
        console.warn(
          '[AppPermissionService] Background location permission denied - tracking will be limited'
        );
        // Continue anyway - foreground tracking still works
      }

      // Step 2: Request battery optimization exemption (Android only)
      if (Platform.OS === 'android') {
        console.log(
          '[AppPermissionService] Requesting battery optimization exemption...'
        );
        const batteryService = BatteryOptimizationService.getInstance();
        const batteryGranted =
          await batteryService.requestBatteryOptimizationExemption();

        if (!batteryGranted) {
          console.warn(
            '[AppPermissionService] Battery optimization exemption declined - background tracking may be limited'
          );
          // Continue anyway - user can enable later
        }
      }

      console.log(
        '[AppPermissionService] ✅ All permissions requested successfully'
      );
      return true;
    } catch (error) {
      console.error(
        '[AppPermissionService] Error requesting permissions:',
        error
      );
      return false;
    }
  }

  /**
   * Get detailed permission status with explanations
   * Useful for debugging or showing detailed permission screen
   */
  async getDetailedStatus(): Promise<{
    location: { granted: boolean; foreground: string; background: string };
    battery: { granted: boolean; prompted: boolean };
  }> {
    if (Platform.OS !== 'android') {
      return {
        location: {
          granted: true,
          foreground: 'granted',
          background: 'granted',
        },
        battery: { granted: true, prompted: true },
      };
    }

    const locationStatus =
      await locationPermissionService.checkPermissionStatus();

    const batteryService = BatteryOptimizationService.getInstance();
    const batteryStatus = await batteryService.checkBatteryOptimizationStatus();

    return {
      location: {
        granted:
          locationStatus.foreground === 'granted' &&
          locationStatus.background === 'granted',
        foreground: locationStatus.foreground,
        background: locationStatus.background,
      },
      battery: {
        granted: batteryStatus.prompted,
        prompted: batteryStatus.prompted,
      },
    };
  }
}

// Export singleton instance
export const appPermissionService = AppPermissionService.getInstance();
