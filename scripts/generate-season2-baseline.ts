#!/usr/bin/env npx tsx
/**
 * Generate Season II Baseline Totals
 *
 * Fetches ALL workout events (kind 1301) for Season II participants
 * and outputs hardcoded totals to paste into the app.
 *
 * Features:
 * - Deduplication by event ID (same workout on multiple relays)
 * - Anti-cheat validation (pace, distance, duration limits)
 * - Queries multiple relays for complete coverage
 *
 * Usage: npx tsx scripts/generate-season2-baseline.ts
 */

// WebSocket polyfill for Node.js (required for NDK)
import 'websocket-polyfill';

import NDK, { NDKFilter, NDKEvent } from '@nostr-dev-kit/ndk';

// Import actual participant list from the app constants
import { SEASON_2_PARTICIPANTS } from '../src/constants/season2';

// Season II date range
const SEASON_START = new Date('2024-12-31T00:00:00Z');
const BASELINE_END = new Date(); // Now

// Query ALL relays for complete coverage
const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

// ============================================================================
// ANTI-CHEAT VALIDATION RULES
// ============================================================================

interface AntiCheatLimits {
  minPaceSecondsPerKm: number;  // Fastest allowed pace
  maxPaceSecondsPerKm: number;  // Slowest allowed pace
  maxDistanceKm: number;        // Max single workout distance
  maxDurationSeconds: number;   // Max single workout duration
}

const ANTICHEAT_LIMITS: Record<string, AntiCheatLimits> = {
  running: {
    minPaceSecondsPerKm: 120,    // 2:00/km (world record territory)
    maxPaceSecondsPerKm: 1800,   // 30:00/km (extremely slow)
    maxDistanceKm: 200,          // Ultra marathon territory
    maxDurationSeconds: 172800,  // 48 hours
  },
  walking: {
    minPaceSecondsPerKm: 180,    // 3:00/km (running, not walking)
    maxPaceSecondsPerKm: 3600,   // 60:00/km (too slow to count)
    maxDistanceKm: 100,          // Max single walk
    maxDurationSeconds: 86400,   // 24 hours
  },
  cycling: {
    minPaceSecondsPerKm: 30,     // 0:30/km (120 km/h - downhill only)
    maxPaceSecondsPerKm: 600,    // 10:00/km (6 km/h - too slow)
    maxDistanceKm: 500,          // Max single ride
    maxDurationSeconds: 172800,  // 48 hours
  },
};

interface FlaggedWorkout {
  eventId: string;
  pubkey: string;
  userName: string;
  activityType: string;
  distance: number;
  duration: number;
  pace: number;
  reason: string;
}

// ============================================================================
// TYPES
// ============================================================================

interface ActivityTotals {
  distance: number;  // km
  duration: number;  // seconds
  count: number;
}

interface UserTotals {
  running: ActivityTotals;
  walking: ActivityTotals;
  cycling: ActivityTotals;
}

interface ParsedWorkout {
  eventId: string;
  activityType: string;
  distance: number;
  duration: number;
}

// ============================================================================
// PARSING
// ============================================================================

function parseWorkoutEvent(event: NDKEvent): ParsedWorkout | null {
  try {
    const tags = event.tags;

    // Get activity type from 'exercise' tag
    const exerciseTag = tags.find(t => t[0] === 'exercise');
    const activityType = exerciseTag?.[1]?.toLowerCase() || 'other';

    // Get distance from 'distance' tag (format: ['distance', '5.2', 'km'])
    const distanceTag = tags.find(t => t[0] === 'distance');
    let distance = 0;
    if (distanceTag) {
      const value = parseFloat(distanceTag[1]);
      const unit = distanceTag[2]?.toLowerCase() || 'km';
      if (unit === 'mi' || unit === 'miles') {
        distance = value * 1.60934; // Convert to km
      } else {
        distance = value;
      }
    }

    // Get duration from 'duration' tag (format: HH:MM:SS or seconds)
    const durationTag = tags.find(t => t[0] === 'duration');
    let duration = 0;
    if (durationTag) {
      const value = durationTag[1];
      if (value.includes(':')) {
        const parts = value.split(':').map(Number);
        if (parts.length === 3) {
          duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
          duration = parts[0] * 60 + parts[1];
        }
      } else {
        duration = parseInt(value, 10) || 0;
      }
    }

    return { eventId: event.id || '', activityType, distance, duration };
  } catch {
    return null;
  }
}

