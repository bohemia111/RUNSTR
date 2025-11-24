/**
 * BackgroundLocationTask - Handles location updates when app is in background
 * Implements TaskManager for continuous tracking during workouts
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { LocationPoint } from './LocationTrackingService';
import { calculateDistance } from '../../utils/gpsValidation';

export const BACKGROUND_LOCATION_TASK = 'runstr-background-location';
const BACKGROUND_LOCATION_STORAGE = '@runstr:background_locations';
const SESSION_STATE_KEY = '@runstr:active_session_state';
const BACKGROUND_DISTANCE_STATE = '@runstr:background_distance_state';
const LAST_NOTIFICATION_UPDATE_KEY = '@runstr:last_notification_update';

interface BackgroundLocationData {
  locations: Location.LocationObject[];
  sessionId: string;
  activityType: string;
}

interface BackgroundDistanceState {
  totalDistance: number; // meters
  lastProcessedLocation: LocationPoint | null;
  locationCount: number;
  lastUpdated: number;
  sessionId: string;
}

/**
 * Format elapsed time as HH:MM:SS or MM:SS
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate pace in min/km
 */
function calculatePace(
  distanceMeters: number,
  durationSeconds: number
): string {
  if (distanceMeters < 10 || durationSeconds < 1) {
    return '--:--';
  }

  const distanceKm = distanceMeters / 1000;
  const paceSecondsPerKm = durationSeconds / distanceKm;
  const paceMinutes = Math.floor(paceSecondsPerKm / 60);
  const paceSeconds = Math.floor(paceSecondsPerKm % 60);

  return `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`;
}

/**
 * Calculate speed in km/h
 */
function calculateSpeed(
  distanceMeters: number,
  durationSeconds: number
): string {
  if (distanceMeters < 10 || durationSeconds < 1) {
    return '0.0';
  }

  const distanceKm = distanceMeters / 1000;
  const durationHours = durationSeconds / 3600;
  const speed = distanceKm / durationHours;

  return speed.toFixed(1);
}

/**
 * Update the foreground service notification with live stats
 * Throttled to update every 5 seconds to avoid excessive updates
 */
async function updateLiveNotification(
  activityType: string,
  distanceMeters: number,
  durationSeconds: number
): Promise<void> {
  try {
    // Throttle updates to every 5 seconds
    const lastUpdateStr = await AsyncStorage.getItem(
      LAST_NOTIFICATION_UPDATE_KEY
    );
    const lastUpdate = lastUpdateStr ? parseInt(lastUpdateStr, 10) : 0;
    const now = Date.now();

    if (now - lastUpdate < 5000) {
      // Skip update if less than 5 seconds since last one
      return;
    }

    // Format distance
    const distanceKm = (distanceMeters / 1000).toFixed(2);
    const duration = formatDuration(durationSeconds);

    // Activity-specific stats
    let statsText = '';
    if (activityType === 'running' || activityType === 'walking') {
      const pace = calculatePace(distanceMeters, durationSeconds);
      statsText = `${distanceKm} km • ${duration} • ${pace} /km`;
    } else if (activityType === 'cycling') {
      const speed = calculateSpeed(distanceMeters, durationSeconds);
      statsText = `${distanceKm} km • ${duration} • ${speed} km/h`;
    } else {
      statsText = `${distanceKm} km • ${duration}`;
    }

    // Update notification content with MAX priority (Android 12+ requirement)
    await Notifications.setNotificationChannelAsync('workout-tracking', {
      name: 'Workout Tracking',
      importance: Notifications.AndroidImportance.MAX, // ✅ MAX for foreground services
      sound: null, // Silent updates
      vibrationPattern: null,
      enableLights: false,
      enableVibrate: false,
    });

    // Schedule/update the notification with MAX priority and ongoing flag
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `RUNSTR - ${
          activityType.charAt(0).toUpperCase() + activityType.slice(1)
        } Tracking`,
        body: statsText,
        color: '#FF6B35',
        priority: Notifications.AndroidNotificationPriority.MAX, // ✅ MAX priority prevents service kill
        sticky: true, // Keep notification visible
        autoDismiss: false, // Don't auto-dismiss
      },
      trigger: null, // Immediate
      identifier: BACKGROUND_LOCATION_TASK, // Use consistent ID to update same notification
    });

    // Save last update timestamp
    await AsyncStorage.setItem(LAST_NOTIFICATION_UPDATE_KEY, now.toString());

    console.log(`[Background] Updated notification: ${statsText}`);
  } catch (error) {
    console.error('[Background] Failed to update notification:', error);
  }
}

