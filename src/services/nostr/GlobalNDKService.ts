/**
 * GlobalNDKService - Centralized NDK instance management
 *
 * CRITICAL OPTIMIZATION: Ensures only ONE NDK instance exists across the entire app,
 * preventing duplicate relay connections and reducing WebSocket overhead by ~90%.
 *
 * Before: 9 services × 4 relays = 36 WebSocket connections
 * After: 1 NDK instance × 4 relays = 4 WebSocket connections
 *
 * Usage:
 * ```typescript
 * const ndk = await GlobalNDKService.getInstance();
 * const events = await ndk.fetchEvents(filter);
 * ```
 */

import NDK, { NDKNip07Signer } from '@nostr-dev-kit/ndk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppStateManager } from '../core/AppStateManager';
import { NostrFetchLogger } from '../../utils/NostrFetchLogger';

export class GlobalNDKService {
  private static instance: NDK | null = null;
  private static initPromise: Promise<void> | null = null;
  private static isInitialized = false;
  private static lastReconnectAttempt: number = 0;
  private static keepaliveTimer: NodeJS.Timeout | null = null;
  private static isMonitoringConnections = false;
  private static appStateListenerSetup = false;

  // ✅ NEW: Track keepalive iterations to prevent 30-minute crash
  private static keepaliveIterations = 0;
  private static readonly MAX_KEEPALIVE_ITERATIONS = 120; // 60 minutes max (120 * 30s)

  // ✅ NEW: Track total reconnection attempts to prevent infinite loops
  private static totalReconnectionAttempts = 0;
  private static readonly MAX_TOTAL_RECONNECTIONS = 50;

  // ✅ NEW: Store relay listeners for proper cleanup
  private static relayListeners = new Map<
    any,
    {
      connect: () => void;
      disconnect: () => void;
      notice: (notice: string) => void;
    }
  >();

  // ✅ NEW: Relay pause flag to prevent auto-reconnect during pause window
  // Used by UnifiedWorkoutCache to temporarily stop WebSocket activity
  // and allow React's macrotask queue to unblock
  private static isRelayPauseActive: boolean = false;

