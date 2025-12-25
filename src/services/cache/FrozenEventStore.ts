/**
 * FrozenEventStore - Permanent storage for ended event data
 *
 * Once an event ends, its participant list and final leaderboard
 * are frozen and stored permanently. This ensures:
 * - Ended events always show their final results
 * - No network calls needed for historical data
 * - Participants are never shown as "0" for past events
 *
 * Storage pattern:
 * - Individual events: @runstr:frozen:{eventId}
 * - Index of all frozen IDs: @runstr:frozen_event_ids
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SatlantisLeaderboardEntry } from '../../types/satlantis';

const STORAGE_PREFIX = '@runstr:frozen:';
const INDEX_KEY = '@runstr:frozen_event_ids';

/**
 * Frozen event data structure
 */
export interface FrozenEventData {
  /** Event identifier (d-tag) */
  eventId: string;

  /** Event pubkey (organizer) */
  eventPubkey: string;

  /** List of participant hex pubkeys */
  participants: string[];

  /** Final leaderboard entries */
  leaderboard: SatlantisLeaderboardEntry[];

  /** Unix timestamp when this data was frozen */
  frozenAt: number;

  /** Original event end time (unix timestamp) */
  eventEndTime: number;
}

/**
 * FrozenEventStore - Manages permanent storage for ended event data
 */
export class FrozenEventStore {
  // Memory cache for instant access (populated on init)
  private static memoryCache = new Map<string, FrozenEventData>();

  // Track if memory cache is initialized
  private static isInitialized = false;

  /**
   * Initialize the memory cache from AsyncStorage
   * Call this during app startup for instant access to frozen data
   */
  static async initializeMemoryCache(): Promise<void> {
    if (this.isInitialized) {
      console.log('[Perf] FrozenEventStore - Already initialized');
      return;
    }

    const startTime = Date.now();
    console.log('[Perf] FrozenEventStore.initializeMemoryCache() START');

    try {
      const frozenIds = await this.getFrozenEventIds();
      console.log(`[Perf] FrozenEventStore - Found ${frozenIds.length} frozen event IDs`);

      if (frozenIds.length === 0) {
        this.isInitialized = true;
        console.log(`[Perf] FrozenEventStore.initializeMemoryCache() COMPLETE in ${Date.now() - startTime}ms (empty)`);
        return;
      }

      // Load all frozen events into memory in parallel
      const loadPromises = frozenIds.map(async (eventId) => {
        const data = await this.getFromStorage(eventId);
        if (data) {
          this.memoryCache.set(eventId, data);
        }
      });

      await Promise.all(loadPromises);

      this.isInitialized = true;
      console.log(
        `[Perf] FrozenEventStore.initializeMemoryCache() ✅ COMPLETE in ${Date.now() - startTime}ms ` +
        `(${this.memoryCache.size} events loaded)`
      );
    } catch (error) {
      console.error('[Perf] FrozenEventStore initialization ERROR:', error);
      this.isInitialized = true; // Continue anyway
    }
  }

  /**
   * Check if an event is frozen (has permanent stored data)
   */
  static async isFrozen(eventId: string): Promise<boolean> {
    // Check memory first
    if (this.memoryCache.has(eventId)) {
      return true;
    }

    // Check storage
    const data = await this.getFromStorage(eventId);
    return data !== null;
  }

  /**
   * Get frozen data for an event (instant from memory/AsyncStorage)
   * Returns null if event is not frozen
   */
  static async get(eventId: string): Promise<FrozenEventData | null> {
    const startTime = Date.now();

    // Check memory cache first (instant)
    if (this.memoryCache.has(eventId)) {
      const data = this.memoryCache.get(eventId)!;
      console.log(`[Perf] FrozenEventStore.get() - MEMORY HIT in ${Date.now() - startTime}ms`);
      return data;
    }

    // Try loading from storage
    const data = await this.getFromStorage(eventId);
    if (data) {
      // Promote to memory cache
      this.memoryCache.set(eventId, data);
      console.log(`[Perf] FrozenEventStore.get() - STORAGE HIT in ${Date.now() - startTime}ms (promoted to memory)`);
    } else {
      console.log(`[Perf] FrozenEventStore.get() - MISS in ${Date.now() - startTime}ms`);
    }

    return data;
  }

