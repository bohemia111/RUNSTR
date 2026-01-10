#!/usr/bin/env npx tsx
/**
 * Generate Season II Charity Baseline Totals
 *
 * Fetches ALL workout events (kind 1301) for Season II participants
 * and outputs hardcoded CHARITY totals per activity type.
 *
 * This complements the user baseline (distance/duration per user)
 * by also tracking charity attribution for charity rankings.
 *
 * Features:
 * - Extracts charity tag from each workout (defaults to 'als-foundation')
 * - Aggregates distance per charity per activity type
 * - Counts unique participants per charity per activity
 * - Deduplication by event ID (same workout on multiple relays)
 * - Anti-cheat validation (same rules as user baseline script)
 *
 * Usage: npx tsx scripts/generate-charity-baseline.ts
 */

// WebSocket polyfill for Node.js (required for NDK)
import 'websocket-polyfill';

import NDK, { NDKFilter, NDKEvent } from '@nostr-dev-kit/ndk';

// Import actual participant list from the app constants
import { SEASON_2_PARTICIPANTS } from '../src/constants/season2';

// Season II date range
const SEASON_START = new Date('2024-12-31T00:00:00Z');
const BASELINE_END = new Date(); // Now

// Default charity when none specified
const DEFAULT_CHARITY_ID = 'als-foundation';

// Query ALL relays for complete coverage
const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

// ============================================================================
// ANTI-CHEAT VALIDATION RULES (same as user baseline)
// ============================================================================

interface AntiCheatLimits {
  minPaceSecondsPerKm: number;
  maxPaceSecondsPerKm: number;
  maxDistanceKm: number;
  maxDurationSeconds: number;
}

const ANTICHEAT_LIMITS: Record<string, AntiCheatLimits> = {
  running: {
    minPaceSecondsPerKm: 120,
    maxPaceSecondsPerKm: 1800,
    maxDistanceKm: 200,
    maxDurationSeconds: 172800,
  },
  walking: {
    minPaceSecondsPerKm: 180,
    maxPaceSecondsPerKm: 3600,
    maxDistanceKm: 100,
    maxDurationSeconds: 86400,
  },
  cycling: {
    minPaceSecondsPerKm: 30,
    maxPaceSecondsPerKm: 600,
    maxDistanceKm: 500,
    maxDurationSeconds: 172800,
  },
};

// ============================================================================
// TYPES
// ============================================================================

type ActivityType = 'running' | 'walking' | 'cycling';

interface CharityActivityData {
  distance: number;
  participants: Set<string>; // Track unique pubkeys
}

interface CharityTotals {
  running: CharityActivityData;
  walking: CharityActivityData;
  cycling: CharityActivityData;
}

interface ParsedWorkout {
  eventId: string;
  pubkey: string;
  activityType: ActivityType | null;
  distance: number;
  duration: number;
  charityId: string;
}

// ============================================================================
// PARSING
// ============================================================================

