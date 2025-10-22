/**
 * RouteStorageService - Persistent storage for saved GPS routes
 * Allows users to save favorite workout routes and reuse them later
 * Integrates with RouteMatchingService for automatic course comparison
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutType } from '../../types/workout';

export interface GPSPoint {
  latitude: number;
  longitude: number;
  altitude?: number; // meters
  timestamp?: number; // Unix timestamp
}

export interface SavedRoute {
  id: string; // Unique identifier
  name: string; // User-defined route name
  description?: string;
  activityType: WorkoutType; // Primary activity type for this route

  // GPS track data
  coordinates: GPSPoint[];

  // Route metrics
  distance: number; // meters
  elevationGain: number; // meters
  averageGrade?: number; // percentage

  // Route metadata
  createdAt: string; // ISO timestamp
  lastUsed?: string; // ISO timestamp of last workout on this route
  timesUsed: number; // How many times this route has been used

  // Best performance on this route
  bestTime?: number; // seconds
  bestPace?: number; // minutes per km
  bestWorkoutId?: string; // Reference to best workout

  // Optional: Start/end location names (for display)
  startLocationName?: string;
  endLocationName?: string;

  // Optional: Route tags for categorization
  tags?: string[]; // e.g., ['hilly', 'scenic', 'urban', 'trail']
}

const STORAGE_KEYS = {
  SAVED_ROUTES: 'saved_routes',
  ROUTE_ID_COUNTER: 'route_id_counter',
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
      const counterStr = await AsyncStorage.getItem(STORAGE_KEYS.ROUTE_ID_COUNTER);
      const counter = counterStr ? parseInt(counterStr, 10) : 0;
      const newCounter = counter + 1;
      await AsyncStorage.setItem(STORAGE_KEYS.ROUTE_ID_COUNTER, newCounter.toString());

      // Format: route_[timestamp]_[counter]_[random]
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      return `route_${timestamp}_${newCounter}_${random}`;
    } catch (error) {
      console.error('❌ Failed to generate route ID:', error);
      // Fallback to simple timestamp-based ID
      return `route_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
  }

  /**
   * Save a new route from workout GPS data
   */
  async saveRoute(params: {
    name: string;
    description?: string;
    activityType: WorkoutType;
    coordinates: GPSPoint[];
    distance: number;
    elevationGain: number;
    averageGrade?: number;
    workoutId?: string; // Optional: Link to workout that created this route
    workoutTime?: number; // Optional: Workout duration for initial best time
    tags?: string[];
  }): Promise<string> {
    try {
      const routeId = await this.generateRouteId();
      const now = new Date().toISOString();

      // Calculate pace if workout time provided
      const pace = params.workoutTime && params.distance > 0
        ? (params.workoutTime / 60) / (params.distance / 1000)
        : undefined;

      const route: SavedRoute = {
        id: routeId,
        name: params.name,
        description: params.description,
        activityType: params.activityType,
        coordinates: params.coordinates,
        distance: params.distance,
        elevationGain: params.elevationGain,
        averageGrade: params.averageGrade,
        createdAt: now,
        lastUsed: now,
        timesUsed: 1,
        bestTime: params.workoutTime,
        bestPace: pace,
        bestWorkoutId: params.workoutId,
        tags: params.tags || [],
      };

      await this.addRoute(route);
      console.log(`✅ Saved route: ${route.name} (${(route.distance / 1000).toFixed(2)}km, ${route.coordinates.length} points)`);
      return routeId;
    } catch (error) {
      console.error('❌ Failed to save route:', error);
      throw error;
    }
  }

  /**
   * Internal method to add route to storage
   */
  private async addRoute(route: SavedRoute): Promise<void> {
    try {
      const routes = await this.getAllRoutes();
      routes.push(route);
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ROUTES, JSON.stringify(routes));
    } catch (error) {
      console.error('❌ Failed to add route to storage:', error);
      throw error;
    }
  }

  /**
   * Get all saved routes
   */
  async getAllRoutes(): Promise<SavedRoute[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_ROUTES);
      if (!data) return [];

      const routes: SavedRoute[] = JSON.parse(data);

      // Sort by last used (most recent first)
      return routes.sort((a, b) => {
        const timeA = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
        const timeB = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
        return timeB - timeA;
      });
    } catch (error) {
      console.error('❌ Failed to retrieve routes:', error);
      return [];
    }
  }

  /**
   * Get routes filtered by activity type
   */
  async getRoutesByActivity(activityType: WorkoutType): Promise<SavedRoute[]> {
    const allRoutes = await this.getAllRoutes();
    return allRoutes.filter(r => r.activityType === activityType);
  }

  /**
   * Get a specific route by ID
   */
  async getRouteById(routeId: string): Promise<SavedRoute | null> {
    const routes = await this.getAllRoutes();
    return routes.find(r => r.id === routeId) || null;
  }

  /**
   * Update route metadata after completing a workout on this route
   */
  async updateRouteStats(routeId: string, params: {
    workoutId: string;
    workoutTime: number;
    workoutPace: number;
  }): Promise<void> {
    try {
      const routes = await this.getAllRoutes();
      const route = routes.find(r => r.id === routeId);

      if (!route) {
        console.warn(`⚠️ Route ${routeId} not found`);
        return;
      }

      // Update usage stats
      route.lastUsed = new Date().toISOString();
      route.timesUsed = (route.timesUsed || 0) + 1;

      // Update best performance if this workout was faster
      if (!route.bestTime || params.workoutTime < route.bestTime) {
        route.bestTime = params.workoutTime;
        route.bestPace = params.workoutPace;
        route.bestWorkoutId = params.workoutId;
        console.log(`🏆 New best time on route "${route.name}": ${params.workoutTime}s`);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ROUTES, JSON.stringify(routes));
      console.log(`✅ Updated route stats for "${route.name}" (${route.timesUsed} times used)`);
    } catch (error) {
      console.error('❌ Failed to update route stats:', error);
      throw error;
    }
  }

  /**
   * Rename a route
   */
  async renameRoute(routeId: string, newName: string): Promise<void> {
    try {
      const routes = await this.getAllRoutes();
      const route = routes.find(r => r.id === routeId);

      if (!route) {
        throw new Error(`Route ${routeId} not found`);
      }

      route.name = newName;
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ROUTES, JSON.stringify(routes));
      console.log(`✅ Renamed route to "${newName}"`);
    } catch (error) {
      console.error('❌ Failed to rename route:', error);
      throw error;
    }
  }

  /**
   * Update route description and tags
   */
  async updateRouteMetadata(routeId: string, params: {
    description?: string;
    tags?: string[];
  }): Promise<void> {
    try {
      const routes = await this.getAllRoutes();
      const route = routes.find(r => r.id === routeId);

      if (!route) {
        throw new Error(`Route ${routeId} not found`);
      }

      if (params.description !== undefined) {
        route.description = params.description;
      }
      if (params.tags !== undefined) {
        route.tags = params.tags;
      }

      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ROUTES, JSON.stringify(routes));
      console.log(`✅ Updated route metadata for "${route.name}"`);
    } catch (error) {
      console.error('❌ Failed to update route metadata:', error);
      throw error;
    }
  }

  /**
   * Delete a route
   */
  async deleteRoute(routeId: string): Promise<void> {
    try {
      const routes = await this.getAllRoutes();
      const filteredRoutes = routes.filter(r => r.id !== routeId);

      if (routes.length === filteredRoutes.length) {
        console.warn(`⚠️ Route ${routeId} not found (nothing to delete)`);
        return;
      }

      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ROUTES, JSON.stringify(filteredRoutes));
      console.log(`✅ Deleted route ${routeId}`);
    } catch (error) {
      console.error('❌ Failed to delete route:', error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalRoutes: number;
    totalDistance: number; // meters
    mostUsedRoute: SavedRoute | null;
    totalStorageKB: number;
  }> {
    try {
      const routes = await this.getAllRoutes();

      const totalDistance = routes.reduce((sum, r) => sum + r.distance, 0);

      const mostUsedRoute = routes.length > 0
        ? routes.reduce((prev, curr) =>
            curr.timesUsed > prev.timesUsed ? curr : prev
          )
        : null;

      const data = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_ROUTES);
      const storageBytes = data ? new Blob([data]).size : 0;

      return {
        totalRoutes: routes.length,
        totalDistance,
        mostUsedRoute,
        totalStorageKB: Math.round(storageBytes / 1024),
      };
    } catch (error) {
      console.error('❌ Failed to get route stats:', error);
      return { totalRoutes: 0, totalDistance: 0, mostUsedRoute: null, totalStorageKB: 0 };
    }
  }

  /**
   * Clear all routes (use with caution)
   */
  async clearAllRoutes(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.SAVED_ROUTES);
      console.log('✅ Cleared all saved routes');
    } catch (error) {
      console.error('❌ Failed to clear routes:', error);
      throw error;
    }
  }
}

export default RouteStorageService.getInstance();
