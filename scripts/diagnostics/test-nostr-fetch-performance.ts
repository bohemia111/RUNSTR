#!/usr/bin/env npx tsx
/**
 * Nostr Fetch Performance Diagnostics
 *
 * Tests different patterns for fetching kind 1301 workout events:
 * 1. fetchEvents() - NDK's built-in method
 * 2. subscribe() with closeOnEose: true
 * 3. subscribe() with manual EOSE handling
 * 4. subscribe() with timeout only
 *
 * Measures:
 * - Time to first event
 * - Time to EOSE
 * - Time for subscription.stop()
 * - Total fetch time
 * - Event count from each method
 *
 * Usage: npx tsx scripts/diagnostics/test-nostr-fetch-performance.ts
 */

import NDK, { NDKFilter, NDKEvent, NDKSubscription } from '@nostr-dev-kit/ndk';

// ============================================================================
// Configuration
// ============================================================================

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
];

// Season 2 date range
const SEASON_START = new Date('2024-12-31T00:00:00Z');
const SEASON_END = new Date('2026-03-01T23:59:59Z');

// Subset of Season 2 participants for testing
const TEST_AUTHORS = [
  '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5', // TheWildHustle
  '745eb529d0e42d2fa6c904bbc2c10702deae964b4dd3079803ab8b43536dda12', // guy
  'dae73fdd90d98db1a8405bcecac60cd6ce8d10896a6a2c5e04011125e16cd432', // Lhasa Sensei
  '43256bc0859462cf14fa7de594a48babdf189b91abe27f88d824abf69b2343c9', // LOPES
  'e7df627c638d934b37548d8408b43dc5d4762fa270c26abec5916bff62aac80d', // KjetilR
  '6b42a3b227b086e850ff659a151863ce070eb60d32bae8a4618928655effc3f6', // JokerHasse
  'c8b22b81877eaa54e1ab21e39824f85a29e61f71da9fbabbef8930b171b98da8', // Hoov
  'e5237023a5c0929e7ae0e5128d41a8213138400ec110dbe9d8a29278f22b7c13', // Helen Yrmom
];

const TIMEOUT_MS = 10000; // 10 second timeout for tests

// ============================================================================
// Utilities
// ============================================================================

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function log(message: string, indent = 0) {
  const prefix = '  '.repeat(indent);
  console.log(`${prefix}${message}`);
}

// ============================================================================
// Test Methods
// ============================================================================

interface TestResult {
  method: string;
  eventCount: number;
  timeToFirstEvent: number | null;
  timeToEose: number | null;
  timeToStop: number | null;
  totalTime: number;
  error?: string;
}

/**
 * Test 1: NDK fetchEvents()
 */
