const WebSocket = require('ws');

const CLEMSY_PUBKEY = '8ce975f57dd070c4293ff8f978b869e20b2cdf4c81f277b46f3676b262c5e823';
const SEASON_2_START = Math.floor(new Date('2025-01-06T00:00:00Z').getTime() / 1000);

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://e.nos.lol',
];

async function fetchFromRelay(relay) {
  return new Promise((resolve) => {
    const events = [];
    let ws;
    try {
      ws = new WebSocket(relay);
    } catch (e) {
      resolve([]);
      return;
    }

    const timeout = setTimeout(() => {
      try { ws.close(); } catch(e) {}
      resolve(events);
    }, 10000);

    ws.on('open', () => {
      const filter = { kinds: [1301], authors: [CLEMSY_PUBKEY], since: SEASON_2_START };
      ws.send(JSON.stringify(['REQ', 'clemsy', filter]));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg[0] === 'EVENT') events.push(msg[2]);
        if (msg[0] === 'EOSE') {
          clearTimeout(timeout);
          ws.close();
          resolve(events);
        }
      } catch (e) {}
    });

    ws.on('error', () => { clearTimeout(timeout); resolve(events); });
    ws.on('close', () => { clearTimeout(timeout); resolve(events); });
  });
}

async function main() {
  console.log('Searching for clemsy workouts across 7 relays...\n');
  console.log('Pubkey: ' + CLEMSY_PUBKEY);
  console.log('Since: ' + new Date(SEASON_2_START * 1000).toISOString() + '\n');

  const allEvents = [];
  for (const relay of RELAYS) {
    const events = await fetchFromRelay(relay);
    console.log(relay + ': ' + events.length + ' events');
    allEvents.push(...events);
  }

  // Dedupe
  const seen = new Set();
  const unique = allEvents.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });

  console.log('\nTotal unique events: ' + unique.length);

  if (unique.length > 0) {
    console.log('\nWorkouts found:');
    for (const e of unique) {
      const exercise = (e.tags.find(t => t[0] === 'exercise') || [])[1] || 'unknown';
      const distance = (e.tags.find(t => t[0] === 'distance') || [])[1] || '0';
      const unit = (e.tags.find(t => t[0] === 'distance') || [])[2] || '';
      const date = new Date(e.created_at * 1000).toISOString().split('T')[0];
      console.log('  - ' + date + ': ' + exercise + ' ' + distance + ' ' + unit);
    }
  }
}

main().then(() => process.exit(0));
