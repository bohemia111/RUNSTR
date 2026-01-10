#!/usr/bin/env node
/**
 * Diagnose Season 2 Leaderboard (CommonJS version)
 *
 * Direct WebSocket query to Nostr relays - no NDK overhead
 */

const WebSocket = require('ws');

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
];

// Season 2 dates
const SEASON_START = '2026-01-01T00:00:00Z';
const SEASON_END = '2026-03-01T23:59:59Z';

// Hardcoded Season 2 participants
const SEASON_2_PARTICIPANTS = [
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
  { pubkey: '8ce975f57dd070c4293ff8f978b869e20b2cdf4c81f277b46f3676b262c5e823', name: 'clemsy' },
  { pubkey: '9fce3aea32b35637838fb45b75be32595742e16bb3e4742cc82bb3d50f9087e6', name: 'MAKE SONGS LONGER' },
  { pubkey: 'e5237023a5c0929e7ae0e5128d41a8213138400ec110dbe9d8a29278f22b7c13', name: 'Helen Yrmom' },
  { pubkey: '02734f19cae7850e7bca6c0a2bb6a534f152d5acbd86eece1d2bfbd5d6502003', name: 'bitcoin_rene' },
  { pubkey: '939ffb4e552ed5c0fa780985ab7163f441798409ae7ed81c62c07ac4683b4222', name: 'Johan' },
  { pubkey: '5a654b6394bb83ecc1b95f848d6bc44e6d21120de5d832040704d9823b2c0af4', name: 'Drew' },
  { pubkey: '5d405752c1b4ddd0714baf3ce415db52e5506036f345ff575ee16e2b4cf189bf', name: 'Heiunter' },
  { pubkey: '14ca97caaea1565dc3f8277394a8f7d03364745a8d18536d8423dbac3f363b7f', name: 'Satty' },
  { pubkey: 'de7ab932ca17278b2144a6628c3531a0628fcc7b58074111d6e5b949ecb0e377', name: "Harambe's last Bitcoin" },
  { pubkey: 'a80fc4a78634ee26aabcac951b4cfd7b56ae18babd33c5afdcf6bed6dc80ebd1', name: 'Uno' },
  { pubkey: 'a723805cda67251191c8786f4da58f797e6977582301354ba8e91bcb0342dc9c', name: 'Seth' },
  { pubkey: '0ae9dc5f42febd11c5c895b0af0bbabbe02261591b0f24eefe22c0d9ca8d0286', name: 'MoonKaptain' },
  { pubkey: 'fad80b7451b03f686fd9e487b05b69c04c808e26a1db655e59e0e296a5c9f4dd', name: 'means' },
  { pubkey: 'a9046cc9175dc5a45fb93a2c890f9a8b18c707fa6d695771aab9300081d3e21a', name: 'Ben Cousens' },
  { pubkey: '20d29810d6a5f92b045ade02ebbadc9036d741cc686b00415c42b4236fe4ad2f', name: 'negr0' },
  { pubkey: 'ea28488b659ab6433167cd024eb72e01a375ac17ce54a1cdc6e5dce2f6d93923', name: 'johnny9' },
  { pubkey: 'c6f0f4279f12200f77e1943cd26aaedf6081fda8585695f9a923b4723686da12', name: 'Tumbleweed' },
  { pubkey: '661305095522a18a1095b7b86874ef618da9c5d1ba5f4af375688e2129c07317', name: 'Ajax' },
  { pubkey: '933a52008116743cd652eca47209f57e4ca4c439d8c2526d8c48a47bf7072ec7', name: 'Nell' },
  { pubkey: '312f54da0da1cf0cdcf1d6385fa8d6e5d8218f7122297d30b22482edada44649', name: 'HumbleStacker' },
  { pubkey: '9416112efa3cdc0675156e4cb6ae46b2cca51973065c61bcbc002ca99e5dcdf2', name: 'Lat51_Training' },
  { pubkey: '0f563fe2cfdf180cb104586b95873379a0c1fdcfbc301a80c8255f33d15f039d', name: 'Patrick' },
  { pubkey: 'd84517802a434757c56ae8642bffb4d26e5ade0712053750215680f5896e579b', name: 'ObjectiF MooN' },
  { pubkey: 'eeb11961b25442b16389fe6c7ebea9adf0ac36dd596816ea7119e521b8821b9e', name: 'OpenMike' },
  { pubkey: '81b91540daeee031df309460a9bcf5866a54c70217ff173bcdefd1982f12b0ba', name: 'Aaron Tomac' },
  { pubkey: '7ebbce1843a17cd778a5e169e3d2f679f5ac7b5125d1c43d265e190f7b27538c', name: 'Adrien Lacombe' },
  { pubkey: '179154c2b30226578a14ac5a01f50a3efde8d14032df96371550e1210fffd892', name: 'Awakening Mind' },
  { pubkey: '1f698bd4b5dda804316f09773f903ca699cf5b2a0fcd5b3fe6e0709668d58e60', name: 'Dani' },
  { pubkey: '86f7eea066dd4dc574d01b0f9317a03508887f815fb58d8ef66873cc42fe3431', name: 'Taljarn' },
];