  /**
   * Freeze event data permanently
   * Called when an event ends and we have its final state
   */
  static async freeze(
    eventId: string,
    eventPubkey: string,
    participants: string[],
    leaderboard: SatlantisLeaderboardEntry[],
    eventEndTime: number
  ): Promise<void> {
    const startTime = Date.now();

    // Don't re-freeze if already frozen
    if (this.memoryCache.has(eventId)) {
      console.log(`[Perf] FrozenEventStore.freeze() - Already frozen, skipping`);
      return;
    }

    const data: FrozenEventData = {
      eventId,
      eventPubkey,
      participants,
      leaderboard,
      frozenAt: Date.now(),
      eventEndTime,
    };

    try {
      // Store in AsyncStorage
      const key = `${STORAGE_PREFIX}${eventId}`;
      const storageStart = Date.now();
      await AsyncStorage.setItem(key, JSON.stringify(data));
      console.log(`[Perf] FrozenEventStore - AsyncStorage write: ${Date.now() - storageStart}ms`);

      // Add to index
      const indexStart = Date.now();
      await this.addToIndex(eventId);
      console.log(`[Perf] FrozenEventStore - Index update: ${Date.now() - indexStart}ms`);

      // Add to memory cache
      this.memoryCache.set(eventId, data);

      console.log(
        `[Perf] FrozenEventStore.freeze() ❄️ COMPLETE in ${Date.now() - startTime}ms ` +
        `(${participants.length} participants, ${leaderboard.length} entries)`
      );
    } catch (error) {
      console.error('[Perf] FrozenEventStore.freeze() ERROR:', error);
    }
  }

  /**
   * Check if an event should be frozen (past end time)
   * @param endTime - Event end time as unix timestamp (seconds)
   */
  static shouldFreeze(endTime: number): boolean {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return endTime < nowSeconds;
  }

  /**
   * Get all frozen event IDs
   */
  static async getFrozenEventIds(): Promise<string[]> {
    try {
      const stored = await AsyncStorage.getItem(INDEX_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error('[FrozenEventStore] Error reading index:', error);
      return [];
    }
  }

  /**
   * Get count of frozen events (for debugging/stats)
   */
  static getMemoryCacheSize(): number {
    return this.memoryCache.size;
  }

  /**
   * Clear all frozen data (for debugging only)
   */
  static async clearAll(): Promise<void> {
    const frozenIds = await this.getFrozenEventIds();

    for (const eventId of frozenIds) {
      const key = `${STORAGE_PREFIX}${eventId}`;
      await AsyncStorage.removeItem(key);
    }

    await AsyncStorage.removeItem(INDEX_KEY);
    this.memoryCache.clear();
    this.isInitialized = false;

    console.log('[FrozenEventStore] Cleared all frozen event data');
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  /**
   * Read frozen data from AsyncStorage
   */
  private static async getFromStorage(eventId: string): Promise<FrozenEventData | null> {
    try {
      const key = `${STORAGE_PREFIX}${eventId}`;
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      console.error('[FrozenEventStore] Error reading from storage:', error);
      return null;
    }
  }

  /**
   * Add event ID to the frozen index
   */
  private static async addToIndex(eventId: string): Promise<void> {
    try {
      const currentIds = await this.getFrozenEventIds();

      // Avoid duplicates
      if (currentIds.includes(eventId)) {
        return;
      }

      currentIds.push(eventId);
      await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(currentIds));
    } catch (error) {
      console.error('[FrozenEventStore] Error updating index:', error);
    }
  }
}
