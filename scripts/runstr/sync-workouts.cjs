#!/usr/bin/env node
/**
 * Universal Competition Workout Sync
 *
 * Syncs kind 1301 workout events from Nostr to Supabase for ALL competition
 * participants, not just Season II members.
 *
 * Data sources:
 * 1. Supabase competition_participants - dynamically registered users
 * 2. Season II hardcoded list - fallback for historical participants
 *
 * Usage:
 *   node scripts/sync-all-competition-workouts.cjs
 *
 * Requirements:
 *   - EXPO_PUBLIC_SUPABASE_URL in .env
 *   - SUPABASE_SERVICE_ROLE_KEY in .env (preferred) or EXPO_PUBLIC_SUPABASE_ANON_KEY
 */

const NDK = require('@nostr-dev-kit/ndk').default;
const { nip19 } = require('nostr-tools');
require('dotenv').config();

// Season 2 start timestamp (January 1, 2026 00:00:00 UTC)
const SEASON_2_START = new Date('2026-01-01T00:00:00Z').getTime() / 1000;

// Supabase configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables');
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Warning: Using anon key (service role key recommended)');
}

// Season II participants (hex pubkeys) - fallback list
const SEASON_2_PUBKEYS = [
  '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5',
  '745eb529d0e42d2fa6c904bbc2c10702deae964b4dd3079803ab8b43536dda12',
  'dae73fdd90d98db1a8405bcecac60cd6ce8d10896a6a2c5e04011125e16cd432',
  '43256bc0859462cf14fa7de594a48babdf189b91abe27f88d824abf69b2343c9',
  'e7df627c638d934b37548d8408b43dc5d4762fa270c26abec5916bff62aac80d',
  '9358c67695d9e78bde2bf3ce1eb0a5059553687632a177e7d25deeff9f2912fc',
  'c9943d8f8e9c2aa9facb6e579af6ec38b7205c0570de1b0fb8f99f65dc5f786e',
  '6b42a3b227b086e850ff659a151863ce070eb60d32bae8a4618928655effc3f6',
  '0c252c138ee446b6f9c0964ff609380fc82e52c8d318529607f293fcdf828bea',
  'c8b22b81877eaa54e1ab21e39824f85a29e61f71da9fbabbef8930b171b98da8',
  '8ce975f57dd070c4293ff8f978b869e20b2cdf4c81f277b46f3676b262c5e823',
  '9fce3aea32b35637838fb45b75be32595742e16bb3e4742cc82bb3d50f9087e6',
  'e5237023a5c0929e7ae0e5128d41a8213138400ec110dbe9d8a29278f22b7c13',
  '02734f19cae7850e7bca6c0a2bb6a534f152d5acbd86eece1d2bfbd5d6502003',
  '939ffb4e552ed5c0fa780985ab7163f441798409ae7ed81c62c07ac4683b4222',
  '5a654b6394bb83ecc1b95f848d6bc44e6d21120de5d832040704d9823b2c0af4',
  '5d405752c1b4ddd0714baf3ce415db52e5506036f345ff575ee16e2b4cf189bf',
  '14ca97caaea1565dc3f8277394a8f7d03364745a8d18536d8423dbac3f363b7f',
  'de7ab932ca17278b2144a6628c3531a0628fcc7b58074111d6e5b949ecb0e377',
  'a80fc4a78634ee26aabcac951b4cfd7b56ae18babd33c5afdcf6bed6dc80ebd1',
  'a723805cda67251191c8786f4da58f797e6977582301354ba8e91bcb0342dc9c',
  '0ae9dc5f42febd11c5c895b0af0bbabbe02261591b0f24eefe22c0d9ca8d0286',
  'fad80b7451b03f686fd9e487b05b69c04c808e26a1db655e59e0e296a5c9f4dd',
  'a9046cc9175dc5a45fb93a2c890f9a8b18c707fa6d695771aab9300081d3e21a',
  '20d29810d6a5f92b045ade02ebbadc9036d741cc686b00415c42b4236fe4ad2f',
  'ea28488b659ab6433167cd024eb72e01a375ac17ce54a1cdc6e5dce2f6d93923',
  'c6f0f4279f12200f77e1943cd26aaedf6081fda8585695f9a923b4723686da12',
  '661305095522a18a1095b7b86874ef618da9c5d1ba5f4af375688e2129c07317',
  '933a52008116743cd652eca47209f57e4ca4c439d8c2526d8c48a47bf7072ec7',
  '312f54da0da1cf0cdcf1d6385fa8d6e5d8218f7122297d30b22482edada44649',
  '9416112efa3cdc0675156e4cb6ae46b2cca51973065c61bcbc002ca99e5dcdf2',
  '0f563fe2cfdf180cb104586b95873379a0c1fdcfbc301a80c8255f33d15f039d',
  'd84517802a434757c56ae8642bffb4d26e5ade0712053750215680f5896e579b',
  'eeb11961b25442b16389fe6c7ebea9adf0ac36dd596816ea7119e521b8821b9e',
  '81b91540daeee031df309460a9bcf5866a54c70217ff173bcdefd1982f12b0ba',
  '7ebbce1843a17cd778a5e169e3d2f679f5ac7b5125d1c43d265e190f7b27538c',
  '179154c2b30226578a14ac5a01f50a3efde8d14032df96371550e1210fffd892',
  '1f698bd4b5dda804316f09773f903ca699cf5b2a0fcd5b3fe6e0709668d58e60',
  '86f7eea066dd4dc574d01b0f9317a03508887f815fb58d8ef66873cc42fe3431',
  '0418ca2d6cd6c7fbc4e0391bb745027023a7edbc38f2a60fc3b68f006efb85eb',
  '556329e4245ec4889c33b29262c85335a082c2e25cd08b69ff46e17e70b785ec',
  'a2603c88443af5152585f3f836832a67551e3ecad0e47a435c8d6510aa31c843',
  '24b45900a92fbc4527ccf975bd416988e444c6e4d9f364c5158667f077623fe2',
];