/**
 * Define the background task that will handle location updates
 * This runs even when the app is minimized or screen is locked
 * CRITICAL: This calculates distance in real-time to work on Android when backgrounded
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };

    try {
      // Get current session state
      const sessionStateStr = await AsyncStorage.getItem(SESSION_STATE_KEY);
      if (!sessionStateStr) {
        console.log('No active session, ignoring background locations');
        return;
      }

      const sessionState = JSON.parse(sessionStateStr);
      if (sessionState.isPaused) {
        console.log('Session paused, ignoring background locations');
        return;
      }

      // Process and validate locations
      const validLocations = locations
        .map(
          (loc) =>
            ({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              altitude: loc.coords.altitude || undefined,
              timestamp: loc.timestamp,
              accuracy: loc.coords.accuracy || undefined,
              speed: loc.coords.speed || undefined,
            } as LocationPoint)
        )
        .filter((loc) => loc.accuracy && loc.accuracy < 50); // Only keep accurate points

      if (validLocations.length === 0) {
        return;
      }

      // Get or initialize distance state
      const distanceStateStr = await AsyncStorage.getItem(
        BACKGROUND_DISTANCE_STATE
      );
      let distanceState: BackgroundDistanceState;

      if (distanceStateStr) {
        distanceState = JSON.parse(distanceStateStr);
        // If session ID changed, reset distance
        if (distanceState.sessionId !== sessionState.sessionId) {
          distanceState = {
            totalDistance: 0,
            lastProcessedLocation: null,
            locationCount: 0,
            lastUpdated: Date.now(),
            sessionId: sessionState.sessionId,
          };
        }
      } else {
        distanceState = {
          totalDistance: 0,
          lastProcessedLocation: null,
          locationCount: 0,
          lastUpdated: Date.now(),
          sessionId: sessionState.sessionId,
        };
      }

      // Calculate distance for each new location
      let distanceAdded = 0;
      let lastLocation = distanceState.lastProcessedLocation;

      for (const location of validLocations) {
        if (lastLocation) {
          // Calculate distance between consecutive points
          const segmentDistance = calculateDistance(lastLocation, location);

          // Only add distance if it's reasonable (prevent GPS jumps)
          if (segmentDistance > 0.5 && segmentDistance < 75) {
            distanceState.totalDistance += segmentDistance;
            distanceAdded += segmentDistance;
          }
        }
        lastLocation = location;
        distanceState.locationCount++;
      }

      // Update the last processed location
      distanceState.lastProcessedLocation = lastLocation;
      distanceState.lastUpdated = Date.now();

      // Save updated distance state
      await AsyncStorage.setItem(
        BACKGROUND_DISTANCE_STATE,
        JSON.stringify(distanceState)
      );

      // Store locations in batches for compatibility with existing code
      const existingDataStr = await AsyncStorage.getItem(
        BACKGROUND_LOCATION_STORAGE
      );
      const existingData = existingDataStr ? JSON.parse(existingDataStr) : [];

      const newBatch = {
        sessionId: sessionState.sessionId,
        timestamp: Date.now(),
        locations: validLocations,
      };

      existingData.push(newBatch);

      // Keep only last 100 batches to prevent memory issues
      if (existingData.length > 100) {
        existingData.shift();
      }

      await AsyncStorage.setItem(
        BACKGROUND_LOCATION_STORAGE,
        JSON.stringify(existingData)
      );

      // Log the real-time distance update (visible in Metro console)
      console.log(
        `[Background] Distance: ${(distanceState.totalDistance / 1000).toFixed(
          2
        )} km, ` +
          `Added: ${distanceAdded.toFixed(1)}m, ` +
          `Locations: ${distanceState.locationCount}`
      );

      // Update live notification with current stats
      const elapsedSeconds = Math.floor(
        (Date.now() - sessionState.startTime) / 1000
      );
      await updateLiveNotification(
        sessionState.activityType,
        distanceState.totalDistance,
        elapsedSeconds
      );
    } catch (err) {
      console.error('Error processing background locations:', err);
    }
  }
});

/**
 * Start background location tracking
 */
