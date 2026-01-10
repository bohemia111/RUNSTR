#!/usr/bin/env node
/**
 * Diagnostic Script: Test Season II Workout Query Performance
 *
 * Tests fetching kind 1301 workouts from Season II participants
 * to determine optimal timeout and measure relay performance.
 *
 * Usage:
 *   node scripts/diagnostics/test-season2-query.js
 *
 * What it tests:
 * - Connection time to each relay
 * - Events received from each relay
 * - Total query time
 * - Duplicate event handling
 * - Optimal timeout recommendation
 */

const WebSocket = require('ws');

// ============================================================================
// CONFIGURATION
// ============================================================================

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

// Season II date range (Jan 1 - Mar 1, 2026)
const SEASON_2_START = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);
const SEASON_2_END = Math.floor(new Date('2026-03-01T23:59:59Z').getTime() / 1000);

// Timeouts to test (milliseconds)
const TIMEOUTS_TO_TEST = [6000, 10000, 15000];

// Season II Participants (38 pubkeys - copied from constants/season2.ts)
const SEASON_2_PUBKEYS = [
  '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5',
  '745eb529d0e42d2fa6c904bbc2c10702deae964b4dd3079803ab8b43536dda12',
  'dae73fdd90d98db1a8405bcecac60cd6ce8d10896a6a2c5e04011125e16cd432',
  '43256bc0859462cf14fa7de594a48babdf189b91abe27f88d824abf69b2343c9',
  'e7df627c638d934b37548d8408b43dc5d4762fa270c26abec5916bff62aac80d',
  '9358c67695d9e78bde2bf3ce1eb0a5059553687632a177e7d25deeff9f2912fc',
  'c9943d8f8e9c2aa9facb6e579af6ec38b7205c0570de1b0fb8f99f65dc5f786e',
  '6b42a3b227b086e850ff659a151863ce070eb60d32bae8a4618928655effc3f6',
  '0c252c138ee446b6f9c0964ff609380fc82e52c8d318529607f293fcdf828bea',
  'c8b22b81877eaa54e1ab21e39824f85a29e61f71da9fbabbef8930b171b98da8',
  '8ce975f57dd070c4293ff8f978b869e20b2cdf4c81f277b46f3676b262c5e823',
  '9fce3aea32b35637838fb45b75be32595742e16bb3e4742cc82bb3d50f9087e6',
  'e5237023a5c0929e7ae0e5128d41a8213138400ec110dbe9d8a29278f22b7c13',
  '02734f19cae7850e7bca6c0a2bb6a534f152d5acbd86eece1d2bfbd5d6502003',
  '939ffb4e552ed5c0fa780985ab7163f441798409ae7ed81c62c07ac4683b4222',
  '5a654b6394bb83ecc1b95f848d6bc44e6d21120de5d832040704d9823b2c0af4',
  '5d405752c1b4ddd0714baf3ce415db52e5506036f345ff575ee16e2b4cf189bf',
  '14ca97caaea1565dc3f8277394a8f7d03364745a8d18536d8423dbac3f363b7f',
  'de7ab932ca17278b2144a6628c3531a0628fcc7b58074111d6e5b949ecb0e377',
  'a80fc4a78634ee26aabcac951b4cfd7b56ae18babd33c5afdcf6bed6dc80ebd1',
  'a723805cda67251191c8786f4da58f797e6977582301354ba8e91bcb0342dc9c',
  '0ae9dc5f42febd11c5c895b0af0bbabbe02261591b0f24eefe22c0d9ca8d0286',
  'fad80b7451b03f686fd9e487b05b69c04c808e26a1db655e59e0e296a5c9f4dd',
  'a9046cc9175dc5a45fb93a2c890f9a8b18c707fa6d695771aab9300081d3e21a',
  '20d29810d6a5f92b045ade02ebbadc9036d741cc686b00415c42b4236fe4ad2f',
  'ea28488b659ab6433167cd024eb72e01a375ac17ce54a1cdc6e5dce2f6d93923',
  'c6f0f4279f12200f77e1943cd26aaedf6081fda8585695f9a923b4723686da12',
  '661305095522a18a1095b7b86874ef618da9c5d1ba5f4af375688e2129c07317',
  '933a52008116743cd652eca47209f57e4ca4c439d8c2526d8c48a47bf7072ec7',
  '312f54da0da1cf0cdcf1d6385fa8d6e5d8218f7122297d30b22482edada44649',
  '9416112efa3cdc0675156e4cb6ae46b2cca51973065c61bcbc002ca99e5dcdf2',
  '0f563fe2cfdf180cb104586b95873379a0c1fdcfbc301a80c8255f33d15f039d',
  'd84517802a434757c56ae8642bffb4d26e5ade0712053750215680f5896e579b',
  'eeb11961b25442b16389fe6c7ebea9adf0ac36dd596816ea7119e521b8821b9e',
  '81b91540daeee031df309460a9bcf5866a54c70217ff173bcdefd1982f12b0ba',
  '7ebbce1843a17cd778a5e169e3d2f679f5ac7b5125d1c43d265e190f7b27538c',
  '179154c2b30226578a14ac5a01f50a3efde8d14032df96371550e1210fffd892',
  '1f698bd4b5dda804316f09773f903ca699cf5b2a0fcd5b3fe6e0709668d58e60',
  '86f7eea066dd4dc574d01b0f9317a03508887f815fb58d8ef66873cc42fe3431',
  '0418ca2d6cd6c7fbc4e0391bb745027023a7edbc38f2a60fc3b68f006efb85eb',
  '556329e4245ec4889c33b29262c85335a082c2e25cd08b69ff46e17e70b785ec',
];