async function testFetchEvents(ndk: NDK, filter: NDKFilter): Promise<TestResult> {
  const startTime = Date.now();
  let eventCount = 0;

  try {
    log('Starting fetchEvents()...', 1);
    const events = await Promise.race([
      ndk.fetchEvents(filter),
      new Promise<Set<NDKEvent>>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
      ),
    ]);

    eventCount = events.size;
    const totalTime = Date.now() - startTime;

    return {
      method: 'fetchEvents()',
      eventCount,
      timeToFirstEvent: null, // Can't measure with fetchEvents
      timeToEose: totalTime,  // fetchEvents returns on EOSE
      timeToStop: null,       // No explicit stop
      totalTime,
    };
  } catch (error: any) {
    return {
      method: 'fetchEvents()',
      eventCount,
      timeToFirstEvent: null,
      timeToEose: null,
      timeToStop: null,
      totalTime: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Test 2: subscribe() with closeOnEose: true
 */
async function testSubscribeCloseOnEose(ndk: NDK, filter: NDKFilter): Promise<TestResult> {
  const startTime = Date.now();
  let firstEventTime: number | null = null;
  let eoseTime: number | null = null;
  let stopTime: number | null = null;
  const events = new Set<NDKEvent>();

  return new Promise((resolve) => {
    log('Starting subscribe({ closeOnEose: true })...', 1);
    const subscription = ndk.subscribe(filter, { closeOnEose: true });

    subscription.on('event', (event: NDKEvent) => {
      if (!firstEventTime) {
        firstEventTime = Date.now() - startTime;
        log(`⚡ First event at ${formatMs(firstEventTime)}`, 2);
      }
      events.add(event);
    });

    subscription.on('eose', () => {
      eoseTime = Date.now() - startTime;
      log(`📬 EOSE at ${formatMs(eoseTime)} with ${events.size} events`, 2);

      // Time how long stop() takes
      const stopStart = Date.now();
      subscription.stop();
      stopTime = Date.now() - stopStart;
      log(`🛑 subscription.stop() took ${formatMs(stopTime)}`, 2);

      resolve({
        method: 'subscribe({ closeOnEose: true })',
        eventCount: events.size,
        timeToFirstEvent: firstEventTime,
        timeToEose: eoseTime,
        timeToStop: stopTime,
        totalTime: Date.now() - startTime,
      });
    });

    // Timeout fallback
    setTimeout(() => {
      if (!eoseTime) {
        const stopStart = Date.now();
        subscription.stop();
        stopTime = Date.now() - stopStart;

        resolve({
          method: 'subscribe({ closeOnEose: true })',
          eventCount: events.size,
          timeToFirstEvent: firstEventTime,
          timeToEose: null,
          timeToStop: stopTime,
          totalTime: Date.now() - startTime,
          error: 'Timeout before EOSE',
        });
      }
    }, TIMEOUT_MS);
  });
}

/**
 * Test 3: subscribe() with closeOnEose: false (manual handling)
 */
async function testSubscribeManualEose(ndk: NDK, filter: NDKFilter): Promise<TestResult> {
  const startTime = Date.now();
  let firstEventTime: number | null = null;
  let eoseTime: number | null = null;
  let stopTime: number | null = null;
  const events = new Set<NDKEvent>();
  let resolved = false;

  return new Promise((resolve) => {
    log('Starting subscribe({ closeOnEose: false })...', 1);
    const subscription = ndk.subscribe(filter, { closeOnEose: false });

    subscription.on('event', (event: NDKEvent) => {
      if (!firstEventTime) {
        firstEventTime = Date.now() - startTime;
        log(`⚡ First event at ${formatMs(firstEventTime)}`, 2);
      }
      events.add(event);
    });

    subscription.on('eose', () => {
      if (resolved) return;
      resolved = true;

      eoseTime = Date.now() - startTime;
      log(`📬 EOSE at ${formatMs(eoseTime)} with ${events.size} events`, 2);

      const stopStart = Date.now();
      subscription.stop();
      stopTime = Date.now() - stopStart;
      log(`🛑 subscription.stop() took ${formatMs(stopTime)}`, 2);

      resolve({
        method: 'subscribe({ closeOnEose: false })',
        eventCount: events.size,
        timeToFirstEvent: firstEventTime,
        timeToEose: eoseTime,
        timeToStop: stopTime,
        totalTime: Date.now() - startTime,
      });
    });

    // Timeout fallback
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        const stopStart = Date.now();
        subscription.stop();
        stopTime = Date.now() - stopStart;

        resolve({
          method: 'subscribe({ closeOnEose: false })',
          eventCount: events.size,
          timeToFirstEvent: firstEventTime,
          timeToEose: null,
          timeToStop: stopTime,
          totalTime: Date.now() - startTime,
          error: 'Timeout before EOSE',
        });
      }
    }, TIMEOUT_MS);
  });
}

/**
 * Test 4: subscribe() with timeout only (ignore EOSE)
 */
async function testSubscribeTimeoutOnly(ndk: NDK, filter: NDKFilter, timeoutMs: number): Promise<TestResult> {
  const startTime = Date.now();
  let firstEventTime: number | null = null;
  let eoseTime: number | null = null;
  let stopTime: number | null = null;
  const events = new Set<NDKEvent>();

  return new Promise((resolve) => {
    log(`Starting subscribe() with ${timeoutMs}ms timeout (ignore EOSE)...`, 1);
    const subscription = ndk.subscribe(filter, { closeOnEose: false });

    subscription.on('event', (event: NDKEvent) => {
      if (!firstEventTime) {
        firstEventTime = Date.now() - startTime;
        log(`⚡ First event at ${formatMs(firstEventTime)}`, 2);
      }
      events.add(event);
    });

    // Track EOSE for logging but don't stop
    subscription.on('eose', () => {
      if (!eoseTime) {
        eoseTime = Date.now() - startTime;
        log(`📬 EOSE at ${formatMs(eoseTime)} (not stopping yet)`, 2);
      }
    });

    // Stop after timeout
    setTimeout(() => {
      log(`⏱️ Timeout reached with ${events.size} events`, 2);
      const stopStart = Date.now();
      subscription.stop();
      stopTime = Date.now() - stopStart;
      log(`🛑 subscription.stop() took ${formatMs(stopTime)}`, 2);

      resolve({
        method: `subscribe() + ${timeoutMs}ms timeout`,
        eventCount: events.size,
        timeToFirstEvent: firstEventTime,
        timeToEose: eoseTime,
        timeToStop: stopTime,
        totalTime: Date.now() - startTime,
      });
    }, timeoutMs);
  });
}

/**
 * Test 5: Measure just subscription.stop() overhead
 */