export async function startBackgroundLocationTracking(
  activityType: 'running' | 'walking' | 'cycling',
  sessionId: string
): Promise<boolean> {
  try {
    // Check if task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_LOCATION_TASK
    );

    if (!isRegistered) {
      console.error('[BackgroundLocationTask] ERROR: Task not registered!');
      console.error(
        '[BackgroundLocationTask] This task must be imported in index.js BEFORE app initialization'
      );
      console.error(
        '[BackgroundLocationTask] Add: import "./src/services/activity/BackgroundLocationTask"'
      );
      console.error(`[BackgroundLocationTask] Platform: ${Platform.OS}`);
      return false;
    }

    // Android-specific: Log battery optimization warnings
    if (Platform.OS === 'android') {
      console.log(
        '[ANDROID] ⚠️ CRITICAL: Ensure battery optimization is disabled for RUNSTR'
      );
      console.log(
        '[ANDROID] Settings → Apps → RUNSTR → Battery → Unrestricted'
      );
      console.log(
        '[ANDROID] Without this, GPS will stop after a few minutes in background'
      );
    }

    // Store session state for background task
    await AsyncStorage.setItem(
      SESSION_STATE_KEY,
      JSON.stringify({
        sessionId,
        activityType,
        isPaused: false,
        startTime: Date.now(),
      })
    );

    // Configure location options based on activity type
    const locationOptions = getBackgroundLocationOptions(activityType);

    // Start location updates
    await Location.startLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
      locationOptions
    );

    console.log(
      `[BackgroundLocationTask] ✅ Started background tracking for ${activityType} on ${Platform.OS}`
    );
    console.log(
      `[BackgroundLocationTask] Time interval: ${locationOptions.timeInterval}ms`
    );
    console.log(
      `[BackgroundLocationTask] Distance interval: ${locationOptions.distanceInterval}m`
    );
    return true;
  } catch (error) {
    console.error(
      '[BackgroundLocationTask] ❌ Failed to start background location tracking:',
      error
    );
    console.error(`[BackgroundLocationTask] Platform: ${Platform.OS}`);
    console.error(`[BackgroundLocationTask] Session ID: ${sessionId}`);
    console.error(`[BackgroundLocationTask] Activity: ${activityType}`);

    // Android-specific error guidance
    if (Platform.OS === 'android') {
      console.error('[ANDROID] Common causes:');
      console.error(
        '  1. Battery optimization not disabled (Settings → Apps → RUNSTR → Battery → Unrestricted)'
      );
      console.error('  2. Location permission not set to "Allow all the time"');
      console.error('  3. Notification permission denied (Android 13+)');
      console.error('  4. Background location permission denied');
    }
    return false;
  }
}

/**
 * Stop background location tracking
 */
export async function stopBackgroundLocationTracking(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_LOCATION_TASK
    );

    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('Stopped background location tracking');
    }

    // Clear session state and distance state
    await AsyncStorage.removeItem(SESSION_STATE_KEY);
    await AsyncStorage.removeItem(BACKGROUND_DISTANCE_STATE);
  } catch (error) {
    console.error('Error stopping background location tracking:', error);
  }
}

/**
 * Pause background location tracking
 */
export async function pauseBackgroundTracking(): Promise<void> {
  try {
    const sessionStateStr = await AsyncStorage.getItem(SESSION_STATE_KEY);
    if (sessionStateStr) {
      const sessionState = JSON.parse(sessionStateStr);
      sessionState.isPaused = true;
      sessionState.pausedAt = Date.now();
      await AsyncStorage.setItem(
        SESSION_STATE_KEY,
        JSON.stringify(sessionState)
      );
    }
  } catch (error) {
    console.error('Error pausing background tracking:', error);
  }
}

/**
 * Resume background location tracking
 */
export async function resumeBackgroundTracking(): Promise<void> {
  try {
    const sessionStateStr = await AsyncStorage.getItem(SESSION_STATE_KEY);
    if (sessionStateStr) {
      const sessionState = JSON.parse(sessionStateStr);
      sessionState.isPaused = false;
      delete sessionState.pausedAt;
      await AsyncStorage.setItem(
        SESSION_STATE_KEY,
        JSON.stringify(sessionState)
      );
    }
  } catch (error) {
    console.error('Error resuming background tracking:', error);
  }
}

/**
 * Get stored background locations and clear storage
 */
export async function getAndClearBackgroundLocations(): Promise<
  LocationPoint[]
> {
  try {
    const dataStr = await AsyncStorage.getItem(BACKGROUND_LOCATION_STORAGE);
    if (!dataStr) {
      return [];
    }

    const batches = JSON.parse(dataStr);
    const allLocations: LocationPoint[] = [];

    // Flatten all batches into single array
    for (const batch of batches) {
      allLocations.push(...batch.locations);
    }

    // Clear storage after retrieval
    await AsyncStorage.removeItem(BACKGROUND_LOCATION_STORAGE);

    return allLocations;
  } catch (error) {
    console.error('Error retrieving background locations:', error);
    return [];
  }
}

