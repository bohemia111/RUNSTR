/**
 * Analyze "other" type workouts to identify runs vs walks
 *
 * Apple Health and Health Connect imports often use "other" as exercise type.
 * This script analyzes pace to determine likely activity type:
 * - Running: pace < 8 min/km (faster than 7.5 km/h)
 * - Walking: pace >= 8 min/km (slower than 7.5 km/h)
 */

const WebSocket = require('ws');

// Season II participants (subset for testing)
const PARTICIPANTS = [
  { pubkey: '8ce975f57dd070c4293ff8f978b869e20b2cdf4c81f277b46f3676b262c5e823', name: 'clemsy' },
  { pubkey: '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5', name: 'TheWildHustle' },
  { pubkey: '745eb529d0e42d2fa6c904bbc2c10702deae964b4dd3079803ab8b43536dda12', name: 'guy' },
  { pubkey: 'dae73fdd90d98db1a8405bcecac60cd6ce8d10896a6a2c5e04011125e16cd432', name: 'Lhasa Sensei' },
  { pubkey: '43256bc0859462cf14fa7de594a48babdf189b91abe27f88d824abf69b2343c9', name: 'LOPES' },
  { pubkey: 'e7df627c638d934b37548d8408b43dc5d4762fa270c26abec5916bff62aac80d', name: 'KjetilR' },
  { pubkey: '9358c67695d9e78bde2bf3ce1eb0a5059553687632a177e7d25deeff9f2912fc', name: 'Kamo Weasel' },
  { pubkey: 'c9943d8f8e9c2aa9facb6e579af6ec38b7205c0570de1b0fb8f99f65dc5f786e', name: 'Zed' },
  { pubkey: '6b42a3b227b086e850ff659a151863ce070eb60d32bae8a4618928655effc3f6', name: 'JokerHasse' },
  { pubkey: '0c252c138ee446b6f9c0964ff609380fc82e52c8d318529607f293fcdf828bea', name: 'Busch21' },
  { pubkey: 'c8b22b81877eaa54e1ab21e39824f85a29e61f71da9fbabbef8930b171b98da8', name: 'Hoov' },
  { pubkey: '9fce3aea32b35637838fb45b75be32595742e16bb3e4742cc82bb3d50f9087e6', name: 'MAKE SONGS LONGER' },
  { pubkey: 'e5237023a5c0929e7ae0e5128d41a8213138400ec110dbe9d8a29278f22b7c13', name: 'Helen Yrmom' },
  { pubkey: '02734f19cae7850e7bca6c0a2bb6a534f152d5acbd86eece1d2bfbd5d6502003', name: 'bitcoin_rene' },
  { pubkey: '939ffb4e552ed5c0fa780985ab7163f441798409ae7ed81c62c07ac4683b4222', name: 'Johan' },
  { pubkey: '5a654b6394bb83ecc1b95f848d6bc44e6d21120de5d832040704d9823b2c0af4', name: 'Drew' },
  { pubkey: '5d405752c1b4ddd0714baf3ce415db52e5506036f345ff575ee16e2b4cf189bf', name: 'Heiunter' },
  { pubkey: '14ca97caaea1565dc3f8415db52e5506036f345ff575ee16e2b4cf189bf', name: 'Satty' },
  { pubkey: 'de7ab932ca17278b2144a6628c3531a0628fcc7b58074111d6e5b949ecb0e377', name: 'Harambe' },
  { pubkey: 'a80fc4a78634ee26aabcac951b4cfd7b56ae18babd33c5afdcf6bed6dc80ebd1', name: 'Uno' },
];

// Season II start: January 1, 2026
const SEASON_2_START = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

// Pace thresholds (min/km)
const RUN_PACE_THRESHOLD = 8; // Faster than 8 min/km = running
const WALK_PACE_THRESHOLD = 12; // Slower than 12 min/km = walking

async function fetchFromRelay(relay, authors) {
  return new Promise((resolve) => {
    const events = [];
    let ws;
    try { ws = new WebSocket(relay); } catch (e) { resolve([]); return; }

    const timeout = setTimeout(() => { try { ws.close(); } catch(e) {} resolve(events); }, 15000);

    ws.on('open', () => {
      const filter = { kinds: [1301], authors, since: SEASON_2_START };
      ws.send(JSON.stringify(['REQ', 'analyze', filter]));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg[0] === 'EVENT') events.push(msg[2]);
        if (msg[0] === 'EOSE') { clearTimeout(timeout); ws.close(); resolve(events); }
      } catch (e) {}
    });

    ws.on('error', () => { clearTimeout(timeout); resolve(events); });
    ws.on('close', () => { clearTimeout(timeout); resolve(events); });
  });
}

