/**
 * SimpleLocationTrackingService - Simplified GPS tracking based on reference implementation
 *
 * Replaces the complex EnhancedLocationTrackingService (1,183 lines) with a simple,
 * proven pattern from the working reference implementation (~400 lines).
 *
 * Philosophy: Start simple, add complexity only when proven necessary by user data.
 *
 * See: docs/ACTIVITY_TRACKING_SIMPLIFICATION.md for full migration details
 */

import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { locationPermissionService } from './LocationPermissionService';
import { KalmanFilter } from '../../utils/KalmanFilter';
import { filterLocation } from '../../utils/gpsValidation';
import { appPermissionService } from '../initialization/AppPermissionService';
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  pauseBackgroundTracking,
  resumeBackgroundTracking,
  getAndClearBackgroundLocations,
  getAndClearBackgroundDistance,
} from './BackgroundLocationTask';

// Types
export interface LocationPoint {
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

export interface TrackingSession {
  id: string;
  activityType: 'running' | 'walking' | 'cycling';
  startTime: number;
  endTime?: number;
  distance: number; // meters
  duration: number; // seconds (excluding pauses)
  pausedDuration: number; // seconds
  elevationGain: number; // meters
  elevationLoss: number; // meters
  pauseCount: number; // number of times paused
  splits: Split[];
  positions: LocationPoint[];
}

export type GPSSignalStrength =
  | 'none'
  | 'weak'
  | 'medium'
  | 'strong'
  | 'searching';

// Simple location tracking service
export class SimpleLocationTrackingService {
  private static instance: SimpleLocationTrackingService;

  // 🎛️ Feature Flags - Easy toggle for testing
  private readonly USE_KALMAN_FILTER = true; // Set to false to disable Kalman filtering
  private readonly USE_POSITION_VALIDATION = true; // Set to false to disable validation

  // Core tracking state (simple booleans, no complex state machine)
  private isTracking = false;
  private isPaused = false;

  // Session data
  private sessionId: string | null = null;
  private activityType: 'running' | 'walking' | 'cycling' = 'running';
  private startTime: number = 0;
  private pauseStartTime: number = 0;
  private totalPausedTime: number = 0; // milliseconds

  // GPS data
  private distance: number = 0; // meters
  private duration: number = 0; // seconds - calculated from GPS timestamps
  private positions: LocationPoint[] = [];
  private elevationGain: number = 0;
  private elevationLoss: number = 0;
  private lastAltitude: number | null = null;
  private splits: Split[] = [];
  private lastSplitDistance: number = 0; // meters
  private pauseCount: number = 0;

  // Location subscription
  private locationSubscription: Location.LocationSubscription | null = null;
  private lastPosition: LocationPoint | null = null;

  // Background sync timer (for real-time background updates)
  private backgroundSyncTimer: NodeJS.Timeout | null = null;

  // AppState subscription for background/foreground detection
  private appStateSubscription: any = null;

  // GPS signal tracking
  private lastGPSUpdate: number = 0;
  private currentAccuracy: number | undefined;

  // GPS filtering
  private kalmanFilter: KalmanFilter;

  // Constants
  private readonly SPLIT_DISTANCE_METERS = 1000; // 1 km (TODO: support miles)
  private readonly GPS_SIGNAL_TIMEOUT_MS = 10000; // 10 seconds
  private readonly MIN_MOVEMENT_THRESHOLD_METERS = 0.5; // Filter micro-jitter

  private constructor() {
    console.log('[SimpleLocationTrackingService] Initialized');
    // Use warm start for better first-run accuracy
    this.kalmanFilter = new KalmanFilter(true);

    // Set up AppState listener for background/foreground detection
    this.setupAppStateListener();
  }

  static getInstance(): SimpleLocationTrackingService {
    if (!SimpleLocationTrackingService.instance) {
      SimpleLocationTrackingService.instance =
        new SimpleLocationTrackingService();
    }
    return SimpleLocationTrackingService.instance;
  }

