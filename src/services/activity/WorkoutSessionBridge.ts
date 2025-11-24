/**
 * WorkoutSessionBridge - Native iOS HealthKit Workout Session Bridge
 *
 * This module provides a bridge to native iOS HealthKit workout sessions,
 * which are required for unlimited background location tracking on iOS.
 * Without an active HKWorkoutSession, iOS limits background location to ~30 minutes.
 */

import { NativeModules, Platform } from 'react-native';

const { RUNSTRWorkoutBridge } = NativeModules;

/**
 * Start a native iOS workout session for unlimited background tracking
 * @param activityType - The type of activity (running, walking, cycling)
 * @returns Promise that resolves when session starts
 */
export async function startNativeWorkoutSession(
  activityType: 'running' | 'walking' | 'cycling' | string
): Promise<void> {
  // Only needed on iOS - Android doesn't have this limitation
  if (Platform.OS !== 'ios') {
    return;
  }

  // Check if native module is available (might not be in dev/simulator)
  if (!RUNSTRWorkoutBridge) {
    console.warn(
      '[WorkoutSessionBridge] Native module not available - continuing without HKWorkoutSession'
    );
    console.warn(
      '[WorkoutSessionBridge] Note: Background tracking may be limited to 30 minutes on iOS'
    );
    return;
  }

  try {
    await RUNSTRWorkoutBridge.startWorkoutSession(activityType);
    console.log(
      `[WorkoutSessionBridge] ✅ Started HKWorkoutSession for ${activityType}`
    );
    console.log(
      '[WorkoutSessionBridge] iOS will now allow unlimited background location tracking'
    );
  } catch (error) {
    console.error(
      '[WorkoutSessionBridge] Failed to start HKWorkoutSession:',
      error
    );
    console.warn(
      '[WorkoutSessionBridge] Continuing without workout session - 30 min limit may apply'
    );
    // Don't throw - let the app continue without the workout session
  }
}

/**
 * Stop the native iOS workout session
 * @returns Promise that resolves when session stops
 */
export async function stopNativeWorkoutSession(): Promise<void> {
  // Only needed on iOS
  if (Platform.OS !== 'ios') {
    return;
  }

  // Check if native module is available
  if (!RUNSTRWorkoutBridge) {
    return;
  }

  try {
    await RUNSTRWorkoutBridge.stopWorkoutSession();
    console.log('[WorkoutSessionBridge] ✅ Stopped HKWorkoutSession');
  } catch (error) {
    console.error(
      '[WorkoutSessionBridge] Failed to stop HKWorkoutSession:',
      error
    );
    // Non-critical error - session will be cleaned up by iOS eventually
  }
}

/**
 * Check if the native workout session bridge is available
 * @returns true if the native module is available
 */
export function isWorkoutSessionAvailable(): boolean {
  return Platform.OS === 'ios' && RUNSTRWorkoutBridge !== undefined;
}
