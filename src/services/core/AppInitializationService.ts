/**
 * AppInitializationService
 * Background data loading service - runs silently without blocking UI
 * Handles initial data prefetching for authenticated users
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NostrInitializationService } from '../nostr/NostrInitializationService';
import nostrPrefetchService from '../nostr/NostrPrefetchService';
import { getUserNostrIdentifiers } from '../../utils/nostr';

class AppInitializationService {
  private static instance: AppInitializationService | null = null;
  private isInitialized = false;
  private isInitializing = false;

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
    const MAX_INIT_TIME = 8000; // 8 second timeout

    const initializationPromise = (async () => {
      try {
        console.log('🚀 AppInit: Starting background data loading...');

        // Step 1: Connect to Nostr relays
        console.log('📡 AppInit: Connecting to Nostr relays...');
        const { GlobalNDKService } = await import('../nostr/GlobalNDKService');
        const initService = NostrInitializationService.getInstance();

        try {
          await initService.connectToRelays();
          await GlobalNDKService.getInstance();
          // Wait for minimum 2 relays (fast threshold)
          await GlobalNDKService.waitForMinimumConnection(2, 2000);
          console.log('✅ AppInit: Nostr connected');
        } catch (ndkError) {
          console.error('⚠️ AppInit: NDK connection failed, continuing offline');
          GlobalNDKService.startBackgroundRetry();
        }

        // Step 2: Load user profile
        console.log('👤 AppInit: Loading profile...');
        const identifiers = await getUserNostrIdentifiers();

        if (identifiers) {
          const { DirectNostrProfileService } = await import(
            '../user/directNostrProfileService'
          );
          await DirectNostrProfileService.getCurrentUserProfile().catch(() =>
            console.warn('Profile fetch failed, using cache')
          );
          console.log('✅ AppInit: Profile loaded');

          // Step 3: Prefetch all user data (teams, workouts, wallet, competitions)
          console.log('📦 AppInit: Prefetching all data...');
          await nostrPrefetchService.prefetchAllUserData((step, total, message) => {
            console.log(`📊 AppInit: ${message} (${step}/${total})`);
          });

          console.log('✅ AppInit: All data loaded!');
        }

        this.isInitialized = true;

        // Set completion flag
        await AsyncStorage.setItem('@runstr:app_init_completed', 'true');
      } catch (error) {
        console.error('❌ AppInit: Initialization error:', error);
        // Continue - app can work with cached/partial data
      } finally {
        this.isInitializing = false;
      }
    })();

    // Emergency timeout
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.warn('⚠️ AppInit: Timeout reached - partial data loaded');
        this.isInitializing = false;
        resolve();
      }, MAX_INIT_TIME);
    });

    await Promise.race([initializationPromise, timeoutPromise]);
  }

  /**
   * Check if initialization has completed
   */
  async hasCompleted(): Promise<boolean> {
    try {
      const completed = await AsyncStorage.getItem('@runstr:app_init_completed');
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
