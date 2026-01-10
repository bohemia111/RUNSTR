/**
 * Diagnostic script to check workout submissions for specific users
 * Usage: node scripts/diagnostics/check-user-workouts.cjs
 */

require('dotenv').config();
const https = require('https');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Users to investigate
const USERS = {
  'Helen Yrmom': 'npub1u53hqga9czffu7hqu5fg6sdgyycnssqwcygdh6wc52f83u3t0sfstpnzt7',
  'means': 'npub1ltvqkaz3kqlksm7eujrmqkmfcpxgpr3x58dk2hjeur3fdfwf7nws8szhw6'
};

async function fetchWorkouts(npub) {
  const url = `${SUPABASE_URL}/rest/v1/workout_submissions?npub=eq.${npub}&order=created_at.desc`;

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDistance(meters) {
  if (!meters) return '0 km';
  return `${(meters / 1000).toFixed(2)} km`;
}

function calculatePace(distanceMeters, durationSeconds) {
  if (!distanceMeters || !durationSeconds || distanceMeters === 0) return 'N/A';
  const paceSecsPerKm = durationSeconds / (distanceMeters / 1000);
  const paceMin = Math.floor(paceSecsPerKm / 60);
  const paceSec = Math.round(paceSecsPerKm % 60);
  return `${paceMin}:${String(paceSec).padStart(2, '0')}/km`;
}

async function investigate() {
  console.log('=== Workout Investigation ===\n');

  for (const [name, npub] of Object.entries(USERS)) {
    console.log(`\n--- ${name} (${npub.slice(0, 20)}...) ---\n`);

    const workouts = await fetchWorkouts(npub);

    if (workouts.error) {
      console.log('Error:', workouts.error);
      continue;
    }

    console.log(`Total workouts: ${workouts.length}\n`);

    // Check for duplicates by looking at same activity_type + similar timestamps
    const potentialDuplicates = new Map();

    workouts.forEach((w, i) => {
      // Create key for potential duplicate detection
      const key = `${w.activity_type}-${w.distance_meters}-${w.duration_seconds}`;
      if (!potentialDuplicates.has(key)) {
        potentialDuplicates.set(key, []);
      }
      potentialDuplicates.get(key).push(w);

      // Print workout details
      const pace = calculatePace(w.distance_meters, w.duration_seconds);
      const flags = [];

      // Flag unusually long durations
      if (w.duration_seconds > 18000) { // > 5 hours
        flags.push('⚠️ VERY LONG');
      }

      // Flag round numbers (potential manual entry)
      if (w.distance_meters && w.distance_meters % 1000 === 0) {
        flags.push('🔢 ROUND KM');
      }
      if (w.duration_seconds && w.duration_seconds % 3600 === 0) {
        flags.push('🔢 EXACT HOURS');
      }

      console.log(`${i + 1}. ${w.activity_type}`);
      console.log(`   Event ID: ${w.event_id.slice(0, 16)}...`);
      console.log(`   Distance: ${formatDistance(w.distance_meters)}`);
      console.log(`   Duration: ${formatDuration(w.duration_seconds)}`);
      console.log(`   Pace: ${pace}`);
      console.log(`   Created: ${w.created_at}`);
      console.log(`   Source: ${w.source || 'unknown'}`);
      if (flags.length) {
        console.log(`   Flags: ${flags.join(', ')}`);
      }
      console.log();
    });

    // Report potential duplicates
    console.log('--- Potential Duplicates ---');
    let hasDuplicates = false;
    for (const [key, items] of potentialDuplicates.entries()) {
      if (items.length > 1) {
        hasDuplicates = true;
        console.log(`\n⚠️ ${items.length} workouts with same data: ${key}`);
        items.forEach((w) => {
          console.log(`   - ${w.event_id.slice(0, 16)}... at ${w.created_at}`);
        });
      }
    }
    if (!hasDuplicates) {
      console.log('No obvious duplicates found based on distance/duration.');
    }
  }
}

investigate().catch(console.error);
