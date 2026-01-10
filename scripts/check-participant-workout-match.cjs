const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  console.log('=== CHECKING PARTICIPANT <-> WORKOUT NPUB MATCH ===\n');

  // Get competition
  const { data: comp } = await supabase
    .from('competitions')
    .select('id')
    .eq('external_id', 'season2-running')
    .single();

  // Get participants
  const { data: participants } = await supabase
    .from('competition_participants')
    .select('npub')
    .eq('competition_id', comp.id);

  const participantNpubs = new Set(participants?.map(p => p.npub) || []);
  console.log('Participants in competition:', participantNpubs.size);

  // Get workouts
  const { data: workouts } = await supabase
    .from('workout_submissions')
    .select('npub, distance_meters')
    .eq('activity_type', 'running');

  const workoutNpubs = new Set(workouts?.map(w => w.npub) || []);
  console.log('Users with running workouts:', workoutNpubs.size);

  // Find workouts NOT in participants
  console.log('\n=== WORKOUT NPUBS NOT IN PARTICIPANTS ===');
  let notInParticipants = 0;
  for (const w of workouts || []) {
    if (!participantNpubs.has(w.npub)) {
      notInParticipants++;
      console.log(`  ❌ ${w.npub.slice(0, 30)}... (${(w.distance_meters / 1000).toFixed(2)}km)`);
    }
  }
  console.log(`Total: ${notInParticipants} workout npubs NOT in participants`);

  // Find workouts IN participants
  console.log('\n=== WORKOUT NPUBS IN PARTICIPANTS ===');
  let inParticipants = 0;
  for (const w of workouts || []) {
    if (participantNpubs.has(w.npub)) {
      inParticipants++;
      console.log(`  ✅ ${w.npub.slice(0, 30)}... (${(w.distance_meters / 1000).toFixed(2)}km)`);
    }
  }
  console.log(`Total: ${inParticipants} workout npubs IN participants`);

  // Sample of participants without workouts
  console.log('\n=== SAMPLE PARTICIPANTS WITHOUT WORKOUTS ===');
  let count = 0;
  for (const npub of participantNpubs) {
    if (!workoutNpubs.has(npub) && count < 5) {
      console.log(`  ${npub.slice(0, 40)}...`);
      count++;
    }
  }
}

check().catch(console.error);
