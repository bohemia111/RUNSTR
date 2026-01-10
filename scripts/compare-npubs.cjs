const { createClient } = require('@supabase/supabase-js');
const { nip19 } = require('nostr-tools');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

// Hardcoded participants (hex pubkey -> name)
const HARDCODED_HEX = {
  '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5': 'TheWildHustle',
  '745eb529d0e42d2fa6c904bbc2c10702deae964b4dd3079803ab8b43536dda12': 'guy',
  'dae73fdd90d98db1a8405bcecac60cd6ce8d10896a6a2c5e04011125e16cd432': 'Lhasa Sensei',
  '43256bc0859462cf14fa7de594a48babdf189b91abe27f88d824abf69b2343c9': 'LOPES',
  '6b42a3b227b086e850ff659a151863ce070eb60d32bae8a4618928655effc3f6': 'JokerHasse',
  'ea28488b659ab6433167cd024eb72e01a375ac17ce54a1cdc6e5dce2f6d93923': 'johnny9',
};

// Hardcoded npubs from SEASON_2_PARTICIPANTS
const HARDCODED_NPUBS = {
  'TheWildHustle': 'npub1xr8tvnnnr9aqt9vv30vj4vreeq2mk38mlwe7khvhvmzjqlcghh6su4k5s3',
  'guy': 'npub1w30t22wsuskjlfkfqjau9sg8qt02a9jtfhfs0xqr4w95x5mdmgfqh9wmvk',
  'Lhasa Sensei': 'npub1mtnnlhvsmxxmr2zqt08v43sv6m8g6yyfdf4zchsyqygjtctv6seq7hnr4e',
  'LOPES': 'npub1gvjkhsy9j33v79860hjeffyt40033xu34038lzxcyj4ldxerg0ys0rzhg3',
  'JokerHasse': 'npub1ddp28v38kzrws58lvkdp2xrrecrsadsdx2aw3frp3y5x2hhlc0mqtzvsf9',
  'johnny9': 'npub1ag5y3zm9n2myxvt8e5pyadewq86n4vpuu54psum7jhhzahnvfy3s2k5wjj',
};

async function compare() {
  console.log('=== COMPARING NPUBS ===\n');

  // Get workouts with npubs
  const { data: workouts } = await supabase
    .from('workout_submissions')
    .select('npub, distance_meters')
    .eq('activity_type', 'running')
    .limit(20);

  console.log('Format: Name | Correct npub (from hex) | Supabase npub | Hardcoded npub | Match?\n');

  for (const [hex, name] of Object.entries(HARDCODED_HEX)) {
    // What npub SHOULD be (from hex)
    const correctNpub = nip19.npubEncode(hex);

    // What's in Supabase
    const supabaseWorkout = workouts?.find(w => {
      try {
        const decoded = nip19.decode(w.npub);
        return decoded.type === 'npub' && decoded.data === hex;
      } catch {
        return false;
      }
    });
    const supabaseNpub = supabaseWorkout?.npub || 'NOT FOUND';

    // What's hardcoded in SEASON_2_PARTICIPANTS
    const hardcodedNpub = HARDCODED_NPUBS[name] || 'NOT FOUND';

    // Check if they match
    const supabaseMatch = supabaseNpub === correctNpub ? '✅' : '❌';
    const hardcodedMatch = hardcodedNpub === correctNpub ? '✅' : '❌';

    console.log(`${name}:`);
    console.log(`  Correct (from hex): ${correctNpub}`);
    console.log(`  Supabase:          ${supabaseNpub} ${supabaseMatch}`);
    console.log(`  Hardcoded:         ${hardcodedNpub} ${hardcodedMatch}`);

    if (supabaseNpub !== hardcodedNpub) {
      console.log(`  ⚠️  MISMATCH between Supabase and Hardcoded!`);
    }
    console.log('');
  }
}

compare().catch(console.error);
