/**
 * NostrFetchLogger - Centralized logging utility for Nostr data fetching
 *
 * Provides consistent timing and logging across all Nostr operations.
 * Helps identify:
 * - Slow fetches
 * - Blocking operations
 * - Cache hits/misses
 * - Unnecessary duplicate fetches
 *
 * Usage:
 * ```typescript
 * NostrFetchLogger.start('Season2.fetchWorkouts');
 * // ... do work ...
 * NostrFetchLogger.end('Season2.fetchWorkouts', events.length);
 * ```
 */

// Color codes for better log visibility
const COLORS = {
  START: '🟡',
  END: '🟢',
  CACHE_HIT: '💚',
  CACHE_MISS: '🔴',
  TIMEOUT: '⏰',
  ERROR: '❌',
  DEDUP: '♻️',
  BLOCK: '🔒',
};

interface TimerEntry {
  startTime: number;
  operation: string;
  details?: Record<string, any>;
}

interface FetchStats {
  totalCalls: number;
  cacheHits: number;
  cacheMisses: number;
  timeouts: number;
  errors: number;
  totalDuration: number;
  avgDuration: number;
  maxDuration: number;
  maxOperation: string;
}

class NostrFetchLoggerClass {
  private timers: Map<string, TimerEntry> = new Map();
  private stats: Map<string, FetchStats> = new Map();
  private enabled: boolean = __DEV__ || false; // Only in dev mode by default

  /**
   * Enable or disable logging (useful for production)
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[NostrFetch] Logging ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Start timing an operation
   */
  start(operation: string, details?: Record<string, any>): void {
    if (!this.enabled) return;

    const key = this.getTimerKey(operation);
    this.timers.set(key, {
      startTime: Date.now(),
      operation,
      details,
    });

    const detailStr = details ? ` ${JSON.stringify(details)}` : '';
    console.log(`[NostrFetch] ${COLORS.START} ${operation} START${detailStr}`);
  }

  /**
   * End timing an operation and log duration
   */
  end(operation: string, resultCount?: number, extra?: string): number {
    if (!this.enabled) return 0;

    const key = this.getTimerKey(operation);
    const entry = this.timers.get(key);

    if (!entry) {
      console.warn(`[NostrFetch] ${COLORS.ERROR} No timer found for: ${operation}`);
      return 0;
    }

    const duration = Date.now() - entry.startTime;
    this.timers.delete(key);

    // Update stats
    this.updateStats(operation, duration, false, false, false);

    const resultStr = resultCount !== undefined ? ` - ${resultCount} results` : '';
    const extraStr = extra ? ` (${extra})` : '';
    const durationClass = duration > 3000 ? '🐌 SLOW' : duration > 1000 ? '⚠️' : '';

    console.log(
      `[NostrFetch] ${COLORS.END} ${operation} END (${duration}ms)${resultStr}${extraStr} ${durationClass}`
    );

    return duration;
  }

  /**
   * Log a cache hit
   */
  cacheHit(operation: string, cacheKey?: string): void {
    if (!this.enabled) return;

    this.updateStats(operation, 0, true, false, false);

    const keyStr = cacheKey ? ` [${cacheKey}]` : '';
    console.log(`[NostrFetch] ${COLORS.CACHE_HIT} ${operation} CACHE HIT${keyStr}`);
  }

  /**
   * Log a cache miss
   */
  cacheMiss(operation: string, cacheKey?: string): void {
    if (!this.enabled) return;

    this.updateStats(operation, 0, false, true, false);

    const keyStr = cacheKey ? ` [${cacheKey}]` : '';
    console.log(`[NostrFetch] ${COLORS.CACHE_MISS} ${operation} CACHE MISS${keyStr} → FETCH`);
  }

  /**
   * Log a timeout
   */
  timeout(operation: string, timeoutMs: number): void {
    if (!this.enabled) return;

    this.updateStats(operation, timeoutMs, false, false, true);

    console.log(`[NostrFetch] ${COLORS.TIMEOUT} ${operation} TIMEOUT after ${timeoutMs}ms`);
  }

