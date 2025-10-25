/**
 * SimpleRunTrackerTask - Background GPS point collection
 *
 * CRITICAL: This file must be imported in index.js BEFORE app initialization
 * so TaskManager knows about the background task.
 *
 * Architecture: Just stores GPS points to AsyncStorage - Simple and reliable
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SIMPLE_TRACKER_TASK } from './SimpleRunTracker';

// Storage key
const GPS_POINTS_KEY = '@runstr:gps_points';
const SESSION_STATE_KEY = '@runstr:session_state';

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

      // Filter locations for accuracy (senior dev's recommendation)
      const validLocations = locations
        .filter((loc) => {
          const accuracy = loc.coords.accuracy || 999;
          return accuracy <= 20; // Only keep accurate readings (< 20m)
        })
        .map((loc) => ({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          altitude: loc.coords.altitude || undefined,
          timestamp: loc.timestamp,
          accuracy: loc.coords.accuracy || undefined,
          speed: loc.coords.speed || undefined,
        }));

      if (validLocations.length === 0) {
        console.log('[SimpleRunTrackerTask] No valid locations (all filtered out)');
        return;
      }

      // Get existing points from AsyncStorage
      const existingStr = await AsyncStorage.getItem(GPS_POINTS_KEY);
      const existingPoints = existingStr ? JSON.parse(existingStr) : [];

      // Append new points
      const updatedPoints = [...existingPoints, ...validLocations];

      // Keep only last 10,000 points to prevent storage bloat
      const trimmedPoints = updatedPoints.slice(-10000);

      // Save back to AsyncStorage
      await AsyncStorage.setItem(GPS_POINTS_KEY, JSON.stringify(trimmedPoints));

      console.log(
        `[SimpleRunTrackerTask] Stored ${validLocations.length} valid locations (${trimmedPoints.length} total)`
      );
    } catch (err) {
      console.error('[SimpleRunTrackerTask] Error processing locations:', err);
    }
  }
});

console.log('[SimpleRunTrackerTask] Task registered successfully');

// Export task name for verification
export { SIMPLE_TRACKER_TASK };
