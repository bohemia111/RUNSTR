/**
 * Migrate ALL Season 2 Participants to Supabase
 *
 * This script imports ALL 44 users from SEASON_2_PARTICIPANTS, not just
 * those with workouts in the baseline. Users with baseline data get their
 * workout totals, others get added as participants with 0 distance.
 *
 * Run with: node scripts/migrate-all-participants.cjs
 *
 * IMPORTANT: Competition dates must be updated to 2026 in Supabase dashboard first!
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

// Competition external IDs
const COMPETITION_IDS = {
  running: 'season2-running',
  walking: 'season2-walking',
  cycling: 'season2-cycling',
};

// Baseline timestamp from season2Baseline.ts
const BASELINE_TIMESTAMP = 1767875581; // 2026-01-08T12:33:01.000Z

// ============================================================================
// SEASON_2_PARTICIPANTS (44 users) - from src/constants/season2.ts
// ============================================================================
const SEASON_2_PARTICIPANTS = [
  { pubkey: '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5', npub: 'npub1xr8tvnnnr9aqt9vv30vj4vreeq2mk38mlwe7khvhvmzjqlcghh6su4k5s3', name: 'TheWildHustle' },
  { pubkey: '745eb529d0e42d2fa6c904bbc2c10702deae964b4dd3079803ab8b43536dda12', npub: 'npub1w30t22wsuskjlfkfqjau9sg8qt02a9jtfhfs0xqr4w95x5mdmgfqh9wmvk', name: 'guy' },
  { pubkey: 'dae73fdd90d98db1a8405bcecac60cd6ce8d10896a6a2c5e04011125e16cd432', npub: 'npub1mtnnlhvsmxxmr2zqt08v43sv6m8g6yyfdf4zchsyqygjtctv6seq7hnr4e', name: 'Lhasa Sensei' },
  { pubkey: '43256bc0859462cf14fa7de594a48babdf189b91abe27f88d824abf69b2343c9', npub: 'npub1gvjkhsy9j33v79860hjeffyt40033xu34038lzxcyj4ldxerg0ys0rzhg3', name: 'LOPES' },
  { pubkey: 'e7df627c638d934b37548d8408b43dc5d4762fa270c26abec5916bff62aac80d', npub: 'npub1ul0kylrr3kf5kd653kzq3dpach28vtazwrpx40k9j94l7c42eqxs0evjpr', name: 'KjetilR' },
  { pubkey: '9358c67695d9e78bde2bf3ce1eb0a5059553687632a177e7d25deeff9f2912fc', npub: 'npub1jdvvva54m8nchh3t708pav99qk24x6rkx2sh0e7jthh0l8efzt7q6ku6nc', name: 'Kamo Weasel' },
  { pubkey: 'c9943d8f8e9c2aa9facb6e579af6ec38b7205c0570de1b0fb8f99f65dc5f786e', npub: 'npub1ex2rmruwns42n7ktdete4ahv8zmjqhq9wr0pkraclx0kthzl0phqc2jgf3', name: 'Zed' },
  { pubkey: '6b42a3b227b086e850ff659a151863ce070eb60d32bae8a4618928655effc3f6', npub: 'npub1ddp28v38kzrws58lvkdp2xrrecrsadsdx2aw3frp3y5x2hhlc0mqtzvsf9', name: 'JokerHasse' },
  { pubkey: '0c252c138ee446b6f9c0964ff609380fc82e52c8d318529607f293fcdf828bea', npub: 'npub1psjjcyuwu3rtd7wqje8lvzfcplyzu5kg6vv999s872flehuz304qyshhjt', name: 'Busch21' },
  { pubkey: 'c8b22b81877eaa54e1ab21e39824f85a29e61f71da9fbabbef8930b171b98da8', npub: 'npub1ezezhqv80649fcdty83esf8ctg57v8m3m20m4wl03yctzude3k5qt0hrng', name: 'Hoov' },
  { pubkey: '8ce975f57dd070c4293ff8f978b869e20b2cdf4c81f277b46f3676b262c5e823', npub: 'npub13n5htata6pcvg2fllruh3wrfug9jeh6vs8e80dr0xemtyck9aq3sk9rkxm', name: 'clemsy' },
  { pubkey: '9fce3aea32b35637838fb45b75be32595742e16bb3e4742cc82bb3d50f9087e6', npub: 'npub1nl8r463jkdtr0qu0k3dht03jt9t59cttk0j8gtxg9wea2russlnq4stdp9', name: 'MAKE SONGS LONGER' },
  { pubkey: 'e5237023a5c0929e7ae0e5128d41a8213138400ec110dbe9d8a29278f22b7c13', npub: 'npub1u53hqga9czffu7hqu5fg6sdgyycnssqwcygdh6wc52f83u3t0sfs5n3285', name: 'Helen Yrmom' },
  { pubkey: '02734f19cae7850e7bca6c0a2bb6a534f152d5acbd86eece1d2bfbd5d6502003', npub: 'npub1qfe57xw2u7zsu772ds9zhd49xnc494dvhkrwansa90aat4jsyqps0p2rtz', name: 'bitcoin_rene' },
  { pubkey: '939ffb4e552ed5c0fa780985ab7163f441798409ae7ed81c62c07ac4683b4222', npub: 'npub1jw0lknj49m2up7ncpxz6kutr73qhnpqf4elds8rzcpavg6pmgg3q357lzu', name: 'Johan' },
  { pubkey: '5a654b6394bb83ecc1b95f848d6bc44e6d21120de5d832040704d9823b2c0af4', npub: 'npub1tfj5kcu5hwp7esdet7zg667yfekjzysduhvrypq8qnvcywevpt6qf2ghml', name: 'Drew' },
  { pubkey: '5d405752c1b4ddd0714baf3ce415db52e5506036f345ff575ee16e2b4cf189bf', npub: 'npub1t4q9w5kpknwaqu2t4u7wg9wm2tj4qcpk7dzl7467u9hzkn833xlsfwtaue', name: 'Heiunter' },
  { pubkey: '14ca97caaea1565dc3f8277394a8f7d03364745a8d18536d8423dbac3f363b7f', npub: 'npub1zn9f0j4w59t9mslcyaeef28h6qekgaz635v9xmvyy0d6c0ek8dlsly9kq3', name: 'Satty' },
  { pubkey: 'de7ab932ca17278b2144a6628c3531a0628fcc7b58074111d6e5b949ecb0e377', npub: 'npub1meatjvk2zunckg2y5e3gcdf35p3glnrmtqr5zywkuku5nm9sudms5u3qna', name: "Harambe's last Bitcoin" },
  { pubkey: 'a80fc4a78634ee26aabcac951b4cfd7b56ae18babd33c5afdcf6bed6dc80ebd1', npub: 'npub14q8uffuxxnhzd24u4j23kn8a0dt2ux96h5eutt7u76lddhyqa0gs6v6rxv', name: 'Uno' },
  { pubkey: 'a723805cda67251191c8786f4da58f797e6977582301354ba8e91bcb0342dc9c', npub: 'npub15u3cqhx6vuj3rywg0ph5mfv009lxja6cyvqn2jagaydukq6zmjwqx5du02', name: 'Seth' },
  { pubkey: '0ae9dc5f42febd11c5c895b0af0bbabbe02261591b0f24eefe22c0d9ca8d0286', npub: 'npub1pt5ach6zl673r3wgjkc27za6h0szyc2erv8jfmh7ytqdnj5dq2rqr0v59g', name: 'MoonKaptain' },
  { pubkey: 'fad80b7451b03f686fd9e487b05b69c04c808e26a1db655e59e0e296a5c9f4dd', npub: 'npub1ltvqkaz3kqlksm7eujrmqkmfcpxgpr3x58dk2hjeur3fdfwf7nwsczqlzs', name: 'means' },
  { pubkey: 'a9046cc9175dc5a45fb93a2c890f9a8b18c707fa6d695771aab9300081d3e21a', npub: 'npub14yzxejghthz6ghae8gkgjru63vvvwpl6d454wud2hycqpqwnugdq8wf5z7', name: 'Ben Cousens' },
  { pubkey: '20d29810d6a5f92b045ade02ebbadc9036d741cc686b00415c42b4236fe4ad2f', npub: 'npub1yrffsyxk5hujkpz6mcpwhwkujqmdwswvdp4sqs2ugz6zxmly45hskn30d9', name: 'negr0' },
  { pubkey: 'ea28488b659ab6433167cd024eb72e01a375ac17ce54a1cdc6e5dce2f6d93923', npub: 'npub1ag5y3zm9n2myxvt8e5pyadewqx3httqhee22rnwxuhww9ake8y3slsekr3', name: 'johnny9' },
  { pubkey: 'c6f0f4279f12200f77e1943cd26aaedf6081fda8585695f9a923b4723686da12', npub: 'npub1cmc0gfulzgsq7alpjs7dy64wmasgrldgtptft7dfyw68yd5xmgfqzm83ee', name: 'Tumbleweed' },
  { pubkey: '661305095522a18a1095b7b86874ef618da9c5d1ba5f4af375688e2129c07317', npub: 'npub1vcfs2z24y2sc5yy4k7uxsa80vxx6n3w3hf054um4dz8zz2wqwvtshe5wgy', name: 'Ajax' },
  { pubkey: '933a52008116743cd652eca47209f57e4ca4c439d8c2526d8c48a47bf7072ec7', npub: 'npub1jva9yqypze6re4jjajj8yz040ex2f3pemrp9ymvvfzj8hac89mrsank3qs', name: 'Nell' },
  { pubkey: '312f54da0da1cf0cdcf1d6385fa8d6e5d8218f7122297d30b22482edada44649', npub: 'npub1xyh4fksd588seh836cu9l2xkuhvzrrm3yg5h6v9jyjpwmtdygeyshmhkpr', name: 'HumbleStacker' },
  { pubkey: '9416112efa3cdc0675156e4cb6ae46b2cca51973065c61bcbc002ca99e5dcdf2', npub: 'npub1jstpzth68nwqvag4dextdtjxktx22xtnqewxr09uqqk2n8jaeheqt0t98c', name: 'Lat51_Training' },
  { pubkey: '0f563fe2cfdf180cb104586b95873379a0c1fdcfbc301a80c8255f33d15f039d', npub: 'npub1patrlck0muvqevgytp4etpen0xsvrlw0hscp4qxgy40n852lqwwsav8lfh', name: 'Patrick' },
  { pubkey: 'd84517802a434757c56ae8642bffb4d26e5ade0712053750215680f5896e579b', npub: 'npub1mpz30qp2gdr403t2apjzhla56fh94hs8zgznw5pp26q0tztw27dsrgdf23', name: 'ObjectiF MooN' },
  { pubkey: 'eeb11961b25442b16389fe6c7ebea9adf0ac36dd596816ea7119e521b8821b9e', npub: 'npub1a6c3jcdj23ptzcuflek8a04f4hc2cdkat95pd6n3r8jjrwyzrw0q2rap0f', name: 'OpenMike' },
  { pubkey: '81b91540daeee031df309460a9bcf5866a54c70217ff173bcdefd1982f12b0ba', npub: 'npub1sxu32sx6amsrrhesj3s2n084se49f3czzll3ww7dalgestcjkzaqk0np8e', name: 'Aaron Tomac' },
  { pubkey: '7ebbce1843a17cd778a5e169e3d2f679f5ac7b5125d1c43d265e190f7b27538c', npub: 'npub106auuxzr597dw799u95785hk0866c763yhgug0fxtcvs77e82wxq006usr', name: 'Adrien Lacombe' },
  { pubkey: '179154c2b30226578a14ac5a01f50a3efde8d14032df96371550e1210fffd892', npub: 'npub1z7g4fs4nqgn90zs543dqrag28m77352qxt0evdc42rsjzrllmzfqjd8jyn', name: 'Awakening Mind' },
  { pubkey: '1f698bd4b5dda804316f09773f903ca699cf5b2a0fcd5b3fe6e0709668d58e60', npub: 'npub1ra5ch494mk5qgvt0p9mnlypu56vu7ke2plx4k0lxupcfv6x43esquthtqv', name: 'Dani' },
  { pubkey: '86f7eea066dd4dc574d01b0f9317a03508887f815fb58d8ef66873cc42fe3431', npub: 'npub1smm7agrxm4xu2axsrv8ex9aqx5ygslupt76cmrhkdpeucsh7xscsj4qhjs', name: 'Taljarn' },
  { pubkey: '0418ca2d6cd6c7fbc4e0391bb745027023a7edbc38f2a60fc3b68f006efb85eb', npub: 'npub1qsvv5ttv6mrlh38q8ydmw3gzwq360mdu8re2vr7rk68sqmhmsh4sn9jp8m', name: 'saiy2k' },
  { pubkey: '556329e4245ec4889c33b29262c85335a082c2e25cd08b69ff46e17e70b785ec', npub: 'npub1243jnepytmzg38pnk2fx9jznxksg9shztnggk60lgmshuu9hshkqal4uty', name: 'OrangePillosophy' },
  { pubkey: 'a2603c88443af5152585f3f836832a67551e3ecad0e47a435c8d6510aa31c843', npub: 'npub15fsrezzy8t632fv970urdqe2va23u0k26rj85s6u34j3p233eppsefuh68', name: 'Carol' },
  { pubkey: '24b45900a92fbc4527ccf975bd416988e444c6e4d9f364c5158667f077623fe2', npub: 'npub1yj69jq9f977y2f7vl96m6stf3rjyf3hym8ekf3g4senlqamz8l3qkzwl65', name: 'Jose Sammut' },
];

// ============================================================================
// SEASON2_BASELINE (28 users with workouts) - from src/constants/season2Baseline.ts
// ============================================================================
const SEASON2_BASELINE = {
  '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5': {
    running: { distance: 26.28, duration: 8342, count: 3 },
    walking: { distance: 0.0, duration: 0, count: 0 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  '745eb529d0e42d2fa6c904bbc2c10702deae964b4dd3079803ab8b43536dda12': {
    running: { distance: 87.07, duration: 35240, count: 10 },
    walking: { distance: 13.9, duration: 11711, count: 6 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  'dae73fdd90d98db1a8405bcecac60cd6ce8d10896a6a2c5e04011125e16cd432': {
    running: { distance: 25.63, duration: 11190, count: 1 },
    walking: { distance: 0.0, duration: 0, count: 0 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  '43256bc0859462cf14fa7de594a48babdf189b91abe27f88d824abf69b2343c9': {
    running: { distance: 45.04, duration: 18263, count: 15 },
    walking: { distance: 2.21, duration: 2373, count: 3 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  'e7df627c638d934b37548d8408b43dc5d4762fa270c26abec5916bff62aac80d': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 41.76, duration: 27846, count: 9 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  '6b42a3b227b086e850ff659a151863ce070eb60d32bae8a4618928655effc3f6': {
    running: { distance: 83.07, duration: 38264, count: 7 },
    walking: { distance: 0.0, duration: 0, count: 0 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  '0c252c138ee446b6f9c0964ff609380fc82e52c8d318529607f293fcdf828bea': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 6.39, duration: 3271, count: 1 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  'c8b22b81877eaa54e1ab21e39824f85a29e61f71da9fbabbef8930b171b98da8': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 20.64, duration: 15008, count: 4 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  '9fce3aea32b35637838fb45b75be32595742e16bb3e4742cc82bb3d50f9087e6': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 0.0, duration: 172, count: 1 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  'e5237023a5c0929e7ae0e5128d41a8213138400ec110dbe9d8a29278f22b7c13': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 60.85, duration: 324428, count: 20 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  '02734f19cae7850e7bca6c0a2bb6a534f152d5acbd86eece1d2bfbd5d6502003': {
    running: { distance: 8.91, duration: 3709, count: 1 },
    walking: { distance: 31.1, duration: 25514, count: 6 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  '5a654b6394bb83ecc1b95f848d6bc44e6d21120de5d832040704d9823b2c0af4': {
    running: { distance: 8.15, duration: 2766, count: 2 },
    walking: { distance: 2.27, duration: 5143, count: 2 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  '5d405752c1b4ddd0714baf3ce415db52e5506036f345ff575ee16e2b4cf189bf': {
    running: { distance: 34.06, duration: 11511, count: 3 },
    walking: { distance: 7.88, duration: 6336, count: 2 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  'a80fc4a78634ee26aabcac951b4cfd7b56ae18babd33c5afdcf6bed6dc80ebd1': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 12.94, duration: 88052, count: 4 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  'a723805cda67251191c8786f4da58f797e6977582301354ba8e91bcb0342dc9c': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 3.78, duration: 3014, count: 1 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  'fad80b7451b03f686fd9e487b05b69c04c808e26a1db655e59e0e296a5c9f4dd': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 34.49, duration: 34348, count: 9 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  '20d29810d6a5f92b045ade02ebbadc9036d741cc686b00415c42b4236fe4ad2f': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 11.28, duration: 87602, count: 4 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  'ea28488b659ab6433167cd024eb72e01a375ac17ce54a1cdc6e5dce2f6d93923': {
    running: { distance: 37.87, duration: 17237, count: 6 },
    walking: { distance: 5.42, duration: 6584, count: 3 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  'c6f0f4279f12200f77e1943cd26aaedf6081fda8585695f9a923b4723686da12': {
    running: { distance: 8.66, duration: 3244, count: 2 },
    walking: { distance: 0.0, duration: 0, count: 0 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  '661305095522a18a1095b7b86874ef618da9c5d1ba5f4af375688e2129c07317': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 0.0, duration: 0, count: 0 },
    cycling: { distance: 7.53, duration: 3192, count: 3 },
  },
  '0f563fe2cfdf180cb104586b95873379a0c1fdcfbc301a80c8255f33d15f039d': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 3.25, duration: 3036, count: 2 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  'd84517802a434757c56ae8642bffb4d26e5ade0712053750215680f5896e579b': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 4.73, duration: 448114, count: 8 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  '81b91540daeee031df309460a9bcf5866a54c70217ff173bcdefd1982f12b0ba': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 9.1, duration: 15482, count: 7 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  '7ebbce1843a17cd778a5e169e3d2f679f5ac7b5125d1c43d265e190f7b27538c': {
    running: { distance: 42.2, duration: 17589, count: 5 },
    walking: { distance: 0.0, duration: 0, count: 0 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  '86f7eea066dd4dc574d01b0f9317a03508887f815fb58d8ef66873cc42fe3431': {
    running: { distance: 16.22, duration: 7010, count: 2 },
    walking: { distance: 0.0, duration: 270413, count: 4 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  '0418ca2d6cd6c7fbc4e0391bb745027023a7edbc38f2a60fc3b68f006efb85eb': {
    running: { distance: 17.85, duration: 7856, count: 4 },
    walking: { distance: 0.0, duration: 0, count: 0 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  '556329e4245ec4889c33b29262c85335a082c2e25cd08b69ff46e17e70b785ec': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 4.84, duration: 4885, count: 2 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  '24b45900a92fbc4527ccf975bd416988e444c6e4d9f364c5158667f077623fe2': {
    running: { distance: 4.96, duration: 1370, count: 1 },
    walking: { distance: 0.0, duration: 0, count: 0 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
};

async function getCompetitionId(externalId) {
  const { data, error } = await supabase
    .from('competitions')
    .select('id')
    .eq('external_id', externalId)
    .single();

  if (error || !data) {
    console.error(`Competition not found: ${externalId}`);
    return null;
  }
  return data.id;
}

async function migrate() {
  console.log('\n========================================');
  console.log('  MIGRATE ALL 44 SEASON II PARTICIPANTS');
  console.log('========================================\n');

  console.log(`Total participants to migrate: ${SEASON_2_PARTICIPANTS.length}`);
  console.log(`Users with baseline workouts: ${Object.keys(SEASON2_BASELINE).length}\n`);

  // Get competition UUIDs
  const competitionIds = {};
  for (const [activity, externalId] of Object.entries(COMPETITION_IDS)) {
    const id = await getCompetitionId(externalId);
    if (id) {
      competitionIds[activity] = id;
      console.log(`Found: ${externalId} → ${id}`);
    }
  }

  if (Object.keys(competitionIds).length === 0) {
    console.error('\nNo competitions found. Create them first.');
    return;
  }

  const stats = {
    participantsAdded: 0,
    workoutsAdded: 0,
    errors: [],
  };

  console.log('\n--- Processing Users ---\n');

  for (const participant of SEASON_2_PARTICIPANTS) {
    const baseline = SEASON2_BASELINE[participant.pubkey];
    const hasBaseline = !!baseline;

    console.log(`${participant.name} (${hasBaseline ? 'has baseline' : 'no baseline'})`);

    // Add as participant to ALL 3 competitions
    for (const [activity, competitionId] of Object.entries(competitionIds)) {
      const { error: participantError } = await supabase
        .from('competition_participants')
        .upsert(
          {
            competition_id: competitionId,
            npub: participant.npub,
            joined_at: new Date(BASELINE_TIMESTAMP * 1000).toISOString(),
          },
          { onConflict: 'competition_id,npub' }
        );

      if (participantError) {
        stats.errors.push(`Participant error for ${participant.name}: ${participantError.message}`);
      } else {
        stats.participantsAdded++;
      }
    }

    // Add workouts for users with baseline data
    if (hasBaseline) {
      for (const [activity, totals] of Object.entries(baseline)) {
        if (totals.distance === 0 && totals.count === 0) {
          continue; // Skip activities with no data
        }

        const baselineEventId = `baseline-${participant.pubkey}-${activity}`;

        const { error: workoutError } = await supabase
          .from('workout_submissions')
          .upsert(
            {
              npub: participant.npub,
              event_id: baselineEventId,
              activity_type: activity,
              distance_meters: totals.distance * 1000, // km → meters
              duration_seconds: totals.duration,
              calories: null,
              created_at: new Date(BASELINE_TIMESTAMP * 1000).toISOString(),
              raw_event: {
                type: 'baseline_migration',
                source: 'migrate-all-participants.cjs',
                migrated_at: new Date().toISOString(),
                original_hex_pubkey: participant.pubkey,
                workout_count: totals.count,
              },
            },
            { onConflict: 'event_id' }
          );

        if (workoutError) {
          stats.errors.push(`Workout error for ${participant.name} ${activity}: ${workoutError.message}`);
        } else {
          stats.workoutsAdded++;
          console.log(`   ✓ ${activity}: ${totals.distance.toFixed(2)} km`);
        }
      }
    }
  }

  console.log('\n========================================');
  console.log('           MIGRATION COMPLETE          ');
  console.log('========================================\n');
  console.log(`Participants added: ${stats.participantsAdded}`);
  console.log(`Workouts added: ${stats.workoutsAdded}`);

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    stats.errors.forEach((e) => console.log(`   - ${e}`));
  }

  // Verification
  console.log('\n--- Verification ---\n');

  const { count: participantCount } = await supabase
    .from('competition_participants')
    .select('*', { count: 'exact', head: true });

  console.log(`Total competition_participants: ${participantCount}`);

  const { data: workoutCounts } = await supabase
    .from('workout_submissions')
    .select('activity_type');

  const byType = {};
  workoutCounts?.forEach((w) => {
    byType[w.activity_type] = (byType[w.activity_type] || 0) + 1;
  });
  console.log('Workouts by type:', byType);

  // Check top 5 running
  console.log('\n--- Top 5 Running ---\n');
  const { data: topRunning } = await supabase
    .from('workout_submissions')
    .select('npub, distance_meters')
    .eq('activity_type', 'running')
    .order('distance_meters', { ascending: false })
    .limit(5);

  topRunning?.forEach((entry, i) => {
    const km = (entry.distance_meters / 1000).toFixed(2);
    console.log(`${i + 1}. ${entry.npub.slice(0, 20)}... - ${km} km`);
  });

  console.log('\nDone! All 44 participants are now in the database.');
  console.log('\n⚠️  IMPORTANT: Update competition dates in Supabase dashboard:');
  console.log('   Set start_date to 2026-01-01T00:00:00Z');
  console.log('   Set end_date to 2026-03-01T23:59:59Z');
}

migrate().catch(console.error);
