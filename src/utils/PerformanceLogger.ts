/**
 * Performance Logger
 *
 * Simple utility for measuring and logging operation timing during app startup.
 * Helps identify blocking operations causing UI freezes.
 *
 * Usage:
 * ```typescript
 * PerformanceLogger.start('myOperation');
 * await someSlowFunction();
 * PerformanceLogger.end('myOperation');
 * ```
 */

interface TimerEntry {
  startTime: number;
  label: string;
  indent?: number;
}

class PerformanceLoggerClass {
  private timers: Map<string, TimerEntry> = new Map();
  private completedTimings: Array<{
    label: string;
    duration: number;
    indent: number;
  }> = [];
  private enabled: boolean = true;

  /**
   * Start timing an operation
   */
  start(label: string, indent: number = 0): void {
    if (!this.enabled) return;

    this.timers.set(label, {
      startTime: Date.now(),
      label,
      indent,
    });
  }

  /**
   * End timing an operation and log the duration
   */
  end(label: string): number {
    if (!this.enabled) return 0;

    const timer = this.timers.get(label);
    if (!timer) {
      console.warn(`⚠️ [PERF] No timer found for: ${label}`);
      return 0;
    }

    const duration = Date.now() - timer.startTime;
    const seconds = (duration / 1000).toFixed(2);
    const indent = '  '.repeat(timer.indent || 0);

    // Color code based on duration
    let emoji = '🟢'; // < 2 seconds
    if (duration > 5000) {
      emoji = '🔴'; // > 5 seconds
    } else if (duration > 2000) {
      emoji = '🟡'; // 2-5 seconds
    }

    console.log(`${emoji} [PERF] ${indent}${label}: ${seconds}s`);

    this.completedTimings.push({ label, duration, indent: timer.indent || 0 });
    this.timers.delete(label);

    return duration;
  }

  /**
   * Log a summary of all timing operations
   */
  summary(): void {
    if (!this.enabled || this.completedTimings.length === 0) return;

    const totalDuration = this.completedTimings
      .filter((t) => t.indent === 0) // Only count top-level operations
      .reduce((sum, t) => sum + t.duration, 0);

    const totalSeconds = (totalDuration / 1000).toFixed(2);

    let emoji = '🟢';
    if (totalDuration > 5000) {
      emoji = '🔴';
    } else if (totalDuration > 2000) {
      emoji = '🟡';
    }

    console.log('────────────────────────────');
    console.log(`${emoji} [PERF] TOTAL BLOCKING TIME: ${totalSeconds}s`);
    console.log('────────────────────────────');
  }

  /**
   * Reset all timers and completed timings
   */
  reset(): void {
    this.timers.clear();
    this.completedTimings = [];
  }

  /**
   * Enable or disable performance logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Async wrapper for timing async operations
   */
  async measure<T>(
    label: string,
    operation: () => Promise<T>,
    indent: number = 0
  ): Promise<T> {
    this.start(label, indent);
    try {
      const result = await operation();
      this.end(label);
      return result;
    } catch (error) {
      this.end(label);
      throw error;
    }
  }

  /**
   * Sync wrapper for timing sync operations
   */
  measureSync<T>(label: string, operation: () => T, indent: number = 0): T {
    this.start(label, indent);
    try {
      const result = operation();
      this.end(label);
      return result;
    } catch (error) {
      this.end(label);
      throw error;
    }
  }
}

export const PerformanceLogger = new PerformanceLoggerClass();