function parseWorkoutEvent(event: NDKEvent): ParsedWorkout | null {
  try {
    const tags = event.tags;

    // Get activity type from 'exercise' tag
    const exerciseTag = tags.find(t => t[0] === 'exercise');
    const exerciseType = exerciseTag?.[1]?.toLowerCase() || 'other';

    // Categorize activity
    let activityType: ActivityType | null = null;
    if (exerciseType === 'running' || exerciseType === 'run') {
      activityType = 'running';
    } else if (exerciseType === 'walking' || exerciseType === 'walk' || exerciseType === 'hiking' || exerciseType === 'hike') {
      activityType = 'walking';
    } else if (exerciseType === 'cycling' || exerciseType === 'cycle' || exerciseType === 'biking' || exerciseType === 'bike') {
      activityType = 'cycling';
    }

    // Get distance from 'distance' tag
    const distanceTag = tags.find(t => t[0] === 'distance');
    let distance = 0;
    if (distanceTag) {
      const value = parseFloat(distanceTag[1]);
      const unit = distanceTag[2]?.toLowerCase() || 'km';
      if (unit === 'mi' || unit === 'miles') {
        distance = value * 1.60934;
      } else {
        distance = value;
      }
    }

    // Get duration from 'duration' tag
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

    // Get charity from 'charity' tag (default to als-foundation)
    const charityTag = tags.find(t => t[0] === 'charity');
    const charityId = charityTag?.[1] || DEFAULT_CHARITY_ID;

    return {
      eventId: event.id || '',
      pubkey: event.pubkey,
      activityType,
      distance,
      duration,
      charityId,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// ANTI-CHEAT VALIDATION
// ============================================================================

function validateWorkout(
  workout: ParsedWorkout,
  category: ActivityType
): boolean {
  const limits = ANTICHEAT_LIMITS[category];

  // Calculate pace (seconds per km)
  const pace = workout.duration > 0 && workout.distance > 0
    ? workout.duration / workout.distance
    : 0;

  // Check for 0 distance with significant duration
  if (workout.distance === 0 && workout.duration > 1800) {
    return false;
  }

  // Check for distance without duration
  if (workout.distance > 0 && workout.duration === 0) {
    return false;
  }

  // Check max distance
  if (workout.distance > limits.maxDistanceKm) {
    return false;
  }

  // Check max duration
  if (workout.duration > limits.maxDurationSeconds) {
    return false;
  }

  // Check pace
  if (pace > 0) {
    if (pace < limits.minPaceSecondsPerKm || pace > limits.maxPaceSecondsPerKm) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  SEASON II CHARITY BASELINE GENERATOR');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Date range: ${SEASON_START.toISOString()} to ${BASELINE_END.toISOString()}`);
  console.log(`Participants: ${SEASON_2_PARTICIPANTS.length}`);
  console.log(`Default charity: ${DEFAULT_CHARITY_ID}`);
  console.log(`Relays: ${RELAYS.join(', ')}`);
  console.log('');

  // Connect to relays
  console.log('Connecting to relays...');
  const ndk = new NDK({ explicitRelayUrls: RELAYS });
  await ndk.connect();
  await new Promise(r => setTimeout(r, 3000));
  console.log('Connected!\n');

  // Initialize charity totals
  const charityTotals: Record<string, CharityTotals> = {};

  // Track seen event IDs for deduplication
  const seenEventIds = new Set<string>();
  let duplicateCount = 0;
  let skippedCount = 0;
  let processedCount = 0;

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

  // Process events
  for (const event of events) {
    if (!event.id) continue;

    // Deduplication
    if (seenEventIds.has(event.id)) {
      duplicateCount++;
      continue;
    }
    seenEventIds.add(event.id);

    const workout = parseWorkoutEvent(event);
    if (!workout || !workout.activityType) {
      skippedCount++;
      continue;
    }

    // Anti-cheat validation
    if (!validateWorkout(workout, workout.activityType)) {
      skippedCount++;
      continue;
    }

    // Skip if no distance
    if (workout.distance <= 0) {
      skippedCount++;
      continue;
    }

    // Initialize charity totals if needed
    if (!charityTotals[workout.charityId]) {
      charityTotals[workout.charityId] = {
        running: { distance: 0, participants: new Set() },
        walking: { distance: 0, participants: new Set() },
        cycling: { distance: 0, participants: new Set() },
      };
    }

    // Add to charity totals
    const charityData = charityTotals[workout.charityId][workout.activityType];
    charityData.distance += workout.distance;
    charityData.participants.add(workout.pubkey);
    processedCount++;
  }

  console.log(`Processing summary:`);
  console.log(`  - Unique events: ${seenEventIds.size}`);
  console.log(`  - Duplicates removed: ${duplicateCount}`);
  console.log(`  - Valid workouts: ${processedCount}`);
  console.log(`  - Skipped: ${skippedCount}`);
  console.log('');

  // Generate output
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  CHARITY BASELINE DATA');
  console.log('  (Add to src/constants/season2Baseline.ts)');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');

  console.log(`/**`);
  console.log(` * Season II Charity Baseline - Generated ${BASELINE_END.toISOString()}`);
  console.log(` *`);
  console.log(` * Charity distance totals aggregated from Season II start until baseline date.`);
  console.log(` * Used to populate charity rankings in buildLeaderboardFromWorkouts().`);
  console.log(` */`);
  console.log('');
  console.log('export interface CharityActivityTotals {');
  console.log('  distance: number;  // km');
  console.log('  participantCount: number;');
  console.log('}');
  console.log('');
  console.log('export interface CharityBaseline {');
  console.log('  charityId: string;');
  console.log('  running: CharityActivityTotals;');
  console.log('  walking: CharityActivityTotals;');
  console.log('  cycling: CharityActivityTotals;');
  console.log('}');
  console.log('');
  console.log('export const SEASON2_CHARITY_BASELINE: CharityBaseline[] = [');

  // Sort charities by total distance (across all activities)
  const sortedCharities = Object.entries(charityTotals).sort((a, b) => {
    const totalA = a[1].running.distance + a[1].walking.distance + a[1].cycling.distance;
    const totalB = b[1].running.distance + b[1].walking.distance + b[1].cycling.distance;
    return totalB - totalA;
  });

  for (const [charityId, totals] of sortedCharities) {
    console.log(`  {`);
    console.log(`    charityId: '${charityId}',`);
    console.log(`    running: { distance: ${totals.running.distance.toFixed(2)}, participantCount: ${totals.running.participants.size} },`);
    console.log(`    walking: { distance: ${totals.walking.distance.toFixed(2)}, participantCount: ${totals.walking.participants.size} },`);
    console.log(`    cycling: { distance: ${totals.cycling.distance.toFixed(2)}, participantCount: ${totals.cycling.participants.size} },`);
    console.log(`  },`);
  }

  console.log('];');
  console.log('');

  // Summary
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  CHARITY SUMMARY');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Total charities found: ${Object.keys(charityTotals).length}`);
  console.log('');

  for (const [charityId, totals] of sortedCharities) {
    const totalDistance = totals.running.distance + totals.walking.distance + totals.cycling.distance;
    const totalParticipants = new Set([
      ...totals.running.participants,
      ...totals.walking.participants,
      ...totals.cycling.participants,
    ]).size;

    console.log(`${charityId}:`);
    console.log(`  Total: ${totalDistance.toFixed(2)} km from ${totalParticipants} participants`);
    console.log(`  Running: ${totals.running.distance.toFixed(2)} km (${totals.running.participants.size} users)`);
    console.log(`  Walking: ${totals.walking.distance.toFixed(2)} km (${totals.walking.participants.size} users)`);
    console.log(`  Cycling: ${totals.cycling.distance.toFixed(2)} km (${totals.cycling.participants.size} users)`);
    console.log('');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