// Relays to query
const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://e.nos.lol',
];

/**
 * Convert npub to hex pubkey
 */
function npubToHex(npub) {
  try {
    if (!npub) return null;
    if (!npub.startsWith('npub')) return npub; // Already hex
    const decoded = nip19.decode(npub);
    return decoded.data;
  } catch (e) {
    return null;
  }
}

/**
 * Fetch all unique participant pubkeys from Supabase
 */
async function fetchAllParticipantPubkeys() {
  console.log('Fetching participants from Supabase...');

  const url = `${SUPABASE_URL}/rest/v1/competition_participants?select=npub`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch participants: ${response.status}`);
  }

  const participants = await response.json();
  const pubkeys = new Set();

  for (const p of participants) {
    const hex = npubToHex(p.npub);
    if (hex) {
      pubkeys.add(hex);
    }
  }

  console.log(`  Found ${participants.length} participant records`);
  console.log(`  Decoded ${pubkeys.size} unique hex pubkeys`);

  return pubkeys;
}

/**
 * Parse workout data from a kind 1301 event
 */
function parseWorkoutEvent(event) {
  const tags = event.tags || [];
  const getTag = (name) => tags.find((t) => t[0] === name)?.[1];

  const activityType = getTag('exercise') || 'other';

  // Distance
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

  // Duration
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

  return { activityType, distanceMeters, durationSeconds, calories };
}

/**
 * Extract plain Nostr event data
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
        source: 'nostr_scan',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `HTTP ${response.status}` };
    }

    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Main sync function
 */
async function syncWorkouts() {
  console.log('='.repeat(60));
  console.log('  Universal Competition Workout Sync');
  console.log('='.repeat(60));
  console.log(`\nSince: ${new Date(SEASON_2_START * 1000).toISOString()}\n`);

  // Step 1: Get all participant pubkeys
  console.log('Step 1: Gathering participant pubkeys\n');

  const supabasePubkeys = await fetchAllParticipantPubkeys();

  // Combine with Season II fallback
  const allPubkeys = new Set([...SEASON_2_PUBKEYS, ...supabasePubkeys]);
  console.log(`\nTotal unique pubkeys to sync: ${allPubkeys.size}`);
  console.log(`  - Season II hardcoded: ${SEASON_2_PUBKEYS.length}`);
  console.log(`  - From Supabase: ${supabasePubkeys.size}`);
  console.log(`  - New (not in Season II): ${supabasePubkeys.size - (new Set([...SEASON_2_PUBKEYS].filter(p => supabasePubkeys.has(p)))).size}`);

  // Step 2: Connect to Nostr relays
  console.log('\nStep 2: Connecting to Nostr relays\n');

  const ndk = new NDK({ explicitRelayUrls: RELAYS });

  try {
    const connectPromise = ndk.connect();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    );
    await Promise.race([connectPromise, timeoutPromise]);
    console.log('NDK connected');
  } catch (err) {
    console.warn('Warning: NDK connect issue:', err.message);
    console.log('Continuing anyway...');
  }

  // Wait for relay connections
  console.log('Waiting for relay connections...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Step 3: Fetch kind 1301 events
  console.log('\nStep 3: Fetching workout events from Nostr\n');

  const filter = {
    kinds: [1301],
    authors: [...allPubkeys],
    since: SEASON_2_START,
  };

  console.log('Fetching events...');
  const events = await ndk.fetchEvents(filter);
  console.log(`Found ${events.size} workout events\n`);

  // Step 4: Submit to Supabase
  console.log('Step 4: Submitting to Supabase\n');

  const stats = {
    total: events.size,
    submitted: 0,
    duplicates: 0,
    flagged: 0,
    errors: 0,
  };

  let processed = 0;
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
    } else {
      stats.errors++;
      process.stdout.write('x');
    }

    processed++;
    if (processed % 50 === 0) {
      process.stdout.write(` [${processed}/${events.size}]\n`);
    }

    // Rate limit
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('  SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`\nTotal events:    ${stats.total}`);
  console.log(`New submissions: ${stats.submitted}`);
  console.log(`Duplicates:      ${stats.duplicates}`);
  console.log(`Flagged:         ${stats.flagged}`);
  console.log(`Errors:          ${stats.errors}`);

  if (stats.submitted > 0) {
    console.log(`\n${stats.submitted} new workouts synced to Supabase!`);
  }

  process.exit(0);
}

// Run
syncWorkouts().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
