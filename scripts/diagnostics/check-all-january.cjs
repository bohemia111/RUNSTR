/**
 * Check ALL participants' January 2026 workouts
 */

const WebSocket = require('ws');

const PARTICIPANTS = [
  { pubkey: '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5', name: 'TheWildHustle' },
  { pubkey: '745eb529d0e42d2fa6c904bbc2c10702deae964b4dd3079803ab8b43536dda12', name: 'guy' },
  { pubkey: 'dae73fdd90d98db1a8405bcecac60cd6ce8d10896a6a2c5e04011125e16cd432', name: 'Lhasa Sensei' },
  { pubkey: '43256bc0859462cf14fa7de594a48babdf189b91abe27f88d824abf69b2343c9', name: 'LOPES' },
  { pubkey: 'e7df627c638d934b37548d8408b43dc5d4762fa270c26abec5916bff62aac80d', name: 'KjetilR' },
  { pubkey: '9358c67695d9e78bde2bf3ce1eb0a5059553687632a177e7d25deeff9f2912fc', name: 'Kamo Weasel' },
  { pubkey: '6b42a3b227b086e850ff659a151863ce070eb60d32bae8a4618928655effc3f6', name: 'JokerHasse' },
  { pubkey: '0c252c138ee446b6f9c0964ff609380fc82e52c8d318529607f293fcdf828bea', name: 'Busch21' },
  { pubkey: 'c8b22b81877eaa54e1ab21e39824f85a29e61f71da9fbabbef8930b171b98da8', name: 'Hoov' },
  { pubkey: '8ce975f57dd070c4293ff8f978b869e20b2cdf4c81f277b46f3676b262c5e823', name: 'clemsy' },
  { pubkey: '9fce3aea32b35637838fb45b75be32595742e16bb3e4742cc82bb3d50f9087e6', name: 'MAKE SONGS LONGER' },
  { pubkey: 'e5237023a5c0929e7ae0e5128d41a8213138400ec110dbe9d8a29278f22b7c13', name: 'Helen Yrmom' },
  { pubkey: '02734f19cae7850e7bca6c0a2bb6a534f152d5acbd86eece1d2bfbd5d6502003', name: 'bitcoin_rene' },
  { pubkey: '5a654b6394bb83ecc1b95f848d6bc44e6d21120de5d832040704d9823b2c0af4', name: 'Drew' },
  { pubkey: '5d405752c1b4ddd0714baf3ce415db52e5506036f345ff575ee16e2b4cf189bf', name: 'Heiunter' },
  { pubkey: 'a80fc4a78634ee26aabcac951b4cfd7b56ae18babd33c5afdcf6bed6dc80ebd1', name: 'Uno' },
  { pubkey: 'a723805cda67251191c8786f4da58f797e6977582301354ba8e91bcb0342dc9c', name: 'Seth' },
  { pubkey: 'fad80b7451b03f686fd9e487b05b69c04c808e26a1db655e59e0e296a5c9f4dd', name: 'means' },
  { pubkey: '20d29810d6a5f92b045ade02ebbadc9036d741cc686b00415c42b4236fe4ad2f', name: 'negr0' },
  { pubkey: 'ea28488b659ab6433167cd024eb72e01a375ac17ce54a1cdc6e5dce2f6d93923', name: 'johnny9' },
  { pubkey: 'c6f0f4279f12200f77e1943cd26aaedf6081fda8585695f9a923b4723686da12', name: 'Tumbleweed' },
  { pubkey: '661305095522a18a1095b7b86874ef618da9c5d1ba5f4af375688e2129c07317', name: 'Ajax' },
  { pubkey: '0f563fe2cfdf180cb104586b95873379a0c1fdcfbc301a80c8255f33d15f039d', name: 'Patrick' },
  { pubkey: 'd84517802a434757c56ae8642bffb4d26e5ade0712053750215680f5896e579b', name: 'ObjectiF MooN' },
  { pubkey: '81b91540daeee031df309460a9bcf5866a54c70217ff173bcdefd1982f12b0ba', name: 'Aaron Tomac' },
  { pubkey: '7ebbce1843a17cd778a5e169e3d2f679f5ac7b5125d1c43d265e190f7b27538c', name: 'Adrien Lacombe' },
  { pubkey: '86f7eea066dd4dc574d01b0f9317a03508887f815fb58d8ef66873cc42fe3431', name: 'Taljarn' },
  { pubkey: '0418ca2d6cd6c7fbc4e0391bb745027023a7edbc38f2a60fc3b68f006efb85eb', name: 'saiy2k' },
  { pubkey: '556329e4245ec4889c33b29262c85335a082c2e25cd08b69ff46e17e70b785ec', name: 'OrangePillosophy' },
  { pubkey: '24b45900a92fbc4527ccf975bd416988e444c6e4d9f364c5158667f077623fe2', name: 'Jose Sammut' },
];

const RELAY = 'wss://relay.damus.io';

// January 2026 only
const JAN_START = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);
const NOW = Math.floor(Date.now() / 1000);

async function fetchEvents(authors) {
  return new Promise((resolve, reject) => {
    const events = [];
    const ws = new WebSocket(RELAY);
    const subId = 'jan-' + Math.random().toString(36).substring(7);

    const timeout = setTimeout(() => {
      ws.close();
      resolve(events);
    }, 30000);

    ws.on('open', () => {
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
  console.log('  JANUARY 2026 WORKOUTS (Season 2)');
  console.log('='.repeat(70));
  console.log(`Since: ${new Date(JAN_START * 1000).toISOString()}`);
  console.log();

  const pubkeys = PARTICIPANTS.map(p => p.pubkey);
  const pubkeyToName = Object.fromEntries(PARTICIPANTS.map(p => [p.pubkey, p.name]));

  console.log('Fetching from relay.damus.io...');
  const rawEvents = await fetchEvents(pubkeys);
  console.log(`Raw events received: ${rawEvents.length}`);

  // Deduplicate by event ID
  const seenIds = new Set();
  const events = [];
  for (const event of rawEvents) {
    if (!seenIds.has(event.id)) {
      seenIds.add(event.id);
      events.push(event);
    }
  }
  console.log(`After deduplication: ${events.length}\n`);

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

  // Print results sorted by running distance
  const sorted = Object.entries(userStats)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.running.distance - a.running.distance);

  console.log('='.repeat(70));
  console.log('  CORRECT JANUARY 2026 TOTALS');
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

  // Totals
  let totalRun = 0, totalWalk = 0, totalCycle = 0;
  for (const user of sorted) {
    totalRun += user.running.distance;
    totalWalk += user.walking.distance;
    totalCycle += user.cycling.distance;
  }

  console.log('-'.repeat(70));
  console.log(`${'TOTAL'.padEnd(20)} | ${totalRun.toFixed(2).padStart(10)}    | ${totalWalk.toFixed(2).padStart(10)}    | ${totalCycle.toFixed(2).padStart(10)}`);

  process.exit(0);
}

main();
