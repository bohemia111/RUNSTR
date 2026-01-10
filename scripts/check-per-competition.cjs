const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  // Get all competitions
  const { data: comps } = await supabase.from('competitions').select('id, external_id, activity_type');
  console.log('=== COMPETITIONS ===');
  comps.forEach(c => console.log(c.external_id, '→', c.id));
  
  // Count participants per competition
  console.log('\n=== PARTICIPANTS PER COMPETITION ===');
  for (const comp of comps) {
    const { data: participants } = await supabase
      .from('competition_participants')
      .select('npub')
      .eq('competition_id', comp.id);
    console.log(comp.external_id + ':', participants?.length, 'participants');
  }
  
  // Count workouts per activity type in date range
  console.log('\n=== WORKOUTS IN DATE RANGE (Jan 1 - Mar 1, 2025) ===');
  const { data: workouts } = await supabase
    .from('workout_submissions')
    .select('npub, activity_type, distance_meters')
    .gte('created_at', '2025-01-01T00:00:00Z')
    .lte('created_at', '2025-03-01T23:59:59Z');
  
  const byType = {};
  workouts?.forEach(w => {
    byType[w.activity_type] = byType[w.activity_type] || { count: 0, withDistance: 0 };
    byType[w.activity_type].count++;
    if (w.distance_meters > 0) byType[w.activity_type].withDistance++;
  });
  Object.entries(byType).forEach(([type, data]) => {
    console.log(type + ':', data.count, 'workouts,', data.withDistance, 'with distance > 0');
  });
  
  // Show sample of 0-distance entries
  console.log('\n=== ZERO DISTANCE ENTRIES ===');
  const { data: zeros } = await supabase
    .from('workout_submissions')
    .select('npub, activity_type, distance_meters, event_id')
    .or('distance_meters.is.null,distance_meters.eq.0')
    .limit(5);
  zeros?.forEach(z => console.log('  ' + z.activity_type + ': event=' + z.event_id?.slice(0,20) + '...'));
}
check();
