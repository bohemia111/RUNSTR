import NDK from '@nostr-dev-kit/ndk';

async function checkWorkouts() {
  const ndk = new NDK({
    explicitRelayUrls: [
      'wss://relay.damus.io',
      'wss://nos.lol', 
      'wss://relay.nostr.band'
    ]
  });
  
  await ndk.connect();
  await new Promise(r => setTimeout(r, 3000));
  
  // Event details from previous query
  const eventStart = new Date('2025-12-14T00:00:00Z').getTime() / 1000;
  const eventEnd = new Date('2025-12-31T23:59:59Z').getTime() / 1000;
  
  const participants = [
    { name: 'Participant 1', pubkey: 'f993b4d99ee1cc11638fbba23ddccef5ed991dffa5b7d5e1a8ddde8f6552f697' },
    { name: 'Participant 2 (Creator)', pubkey: '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5' }
  ];
  
  console.log('\n=== Checking Workouts for Midnight Run Participants ===');
  console.log('Event timeframe:', new Date(eventStart * 1000).toISOString(), 'to', new Date(eventEnd * 1000).toISOString());
  
  for (const participant of participants) {
    console.log('\n---', participant.name, '---');
    console.log('Pubkey:', participant.pubkey);
    
    // Query kind 1301 workouts
    const workoutFilter = {
      kinds: [1301],
      authors: [participant.pubkey],
      since: Math.floor(eventStart),
      until: Math.floor(eventEnd),
      limit: 50
    };
    
    console.log('Query filter:', JSON.stringify(workoutFilter));
    
    const workouts = await ndk.fetchEvents(workoutFilter);
    console.log('Workouts found:', workouts.size);
    
    for (const workout of workouts) {
      const exerciseTag = workout.tags.find(t => t[0] === 'exercise')?.[1] || 'unknown';
      const distanceTag = workout.tags.find(t => t[0] === 'distance');
      const durationTag = workout.tags.find(t => t[0] === 'duration');
      
      console.log('  Workout:', {
        exercise: exerciseTag,
        distance: distanceTag ? distanceTag[1] + ' ' + (distanceTag[2] || '') : 'N/A',
        duration: durationTag?.[1] || 'N/A',
        created_at: new Date(workout.created_at * 1000).toISOString()
      });
    }
    
    if (workouts.size === 0) {
      console.log('  ⚠️ NO WORKOUTS FOUND - This is why they are not on leaderboard!');
    }
  }
  
  process.exit(0);
}

checkWorkouts().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
