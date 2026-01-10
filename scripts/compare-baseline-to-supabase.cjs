const { createClient } = require('@supabase/supabase-js');
const { nip19 } = require('nostr-tools');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

// Copy of SEASON2_BASELINE (hex pubkeys -> running distance)
const BASELINE_RUNNING = {
  '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5': 26.28, // TheWildHustle
  '745eb529d0e42d2fa6c904bbc2c10702deae964b4dd3079803ab8b43536dda12': 87.07, // guy
  'dae73fdd90d98db1a8405bcecac60cd6ce8d10896a6a2c5e04011125e16cd432': 25.63, // Lhasa Sensei
  '43256bc0859462cf14fa7de594a48babdf189b91abe27f88d824abf69b2343c9': 45.04, // LOPES
  '6b42a3b227b086e850ff659a151863ce070eb60d32bae8a4618928655effc3f6': 83.07, // JokerHasse
  '02734f19cae7850e7bca6c0a2bb6a534f152d5acbd86eece1d2bfbd5d6502003': 8.91,  // bitcoin_rene
  '5a654b6394bb83ecc1b95f848d6bc44e6d21120de5d832040704d9823b2c0af4': 8.15,  // Drew
  '5d405752c1b4ddd0714baf3ce415db52e5506036f345ff575ee16e2b4cf189bf': 34.06, // Heiunter
  'ea28488b659ab6433167cd024eb72e01a375ac17ce54a1cdc6e5dce2f6d93923': 37.87, // johnny9
  'c6f0f4279f12200f77e1943cd26aaedf6081fda8585695f9a923b4723686da12': 8.66,  // Tumbleweed
  '7ebbce1843a17cd778a5e169e3d2f679f5ac7b5125d1c43d265e190f7b27538c': 42.20, // Adrien Lacombe
  '86f7eea066dd4dc574d01b0f9317a03508887f815fb58d8ef66873cc42fe3431': 16.22, // Taljarn
  '0418ca2d6cd6c7fbc4e0391bb745027023a7edbc38f2a60fc3b68f006efb85eb': 17.85, // saiy2k
  '24b45900a92fbc4527ccf975bd416988e444c6e4d9f364c5158667f077623fe2': 4.96,  // Jose Sammut
};

async function compare() {
  console.log('=== COMPARING BASELINE TO SUPABASE ===\n');

  // Get all workout submissions
  const { data: workouts } = await supabase
    .from('workout_submissions')
    .select('npub, distance_meters, activity_type, raw_event')
    .eq('activity_type', 'running');

  console.log('Supabase running workouts:', workouts?.length);

  // Create a map of npub -> distance in Supabase
  const supabaseMap = new Map();
  workouts?.forEach(w => {
    supabaseMap.set(w.npub, {
      distance: w.distance_meters,
      raw: w.raw_event
    });
  });

  // Convert baseline hex keys to npubs and compare
  console.log('\n=== BASELINE VS SUPABASE ===');
  console.log('Format: Name | Expected | Supabase | Status\n');

  for (const [hex, expectedKm] of Object.entries(BASELINE_RUNNING)) {
    // Convert hex to npub
    const npub = nip19.npubEncode(hex);
    const supabaseData = supabaseMap.get(npub);
    const supabaseKm = supabaseData ? (supabaseData.distance / 1000).toFixed(2) : 'MISSING';

    const status = supabaseData ?
      (Math.abs(supabaseData.distance / 1000 - expectedKm) < 0.1 ? '✅' : '⚠️ MISMATCH') :
      '❌ MISSING';

    console.log(`${npub.slice(0, 20)}... | ${expectedKm.toFixed(2)}km | ${supabaseKm}km | ${status}`);
  }

  // Also check if there are extra entries in Supabase not in baseline
  console.log('\n=== SUPABASE ENTRIES NOT IN BASELINE ===');
  for (const [npub, data] of supabaseMap.entries()) {
    // Convert npub to hex to check
    try {
      const decoded = nip19.decode(npub);
      if (decoded.type === 'npub' && !BASELINE_RUNNING[decoded.data]) {
        console.log(`${npub.slice(0, 20)}... : ${(data.distance / 1000).toFixed(2)}km`);
      }
    } catch (e) {
      console.log(`Invalid npub: ${npub}`);
    }
  }
}

compare().catch(console.error);
