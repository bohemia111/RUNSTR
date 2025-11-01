/**
 * SimpleRunTrackerTask - Background GPS point collection
 *
 * CRITICAL: This file must be imported in index.js BEFORE app initialization
 * so TaskManager knows about the background task.
 *
 * Architecture: Direct cache updates (like Nike Run Club / Strava)
 * GPS → This task → SimpleRunTracker.appendGpsPointsToCache() → Real-time UI updates
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SIMPLE_TRACKER_TASK, simpleRunTracker } from './SimpleRunTracker';
import { calculateDistance } from '../../utils/gpsValidation';
import type { GPSPoint } from './SimpleRunTracker';

// Storage keys
const SESSION_STATE_KEY = '@runstr:session_state';
const GPS_POINTS_KEY = '@runstr:gps_points';

/**
 * Define the background task
 * This runs even when app is minimized or screen is locked
 */
TaskManager.defineTask(SIMPLE_TRACKER_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[SimpleRunTrackerTask] Error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };

    try {
      // Check if session is active
      const sessionStateStr = await AsyncStorage.getItem(SESSION_STATE_KEY);
      if (!sessionStateStr) {
        console.log('[SimpleRunTrackerTask] No active session, ignoring locations');
        return;
      }

      const sessionState = JSON.parse(sessionStateStr);
      if (sessionState.isPaused) {
        console.log('[SimpleRunTrackerTask] Session paused, ignoring locations');
        return;
      }

      // Get last valid GPS point for distance calculations
      let lastValidLocation: GPSPoint | null = null;
      const storedPointsStr = await AsyncStorage.getItem(GPS_POINTS_KEY);
      if (storedPointsStr) {
        const storedPoints = JSON.parse(storedPointsStr);
        if (storedPoints.length > 0) {
          lastValidLocation = storedPoints[storedPoints.length - 1];
        }
      }

      // Track GPS warm-up points (skip first 3 points to eliminate startup jump)
      let gpsPointCount = sessionState.gpsPointCount || 0;

      // Enhanced filtering with GPS warm-up buffer and validation
      const validLocations = [];

      for (const loc of locations) {
        const accuracy = loc.coords.accuracy || 999;

        // 1. Accuracy check
        if (accuracy > 35) {
          console.log(`[SimpleRunTrackerTask] Rejected: poor accuracy ${accuracy.toFixed(1)}m`);
          continue;
        }

        // 2. GPS warm-up buffer (skip first 3 points to prevent initial jump)
        if (gpsPointCount < 3) {
          gpsPointCount++;
          sessionState.gpsPointCount = gpsPointCount;
          await AsyncStorage.setItem(SESSION_STATE_KEY, JSON.stringify(sessionState));
          console.log(`[SimpleRunTrackerTask] GPS warm-up: skipping point ${gpsPointCount}/3`);
          continue; // Skip this point for distance calculation
        }

        const currentPoint: GPSPoint = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          altitude: loc.coords.altitude || undefined,
          timestamp: loc.timestamp,
          accuracy: loc.coords.accuracy || undefined,
          speed: loc.coords.speed || undefined,
        };

        // If this is the first valid point after warm-up, accept it
        if (!lastValidLocation) {
          validLocations.push(currentPoint);
          lastValidLocation = currentPoint;
          continue;
        }

        // 3. Minimum time interval (reduce noise from too-frequent updates)
        const timeDiff = (loc.timestamp - lastValidLocation.timestamp) / 1000; // seconds
        if (timeDiff < 1.0) {
          console.log(`[SimpleRunTrackerTask] Rejected: too soon (${timeDiff.toFixed(2)}s < 1.0s)`);
          continue;
        }

        // 4. Calculate distance for validation
        const distance = calculateDistance(
          {
            latitude: lastValidLocation.latitude,
            longitude: lastValidLocation.longitude,
            timestamp: lastValidLocation.timestamp,
            accuracy: lastValidLocation.accuracy,
          },
          {
            latitude: currentPoint.latitude,
            longitude: currentPoint.longitude,
            timestamp: currentPoint.timestamp,
            accuracy: currentPoint.accuracy,
          }
        );

        // 5. GPS jitter filter (ignore tiny movements when stationary)
        if (distance < 1.5) {
          // Don't log - this is normal when stationary
          continue;
        }

        // 6. GPS teleportation filter (reject impossible jumps)
        if (distance > 50) {
          console.log(`[SimpleRunTrackerTask] Rejected: jump too large (${distance.toFixed(1)}m > 50m)`);
          continue;
        }

        // 7. Speed validation (use GPS-provided speed if available, otherwise calculate)
        const speed = loc.coords.speed || (distance / timeDiff);
        if (speed > 15) {
          console.log(`[SimpleRunTrackerTask] Rejected: unrealistic speed (${speed.toFixed(1)} m/s > 15 m/s)`);
          continue;
        }

        // Point passed all validation checks
        validLocations.push(currentPoint);
        lastValidLocation = currentPoint;
      }

      if (validLocations.length === 0) {
        console.log('[SimpleRunTrackerTask] No valid locations (all filtered out)');
        return;
      }

      // REAL-TIME UPDATES: Update SimpleRunTracker cache directly!
      // This is how Nike Run Club / Strava work - direct data flow
      // GPS → This task → Tracker cache → UI sees fresh data
      simpleRunTracker.appendGpsPointsToCache(validLocations);

      console.log(
        `[SimpleRunTrackerTask] ✅ Real-time: Sent ${validLocations.length} GPS points to tracker`
      );
    } catch (err) {
      console.error('[SimpleRunTrackerTask] Error processing locations:', err);
    }
  }
});

console.log('[SimpleRunTrackerTask] Task registered successfully');

// Export task name for verification
export { SIMPLE_TRACKER_TASK };
