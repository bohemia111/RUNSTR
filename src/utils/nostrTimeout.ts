/**
 * nostrTimeout.ts - Timeout utilities for Nostr operations
 *
 * Provides standardized timeout wrappers to prevent UI blocking
 * from long-running Nostr queries and publish operations.
 */

/**
 * Standard timeout values for Nostr operations (in milliseconds)
 */
export const NOSTR_TIMEOUTS = {
  /** Query/fetch operations (subscriptions, event fetching) */
  QUERY: 5000,
  /** Publish operations (sending events to relays) */
  PUBLISH: 10000,
  /** Cryptographic signing operations */
  SIGN: 5000,
  /** Relay connection wait */
  RELAY_CONNECT: 3000,
  /** Quick operations (cache checks, local lookups) */
  QUICK: 2000,
} as const;

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve
 * within the specified time, either returns a fallback value or throws.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param operationName - Name for logging purposes
 * @param fallback - Optional fallback value to return on timeout (instead of throwing)
 * @returns The resolved value or fallback
 *
 * @example
 * // With throw on timeout
 * await withTimeout(ndk.fetchEvents(filter), NOSTR_TIMEOUTS.QUERY, 'fetchEvents');
 *
 * @example
 * // With fallback on timeout
 * const events = await withTimeout(
 *   ndk.fetchEvents(filter),
 *   NOSTR_TIMEOUTS.QUERY,
 *   'fetchEvents',
 *   new Set() // Return empty set on timeout
 * );
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string,
  fallback?: T
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`[NostrTimeout] ${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);

    // If fallback provided, return it instead of throwing
    if (fallback !== undefined) {
      console.warn(
        `[NostrTimeout] ${operationName} failed, using fallback:`,
        error instanceof Error ? error.message : error
      );
      return fallback;
    }

    // Re-throw with context
    throw error;
  }
}

/**
 * Wraps a promise with timeout, always returning a fallback on failure.
 * Never throws - useful for non-critical operations.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param operationName - Name for logging purposes
 * @param fallback - Fallback value to return on timeout or error
 * @returns The resolved value or fallback
 *
 * @example
 * // Always returns a value, never throws
 * const balance = await withTimeoutSafe(
 *   wallet.getBalance(),
 *   NOSTR_TIMEOUTS.QUICK,
 *   'getBalance',
 *   0
 * );
 */
export async function withTimeoutSafe<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string,
  fallback: T
): Promise<T> {
  try {
    return await withTimeout(promise, timeoutMs, operationName, fallback);
  } catch (error) {
    console.warn(
      `[NostrTimeout] ${operationName} failed completely, returning fallback:`,
      error instanceof Error ? error.message : error
    );
    return fallback;
  }
}

/**
 * Fire-and-forget wrapper for non-critical async operations.
 * Logs errors but never blocks or throws.
 *
 * @param promise - The promise to execute
 * @param operationName - Name for logging purposes
 *
 * @example
 * // Non-blocking cache invalidation
 * fireAndForget(
 *   CacheService.invalidate(key),
 *   'cacheInvalidation'
 * );
 */
export function fireAndForget(
  promise: Promise<unknown>,
  operationName: string
): void {
  promise.catch((error) => {
    console.warn(
      `[NostrTimeout] ${operationName} failed (fire-and-forget):`,
      error instanceof Error ? error.message : error
    );
  });
}

/**
 * Creates a promise that resolves after a delay.
 * Useful for staggering operations.
 *
 * @param ms - Delay in milliseconds
 * @returns Promise that resolves after delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