/**
 * Get and clear background distance state
 * Returns the total distance calculated in the background
 */
export async function getAndClearBackgroundDistance(): Promise<{
  totalDistance: number;
  locationCount: number;
} | null> {
  try {
    const distanceStateStr = await AsyncStorage.getItem(
      BACKGROUND_DISTANCE_STATE
    );
    if (!distanceStateStr) {
      return null;
    }

    const distanceState: BackgroundDistanceState = JSON.parse(distanceStateStr);

    // Clear the distance state after retrieval
    await AsyncStorage.removeItem(BACKGROUND_DISTANCE_STATE);

    return {
      totalDistance: distanceState.totalDistance,
      locationCount: distanceState.locationCount,
    };
  } catch (error) {
    console.error('Error retrieving background distance:', error);
    return null;
  }
}

/**
 * Check if background task is registered
 */
export async function isBackgroundTaskRegistered(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
}

/**
 * Get location options based on activity type
 */
function getBackgroundLocationOptions(
  activityType: string
): Location.LocationTaskOptions {
  // Activity-specific notification messages
  const activityNotifications = {
    running: {
      title: 'RUNSTR - Run Tracking',
      body: 'Tracking your run in the background',
    },
    walking: {
      title: 'RUNSTR - Walk Tracking',
      body: 'Tracking your walk in the background',
    },
    cycling: {
      title: 'RUNSTR - Ride Tracking',
      body: 'Tracking your ride in the background',
    },
  };

  const notification = activityNotifications[
    activityType as keyof typeof activityNotifications
  ] || {
    title: 'RUNSTR - Activity Tracking',
    body: 'Tracking your activity in the background',
  };

  const baseOptions: Location.LocationTaskOptions = {
    accuracy: Location.Accuracy.BestForNavigation,
    // iOS-specific: Use fitness-optimized GPS algorithms
    ...(Platform.OS === 'ios' && {
      activityType: Location.ActivityType.Fitness,
      // iOS-specific: Don't auto-pause during workouts
      pausesUpdatesAutomatically: false,
      // iOS-specific: Show blue bar when tracking in background (user transparency)
      showsBackgroundLocationIndicator: true,
      // iOS-specific: Disable deferred updates (prevents batching)
      deferredUpdatesInterval: 0,
      deferredUpdatesDistance: 0,
    }),
    // Android-specific: Foreground service to prevent Doze Mode from stopping tracking
    foregroundService: {
      notificationTitle: notification.title,
      notificationBody: notification.body,
      notificationColor: '#FF6B35', // RUNSTR orange color
      // Android 12+ requirement: MAX priority for foreground service persistence
      // Prevents Android from killing the service when app is backgrounded
      ...(Platform.OS === 'android' && {
        notificationPriority: 'max', // ✅ Changed from 'high' to 'max'
      }),
    },
  };

  switch (activityType) {
    case 'running':
      return {
        ...baseOptions,
        // CRITICAL FIX: Use 1s intervals on Android to compensate for system throttling
        // Android will throttle this further when backgrounded, so start aggressive
        // This matches Strava/Nike Run Club behavior
        timeInterval: 1000, // 1 second on both platforms (Android needs this despite throttling)
        distanceInterval: 5, // Primary trigger: update every 5 meters (more reliable than time)
        mayShowUserSettingsDialog: false,
      };
    case 'walking':
      return {
        ...baseOptions,
        // Walking can tolerate slightly longer intervals
        timeInterval: Platform.OS === 'android' ? 1500 : 2000, // 1.5s Android, 2s iOS
        distanceInterval: 5, // Primary trigger: update every 5 meters
        mayShowUserSettingsDialog: false,
      };
    case 'cycling':
      return {
        ...baseOptions,
        // Cycling needs frequent updates due to higher speeds
        timeInterval: 1000, // 1 second on both platforms
        distanceInterval: 8, // Primary trigger: update every 8 meters (cycling is faster)
        mayShowUserSettingsDialog: false,
      };
    default:
      return {
        ...baseOptions,
        // Default: aggressive intervals for unknown activities
        timeInterval: Platform.OS === 'android' ? 1500 : 2000, // 1.5s Android, 2s iOS
        distanceInterval: 5, // Primary trigger: update every 5 meters
      };
  }
}
