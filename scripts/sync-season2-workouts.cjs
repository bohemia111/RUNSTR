/**
 * Nostr Scan Script for Season II Transition Period
 *
 * This script queries kind 1301 workout events from Nostr for Season II participants
 * and submits them through the Supabase Edge Function for validation.
 *
 * Purpose:
 * - Catches workouts from old app versions that don't have auto-sync
 * - Ensures consistent anti-cheat validation via the same Edge Function
 * - Marks submissions as source='nostr_scan' vs source='app'
 *
 * Usage:
 *   node scripts/sync-season2-workouts.cjs
 *
 * Requirements:
 *   - EXPO_PUBLIC_SUPABASE_URL in .env
 *   - EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
 */

const NDK = require('@nostr-dev-kit/ndk').default;
const { nip19 } = require('nostr-tools');
require('dotenv').config();

// Season II start timestamp (January 1, 2026 00:00:00 UTC)
// Must match SEASON_2_CONFIG.startDate in src/constants/season2.ts
const SEASON_2_START = new Date('2026-01-01T00:00:00Z').getTime() / 1000;

// Supabase configuration
// Use service role key for server-side script (bypasses RLS)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables');
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not found, using anon key (may fail auth)');
}

// Season II participants (hex pubkeys) - ALL 44 participants from SEASON_2_PARTICIPANTS
const SEASON_2_PUBKEYS = [
  '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5', // TheWildHustle
  '745eb529d0e42d2fa6c904bbc2c10702deae964b4dd3079803ab8b43536dda12', // guy
  'dae73fdd90d98db1a8405bcecac60cd6ce8d10896a6a2c5e04011125e16cd432', // Lhasa Sensei
  '43256bc0859462cf14fa7de594a48babdf189b91abe27f88d824abf69b2343c9', // LOPES
  'e7df627c638d934b37548d8408b43dc5d4762fa270c26abec5916bff62aac80d', // KjetilR
  '9358c67695d9e78bde2bf3ce1eb0a5059553687632a177e7d25deeff9f2912fc', // Kamo Weasel
  'c9943d8f8e9c2aa9facb6e579af6ec38b7205c0570de1b0fb8f99f65dc5f786e', // Zed
  '6b42a3b227b086e850ff659a151863ce070eb60d32bae8a4618928655effc3f6', // JokerHasse
  '0c252c138ee446b6f9c0964ff609380fc82e52c8d318529607f293fcdf828bea', // Busch21
  'c8b22b81877eaa54e1ab21e39824f85a29e61f71da9fbabbef8930b171b98da8', // Hoov
  '8ce975f57dd070c4293ff8f978b869e20b2cdf4c81f277b46f3676b262c5e823', // clemsy
  '9fce3aea32b35637838fb45b75be32595742e16bb3e4742cc82bb3d50f9087e6', // MAKE SONGS LONGER
  'e5237023a5c0929e7ae0e5128d41a8213138400ec110dbe9d8a29278f22b7c13', // Helen Yrmom
  '02734f19cae7850e7bca6c0a2bb6a534f152d5acbd86eece1d2bfbd5d6502003', // bitcoin_rene
  '939ffb4e552ed5c0fa780985ab7163f441798409ae7ed81c62c07ac4683b4222', // Johan
  '5a654b6394bb83ecc1b95f848d6bc44e6d21120de5d832040704d9823b2c0af4', // Drew
  '5d405752c1b4ddd0714baf3ce415db52e5506036f345ff575ee16e2b4cf189bf', // Heiunter
  '14ca97caaea1565dc3f8277394a8f7d03364745a8d18536d8423dbac3f363b7f', // Satty
  'de7ab932ca17278b2144a6628c3531a0628fcc7b58074111d6e5b949ecb0e377', // Harambe's last Bitcoin
  'a80fc4a78634ee26aabcac951b4cfd7b56ae18babd33c5afdcf6bed6dc80ebd1', // Uno
  'a723805cda67251191c8786f4da58f797e6977582301354ba8e91bcb0342dc9c', // Seth
  '0ae9dc5f42febd11c5c895b0af0bbabbe02261591b0f24eefe22c0d9ca8d0286', // MoonKaptain
  'fad80b7451b03f686fd9e487b05b69c04c808e26a1db655e59e0e296a5c9f4dd', // means
  'a9046cc9175dc5a45fb93a2c890f9a8b18c707fa6d695771aab9300081d3e21a', // Ben Cousens
  '20d29810d6a5f92b045ade02ebbadc9036d741cc686b00415c42b4236fe4ad2f', // negr0
  'ea28488b659ab6433167cd024eb72e01a375ac17ce54a1cdc6e5dce2f6d93923', // johnny9
  'c6f0f4279f12200f77e1943cd26aaedf6081fda8585695f9a923b4723686da12', // Tumbleweed
  '661305095522a18a1095b7b86874ef618da9c5d1ba5f4af375688e2129c07317', // Ajax
  '933a52008116743cd652eca47209f57e4ca4c439d8c2526d8c48a47bf7072ec7', // Nell
  '312f54da0da1cf0cdcf1d6385fa8d6e5d8218f7122297d30b22482edada44649', // HumbleStacker
  '9416112efa3cdc0675156e4cb6ae46b2cca51973065c61bcbc002ca99e5dcdf2', // Lat51_Training
  '0f563fe2cfdf180cb104586b95873379a0c1fdcfbc301a80c8255f33d15f039d', // Patrick
  'd84517802a434757c56ae8642bffb4d26e5ade0712053750215680f5896e579b', // ObjectiF MooN
  'eeb11961b25442b16389fe6c7ebea9adf0ac36dd596816ea7119e521b8821b9e', // OpenMike
  '81b91540daeee031df309460a9bcf5866a54c70217ff173bcdefd1982f12b0ba', // Aaron Tomac
  '7ebbce1843a17cd778a5e169e3d2f679f5ac7b5125d1c43d265e190f7b27538c', // Adrien Lacombe
  '179154c2b30226578a14ac5a01f50a3efde8d14032df96371550e1210fffd892', // Awakening Mind
  '1f698bd4b5dda804316f09773f903ca699cf5b2a0fcd5b3fe6e0709668d58e60', // Dani
  '86f7eea066dd4dc574d01b0f9317a03508887f815fb58d8ef66873cc42fe3431', // Taljarn
  '0418ca2d6cd6c7fbc4e0391bb745027023a7edbc38f2a60fc3b68f006efb85eb', // saiy2k
  '556329e4245ec4889c33b29262c85335a082c2e25cd08b69ff46e17e70b785ec', // OrangePillosophy
  'a2603c88443af5152585f3f836832a67551e3ecad0e47a435c8d6510aa31c843', // Carol
  '24b45900a92fbc4527ccf975bd416988e444c6e4d9f364c5158667f077623fe2', // Jose Sammut
];

