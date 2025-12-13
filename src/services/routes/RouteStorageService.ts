/**
 * RouteStorageService - Simple label-based route storage
 * Routes are just names for grouping similar runs - no GPS data
 * Create a route by naming a past run, then tag future runs with that route
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutType } from '../../types/workout';

export interface RouteLabel {
  id: string;
  name: string; // "The Lake", "Park Loop", etc.
  activityType: WorkoutType;
  createdAt: string; // ISO timestamp
  lastUsed?: string; // ISO timestamp
  timesUsed: number;
  workoutIds: string[]; // IDs of workouts tagged with this route
  // Stats (calculated from workouts)
  bestTime?: number; // seconds
  bestPace?: number; // min/km
  bestWorkoutId?: string;
}

const STORAGE_KEYS = {
  ROUTES: 'route_labels',
  ROUTE_ID_COUNTER: 'route_label_id_counter',
};

export class RouteStorageService {
  private static instance: RouteStorageService;

  private constructor() {}

  static getInstance(): RouteStorageService {
    if (!RouteStorageService.instance) {
      RouteStorageService.instance = new RouteStorageService();
    }
    return RouteStorageService.instance;
  }

  /**
   * Generate unique route ID
   */
  private async generateRouteId(): Promise<string> {
    try {
      const counterStr = await AsyncStorage.getItem(
        STORAGE_KEYS.ROUTE_ID_COUNTER
      );
      const counter = counterStr ? parseInt(counterStr, 10) : 0;
      const newCounter = counter + 1;
      await AsyncStorage.setItem(
        STORAGE_KEYS.ROUTE_ID_COUNTER,
        newCounter.toString()
      );

      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      return `route_${timestamp}_${newCounter}_${random}`;
    } catch (error) {
      console.error('[RouteStorage] Failed to generate route ID:', error);
      return `route_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
  }

  /**
   * Create a new route from an existing workout
   */
  async createRoute(
    name: string,
    activityType: WorkoutType,
    firstWorkoutId: string,
    workoutDuration?: number,
    workoutPace?: number
  ): Promise<string> {
    try {
      const routeId = await this.generateRouteId();
      const now = new Date().toISOString();

      const route: RouteLabel = {
        id: routeId,
        name: name.trim(),
        activityType,
        createdAt: now,
        lastUsed: now,
        timesUsed: 1,
        workoutIds: [firstWorkoutId],
        bestTime: workoutDuration,
        bestPace: workoutPace,
        bestWorkoutId: firstWorkoutId,
      };

      const routes = await this.getAllRoutes();
      routes.push(route);
      await AsyncStorage.setItem(STORAGE_KEYS.ROUTES, JSON.stringify(routes));

      console.log(`[RouteStorage] Created route: "${name}" with workout ${firstWorkoutId}`);
      return routeId;
    } catch (error) {
      console.error('[RouteStorage] Failed to create route:', error);
      throw error;
    }
  }

  /**
   * Get all saved routes
   */
  async getAllRoutes(): Promise<RouteLabel[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ROUTES);
      if (!data) return [];

      const routes: RouteLabel[] = JSON.parse(data);

      // Sort by last used (most recent first)
      return routes.sort((a, b) => {
        const timeA = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
        const timeB = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
        return timeB - timeA;
      });
    } catch (error) {
      console.error('[RouteStorage] Failed to retrieve routes:', error);
      return [];
    }
  }

  /**
   * Get routes filtered by activity type
   */
  async getRoutesByActivity(activityType: WorkoutType): Promise<RouteLabel[]> {
    const allRoutes = await this.getAllRoutes();
    return allRoutes.filter((r) => r.activityType === activityType);
  }

  /**
   * Get a specific route by ID
   */
  async getRouteById(routeId: string): Promise<RouteLabel | null> {
    const routes = await this.getAllRoutes();
    return routes.find((r) => r.id === routeId) || null;
  }

  /**
   * Add a workout to a route and update stats
   */
  async addWorkoutToRoute(
    routeId: string,
    workoutId: string,
    workoutDuration?: number,
    workoutPace?: number
  ): Promise<void> {
    try {
      const routes = await this.getAllRoutes();
      const route = routes.find((r) => r.id === routeId);

      if (!route) {
        console.warn(`[RouteStorage] Route ${routeId} not found`);
        return;
      }

      // Add workout if not already in list
      if (!route.workoutIds.includes(workoutId)) {
        route.workoutIds.push(workoutId);
      }

      // Update usage stats
      route.lastUsed = new Date().toISOString();
      route.timesUsed = route.workoutIds.length;

      // Update best time if this workout was faster
      if (workoutDuration && (!route.bestTime || workoutDuration < route.bestTime)) {
        route.bestTime = workoutDuration;
        route.bestPace = workoutPace;
        route.bestWorkoutId = workoutId;
        console.log(`[RouteStorage] New PR on "${route.name}": ${workoutDuration}s`);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.ROUTES, JSON.stringify(routes));
      console.log(`[RouteStorage] Added workout to "${route.name}" (${route.timesUsed} runs)`);
    } catch (error) {
      console.error('[RouteStorage] Failed to add workout to route:', error);
      throw error;
    }
  }

  /**
   * Get all workout IDs for a route
   */
  async getWorkoutIdsForRoute(routeId: string): Promise<string[]> {
    const route = await this.getRouteById(routeId);
    return route?.workoutIds || [];
  }

  /**
   * Rename a route
   */
  async renameRoute(routeId: string, newName: string): Promise<void> {
    try {
      const routes = await this.getAllRoutes();
      const route = routes.find((r) => r.id === routeId);

      if (!route) {
        throw new Error(`Route ${routeId} not found`);
      }

      route.name = newName.trim();
      await AsyncStorage.setItem(STORAGE_KEYS.ROUTES, JSON.stringify(routes));
      console.log(`[RouteStorage] Renamed route to "${newName}"`);
    } catch (error) {
      console.error('[RouteStorage] Failed to rename route:', error);
      throw error;
    }
  }

  /**
   * Delete a route
   */
  async deleteRoute(routeId: string): Promise<void> {
    try {
      const routes = await this.getAllRoutes();
      const filteredRoutes = routes.filter((r) => r.id !== routeId);

      if (routes.length === filteredRoutes.length) {
        console.warn(`[RouteStorage] Route ${routeId} not found`);
        return;
      }

      await AsyncStorage.setItem(STORAGE_KEYS.ROUTES, JSON.stringify(filteredRoutes));
      console.log(`[RouteStorage] Deleted route ${routeId}`);
    } catch (error) {
      console.error('[RouteStorage] Failed to delete route:', error);
      throw error;
    }
  }

  /**
   * Clear all routes (for migration/reset)
   */
  async clearAllRoutes(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ROUTES);
      console.log('[RouteStorage] Cleared all routes');
    } catch (error) {
      console.error('[RouteStorage] Failed to clear routes:', error);
      throw error;
    }
  }

  /**
   * Format time for display (e.g., "24:30")
   */
  static formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format pace for display (e.g., "4:42/km")
   */
  static formatPace(paceMinPerKm: number): string {
    const mins = Math.floor(paceMinPerKm);
    const secs = Math.round((paceMinPerKm - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}/km`;
  }
}

export default RouteStorageService.getInstance();
