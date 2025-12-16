import NDK from '@nostr-dev-kit/ndk';

async function checkMidnightRunParticipants() {
  const ndk = new NDK({
    explicitRelayUrls: [
      'wss://relay.damus.io',
      'wss://nos.lol', 
      'wss://relay.nostr.band'
    ]
  });
  
  await ndk.connect();
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('\n=== Searching for Midnight Run Event ===\n');
  
  const eventFilter = {
    kinds: [31923],
    '#t': ['runstr'],
    limit: 50
  };
  
  const events = await ndk.fetchEvents(eventFilter);
  console.log('Found', events.size, 'calendar events');
  
  let midnightRunEvent = null;
  for (const event of events) {
    const title = event.tags.find(t => t[0] === 'title')?.[1] || '';
    const dTag = event.tags.find(t => t[0] === 'd')?.[1] || '';
    console.log(' -', title, '(d-tag:', dTag + ')');
    if (title.toLowerCase().includes('midnight')) {
      midnightRunEvent = event;
    }
  }
  
  if (!midnightRunEvent) {
    console.log('\nMidnight Run event not found');
    process.exit(1);
  }
  
  const eventDTag = midnightRunEvent.tags.find(t => t[0] === 'd')?.[1];
  const eventPubkey = midnightRunEvent.pubkey;
  const title = midnightRunEvent.tags.find(t => t[0] === 'title')?.[1];
  
  console.log('\n✅ Found Midnight Run Event:');
  console.log('  Title:', title);
  console.log('  d-tag:', eventDTag);
  console.log('  pubkey:', eventPubkey);
  
  console.log('\n=== Querying RSVPs ===\n');
  
  // Query by d-tag
  const rsvpFilter1 = {
    kinds: [31925],
    '#d': ['rsvp-' + eventDTag],
    limit: 100
  };
  console.log('Query 1 (#d tag):', JSON.stringify(rsvpFilter1));
  const rsvps1 = await ndk.fetchEvents(rsvpFilter1);
  console.log('RSVPs found via #d tag:', rsvps1.size);
  
  // Query by a-tag
  const eventRef = '31923:' + eventPubkey + ':' + eventDTag;
  const rsvpFilter2 = {
    kinds: [31925],
    '#a': [eventRef],
    limit: 100
  };
  console.log('\nQuery 2 (#a tag):', JSON.stringify(rsvpFilter2));
  const rsvps2 = await ndk.fetchEvents(rsvpFilter2);
  console.log('RSVPs found via #a tag:', rsvps2.size);
  
  // Combine and dedupe
  const allRsvps = new Map();
  for (const rsvp of [...rsvps1, ...rsvps2]) {
    allRsvps.set(rsvp.pubkey, rsvp);
  }
  
  console.log('\n=== UNIQUE PARTICIPANTS ===');
  console.log('Total unique RSVPs:', allRsvps.size);
  
  let idx = 1;
  for (const [pubkey, rsvp] of allRsvps) {
    const status = rsvp.tags.find(t => t[0] === 'status')?.[1] || 'accepted';
    const dTag = rsvp.tags.find(t => t[0] === 'd')?.[1] || '';
    console.log('\nParticipant ' + idx + ':');
    console.log('  pubkey:', pubkey);
    console.log('  status:', status);
    console.log('  d-tag:', dTag);
    console.log('  created_at:', new Date(rsvp.created_at * 1000).toISOString());
    idx++;
  }
  
  process.exit(0);
}

checkMidnightRunParticipants().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
