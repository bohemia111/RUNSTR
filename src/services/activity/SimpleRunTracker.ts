/**
 * SimpleRunTracker - Clean, working run tracker following proven patterns
 *
 * Key Architecture Decisions:
 * 1. Simple JS timer - Always works, independent of GPS signal
 * 2. Hybrid duration - GPS-synced but falls back to JS when signal lost
 * 3. Single subscription - TaskManager only, no conflicts
 * 4. Post-processing - Calculate distance from stored points after run
 *
 * Inspired by: Junior dev's guide + working reference implementation
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Storage keys
const GPS_POINTS_KEY = '@runstr:gps_points';
const SESSION_STATE_KEY = '@runstr:session_state';
const CHECKPOINT_KEY = '@runstr:workout_checkpoint';

// Task name
export const SIMPLE_TRACKER_TASK = 'runstr-simple-tracker';

// Types
export interface GPSPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
}

export interface Split {
  splitNumber: number; // 1, 2, 3, etc.
  distance: number; // meters
  duration: number; // seconds (cumulative time at this split)
  pace: number; // seconds per km/mile
}

export interface RunSession {
  id: string;
  activityType: 'running' | 'walking' | 'cycling';
  startTime: number;
  endTime?: number;
  distance: number; // meters
  duration: number; // seconds
  pausedDuration: number; // seconds
  pauseCount: number;
  gpsPoints: GPSPoint[];
  presetDistance?: number; // Optional race preset distance in meters
}

interface SessionState {
  sessionId: string;
  activityType: string;
  isTracking: boolean;
  isPaused: boolean;
  startTime: number;
  pauseCount: number;
  presetDistance?: number; // Optional race preset distance in meters
  // SimpleDurationTracker state (for session recovery)
  trackerStartTime: number;
  trackerTotalPausedTime: number;
  trackerPauseStartTime: number;
  trackerDuration: number;
}

/**
 * Simple Duration Tracker (like Reference Implementation)
 * Just calculates: (now - startTime - pausedTime) / 1000
 * No GPS interference, no hybrid logic, no complexity
 */
class SimpleDurationTracker {
  private startTime: number = 0;
  private totalPausedTime: number = 0;
  private pauseStartTime: number = 0;
  private timerInterval: NodeJS.Timeout | null = null;
  private duration: number = 0;

  start(startTime: number) {
    this.startTime = startTime;
    this.totalPausedTime = 0;
    this.pauseStartTime = 0;
    this.duration = 0;

    // Simple timer - just updates duration every second from Date.now()
    this.timerInterval = setInterval(() => {
      if (this.pauseStartTime === 0) {
        // Simple calculation like reference implementation
        const now = Date.now();
        this.duration = Math.floor((now - this.startTime - this.totalPausedTime) / 1000);
      }
    }, 1000);

    console.log('[SimpleDurationTracker] Started - counting 1, 2, 3, 4, 5...');
  }

  stop() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    console.log('[SimpleDurationTracker] Stopped');
  }

  pause() {
    this.pauseStartTime = Date.now();
    console.log('[SimpleDurationTracker] Paused');
  }

  resume() {
    if (this.pauseStartTime > 0) {
      const pauseDuration = Date.now() - this.pauseStartTime;
      this.totalPausedTime += pauseDuration;
      this.pauseStartTime = 0;
      console.log(`[SimpleDurationTracker] Resumed (paused for ${(pauseDuration / 1000).toFixed(1)}s)`);
    }
  }

  /**
   * Get current duration in seconds
   * Simple: (now - startTime - pausedTime) / 1000
   */
  getDuration(): number {
    // If paused, return frozen duration
    if (this.pauseStartTime > 0) {
      return this.duration;
    }
    // Otherwise calculate from current time
    const now = Date.now();
    return Math.floor((now - this.startTime - this.totalPausedTime) / 1000);
  }

  getTotalPausedTime(): number {
    const currentPause = this.pauseStartTime > 0 ? Date.now() - this.pauseStartTime : 0;
    return Math.floor((this.totalPausedTime + currentPause) / 1000);
  }

  /**
   * Export tracker state for session persistence
   */
  exportState() {
    return {
      startTime: this.startTime,
      totalPausedTime: this.totalPausedTime,
      pauseStartTime: this.pauseStartTime,
      duration: this.getDuration(),
    };
  }

  /**
   * Restore tracker state from saved session
   */
  restoreState(state: {
    startTime: number;
    totalPausedTime: number;
    pauseStartTime: number;
    duration: number;
  }) {
    this.startTime = state.startTime;
    this.totalPausedTime = state.totalPausedTime;
    this.pauseStartTime = state.pauseStartTime;
    this.duration = state.duration;

    // Restart timer
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.timerInterval = setInterval(() => {
      if (this.pauseStartTime === 0) {
        const now = Date.now();
        this.duration = Math.floor((now - this.startTime - this.totalPausedTime) / 1000);
      }
    }, 1000);

    console.log('[SimpleDurationTracker] State restored - timer resuming');
  }
}

