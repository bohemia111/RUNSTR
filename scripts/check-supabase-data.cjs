const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data: participants } = await supabase
    .from('competition_participants')
    .select('npub, competition_id');
  console.log('=== PARTICIPANTS ===');
  console.log('Total:', participants?.length);
  
  const { data: workouts } = await supabase
    .from('workout_submissions')
    .select('npub, activity_type, distance_meters')
    .order('distance_meters', { ascending: false });
  console.log('\n=== WORKOUTS ===');
  console.log('Total:', workouts?.length);
  
  const byType = {};
  workouts?.forEach(w => {
    byType[w.activity_type] = (byType[w.activity_type] || 0) + 1;
  });
  console.log('By type:', byType);
  
  console.log('\nTop 5 distances:');
  workouts?.slice(0, 5).forEach((w, i) => {
    console.log('  ' + (i+1) + '. ' + w.activity_type + ': ' + (w.distance_meters/1000).toFixed(2) + ' km');
  });
  
  const zeros = workouts?.filter(w => !w.distance_meters).length;
  console.log('\nZero/null:', zeros);
}
check();
