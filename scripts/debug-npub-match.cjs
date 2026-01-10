const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function debug() {
  console.log('=== DEBUGGING NPUB STRING MATCHING ===\n');

  // Get competition
  const { data: comp } = await supabase
    .from('competitions')
    .select('id')
    .eq('external_id', 'season2-running')
    .single();

  // Get first workout npub
  const { data: workouts } = await supabase
    .from('workout_submissions')
    .select('npub')
    .eq('activity_type', 'running')
    .limit(3);

  // Get participant npubs that should match
  const { data: participants } = await supabase
    .from('competition_participants')
    .select('npub')
    .eq('competition_id', comp.id);

  const workoutNpub1 = workouts[0].npub;
  console.log('Workout npub 1:');
  console.log(`  Value: "${workoutNpub1}"`);
  console.log(`  Length: ${workoutNpub1.length}`);
  console.log(`  Char codes (first 10): ${[...workoutNpub1.slice(0, 10)].map(c => c.charCodeAt(0)).join(',')}`);

  // Find matching participant
  const match = participants?.find(p => p.npub.startsWith(workoutNpub1.slice(0, 30)));
  if (match) {
    console.log('\nMatching participant npub:');
    console.log(`  Value: "${match.npub}"`);
    console.log(`  Length: ${match.npub.length}`);
    console.log(`  Char codes (first 10): ${[...match.npub.slice(0, 10)].map(c => c.charCodeAt(0)).join(',')}`);
    console.log(`\n  Exact match: ${workoutNpub1 === match.npub}`);
    console.log(`  Trimmed match: ${workoutNpub1.trim() === match.npub.trim()}`);

    // Character by character comparison
    if (workoutNpub1 !== match.npub) {
      console.log('\n  First difference at:');
      for (let i = 0; i < Math.max(workoutNpub1.length, match.npub.length); i++) {
        if (workoutNpub1[i] !== match.npub[i]) {
          console.log(`    Position ${i}: workout="${workoutNpub1[i]}" (${workoutNpub1.charCodeAt(i)}) vs participant="${match.npub[i]}" (${match.npub?.charCodeAt(i)})`);
          break;
        }
      }
    }
  } else {
    console.log('\nNo matching participant found!');
    console.log('First 5 participant npubs:');
    participants?.slice(0, 5).forEach(p => {
      console.log(`  "${p.npub}" (len: ${p.npub.length})`);
    });
  }
}

debug().catch(console.error);
