require('dotenv').config({ path: '/Users/dakotabrown/runstr.project/.env' });

const CLEMSY_NPUB = 'npub13n5htata6pcvg2fllruh3wrfug9jeh6vs8e80dr0xemtyck9aq3sfhp723';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function main() {
  const queryUrl = `${SUPABASE_URL}/rest/v1/workout_submissions?npub=eq.${CLEMSY_NPUB}&order=created_at.desc&select=activity_type,distance_meters,duration_seconds,created_at`;

  const response = await fetch(queryUrl, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });

  const workouts = await response.json();

  console.log('=== CLEMSY WORKOUTS IN DATABASE ===\n');
  console.log(`Found ${workouts.length} workouts:\n`);

  const byType = { running: [], walking: [], cycling: [], other: [] };

  for (const w of workouts) {
    const type = w.activity_type || 'other';
    if (!byType[type]) byType[type] = [];
    byType[type].push(w);

    const date = w.created_at.split('T')[0];
    const km = ((w.distance_meters || 0) / 1000).toFixed(2);
    console.log(`  ${date}: ${type.toUpperCase().padEnd(8)} ${km} km`);
  }

  console.log('\n--- Summary ---');
  console.log(`Running: ${byType.running.length} workouts`);
  console.log(`Walking: ${byType.walking.length} workouts`);
  console.log(`Cycling: ${byType.cycling.length} workouts`);
  console.log(`Other:   ${byType.other.length} workouts`);
}

main().catch(console.error);
