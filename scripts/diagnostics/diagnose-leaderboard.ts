#!/usr/bin/env tsx
/**
 * Diagnose Leaderboard - Comprehensive workout query and leaderboard calculation
 *
 * Purpose: Query kind 1301 events directly from Nostr and calculate what
 * the leaderboards SHOULD show, to help debug any discrepancies with the app.
 *
 * Usage: npx tsx scripts/diagnostics/diagnose-leaderboard.ts
 */

import NDK, { NDKFilter, NDKEvent } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

// Distance thresholds (same as app)
const DISTANCE_THRESHOLDS_KM = {
  '5k': 5,
  '10k': 10,
  'half': 21,
  'marathon': 42,
};

interface ParsedWorkout {
  id: string;
  pubkey: string;
  activityType: string;
  distance?: number; // meters
  duration?: number; // seconds
  createdAt: number;
  teamId?: string;
  splits: Map<number, number>; // km -> elapsed time in seconds
  rawTags: string[][];
}

interface LeaderboardEntry {
  rank: number;
  pubkey: string;
  profileName?: string;
  distanceKm: number;
  durationSeconds: number;
  formattedTime: string;
  workoutId: string;
}

let ndk: NDK;
const profileCache = new Map<string, string>();

async function main() {
  console.log('🔍 RUNSTR Leaderboard Diagnostics');
  console.log('==================================\n');
  console.log(`📅 Current time: ${new Date().toISOString()}`);
  console.log(`📅 Today's date (local): ${new Date().toLocaleDateString()}\n`);

  // Initialize NDK
  console.log('🌐 Connecting to Nostr relays...');
  ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });

  await ndk.connect();

  // Wait for connections
  await new Promise(resolve => setTimeout(resolve, 2000));

  const connectedRelays = ndk.pool.connectedRelays();
  console.log(`   ✅ Connected to ${connectedRelays.length} relays:`);
  connectedRelays.forEach(relay => {
    console.log(`      - ${relay.url}`);
  });
  console.log();

  // Get today's date range
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const todayTimestamp = Math.floor(todayMidnight.getTime() / 1000);

  // Also query last 2 days for context (matches app's fetch window)
  const twoDaysAgo = Math.floor((Date.now() - 2 * 24 * 60 * 60 * 1000) / 1000);

  console.log('📊 Query Parameters:');
  console.log(`   Today starts at: ${new Date(todayTimestamp * 1000).toISOString()}`);
  console.log(`   Two days ago: ${new Date(twoDaysAgo * 1000).toISOString()}`);
  console.log();

  // Query all kind 1301 events from last 2 days (global - no author filter)
  const filter: NDKFilter = {
    kinds: [1301 as any],
    since: twoDaysAgo,
    limit: 500,
  };

  console.log('📡 Fetching kind 1301 workout events (last 2 days)...\n');

  const events = await fetchWithTimeout(filter, 10000);
  const eventsArray = Array.from(events).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

  console.log(`✅ Found ${eventsArray.length} total workout events\n`);

  // Parse all workouts
  const allWorkouts: ParsedWorkout[] = [];
  const parseErrors: { id: string; error: string }[] = [];

  for (const event of eventsArray) {
    const workout = parseWorkoutEvent(event);
    if (workout) {
      allWorkouts.push(workout);
    } else {
      parseErrors.push({ id: event.id.slice(0, 8), error: 'Failed to parse' });
    }
  }

  console.log(`📋 Parsed ${allWorkouts.length} workouts (${parseErrors.length} parse errors)\n`);

  // Separate today's workouts
  const todaysWorkouts = allWorkouts.filter(w => w.createdAt >= todayTimestamp);
  console.log(`📅 Today's workouts: ${todaysWorkouts.length}\n`);

  // Count by activity type
  const byActivityType = new Map<string, number>();
  for (const w of todaysWorkouts) {
    byActivityType.set(w.activityType, (byActivityType.get(w.activityType) || 0) + 1);
  }

  console.log('📊 Today\'s workouts by activity type:');
  for (const [type, count] of byActivityType.entries()) {
    console.log(`   ${type}: ${count}`);
  }
  console.log();

  // Fetch profile names for unique pubkeys
  const uniquePubkeys = [...new Set(todaysWorkouts.map(w => w.pubkey))];
  console.log(`👥 Fetching profiles for ${uniquePubkeys.length} unique users...\n`);
  await fetchProfiles(uniquePubkeys);

  // Show ALL today's workouts with details
  console.log('============================================================');
  console.log("📋 ALL TODAY'S WORKOUTS (sorted by time, newest first)");
  console.log('============================================================\n');

  for (let i = 0; i < todaysWorkouts.length; i++) {
    const w = todaysWorkouts[i];
    const profileName = profileCache.get(w.pubkey) || `${w.pubkey.slice(0, 8)}...`;
    const distanceKm = w.distance ? (w.distance / 1000).toFixed(2) : 'N/A';
    const duration = w.duration ? formatDuration(w.duration) : 'N/A';
    const time = new Date(w.createdAt * 1000).toLocaleTimeString();

    console.log(`${i + 1}. [${time}] ${profileName}`);
    console.log(`   Type: ${w.activityType.toUpperCase()}`);
    console.log(`   Distance: ${distanceKm} km`);
    console.log(`   Duration: ${duration}`);
    console.log(`   Splits: ${w.splits.size} km markers`);
    console.log(`   Team: ${w.teamId || 'none'}`);
    console.log(`   Event ID: ${w.id.slice(0, 16)}...`);
    console.log();
  }

  // Now calculate leaderboards (RUNNING ONLY, same as app)
  console.log('============================================================');
  console.log('🏆 CALCULATED LEADERBOARDS (Running only, >= distance threshold)');
  console.log('============================================================\n');

  const runningWorkouts = todaysWorkouts.filter(w => w.activityType.toLowerCase() === 'running');
  console.log(`🏃 Running workouts today: ${runningWorkouts.length}\n`);

  // Show running workouts that QUALIFY for leaderboards
  console.log('--- Running workouts with distance data ---');
  for (const w of runningWorkouts) {
    const profileName = profileCache.get(w.pubkey) || `${w.pubkey.slice(0, 8)}...`;
    const distanceKm = w.distance ? (w.distance / 1000).toFixed(2) : 'N/A';
    const duration = w.duration ? formatDuration(w.duration) : 'N/A';
    const qualifies5k = w.distance && w.distance >= 5000;
    const qualifies10k = w.distance && w.distance >= 10000;
    const qualifiesHalf = w.distance && w.distance >= 21000;
    const qualifiesMarathon = w.distance && w.distance >= 42000;

    console.log(`• ${profileName}: ${distanceKm}km in ${duration}`);
    console.log(`  Qualifies: 5K=${qualifies5k ? '✅' : '❌'} 10K=${qualifies10k ? '✅' : '❌'} Half=${qualifiesHalf ? '✅' : '❌'} Marathon=${qualifiesMarathon ? '✅' : '❌'}`);
    if (w.splits.size > 0) {
      console.log(`  Splits: ${Array.from(w.splits.entries()).map(([km, t]) => `km${km}=${formatDuration(t)}`).join(', ')}`);
    }
    console.log();
  }

  // Calculate each leaderboard
  for (const [category, thresholdKm] of Object.entries(DISTANCE_THRESHOLDS_KM)) {
    const leaderboard = calculateLeaderboard(runningWorkouts, thresholdKm);

    console.log(`\n🏆 ${category.toUpperCase()} LEADERBOARD (>= ${thresholdKm}km)`);
    console.log('─'.repeat(50));

    if (leaderboard.length === 0) {
      console.log('   (No qualifying runners today)');
    } else {
      for (const entry of leaderboard) {
        const profileName = profileCache.get(entry.pubkey) || `${entry.pubkey.slice(0, 8)}...`;
        const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;
        console.log(`   ${medal} ${profileName}: ${entry.formattedTime} (${entry.distanceKm.toFixed(2)}km)`);
      }
    }
  }

  console.log('\n============================================================');
  console.log('📊 SUMMARY');
  console.log('============================================================\n');

  console.log(`Total workouts fetched (2 days): ${allWorkouts.length}`);
  console.log(`Today's workouts: ${todaysWorkouts.length}`);
  console.log(`Today's RUNNING workouts: ${runningWorkouts.length}`);

  for (const [category, thresholdKm] of Object.entries(DISTANCE_THRESHOLDS_KM)) {
    const count = runningWorkouts.filter(w => w.distance && w.distance >= thresholdKm * 1000).length;
    console.log(`Runners qualifying for ${category}: ${count}`);
  }

  console.log('\n✅ Diagnostics complete\n');
  process.exit(0);
}

