/**
 * Remove Suspicious Workouts from Season II Competition
 *
 * This script removes:
 * 1. Means' suspicious 48.86km walk (exact 12:00:00 duration, exact 13:00:00 timestamp)
 * 2. Helen's duplicate workouts (app double-publish bug)
 *
 * Removed workouts are copied to flagged_workouts table before deletion.
 *
 * Usage: node scripts/admin/remove-suspicious-workouts.cjs
 */

require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Means' suspicious workout
const MEANS_REMOVAL = {
  event_id: '8319a1c9c287995b437d5686832406575d7ac36b9d5f8112a5027a07e1d962fe',
  reason: 'Suspicious round numbers: exactly 12:00:00 duration at exactly 13:00:00 timestamp (48.86km walk)',
};

// Helen's duplicate workouts (keep oldest event_id per timestamp)
const HELEN_DUPLICATES = [
  '4deb5b28e50acaf3b8ea16964d5dca7361d8ef0432d1da36277b09c9c55f69c2',
  'd9995da573334140bb5567c7f0f0d03917861076cd1e5747567b63cc8fc8d14b',
  'cefe7b6e9c324de16babe9af83c9a6fae7604643447b8c9d0adafb3ca4c1c1f0',
  'ebb4a76957a2ccf9fbb50dead78b6db92d82fea2a8a5d7177e48e371c8d43168',
  'da2b1762766a8f518d2739b31df0fd48f9e1c2b16f48aaaf4f542d53e59c3671',
  '718d9d2e8d6126e1dc3b96b21e5cc6a2aefc202f1e1dcc19593873131697dc52',
  'b59bebf19ee9591fa196697e71a04424bbad8594f58a291ed24a92f0df2c2a8a',
  '5312db2d7de57c3408f02f1e014158b751be9646a8ee05a70e745f1c3267a975',
  'b120deeecd80cb0607facd6e205123579949609ae3046a899cffd5d07d3bf7f7',
  'c63cbb2a530b7d7261764b890bc2b3c6a7cbb07e5581168a2854aade4cd76855',
  '55d3b874bf2dbf4644e0245c995c46a6449a2166464057fca8d8bb4a7cb1b78f',
];

async function fetchWorkout(eventId) {
  const url = `${SUPABASE_URL}/rest/v1/workout_submissions?event_id=eq.${eventId}&select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  const data = await res.json();
  return data[0];
}

async function insertFlagged(workout, reason) {
  const url = `${SUPABASE_URL}/rest/v1/flagged_workouts`;
  const body = {
    npub: workout.npub,
    event_id: workout.event_id,
    activity_type: workout.activity_type,
    distance_meters: workout.distance_meters,
    duration_seconds: workout.duration_seconds,
    created_at: workout.created_at,
    reason: reason,
    raw_event: workout.raw_event,
    reviewed: true,
    reviewer_notes: `Removed by admin script on ${new Date().toISOString()}`,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(body),
  });

  return res.ok;
}

async function deleteWorkout(eventId) {
  const url = `${SUPABASE_URL}/rest/v1/workout_submissions?event_id=eq.${eventId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  return res.ok;
}

async function main() {
  console.log('='.repeat(60));
  console.log('  REMOVING SUSPICIOUS WORKOUTS');
  console.log('='.repeat(60));
  console.log();

  let removed = 0;
  let errors = 0;

  // Remove Means' suspicious workout
  console.log("--- MEANS' SUSPICIOUS WORKOUT ---");
  const meansWorkout = await fetchWorkout(MEANS_REMOVAL.event_id);
  if (meansWorkout) {
    console.log(`Found: ${meansWorkout.distance_meters / 1000} km, ${meansWorkout.duration_seconds / 3600}h`);

    // Copy to flagged_workouts
    const flagged = await insertFlagged(meansWorkout, MEANS_REMOVAL.reason);
    if (!flagged) {
      console.log('  Warning: Failed to copy to flagged_workouts');
    }

    // Delete from workout_submissions
    const deleted = await deleteWorkout(MEANS_REMOVAL.event_id);
    if (deleted) {
      console.log('  REMOVED successfully');
      removed++;
    } else {
      console.log('  ERROR: Failed to delete');
      errors++;
    }
  } else {
    console.log('  Not found (may have been removed already)');
  }

  // Remove Helen's duplicates
  console.log('\n--- HELEN DUPLICATES ---');
  for (const eventId of HELEN_DUPLICATES) {
    const workout = await fetchWorkout(eventId);
    if (workout) {
      const km = ((workout.distance_meters || 0) / 1000).toFixed(2);
      process.stdout.write(`  ${eventId.slice(0, 12)}... (${km} km) `);

      // Copy to flagged_workouts
      const flagged = await insertFlagged(workout, 'Duplicate workout (app double-publish bug)');

      // Delete from workout_submissions
      const deleted = await deleteWorkout(eventId);
      if (deleted) {
        console.log('REMOVED');
        removed++;
      } else {
        console.log('ERROR');
        errors++;
      }
    } else {
      console.log(`  ${eventId.slice(0, 12)}... NOT FOUND (already removed?)`);
    }
  }

  console.log();
  console.log('='.repeat(60));
  console.log(`  COMPLETE: ${removed} removed, ${errors} errors`);
  console.log('='.repeat(60));

  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
