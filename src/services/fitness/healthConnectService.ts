/**
 * Health Connect Service - Android Health Connect integration
 * Mirrors HealthKitService API for consistent cross-platform experience
 * Supports Android 14+ where Health Connect is built into the OS
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutData, WorkoutType } from '../../types/workout';

// Environment-based logging utility
const isDevelopment = __DEV__;
const debugLog = (message: string, ...args: any[]) => {
  if (isDevelopment) {
    console.log(message, ...args);
  }
};
const errorLog = (message: string, ...args: any[]) => {
  console.error(message, ...args);
};

// Import react-native-health-connect for Android only
let HealthConnect: any = null;

if (Platform.OS === 'android') {
  try {
    const healthConnectModule = require('react-native-health-connect');
    HealthConnect = healthConnectModule;
    debugLog('Health Connect module loaded successfully');
  } catch (e: any) {
    errorLog('Health Connect: Failed to import react-native-health-connect:', e.message);
    HealthConnect = null;
  }
}

// Health Connect exercise type mappings to RUNSTR workout types
// Reference: https://developer.android.com/reference/androidx/health/connect/client/records/ExerciseSessionRecord
const HC_EXERCISE_TYPE_MAP: Record<number, WorkoutType> = {
  8: 'running',           // EXERCISE_TYPE_RUNNING
  79: 'running',          // EXERCISE_TYPE_RUNNING_TREADMILL
  56: 'walking',          // EXERCISE_TYPE_WALKING
  9: 'cycling',           // EXERCISE_TYPE_BIKING
  10: 'cycling',          // EXERCISE_TYPE_BIKING_STATIONARY
  37: 'hiking',           // EXERCISE_TYPE_HIKING
  74: 'strength_training', // EXERCISE_TYPE_STRENGTH_TRAINING
  75: 'gym',              // EXERCISE_TYPE_STAIR_CLIMBING
  29: 'gym',              // EXERCISE_TYPE_ELLIPTICAL
  78: 'gym',              // EXERCISE_TYPE_ROWING_MACHINE
  17: 'other',            // EXERCISE_TYPE_DANCING
  82: 'other',            // EXERCISE_TYPE_YOGA
  57: 'other',            // EXERCISE_TYPE_WHEELCHAIR
  80: 'other',            // EXERCISE_TYPE_SWIMMING_POOL
  81: 'other',            // EXERCISE_TYPE_SWIMMING_OPEN_WATER
};

// Health Connect permissions to request
const HEALTH_CONNECT_PERMISSIONS = [
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
];

export interface HealthConnectWorkout {
  id: string;
  startTime: string;
  endTime: string;
  duration: number; // seconds
  totalDistance?: number; // meters
  totalEnergyBurned?: number; // calories
  exerciseType: number;
  sourceName: string;
  activityType?: WorkoutType;
  steps?: number;
  heartRate?: {
    avg: number;
    max: number;
  };
}

export interface HealthConnectSyncResult {
  success: boolean;
  workoutsCount?: number;
  newWorkouts?: number;
  skippedWorkouts?: number;
  error?: string;
}

export class HealthConnectService {
  private static instance: HealthConnectService;
  private isAuthorized = false;
  private syncInProgress = false;
  private lastSyncAt?: Date;
  private readonly DEFAULT_TIMEOUT = 60000; // 60 seconds
  private readonly PERMISSION_TIMEOUT = 30000; // 30 seconds for permissions
  private isModuleAvailable: boolean = false;
  private sdkAvailable: boolean | null = null;
  private clientInitialized: boolean = false;

  private constructor() {
    this.initializeModule();
    this.loadAuthorizationStatus();
  }

  /**
   * Load authorization status from AsyncStorage on app startup
   */
  private async loadAuthorizationStatus(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('@healthconnect:authorized');
      this.isAuthorized = stored === 'true';
      debugLog(`Health Connect: Loaded authorization status: ${this.isAuthorized}`);
    } catch (error) {
      debugLog('Health Connect: Failed to load authorization status:', error);
      this.isAuthorized = false;
    }
  }

  /**
   * Initialize Health Connect module with proper error handling
   */
  private async initializeModule() {
    if (Platform.OS !== 'android') {
      console.log('Health Connect not available on iOS');
      return;
    }

    try {
      const healthConnectModule = require('react-native-health-connect');
      HealthConnect = healthConnectModule;
      this.isModuleAvailable = true;
      debugLog('Health Connect module initialized successfully');
    } catch (error: any) {
      console.error('Failed to load Health Connect module:', error);
      this.isModuleAvailable = false;
      HealthConnect = null;
    }
  }

  static getInstance(): HealthConnectService {
    if (!HealthConnectService.instance) {
      HealthConnectService.instance = new HealthConnectService();
    }
    return HealthConnectService.instance;
  }

  /**
   * Check if Health Connect is available on this device
   */
  static isAvailable(): boolean {
    return Platform.OS === 'android' && HealthConnect !== null;
  }

  /**
   * Check if module is properly loaded
   */
  isAvailable(): boolean {
    return this.isModuleAvailable && HealthConnect !== null;
  }

  /**
   * Ensure the Health Connect client is initialized before any API calls
   * This is idempotent - safe to call multiple times
   */
  private async ensureClientInitialized(): Promise<boolean> {
    if (this.clientInitialized) {
      return true;
    }

    if (!this.isAvailable()) {
      return false;
    }

    try {
      const initialized = await HealthConnect.initialize();
      this.clientInitialized = true;
      debugLog('Health Connect: Client initialized:', initialized);
      return true;
    } catch (error) {
      errorLog('Health Connect: Failed to initialize client:', error);
      return false;
    }
  }

  /**
   * Check if Health Connect SDK is available (Android 14+ or Health Connect app installed)
   */
  async checkSdkAvailability(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    if (this.sdkAvailable !== null) {
      return this.sdkAvailable;
    }

    try {
      const status = await HealthConnect.getSdkStatus();
      // SDK_AVAILABLE = 3, SDK_UNAVAILABLE = 1, SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED = 2
      this.sdkAvailable = status === 3;
      debugLog(`Health Connect SDK status: ${status}, available: ${this.sdkAvailable}`);
      return this.sdkAvailable;
    } catch (error) {
      errorLog('Health Connect: Error checking SDK availability:', error);
      this.sdkAvailable = false;
      return false;
    }
  }

  /**
   * Initialize Health Connect and request permissions
   */
  async initialize(): Promise<{ success: boolean; error?: string }> {
    if (!HealthConnectService.isAvailable()) {
      return {
        success: false,
        error: 'Health Connect not available on this device',
      };
    }

    try {
      debugLog('Health Connect: initialize() starting...');

      // Check SDK availability first
      const sdkAvailable = await this.checkSdkAvailability();
      if (!sdkAvailable) {
        return {
          success: false,
          error: 'Health Connect is not available. Please update to Android 14 or install Health Connect from Play Store.',
        };
      }

      // Initialize the Health Connect client
      const clientReady = await this.ensureClientInitialized();
      if (!clientReady) {
        return {
          success: false,
          error: 'Failed to initialize Health Connect client',
        };
      }

      // Request permissions (don't call this.requestPermissions() to avoid circular dependency)
      const grantedPermissions = await HealthConnect.requestPermission(HEALTH_CONNECT_PERMISSIONS);
      debugLog('Health Connect: Granted permissions:', grantedPermissions);

      // Check if we got at least the essential permissions (ExerciseSession)
      const hasExercisePermission = grantedPermissions.some(
        (p: any) => p.recordType === 'ExerciseSession' && p.accessType === 'read'
      );

      if (!hasExercisePermission) {
        await this.saveAuthorizationStatus(false);
        return {
          success: false,
          error: 'Exercise permission not granted. Please allow access to workout data.',
        };
      }

      await this.saveAuthorizationStatus(true);
      debugLog('Health Connect: Initialization complete');

      return { success: true };
    } catch (error: any) {
      errorLog('Health Connect: Initialization failed:', error);
      return {
        success: false,
        error: `Initialization failed: ${error?.message || 'Unknown error'}`,
      };
    }
  }

  /**
   * Request Health Connect permissions
   */
  async requestPermissions(): Promise<{ success: boolean; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Health Connect not available' };
    }

    try {
      debugLog('Health Connect: Requesting permissions...');

      // Ensure client is initialized before requesting permissions
      const clientReady = await this.ensureClientInitialized();
      if (!clientReady) {
        return {
          success: false,
          error: 'Failed to initialize Health Connect client',
        };
      }

      const grantedPermissions = await HealthConnect.requestPermission(HEALTH_CONNECT_PERMISSIONS);

      debugLog('Health Connect: Granted permissions:', grantedPermissions);

      // Check if we got at least the essential permissions (ExerciseSession)
      const hasExercisePermission = grantedPermissions.some(
        (p: any) => p.recordType === 'ExerciseSession' && p.accessType === 'read'
      );

      if (!hasExercisePermission) {
        return {
          success: false,
          error: 'Exercise permission not granted. Please allow access to workout data.',
        };
      }

      this.isAuthorized = true;
      await AsyncStorage.setItem('@healthconnect:authorized', 'true');

      debugLog('Health Connect: Permissions granted successfully');
      return { success: true };
    } catch (error: any) {
      errorLog('Health Connect: Permission request failed:', error);
      return {
        success: false,
        error: `Permission request failed: ${error?.message || 'Unknown error'}`,
      };
    }
  }

  /**
   * Fetch recent workouts from Health Connect
   */
  async fetchRecentWorkouts(days: number = 30): Promise<HealthConnectWorkout[]> {
    if (!this.isAuthorized) {
      debugLog('Health Connect: Not authorized, attempting to initialize...');
      const initResult = await this.initialize();
      if (!initResult.success) {
        throw new Error(`Health Connect not authorized: ${initResult.error || 'Permission denied'}`);
      }
    }

    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;

    try {
      // Ensure client is initialized before reading records
      const clientReady = await this.ensureClientInitialized();
      if (!clientReady) {
        throw new Error('Failed to initialize Health Connect client');
      }

      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      debugLog(`Health Connect: Fetching workouts from ${startTime} to ${endTime}`);

      // Read exercise sessions
      const exerciseSessions = await HealthConnect.readRecords('ExerciseSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime,
          endTime,
        },
      });

      debugLog(`Health Connect: Fetched ${exerciseSessions?.records?.length || 0} exercise sessions`);

      const workouts: HealthConnectWorkout[] = [];

      for (const session of exerciseSessions?.records || []) {
        const workout = await this.transformExerciseSession(session);
        if (workout) {
          workouts.push(workout);
        }
      }

      // Cache the results
      await this.cacheWorkouts(workouts);

      debugLog(`Health Connect: Returning ${workouts.length} valid workouts`);
      return workouts;
    } catch (error: any) {
      errorLog('Health Connect: Error fetching workouts:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Transform Health Connect ExerciseSession to our workout format
   */
  private async transformExerciseSession(session: any): Promise<HealthConnectWorkout | null> {
    try {
      const startTime = new Date(session.startTime);
      const endTime = new Date(session.endTime);
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

      // Skip workouts shorter than 1 minute
      if (duration < 60) {
        return null;
      }

      const exerciseType = session.exerciseType || 0;
      const activityType = HC_EXERCISE_TYPE_MAP[exerciseType] || 'other';

      // Try to get associated metrics
      let totalDistance = 0;
      let totalCalories = 0;
      let steps = 0;
      let avgHeartRate = 0;
      let maxHeartRate = 0;

      // Fetch distance for this session
      try {
        const distanceRecords = await HealthConnect.readRecords('Distance', {
          timeRangeFilter: {
            operator: 'between',
            startTime: session.startTime,
            endTime: session.endTime,
          },
        });

        for (const record of distanceRecords?.records || []) {
          totalDistance += record.distance?.inMeters || 0;
        }
      } catch (e) {
        debugLog('Health Connect: Could not fetch distance:', e);
      }

      // Fetch calories for this session
      try {
        const caloriesRecords = await HealthConnect.readRecords('ActiveCaloriesBurned', {
          timeRangeFilter: {
            operator: 'between',
            startTime: session.startTime,
            endTime: session.endTime,
          },
        });

        for (const record of caloriesRecords?.records || []) {
          totalCalories += record.energy?.inKilocalories || 0;
        }
      } catch (e) {
        debugLog('Health Connect: Could not fetch calories:', e);
      }

      // Fetch steps for this session
      try {
        const stepsRecords = await HealthConnect.readRecords('Steps', {
          timeRangeFilter: {
            operator: 'between',
            startTime: session.startTime,
            endTime: session.endTime,
          },
        });

        for (const record of stepsRecords?.records || []) {
          steps += record.count || 0;
        }
      } catch (e) {
        debugLog('Health Connect: Could not fetch steps:', e);
      }

      // Fetch heart rate for this session
      try {
        const heartRateRecords = await HealthConnect.readRecords('HeartRate', {
          timeRangeFilter: {
            operator: 'between',
            startTime: session.startTime,
            endTime: session.endTime,
          },
        });

        const samples = heartRateRecords?.records || [];
        if (samples.length > 0) {
          const bpmValues = samples.flatMap((r: any) =>
            (r.samples || []).map((s: any) => s.beatsPerMinute || 0)
          ).filter((v: number) => v > 0);

          if (bpmValues.length > 0) {
            avgHeartRate = Math.round(bpmValues.reduce((a: number, b: number) => a + b, 0) / bpmValues.length);
            maxHeartRate = Math.max(...bpmValues);
          }
        }
      } catch (e) {
        debugLog('Health Connect: Could not fetch heart rate:', e);
      }

      return {
        id: `healthconnect_${session.metadata?.id || session.startTime}`,
        startTime: session.startTime,
        endTime: session.endTime,
        duration,
        totalDistance: Math.round(totalDistance),
        totalEnergyBurned: Math.round(totalCalories),
        exerciseType,
        sourceName: session.metadata?.dataOrigin?.packageName || 'Health Connect',
        activityType,
        steps: steps > 0 ? steps : undefined,
        heartRate: avgHeartRate > 0 ? { avg: avgHeartRate, max: maxHeartRate } : undefined,
      };
    } catch (error) {
      errorLog('Health Connect: Error transforming exercise session:', error);
      return null;
    }
  }

  /**
   * Get current service status
   */
  getStatus(): {
    available: boolean;
    authorized: boolean;
    syncInProgress: boolean;
    lastSyncAt?: string;
  } {
    return {
      available: HealthConnectService.isAvailable(),
      authorized: this.isAuthorized,
      syncInProgress: this.syncInProgress,
      lastSyncAt: this.lastSyncAt?.toISOString(),
    };
  }

  /**
   * Get current service status with real authorization check
   */
  async getStatusWithRealCheck(): Promise<{
    available: boolean;
    authorized: boolean;
    syncInProgress: boolean;
    lastSyncAt?: string;
    sdkAvailable: boolean;
  }> {
    const sdkAvailable = await this.checkSdkAvailability();

    // Check actual permission status
    let actuallyAuthorized = false;
    if (sdkAvailable && this.isAvailable()) {
      try {
        // Ensure client is initialized before checking permissions
        const clientReady = await this.ensureClientInitialized();
        if (clientReady) {
          const permissions = await HealthConnect.getGrantedPermissions();
          actuallyAuthorized = permissions.some(
            (p: any) => p.recordType === 'ExerciseSession' && p.accessType === 'read'
          );
        }
      } catch (e) {
        debugLog('Health Connect: Error checking permissions:', e);
      }
    }

    await this.saveAuthorizationStatus(actuallyAuthorized);

    return {
      available: HealthConnectService.isAvailable(),
      authorized: actuallyAuthorized,
      syncInProgress: this.syncInProgress,
      lastSyncAt: this.lastSyncAt?.toISOString(),
      sdkAvailable,
    };
  }

  /**
   * Save authorization status to both memory and persistent storage
   */
  private async saveAuthorizationStatus(authorized: boolean): Promise<void> {
    this.isAuthorized = authorized;

    try {
      await AsyncStorage.setItem('@healthconnect:authorized', authorized ? 'true' : 'false');
      debugLog(`Health Connect: Saved authorization status: ${authorized}`);
    } catch (error) {
      debugLog('Health Connect: Failed to save authorization status:', error);
    }
  }

  /**
   * Cache workouts to AsyncStorage
   */
  private async cacheWorkouts(workouts: HealthConnectWorkout[]): Promise<void> {
    try {
      const cacheKey = 'healthconnect_workouts_cache';
      const cacheData = {
        workouts,
        timestamp: Date.now(),
        version: '1.0',
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      this.lastSyncAt = new Date();
      debugLog(`Health Connect: Cached ${workouts.length} workouts`);
    } catch (error) {
      console.warn('Failed to cache Health Connect workouts:', error);
    }
  }

  /**
   * Get cached workouts from AsyncStorage
   */
  async getCachedWorkouts(): Promise<HealthConnectWorkout[] | null> {
    try {
      const cacheKey = 'healthconnect_workouts_cache';
      const cached = await AsyncStorage.getItem(cacheKey);

      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      const cacheAge = Date.now() - cacheData.timestamp;

      // Cache valid for 5 minutes
      if (cacheAge > 5 * 60 * 1000) {
        debugLog('Health Connect: Cache expired');
        return null;
      }

      debugLog(`Health Connect: Retrieved ${cacheData.workouts.length} cached workouts`);
      return cacheData.workouts;
    } catch (error) {
      console.warn('Failed to get cached Health Connect workouts:', error);
      return null;
    }
  }

  /**
   * Force re-authorization
   */
  async reauthorize(): Promise<{ success: boolean; error?: string }> {
    await this.saveAuthorizationStatus(false);
    return await this.initialize();
  }

  /**
   * Cancel ongoing sync operation
   */
  cancelSync(): void {
    if (this.syncInProgress) {
      this.syncInProgress = false;
      debugLog('Health Connect: Sync cancelled by user');
    }
  }

  /**
   * Get recent workouts for UI components (public method)
   */
  async getRecentWorkouts(userId: string, days: number = 30): Promise<any[]> {
    if (!HealthConnectService.isAvailable()) {
      debugLog('Health Connect: Not available, returning empty array');
      return [];
    }

    if (!this.isAuthorized) {
      debugLog('Health Connect: Not authorized - cannot fetch workouts without user permission');
      return [];
    }

    try {
      debugLog(`Health Connect: Fetching recent workouts (${days} days) for user ${userId}`);

      const healthConnectWorkouts = await this.fetchRecentWorkouts(days);

      // Transform to match expected UI format
      return healthConnectWorkouts.map((workout) => ({
        id: workout.id,
        type: workout.activityType || 'other',
        duration: workout.duration,
        distance: workout.totalDistance || 0,
        calories: workout.totalEnergyBurned || 0,
        startTime: workout.startTime,
        endTime: workout.endTime,
        source: 'health_connect',
        steps: workout.steps,
        heartRate: workout.heartRate,
        metadata: {
          sourceApp: workout.sourceName,
          originalExerciseType: workout.exerciseType,
          healthConnectId: workout.id,
          syncedVia: 'health_connect_service',
        },
      }));
    } catch (error) {
      errorLog('Health Connect: Error in getRecentWorkouts:', error);
      return [];
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(userId: string): Promise<{
    totalHealthConnectWorkouts: number;
    recentSyncs: number;
    lastSyncDate?: string;
  }> {
    try {
      const cached = await this.getCachedWorkouts();
      return {
        totalHealthConnectWorkouts: cached?.length || 0,
        recentSyncs: cached ? 1 : 0,
        lastSyncDate: this.lastSyncAt?.toISOString(),
      };
    } catch (error) {
      errorLog('Health Connect: Error getting sync stats:', error);
      return {
        totalHealthConnectWorkouts: 0,
        recentSyncs: 0,
      };
    }
  }

  // Cache for daily steps (separate from workout cache)
  private cachedDailySteps: { steps: number; startTime: Date; endTime: Date; lastUpdated: Date } | null = null;
  private readonly stepsCacheExpiry = 5 * 60 * 1000; // 5 minutes

  /**
   * Get today's total step count from Health Connect
   * Mirrors HealthKit behavior - queries from midnight to now
   */
  async getTodaySteps(): Promise<{ steps: number; startTime: Date; endTime: Date } | null> {
    if (!this.isAvailable()) {
      debugLog('Health Connect: Not available for step counting');
      return null;
    }

    // Check cache validity
    if (this.cachedDailySteps && this.isStepsCacheValid()) {
      debugLog(`Health Connect: Returning cached steps: ${this.cachedDailySteps.steps}`);
      return {
        steps: this.cachedDailySteps.steps,
        startTime: this.cachedDailySteps.startTime,
        endTime: this.cachedDailySteps.endTime,
      };
    }

    // Check authorization - if not authorized, try to initialize
    if (!this.isAuthorized) {
      debugLog('Health Connect: Not authorized for steps, attempting to initialize...');
      const initResult = await this.initialize();
      if (!initResult.success) {
        debugLog('Health Connect: Failed to authorize for steps:', initResult.error);
        return null;
      }
    }

    try {
      // Ensure client is initialized before reading records
      const clientReady = await this.ensureClientInitialized();
      if (!clientReady) {
        debugLog('Health Connect: Failed to initialize client for steps');
        return null;
      }

      // Calculate today's time range (midnight to now)
      const startTime = new Date();
      startTime.setHours(0, 0, 0, 0); // Midnight today
      const endTime = new Date(); // Now

      debugLog(`Health Connect: Querying steps from ${startTime.toISOString()} to ${endTime.toISOString()}`);

      // Query Steps records from Health Connect
      const stepsRecords = await HealthConnect.readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      });

      // Aggregate all step records
      let totalSteps = 0;
      for (const record of stepsRecords?.records || []) {
        totalSteps += record.count || 0;
      }

      debugLog(`Health Connect: ✅ Today's steps: ${totalSteps} (from ${stepsRecords?.records?.length || 0} records)`);

      // Update cache
      this.cachedDailySteps = {
        steps: totalSteps,
        startTime,
        endTime,
        lastUpdated: new Date(),
      };

      return {
        steps: totalSteps,
        startTime,
        endTime,
      };
    } catch (error) {
      errorLog('Health Connect: Error getting today steps:', error);
      return null;
    }
  }

  /**
   * Check if step cache is still valid (less than 5 minutes old)
   */
  private isStepsCacheValid(): boolean {
    if (!this.cachedDailySteps) return false;
    const age = Date.now() - this.cachedDailySteps.lastUpdated.getTime();
    return age < this.stepsCacheExpiry;
  }

  /**
   * Clear daily steps cache (forces fresh query on next call)
   */
  clearStepsCache(): void {
    this.cachedDailySteps = null;
    debugLog('Health Connect: Steps cache cleared');
  }

  /**
   * Check if Steps permission is granted
   */
  async hasStepsPermission(): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const sdkAvailable = await this.checkSdkAvailability();
      if (!sdkAvailable) return false;

      // Ensure client is initialized before checking permissions
      const clientReady = await this.ensureClientInitialized();
      if (!clientReady) return false;

      const permissions = await HealthConnect.getGrantedPermissions();
      return permissions.some(
        (p: any) => p.recordType === 'Steps' && p.accessType === 'read'
      );
    } catch (error) {
      debugLog('Health Connect: Error checking steps permission:', error);
      return false;
    }
  }

  /**
   * Open Health Connect settings/app
   */
  async openHealthConnectSettings(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Health Connect not available');
    }

    try {
      // Ensure client is initialized before opening settings
      await this.ensureClientInitialized();
      await HealthConnect.openHealthConnectSettings();
    } catch (error) {
      errorLog('Health Connect: Error opening settings:', error);
      throw error;
    }
  }
}

export default HealthConnectService.getInstance();