  /**
   * Set up AppState listener to optimize background polling and prevent subscription conflicts
   * CRITICAL FIX: Stop foreground subscription when backgrounding to prevent dual-subscription conflicts
   * This ensures only ONE location listener is active at a time (Android limitation)
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      async (nextAppState: AppStateStatus) => {
        if (nextAppState === 'background') {
          // App went to background
          console.log(
            '[SimpleLocationTrackingService] App backgrounded - stopping foreground subscription'
          );

          // CRITICAL FIX: Stop foreground location subscription to prevent conflict
          // Background TaskManager will continue tracking
          if (this.locationSubscription) {
            this.locationSubscription.remove();
            this.locationSubscription = null;
            console.log('[SimpleLocationTrackingService] ✅ Foreground subscription removed');
          }

          // Stop JavaScript polling timer (saves battery)
          if (this.backgroundSyncTimer) {
            this.stopBackgroundSyncPolling();
          }
        } else if (nextAppState === 'active') {
          // App returned to foreground
          if (this.isTracking && !this.isPaused) {
            console.log(
              '[SimpleLocationTrackingService] App foregrounded, restarting foreground subscription...'
            );

            // Step 1: Immediately sync background data BEFORE resuming
            const synced = await this.syncFromBackground();
            if (synced) {
              console.log('[SimpleLocationTrackingService] ✅ Background data synced on foreground');
            }

            // Step 2: Restart foreground location subscription for real-time UI updates
            try {
              this.locationSubscription = await Location.watchPositionAsync(
                {
                  accuracy: Location.Accuracy.BestForNavigation,
                  timeInterval: 1000,
                  distanceInterval: 0,
                  ...(Platform.OS === 'ios' && {
                    activityType: Location.ActivityType.Fitness,
                    pausesUpdatesAutomatically: false,
                    showsBackgroundLocationIndicator: true,
                  }),
                },
                (location) => this.handleLocationUpdate(location)
              );
              console.log('[SimpleLocationTrackingService] ✅ Foreground subscription restarted');
            } catch (error) {
              console.error('[SimpleLocationTrackingService] Failed to restart foreground subscription:', error);
            }

            // Step 3: Resume polling for ongoing background sync
            if (!this.backgroundSyncTimer) {
              this.startBackgroundSyncPolling();
            }
          }
        }
      }
    );
  }

  /**
   * Start GPS tracking
   */
  async startTracking(
    activityType: 'running' | 'walking' | 'cycling'
  ): Promise<boolean> {
    try {
      console.log(
        `[SimpleLocationTrackingService] Starting ${activityType} tracking`
      );

      // Don't allow starting if already tracking
      if (this.isTracking) {
        console.warn(
          '[SimpleLocationTrackingService] Already tracking, call stopTracking() first'
        );
        return false;
      }

      // 1. Validate permissions (all permissions should be granted by app startup modal)
      const permissionStatus = await appPermissionService.checkAllPermissions();

      if (!permissionStatus.location) {
        console.error(
          '[SimpleLocationTrackingService] Location permissions missing'
        );
        throw new Error(
          'Location permission required.\n\n' +
            'Please restart the app to grant location permissions.'
        );
      }

      // Android-specific: Validate additional permissions
      if (Platform.OS === 'android') {
        if (!permissionStatus.notification) {
          console.error('[ANDROID] Notification permission missing');
          throw new Error(
            'Notification permission required for background tracking.\n\n' +
              'Please restart the app to grant notification permission.'
          );
        }

        if (!permissionStatus.batteryOptimization) {
          console.warn(
            '[ANDROID] Battery optimization not configured - background tracking may be limited'
          );
          // Don't block - this is non-critical
        }
      }

      // 2. Initialize session
      this.sessionId = `session_${Date.now()}`;
      this.activityType = activityType;
      this.startTime = Date.now();
      this.pauseStartTime = 0;
      this.totalPausedTime = 0;

      // Reset tracking data
      this.distance = 0;
      this.duration = 0;  // Reset GPS-timestamp-based duration
      this.positions = [];
      this.elevationGain = 0;
      this.elevationLoss = 0;
      this.lastAltitude = null;
      this.splits = [];
      this.lastSplitDistance = 0;
      this.pauseCount = 0;
      this.lastPosition = null;
      this.lastGPSUpdate = Date.now();
      this.currentAccuracy = undefined;

      // Reset Kalman filter for new session
      if (this.USE_KALMAN_FILTER) {
        this.kalmanFilter.reset();
        console.log(
          '[SimpleLocationTrackingService] Kalman filter reset for new session'
        );
      }

      // 3. Start location tracking
      console.log(
        '[SimpleLocationTrackingService] Starting GPS location updates...'
      );
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000, // Update every second
          distanceInterval: 0, // Get all updates (we'll filter in code)
          // iOS-specific options
          ...(Platform.OS === 'ios' && {
            activityType: Location.ActivityType.Fitness,
            pausesUpdatesAutomatically: false,
            showsBackgroundLocationIndicator: true,
          }),
        },
        (location) => this.handleLocationUpdate(location)
      );