/**
 * SimpleRunTracker - Main tracking service
 */
export class SimpleRunTracker {
  private static instance: SimpleRunTracker;

  // Core state
  private sessionId: string | null = null;
  private activityType: 'running' | 'walking' | 'cycling' = 'running';
  private isTracking = false;
  private isPaused = false;
  private pauseCount = 0;
  private presetDistance: number | null = null; // Race preset distance in meters

  // Duration tracker (simple Date.now() calculation)
  private durationTracker = new SimpleDurationTracker();

  // Start time
  private startTime: number = 0;

  // In-memory GPS points cache (synced from AsyncStorage)
  // This prevents async reads on every UI update (fixes duration bug)
  private cachedGpsPoints: GPSPoint[] = [];

  // Auto-stop callback (for UI notification when preset distance reached)
  private autoStopCallback: (() => void) | null = null;

  private constructor() {
    console.log('[SimpleRunTracker] Initialized');
  }

  static getInstance(): SimpleRunTracker {
    if (!SimpleRunTracker.instance) {
      SimpleRunTracker.instance = new SimpleRunTracker();
    }
    return SimpleRunTracker.instance;
  }

  /**
   * Start tracking - INSTANT UI RESPONSE (like reference implementation)
   * Sets state immediately, GPS initializes in background
   * @param activityType - Type of activity (running, walking, cycling)
   * @param presetDistance - Optional race preset distance in meters (for auto-stop)
   */
  async startTracking(
    activityType: 'running' | 'walking' | 'cycling',
    presetDistance?: number
  ): Promise<boolean> {
    // INSTANT: Set state immediately (no await blocking)
    this.sessionId = `run_${Date.now()}`;
    this.activityType = activityType;
    this.startTime = Date.now();
    this.isTracking = true;
    this.isPaused = false;
    this.pauseCount = 0;
    this.presetDistance = presetDistance || null;
    this.cachedGpsPoints = []; // Clear cache immediately

    // INSTANT: Start timer immediately (user sees 1, 2, 3... right away!)
    this.durationTracker.start(this.startTime);
    console.log('[SimpleRunTracker] ⏱️ INSTANT START - Stopwatch counting 1, 2, 3, 4, 5...');
    if (presetDistance) {
      console.log(`[SimpleRunTracker] 🎯 Preset distance: ${(presetDistance / 1000).toFixed(2)} km`);
    }

    // Background tasks (don't block UI)
    this.initializeGPS(activityType).catch(error => {
      console.error('[SimpleRunTracker] GPS initialization failed:', error);
      // Timer still runs even if GPS fails!
    });

    return true;
  }

