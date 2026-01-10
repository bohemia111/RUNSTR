/**
 * Diagnostic script to fetch and display kind 1301 workout events
 * Uses WebSocket directly to avoid NDK connection issues
 */

const WebSocket = require('ws');

// Season II participants (first 10 for testing)
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

// Season II start date
const SEASON_START = Math.floor(new Date('2024-12-31T00:00:00Z').getTime() / 1000);

function parseWorkoutTags(tags) {
  const result = {
    exerciseType: null,
    distance: null,
    distanceUnit: null,
    duration: null,
  };

  for (const tag of tags) {
    if (tag[0] === 'exercise') {
      result.exerciseType = tag[1];
    }
    if (tag[0] === 'distance') {
      result.distance = tag[1];
      result.distanceUnit = tag[2] || 'km';
    }
    if (tag[0] === 'duration') {
      result.duration = tag[1];
    }
  }

  return result;
}

function parseDuration(durationStr) {
  if (!durationStr) return 0;

  // Handle HH:MM:SS format
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parseInt(durationStr) || 0;
}

async function fetchEventsFromRelay(relay, authors) {
  return new Promise((resolve, reject) => {
    const events = [];
    const ws = new WebSocket(relay);
    const subId = 'check-' + Math.random().toString(36).substring(7);

    const timeout = setTimeout(() => {
      console.log(`  Timeout reached, closing connection with ${events.length} events`);
      ws.close();
      resolve(events);
    }, 30000); // 30 second timeout

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
          console.log(`  EOSE received with ${events.length} events`);
          clearTimeout(timeout);
          ws.close();
          resolve(events);
        }
      } catch (e) {
        // ignore parse errors
      }
    });

    ws.on('error', (err) => {
      console.error(`  WebSocket error: ${err.message}`);
      clearTimeout(timeout);
      reject(err);
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      resolve(events);
    });
  });
}

async function main() {
  console.log('='.repeat(70));
  console.log('  KIND 1301 WORKOUT EVENTS DIAGNOSTIC');
  console.log('='.repeat(70));
  console.log();
  console.log(`Relay: ${RELAY}`);
  console.log(`Since: ${new Date(SEASON_START * 1000).toISOString()}`);
  console.log(`Participants: ${PARTICIPANTS.length}`);
  console.log();

  const pubkeys = PARTICIPANTS.map(p => p.pubkey);
  const pubkeyToName = Object.fromEntries(PARTICIPANTS.map(p => [p.pubkey, p.name]));

  console.log('Fetching events...');

  try {
    const events = await fetchEventsFromRelay(RELAY, pubkeys);

    console.log();
    console.log(`Total events received: ${events.length}`);
    console.log();

    // Group by user and activity type
    const userWorkouts = {};

    for (const event of events) {
      const parsed = parseWorkoutTags(event.tags);
      const userName = pubkeyToName[event.pubkey] || event.pubkey.substring(0, 8);
      const exerciseType = parsed.exerciseType || 'unknown';

      if (!userWorkouts[userName]) {
        userWorkouts[userName] = {
          running: { count: 0, totalDistance: 0, totalDuration: 0, workouts: [] },
          walking: { count: 0, totalDistance: 0, totalDuration: 0, workouts: [] },
          cycling: { count: 0, totalDistance: 0, totalDuration: 0, workouts: [] },
          other: { count: 0, totalDistance: 0, totalDuration: 0, workouts: [] },
        };
      }

      const category = ['running', 'walking', 'cycling'].includes(exerciseType) ? exerciseType : 'other';
      const distance = parseFloat(parsed.distance) || 0;
      const duration = parseDuration(parsed.duration);

      userWorkouts[userName][category].count++;
      userWorkouts[userName][category].totalDistance += distance;
      userWorkouts[userName][category].totalDuration += duration;
      userWorkouts[userName][category].workouts.push({
        date: new Date(event.created_at * 1000).toISOString().split('T')[0],
        distance: parsed.distance,
        distanceUnit: parsed.distanceUnit,
        duration: parsed.duration,
        content: event.content.substring(0, 50),
        rawTags: event.tags,
      });
    }

    // Print results
    console.log('='.repeat(70));
    console.log('  RESULTS BY USER');
    console.log('='.repeat(70));
    console.log();

    const sortedUsers = Object.keys(userWorkouts).sort();

    for (const userName of sortedUsers) {
      const data = userWorkouts[userName];
      const totalWorkouts = data.running.count + data.walking.count + data.cycling.count + data.other.count;

      console.log(`\n${'─'.repeat(70)}`);
      console.log(`USER: ${userName} (${totalWorkouts} workouts)`);
      console.log('─'.repeat(70));

      for (const type of ['running', 'walking', 'cycling']) {
        const typeData = data[type];
        if (typeData.count > 0) {
          console.log(`\n  ${type.toUpperCase()}: ${typeData.count} workouts`);
          console.log(`    Total Distance: ${typeData.totalDistance.toFixed(2)} km`);
          console.log(`    Total Duration: ${Math.floor(typeData.totalDuration / 3600)}h ${Math.floor((typeData.totalDuration % 3600) / 60)}m`);
          console.log(`    Individual workouts:`);

          for (const w of typeData.workouts.slice(0, 10)) {
            console.log(`      - ${w.date}: ${w.distance} ${w.distanceUnit}, ${w.duration}`);
          }
          if (typeData.workouts.length > 10) {
            console.log(`      ... and ${typeData.workouts.length - 10} more`);
          }
        }
      }
    }

    // Print summary
    console.log();
    console.log('='.repeat(70));
    console.log('  SUMMARY TOTALS');
    console.log('='.repeat(70));
    console.log();

    let totalRunning = { count: 0, distance: 0 };
    let totalWalking = { count: 0, distance: 0 };
    let totalCycling = { count: 0, distance: 0 };

    for (const data of Object.values(userWorkouts)) {
      totalRunning.count += data.running.count;
      totalRunning.distance += data.running.totalDistance;
      totalWalking.count += data.walking.count;
      totalWalking.distance += data.walking.totalDistance;
      totalCycling.count += data.cycling.count;
      totalCycling.distance += data.cycling.totalDistance;
    }

    console.log(`Running: ${totalRunning.count} workouts, ${totalRunning.distance.toFixed(2)} km total`);
    console.log(`Walking: ${totalWalking.count} workouts, ${totalWalking.distance.toFixed(2)} km total`);
    console.log(`Cycling: ${totalCycling.count} workouts, ${totalCycling.distance.toFixed(2)} km total`);
    console.log();
    console.log(`Users with workouts: ${Object.keys(userWorkouts).length}`);

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

main();