  /**
   * Log a fetch deduplication (reusing in-flight request)
   */
  dedup(operation: string): void {
    if (!this.enabled) return;

    console.log(`[NostrFetch] ${COLORS.DEDUP} ${operation} DEDUP - reusing in-flight request`);
  }

  /**
   * Log a blocking operation warning
   */
  blockingWarning(operation: string, context?: string): void {
    if (!this.enabled) return;

    const ctxStr = context ? ` (${context})` : '';
    console.warn(`[NostrFetch] ${COLORS.BLOCK} ${operation} BLOCKING${ctxStr}`);
  }

  /**
   * Log an error
   */
  error(operation: string, error: Error | string): void {
    if (!this.enabled) return;

    const errorMsg = error instanceof Error ? error.message : error;
    console.error(`[NostrFetch] ${COLORS.ERROR} ${operation} ERROR: ${errorMsg}`);
  }

  /**
   * Log a simple message
   */
  log(message: string): void {
    if (!this.enabled) return;

    console.log(`[NostrFetch] ${message}`);
  }

  /**
   * Get statistics for all operations
   */
  getStats(): Map<string, FetchStats> {
    return new Map(this.stats);
  }

  /**
   * Print a summary of all fetch statistics
   */
  printSummary(): void {
    if (!this.enabled) return;

    console.log('\n========== NOSTR FETCH SUMMARY ==========');

    if (this.stats.size === 0) {
      console.log('No fetch operations recorded.');
      console.log('==========================================\n');
      return;
    }

    // Sort by total duration (slowest first)
    const sorted = Array.from(this.stats.entries()).sort(
      (a, b) => b[1].totalDuration - a[1].totalDuration
    );

    let totalCalls = 0;
    let totalCacheHits = 0;
    let totalDuration = 0;

    for (const [category, stats] of sorted) {
      const hitRate = stats.totalCalls > 0
        ? ((stats.cacheHits / stats.totalCalls) * 100).toFixed(0)
        : '0';

      console.log(`\n📊 ${category}:`);
      console.log(`   Calls: ${stats.totalCalls} (${hitRate}% cache hit)`);
      console.log(`   Avg duration: ${stats.avgDuration.toFixed(0)}ms`);
      console.log(`   Max duration: ${stats.maxDuration}ms`);
      if (stats.timeouts > 0) {
        console.log(`   ⚠️ Timeouts: ${stats.timeouts}`);
      }
      if (stats.errors > 0) {
        console.log(`   ❌ Errors: ${stats.errors}`);
      }

      totalCalls += stats.totalCalls;
      totalCacheHits += stats.cacheHits;
      totalDuration += stats.totalDuration;
    }

    console.log('\n📈 TOTALS:');
    console.log(`   Total calls: ${totalCalls}`);
    console.log(`   Cache hit rate: ${totalCalls > 0 ? ((totalCacheHits / totalCalls) * 100).toFixed(0) : 0}%`);
    console.log(`   Total time: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log('==========================================\n');
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.stats.clear();
    this.timers.clear();
    console.log('[NostrFetch] Stats reset');
  }

  // Private helpers

  private getTimerKey(operation: string): string {
    // Use operation name + random suffix to allow concurrent timers for same operation
    return `${operation}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }

  private updateStats(
    operation: string,
    duration: number,
    isCacheHit: boolean,
    isCacheMiss: boolean,
    isTimeout: boolean
  ): void {
    // Extract category (first part of operation name)
    const category = operation.split('.')[0] || operation;

    const existing = this.stats.get(category) || {
      totalCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      timeouts: 0,
      errors: 0,
      totalDuration: 0,
      avgDuration: 0,
      maxDuration: 0,
      maxOperation: '',
    };

    existing.totalCalls++;
    if (isCacheHit) existing.cacheHits++;
    if (isCacheMiss) existing.cacheMisses++;
    if (isTimeout) existing.timeouts++;
    existing.totalDuration += duration;
    existing.avgDuration = existing.totalDuration / existing.totalCalls;

    if (duration > existing.maxDuration) {
      existing.maxDuration = duration;
      existing.maxOperation = operation;
    }

    this.stats.set(category, existing);
  }
}

// Export singleton
export const NostrFetchLogger = new NostrFetchLoggerClass();

// Also export the class for testing
export { NostrFetchLoggerClass };
