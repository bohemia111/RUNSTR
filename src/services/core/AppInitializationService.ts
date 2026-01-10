/**
 * AppInitializationService
 * Background data loading service - runs silently without blocking UI
 * Handles initial data prefetching for authenticated users
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NostrInitializationService } from '../nostr/NostrInitializationService';
import nostrPrefetchService from '../nostr/NostrPrefetchService';
import { getUserNostrIdentifiers } from '../../utils/nostr';
import { LeaderboardBaselineService } from '../season/LeaderboardBaselineService';

class AppInitializationService {
  private static instance: AppInitializationService | null = null;
  private isInitialized = false;
  private isInitializing = false;
  private abortController: AbortController | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private hasCompleted = false;

  private constructor() {}

  static getInstance(): AppInitializationService {
    if (!AppInitializationService.instance) {
      AppInitializationService.instance = new AppInitializationService();
    }
    return AppInitializationService.instance;
  }

  /**
   * Initialize app data in background
   * Non-blocking - app can show UI while this runs
   */
  async initializeInBackground(): Promise<void> {
    // Prevent duplicate initializations
    if (this.isInitialized || this.isInitializing) {
      console.log('⏭️ AppInit: Already initialized or in progress, skipping');
      return;
    }

    this.isInitializing = true;
    this.hasCompleted = false; // Reset completion flag
    const MAX_INIT_TIME = 12000; // 12 second timeout (increased for first launch)

    // Create AbortController for proper cancellation
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const initializationPromise = (async () => {
      try {
        // ❌ REMOVED: InteractionManager.runAfterInteractions was causing DEADLOCK
        // The modal animation never signals completion, causing permanent freeze
        // The 5-second setTimeout in App.tsx is already sufficient delay
        console.log('🚀 AppInit: Starting background data loading...');

        // Step 1: Connect to Nostr relays
        console.log('📡 AppInit: Connecting to Nostr relays...');

        // Check if aborted before expensive operations
        if (signal.aborted) {
          console.log('⚠️ AppInit: Aborted before relay connection');
          return;
        }

        const { GlobalNDKService } = await import('../nostr/GlobalNDKService');
        const initService = NostrInitializationService.getInstance();

        try {
          await initService.connectToRelays();
          await GlobalNDKService.getInstance();
          // Wait for minimum 2 relays (fast threshold)
          await GlobalNDKService.waitForMinimumConnection(2, 2000);
          console.log('✅ AppInit: Nostr connected');

          // Prefetch leaderboard baseline (1 event, cached for all screens)
          console.log('📊 AppInit: Prefetching leaderboard baseline...');
          LeaderboardBaselineService.fetchBaseline().then((baseline) => {
            if (baseline) {
              console.log('✅ AppInit: Leaderboard baseline cached');
            } else {
              console.log('⚠️ AppInit: No baseline note found');
            }
          }).catch((err) => {
            console.warn('⚠️ AppInit: Baseline prefetch failed:', err);
          });
        } catch (ndkError) {
          console.error(
            '⚠️ AppInit: NDK connection failed, continuing offline'
          );
          GlobalNDKService.startBackgroundRetry();
        }

        // Step 2: Load user profile
        console.log('👤 AppInit: Loading profile...');

        // Check if aborted before profile operations
        if (signal.aborted) {
          console.log('⚠️ AppInit: Aborted before profile load');
          return;
        }

        const identifiers = await getUserNostrIdentifiers();

        if (identifiers) {
          const { DirectNostrProfileService } = await import(
            '../user/directNostrProfileService'
          );
          await DirectNostrProfileService.getCurrentUserProfile().catch(() =>
            console.warn('Profile fetch failed, using cache')
          );
          console.log('✅ AppInit: Profile loaded');

          // Check if aborted before prefetch
          if (signal.aborted) {
            console.log('⚠️ AppInit: Aborted before data prefetch');
            return;
          }

          // Step 3: Prefetch all user data (teams, workouts, wallet, competitions)
          console.log('📦 AppInit: Prefetching all data...');
          await nostrPrefetchService.prefetchAllUserData(
            (step, total, message) => {
              console.log(`📊 AppInit: ${message} (${step}/${total})`);
            }
          );

          // NOTE: Satlantis events are now hardcoded - no Nostr fetch needed
          // Removed: SatlantisEventService.prefetchEventsForOfflineAccess()

          console.log('✅ AppInit: All data loaded!');
        }

        // CRITICAL FIX: Only set flags if not aborted and not already completed
        if (!signal.aborted && !this.hasCompleted) {
          this.hasCompleted = true; // Mark as completed to prevent timeout from running
          this.isInitialized = true;

          // Cancel the timeout since we succeeded
          if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
            console.log(
              '✅ AppInit: Timeout cancelled - initialization succeeded'
            );
          }

          // Set completion flag ONLY if we weren't aborted
          try {
            await AsyncStorage.setItem('@runstr:app_init_completed', 'true');
          } catch (error) {
            console.warn('⚠️ AppInit: Failed to save completion flag:', error);
          }
        }
      } catch (error) {
        console.error('❌ AppInit: Initialization error:', error);
        // Continue - app can work with cached/partial data
      } finally {
        this.isInitializing = false;
      }
    })();

    // Emergency timeout with proper cleanup
    const timeoutPromise = new Promise<void>((resolve) => {
      this.timeoutId = setTimeout(() => {
        // Only execute timeout if initialization hasn't completed
        if (!this.hasCompleted) {
          console.warn('⚠️ AppInit: Timeout reached - partial data loaded');
          this.hasCompleted = true; // Prevent success path from running

          // CRITICAL: Abort the initialization to prevent orphaned promises
          if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
          }

          // Clean up state
          this.isInitializing = false;
          this.isInitialized = false;
          this.timeoutId = null;
        } else {
          console.log(
            '✅ AppInit: Timeout skipped - initialization already completed'
          );
        }

        resolve();
      }, MAX_INIT_TIME);
    });

    // Race between initialization and timeout
    await Promise.race([initializationPromise, timeoutPromise]);

    // Final cleanup
    this.abortController = null;
  }

  /**
   * Check if initialization has completed
   */
  async hasCompleted(): Promise<boolean> {
    try {
      const completed = await AsyncStorage.getItem(
        '@runstr:app_init_completed'
      );
      return completed === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Reset initialization state (for testing)
   */
  async reset(): Promise<void> {
    this.isInitialized = false;
    this.isInitializing = false;
    await AsyncStorage.removeItem('@runstr:app_init_completed');
  }
}

export default AppInitializationService.getInstance();
