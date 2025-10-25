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
}

interface SessionState {
  sessionId: string;
  activityType: string;
  isTracking: boolean;
  isPaused: boolean;
  startTime: number;
}

/**
 * Hybrid Duration Tracker
 * GPS-based when available, JS timer when GPS is lost
 */
class HybridDurationTracker {
  private jsTimerSeconds: number = 0;
  private gpsBasedDuration: number = 0;
  private lastGpsTimestamp: number = 0;
  private startTime: number = 0;
  private totalPausedTime: number = 0;
  private pauseStartTime: number = 0;
  private timerInterval: NodeJS.Timeout | null = null;

  start(startTime: number) {
    this.startTime = startTime;
    this.jsTimerSeconds = 0;
    this.gpsBasedDuration = 0;
    this.lastGpsTimestamp = startTime;

    // Start simple JS timer (always works!)
    this.timerInterval = setInterval(() => {
      if (this.pauseStartTime === 0) { // Only increment if not paused
        this.jsTimerSeconds++;
      }
    }, 1000);

    console.log('[HybridDurationTracker] Started - JS timer active');
  }

  stop() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    console.log('[HybridDurationTracker] Stopped');
  }

  pause() {
    this.pauseStartTime = Date.now();
    console.log('[HybridDurationTracker] Paused');
  }

  resume() {
    if (this.pauseStartTime > 0) {
      const pauseDuration = Date.now() - this.pauseStartTime;
      this.totalPausedTime += pauseDuration;
      this.pauseStartTime = 0;
      console.log(`[HybridDurationTracker] Resumed (paused for ${(pauseDuration / 1000).toFixed(1)}s)`);
    }
  }

  /**
   * Update with GPS timestamp when available
   * Falls back to JS timer when GPS signal is lost
   */
  updateWithGPS(gpsTimestamp: number) {
    if (gpsTimestamp > this.lastGpsTimestamp) {
      // Calculate duration from GPS timestamps
      this.gpsBasedDuration = (gpsTimestamp - this.startTime - this.totalPausedTime) / 1000;
      this.lastGpsTimestamp = gpsTimestamp;

      // Sync JS timer to GPS (keeps them in sync)
      this.jsTimerSeconds = Math.floor(this.gpsBasedDuration);
    }
  }

  /**
   * Get current duration in seconds
   * Returns GPS-based duration if available, JS timer otherwise
   */
  getDuration(): number {
    // Use whichever is larger (handles GPS signal loss gracefully)
    return Math.max(this.jsTimerSeconds, Math.floor(this.gpsBasedDuration));
  }

  getTotalPausedTime(): number {
    const currentPause = this.pauseStartTime > 0 ? Date.now() - this.pauseStartTime : 0;
    return Math.floor((this.totalPausedTime + currentPause) / 1000);
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

  // Duration tracker (hybrid GPS + JS)
  private durationTracker = new HybridDurationTracker();

  // Start time
  private startTime: number = 0;

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
   * Start tracking - Simple and reliable
   */
  async startTracking(activityType: 'running' | 'walking' | 'cycling'): Promise<boolean> {
    try {
      console.log(`[SimpleRunTracker] Starting ${activityType} tracking...`);

      // Check if already running and clean up
      const isAlreadyRunning = await Location.hasStartedLocationUpdatesAsync(SIMPLE_TRACKER_TASK);
      if (isAlreadyRunning) {
        console.log('[SimpleRunTracker] Previous session detected, cleaning up...');
        await Location.stopLocationUpdatesAsync(SIMPLE_TRACKER_TASK);
      }

      // Request permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        throw new Error('Foreground location permission required');
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.warn('[SimpleRunTracker] Background permission not granted - tracking may be limited');
      }

      // Initialize session
      this.sessionId = `run_${Date.now()}`;
      this.activityType = activityType;
      this.startTime = Date.now();
      this.isTracking = true;
      this.isPaused = false;
      this.pauseCount = 0;

      // Clear previous GPS points
      await AsyncStorage.removeItem(GPS_POINTS_KEY);

      // Save session state
      await this.saveSessionState();

      // Start duration tracker
      this.durationTracker.start(this.startTime);

      // Start GPS tracking (single subscription via TaskManager)
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

      console.log('[SimpleRunTracker] ✅ Tracking started successfully');
      return true;

    } catch (error) {
      console.error('[SimpleRunTracker] Failed to start tracking:', error);

      // Fallback: at least start the timer so user can track time manually
      this.isTracking = true;
      this.startTime = Date.now();
      this.durationTracker.start(this.startTime);
      console.log('[SimpleRunTracker] ⚠️ Started in timer-only mode (GPS unavailable)');

      throw error;
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

    // Get stored GPS points
    const gpsPoints = await this.getStoredPoints();
    console.log(`[SimpleRunTracker] Retrieved ${gpsPoints.length} GPS points`);

    // Calculate distance from GPS points (post-processing)
    const distance = this.calculateTotalDistance(gpsPoints);

    // Create final session
    const session: RunSession = {
      id: this.sessionId || `run_${Date.now()}`,
      activityType: this.activityType,
      startTime: this.startTime,
      endTime: Date.now(),
      distance,
      duration: this.durationTracker.getDuration(),
      pausedDuration: this.durationTracker.getTotalPausedTime(),
      pauseCount: this.pauseCount,
      gpsPoints,
    };

    // Reset state
    this.isTracking = false;
    this.isPaused = false;
    this.sessionId = null;

    // Clear session state
    await AsyncStorage.removeItem(SESSION_STATE_KEY);
    await AsyncStorage.removeItem(GPS_POINTS_KEY);

    console.log(`[SimpleRunTracker] ✅ Session completed: ${(distance / 1000).toFixed(2)} km in ${session.duration}s`);

    return session;
  }

  /**
   * Get current session data (for live UI updates)
   */
  async getCurrentSession(): Promise<Partial<RunSession> | null> {
    if (!this.isTracking) {
      return null;
    }

    // Get current GPS points for live distance updates
    const gpsPoints = await this.getStoredPoints();
    const distance = this.calculateTotalDistance(gpsPoints);

    return {
      id: this.sessionId || `run_${Date.now()}`,
      activityType: this.activityType,
      startTime: this.startTime,
      distance,
      duration: this.durationTracker.getDuration(),
      pausedDuration: this.durationTracker.getTotalPausedTime(),
      pauseCount: this.pauseCount,
      gpsPoints: gpsPoints.slice(-100), // Last 100 points for route display
    };
  }

  /**
   * Update duration with latest GPS timestamp
   * Called from background task when new GPS data arrives
   */
  async updateWithLatestGPS() {
    const points = await this.getStoredPoints();
    if (points.length > 0) {
      const latestPoint = points[points.length - 1];
      this.durationTracker.updateWithGPS(latestPoint.timestamp);
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
   * Save session state to AsyncStorage
   */
  private async saveSessionState() {
    const state: SessionState = {
      sessionId: this.sessionId || '',
      activityType: this.activityType,
      isTracking: this.isTracking,
      isPaused: this.isPaused,
      startTime: this.startTime,
    };
    await AsyncStorage.setItem(SESSION_STATE_KEY, JSON.stringify(state));
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
}

// Export singleton instance
export const simpleRunTracker = SimpleRunTracker.getInstance();
