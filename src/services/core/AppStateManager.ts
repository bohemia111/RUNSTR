/**
 * AppStateManager - Central control for app state management
 *
 * CRITICAL: This is the SINGLE source of truth for app backgrounding on Android.
 * Android kills WebSockets immediately when app backgrounds, so we must block
 * ALL network operations instantly to prevent crashes.
 *
 * This replaces multiple conflicting AppState listeners that were causing
 * race conditions and crashes in v0.6.2-v0.6.5.
 */

import { AppState, AppStateStatus, Platform } from 'react-native';

export type AppStateCallback = (isActive: boolean) => void;

class AppStateManagerClass {
  private static instance: AppStateManagerClass;
  private isAppActive: boolean = true;
  private currentAppState: AppStateStatus = 'active';
  private callbacks: Set<AppStateCallback> = new Set();
  private appStateSubscription: any = null;
  private operationQueue: Array<() => void> = [];
  private initialized: boolean = false;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): AppStateManagerClass {
    if (!AppStateManagerClass.instance) {
      AppStateManagerClass.instance = new AppStateManagerClass();
    }
    return AppStateManagerClass.instance;
  }

  /**
   * Initialize the AppState manager - call this ONCE in App.tsx
   */
  initialize(): void {
    if (this.initialized) {
      console.warn('⚠️ AppStateManager already initialized, skipping...');
      return;
    }

    console.log('🎯 Initializing AppStateManager - Single source of truth for app state');

    this.currentAppState = AppState.currentState;
    this.isAppActive = this.currentAppState === 'active';

    // Set up the ONLY AppState listener in the entire app
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );

    this.initialized = true;
    console.log('✅ AppStateManager initialized');
  }

  /**
   * Handle app state changes - CRITICAL for Android crash prevention
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    const previousState = this.currentAppState;
    console.log(`📱 AppState changing: ${previousState} → ${nextAppState}`);

    // Update state immediately
    this.currentAppState = nextAppState;

    // Going to background
    if (previousState === 'active' && nextAppState.match(/inactive|background/)) {
      console.log('🔴 App going to background - BLOCKING all network operations');

      // CRITICAL: Set flag IMMEDIATELY on Android to prevent any operations
      if (Platform.OS === 'android') {
        this.isAppActive = false; // Instant block
      } else {
        // iOS gets a small grace period
        setTimeout(() => {
          this.isAppActive = false;
        }, 100);
      }

      // Notify all registered callbacks
      this.notifyCallbacks(false);
    }
    // Coming to foreground
    else if (previousState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('🟢 App returning to foreground - Resuming operations');

      // Delay resume slightly to ensure app is fully ready
      setTimeout(() => {
        this.isAppActive = true;
        this.notifyCallbacks(true);
        this.processQueuedOperations();
      }, 500);
    }
  }

  /**
   * Check if network operations are allowed
   * THIS IS THE CRITICAL CHECK that prevents crashes
   */
  canDoNetworkOps(): boolean {
    // On Android, be extremely strict - no operations when backgrounded
    if (Platform.OS === 'android' && !this.isAppActive) {
      return false;
    }
    return this.isAppActive;
  }

  /**
   * Check if app is currently active
   */
  isActive(): boolean {
    return this.isAppActive;
  }

  /**
   * Get current app state
   */
  getAppState(): AppStateStatus {
    return this.currentAppState;
  }

  /**
   * Register a callback for app state changes
   * Returns an unsubscribe function
   */
  onStateChange(callback: AppStateCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Queue an operation to run when app returns to foreground
   */
  queueForResume(operation: () => void): void {
    if (!this.isAppActive) {
      console.log('📋 Queueing operation for resume');
      this.operationQueue.push(operation);
    } else {
      // If app is active, run immediately
      operation();
    }
  }

  /**
   * Process queued operations after resume
   */
  private processQueuedOperations(): void {
    if (this.operationQueue.length > 0) {
      console.log(`🔄 Processing ${this.operationQueue.length} queued operations`);
      const operations = [...this.operationQueue];
      this.operationQueue = [];

      operations.forEach((op) => {
        try {
          op();
        } catch (error) {
          console.error('❌ Error processing queued operation:', error);
        }
      });
    }
  }

  /**
   * Notify all registered callbacks of state change
   */
  private notifyCallbacks(isActive: boolean): void {
    this.callbacks.forEach((callback) => {
      try {
        callback(isActive);
      } catch (error) {
        console.error('❌ Error in AppState callback:', error);
      }
    });
  }

  /**
   * Clean up (call on app unmount if needed)
   */
  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.callbacks.clear();
    this.operationQueue = [];
    this.initialized = false;
  }

  /**
   * Debug method to log current state
   */
  debugState(): void {
    console.log('📊 AppStateManager Debug:', {
      isActive: this.isAppActive,
      currentState: this.currentAppState,
      platform: Platform.OS,
      callbackCount: this.callbacks.size,
      queuedOps: this.operationQueue.length,
      initialized: this.initialized,
    });
  }
}

// Export singleton instance
export const AppStateManager = AppStateManagerClass.getInstance();

// Export convenience functions for easy use
export const canDoNetworkOps = (): boolean => AppStateManager.canDoNetworkOps();
export const isAppActive = (): boolean => AppStateManager.isActive();
export const queueForResume = (op: () => void): void => AppStateManager.queueForResume(op);