// ============================================================================
// ANTI-CHEAT VALIDATION
// ============================================================================

function validateWorkout(
  workout: ParsedWorkout,
  category: 'running' | 'walking' | 'cycling',
  userName: string,
  pubkey: string
): { valid: boolean; flagged?: FlaggedWorkout } {
  const limits = ANTICHEAT_LIMITS[category];

  // Calculate pace (seconds per km)
  const pace = workout.duration > 0 && workout.distance > 0
    ? workout.duration / workout.distance
    : 0;

  // Check for 0 distance with significant duration (forgot to end workout?)
  if (workout.distance === 0 && workout.duration > 1800) {
    return {
      valid: false,
      flagged: {
        eventId: workout.eventId,
        pubkey,
        userName,
        activityType: category,
        distance: workout.distance,
        duration: workout.duration,
        pace: 0,
        reason: `Zero distance with ${Math.round(workout.duration / 60)} min duration`,
      },
    };
  }

  // Check for distance without duration (manual entry without time?)
  if (workout.distance > 0 && workout.duration === 0) {
    return {
      valid: false,
      flagged: {
        eventId: workout.eventId,
        pubkey,
        userName,
        activityType: category,
        distance: workout.distance,
        duration: workout.duration,
        pace: 0,
        reason: `${workout.distance.toFixed(2)} km with 0 duration`,
      },
    };
  }

  // Check max distance
  if (workout.distance > limits.maxDistanceKm) {
    return {
      valid: false,
      flagged: {
        eventId: workout.eventId,
        pubkey,
        userName,
        activityType: category,
        distance: workout.distance,
        duration: workout.duration,
        pace,
        reason: `Distance ${workout.distance.toFixed(2)} km exceeds max ${limits.maxDistanceKm} km`,
      },
    };
  }

  // Check max duration
  if (workout.duration > limits.maxDurationSeconds) {
    return {
      valid: false,
      flagged: {
        eventId: workout.eventId,
        pubkey,
        userName,
        activityType: category,
        distance: workout.distance,
        duration: workout.duration,
        pace,
        reason: `Duration ${Math.round(workout.duration / 3600)} hours exceeds max ${limits.maxDurationSeconds / 3600} hours`,
      },
    };
  }

  // Check pace (only if we have both distance and duration)
  if (pace > 0) {
    if (pace < limits.minPaceSecondsPerKm) {
      return {
        valid: false,
        flagged: {
          eventId: workout.eventId,
          pubkey,
          userName,
          activityType: category,
          distance: workout.distance,
          duration: workout.duration,
          pace,
          reason: `Pace ${Math.floor(pace / 60)}:${String(Math.round(pace % 60)).padStart(2, '0')}/km too fast (min: ${Math.floor(limits.minPaceSecondsPerKm / 60)}:${String(limits.minPaceSecondsPerKm % 60).padStart(2, '0')}/km)`,
        },
      };
    }

    if (pace > limits.maxPaceSecondsPerKm) {
      return {
        valid: false,
        flagged: {
          eventId: workout.eventId,
          pubkey,
          userName,
          activityType: category,
          distance: workout.distance,
          duration: workout.duration,
          pace,
          reason: `Pace ${Math.floor(pace / 60)}:${String(Math.round(pace % 60)).padStart(2, '0')}/km too slow (max: ${Math.floor(limits.maxPaceSecondsPerKm / 60)}:${String(limits.maxPaceSecondsPerKm % 60).padStart(2, '0')}/km)`,
        },
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  SEASON II BASELINE TOTALS GENERATOR');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Date range: ${SEASON_START.toISOString()} to ${BASELINE_END.toISOString()}`);
  console.log(`Participants: ${SEASON_2_PARTICIPANTS.length}`);
  console.log(`Relays: ${RELAYS.join(', ')}`);
  console.log('');

  // Connect to relays
  console.log('Connecting to relays...');
  const ndk = new NDK({ explicitRelayUrls: RELAYS });
  await ndk.connect();
  await new Promise(r => setTimeout(r, 3000)); // Give relays time to connect
  console.log('Connected!\n');

  // Initialize totals for all users
  const userTotals: Record<string, UserTotals> = {};
  for (const p of SEASON_2_PARTICIPANTS) {
    userTotals[p.pubkey] = {
      running: { distance: 0, duration: 0, count: 0 },
      walking: { distance: 0, duration: 0, count: 0 },
      cycling: { distance: 0, duration: 0, count: 0 },
    };
  }

  // Track seen event IDs for deduplication
  const seenEventIds = new Set<string>();
  const flaggedWorkouts: FlaggedWorkout[] = [];
  let duplicateCount = 0;

  // Fetch all workouts
  const filter: NDKFilter = {
    kinds: [1301 as any],
    authors: SEASON_2_PARTICIPANTS.map(p => p.pubkey),
    since: Math.floor(SEASON_START.getTime() / 1000),
    until: Math.floor(BASELINE_END.getTime() / 1000),
  };

  console.log('Fetching all workout events...');
  const events = await ndk.fetchEvents(filter);
  console.log(`Fetched ${events.size} events from relays\n`);

  // Create pubkey to name lookup
  const pubkeyToName = new Map<string, string>();
  for (const p of SEASON_2_PARTICIPANTS) {
    pubkeyToName.set(p.pubkey, p.name);
  }

  // Process events
  let processedCount = 0;
  let skippedCount = 0;

  for (const event of events) {
    // Deduplication check
    if (!event.id) continue;
    if (seenEventIds.has(event.id)) {
      duplicateCount++;
      continue;
    }
    seenEventIds.add(event.id);

    const workout = parseWorkoutEvent(event);
    if (!workout) {
      skippedCount++;
      continue;
    }

    const totals = userTotals[event.pubkey];
    if (!totals) {
      skippedCount++;
      continue;
    }

    // Categorize activity
    let category: 'running' | 'walking' | 'cycling' | null = null;
    const type = workout.activityType;

    if (type === 'running' || type === 'run') {
      category = 'running';
    } else if (type === 'walking' || type === 'walk' || type === 'hiking' || type === 'hike') {
      category = 'walking';
    } else if (type === 'cycling' || type === 'cycle' || type === 'biking' || type === 'bike') {
      category = 'cycling';
    }

    if (!category) {
      skippedCount++;
      continue;
    }

    // Anti-cheat validation
    const userName = pubkeyToName.get(event.pubkey) || 'Unknown';
    const validation = validateWorkout(workout, category, userName, event.pubkey);

    if (!validation.valid) {
      if (validation.flagged) {
        flaggedWorkouts.push(validation.flagged);
      }
      skippedCount++;
      continue;
    }

    // Add to totals
    totals[category].distance += workout.distance;
    totals[category].duration += workout.duration;
    totals[category].count += 1;
    processedCount++;
  }

  console.log(`Processing summary:`);
  console.log(`  - Unique events: ${seenEventIds.size}`);
  console.log(`  - Duplicates removed: ${duplicateCount}`);
  console.log(`  - Valid workouts: ${processedCount}`);
  console.log(`  - Skipped/flagged: ${skippedCount}`);
  console.log('');

  // Show flagged workouts
  if (flaggedWorkouts.length > 0) {
    console.log('════════════════════════════════════════════════════════════════');
    console.log('  FLAGGED WORKOUTS (review manually)');
    console.log('════════════════════════════════════════════════════════════════');
    console.log('');
    for (const flagged of flaggedWorkouts) {
      console.log(`  ${flagged.userName} (${flagged.activityType})`);
      console.log(`    Distance: ${flagged.distance.toFixed(2)} km, Duration: ${Math.round(flagged.duration / 60)} min`);
      console.log(`    Reason: ${flagged.reason}`);
      console.log(`    Event: ${flagged.eventId.slice(0, 16)}...`);
      console.log('');
    }
  }

  // Generate output
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  BASELINE DATA (paste into src/constants/season2Baseline.ts)');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');

  const baselineTimestamp = Math.floor(BASELINE_END.getTime() / 1000);

  console.log(`/**`);
  console.log(` * Season II Baseline Totals - Generated ${BASELINE_END.toISOString()}`);
  console.log(` * `);
  console.log(` * This file contains pre-computed workout totals from Season II start (Dec 31, 2024)`);
  console.log(` * until the baseline date. The app only needs to fetch workouts AFTER this date.`);
  console.log(` * `);
  console.log(` * Stats:`);
  console.log(` * - Events processed: ${seenEventIds.size} unique (${duplicateCount} duplicates removed)`);
  console.log(` * - Valid workouts: ${processedCount}`);
  console.log(` * - Flagged/skipped: ${flaggedWorkouts.length} flagged, ${skippedCount - flaggedWorkouts.length} other`);
  console.log(` */`);
  console.log('');
  console.log(`export const BASELINE_TIMESTAMP = ${baselineTimestamp}; // ${BASELINE_END.toISOString()}`);
  console.log('');
  console.log('export interface ActivityTotals {');
  console.log('  distance: number;  // km');
  console.log('  duration: number;  // seconds');
  console.log('  count: number;');
  console.log('}');
  console.log('');
  console.log('export interface UserBaseline {');
  console.log('  running: ActivityTotals;');
  console.log('  walking: ActivityTotals;');
  console.log('  cycling: ActivityTotals;');
  console.log('}');
  console.log('');
  console.log('export const SEASON2_BASELINE: Record<string, UserBaseline> = {');

  // Output ALL participants (not just those with data)
  // This ensures the baseline has entries for everyone
  for (const p of SEASON_2_PARTICIPANTS) {
    const t = userTotals[p.pubkey];
    const hasData = t.running.count > 0 || t.walking.count > 0 || t.cycling.count > 0;

    if (hasData) {
      console.log(`  // ${p.name}`);
      console.log(`  '${p.pubkey}': {`);
      console.log(`    running: { distance: ${t.running.distance.toFixed(2)}, duration: ${Math.round(t.running.duration)}, count: ${t.running.count} },`);
      console.log(`    walking: { distance: ${t.walking.distance.toFixed(2)}, duration: ${Math.round(t.walking.duration)}, count: ${t.walking.count} },`);
      console.log(`    cycling: { distance: ${t.cycling.distance.toFixed(2)}, duration: ${Math.round(t.cycling.duration)}, count: ${t.cycling.count} },`);
      console.log(`  },`);
    }
  }

  console.log('};');
  console.log('');

  // Summary
  const usersWithData = SEASON_2_PARTICIPANTS.filter(p => {
    const t = userTotals[p.pubkey];
    return t.running.count > 0 || t.walking.count > 0 || t.cycling.count > 0;
  });

  console.log('════════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Total participants: ${SEASON_2_PARTICIPANTS.length}`);
  console.log(`Users with workout data: ${usersWithData.length}`);
  console.log(`Total valid workouts: ${processedCount}`);
  console.log(`Baseline timestamp: ${baselineTimestamp} (${BASELINE_END.toISOString()})`);
  console.log('');

  // Show top 5 by running distance
  const sortedByRunning = [...usersWithData].sort((a, b) =>
    userTotals[b.pubkey].running.distance - userTotals[a.pubkey].running.distance
  ).slice(0, 5);

  console.log('Top 5 by running distance:');
  for (const p of sortedByRunning) {
    const t = userTotals[p.pubkey];
    console.log(`  ${p.name}: ${t.running.distance.toFixed(2)} km (${t.running.count} runs)`);
  }
  console.log('');

  // Show top 5 by walking distance
  const sortedByWalking = [...usersWithData].sort((a, b) =>
    userTotals[b.pubkey].walking.distance - userTotals[a.pubkey].walking.distance
  ).slice(0, 5);

  console.log('Top 5 by walking distance:');
  for (const p of sortedByWalking) {
    const t = userTotals[p.pubkey];
    if (t.walking.distance > 0) {
      console.log(`  ${p.name}: ${t.walking.distance.toFixed(2)} km (${t.walking.count} walks)`);
    }
  }
  console.log('');

  // Exit cleanly (don't use ndk.pool.destroy() - it doesn't exist)
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
