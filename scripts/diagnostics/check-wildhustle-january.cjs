/**
 * Check TheWildHustle's January 2026 workouts specifically
 */

const WebSocket = require('ws');

const WILDHUSTLE_PUBKEY = '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5';
const RELAY = 'wss://relay.damus.io';

// January 2026 only
const JAN_START = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);
const JAN_END = Math.floor(new Date('2026-01-31T23:59:59Z').getTime() / 1000);

async function fetchEvents() {
  return new Promise((resolve, reject) => {
    const events = [];
    const ws = new WebSocket(RELAY);
    const subId = 'wh-' + Math.random().toString(36).substring(7);

    const timeout = setTimeout(() => {
      ws.close();
      resolve(events);
    }, 15000);

    ws.on('open', () => {
      console.log(`Connected to ${RELAY}`);
      const filter = {
        kinds: [1301],
        authors: [WILDHUSTLE_PUBKEY],
        since: JAN_START,
        until: JAN_END,
      };
      console.log(`Filter: since=${new Date(JAN_START * 1000).toISOString()}, until=${new Date(JAN_END * 1000).toISOString()}`);
      ws.send(JSON.stringify(['REQ', subId, filter]));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg[0] === 'EVENT' && msg[1] === subId) {
          events.push(msg[2]);
        }
        if (msg[0] === 'EOSE') {
          clearTimeout(timeout);
          ws.close();
          resolve(events);
        }
      } catch (e) {}
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function main() {
  console.log('='.repeat(70));
  console.log('  THEWILDHUSTLE JANUARY 2026 WORKOUTS');
  console.log('='.repeat(70));
  console.log();

  const events = await fetchEvents();

  console.log(`\nTotal 1301 events in January 2026: ${events.length}\n`);
  console.log('='.repeat(70));

  // Sort by date
  events.sort((a, b) => a.created_at - b.created_at);

  let totalDistance = 0;

  for (const event of events) {
    const date = new Date(event.created_at * 1000).toISOString();

    // Parse tags
    let exercise = 'unknown';
    let distance = null;
    let distanceUnit = 'km';
    let duration = null;

    for (const tag of event.tags) {
      if (tag[0] === 'exercise') exercise = tag[1];
      if (tag[0] === 'distance') {
        distance = tag[1];
        distanceUnit = tag[2] || 'km';
      }
      if (tag[0] === 'duration') duration = tag[1];
    }

    console.log(`\n${'-'.repeat(70)}`);
    console.log(`Event ID: ${event.id}`);
    console.log(`Date: ${date}`);
    console.log(`Exercise: ${exercise}`);
    console.log(`Distance: ${distance} ${distanceUnit}`);
    console.log(`Duration: ${duration}`);
    console.log(`Content: ${event.content.substring(0, 100)}...`);
    console.log(`Raw distance tag:`, event.tags.find(t => t[0] === 'distance'));

    if (distance) {
      totalDistance += parseFloat(distance);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`TOTAL: ${events.length} workouts, ${totalDistance.toFixed(2)} km`);
  console.log('='.repeat(70));

  process.exit(0);
}

main();
