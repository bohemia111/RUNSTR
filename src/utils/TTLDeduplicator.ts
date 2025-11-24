/**
 * TTLDeduplicator - Time-based deduplication utility with automatic cleanup
 * Prevents memory leaks by automatically expiring old entries
 */

export class TTLDeduplicator {
  private cache = new Map<string, number>();
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private cleanupCounter = 0;
  private readonly cleanupInterval = 100; // Clean up every 100 checks

  /**
   * Creates a new TTL-based deduplicator
   * @param ttlMs - Time to live in milliseconds (default: 1 hour)
   * @param maxSize - Maximum cache size before forced cleanup (default: 1000)
   */
  constructor(ttlMs = 3600000, maxSize = 1000) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  /**
   * Checks if an ID is a duplicate (seen within TTL window)
   * Automatically adds non-duplicates to cache
   * @param id - The identifier to check
   * @returns true if duplicate, false if new or expired
   */
  isDuplicate(id: string): boolean {
    const now = Date.now();
    const timestamp = this.cache.get(id);

    // Check if exists and not expired
    if (timestamp && now - timestamp < this.ttlMs) {
      return true;
    }

    // Increment cleanup counter and check if we should clean
    this.cleanupCounter++;
    if (
      this.cache.size >= this.maxSize ||
      this.cleanupCounter >= this.cleanupInterval
    ) {
      this.cleanup();
      this.cleanupCounter = 0;
    }

    // Add to cache as new entry
    this.cache.set(id, now);
    return false;
  }

  /**
   * Performs cleanup of expired entries
   * Called automatically when cache grows too large
   */
  private cleanup(): void {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    // Collect expired entries
    for (const [id, timestamp] of this.cache.entries()) {
      if (now - timestamp > this.ttlMs) {
        entriesToDelete.push(id);
      }
    }

    // Delete expired entries
    for (const id of entriesToDelete) {
      this.cache.delete(id);
    }

    // If still too large, remove oldest entries
    if (this.cache.size > this.maxSize) {
      const sortedEntries = Array.from(this.cache.entries()).sort(
        (a, b) => a[1] - b[1]
      );

      const entriesToRemove = sortedEntries.slice(
        0,
        this.cache.size - this.maxSize
      );

      for (const [id] of entriesToRemove) {
        this.cache.delete(id);
      }
    }

    console.log(
      `[TTLDeduplicator] Cleanup: removed ${entriesToDelete.length} expired entries, cache size: ${this.cache.size}`
    );
  }

  /**
   * Manually clears all entries
   */
  clear(): void {
    this.cache.clear();
    this.cleanupCounter = 0;
  }

  /**
   * Gets current cache statistics
   */
  getStats(): { size: number; oldestEntry: number | null } {
    let oldestTimestamp: number | null = null;

    if (this.cache.size > 0) {
      oldestTimestamp = Math.min(...Array.from(this.cache.values()));
    }

    return {
      size: this.cache.size,
      oldestEntry: oldestTimestamp,
    };
  }

  /**
   * Checks if cache contains an ID (regardless of expiry)
   */
  has(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Gets the timestamp for an ID
   */
  getTimestamp(id: string): number | undefined {
    return this.cache.get(id);
  }
}