// Relays to query - expanded list for better coverage
const RELAYS = [
  // Primary relays
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  // Additional relays for broader coverage
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://e.nos.lol',
];

/**
 * Parse workout data from a kind 1301 event
 */
function parseWorkoutEvent(event) {
  const tags = event.tags || [];
  const getTag = (name) => tags.find((t) => t[0] === name)?.[1];

  // Activity type
  const activityType = getTag('exercise') || 'other';

  // Distance - handle unit conversion
  const distanceTag = tags.find((t) => t[0] === 'distance');
  let distanceMeters = null;
  if (distanceTag) {
    const value = parseFloat(distanceTag[1]);
    const unit = distanceTag[2]?.toLowerCase();
    if (!isNaN(value)) {
      switch (unit) {
        case 'km':
          distanceMeters = value * 1000;
          break;
        case 'mi':
          distanceMeters = value * 1609.34;
          break;
        case 'm':
        default:
          distanceMeters = value;
          break;
      }
    }
  }

  // Duration - parse HH:MM:SS format
  const durationStr = getTag('duration');
  let durationSeconds = null;
  if (durationStr) {
    const parts = durationStr.split(':').map(Number);
    if (parts.length === 3) {
      durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      durationSeconds = parts[0] * 60 + parts[1];
    }
  }

  // Calories
  const caloriesStr = getTag('calories');
  const calories = caloriesStr ? parseInt(caloriesStr, 10) || null : null;

  return {
    activityType,
    distanceMeters,
    durationSeconds,
    calories,
  };
}

