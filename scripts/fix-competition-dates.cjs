const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function fixDates() {
  console.log('Fixing competition dates from 2025 to 2026...\n');
  
  // Update dates
  const { data, error } = await supabase
    .from('competitions')
    .update({
      start_date: '2026-01-01T00:00:00Z',
      end_date: '2026-03-01T23:59:59Z'
    })
    .in('external_id', ['season2-running', 'season2-walking', 'season2-cycling'])
    .select();
  
  if (error) {
    console.error('Error updating dates:', error.message);
    return;
  }
  
  console.log('Updated competitions:', data?.length);
  data?.forEach(c => {
    console.log('  ' + c.external_id + ': ' + c.start_date + ' to ' + c.end_date);
  });
  
  // Verify workouts now in range
  console.log('\nVerifying workouts in new date range...');
  const { data: workouts, error: wErr } = await supabase
    .from('workout_submissions')
    .select('activity_type, distance_meters')
    .gte('created_at', '2026-01-01T00:00:00Z')
    .lte('created_at', '2026-03-01T23:59:59Z');
  
  if (wErr) {
    console.error('Error querying workouts:', wErr.message);
    return;
  }
  
  const byType = {};
  workouts?.forEach(w => {
    byType[w.activity_type] = (byType[w.activity_type] || 0) + 1;
  });
  
  console.log('Workouts now in range:', workouts?.length);
  console.log('By activity type:', byType);
}

fixDates();