async function fetchWithTimeout(filter: NDKFilter, timeoutMs: number): Promise<Set<NDKEvent>> {
  return new Promise((resolve) => {
    const collectedEvents = new Set<NDKEvent>();
    let eoseReceived = false;

    const subscription = ndk.subscribe(filter, {
      closeOnEose: false,
    });

    subscription.on('event', (event: NDKEvent) => {
      collectedEvents.add(event);
    });

    subscription.on('eose', () => {
      eoseReceived = true;
    });

    // Check every 100ms if EOSE received
    const checkInterval = setInterval(() => {
      if (eoseReceived) {
        clearInterval(checkInterval);
        subscription.stop();
        resolve(collectedEvents);
      }
    }, 100);

    // Hard timeout
    setTimeout(() => {
      clearInterval(checkInterval);
      subscription.stop();
      if (!eoseReceived) {
        console.log(`   ⚠️ Timeout before EOSE - collected ${collectedEvents.size} events`);
      }
      resolve(collectedEvents);
    }, timeoutMs);
  });
}

function parseWorkoutEvent(event: NDKEvent): ParsedWorkout | null {
  try {
    const tags = new Map<string, string[]>();
    for (const tag of event.tags) {
      if (tag.length >= 2) {
        tags.set(tag[0], tag.slice(1));
      }
    }

    // Extract activity type
    const exerciseTag = tags.get('exercise');
    const typeTag = tags.get('type');
    let activityType = exerciseTag?.[0] || typeTag?.[0] || 'other';
    activityType = activityType.toLowerCase();

    // Must have activity type
    if (!exerciseTag && !typeTag) {
      if (event.content) {
        const contentLower = event.content.toLowerCase();
        if (contentLower.includes('running') || contentLower.includes('run')) {
          activityType = 'running';
        } else if (contentLower.includes('cycling') || contentLower.includes('bike')) {
          activityType = 'cycling';
        } else if (contentLower.includes('walking')) {
          activityType = 'walking';
        } else {
          return null;
        }
      } else {
        return null;
      }
    }

    // Extract distance (convert to meters)
    let distance: number | undefined;
    const distanceTag = tags.get('distance');
    if (distanceTag) {
      const value = parseFloat(distanceTag[0]);
      const unit = distanceTag[1]?.toLowerCase() || 'km';
      if (!isNaN(value)) {
        if (unit === 'mi' || unit === 'miles') {
          distance = value * 1609.34;
        } else if (unit === 'km' || unit === 'kilometers') {
          distance = value * 1000;
        } else if (unit === 'm' || unit === 'meters') {
          distance = value;
        } else {
          distance = value * 1000; // Assume km
        }
      }
    }

    // Extract duration (convert to seconds)
    let duration: number | undefined;
    const durationTag = tags.get('duration');
    if (durationTag) {
      const value = durationTag[0];
      if (value.includes(':')) {
        const parts = value.split(':').map(Number);
        if (parts.length === 3) {
          duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
          duration = parts[0] * 60 + parts[1];
        }
      } else {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          duration = numValue;
        }
      }
    }

    // Extract team ID
    const teamTag = tags.get('team');
    const teamId = teamTag?.[0];

    // Parse split data
    const splits = new Map<number, number>();
    const splitTags = event.tags.filter((t: string[]) => t[0] === 'split');
    for (const splitTag of splitTags) {
      if (splitTag.length >= 3) {
        const km = parseInt(splitTag[1]);
        const timeStr = splitTag[2];
        const parts = timeStr.split(':').map(Number);
        let elapsedTime = 0;
        if (parts.length === 3) {
          elapsedTime = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
          elapsedTime = parts[0] * 60 + parts[1];
        }
        if (!isNaN(km) && elapsedTime > 0) {
          splits.set(km, elapsedTime);
        }
      }
    }

    return {
      id: event.id,
      pubkey: event.pubkey,
      activityType,
      distance,
      duration,
      createdAt: event.created_at || Math.floor(Date.now() / 1000),
      teamId,
      splits,
      rawTags: event.tags,
    };
  } catch (error) {
    return null;
  }
}

