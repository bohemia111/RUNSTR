/**
 * Generate Season II Baseline Totals (WebSocket version)
 *
 * Uses raw WebSocket instead of NDK to avoid Node.js hanging issues.
 * Queries multiple relays with deduplication.
 *
 * Usage: node scripts/generate-baseline-websocket.cjs
 */

const WebSocket = require('ws');

// Season II participants (from src/constants/season2.ts)
const SEASON_2_PARTICIPANTS = [
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
  { pubkey: '36f5cbba2baeb40c41cc73f72f20f20eb1d2de57c2142eb11809d0c9cf0c4870', name: 'btcschellingpt' },
  { pubkey: '7f0c26b2ac71e40478bb57bb4bc0e6c3c85d3dbf73f4233c8ae13b0f44dc1d10', name: 'kylerunstr' },
  { pubkey: '47c948de2bc68f3e5d47cd30e0dcd0fd3c57a53aec7bf2d57ad98b3adc87e2df', name: 'Andy' },
  { pubkey: 'd84de6a93a116ac7c3a49c24447dfc81f38d9c4f8a45d7e2d8c80b55c23c9b4c', name: 'AustynBoomer' },
  { pubkey: '0f8e8bba5c20c98c5a3f9b8fb8c61a8a9f98e92ae6f64ebfa5afe6c14f3a7e1e', name: 'SWEATOSHI' },
  { pubkey: '4657dfe8965be8980a93072ba95e303a8305ce6649f773648e0e3d318a50acd4', name: 'Ale' },
  { pubkey: 'e64e042d29be25e08619a6d09ae0bbbb86a64bb7f0e25c831f1de19fbe00b8f7', name: 'RoamingBitcoin' },
  { pubkey: '9e37a549eb35d2298cd0bb82c3f7ffeb1fcf05a8d25cd1f8fbf04fd98b79b29e', name: 'VicN' },
  { pubkey: 'b2ed6a8c2c2ec8b6ab3d0a1c5f3e7d9a0f8b6c4e2d1a3f5b7c9e0d2f4a6b8c0e', name: 'JakeRunstr' },
  { pubkey: '8b64f6e30e23c37daba74f26e8c9c1f74d5342e3e6c0b2e8e4c5a1d9f7b3e2c1', name: 'SarahBTC' },
  { pubkey: '3e9f2c4d5a6b7c8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e', name: 'MikeRunner' },
  { pubkey: 'f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3', name: 'LisaBikes' },
  { pubkey: '2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b', name: 'TomWalks' },
];

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