function parseDuration(durationStr) {
  if (!durationStr) return null;
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function calculatePace(distanceKm, durationSeconds) {
  if (!distanceKm || !durationSeconds || distanceKm <= 0) return null;
  return (durationSeconds / 60) / distanceKm; // min/km
}

function classifyByPace(paceMinPerKm) {
  if (paceMinPerKm === null) return 'unknown';
  if (paceMinPerKm < RUN_PACE_THRESHOLD) return 'running';
  if (paceMinPerKm > WALK_PACE_THRESHOLD) return 'walking';
  return 'ambiguous'; // 8-12 min/km could be either
}

async function main() {
  console.log('='.repeat(80));
  console.log('  ANALYZING "OTHER" TYPE WORKOUTS - Season II (Jan 2026+)');
  console.log('='.repeat(80));
  console.log('Pace thresholds:');
  console.log('  Running: < 8 min/km (faster than 7.5 km/h)');
  console.log('  Walking: > 12 min/km (slower than 5 km/h)');
  console.log('  Ambiguous: 8-12 min/km\n');

  const pubkeys = PARTICIPANTS.map(p => p.pubkey);
  const pubkeyToName = Object.fromEntries(PARTICIPANTS.map(p => [p.pubkey, p.name]));

  // Fetch from all relays
  console.log('Fetching from relays...');
  const allEvents = [];
  for (const relay of RELAYS) {
    const events = await fetchFromRelay(relay, pubkeys);
    console.log('  ' + relay + ': ' + events.length + ' events');
    allEvents.push(...events);
  }

  // Deduplicate
  const seen = new Set();
  const events = allEvents.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
  console.log('\nTotal unique events: ' + events.length);

  // Filter to "other" type only
  const otherEvents = events.filter(e => {
    const exercise = (e.tags.find(t => t[0] === 'exercise') || [])[1];
    return exercise === 'other' || !exercise;
  });
  console.log('Events with type "other" or missing: ' + otherEvents.length + '\n');

  // Analyze each "other" workout
  const results = [];
  for (const e of otherEvents) {
    const name = pubkeyToName[e.pubkey] || e.pubkey.substring(0, 8);
    const distanceTag = e.tags.find(t => t[0] === 'distance');
    const durationTag = e.tags.find(t => t[0] === 'duration');

    let distanceKm = null;
    if (distanceTag) {
      const value = parseFloat(distanceTag[1]);
      const unit = (distanceTag[2] || '').toLowerCase();
      if (unit === 'km') distanceKm = value;
      else if (unit === 'mi') distanceKm = value * 1.60934;
      else if (unit === 'm') distanceKm = value / 1000;
      else distanceKm = value; // assume km
    }

    const durationSeconds = parseDuration(durationTag ? durationTag[1] : null);
    const pace = calculatePace(distanceKm, durationSeconds);
    const likely = classifyByPace(pace);
    const date = new Date(e.created_at * 1000).toISOString().split('T')[0];

    results.push({ name, date, distanceKm, durationSeconds, pace, likely, id: e.id });
  }

  // Sort by user then date
  results.sort((a, b) => a.name.localeCompare(b.name) || a.date.localeCompare(b.date));

  // Print detailed results
  console.log('='.repeat(80));
  console.log('  WORKOUT ANALYSIS');
  console.log('='.repeat(80));
  console.log('');
  console.log('User             | Date       | Distance | Duration | Pace     | Likely Type');
  console.log('-'.repeat(80));

  for (const r of results) {
    const name = r.name.substring(0, 16).padEnd(16);
    const dist = r.distanceKm ? r.distanceKm.toFixed(2).padStart(7) + ' km' : '     N/A';
    const dur = r.durationSeconds ?
      Math.floor(r.durationSeconds/60) + ':' + String(r.durationSeconds%60).padStart(2,'0') :
      'N/A';
    const pace = r.pace ? r.pace.toFixed(1).padStart(5) + ' min/km' : '    N/A';
    console.log(name + ' | ' + r.date + ' | ' + dist + ' | ' + dur.padStart(7) + ' | ' + pace + ' | ' + r.likely.toUpperCase());
  }

  // Summary
  const summary = { running: 0, walking: 0, ambiguous: 0, unknown: 0 };
  for (const r of results) summary[r.likely]++;

  console.log('\n' + '='.repeat(80));
  console.log('  SUMMARY');
  console.log('='.repeat(80));
  console.log('Total "other" workouts analyzed: ' + results.length);
  console.log('  Likely RUNNING (< 8 min/km):  ' + summary.running);
  console.log('  Likely WALKING (> 12 min/km): ' + summary.walking);
  console.log('  Ambiguous (8-12 min/km):      ' + summary.ambiguous);
  console.log('  Unknown (missing data):       ' + summary.unknown);

  // Per-user summary
  console.log('\n' + '-'.repeat(80));
  console.log('  PER-USER BREAKDOWN');
  console.log('-'.repeat(80));

  const userSummary = {};
  for (const r of results) {
    if (!userSummary[r.name]) userSummary[r.name] = { running: 0, walking: 0, ambiguous: 0, unknown: 0, totalKm: 0 };
    userSummary[r.name][r.likely]++;
    if (r.distanceKm) userSummary[r.name].totalKm += r.distanceKm;
  }

  for (const [name, s] of Object.entries(userSummary).sort((a,b) => b[1].totalKm - a[1].totalKm)) {
    console.log(name.padEnd(20) + ': ' + s.totalKm.toFixed(1).padStart(7) + ' km | ' +
      s.running + ' runs, ' + s.walking + ' walks, ' + s.ambiguous + ' ambiguous, ' + s.unknown + ' unknown');
  }

  process.exit(0);
}

main();