async function testStopOverhead(ndk: NDK, filter: NDKFilter): Promise<void> {
  log('Testing subscription.stop() overhead...', 1);

  const subscription = ndk.subscribe(filter, { closeOnEose: false });
  let eventCount = 0;

  subscription.on('event', () => {
    eventCount++;
  });

  // Wait for some events
  await new Promise(r => setTimeout(r, 2000));
  log(`Received ${eventCount} events in 2 seconds`, 2);

  // Time the stop
  const stopStart = Date.now();
  subscription.stop();
  const stopTime = Date.now() - stopStart;

  log(`subscription.stop() took ${formatMs(stopTime)}`, 2);

  // Wait a moment
  await new Promise(r => setTimeout(r, 500));

  // Try stopping again (should be no-op)
  const stopStart2 = Date.now();
  subscription.stop();
  const stopTime2 = Date.now() - stopStart2;

  log(`Second stop() took ${formatMs(stopTime2)}`, 2);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  NOSTR FETCH PERFORMANCE DIAGNOSTICS');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');

  // Connect to relays
  log(`Connecting to ${RELAYS.length} relays...`);
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });

  await ndk.connect();
  await new Promise(r => setTimeout(r, 2000)); // Wait for connections

  const connectedCount = Array.from(ndk.pool.relays.values()).filter(r => r.status === 1).length;
  log(`Connected to ${connectedCount}/${RELAYS.length} relays`);
  console.log('');

  // Build filter
  const filter: NDKFilter = {
    kinds: [1301 as any],
    authors: TEST_AUTHORS,
    since: Math.floor(SEASON_START.getTime() / 1000),
    until: Math.floor(SEASON_END.getTime() / 1000),
    limit: 500,
  };

  log(`Filter: ${TEST_AUTHORS.length} authors, kind 1301`);
  log(`Date range: ${SEASON_START.toLocaleDateString()} - ${SEASON_END.toLocaleDateString()}`);
  console.log('');

  const results: TestResult[] = [];

  // Run tests
  console.log('────────────────────────────────────────────────────────────────');
  console.log('TEST 1: fetchEvents()');
  console.log('────────────────────────────────────────────────────────────────');
  results.push(await testFetchEvents(ndk, filter));
  console.log('');

  console.log('────────────────────────────────────────────────────────────────');
  console.log('TEST 2: subscribe({ closeOnEose: true })');
  console.log('────────────────────────────────────────────────────────────────');
  results.push(await testSubscribeCloseOnEose(ndk, filter));
  console.log('');

  console.log('────────────────────────────────────────────────────────────────');
  console.log('TEST 3: subscribe({ closeOnEose: false }) + manual EOSE');
  console.log('────────────────────────────────────────────────────────────────');
  results.push(await testSubscribeManualEose(ndk, filter));
  console.log('');

  console.log('────────────────────────────────────────────────────────────────');
  console.log('TEST 4: subscribe() + 3s timeout (ignore EOSE)');
  console.log('────────────────────────────────────────────────────────────────');
  results.push(await testSubscribeTimeoutOnly(ndk, filter, 3000));
  console.log('');

  console.log('────────────────────────────────────────────────────────────────');
  console.log('TEST 5: subscribe() + 6s timeout (ignore EOSE)');
  console.log('────────────────────────────────────────────────────────────────');
  results.push(await testSubscribeTimeoutOnly(ndk, filter, 6000));
  console.log('');

  console.log('────────────────────────────────────────────────────────────────');
  console.log('TEST 6: subscription.stop() overhead');
  console.log('────────────────────────────────────────────────────────────────');
  await testStopOverhead(ndk, filter);
  console.log('');

  // Summary
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  RESULTS SUMMARY');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('| Method                              | Events | First Event | EOSE      | Stop     | Total     |');
  console.log('|-------------------------------------|--------|-------------|-----------|----------|-----------|');

  for (const result of results) {
    const first = result.timeToFirstEvent ? formatMs(result.timeToFirstEvent) : 'N/A';
    const eose = result.timeToEose ? formatMs(result.timeToEose) : (result.error || 'N/A');
    const stop = result.timeToStop ? formatMs(result.timeToStop) : 'N/A';
    const total = formatMs(result.totalTime);
    const method = result.method.padEnd(35);

    console.log(`| ${method} | ${String(result.eventCount).padStart(6)} | ${first.padStart(11)} | ${eose.padStart(9)} | ${stop.padStart(8)} | ${total.padStart(9)} |`);
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');

  // Recommendations
  console.log('ANALYSIS:');
  console.log('');

  const fastest = results.reduce((a, b) => a.totalTime < b.totalTime ? a : b);
  const mostEvents = results.reduce((a, b) => a.eventCount > b.eventCount ? a : b);

  log(`Fastest method: ${fastest.method} (${formatMs(fastest.totalTime)})`);
  log(`Most events: ${mostEvents.method} (${mostEvents.eventCount} events)`);

  const stopOverhead = results.find(r => r.timeToStop && r.timeToStop > 100);
  if (stopOverhead) {
    log(`⚠️  WARNING: subscription.stop() took ${formatMs(stopOverhead.timeToStop!)} in ${stopOverhead.method}`);
    log(`   This could be blocking the UI thread!`);
  }

  console.log('');

  // Clean up
  await ndk.pool.destroy();
  process.exit(0);
}

main().catch(console.error);