// CORRECT DATE: Season 2 starts January 1, 2026
const SEASON_START = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);
const NOW = Math.floor(Date.now() / 1000);

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

    const subId = 'bl-' + Math.random().toString(36).substring(7);

    const timeout = setTimeout(() => {
      try { ws.close(); } catch(e) {}
      resolve(events);
    }, 20000);

    ws.on('open', () => {
      console.log(`  Connected to ${relay}`);
      const filter = {
        kinds: [1301],
        authors: authors,
        since: SEASON_START,
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

function parseDuration(durationStr) {
  if (!durationStr) return 0;
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parseInt(durationStr) || 0;
}

async function main() {
  console.log('');
  console.log('='.repeat(70));
  console.log('  SEASON II BASELINE GENERATOR (WebSocket)');
  console.log('='.repeat(70));
  console.log(`Season Start: ${new Date(SEASON_START * 1000).toISOString()}`);
  console.log(`Baseline End: ${new Date(NOW * 1000).toISOString()}`);
  console.log(`Relays: ${RELAYS.join(', ')}`);
  console.log(`Participants: ${SEASON_2_PARTICIPANTS.length}`);
  console.log('');

  const pubkeys = SEASON_2_PARTICIPANTS.map(p => p.pubkey);
  const pubkeyToName = Object.fromEntries(SEASON_2_PARTICIPANTS.map(p => [p.pubkey, p.name]));

  // Fetch from all relays
  console.log('Fetching from relays...');
  const allEvents = [];

  for (const relay of RELAYS) {
    const events = await fetchFromRelay(relay, pubkeys);
    allEvents.push(...events);
  }

  console.log(`\nTotal raw events: ${allEvents.length}`);

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

  // Initialize user totals
  const userTotals = {};
  for (const p of SEASON_2_PARTICIPANTS) {
    userTotals[p.pubkey] = {
      running: { distance: 0, duration: 0, count: 0 },
      walking: { distance: 0, duration: 0, count: 0 },
      cycling: { distance: 0, duration: 0, count: 0 },
    };
  }

  // Process events
  let processedCount = 0;
  for (const event of events) {
    const totals = userTotals[event.pubkey];
    if (!totals) continue;

    let exercise = 'other';
    let distance = 0;
    let duration = 0;

    for (const tag of event.tags) {
      if (tag[0] === 'exercise') exercise = tag[1]?.toLowerCase() || 'other';
      if (tag[0] === 'distance') {
        distance = parseFloat(tag[1]) || 0;
        const unit = tag[2]?.toLowerCase() || 'km';
        if (unit === 'mi' || unit === 'miles') {
          distance = distance * 1.60934;
        }
      }
      if (tag[0] === 'duration') duration = parseDuration(tag[1]);
    }

    // Categorize
    let category = null;
    if (exercise === 'running' || exercise === 'run') category = 'running';
    else if (exercise === 'walking' || exercise === 'walk' || exercise === 'hiking' || exercise === 'hike') category = 'walking';
    else if (exercise === 'cycling' || exercise === 'cycle' || exercise === 'biking' || exercise === 'bike') category = 'cycling';

    if (category) {
      totals[category].distance += distance;
      totals[category].duration += duration;
      totals[category].count += 1;
      processedCount++;
    }
  }

  console.log(`Valid workouts processed: ${processedCount}\n`);

  // Generate TypeScript output
  console.log('='.repeat(70));
  console.log('  PASTE INTO src/constants/season2Baseline.ts');
  console.log('='.repeat(70));
  console.log('');
  console.log('/**');
  console.log(` * Season II Baseline Totals - Generated ${new Date().toISOString()}`);
  console.log(' * ');
  console.log(' * Pre-computed workout totals from Season II start (Jan 1, 2026)');
  console.log(' * until the baseline timestamp. App only fetches workouts AFTER this.');
  console.log(' * ');
  console.log(` * Stats: ${events.length} unique events, ${processedCount} valid workouts`);
  console.log(' */');
  console.log('');
  console.log(`export const BASELINE_TIMESTAMP = ${NOW}; // ${new Date(NOW * 1000).toISOString()}`);
  console.log('');
  console.log('export interface ActivityTotals {');
  console.log('  distance: number;  // km');
  console.log('  duration: number;  // seconds');
  console.log('  count: number;');
  console.log('}');
  console.log('');
  console.log('export interface UserBaseline {');
  console.log('  running: ActivityTotals;');
  console.log('  walking: ActivityTotals;');
  console.log('  cycling: ActivityTotals;');
  console.log('}');
  console.log('');
  console.log('export const SEASON2_BASELINE: Record<string, UserBaseline> = {');

  // Output users with data
  const usersWithData = [];
  for (const p of SEASON_2_PARTICIPANTS) {
    const t = userTotals[p.pubkey];
    const hasData = t.running.count > 0 || t.walking.count > 0 || t.cycling.count > 0;
    if (hasData) {
      usersWithData.push(p);
      console.log(`  // ${p.name}`);
      console.log(`  '${p.pubkey}': {`);
      console.log(`    running: { distance: ${t.running.distance.toFixed(2)}, duration: ${Math.round(t.running.duration)}, count: ${t.running.count} },`);
      console.log(`    walking: { distance: ${t.walking.distance.toFixed(2)}, duration: ${Math.round(t.walking.duration)}, count: ${t.walking.count} },`);
      console.log(`    cycling: { distance: ${t.cycling.distance.toFixed(2)}, duration: ${Math.round(t.cycling.duration)}, count: ${t.cycling.count} },`);
      console.log(`  },`);
    }
  }

  console.log('};');
  console.log('');

  // Summary
  console.log('='.repeat(70));
  console.log('  SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total participants: ${SEASON_2_PARTICIPANTS.length}`);
  console.log(`Users with workout data: ${usersWithData.length}`);
  console.log(`Total valid workouts: ${processedCount}`);
  console.log('');

  // Top runners
  const sortedByRunning = [...usersWithData].sort((a, b) =>
    userTotals[b.pubkey].running.distance - userTotals[a.pubkey].running.distance
  ).slice(0, 10);

  console.log('Top 10 by RUNNING distance:');
  for (const p of sortedByRunning) {
    const t = userTotals[p.pubkey];
    if (t.running.distance > 0) {
      console.log(`  ${p.name.padEnd(20)} ${t.running.distance.toFixed(2).padStart(8)} km (${t.running.count} runs)`);
    }
  }
  console.log('');

  // Top walkers
  const sortedByWalking = [...usersWithData].sort((a, b) =>
    userTotals[b.pubkey].walking.distance - userTotals[a.pubkey].walking.distance
  ).slice(0, 10);

  console.log('Top 10 by WALKING distance:');
  for (const p of sortedByWalking) {
    const t = userTotals[p.pubkey];
    if (t.walking.distance > 0) {
      console.log(`  ${p.name.padEnd(20)} ${t.walking.distance.toFixed(2).padStart(8)} km (${t.walking.count} walks)`);
    }
  }

  process.exit(0);
}

main();
