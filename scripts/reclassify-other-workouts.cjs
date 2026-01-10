/**
 * Reclassify "other" type workouts in Supabase
 *
 * This one-time migration script:
 * 1. Queries all workouts with activity_type = 'other'
 * 2. Calculates their pace from distance and duration
 * 3. Reclassifies them as 'running' or 'walking' based on pace thresholds
 *
 * Pace thresholds (same as Edge Function):
 * - Running: < 8 min/km (480 sec/km)
 * - Walking: > 12 min/km (720 sec/km)
 * - Ambiguous: 8-12 min/km → default to 'running' if distance >= 1km
 */

require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Pace thresholds (seconds per km)
const RUNNING_THRESHOLD = 480;  // 8:00/km
const WALKING_THRESHOLD = 720;  // 12:00/km

function classifyByPace(distanceMeters, durationSeconds) {
  const distanceKm = distanceMeters / 1000;

  // Can't classify without both
  if (!distanceKm || distanceKm <= 0 || !durationSeconds || durationSeconds <= 0) {
    return null;
  }

  const paceSecondsPerKm = durationSeconds / distanceKm;

  if (paceSecondsPerKm < RUNNING_THRESHOLD) {
    return 'running';
  }

  if (paceSecondsPerKm > WALKING_THRESHOLD) {
    return 'walking';
  }

  // Ambiguous: 8-12 min/km - default to running if significant distance
  if (distanceKm >= 1) {
    return 'running';
  }

  return null; // Can't classify
}

async function main() {
  console.log('='.repeat(60));
  console.log('  RECLASSIFYING "OTHER" WORKOUTS');
  console.log('='.repeat(60));
  console.log();

  // Query all "other" type workouts
  const queryUrl = `${SUPABASE_URL}/rest/v1/workout_submissions?activity_type=eq.other&select=id,npub,activity_type,distance_meters,duration_seconds,created_at`;

  console.log('Fetching "other" type workouts...');

  const response = await fetch(queryUrl, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    console.error('Query failed:', response.status, await response.text());
    process.exit(1);
  }

  const workouts = await response.json();
  console.log(`Found ${workouts.length} "other" type workouts\n`);

  if (workouts.length === 0) {
    console.log('Nothing to reclassify!');
    process.exit(0);
  }

  // Analyze and classify
  const updates = {
    running: [],
    walking: [],
    unchanged: [],
  };

  for (const workout of workouts) {
    const newType = classifyByPace(workout.distance_meters, workout.duration_seconds);

    if (newType) {
      updates[newType].push(workout);
    } else {
      updates.unchanged.push(workout);
    }
  }

  console.log('Classification results:');
  console.log(`  → Running: ${updates.running.length}`);
  console.log(`  → Walking: ${updates.walking.length}`);
  console.log(`  → Unchanged (can't classify): ${updates.unchanged.length}`);
  console.log();

  // Perform updates
  let successCount = 0;
  let errorCount = 0;

  for (const type of ['running', 'walking']) {
    for (const workout of updates[type]) {
      const updateUrl = `${SUPABASE_URL}/rest/v1/workout_submissions?id=eq.${workout.id}`;

      try {
        const updateResponse = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ activity_type: type }),
        });

        if (updateResponse.ok) {
          successCount++;
          const distKm = ((workout.distance_meters || 0) / 1000).toFixed(2);
          const pace = workout.distance_meters && workout.duration_seconds
            ? (workout.duration_seconds / (workout.distance_meters / 1000) / 60).toFixed(1)
            : 'N/A';
          console.log(`  ✓ ${workout.id.substring(0, 8)}... → ${type.toUpperCase()} (${distKm} km, ${pace} min/km)`);
        } else {
          errorCount++;
          console.log(`  ✗ ${workout.id.substring(0, 8)}... - Update failed: ${updateResponse.status}`);
        }
      } catch (err) {
        errorCount++;
        console.log(`  ✗ ${workout.id.substring(0, 8)}... - Error: ${err.message}`);
      }
    }
  }

  console.log();
  console.log('='.repeat(60));
  console.log(`  COMPLETE: ${successCount} updated, ${errorCount} errors, ${updates.unchanged.length} unchanged`);
  console.log('='.repeat(60));

  process.exit(0);
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
