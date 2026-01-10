/**
 * Check January 2026 workouts from MULTIPLE relays with deduplication
 */

const WebSocket = require('ws');

const PARTICIPANTS = [
  { pubkey: '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5', name: 'TheWildHustle' },
  { pubkey: '745eb529d0e42d2fa6c904bbc2c10702deae964b4dd3079803ab8b43536dda12', name: 'guy' },
  { pubkey: 'dae73fdd90d98db1a8405bcecac60cd6ce8d10896a6a2c5e04011125e16cd432', name: 'Lhasa Sensei' },
  { pubkey: '43256bc0859462cf14fa7de594a48babdf189b91abe27f88d824abf69b2343c9', name: 'LOPES' },
  { pubkey: 'e7df627c638d934b37548d8408b43dc5d4762fa270c26abec5916bff62aac80d', name: 'KjetilR' },
  { pubkey: '6b42a3b227b086e850ff659a151863ce070eb60d32bae8a4618928655effc3f6', name: 'JokerHasse' },
  { pubkey: 'ea28488b659ab6433167cd024eb72e01a375ac17ce54a1cdc6e5dce2f6d93923', name: 'johnny9' },
  { pubkey: '5d405752c1b4ddd0714baf3ce415db52e5506036f345ff575ee16e2b4cf189bf', name: 'Heiunter' },
  { pubkey: '7ebbce1843a17cd778a5e169e3d2f679f5ac7b5125d1c43d265e190f7b27538c', name: 'Adrien Lacombe' },
  { pubkey: 'fad80b7451b03f686fd9e487b05b69c04c808e26a1db655e59e0e296a5c9f4dd', name: 'means' },
  { pubkey: 'e5237023a5c0929e7ae0e5128d41a8213138400ec110dbe9d8a29278f22b7c13', name: 'Helen Yrmom' },
  { pubkey: '02734f19cae7850e7bca6c0a2bb6a534f152d5acbd86eece1d2bfbd5d6502003', name: 'bitcoin_rene' },
  { pubkey: '0418ca2d6cd6c7fbc4e0391bb745027023a7edbc38f2a60fc3b68f006efb85eb', name: 'saiy2k' },
  { pubkey: '86f7eea066dd4dc574d01b0f9317a03508887f815fb58d8ef66873cc42fe3431', name: 'Taljarn' },
  { pubkey: 'c6f0f4279f12200f77e1943cd26aaedf6081fda8585695f9a923b4723686da12', name: 'Tumbleweed' },
];

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
];

const JAN_START = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);

async function fetchFromRelay(relay, authors) {
  return new Promise((resolve) => {
    const events = [];
    let ws;

    try {
      ws = new WebSocket(relay);
    } catch (e) {
      console.log(`  Failed to connect to ${relay}`);
      resolve([]);
      return;
    }

    const subId = 'mr-' + Math.random().toString(36).substring(7);

    const timeout = setTimeout(() => {
      try { ws.close(); } catch(e) {}
      resolve(events);
    }, 15000);

    ws.on('open', () => {
      console.log(`  Connected to ${relay}`);
      const filter = {
        kinds: [1301],
        authors: authors,
        since: JAN_START,
      };
      ws.send(JSON.stringify(['REQ', subId, filter]));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg[0] === 'EVENT' && msg[1] === subId) {
          events.push(msg[2]);
        }
        if (msg[0] === 'EOSE') {
          console.log(`  ${relay}: ${events.length} events`);
          clearTimeout(timeout);
          ws.close();
          resolve(events);
        }
      } catch (e) {}
    });

    ws.on('error', (err) => {
      console.log(`  ${relay}: error - ${err.message}`);
      clearTimeout(timeout);
      resolve(events);
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      resolve(events);
    });
  });
}

async function main() {
  console.log('='.repeat(70));
  console.log('  MULTI-RELAY JANUARY 2026 CHECK (with deduplication)');
  console.log('='.repeat(70));
  console.log(`Since: ${new Date(JAN_START * 1000).toISOString()}`);
  console.log(`Relays: ${RELAYS.join(', ')}`);
  console.log();

  const pubkeys = PARTICIPANTS.map(p => p.pubkey);
  const pubkeyToName = Object.fromEntries(PARTICIPANTS.map(p => [p.pubkey, p.name]));

  // Fetch from all relays
  console.log('Fetching from relays...');
  const allEvents = [];

  for (const relay of RELAYS) {
    const events = await fetchFromRelay(relay, pubkeys);
    allEvents.push(...events);
  }

  console.log(`\nTotal raw events from all relays: ${allEvents.length}`);

  // Deduplicate by event ID
  const seenIds = new Set();
  const events = [];
  for (const event of allEvents) {
    if (!seenIds.has(event.id)) {
      seenIds.add(event.id);
      events.push(event);
    }
  }
  console.log(`After deduplication: ${events.length}`);
  console.log(`Duplicates removed: ${allEvents.length - events.length}\n`);

  // Group by user
  const userStats = {};

  for (const event of events) {
    const userName = pubkeyToName[event.pubkey] || event.pubkey.substring(0, 8);

    if (!userStats[userName]) {
      userStats[userName] = {
        running: { count: 0, distance: 0 },
        walking: { count: 0, distance: 0 },
        cycling: { count: 0, distance: 0 },
      };
    }

    let exercise = 'other';
    let distance = 0;

    for (const tag of event.tags) {
      if (tag[0] === 'exercise') exercise = tag[1];
      if (tag[0] === 'distance') distance = parseFloat(tag[1]) || 0;
    }

    if (['running', 'walking', 'cycling'].includes(exercise)) {
      userStats[userName][exercise].count++;
      userStats[userName][exercise].distance += distance;
    }
  }

  // Print results
  const sorted = Object.entries(userStats)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.running.distance - a.running.distance);

  console.log('='.repeat(70));
  console.log('  DEDUPLICATED TOTALS (3 relays)');
  console.log('='.repeat(70));
  console.log();
  console.log('User                  | Running (km) | Walking (km) | Cycling (km)');
  console.log('-'.repeat(70));

  for (const user of sorted) {
    const name = user.name.padEnd(20);
    const run = user.running.distance.toFixed(2).padStart(10);
    const walk = user.walking.distance.toFixed(2).padStart(10);
    const cycle = user.cycling.distance.toFixed(2).padStart(10);
    console.log(`${name} | ${run} (${user.running.count}) | ${walk} (${user.walking.count}) | ${cycle} (${user.cycling.count})`);
  }

  let totalRun = 0, totalWalk = 0;
  for (const user of sorted) {
    totalRun += user.running.distance;
    totalWalk += user.walking.distance;
  }
  console.log('-'.repeat(70));
  console.log(`${'TOTAL'.padEnd(20)} | ${totalRun.toFixed(2).padStart(10)}    | ${totalWalk.toFixed(2).padStart(10)}`);

  process.exit(0);
}

main();
