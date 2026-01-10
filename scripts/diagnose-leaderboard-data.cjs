const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function diagnose() {
  console.log('=== DIAGNOSING SEASON II LEADERBOARD DATA ===\n');

  // 1. Get competition details
  const { data: comp } = await supabase
    .from('competitions')
    .select('*')
    .eq('external_id', 'season2-running')
    .single();

  console.log('COMPETITION:', comp?.external_id);
  console.log('  Activity Type:', comp?.activity_type);
  console.log('  Date Range:', comp?.start_date, 'to', comp?.end_date);
  console.log('  Scoring Method:', comp?.scoring_method);

  // 2. Get participants for this competition
  const { data: participants } = await supabase
    .from('competition_participants')
    .select('npub')
    .eq('competition_id', comp?.id);

  console.log('\nPARTICIPANTS:', participants?.length);

  // 3. Get ALL workout submissions (no date filter)
  const npubs = participants?.map(p => p.npub) || [];
  const { data: allWorkouts } = await supabase
    .from('workout_submissions')
    .select('npub, activity_type, distance_meters, created_at, raw_event')
    .in('npub', npubs)
    .eq('activity_type', 'running');

  console.log('\nALL RUNNING WORKOUTS (no date filter):', allWorkouts?.length);

  // 4. Check date ranges of workouts
  if (allWorkouts?.length > 0) {
    const dates = allWorkouts.map(w => new Date(w.created_at));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    console.log('  Earliest workout:', minDate.toISOString());
    console.log('  Latest workout:', maxDate.toISOString());
  }

  // 5. Get workouts IN the competition date range
  const { data: inRangeWorkouts } = await supabase
    .from('workout_submissions')
    .select('npub, activity_type, distance_meters, created_at')
    .in('npub', npubs)
    .eq('activity_type', 'running')
    .gte('created_at', comp?.start_date)
    .lte('created_at', comp?.end_date);

  console.log('\nWORKOUTS IN DATE RANGE:', inRangeWorkouts?.length);

  // 6. Show who has data vs who doesn't
  const withData = new Set(inRangeWorkouts?.map(w => w.npub) || []);
  const withoutData = npubs.filter(npub => !withData.has(npub));

  console.log('\nUSERS WITH WORKOUT DATA IN RANGE:', withData.size);
  console.log('USERS WITHOUT WORKOUT DATA:', withoutData.length);

  // 7. Sample of workout data
  console.log('\n=== SAMPLE WORKOUTS IN RANGE ===');
  inRangeWorkouts?.slice(0, 5).forEach(w => {
    console.log(`  ${w.npub.slice(0, 20)}... : ${w.distance_meters}m on ${w.created_at}`);
  });

  // 8. Sample of workouts NOT in range
  console.log('\n=== SAMPLE WORKOUTS OUTSIDE RANGE ===');
  const outsideRange = allWorkouts?.filter(w => !inRangeWorkouts?.some(ir => ir.npub === w.npub && ir.created_at === w.created_at));
  outsideRange?.slice(0, 5).forEach(w => {
    console.log(`  ${w.npub.slice(0, 20)}... : ${w.distance_meters}m on ${w.created_at}`);
  });

  // 9. Check if the issue is activity_type mismatch
  console.log('\n=== ALL ACTIVITY TYPES IN workout_submissions ===');
  const { data: allTypes } = await supabase
    .from('workout_submissions')
    .select('activity_type')
    .in('npub', npubs);

  const typeCounts = {};
  allTypes?.forEach(w => {
    typeCounts[w.activity_type] = (typeCounts[w.activity_type] || 0) + 1;
  });
  Object.entries(typeCounts).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
}

diagnose().catch(console.error);