const participantMap = new Map(SEASON_2_PARTICIPANTS.map(p => [p.pubkey, p.name]));

async function queryRelay(relayUrl, filter) {
  return new Promise((resolve) => {
    const events = [];
    const subId = Math.random().toString(36).substring(7);
    let timeout;

    try {
      const ws = new WebSocket(relayUrl);

      ws.on('open', () => {
        console.log(`   ✓ Connected to ${relayUrl}`);
        ws.send(JSON.stringify(['REQ', subId, filter]));

        // 10 second timeout
        timeout = setTimeout(() => {
          ws.close();
          resolve(events);
        }, 10000);
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg[0] === 'EVENT' && msg[1] === subId) {
            events.push(msg[2]);
          } else if (msg[0] === 'EOSE') {
            clearTimeout(timeout);
            ws.close();
            resolve(events);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      ws.on('error', (err) => {
        console.log(`   ✗ Error on ${relayUrl}: ${err.message}`);
        clearTimeout(timeout);
        resolve(events);
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        resolve(events);
      });
    } catch (err) {
      console.log(`   ✗ Failed to connect to ${relayUrl}`);
      resolve(events);
    }
  });
}

// Known charities
const CHARITIES = {
  'opensats': 'OpenSats',
  'hrf': 'Human Rights Foundation',
  'freeross': 'Free Ross',
  'bitcoinsmiles': 'Bitcoin Smiles',
  'devfund': 'Nostr Dev Fund',
};

function parseWorkout(event) {
  const getTag = (name) => event.tags?.find(t => t[0] === name)?.[1];

  const exerciseType = getTag('exercise')?.toLowerCase();
  const distanceStr = getTag('distance');

  if (!exerciseType || !distanceStr) return null;

  const distance = parseFloat(distanceStr);
  if (isNaN(distance) || distance <= 0) return null;

  let activityType = null;
  if (exerciseType.includes('run') || exerciseType.includes('jog') || exerciseType === 'running') {
    activityType = 'running';
  } else if (exerciseType.includes('walk') || exerciseType.includes('hike') || exerciseType === 'walking') {
    activityType = 'walking';
  } else if (exerciseType.includes('cycl') || exerciseType.includes('bike') || exerciseType === 'cycling') {
    activityType = 'cycling';
  } else if (exerciseType === 'other' && distanceStr) {
    activityType = 'running';
  }

  if (!activityType) return null;

  const charityId = getTag('charity'); // Only explicit charity tags, no default

  return {
    id: event.id,
    pubkey: event.pubkey,
    name: participantMap.get(event.pubkey) || event.pubkey.slice(0, 12) + '...',
    activityType,
    distance,
    createdAt: event.created_at || 0,
    charityId,
  };
}

function calculateLeaderboard(workouts) {
  const userStats = new Map();

  for (const w of workouts) {
    const existing = userStats.get(w.pubkey) || { distance: 0, count: 0, name: w.name };
    existing.distance += w.distance;
    existing.count += 1;
    userStats.set(w.pubkey, existing);
  }

  const entries = [];
  for (const [pubkey, stats] of userStats) {
    entries.push({
      pubkey,
      name: stats.name,
      totalDistance: stats.distance,
      workoutCount: stats.count,
    });
  }

  entries.sort((a, b) => b.totalDistance - a.totalDistance);
  entries.forEach((e, i) => e.rank = i + 1);

  return entries;
}

async function main() {
  console.log('🏃 RUNSTR Season 2 Leaderboard Diagnostics');
  console.log('==========================================\n');
  console.log(`📅 Season dates: ${SEASON_START} to ${SEASON_END}`);
  console.log(`👥 Participants: ${SEASON_2_PARTICIPANTS.length} hardcoded users\n`);

  const since = Math.floor(new Date(SEASON_START).getTime() / 1000);
  const until = Math.floor(new Date(SEASON_END).getTime() / 1000);

  console.log('📊 Query Parameters:');
  console.log(`   Since: ${new Date(since * 1000).toISOString()}`);
  console.log(`   Until: ${new Date(until * 1000).toISOString()}`);
  console.log();

  const hexPubkeys = SEASON_2_PARTICIPANTS.map(p => p.pubkey);

  const filter = {
    kinds: [1301],
    authors: hexPubkeys,
    since,
    until,
    limit: 3000,
  };

  console.log('📡 Querying Nostr relays...\n');

  // Query all relays in parallel
  const allEvents = new Map();

  for (const relay of RELAYS) {
    const events = await queryRelay(relay, filter);
    console.log(`   Got ${events.length} events from ${relay}`);
    for (const e of events) {
      if (e.id) allEvents.set(e.id, e);
    }
  }

  console.log(`\n✅ Total unique events: ${allEvents.size}\n`);

  // Parse workouts
  const allWorkouts = [];
  for (const event of allEvents.values()) {
    const workout = parseWorkout(event);
    if (workout) allWorkouts.push(workout);
  }

  console.log(`📋 Parsed ${allWorkouts.length} valid workouts\n`);

  // Count by activity type
  const byType = { running: 0, walking: 0, cycling: 0 };
  for (const w of allWorkouts) {
    if (w.activityType in byType) byType[w.activityType]++;
  }

  console.log('============================================================');
  console.log('📊 WORKOUT BREAKDOWN');
  console.log('============================================================');
  console.log(`Running: ${byType.running}`);
  console.log(`Walking: ${byType.walking}`);
  console.log(`Cycling: ${byType.cycling}`);
  console.log();

  // Unique users
  const uniqueUsers = new Set(allWorkouts.map(w => w.pubkey));
  console.log(`Unique users with workouts: ${uniqueUsers.size}/${SEASON_2_PARTICIPANTS.length}\n`);

  // Show recent workouts
  allWorkouts.sort((a, b) => b.createdAt - a.createdAt);

  console.log('============================================================');
  console.log('📋 RECENT WORKOUTS (newest first)');
  console.log('============================================================\n');

  for (let i = 0; i < Math.min(allWorkouts.length, 30); i++) {
    const w = allWorkouts[i];
    const date = new Date(w.createdAt * 1000).toISOString().split('T')[0];
    console.log(`${(i + 1).toString().padStart(2)}. [${date}] ${w.name.padEnd(20)} ${w.activityType.padEnd(8)} ${w.distance.toFixed(2).padStart(7)} km`);
  }

  if (allWorkouts.length > 30) {
    console.log(`\n... and ${allWorkouts.length - 30} more workouts`);
  }

  // Leaderboards
  console.log('\n============================================================');
  console.log('🏆 LEADERBOARDS');
  console.log('============================================================');

  for (const activityType of ['running', 'walking', 'cycling']) {
    const typeWorkouts = allWorkouts.filter(w => w.activityType === activityType);
    const leaderboard = calculateLeaderboard(typeWorkouts);

    console.log(`\n🏃 ${activityType.toUpperCase()} (${typeWorkouts.length} workouts)`);
    console.log('─'.repeat(50));

    if (leaderboard.length === 0) {
      console.log('   (No workouts recorded)');
    } else {
      for (const e of leaderboard.slice(0, 15)) {
        const medal = e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank.toString().padStart(2)}`;
        console.log(`   ${medal} ${e.name.padEnd(20)} ${e.totalDistance.toFixed(2).padStart(8)} km (${e.workoutCount} workouts)`);
      }
      if (leaderboard.length > 15) {
        console.log(`   ... and ${leaderboard.length - 15} more`);
      }
    }
  }

  // Charity Rankings - BY ACTIVITY TYPE
  console.log('\n============================================================');
  console.log('🏛️ CHARITY RANKINGS (by activity type)');
  console.log('============================================================');

  function calculateCharityRankings(workouts, activityType) {
    const filtered = workouts.filter(w => w.activityType === activityType && w.charityId);

    const charityStats = new Map();
    const charityUsers = new Map();

    for (const w of filtered) {
      const existing = charityStats.get(w.charityId) || { distance: 0, count: 0 };
      existing.distance += w.distance;
      existing.count += 1;
      charityStats.set(w.charityId, existing);

      if (!charityUsers.has(w.charityId)) charityUsers.set(w.charityId, new Set());
      charityUsers.get(w.charityId).add(w.pubkey);
    }

    const rankings = [];
    for (const [charityId, stats] of charityStats) {
      rankings.push({
        charityId,
        name: CHARITIES[charityId] || charityId,
        totalDistance: stats.distance,
        workoutCount: stats.count,
        participantCount: charityUsers.get(charityId)?.size || 0,
      });
    }

    rankings.sort((a, b) => b.totalDistance - a.totalDistance);
    return rankings;
  }

  for (const activityType of ['running', 'walking', 'cycling']) {
    const rankings = calculateCharityRankings(allWorkouts, activityType);
    const icon = activityType === 'running' ? '🏃' : activityType === 'walking' ? '🚶' : '🚴';

    console.log(`\n${icon} ${activityType.toUpperCase()} CHARITY LEADERBOARD`);
    console.log('─'.repeat(50));

    if (rankings.length === 0) {
      console.log('   (No workouts with charity tags)');
    } else {
      for (let i = 0; i < rankings.length; i++) {
        const c = rankings[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
        console.log(`   ${medal} ${c.name.padEnd(28)} ${c.totalDistance.toFixed(2).padStart(7)} km (${c.participantCount} users)`);
      }
    }
  }

  // Also show workouts WITHOUT charity tags
  const noCharityWorkouts = allWorkouts.filter(w => !w.charityId);
  if (noCharityWorkouts.length > 0) {
    console.log(`\n⚠️ ${noCharityWorkouts.length} workouts have NO charity tag (not counted in charity rankings)`);
  }

  // Summary
  console.log('\n============================================================');
  console.log('📊 TOTALS');
  console.log('============================================================');

  const runningTotal = allWorkouts.filter(w => w.activityType === 'running').reduce((s, w) => s + w.distance, 0);
  const walkingTotal = allWorkouts.filter(w => w.activityType === 'walking').reduce((s, w) => s + w.distance, 0);
  const cyclingTotal = allWorkouts.filter(w => w.activityType === 'cycling').reduce((s, w) => s + w.distance, 0);

  console.log(`Running: ${runningTotal.toFixed(2)} km`);
  console.log(`Walking: ${walkingTotal.toFixed(2)} km`);
  console.log(`Cycling: ${cyclingTotal.toFixed(2)} km`);
  console.log(`Total:   ${(runningTotal + walkingTotal + cyclingTotal).toFixed(2)} km`);

  // Users with no workouts
  const usersWithWorkouts = new Set(allWorkouts.map(w => w.pubkey));
  const noWorkouts = SEASON_2_PARTICIPANTS.filter(p => !usersWithWorkouts.has(p.pubkey));

  if (noWorkouts.length > 0) {
    console.log(`\n⚠️ Participants with NO workouts (${noWorkouts.length}):`);
    for (const u of noWorkouts.slice(0, 10)) {
      console.log(`   - ${u.name}`);
    }
    if (noWorkouts.length > 10) {
      console.log(`   ... and ${noWorkouts.length - 10} more`);
    }
  }

  console.log('\n✅ Done\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