  /**
   * Initialize GPS in background (non-blocking)
   * Like reference implementation - GPS starts async
   */
  private async initializeGPS(activityType: 'running' | 'walking' | 'cycling'): Promise<void> {
    try {
      console.log(`[SimpleRunTracker] Initializing GPS for ${activityType}...`);

      // Clean up any existing GPS watchers
      const isAlreadyRunning = await Location.hasStartedLocationUpdatesAsync(SIMPLE_TRACKER_TASK);
      if (isAlreadyRunning) {
        console.log('[SimpleRunTracker] Cleaning up previous GPS session...');
        await Location.stopLocationUpdatesAsync(SIMPLE_TRACKER_TASK);
      }

      // Clear previous data from storage
      await AsyncStorage.removeItem(GPS_POINTS_KEY);
      await AsyncStorage.removeItem(SESSION_STATE_KEY);

      // Save fresh session state
      await this.saveSessionState();

      // Start GPS tracking (background operation)
      await Location.startLocationUpdatesAsync(SIMPLE_TRACKER_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000, // 1 second
        distanceInterval: 5, // 5 meters
        foregroundService: {
          notificationTitle: `RUNSTR - ${activityType.charAt(0).toUpperCase() + activityType.slice(1)} Tracking`,
          notificationBody: 'Tap to return to your run',
          notificationColor: '#FF6B35',
        },
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.Fitness,
        showsBackgroundLocationIndicator: true,
      });

      console.log('[SimpleRunTracker] ✅ GPS tracking started');
    } catch (error) {
      console.error('[SimpleRunTracker] GPS initialization error:', error);
      // Timer keeps running even if GPS fails!
    }
  }

  /**
   * Pause tracking
   */
  async pauseTracking(): Promise<void> {
    if (!this.isTracking || this.isPaused) {
      console.warn('[SimpleRunTracker] Cannot pause - not tracking or already paused');
      return;
    }

    this.isPaused = true;
    this.pauseCount++;
    this.durationTracker.pause();

    // Update session state
    await this.saveSessionState();

    console.log('[SimpleRunTracker] Paused');
  }

  /**
   * Resume tracking
   */
  async resumeTracking(): Promise<void> {
    if (!this.isTracking || !this.isPaused) {
      console.warn('[SimpleRunTracker] Cannot resume - not tracking or not paused');
      return;
    }

    this.isPaused = false;
    this.durationTracker.resume();

    // Update session state
    await this.saveSessionState();

    console.log('[SimpleRunTracker] Resumed');
  }

  /**
   * Stop tracking and return final session
   */
  async stopTracking(): Promise<RunSession | null> {
    if (!this.isTracking) {
      console.warn('[SimpleRunTracker] Not tracking, nothing to stop');
      return null;
    }

    console.log('[SimpleRunTracker] Stopping tracking...');

    // Stop GPS
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(SIMPLE_TRACKER_TASK);
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(SIMPLE_TRACKER_TASK);
      }
    } catch (error) {
      console.error('[SimpleRunTracker] Error stopping GPS:', error);
    }

    // Stop duration tracker
    this.durationTracker.stop();

    // Sync final GPS points from storage to cache
    await this.syncGpsPointsFromStorage();
    console.log(`[SimpleRunTracker] Retrieved ${this.cachedGpsPoints.length} GPS points`);

    // Calculate distance from GPS points (post-processing)
    const distance = this.calculateTotalDistance(this.cachedGpsPoints);

    // Create final session (using cached GPS points)
    const session: RunSession = {
      id: this.sessionId || `run_${Date.now()}`,
      activityType: this.activityType,
      startTime: this.startTime,
      endTime: Date.now(),
      distance,
      duration: this.durationTracker.getDuration(),
      pausedDuration: this.durationTracker.getTotalPausedTime(),
      pauseCount: this.pauseCount,
      gpsPoints: this.cachedGpsPoints,
      presetDistance: this.presetDistance || undefined,
    };

    // Reset state
    this.isTracking = false;
    this.isPaused = false;
    this.sessionId = null;
    this.presetDistance = null;
    this.autoStopCallback = null;

    // Clear session state
    await AsyncStorage.removeItem(SESSION_STATE_KEY);
    await AsyncStorage.removeItem(GPS_POINTS_KEY);

    console.log(`[SimpleRunTracker] ✅ Session completed: ${(distance / 1000).toFixed(2)} km in ${session.duration}s`);

    return session;
  }

  /**
   * Get current session data (for live UI updates)
   * NOW SYNCHRONOUS - uses in-memory cache instead of AsyncStorage
   */
  getCurrentSession(): Partial<RunSession> | null {
    if (!this.isTracking) {
      return null;
    }

    // Use cached GPS points (no async read needed!)
    const distance = this.calculateTotalDistance(this.cachedGpsPoints);

    return {
      id: this.sessionId || `run_${Date.now()}`,
      activityType: this.activityType,
      startTime: this.startTime,
      distance,
      duration: this.durationTracker.getDuration(),
      pausedDuration: this.durationTracker.getTotalPausedTime(),
      pauseCount: this.pauseCount,
      gpsPoints: this.cachedGpsPoints.slice(-100), // Last 100 points for route display
      presetDistance: this.presetDistance || undefined,
    };
  }

  /**
   * Sync GPS points from AsyncStorage to in-memory cache
   * Call this when app returns to foreground or background task adds new points
   */
  async syncGpsPointsFromStorage(): Promise<void> {
    try {
      const points = await this.getStoredPoints();
      this.cachedGpsPoints = points;
      console.log(`[SimpleRunTracker] Synced ${points.length} GPS points to cache (for distance only)`);
      // Timer runs independently - no GPS duration updates!
    } catch (error) {
      console.error('[SimpleRunTracker] Error syncing GPS points:', error);
    }
  }

  /**
   * Set callback for auto-stop when preset distance is reached
   * @param callback - Function to call when auto-stop is triggered
   */
  setAutoStopCallback(callback: () => void): void {
    this.autoStopCallback = callback;
  }

  /**
   * Check if auto-stop should be triggered (preset distance reached)
   * @returns true if auto-stop was triggered
   */
  private checkAutoStop(): boolean {
    if (!this.presetDistance || !this.isTracking) {
      return false;
    }

    const currentDistance = this.calculateTotalDistance(this.cachedGpsPoints);

    if (currentDistance >= this.presetDistance) {
      console.log(
        `[SimpleRunTracker] 🎯 AUTO-STOP: Reached preset distance ${(this.presetDistance / 1000).toFixed(2)} km`
      );

      // Trigger callback if set (UI will call stopTracking)
      if (this.autoStopCallback) {
        this.autoStopCallback();
      }

      return true;
    }

    return false;
  }

  /**
   * Append GPS points from background task (REAL-TIME UPDATES!)
   * This is called by SimpleRunTrackerTask when GPS data arrives
   *
   * Architecture: GPS ONLY for distance, timer is independent stopwatch
   * GPS → Background Task → Direct cache update → Distance updates
   * Timer → Pure JS stopwatch → Counts 1, 2, 3, 4, 5...
   */
  appendGpsPointsToCache(points: GPSPoint[]): void {
    if (!this.isTracking || points.length === 0) {
      return;
    }

    // Update in-memory cache (instant distance updates!)
    this.cachedGpsPoints.push(...points);

    // Keep cache trimmed (last 10,000 points max)
    if (this.cachedGpsPoints.length > 10000) {
      this.cachedGpsPoints = this.cachedGpsPoints.slice(-10000);
    }

    // Check for auto-stop (preset distance reached)
    this.checkAutoStop();

    // DO NOT update duration - timer runs independently like a stopwatch!
    // GPS is ONLY for distance calculation

    // Persist to AsyncStorage asynchronously (background operation)
    this.saveGpsPointsToStorage(this.cachedGpsPoints);

    console.log(
      `[SimpleRunTracker] 📍 Appended ${points.length} GPS points to cache (${this.cachedGpsPoints.length} total)`
    );
  }

  /**
   * Save GPS points to AsyncStorage (async, non-blocking)
   * Called by appendGpsPointsToCache after updating in-memory cache
   */
  private async saveGpsPointsToStorage(points: GPSPoint[]): Promise<void> {
    try {
      await AsyncStorage.setItem(GPS_POINTS_KEY, JSON.stringify(points));
    } catch (error) {
      console.error('[SimpleRunTracker] Error saving GPS points to storage:', error);
    }
  }

  /**
   * Calculate total distance from GPS points using Haversine formula
   */
  private calculateTotalDistance(points: GPSPoint[]): number {
    if (points.length < 2) {
      return 0;
    }

    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      totalDistance += this.haversineDistance(points[i - 1], points[i]);
    }

    return totalDistance;
  }

  /**
   * Haversine formula for distance between two GPS points
   */
  private haversineDistance(p1: GPSPoint, p2: GPSPoint): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (p1.latitude * Math.PI) / 180;
    const φ2 = (p2.latitude * Math.PI) / 180;
    const Δφ = ((p2.latitude - p1.latitude) * Math.PI) / 180;
    const Δλ = ((p2.longitude - p1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Get stored GPS points from AsyncStorage
   */
  private async getStoredPoints(): Promise<GPSPoint[]> {
    try {
      const stored = await AsyncStorage.getItem(GPS_POINTS_KEY);
      if (!stored) {
        return [];
      }
      return JSON.parse(stored);
    } catch (error) {
      console.error('[SimpleRunTracker] Error reading GPS points:', error);
      return [];
    }
  }

  /**
   * Save session state to AsyncStorage (includes complete tracker state)
   */
  private async saveSessionState() {
    try {
      const trackerState = this.durationTracker.exportState();
      const state: SessionState = {
        sessionId: this.sessionId || '',
        activityType: this.activityType,
        isTracking: this.isTracking,
        isPaused: this.isPaused,
        startTime: this.startTime,
        pauseCount: this.pauseCount,
        presetDistance: this.presetDistance || undefined,
        // Include tracker state for session recovery
        trackerStartTime: trackerState.startTime,
        trackerTotalPausedTime: trackerState.totalPausedTime,
        trackerPauseStartTime: trackerState.pauseStartTime,
        trackerDuration: trackerState.duration,
      };
      await AsyncStorage.setItem(SESSION_STATE_KEY, JSON.stringify(state));
      console.log('[SimpleRunTracker] Session state saved');
    } catch (error) {
      console.error('[SimpleRunTracker] Error saving session state:', error);
    }
  }

  /**
   * Get tracking state
   */
  getTrackingState(): 'idle' | 'tracking' | 'paused' {
    if (!this.isTracking) return 'idle';
    return this.isPaused ? 'paused' : 'tracking';
  }

  /**
   * Check if tracking
   */
  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  /**
   * Check if paused
   */
  isCurrentlyPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Check for active session and restore if found
   * Call this when app returns to foreground or on screen mount
   */
  async restoreSession(): Promise<boolean> {
    try {
      const sessionStateStr = await AsyncStorage.getItem(SESSION_STATE_KEY);
      if (!sessionStateStr) {
        console.log('[SimpleRunTracker] No active session to restore');
        return false;
      }

      const sessionState: SessionState = JSON.parse(sessionStateStr);

      // Restore session data
      this.sessionId = sessionState.sessionId;
      this.activityType = sessionState.activityType as 'running' | 'walking' | 'cycling';
      this.isTracking = sessionState.isTracking;
      this.isPaused = sessionState.isPaused;
      this.startTime = sessionState.startTime;
      this.pauseCount = sessionState.pauseCount;
      this.presetDistance = sessionState.presetDistance || null;

      // Restore duration tracker state
      this.durationTracker.restoreState({
        startTime: sessionState.trackerStartTime,
        totalPausedTime: sessionState.trackerTotalPausedTime,
        pauseStartTime: sessionState.trackerPauseStartTime,
        duration: sessionState.trackerDuration,
      });

      // Sync GPS points from storage to cache
      await this.syncGpsPointsFromStorage();

      console.log(`[SimpleRunTracker] ✅ Session restored: ${sessionState.sessionId}`);
      if (this.presetDistance) {
        console.log(`[SimpleRunTracker] 🎯 Restored preset distance: ${(this.presetDistance / 1000).toFixed(2)} km`);
      }
      return true;
    } catch (error) {
      console.error('[SimpleRunTracker] Error restoring session:', error);
      return false;
    }
  }
}

// Export singleton instance
export const simpleRunTracker = SimpleRunTracker.getInstance();