      // 3.5. Start background location task (iOS and Android)
      const backgroundStarted = await startBackgroundLocationTracking(
        activityType,
        this.sessionId || `session_${Date.now()}`
      );

      if (backgroundStarted) {
        console.log(
          `[${Platform.OS.toUpperCase()}] Background location task started`
        );
      } else {
        console.warn(
          `[${Platform.OS.toUpperCase()}] Failed to start background task - continuing with foreground only`
        );
      }

      // 4. Activate KeepAwake to prevent GPS throttling
      try {
        await activateKeepAwakeAsync('activity-tracking');
        console.log('[SimpleLocationTrackingService] KeepAwake activated');
      } catch (error) {
        console.warn(
          '[SimpleLocationTrackingService] Failed to activate KeepAwake:',
          error
        );
      }

      // 5. Start background sync polling for real-time updates
      this.startBackgroundSyncPolling();

      // 6. Set tracking flag
      this.isTracking = true;
      this.isPaused = false;

      console.log(
        `[SimpleLocationTrackingService] ✅ ${activityType} tracking started successfully`
      );
      return true;
    } catch (error) {
      // Detailed error logging for debugging
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        '[SimpleLocationTrackingService] Failed to start tracking:',
        errorMessage
      );
      console.error('[SimpleLocationTrackingService] Full error:', error);

      // Provide Android-specific guidance based on error type
      if (Platform.OS === 'android') {
        const apiLevel = Device.platformApiLevel || 0;

        if (errorMessage.includes('notification')) {
          throw new Error(
            'Background tracking requires notification permission on Android 13+.\n\n' +
              'Please go to Settings → Apps → RUNSTR → Permissions and enable Notifications.'
          );
        }

        if (errorMessage.includes('location')) {
          throw new Error(
            'Location permission required for tracking.\n\n' +
              'Please ensure location is set to "Allow all the time" in Settings → Apps → RUNSTR → Permissions.'
          );
        }

        // Generic Android error with helpful context
        console.error('[ANDROID] Common causes:');
        console.error('  - Location services disabled in device settings');
        console.error('  - Battery optimization blocking location access');
        console.error('  - Google Play Services outdated or unavailable');
      }

