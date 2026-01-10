const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function simulate() {
  console.log('=== SIMULATING getLeaderboard() ===\n');

  // Step 1: Get competition
  const { data: competition, error: compError } = await supabase
    .from('competitions')
    .select('*')
    .eq('external_id', 'season2-running')
    .single();

  if (compError) {
    console.error('Competition error:', compError);
    return;
  }

  console.log('Competition:', competition.external_id);
  console.log('  Activity type:', competition.activity_type);
  console.log('  Scoring method:', competition.scoring_method);
  console.log('  Date range:', competition.start_date, 'to', competition.end_date);

  // Step 2: Get participants
  const { data: participants, error: partError } = await supabase
    .from('competition_participants')
    .select('npub')
    .eq('competition_id', competition.id);

  if (partError) {
    console.error('Participants error:', partError);
    return;
  }

  const npubs = participants?.map(p => p.npub) || [];
  console.log('\nParticipants:', npubs.length);

  // Step 3: Query workouts (exactly as SupabaseCompetitionService does)
  console.log('\n=== WORKOUT QUERY ===');
  console.log('Query: .in("npub", npubs).eq("activity_type", "' + competition.activity_type + '")');
  console.log('       .gte("created_at", "' + competition.start_date + '")');
  console.log('       .lte("created_at", "' + competition.end_date + '")');

  const { data: workouts, error: workoutError } = await supabase
    .from('workout_submissions')
    .select('*')
    .in('npub', npubs)
    .eq('activity_type', competition.activity_type)
    .gte('created_at', competition.start_date)
    .lte('created_at', competition.end_date);

  if (workoutError) {
    console.error('Workouts error:', workoutError);
    return;
  }

  console.log('\nWorkouts found:', workouts?.length);

  // Step 4: Aggregate scores (exactly as SupabaseCompetitionService does)
  const scores = new Map();
  npubs.forEach(npub => scores.set(npub, { score: 0, workoutCount: 0 }));

  workouts?.forEach(w => {
    const current = scores.get(w.npub) || { score: 0, workoutCount: 0 };
    let scoreIncrement = 0;

    // For baseline rows, workout count is stored in raw_event.workout_count
    const rawEvent = w.raw_event;
    const rowWorkoutCount = rawEvent?.workout_count || 1;

    switch (competition.scoring_method) {
      case 'total_distance':
        scoreIncrement = w.distance_meters || 0;
        break;
      case 'total_duration':
        scoreIncrement = w.duration_seconds || 0;
        break;
      case 'workout_count':
        scoreIncrement = rowWorkoutCount;
        break;
    }

    scores.set(w.npub, {
      score: current.score + scoreIncrement,
      workoutCount: current.workoutCount + rowWorkoutCount,
    });
  });

  // Step 5: Sort and show results
  console.log('\n=== LEADERBOARD RESULTS ===');
  const leaderboard = Array.from(scores.entries())
    .map(([npub, data]) => ({
      npub,
      score: data.score,
      workoutCount: data.workoutCount,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  leaderboard.forEach((entry, i) => {
    const distanceKm = (entry.score / 1000).toFixed(2);
    console.log(`${i + 1}. ${entry.npub.slice(0, 25)}... : ${distanceKm}km (${entry.workoutCount} runs)`);
  });

  // Show users with 0 score
  const zeroScores = Array.from(scores.entries()).filter(([_, data]) => data.score === 0);
  console.log(`\nUsers with 0 score: ${zeroScores.length}`);
}

simulate().catch(console.error);
