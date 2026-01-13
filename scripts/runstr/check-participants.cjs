#!/usr/bin/env node
/**
 * Find Non-Season II Participants
 *
 * Queries Supabase competition_participants to find users who:
 * - Joined competitions (Running Bitcoin, January Walking, Einundzwanzig)
 * - Are NOT in the hardcoded Season II participants list
 *
 * These participants' workouts are NOT being synced by the current
 * sync-season2-workouts.cjs script - this is the gap we need to fix.
 *
 * Usage: node scripts/diagnostics/find-non-season2-participants.cjs
 */

require('dotenv').config();
const { nip19 } = require('nostr-tools');

// Supabase configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables');
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Season II participants (hex pubkeys) - copied from sync-season2-workouts.cjs
const SEASON_2_PUBKEYS = new Set([
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
]);

/**
 * Convert npub to hex pubkey
 */
function npubToHex(npub) {
  try {
    if (!npub.startsWith('npub')) return npub; // Already hex
    const decoded = nip19.decode(npub);
    return decoded.data;
  } catch (e) {
    return null;
  }
}

/**
 * Fetch all competitions
 */
async function fetchCompetitions() {
  const url = `${SUPABASE_URL}/rest/v1/competitions?select=id,external_id,name`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  return response.json();
}

/**
 * Fetch all participants for a competition
 */
async function fetchParticipants(competitionId) {
  const url = `${SUPABASE_URL}/rest/v1/competition_participants?competition_id=eq.${competitionId}&select=npub,name,picture`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  return response.json();
}

async function main() {
  console.log('='.repeat(60));
  console.log('  Non-Season II Participant Finder');
  console.log('='.repeat(60));
  console.log(`\nSeason II participants: ${SEASON_2_PUBKEYS.size}`);

  // Fetch all competitions
  const competitions = await fetchCompetitions();
  console.log(`Competitions found: ${competitions.length}\n`);

  const nonSeason2ByCompetition = {};
  const allNonSeason2Pubkeys = new Set();

  for (const comp of competitions) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Competition: ${comp.name || comp.external_id}`);
    console.log(`ID: ${comp.external_id}`);
    console.log('─'.repeat(50));

    const participants = await fetchParticipants(comp.id);
    console.log(`Total registered: ${participants.length}`);

    const nonSeason2 = [];

    for (const p of participants) {
      const hexPubkey = npubToHex(p.npub);
      if (!hexPubkey) {
        console.log(`  Warning: Could not decode npub: ${p.npub?.slice(0, 20)}...`);
        continue;
      }

      if (!SEASON_2_PUBKEYS.has(hexPubkey)) {
        nonSeason2.push({
          npub: p.npub,
          hexPubkey,
          name: p.name || 'Unknown',
        });
        allNonSeason2Pubkeys.add(hexPubkey);
      }
    }

    nonSeason2ByCompetition[comp.external_id] = nonSeason2;

    if (nonSeason2.length === 0) {
      console.log('  All participants are Season II members');
    } else {
      console.log(`  NON-Season II: ${nonSeason2.length}`);
      for (const p of nonSeason2) {
        console.log(`    - ${p.name} (${p.npub.slice(0, 15)}...)`);
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  console.log(`\nSeason II participants: ${SEASON_2_PUBKEYS.size}`);
  console.log(`Non-Season II participants found: ${allNonSeason2Pubkeys.size}`);

  if (allNonSeason2Pubkeys.size > 0) {
    console.log('\nThese users joined competitions but their workouts are');
    console.log('NOT being synced by sync-season2-workouts.cjs!');
    console.log('\nHex pubkeys for sync script:');
    for (const hex of allNonSeason2Pubkeys) {
      console.log(`  '${hex}',`);
    }
  } else {
    console.log('\nAll competition participants are Season II members.');
  }

  console.log('\n');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