// ============================================================================
// RELAY CONNECTION
// ============================================================================

class RelayConnection {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.connectTime = null;
    this.firstEventTime = null;
    this.eoseTime = null;
    this.events = [];
    this.subscriptionId = `test-${Date.now()}`;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        reject(new Error(`Failed to create WebSocket: ${err.message}`));
        return;
      }

      const timeout = setTimeout(() => {
        this.ws.close();
        reject(new Error('Connection timeout (5s)'));
      }, 5000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.connected = true;
        this.connectTime = Date.now() - startTime;
        resolve();
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${err.message}`));
      });
    });
  }

  subscribe(filter) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let eoseReceived = false;

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message[0] === 'EVENT' && message[1] === this.subscriptionId) {
            if (!this.firstEventTime) {
              this.firstEventTime = Date.now() - startTime;
            }
            this.events.push(message[2]);

            // Progress logging every 10 events
            if (this.events.length % 10 === 0) {
              console.log(`  [${this.getShortName()}] ${this.events.length} events received...`);
            }
          }

          if (message[0] === 'EOSE' && message[1] === this.subscriptionId) {
            this.eoseTime = Date.now() - startTime;
            eoseReceived = true;
            resolve();
          }
        } catch (err) {
          // Ignore parse errors
        }
      });

      // Send subscription request
      const req = ['REQ', this.subscriptionId, filter];
      this.ws.send(JSON.stringify(req));
    });
  }

  close() {
    if (this.ws) {
      // Send CLOSE message
      try {
        this.ws.send(JSON.stringify(['CLOSE', this.subscriptionId]));
      } catch (e) {
        // Ignore
      }
      this.ws.close();
    }
  }

  getShortName() {
    return this.url.replace('wss://', '').replace('relay.', '');
  }

  getStats() {
    return {
      url: this.url,
      shortName: this.getShortName(),
      connected: this.connected,
      connectTimeMs: this.connectTime,
      firstEventTimeMs: this.firstEventTime,
      eoseTimeMs: this.eoseTime,
      eventCount: this.events.length,
    };
  }
}

// ============================================================================
// MAIN TEST FUNCTION
// ============================================================================

async function runTest(timeoutMs) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing with ${timeoutMs / 1000}s timeout`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Authors: ${SEASON_2_PUBKEYS.length} pubkeys`);
  console.log(`Date range: ${new Date(SEASON_2_START * 1000).toISOString()} to ${new Date(SEASON_2_END * 1000).toISOString()}`);
  console.log();

  const filter = {
    kinds: [1301],
    authors: SEASON_2_PUBKEYS,
    since: SEASON_2_START,
    until: SEASON_2_END,
    limit: 3000,
  };

  const connections = RELAYS.map((url) => new RelayConnection(url));
  const startTime = Date.now();

  // Connect to all relays
  console.log('Connecting to relays...');
  const connectResults = await Promise.allSettled(
    connections.map((conn) => conn.connect())
  );

  for (let i = 0; i < connections.length; i++) {
    const conn = connections[i];
    const result = connectResults[i];
    if (result.status === 'fulfilled') {
      console.log(`  [${conn.getShortName()}] Connected in ${conn.connectTime}ms`);
    } else {
      console.log(`  [${conn.getShortName()}] FAILED: ${result.reason.message}`);
    }
  }

  const connectedRelays = connections.filter((c) => c.connected);
  if (connectedRelays.length === 0) {
    console.log('\nNo relays connected! Aborting test.');
    return null;
  }

  // Subscribe to all connected relays with timeout
  console.log('\nQuerying relays...');
  const subscribePromises = connectedRelays.map((conn) =>
    Promise.race([
      conn.subscribe(filter),
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ])
  );

  await Promise.allSettled(subscribePromises);
  const totalTime = Date.now() - startTime;

  // Close all connections
  connections.forEach((conn) => conn.close());

  // Aggregate results
  console.log('\n--- Results ---');

  let totalEvents = 0;
  const allEventIds = new Set();

  for (const conn of connectedRelays) {
    const stats = conn.getStats();
    console.log(`\n[${stats.shortName}]`);
    console.log(`  Connect time: ${stats.connectTimeMs}ms`);
    console.log(`  First event: ${stats.firstEventTimeMs ? stats.firstEventTimeMs + 'ms' : 'N/A'}`);
    console.log(`  EOSE time: ${stats.eoseTimeMs ? stats.eoseTimeMs + 'ms' : 'TIMEOUT'}`);
    console.log(`  Events: ${stats.eventCount}`);

    totalEvents += stats.eventCount;
    conn.events.forEach((e) => allEventIds.add(e.id));
  }

  const uniqueEvents = allEventIds.size;
  const duplicates = totalEvents - uniqueEvents;

  console.log('\n--- Summary ---');
  console.log(`Total events received: ${totalEvents}`);
  console.log(`Unique events: ${uniqueEvents}`);
  console.log(`Duplicates removed: ${duplicates}`);
  console.log(`Total query time: ${(totalTime / 1000).toFixed(2)}s`);

  // Analyze activity types
  const activityCounts = { running: 0, walking: 0, cycling: 0, other: 0 };
  const allEvents = [];
  connectedRelays.forEach((conn) => {
    conn.events.forEach((e) => {
      if (!allEvents.find((x) => x.id === e.id)) {
        allEvents.push(e);
        const exerciseTag = e.tags?.find((t) => t[0] === 'exercise');
        const activityType = exerciseTag?.[1]?.toLowerCase() || 'unknown';
        if (activityType.includes('run') || activityType.includes('jog')) {
          activityCounts.running++;
        } else if (activityType.includes('walk') || activityType.includes('hike')) {
          activityCounts.walking++;
        } else if (activityType.includes('cycl') || activityType.includes('bike')) {
          activityCounts.cycling++;
        } else {
          activityCounts.other++;
        }
      }
    });
  });

  console.log('\n--- Activity Breakdown ---');
  console.log(`Running: ${activityCounts.running}`);
  console.log(`Walking: ${activityCounts.walking}`);
  console.log(`Cycling: ${activityCounts.cycling}`);
  console.log(`Other: ${activityCounts.other}`);

  return {
    timeoutMs,
    totalTimeMs: totalTime,
    totalEvents,
    uniqueEvents,
    duplicates,
    relayStats: connectedRelays.map((c) => c.getStats()),
    activityCounts,
  };
}

// ============================================================================
// ENTRY POINT
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('Season II Workout Query Performance Test');
  console.log('='.repeat(60));
  console.log(`\nRelays: ${RELAYS.join(', ')}`);
  console.log(`Participants: ${SEASON_2_PUBKEYS.length}`);
  console.log(`Date range: Jan 1, 2026 - Mar 1, 2026`);
  console.log(`Timeouts to test: ${TIMEOUTS_TO_TEST.map((t) => t / 1000 + 's').join(', ')}`);

  const results = [];

  for (const timeout of TIMEOUTS_TO_TEST) {
    const result = await runTest(timeout);
    if (result) {
      results.push(result);
    }
    // Wait between tests
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Final recommendation
  console.log('\n' + '='.repeat(60));
  console.log('RECOMMENDATION');
  console.log('='.repeat(60));

  if (results.length === 0) {
    console.log('No successful tests. Check relay connectivity.');
    return;
  }

  // Find the timeout that got the most events without taking too long
  const bestResult = results.reduce((best, curr) => {
    // If current got more events and didn't take much longer, prefer it
    if (curr.uniqueEvents > best.uniqueEvents) {
      return curr;
    }
    // If same events but faster, prefer faster
    if (curr.uniqueEvents === best.uniqueEvents && curr.totalTimeMs < best.totalTimeMs) {
      return curr;
    }
    return best;
  }, results[0]);

  console.log(`\nOptimal timeout: ${bestResult.timeoutMs / 1000}s`);
  console.log(`Expected events: ${bestResult.uniqueEvents}`);
  console.log(`Expected query time: ${(bestResult.totalTimeMs / 1000).toFixed(2)}s`);
  console.log(`\nActivity distribution:`);
  console.log(`  Running: ${bestResult.activityCounts.running}`);
  console.log(`  Walking: ${bestResult.activityCounts.walking}`);
  console.log(`  Cycling: ${bestResult.activityCounts.cycling}`);

  // Check if all timeouts got same results (EOSE came early)
  const allSameEvents = results.every((r) => r.uniqueEvents === results[0].uniqueEvents);
  if (allSameEvents && results.length > 1) {
    const fastestTime = Math.min(...results.map((r) => r.totalTimeMs));
    const fastestResult = results.find((r) => r.totalTimeMs === fastestTime);
    console.log(`\nNote: All timeouts returned same event count.`);
    console.log(`EOSE received early - ${(fastestTime / 1000).toFixed(2)}s is sufficient.`);
    console.log(`Recommended timeout: ${fastestResult.timeoutMs / 1000}s (with buffer)`);
  }
}

main().catch(console.error);