async function fetchProfiles(pubkeys: string[]): Promise<void> {
  if (pubkeys.length === 0) return;

  const filter: NDKFilter = {
    kinds: [0],
    authors: pubkeys,
  };

  try {
    const events = await ndk.fetchEvents(filter);
    for (const event of events) {
      try {
        const profile = JSON.parse(event.content);
        const name = profile.display_name || profile.displayName || profile.name || profile.username;
        if (name) {
          profileCache.set(event.pubkey, name);
        }
      } catch {
        // Ignore parse errors
      }
    }
  } catch (error) {
    console.log('   ⚠️ Failed to fetch some profiles');
  }
}

function calculateLeaderboard(
  workouts: ParsedWorkout[],
  thresholdKm: number
): LeaderboardEntry[] {
  const thresholdMeters = thresholdKm * 1000;

  // Filter eligible workouts (running + distance >= threshold)
  const eligible = workouts.filter(w => {
    const isRunning = w.activityType.toLowerCase() === 'running';
    const meetsDistance = w.distance && w.distance >= thresholdMeters;
    return isRunning && meetsDistance;
  });

  if (eligible.length === 0) return [];

  // Group by user and find best time
  const userBestTimes = new Map<string, { workout: ParsedWorkout; time: number }>();

  for (const workout of eligible) {
    const targetTime = extractTargetDistanceTime(workout, thresholdKm);

    const existing = userBestTimes.get(workout.pubkey);
    if (!existing || targetTime < existing.time) {
      userBestTimes.set(workout.pubkey, { workout, time: targetTime });
    }
  }

  // Convert to entries and sort
  const entries: LeaderboardEntry[] = [];
  for (const [pubkey, data] of userBestTimes) {
    entries.push({
      rank: 0,
      pubkey,
      distanceKm: data.workout.distance! / 1000,
      durationSeconds: data.time,
      formattedTime: formatDuration(data.time),
      workoutId: data.workout.id,
    });
  }

  // Sort by time (fastest first)
  entries.sort((a, b) => a.durationSeconds - b.durationSeconds);

  // Assign ranks
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
}

function extractTargetDistanceTime(workout: ParsedWorkout, targetKm: number): number {
  // If splits exist, try to use them
  if (workout.splits.size > 0) {
    // Exact split match
    const exactSplit = workout.splits.get(targetKm);
    if (exactSplit) {
      return exactSplit;
    }

    // Find closest split <= target
    let closestKm = 0;
    let closestTime = 0;
    for (const [km, time] of workout.splits.entries()) {
      if (km <= targetKm && km > closestKm) {
        closestKm = km;
        closestTime = time;
      }
    }

    if (closestTime > 0) {
      return closestTime;
    }
  }

  // Fallback: estimate from average pace
  if (workout.distance && workout.distance > 0 && workout.duration) {
    const distanceKm = workout.distance / 1000;
    const avgPacePerKm = workout.duration / distanceKm;
    return Math.round(avgPacePerKm * targetKm);
  }

  return workout.duration || 0;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

main().catch((error) => {
  console.error('❌ Script error:', error);
  process.exit(1);
});