  /**
   * Default relay configuration
   * These are fast, reliable relays used across the app
   *
   * PERFORMANCE NOTE: Reduced to 2 relays to minimize native WebSocket bridge traffic
   * - 3+ relays cause nw_protocol_socket_set_no_wake_from_sleep floods that block React's macrotask queue
   * - relay.damus.io and nos.lol are the most reliable
   */
  private static readonly DEFAULT_RELAYS = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    // 'wss://relay.primal.net', // Removed: Testing with fewer relays
    // 'wss://relay.nostr.band', // Removed: SSL failures (-9807) block React for 40+ seconds
  ];

  /**
   * Get or create the global NDK instance
   *
   * ✅ ANDROID FIX: Now non-blocking - returns immediately with degraded instance
   * Connection happens in background without blocking app startup
   */
  static async getInstance(): Promise<NDK> {
    NostrFetchLogger.start('GlobalNDK.getInstance');

    // If instance exists, check connection status
    if (this.instance) {
      const status = this.getStatus();
      NostrFetchLogger.cacheHit('GlobalNDK.getInstance', `${status.connectedRelays}/${status.relayCount} relays`);
      console.log(
        `♻️ GlobalNDK: Reusing cached instance (${status.connectedRelays}/${status.relayCount} relays connected)`
      );

      // ✅ FIX: Don't reconnect if app is backgrounded (prevents Android crash)
      // If below target threshold (2 relays), trigger background reconnection
      if (
        status.connectedRelays < 2 &&
        !this.initPromise &&
        AppStateManager.canDoNetworkOps()
      ) {
        console.log(
          `🔄 GlobalNDK: Only ${status.connectedRelays}/3 relays connected, scheduling background reconnection...`
        );
        // ✅ PERFORMANCE FIX: Defer reconnection to avoid blocking caller
        setTimeout(() => {
          this.initPromise = this.connectInBackground();
        }, 0);
      }

      NostrFetchLogger.end('GlobalNDK.getInstance', undefined, 'cached');
      return this.instance;
    }

    // Create degraded instance immediately (non-blocking)
    NostrFetchLogger.cacheMiss('GlobalNDK.getInstance');
    console.log('🚀 GlobalNDK: Creating instant degraded instance...');

    const degradedNDK = new NDK({
      explicitRelayUrls: this.DEFAULT_RELAYS,
      autoConnectUserRelays: false,
      autoFetchUserMutelist: false,
    });

    this.instance = degradedNDK;
    this.isInitialized = true;

    // ✅ PERFORMANCE FIX: Defer connection to next event loop tick (non-blocking)
    // This ensures getInstance() returns immediately without blocking UI
    if (!this.initPromise) {
      setTimeout(() => {
        console.log('🔄 GlobalNDK: Starting deferred background connection...');
        this.initPromise = this.connectInBackground();
      }, 0);
    }

    // ⚠️ DISABLED: AppState listener for keepalive (v0.7.10)
    // Keepalive disabled to fix 30-minute crash - no longer need lifecycle management
    // if (!this.appStateListenerSetup) {
    //   AppStateManager.onStateChange((isActive) => {
    //     if (!isActive) {
    //       // App backgrounded - pause keepalive to prevent WebSocket access
    //       this.pauseKeepalive();
    //     } else if (this.instance && this.isInitialized) {
    //       // App foregrounded and NDK is ready - resume keepalive
    //       this.resumeKeepalive();
    //     }
    //   });
    //   this.appStateListenerSetup = true;
    //   console.log('📱 GlobalNDK: AppState listener setup for keepalive lifecycle');
    // }

    NostrFetchLogger.end('GlobalNDK.getInstance', undefined, 'new instance');
    return degradedNDK;
  }

  /**
   * ✅ ANDROID FIX: Background connection (non-blocking)
   * Attempts to connect to relays without blocking getInstance()
   */
  private static async connectInBackground(): Promise<void> {
    NostrFetchLogger.start('GlobalNDK.connectInBackground');
    console.log('🔄 GlobalNDK: Starting background connection to relays...');

    // ✅ FIX: Don't connect if app is backgrounded (prevents Android crash)
    if (!AppStateManager.canDoNetworkOps()) {
      console.log('🔴 App is backgrounded, skipping NDK connection');
      NostrFetchLogger.end('GlobalNDK.connectInBackground', 0, 'skipped - app backgrounded');
      return;
    }

    try {
      if (!this.instance) {
        console.warn('⚠️ No NDK instance to connect');
        NostrFetchLogger.end('GlobalNDK.connectInBackground', 0, 'no instance');
        return;
      }

      // Attempt connection with 10s timeout
      await this.instance.connect(10000);

      const stats = this.instance.pool?.stats();
      const connectedCount = stats?.connected || 0;

      if (connectedCount > 0) {
        console.log(
          `✅ GlobalNDK: Background connection successful - ${connectedCount} relays connected`
        );
        // ⚠️ DISABLED: Keepalive/monitoring causing 30-minute crash (v0.7.10)
        // Root cause: Timer + event listener accumulation over time
        // Solution: Let NDK handle reconnection natively
        // this.setupConnectionMonitoring();
        // this.startKeepalive();
        console.log(
          '✅ GlobalNDK: Relying on NDK native reconnection (keepalive disabled)'
        );
        NostrFetchLogger.end('GlobalNDK.connectInBackground', connectedCount, 'connected');
      } else {
        console.warn(
          '⚠️ GlobalNDK: Background connection failed - no relays connected'
        );
        NostrFetchLogger.end('GlobalNDK.connectInBackground', 0, 'failed - no relays');
        // Schedule retry
        setTimeout(() => this.retryConnection(3), 5000); // Retry after 5s
      }
    } catch (error) {
      console.warn('⚠️ GlobalNDK: Background connection error:', error);
      NostrFetchLogger.error('GlobalNDK.connectInBackground', error instanceof Error ? error : String(error));
      // Schedule retry
      setTimeout(() => this.retryConnection(3), 5000); // Retry after 5s
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * ✅ NEW: Setup connection event monitoring
   * Listens to relay connect/disconnect events to track connection state in real-time
   */
  private static setupConnectionMonitoring(): void {
    if (this.isMonitoringConnections || !this.instance) {
      return;
    }

    console.log('👁️ GlobalNDK: Setting up connection event monitoring...');
    this.isMonitoringConnections = true;

    // ✅ MEMORY LEAK FIX: Clear old listeners before adding new ones
    this.clearRelayListeners();

    // Listen to each relay's connection events
    for (const relay of this.instance.pool.relays.values()) {
      // ✅ MEMORY LEAK FIX: Remove any existing listeners first
      relay.removeAllListeners('connect');
      relay.removeAllListeners('disconnect');
      relay.removeAllListeners('notice');

      // Create listener functions
      const onConnect = () => {
        const status = this.getStatus();
        console.log(
          `✅ GlobalNDK: Relay connected - ${relay.url} (${status.connectedRelays}/${status.relayCount} total)`
        );
      };

      const onDisconnect = () => {
        const status = this.getStatus();
        console.log(
          `❌ GlobalNDK: Relay disconnected - ${relay.url} (${status.connectedRelays}/${status.relayCount} remaining)`
        );

        // Auto-reconnect if we drop below 2 relays (with debouncing)
        if (status.connectedRelays < 2) {
          this.debouncedReconnect();
        }
      };

      const onNotice = (notice: string) => {
        console.log(`⚠️ GlobalNDK: Relay notice from ${relay.url}: ${notice}`);
      };

      // Register listeners
      relay.on('connect', onConnect);
      relay.on('disconnect', onDisconnect);
      relay.on('notice', onNotice);

      // ✅ MEMORY LEAK FIX: Store listeners for cleanup
      this.relayListeners.set(relay, {
        connect: onConnect,
        disconnect: onDisconnect,
        notice: onNotice,
      });
    }

    console.log('✅ GlobalNDK: Connection monitoring active');
  }

  /**
   * ✅ NEW: Start keepalive heartbeat to maintain connections
   * Prevents WebSocket timeout by periodically checking connection health
   */
  private static startKeepalive(): void {
    // Clear any existing keepalive timer
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
    }

    // ✅ 30-MINUTE CRASH FIX: Reset iteration counter when starting fresh
    this.keepaliveIterations = 0;

    console.log(
      '💓 GlobalNDK: Starting connection keepalive (30s interval, max 120 iterations)...'
    );

    this.keepaliveTimer = setInterval(() => {
      // CRITICAL FIX v0.6.8: Check if app is active before ANY WebSocket operations
      if (!AppStateManager.canDoNetworkOps()) {
        console.log(
          '🔴 GlobalNDK: App is backgrounded, skipping keepalive check'
        );
        return;
      }

      if (!this.instance) {
        return;
      }

      // ✅ 30-MINUTE CRASH FIX: Increment and check iteration counter
      this.keepaliveIterations++;

      if (this.keepaliveIterations >= this.MAX_KEEPALIVE_ITERATIONS) {
        console.warn(
          `⚠️ GlobalNDK: Keepalive reached max iterations (${this.keepaliveIterations}/${this.MAX_KEEPALIVE_ITERATIONS}) - restarting to prevent memory leaks`
        );
        this.restartKeepalive();
        return;
      }

      const status = this.getStatus();

      // Log keepalive heartbeat with iteration counter
      console.log(
        `💓 GlobalNDK: Keepalive check #${this.keepaliveIterations} - ${status.connectedRelays}/${status.relayCount} relays alive`
      );

      // If connections dropped significantly, trigger reconnection
      if (status.connectedRelays < 2) {
        console.warn(
          '⚠️ GlobalNDK: Keepalive detected connection loss - triggering reconnection'
        );
        this.debouncedReconnect();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * ✅ NEW: Pause keepalive timer when app backgrounds
   * Prevents timer from firing and accessing WebSockets while suspended
   */
  private static pauseKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
      console.log('⏸️ GlobalNDK: Keepalive paused (app backgrounded)');
    }
  }

  /**
   * ✅ NEW: Resume keepalive timer when app foregrounds
   * Restarts connection health monitoring when app is active
   */
  private static resumeKeepalive(): void {
    if (!this.keepaliveTimer && this.instance && this.isInitialized) {
      this.startKeepalive();
      console.log('▶️ GlobalNDK: Keepalive resumed (app foregrounded)');
    }
  }

  /**
   * ✅ NEW: Debounced reconnection to prevent rapid reconnection attempts
   * Only allows one reconnection attempt per 10 seconds
   */
  private static debouncedReconnect(): void {
    // CRITICAL FIX v0.6.8: Don't reconnect if app is backgrounded
    if (!AppStateManager.canDoNetworkOps()) {
      console.log(
        '🔴 GlobalNDK: App is backgrounded, skipping reconnection attempt'
      );
      return;
    }

    // ✅ NEW: Don't reconnect during relay pause (allows React scheduler to unblock)
    if (this.isRelayPauseActive) {
      console.log(
        '⏸️ GlobalNDK: Relay pause active, skipping reconnection attempt'
      );
      return;
    }

    // ✅ INFINITE LOOP FIX: Check total reconnection attempts
    if (this.totalReconnectionAttempts >= this.MAX_TOTAL_RECONNECTIONS) {
      console.error(
        `❌ GlobalNDK: Max reconnection attempts reached (${this.totalReconnectionAttempts}/${this.MAX_TOTAL_RECONNECTIONS}) - stopping to prevent infinite loops`
      );
      // Reset counter and pause reconnections for 5 minutes
      setTimeout(() => {
        console.log(
          '🔄 GlobalNDK: Reconnection cooldown complete, resetting counter'
        );
        this.totalReconnectionAttempts = 0;
      }, 300000); // 5 minute cooldown
      return;
    }

    const now = Date.now();
    const minInterval = 10000; // 10 seconds minimum between reconnections

    // Check if we're within the debounce window
    if (now - this.lastReconnectAttempt < minInterval) {
      console.log(
        '🔄 GlobalNDK: Reconnection request debounced (too soon since last attempt)'
      );
      return;
    }

    this.lastReconnectAttempt = now;
    this.totalReconnectionAttempts++;
    console.log(
      `🔄 GlobalNDK: Debounced reconnection triggered (attempt ${this.totalReconnectionAttempts}/${this.MAX_TOTAL_RECONNECTIONS})`
    );

    // Trigger background reconnection (non-blocking)
    if (!this.initPromise) {
      this.initPromise = this.connectInBackground();
    }
  }

  /**
   * ✅ MEMORY LEAK FIX: Clear all relay event listeners
   * Prevents listener accumulation when reconnecting
   */
  private static clearRelayListeners(): void {
    if (!this.instance) {
      return;
    }

    console.log('🧹 GlobalNDK: Clearing relay listeners...');

    // Remove listeners from relays
    for (const [relay, listeners] of this.relayListeners.entries()) {
      relay.removeListener('connect', listeners.connect);
      relay.removeListener('disconnect', listeners.disconnect);
      relay.removeListener('notice', listeners.notice);
    }

    // Clear the map
    this.relayListeners.clear();
    console.log('✅ GlobalNDK: Relay listeners cleared');
  }

  /**
   * ✅ 30-MINUTE CRASH FIX: Restart keepalive to prevent memory leaks
   * Called when keepalive reaches max iterations
   */
  private static restartKeepalive(): void {
    console.log(
      '🔄 GlobalNDK: Restarting keepalive after reaching max iterations...'
    );

    // Stop current keepalive
    this.pauseKeepalive();

    // Clean up listeners to prevent accumulation
    this.clearRelayListeners();

    // Re-setup connection monitoring with fresh listeners
    this.isMonitoringConnections = false;
    if (this.instance) {
      this.setupConnectionMonitoring();
    }

    // Restart keepalive with reset counter
    this.startKeepalive();

    console.log('✅ GlobalNDK: Keepalive restarted successfully');
  }

  /**
   * Initialize NDK with default configuration
   */
  private static async initializeNDK(): Promise<NDK> {
    try {
      // Always use default relays for consistent, fast performance
      // Ignoring stored user relays reduces connections from 9+ to 3
      const relayUrls = this.DEFAULT_RELAYS;

      console.log(`🔗 GlobalNDK: Connecting to ${relayUrls.length} relays...`);
      console.log(`   Relays: ${relayUrls.join(', ')}`);

      // Create NDK instance with optimized settings
      const ndk = new NDK({
        explicitRelayUrls: relayUrls,
        autoConnectUserRelays: false, // Disabled: prevents 5+ extra relay connections from Outbox Model
        autoFetchUserMutelist: false, // Don't auto-fetch mute lists (saves bandwidth)
        // Note: debug option removed - was causing "ndk.debug.extend is not a function" error
      });

      // ✅ FIX: Increased timeout from 2s → 10s
      // React Native WebSocket connections take longer than web
      console.log(
        '⏳ GlobalNDK: Attempting relay connections (10s timeout)...'
      );
      await ndk.connect(10000); // 10-second timeout

      // ✅ FIX: Validate connection status after connect()
      const stats = ndk.pool?.stats();
      const connectedCount = stats?.connected || 0;
      const totalRelays = ndk.pool?.relays?.size || 0;

      console.log('📊 GlobalNDK: Connection status:');
      console.log(`   📡 Connected relays: ${connectedCount}/${totalRelays}`);

      if (stats) {
        console.log(`   ✅ Connected: ${stats.connected || 0}`);
        console.log(`   ⏳ Connecting: ${stats.connecting || 0}`);
        console.log(`   ❌ Disconnected: ${stats.disconnected || 0}`);
      }

      // Verify at least one relay connected
      if (connectedCount === 0) {
        console.error('❌ GlobalNDK: No relays connected after timeout');
        throw new Error('Failed to connect to any Nostr relays');
      }

      console.log(
        `✅ GlobalNDK: Connected successfully to ${connectedCount} relay(s)`
      );
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(
        `🔌 TOTAL WEBSOCKET CONNECTIONS: ${connectedCount} (Target: 3)`
      );
      console.log(
        `📍 This is the ONLY NDK instance - all services share these ${connectedCount} connections`
      );
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Store in global for backward compatibility (some old code checks this)
      (global as any).preInitializedNDK = ndk;

      return ndk;
    } catch (error) {
      console.error('❌ GlobalNDK: Initialization failed:', error);
      console.error(
        '   Error details:',
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Force reconnect to all relays
   * Useful for recovering from network issues
   */
  static async reconnect(): Promise<void> {
    if (!this.instance) {
      console.warn('⚠️ GlobalNDK: No instance to reconnect');
      return;
    }

    console.log('🔄 GlobalNDK: Reconnecting to relays...');

    try {
      // Disconnect and reconnect
      for (const relay of this.instance.pool.relays.values()) {
        relay.disconnect();
      }

      await this.instance.connect(2000);

      // ✅ NEW: Re-setup monitoring and keepalive after reconnection
      const status = this.getStatus();
      if (status.connectedRelays > 0) {
        this.setupConnectionMonitoring();
        this.startKeepalive();
      }

      console.log('✅ GlobalNDK: Reconnected successfully');
    } catch (error) {
      console.error('❌ GlobalNDK: Reconnection failed:', error);
      throw error;
    }
  }

  /**
   * ✅ NEW: Temporarily pause relay connections to unblock iOS timer queue
   *
   * Used by UnifiedWorkoutCache after fetching workout data. iOS's native WebSocket
   * bridge blocks React's macrotask queue (setTimeout, requestAnimationFrame) for 40+ seconds
   * while connections are active. Pausing allows React to render.
   */
  static pauseRelays(): void {
    if (!this.instance) {
      console.warn('⚠️ GlobalNDK: No instance to pause');
      return;
    }

    this.isRelayPauseActive = true;
    console.log('⏸️ GlobalNDK: Pausing relays to unblock React scheduler...');

    // Disconnect all relays
    for (const relay of this.instance.pool.relays.values()) {
      try {
        relay.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    }

    console.log('⏸️ GlobalNDK: Relays paused');
  }

  /**
   * ✅ NEW: Resume relay connections after React has rendered
   */
  static resumeRelays(): void {
    this.isRelayPauseActive = false;
    console.log('▶️ GlobalNDK: Resuming relays...');

    // Reconnect in background (non-blocking)
    this.connectInBackground().catch(err => {
      console.warn('⚠️ GlobalNDK: Resume failed:', err);
    });
  }

  /**
   * ✅ NEW: Check if relay pause is active
   */
  static isPaused(): boolean {
    return this.isRelayPauseActive;
  }

  /**
   * Get connection status
   * ✅ UPDATED: Uses pool stats for accurate real-time connection count
   */
  static getStatus(): {
    isInitialized: boolean;
    relayCount: number;
    connectedRelays: number;
  } {
    if (!this.instance) {
      return {
        isInitialized: false,
        relayCount: 0,
        connectedRelays: 0,
      };
    }

    // Use pool stats for accurate connection count (faster than checking individual relays)
    const stats = this.instance.pool?.stats();
    const totalRelays = this.instance.pool?.relays?.size || 0;

    return {
      isInitialized: this.isInitialized,
      relayCount: totalRelays,
      connectedRelays: stats?.connected || 0,
    };
  }

  /**
   * Cleanup - disconnect from all relays
   * Should only be called when app is shutting down
   */
  static async cleanup(): Promise<void> {
    if (!this.instance) return;

    console.log('🔌 GlobalNDK: Disconnecting from all relays...');

    // ✅ NEW: Stop keepalive timer
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }

    // Disconnect all relays
    for (const relay of this.instance.pool.relays.values()) {
      relay.disconnect();
    }

    this.instance = null;
    this.isInitialized = false;
    this.initPromise = null;
    this.isMonitoringConnections = false;
    this.lastReconnectAttempt = 0;

    console.log('✅ GlobalNDK: Cleanup complete');
  }

  /**
   * Check if instance exists and is connected
   * ✅ UPDATED: Uses pool stats for accurate connection check
   */
  static isConnected(): boolean {
    if (!this.instance || !this.isInitialized) {
      return false;
    }

    // Use pool stats for accurate connection check (faster and more reliable)
    const stats = this.instance.pool?.stats();
    return (stats?.connected || 0) > 0;
  }

  /**
   * Wait for ALL relays to connect before proceeding
   *
   * CRITICAL: This prevents queries from running with partial relay connectivity,
   * which causes incomplete results and "missing data" issues.
   *
   * @param timeoutMs Maximum time to wait (default: 10 seconds)
   * @returns true if all relays connected, false if timeout occurred
   */
  static async waitForConnection(timeoutMs: number = 10000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 500; // Check every 500ms

    while (Date.now() - startTime < timeoutMs) {
      const status = this.getStatus();

      // Success: All relays are connected
      if (
        status.connectedRelays === status.relayCount &&
        status.relayCount > 0
      ) {
        console.log(
          `✅ GlobalNDK: All ${status.relayCount} relays connected, ready for queries`
        );
        return true;
      }

      // Still waiting
      console.log(
        `⏳ GlobalNDK: Waiting for relays... ${status.connectedRelays}/${status.relayCount} connected`
      );
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    // Timeout: Proceed with partial connectivity
    const finalStatus = this.getStatus();
    console.warn(
      `⚠️ GlobalNDK: Connection timeout after ${timeoutMs}ms - ` +
        `proceeding with ${finalStatus.connectedRelays}/${finalStatus.relayCount} relays connected`
    );
    return false;
  }

  /**
   * Wait for MINIMUM number of relays to connect before proceeding
   *
   * EVENT-DRIVEN: Uses relay connect events instead of polling.
   * Progressive connection strategy - faster UX while maintaining good data coverage.
   * Accepts partial connectivity (e.g., 2/4 relays) instead of waiting for all relays.
   *
   * @param minRelays Minimum number of relays required (default: 2 for 50% coverage)
   * @param timeoutMs Maximum time to wait (default: 3 seconds - reduced from 4s for faster startup)
   * @returns true if minimum relays connected, false if timeout occurred
   */
  static async waitForMinimumConnection(
    minRelays: number = 2,
    timeoutMs: number = 3000 // ✅ PERFORMANCE: Reduced from 4000ms to 3000ms
  ): Promise<boolean> {
    // FAST PATH: Check if already connected
    const status = this.getStatus();
    if (status.connectedRelays >= minRelays) {
      console.log(
        `✅ GlobalNDK: Already connected - ${status.connectedRelays}/${status.relayCount} relays ` +
          `(minimum: ${minRelays})`
      );
      return true;
    }

    // If no instance, can't wait for connection
    if (!this.instance?.pool) {
      console.warn('⚠️ GlobalNDK: No instance available for connection wait');
      return false;
    }

    // EVENT-DRIVEN: Wait for relay connect events instead of polling
    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const relays = Array.from(this.instance!.pool.relays.values());
      const connectHandlers: Array<() => void> = [];

      const checkAndResolve = () => {
        if (resolved) return;
        const currentStatus = this.getStatus();
        if (currentStatus.connectedRelays >= minRelays) {
          resolved = true;
          cleanup();
          console.log(
            `✅ GlobalNDK: ${currentStatus.connectedRelays}/${currentStatus.relayCount} relays connected ` +
              `(minimum: ${minRelays}) - ready for queries`
          );
          resolve(true);
        }
      };

      const cleanup = () => {
        // Remove all connect handlers
        relays.forEach((relay, index) => {
          if (connectHandlers[index]) {
            relay.off('connect', connectHandlers[index]);
          }
        });
      };

      // Listen for connect events on all relays
      relays.forEach((relay, index) => {
        const handler = () => checkAndResolve();
        connectHandlers[index] = handler;
        relay.on('connect', handler);
      });

      // Timeout handler - check final status
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        cleanup();

        const finalStatus = this.getStatus();
        const hasMinimum = finalStatus.connectedRelays >= minRelays;

        if (hasMinimum) {
          console.log(
            `✅ GlobalNDK: Minimum threshold met - ${finalStatus.connectedRelays}/${minRelays} relays`
          );
        } else {
          console.warn(
            `⚠️ GlobalNDK: Connection timeout after ${timeoutMs}ms - ` +
              `only ${finalStatus.connectedRelays}/${minRelays} minimum relays connected`
          );
          this.logConnectionDiagnostics();
        }

        resolve(hasMinimum);
      }, timeoutMs);

      // Check immediately in case status changed
      checkAndResolve();
    });
  }

  /**
   * Log detailed connection diagnostics for debugging
   * Shows per-relay connection status and overall health
   */
  static logConnectionDiagnostics(): void {
    const status = this.getStatus();
    const relays = Array.from(this.instance?.pool?.relays?.values() || []);

    console.log('━━━━━ NOSTR RELAY DIAGNOSTICS ━━━━━');
    console.log(`Total Relays: ${status.relayCount}`);
    console.log(`Connected: ${status.connectedRelays}`);
    console.log(
      `Connection Rate: ${Math.round(
        (status.connectedRelays / status.relayCount) * 100
      )}%`
    );
    console.log('');
    console.log('Per-Relay Status:');

    relays.forEach((relay) => {
      const connStatus = relay.connectivity.status; // 0=disconnected, 1=connected, 2=connecting
      const statusText =
        ['❌ DISCONNECTED', '✅ CONNECTED', '⏳ CONNECTING'][connStatus] ||
        '❓ UNKNOWN';
      console.log(`  ${relay.url}: ${statusText}`);
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * Retry connection with exponential backoff
   * Called automatically in background if initial connection fails
   */
  static async retryConnection(maxAttempts: number = 3): Promise<boolean> {
    if (this.isConnected()) {
      console.log('✅ GlobalNDK: Already connected, no retry needed');
      return true;
    }

    console.log(
      `🔄 GlobalNDK: Starting connection retry (max ${maxAttempts} attempts)...`
    );

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 1s, 2s, 4s, max 10s

      console.log(
        `🔄 GlobalNDK: Retry attempt ${attempt}/${maxAttempts} after ${backoffDelay}ms delay...`
      );
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));

      try {
        // Clear previous failed instance
        if (this.instance) {
          await this.cleanup();
        }

        // Try to reconnect
        await this.getInstance();

        // Check if we successfully connected
        if (this.isConnected()) {
          console.log(
            `✅ GlobalNDK: Reconnected successfully on attempt ${attempt}`
          );
          return true;
        }
      } catch (error) {
        console.warn(`⚠️ GlobalNDK: Retry attempt ${attempt} failed:`, error);
        // Continue to next attempt
      }
    }

    console.error(`❌ GlobalNDK: All ${maxAttempts} retry attempts failed`);
    return false;
  }

  /**
   * Start background retry process
   * Non-blocking - runs in background without blocking app startup
   */
  static startBackgroundRetry(): void {
    if (this.isConnected()) {
      console.log(
        '✅ GlobalNDK: Already connected, no background retry needed'
      );
      return;
    }

    console.log('🔄 GlobalNDK: Starting background connection retry...');

    // Run retry in background without awaiting
    this.retryConnection(3)
      .then((success) => {
        if (success) {
          console.log(
            '✅ GlobalNDK: Background retry succeeded - relays now connected'
          );
        } else {
          console.warn(
            '⚠️ GlobalNDK: Background retry failed - app will continue in offline mode'
          );
        }
      })
      .catch((error) => {
        console.error('❌ GlobalNDK: Background retry error:', error);
      });
  }

  /**
   * Log current connection count - useful for debugging Phase 1 implementation
   */
  static logConnectionCount(): void {
    const status = this.getStatus();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(
      `🔌 WEBSOCKET CONNECTION COUNT: ${status.connectedRelays}/${status.relayCount}`
    );
    console.log(
      `📊 Status: ${this.isConnected() ? 'CONNECTED' : 'DISCONNECTED'}`
    );
    console.log(`✅ Expected: 3 connections (Damus, nos.lol, Nostr.band)`);
    console.log(
      `${
        status.connectedRelays === 3
          ? '✅ PERFECT'
          : '⚠️ CHECK FOR DUPLICATE NDK INSTANCES'
      }`
    );
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}

// Export singleton getter for convenience
export const getGlobalNDK = () => GlobalNDKService.getInstance();