/**
 * Extract plain Nostr event data (removes NDK wrapper with circular refs)
 */
function toPlainEvent(ndkEvent) {
  return {
    id: ndkEvent.id,
    pubkey: ndkEvent.pubkey,
    created_at: ndkEvent.created_at,
    kind: ndkEvent.kind,
    tags: ndkEvent.tags,
    content: ndkEvent.content,
    sig: ndkEvent.sig,
  };
}

/**
 * Submit a workout to the Edge Function
 */
async function submitWorkout(event) {
  const npub = nip19.npubEncode(event.pubkey);
  const workout = parseWorkoutEvent(event);
  const plainEvent = toPlainEvent(event);

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-workout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        event_id: event.id,
        npub,
        activity_type: workout.activityType,
        distance_meters: workout.distanceMeters,
        duration_seconds: workout.durationSeconds,
        calories: workout.calories,
        created_at: new Date(event.created_at * 1000).toISOString(),
        raw_event: plainEvent,
        source: 'nostr_scan', // Mark as coming from periodic Nostr scan
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`Failed to submit ${event.id}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main sync function
 */
async function syncWorkouts() {
  console.log('=== Season II Workout Sync ===\n');
  console.log(`Querying ${SEASON_2_PUBKEYS.length} participants...`);
  console.log(`Since: ${new Date(SEASON_2_START * 1000).toISOString()}\n`);

  // Initialize NDK with timeout
  const ndk = new NDK({
    explicitRelayUrls: RELAYS,
  });

  console.log('Connecting to relays...');

  try {
    // Wrap connect in a timeout to avoid hanging
    const connectPromise = ndk.connect();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    );
    await Promise.race([connectPromise, timeoutPromise]);
    console.log('NDK connected\n');
  } catch (err) {
    console.warn('Warning: NDK connect had issues:', err.message);
    console.log('Continuing anyway (relays may connect in background)...\n');
  }

  // Wait for relay connections to stabilize (5s for 7 relays)
  console.log('Waiting for relay connections...');
  await new Promise((resolve) => setTimeout(resolve, 5000));
  console.log('Ready to fetch events\n');

  // Query kind 1301 events
  const filter = {
    kinds: [1301],
    authors: SEASON_2_PUBKEYS,
    since: SEASON_2_START,
  };

  console.log('Fetching events...');
  const events = await ndk.fetchEvents(filter);
  console.log(`Found ${events.size} workout events\n`);

  // Process events
  const stats = {
    total: events.size,
    submitted: 0,
    duplicates: 0,
    flagged: 0,
    errors: 0,
  };

  for (const event of events) {
    const result = await submitWorkout(event);

    if (result.success) {
      if (result.duplicate) {
        stats.duplicates++;
        process.stdout.write('.');
      } else {
        stats.submitted++;
        process.stdout.write('+');
      }
    } else if (result.flagged) {
      stats.flagged++;
      process.stdout.write('!');
      console.log(`\n  Flagged: ${event.id.slice(0, 8)}... - ${result.reason}`);
    } else {
      stats.errors++;
      process.stdout.write('x');
      console.log(`\n  Error: ${event.id.slice(0, 8)}... - ${result.error}`);
    }

    // Rate limit to avoid overwhelming the Edge Function
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log('\n\n=== Sync Complete ===');
  console.log(`Total events:    ${stats.total}`);
  console.log(`New submissions: ${stats.submitted}`);
  console.log(`Duplicates:      ${stats.duplicates}`);
  console.log(`Flagged:         ${stats.flagged}`);
  console.log(`Errors:          ${stats.errors}`);

  process.exit(0);
}

// Run the sync
syncWorkouts().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