      // Re-throw error with message for UI to display
      throw error;
    }
  }

  /**
   * Handle incoming GPS location update
   */
  private handleLocationUpdate(location: Location.LocationObject): void {
    // Ignore updates if paused
    if (this.isPaused) {
      return;
    }

    // Create raw location point
    let processedPoint: LocationPoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude || undefined,
      timestamp: location.timestamp,
      accuracy: location.coords.accuracy || undefined,
      speed: location.coords.speed || undefined,
    };

    // Phase 1: Apply Kalman filter (smooths GPS jitter)
    if (this.USE_KALMAN_FILTER) {
      const filtered = this.kalmanFilter.update(
        location.coords.latitude,
        location.coords.longitude,
        location.coords.accuracy || 20,
        location.timestamp
      );

      processedPoint = {
        ...processedPoint,
        latitude: filtered.lat,
        longitude: filtered.lng,
        accuracy: filtered.accuracy,
      };

      // Log filtering effect on Android
      if (Platform.OS === 'android') {
        const rawDist =
          Math.sqrt(
            Math.pow(location.coords.latitude - filtered.lat, 2) +
              Math.pow(location.coords.longitude - filtered.lng, 2)
          ) * 111111; // Rough meters
        if (rawDist > 1) {
          console.log(
            `[ANDROID] Kalman filtered: ${rawDist.toFixed(1)}m adjustment`
          );
        }
      }
    }

    // Phase 2: Validate position (rejects bad points)
    if (this.USE_POSITION_VALIDATION) {
      // Pass session start time for grace period during GPS warmup
      const isValid = filterLocation(
        processedPoint,
        this.lastPosition,
        this.startTime
      );
      if (!isValid) {
        // Point rejected by validation - don't process it
        return;
      }
    }

    // Update GPS signal tracking
    this.lastGPSUpdate = Date.now();
    this.currentAccuracy = processedPoint.accuracy;

    // 🔧 CRITICAL FIX: Calculate duration using GPS timestamps (not Date.now())
    // This prevents timer drift when JavaScript is suspended in background
    // Reference: runstr-github RunTracker.js line 221
    if (!this.isPaused) {
      this.duration = Math.floor(
        (processedPoint.timestamp - this.startTime - this.totalPausedTime) / 1000
      );
      // Duration will be read by getCurrentSession() for UI updates
    }

    // Platform-specific logging
    if (Platform.OS === 'android') {
      console.log(
        `[ANDROID] GPS ${
          this.USE_KALMAN_FILTER ? 'filtered' : 'raw'
        }: lat=${processedPoint.latitude.toFixed(6)}, ` +
          `lon=${processedPoint.longitude.toFixed(
            6
          )}, accuracy=${processedPoint.accuracy?.toFixed(1)}m`
      );
    }

    // Calculate distance if we have a previous position
    if (this.lastPosition) {
      const segmentDistance = this.calculateDistance(
        this.lastPosition,
        processedPoint
      );

      // Filter out micro-movements (GPS jitter) - note: validation already handles minimum distance
      if (segmentDistance >= this.MIN_MOVEMENT_THRESHOLD_METERS) {
        this.distance += segmentDistance;

        // Platform-specific logging
        if (Platform.OS === 'android') {
          console.log(
            `[ANDROID] Distance update: +${segmentDistance.toFixed(
              1
            )}m, total=${this.distance.toFixed(1)}m`
          );
        }

        // Check for split milestone
        this.checkForSplit();
      }
    }

    // Update elevation if available
    if (processedPoint.altitude !== undefined) {
      this.updateElevation(processedPoint.altitude);
    }

    // Store position
    this.positions.push(processedPoint);
    this.lastPosition = processedPoint;
  }

  /**
   * Calculate total distance from array of positions
   */
  private calculateTotalDistance(positions: LocationPoint[]): number {
    if (positions.length < 2) {
      return 0;
    }

    let totalDistance = 0;
    for (let i = 1; i < positions.length; i++) {
      totalDistance += this.calculateDistance(positions[i - 1], positions[i]);
    }

    return totalDistance;
  }

  /**
   * Immediately sync background data (for foreground transitions)
   * Returns true if data was synced, false if no data available
   *
   * This method extracts background distance and locations from AsyncStorage
   * and merges them into the current session. Use this when the app returns
   * to foreground to avoid stale data and 10-second polling delays.
   */
  async syncFromBackground(): Promise<boolean> {
    if (!this.isTracking) {
      return false;
    }

    let dataSynced = false;

    try {
      // CRITICAL: Get pre-calculated background distance
      // This is calculated in the background task when app is backgrounded
      const backgroundDistance = await getAndClearBackgroundDistance();

      if (backgroundDistance) {
        const distanceToAdd = backgroundDistance.totalDistance - this.distance;

        if (distanceToAdd > 0) {
          this.distance = backgroundDistance.totalDistance;
          console.log(
            `[SimpleLocationTrackingService] Synced background distance: +${distanceToAdd.toFixed(1)}m, ` +
            `total=${this.distance.toFixed(1)}m`
          );

          // Check for split milestones after distance update
          this.checkForSplit();
          dataSynced = true;
        }
      }

      // Get any unprocessed background locations
      const backgroundLocations = await getAndClearBackgroundLocations();

      if (backgroundLocations.length > 0) {
        console.log(
          `[SimpleLocationTrackingService] Processing ${backgroundLocations.length} background locations`
        );

        // Add to positions for route data
        this.positions.push(...backgroundLocations);
        dataSynced = true;
      }

      return dataSynced;
    } catch (error) {
      console.warn('[SimpleLocationTrackingService] Error syncing background data:', error);
      return false;
    }
  }

  /**
   * Start background sync polling to process locations in real-time
   * This ensures distance updates even when app is backgrounded
   * Now uses centralized syncFromBackground() method for consistency
   */
  private startBackgroundSyncPolling(): void {
    // Poll every 10 seconds to reduce battery drain and avoid Android termination
    const SYNC_INTERVAL_MS = 10000;

    this.backgroundSyncTimer = setInterval(async () => {
      if (this.isTracking && !this.isPaused) {
        await this.syncFromBackground();
      }
    }, SYNC_INTERVAL_MS);

    console.log('[SimpleLocationTrackingService] Background sync polling started');
  }

  /**
   * Stop background sync polling
   */
  private stopBackgroundSyncPolling(): void {
    if (this.backgroundSyncTimer) {
      clearInterval(this.backgroundSyncTimer);
      this.backgroundSyncTimer = null;
      console.log('[SimpleLocationTrackingService] Background sync polling stopped');
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   * (Same as reference implementation)
   */
  private calculateDistance(p1: LocationPoint, p2: LocationPoint): number {
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
   * Update elevation gain and loss
   */
  private updateElevation(altitude: number): void {
    if (this.lastAltitude !== null) {
      const diff = altitude - this.lastAltitude;

      // Filter out small fluctuations (less than 1 meter)
      if (diff > 1) {
        this.elevationGain += diff;
      } else if (diff < -1) {
        this.elevationLoss += Math.abs(diff);
      }
    }
    this.lastAltitude = altitude;
  }

  /**
   * Check if we've reached a split milestone (1 km)
   */
  private checkForSplit(): void {
    // Only track splits for running
    if (this.activityType !== 'running') {
      return;
    }

    // Check if we've completed another kilometer
    if (
      Math.floor(this.distance / this.SPLIT_DISTANCE_METERS) >
      Math.floor(this.lastSplitDistance / this.SPLIT_DISTANCE_METERS)
    ) {
      const splitNumber = Math.floor(
        this.distance / this.SPLIT_DISTANCE_METERS
      );
      const currentDuration = this.getElapsedTime(); // seconds

      // Calculate split pace (seconds per km)
      const previousSplitTime =
        this.splits.length > 0
          ? this.splits[this.splits.length - 1].duration
          : 0;
      const splitDuration = currentDuration - previousSplitTime;
      const splitPace = splitDuration; // seconds per km (since split is 1 km)

      const split: Split = {
        splitNumber,
        distance: this.distance,
        duration: currentDuration,
        pace: splitPace,
      };

      this.splits.push(split);
      this.lastSplitDistance = this.distance;

      console.log(
        `[SimpleLocationTrackingService] Split ${splitNumber}: ${splitPace.toFixed(
          0
        )}s/km`
      );
    }
  }

  /**
   * Pause tracking (stops distance accumulation but keeps GPS active)
   */
  async pauseTracking(): Promise<void> {
    if (!this.isTracking || this.isPaused) {
      console.warn(
        '[SimpleLocationTrackingService] Cannot pause - not tracking or already paused'
      );
      return;
    }

    this.isPaused = true;
    this.pauseStartTime = Date.now();
    this.pauseCount++; // Track number of pauses

    // Stop background sync polling during pause
    this.stopBackgroundSyncPolling();

    // Pause background tracking (iOS and Android)
    await pauseBackgroundTracking();

    console.log('[SimpleLocationTrackingService] Tracking paused');
  }

  /**
   * Resume tracking
   */
  async resumeTracking(): Promise<void> {
    if (!this.isTracking || !this.isPaused) {
      console.warn(
        '[SimpleLocationTrackingService] Cannot resume - not tracking or not paused'
      );
      return;
    }

    // Calculate pause duration
    const pauseDuration = Date.now() - this.pauseStartTime;
    this.totalPausedTime += pauseDuration;

    this.isPaused = false;
    this.pauseStartTime = 0;
    this.lastPosition = null; // Reset to avoid jumps after pause

    // Restart background sync polling
    this.startBackgroundSyncPolling();

    // Resume background tracking (iOS and Android)
    await resumeBackgroundTracking();

    console.log(
      `[SimpleLocationTrackingService] Tracking resumed (paused for ${(
        pauseDuration / 1000
      ).toFixed(0)}s)`
    );
  }

  /**
   * Stop tracking and return session data
   */
  async stopTracking(): Promise<TrackingSession | null> {
    if (!this.isTracking) {
      console.warn(
        '[SimpleLocationTrackingService] Not tracking, nothing to stop'
      );
      return null;
    }

    console.log('[SimpleLocationTrackingService] Stopping tracking...');

    // Stop location updates
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    // Stop background sync polling
    this.stopBackgroundSyncPolling();

    // Stop background task and merge locations (iOS and Android)
    await stopBackgroundLocationTracking();

    // CRITICAL: Get any final background distance calculation
    const finalBackgroundDistance = await getAndClearBackgroundDistance();
    if (finalBackgroundDistance) {
      // Use the background-calculated distance if it's greater
      if (finalBackgroundDistance.totalDistance > this.distance) {
        console.log(
          `[${Platform.OS.toUpperCase()}] Using background distance: ${
            (finalBackgroundDistance.totalDistance / 1000).toFixed(2)
          } km (was ${(this.distance / 1000).toFixed(2)} km)`
        );
        this.distance = finalBackgroundDistance.totalDistance;
      }
    }

    // Get and merge background locations (for position data)
    const backgroundLocations = await getAndClearBackgroundLocations();
    if (backgroundLocations.length > 0) {
      console.log(
        `[${Platform.OS.toUpperCase()}] Merging ${
          backgroundLocations.length
        } background locations for route data`
      );

      // Add background locations to session for route visualization
      this.positions.push(...backgroundLocations);

      // Only recalculate if we didn't get background distance
      if (!finalBackgroundDistance) {
        this.distance = this.calculateTotalDistance(this.positions);
      }
    }

    // Deactivate KeepAwake
    try {
      deactivateKeepAwake('activity-tracking');
      console.log('[SimpleLocationTrackingService] KeepAwake deactivated');
    } catch (error) {
      console.warn(
        '[SimpleLocationTrackingService] Failed to deactivate KeepAwake:',
        error
      );
    }

    // Calculate final metrics
    const endTime = Date.now();
    const totalDuration = Math.floor(
      (endTime - this.startTime - this.totalPausedTime) / 1000
    ); // seconds

    // Create session object
    const session: TrackingSession = {
      id: this.sessionId || `session_${Date.now()}`,
      activityType: this.activityType,
      startTime: this.startTime,
      endTime,
      distance: this.distance,
      duration: totalDuration,
      pausedDuration: Math.floor(this.totalPausedTime / 1000), // seconds
      elevationGain: this.elevationGain,
      elevationLoss: this.elevationLoss,
      pauseCount: this.pauseCount,
      splits: this.splits,
      positions: this.positions,
    };

    // Reset state
    this.isTracking = false;
    this.isPaused = false;
    this.sessionId = null;

    console.log(
      `[SimpleLocationTrackingService] ✅ Session completed: ` +
        `${this.distance.toFixed(0)}m in ${totalDuration}s (${
          this.positions.length
        } GPS points)`
    );

    return session;
  }

  /**
   * Get current session data (for live updates)
   * Now uses GPS-timestamp-based duration instead of Date.now()
   */
  getCurrentSession(): TrackingSession | null {
    if (!this.isTracking) {
      return null;
    }

    // Use GPS-timestamp-based duration (updated in handleLocationUpdate)
    // Falls back to calculation if no GPS updates yet
    const currentDuration = this.duration > 0 ? this.duration : this.getElapsedTime();

    return {
      id: this.sessionId || `session_${Date.now()}`,
      activityType: this.activityType,
      startTime: this.startTime,
      distance: this.distance,
      duration: currentDuration,
      pausedDuration: Math.floor(this.totalPausedTime / 1000),
      elevationGain: this.elevationGain,
      elevationLoss: this.elevationLoss,
      pauseCount: this.pauseCount,
      splits: this.splits,
      positions: this.positions,
    };
  }

  /**
   * Get elapsed time in seconds (excluding pauses)
   */
  private getElapsedTime(): number {
    if (!this.isTracking) {
      return 0;
    }

    const now = Date.now();
    const currentPauseDuration = this.isPaused ? now - this.pauseStartTime : 0;
    return Math.floor(
      (now - this.startTime - this.totalPausedTime - currentPauseDuration) /
        1000
    );
  }

  /**
   * Get GPS signal strength based on time since last update and accuracy
   */
  getGPSSignalStrength(): GPSSignalStrength {
    if (!this.isTracking) {
      return 'none';
    }

    // Check for GPS timeout
    const timeSinceUpdate = Date.now() - this.lastGPSUpdate;
    if (timeSinceUpdate > this.GPS_SIGNAL_TIMEOUT_MS) {
      return 'none';
    }

    // Check accuracy
    if (!this.currentAccuracy) {
      return 'searching';
    }

    if (this.currentAccuracy < 10) {
      return 'strong';
    } else if (this.currentAccuracy < 20) {
      return 'medium';
    } else if (this.currentAccuracy < 50) {
      return 'weak';
    } else {
      return 'weak';
    }
  }

  /**
   * Get current tracking state
   */
  getTrackingState(): 'idle' | 'tracking' | 'paused' {
    if (!this.isTracking) {
      return 'idle';
    }
    return this.isPaused ? 'paused' : 'tracking';
  }

  /**
   * Check if tracking can start (simple check, no complex state machine)
   */
  canStart(): boolean {
    return !this.isTracking;
  }

  /**
   * Check if tracking can be paused
   */
  canPause(): boolean {
    return this.isTracking && !this.isPaused;
  }

  /**
   * Check if tracking can be resumed
   */
  canResume(): boolean {
    return this.isTracking && this.isPaused;
  }

  /**
   * Check if tracking can be stopped
   */
  canStop(): boolean {
    return this.isTracking;
  }
}

// Export singleton instance
export const simpleLocationTrackingService =
  SimpleLocationTrackingService.getInstance();
