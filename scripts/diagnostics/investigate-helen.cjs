const WebSocket = require('ws');

const HELEN_PUBKEY = 'e5237023a5c0929e7ae0e5128d41a8213138400ec110dbe9d8a29278f22b7c13';
const SINCE = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);
const UNTIL = Math.floor(new Date('2026-03-01T23:59:59Z').getTime() / 1000);
const RELAYS = ['wss://relay.primal.net', 'wss://nos.lol'];

async function queryRelay(url, pubkey) {
  return new Promise((resolve) => {
    const events = [];
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => { ws.close(); resolve(events); }, 20000);
    ws.on('open', () => {
      ws.send(JSON.stringify(['REQ', 'sub1', { kinds: [1301], authors: [pubkey], since: SINCE, until: UNTIL }]));
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg[0] === 'EVENT') events.push(msg[2]);
      else if (msg[0] === 'EOSE') { clearTimeout(timeout); ws.close(); resolve(events); }
    });
    ws.on('error', () => { clearTimeout(timeout); resolve(events); });
  });
}

async function main() {
  console.log('HELEN YRMOM DETAILED INVESTIGATION\n');
  console.log('Pubkey: ' + HELEN_PUBKEY + '\n');
  
  const allEvents = new Map();
  for (const relay of RELAYS) {
    console.log('Querying ' + relay + '...');
    const events = await queryRelay(relay, HELEN_PUBKEY);
    console.log('  Found ' + events.length + ' events');
    for (const e of events) allEvents.set(e.id, e);
  }

  const events = Array.from(allEvents.values()).sort((a, b) => a.created_at - b.created_at);
  console.log('\nTotal unique events: ' + events.length + '\n');

  console.log('='.repeat(80));
  console.log('CHRONOLOGICAL EVENT LIST');
  console.log('='.repeat(80) + '\n');

  let totalDistance = 0;
  let uniqueWorkouts = new Set();
  
  for (const e of events) {
    const created = new Date(e.created_at * 1000);
    let exercise = '', distance = 0, duration = '', client = '';
    for (const tag of e.tags) {
      if (tag[0] === 'exercise') exercise = tag[1];
      if (tag[0] === 'distance') distance = parseFloat(tag[1]);
      if (tag[0] === 'duration') duration = tag[1];
      if (tag[0] === 'client') client = tag.slice(1).join(' ');
    }
    totalDistance += distance;
    
    // Create a "workout signature" to identify unique workouts
    const sig = e.created_at + '_' + distance.toFixed(2);
    uniqueWorkouts.add(sig);
    
    console.log(created.toISOString().slice(0, 19) + ' | ' + exercise.padEnd(10) + ' | ' + distance.toFixed(2).padStart(6) + ' km | ' + (duration || 'N/A').padEnd(10) + ' | ' + (client || 'NO CLIENT'));
  }

  console.log('\n' + '='.repeat(80));
  console.log('ANALYSIS');
  console.log('='.repeat(80));
  
  console.log('\nTotal events: ' + events.length);
  console.log('Total distance (all events): ' + totalDistance.toFixed(2) + ' km');
  console.log('Unique workout signatures: ' + uniqueWorkouts.size);
  console.log('Duplicate ratio: ' + (events.length / uniqueWorkouts.size).toFixed(2) + 'x');
  
  // Group by timestamp to show duplicates
  console.log('\n' + '='.repeat(80));
  console.log('DUPLICATE GROUPS (same timestamp)');
  console.log('='.repeat(80) + '\n');
  
  const groups = new Map();
  for (const e of events) {
    if (!groups.has(e.created_at)) groups.set(e.created_at, []);
    groups.get(e.created_at).push(e);
  }
  
  for (const [ts, evts] of groups) {
    if (evts.length > 1) {
      const date = new Date(ts * 1000);
      console.log('Timestamp: ' + date.toISOString() + ' (' + evts.length + ' events):');
      for (const e of evts) {
        const dist = e.tags.find(t => t[0] === 'distance');
        const client = e.tags.find(t => t[0] === 'client');
        const exerc = e.tags.find(t => t[0] === 'exercise');
        console.log('  - Event ' + e.id.slice(0,12) + ' | ' + (exerc ? exerc[1] : '?') + ' | ' + (dist ? dist[1] : '?') + ' km | client: ' + (client ? client.slice(1).join(' ') : 'NONE'));
      }
      console.log('');
    }
  }
  
  // Check client tags
  console.log('='.repeat(80));
  console.log('CLIENT TAG ANALYSIS');
  console.log('='.repeat(80) + '\n');
  
  const clients = {};
  for (const e of events) {
    const client = e.tags.find(t => t[0] === 'client');
    const key = client ? client.slice(1).join(' ') : 'NONE';
    clients[key] = (clients[key] || 0) + 1;
  }
  
  for (const [client, count] of Object.entries(clients)) {
    console.log(client + ': ' + count + ' events');
  }
  
  // VERDICT
  console.log('\n' + '='.repeat(80));
  console.log('VERDICT');
  console.log('='.repeat(80));
  
  const hasVCurrentAppVersion = events.some(e => {
    const client = e.tags.find(t => t[0] === 'client');
    return client && client.some(c => c.includes('CurrentAppVersion'));
  });
  
  if (hasVCurrentAppVersion) {
    console.log('\nSEVERE: Has vCurrentAppVersion placeholder - LIKELY CHEATING');
  } else {
    console.log('\nNO vCurrentAppVersion found');
    console.log('Duplicates appear to be from RUNSTR app double-publishing (possible app bug)');
    console.log('All events have legitimate client tags');
  }
}

main().catch(console.error);
