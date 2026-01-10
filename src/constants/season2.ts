/**
 * RUNSTR Season 2 Configuration Constants
 *
 * Two-month distance-based competition: January 1 - March 1, 2026
 * Prize pool: 500k sats bonus giveaway + 500k sats charity prizes
 */

import type { Season2Config, Season2Status } from '../types/season2';

// ============================================================================
// TEST MODE - Set to false before production release!
// ============================================================================
export const SEASON_2_TEST_MODE = false;

// RUNSTR admin pubkey (hex)
// npub1vygzr642y6f8gxcjx6auaf2vd25lyzarpjkwx9kr4y752zy6058s8jvy4e
const RUNSTR_ADMIN_PUBKEY =
  '611021eaaa2692741b1236bbcea54c6aa9f20ba30cace316c3a93d45089a7d0f';

export const SEASON_2_CONFIG: Season2Config = {
  startDate: '2026-01-01T00:00:00Z',
  endDate: '2026-03-01T23:59:59Z',
  entryFeeSats: 24000,
  prizePoolBonus: 500000, // 500k sats bonus giveaway
  prizePoolCharity: 500000, // 500k sats split 3 ways (~166k per category)
  adminPubkey: RUNSTR_ADMIN_PUBKEY,
  participantListDTag: 'runstr-season-2-participants',
  paymentUrl: 'https://www.runstr.club/pages/season2.html',
};

// AsyncStorage key for local joins
export const SEASON_2_LOCAL_JOINS_KEY = '@runstr:season2_local_joins';

// Payout tracking keys
export const SEASON_2_PAYOUT_KEY = '@runstr:season2_payout_completed';
export const SEASON_2_PAYOUT_RESULTS_KEY = '@runstr:season2_payout_results';

// Cache TTLs - 5 minutes to prevent stale/incomplete data from persisting
const FIVE_MINUTES_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
export const SEASON_2_CACHE_TTL = {
  PARTICIPANTS: Infinity,         // Never expires - hardcoded in app
  LEADERBOARD: FIVE_MINUTES_MS,   // 5 minutes - prevents bad data from persisting
  CHARITY_RANKINGS: FIVE_MINUTES_MS, // 5 minutes - same as leaderboard
};

/**
 * Get current season status based on date
 * In test mode: always returns 'active'
 */
export const getSeason2Status = (): Season2Status => {
  if (SEASON_2_TEST_MODE) {
    return 'active';
  }

  const now = Date.now();
  const startTime = new Date(SEASON_2_CONFIG.startDate).getTime();
  const endTime = new Date(SEASON_2_CONFIG.endDate).getTime();

  if (now < startTime) return 'upcoming';
  if (now > endTime) return 'ended';
  return 'active';
};

/**
 * Check if season is currently active
 */
export const isSeason2Active = (): boolean => {
  return getSeason2Status() === 'active';
};

/**
 * Get formatted date range for display
 * Uses UTC methods to avoid timezone issues
 */
export const getSeason2DateRange = (): string => {
  const start = new Date(SEASON_2_CONFIG.startDate);
  const end = new Date(SEASON_2_CONFIG.endDate);

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const formatDate = (d: Date) => {
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  };

  return `${formatDate(start)} - ${formatDate(end)}`;
};

/**
 * Get timestamp range for Nostr queries
 * In test mode: uses last 30 days
 * In production: uses Season 2 date range
 */
export const getSeason2Timestamps = (): { since: number; until: number } => {
  if (SEASON_2_TEST_MODE) {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
    console.log('[Season2] TEST MODE: Using last 30 days for workout queries');
    return { since: thirtyDaysAgo, until: now };
  }

  return {
    since: Math.floor(new Date(SEASON_2_CONFIG.startDate).getTime() / 1000),
    until: Math.floor(new Date(SEASON_2_CONFIG.endDate).getTime() / 1000),
  };
};

/**
 * Format prize amounts for display
 */
export const formatSats = (sats: number): string => {
  if (sats >= 1000000) {
    return `${(sats / 1000000).toFixed(1)}M sats`;
  }
  if (sats >= 1000) {
    return `${(sats / 1000).toFixed(0)}k sats`;
  }
  return `${sats} sats`;
};

// ============================================================================
// HARDCODED SEASON 2 PARTICIPANTS
// Generated on: 2025-12-28
// This eliminates kind 30000 and kind 0 fetches - only kind 1301 workouts needed
// ============================================================================

export interface Season2ParticipantData {
  pubkey: string;
  npub: string;
  name: string;
  picture?: string;
}

export const SEASON_2_PARTICIPANTS: Season2ParticipantData[] = [
  {
    pubkey: '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5',
    npub: 'npub1xr8tvnnnr9aqt9vv30vj4vreeq2mk38mlwe7khvhvmzjqlcghh6sr85uum',
    name: 'TheWildHustle',
    picture: 'https://m.primal.net/MgUN.png',
  },
  {
    pubkey: '745eb529d0e42d2fa6c904bbc2c10702deae964b4dd3079803ab8b43536dda12',
    npub: 'npub1w30t22wsuskjlfkfqjau9sg8qt02a9jtfhfs0xqr4w95x5mdmgfqghvnqu',
    name: 'guy',
    picture: 'https://i.ibb.co/tykKfq5/360-F-1030875797-1-Fmro-Dfu0g-DKB1-Tu32-Eti-My8-LVq-Uw-Un9.webp',
  },
  {
    pubkey: 'dae73fdd90d98db1a8405bcecac60cd6ce8d10896a6a2c5e04011125e16cd432',
    npub: 'npub1mtnnlhvsmxxmr2zqt08v43sv6m8g6yyfdf4zchsyqygjtctv6seqp93ten',
    name: 'Lhasa Sensei',
    picture: 'https://blossom.primal.net/ab12c1a745b1bad98e46be3f5024d5176863ba6459beb22e5b2430bd9db95291.gif',
  },
  {
    pubkey: '43256bc0859462cf14fa7de594a48babdf189b91abe27f88d824abf69b2343c9',
    npub: 'npub1gvjkhsy9j33v79860hjeffyt40033xu34038lzxcyj4ldxerg0yss3qlym',
    name: 'LOPES',
    picture: 'https://m.primal.net/Nsgy.png',
  },
  {
    pubkey: 'e7df627c638d934b37548d8408b43dc5d4762fa270c26abec5916bff62aac80d',
    npub: 'npub1ul0kylrr3kf5kd653kzq3dpach28vtazwrpx40k9j94l7c42eqxsstw6df',
    name: 'KjetilR',
    picture: 'https://m.primal.net/LVZP.png',
  },
  {
    pubkey: '9358c67695d9e78bde2bf3ce1eb0a5059553687632a177e7d25deeff9f2912fc',
    npub: 'npub1jdvvva54m8nchh3t708pav99qk24x6rkx2sh0e7jthh0l8efzt7q9y7jlj',
    name: 'Kamo Weasel',
    picture: 'https://m.primal.net/QZXK.png',
  },
  {
    pubkey: 'c9943d8f8e9c2aa9facb6e579af6ec38b7205c0570de1b0fb8f99f65dc5f786e',
    npub: 'npub1ex2rmruwns42n7ktdete4ahv8zmjqhq9wr0pkraclx0kthzl0phq8csq9m',
    name: 'Zed',
    picture: 'https://blossom.primal.net/88a48fbf931568244f4be6f2ef7d37cda8552a0d40bcb79ed5a89885fc601c3a.png',
  },
  {
    pubkey: '6b42a3b227b086e850ff659a151863ce070eb60d32bae8a4618928655effc3f6',
    npub: 'npub1ddp28v38kzrws58lvkdp2xrrecrsadsdx2aw3frp3y5x2hhlc0mqtzvsf9',
    name: 'JokerHasse',
    picture: 'https://nostr.build/i/nostr.build_d7d16548a7d946f91603b7f552a1e042549b86dd50d99daeda08d57b994b1f2a.jpg',
  },
  {
    pubkey: '0c252c138ee446b6f9c0964ff609380fc82e52c8d318529607f293fcdf828bea',
    npub: 'npub1psjjcyuwu3rtd7wqje8lvzfcplyzu5kg6vv999s872flehuz304qmz4l7p',
    name: 'Busch21',
    picture: 'https://blossom.primal.net/e73840651647c07e95a0356718c87562af9a983b0b6fafbedd725645230739de.png',
  },
  {
    pubkey: 'c8b22b81877eaa54e1ab21e39824f85a29e61f71da9fbabbef8930b171b98da8',
    npub: 'npub1ezezhqv80649fcdty83esf8ctg57v8m3m20m4wl03yctzude3k5q5a4tlz',
    name: 'Hoov',
    picture: 'https://m.primal.net/HhOq.jpg',
  },
  {
    pubkey: '8ce975f57dd070c4293ff8f978b869e20b2cdf4c81f277b46f3676b262c5e823',
    npub: 'npub13n5htata6pcvg2fllruh3wrfug9jeh6vs8e80dr0xemtyck9aq3sfhp723',
    name: 'clemsy',
    picture: 'https://blossom.primal.net/6c5d81bdca2a131e91c6ee6f10941fd676d4365902aff10705dde8f75fabd48c.png',
  },
  {
    pubkey: '9fce3aea32b35637838fb45b75be32595742e16bb3e4742cc82bb3d50f9087e6',
    npub: 'npub1nl8r463jkdtr0qu0k3dht03jt9t59cttk0j8gtxg9wea2russlnq2zf9d0',
    name: 'MAKE SONGS LONGER',
    picture: 'https://blossom.primal.net/95b02bc70259ab5d3d4584ba1dd24b2d6bf3a058b8eb2edb885ef677b33b6d0c.jpg',
  },
  {
    pubkey: 'e5237023a5c0929e7ae0e5128d41a8213138400ec110dbe9d8a29278f22b7c13',
    npub: 'npub1u53hqga9czffu7hqu5fg6sdgyycnssqwcygdh6wc52f83u3t0sfstpnzt7',
    name: 'Helen Yrmom',
    picture: 'https://blossom.primal.net/291700056891e12a17865ee3808a709fe25d20b351a9005f38d8105f1fc43b5d.jpg',
  },
  {
    pubkey: '02734f19cae7850e7bca6c0a2bb6a534f152d5acbd86eece1d2bfbd5d6502003',
    npub: 'npub1qfe57xw2u7zsu772ds9zhd49xnc494dvhkrwansa90aat4jsyqpssngt8g',
    name: 'bitcoin_rene',
    picture: 'https://nostr.build/i/nostr.build_b170a33c6f921b899aa14fdf70fe0b65e5786285aa66a8a7945f1c06c4157870.jpg',
  },
  {
    pubkey: '939ffb4e552ed5c0fa780985ab7163f441798409ae7ed81c62c07ac4683b4222',
    npub: 'npub1jw0lknj49m2up7ncpxz6kutr73qhnpqf4elds8rzcpavg6pmgg3qwxuhwk',
    name: 'Johan',
    picture: 'https://nostr.build/i/nostr.build_e3338a15cc572217a5ea9a9a3ce47b509e8b1377c710bc93006c78834fae687e.jpeg',
  },
  {
    pubkey: '5a654b6394bb83ecc1b95f848d6bc44e6d21120de5d832040704d9823b2c0af4',
    npub: 'npub1tfj5kcu5hwp7esdet7zg667yfekjzysduhvrypq8qnvcywevpt6qkc2lh4',
    name: 'Drew',
    picture: 'https://m.primal.net/HrEg.jpg',
  },
  {
    pubkey: '5d405752c1b4ddd0714baf3ce415db52e5506036f345ff575ee16e2b4cf189bf',
    npub: 'npub1t4q9w5kpknwaqu2t4u7wg9wm2tj4qcpk7dzl7467u9hzkn833xlskuf4sn',
    name: 'Heiunter',
    picture: 'https://cdn.nostr.build/i/f084c8a8afc63678a61112c91456c608c2655fb5513d87332f242d4305c32a57.jpg',
  },
  {
    pubkey: '14ca97caaea1565dc3f8277394a8f7d03364745a8d18536d8423dbac3f363b7f',
    npub: 'npub1zn9f0j4w59t9mslcyaeef28h6qekgaz635v9xmvyy0d6c0ek8dlsqk87vm',
    name: 'Satty',
    picture: 'https://blossom.primal.net/f030ac8d0429b2ed68ab9760ece83514b8818a5e9a0c74d6b915544d735dd1f5.webp',
  },
  {
    pubkey: 'de7ab932ca17278b2144a6628c3531a0628fcc7b58074111d6e5b949ecb0e377',
    npub: 'npub1meatjvk2zunckg2y5e3gcdf35p3glnrmtqr5zywkuku5nm9sudmstwnglh',
    name: "Harambe's last Bitcoin",
    picture: 'https://image.nostr.build/cde9e47357893714a00325e50db89852a49b8ed0e28f5f484e4d5949b1d1184e.jpg',
  },
  {
    pubkey: 'a80fc4a78634ee26aabcac951b4cfd7b56ae18babd33c5afdcf6bed6dc80ebd1',
    npub: 'npub14q8uffuxxnhzd24u4j23kn8a0dt2ux96h5eutt7u76lddhyqa0gs97ct2x',
    name: 'Uno',
    picture: 'https://blossom.primal.net/8f604992bbc8652808ca2763f06f597dfd9fd21efee398683dc5e58e082ec714.png',
  },
  {
    pubkey: 'a723805cda67251191c8786f4da58f797e6977582301354ba8e91bcb0342dc9c',
    npub: 'npub15u3cqhx6vuj3rywg0ph5mfv009lxja6cyvqn2jagaydukq6zmjwqex05rq',
    name: 'Seth',
    picture: 'https://i.nostr.build/pRrD6BPp2M05Z31M.jpg',
  },
  {
    pubkey: '0ae9dc5f42febd11c5c895b0af0bbabbe02261591b0f24eefe22c0d9ca8d0286',
    npub: 'npub1pt5ach6zl673r3wgjkc27za6h0szyc2erv8jfmh7ytqdnj5dq2rquawufz',
    name: 'MoonKaptain',
    picture: 'https://blossom.primal.net/39f3d364d516b6106387d487fa5cc25d98c4ba294eebad91fe2f13bb79dc7287.png',
  },
  {
    pubkey: 'fad80b7451b03f686fd9e487b05b69c04c808e26a1db655e59e0e296a5c9f4dd',
    npub: 'npub1ltvqkaz3kqlksm7eujrmqkmfcpxgpr3x58dk2hjeur3fdfwf7nws8szhw6',
    name: 'means',
    picture: 'https://image.nostr.build/962c5089eb4c09cc25d86ef63c6174a13a4f2cebf820286d1454972768ef3a76.jpg',
  },
  {
    pubkey: 'a9046cc9175dc5a45fb93a2c890f9a8b18c707fa6d695771aab9300081d3e21a',
    npub: 'npub14yzxejghthz6ghae8gkgjru63vvvwpl6d454wud2hycqpqwnugdqcutuw5',
    name: 'Ben Cousens',
    picture: 'https://blossom.primal.net/c119a84481ab06f84ca9f06ef2abd5524ad167048f8a61980624b705c7307dc9.jpg',
  },
  {
    pubkey: '20d29810d6a5f92b045ade02ebbadc9036d741cc686b00415c42b4236fe4ad2f',
    npub: 'npub1yrffsyxk5hujkpz6mcpwhwkujqmdwswvdp4sqs2ug26zxmly45hsfpn8p0',
    name: 'negr0',
    picture: 'https://blossom.primal.net/03865dd9c2391a6f90400e0d766aa73b98b210f91f4c677d81966df3572c1d0c.jpg',
  },
  {
    pubkey: 'ea28488b659ab6433167cd024eb72e01a375ac17ce54a1cdc6e5dce2f6d93923',
    npub: 'npub1ag5y3zm9n2myxvt8e5pyadewqx3httqhee22rnwxuhww9ake8y3slsekr3',
    name: 'johnny9',
    picture: 'https://avatars.githubusercontent.com/u/985648?v=4',
  },
  {
    pubkey: 'c6f0f4279f12200f77e1943cd26aaedf6081fda8585695f9a923b4723686da12',
    npub: 'npub1cmc0gfulzgsq7alpjs7dy64wmasgrldgtptft7dfyw68yd5xmgfqaf9e4n',
    name: 'Tumbleweed',
    picture: 'http://nostr.build/i/9554b4ae5b616d7061d27d9ba681f378ac698e87f8211029639551e63b31a13c.jpg',
  },
  {
    pubkey: '661305095522a18a1095b7b86874ef618da9c5d1ba5f4af375688e2129c07317',
    npub: 'npub1vcfs2z24y2sc5yy4k7uxsa80vxx6n3w3hf054um4dz8zz2wqwvtsgtkxyw',
    name: 'Ajax',
    picture: 'https://image.nostr.build/b4f666928cb68134d509ea317f0116fbb7d5ddd59157db6dd4f8845315fffd86.jpg',
  },
  {
    pubkey: '933a52008116743cd652eca47209f57e4ca4c439d8c2526d8c48a47bf7072ec7',
    npub: 'npub1jva9yqypze6re4jjajj8yz040ex2f3pemrp9ymvvfzj8hac89mrszp5ev6',
    name: 'Nell',
    picture: 'https://blossom.primal.net/c2d4792e12fc0a58ca5245714f2c98a3116dbf8bbb6f1cd3b610f8ccc54bc48d.jpg',
  },
  {
    pubkey: '312f54da0da1cf0cdcf1d6385fa8d6e5d8218f7122297d30b22482edada44649',
    npub: 'npub1xyh4fksd588seh836cu9l2xkuhvzrrm3yg5h6v9jyjpwmtdygeysgf47df',
    name: 'HumbleStacker',
  },
  {
    pubkey: '9416112efa3cdc0675156e4cb6ae46b2cca51973065c61bcbc002ca99e5dcdf2',
    npub: 'npub1jstpzth68nwqvag4dextdtjxktx22xtnqewxr09uqqk2n8jaeheq5afdtj',
    name: 'Lat51_Training',
    picture: 'https://blossom.primal.net/3e0427881f8228022634eb20d267bce00682d9b64d3d6328b363416108637cdb.jpg',
  },
  {
    pubkey: '0f563fe2cfdf180cb104586b95873379a0c1fdcfbc301a80c8255f33d15f039d',
    npub: 'npub1patrlck0muvqevgytp4etpen0xsvrlw0hscp4qxgy40n852lqwwsz79h9a',
    name: 'Patrick',
    picture: 'https://relay.patrickulrich.com/8376dba8728c2672acc10b7a5fce3f7cbde9299a4c0151b34b6a431d48715652.png',
  },
  {
    pubkey: 'd84517802a434757c56ae8642bffb4d26e5ade0712053750215680f5896e579b',
    npub: 'npub1mpz30qp2gdr403t2apjzhla56fh94hs8zgznw5pp26q0tztw27dsu60pxm',
    name: 'ObjectiF MooN',
    picture: 'https://blossom.primal.net/2a29897df066512e623e73f4bf5c4bf084976127d59d73cd22da76379ca238a2.jpg',
  },
  {
    pubkey: 'eeb11961b25442b16389fe6c7ebea9adf0ac36dd596816ea7119e521b8821b9e',
    npub: 'npub1a6c3jcdj23ptzcuflek8a04f4hc2cdkat95pd6n3r8jjrwyzrw0q43lfrr',
    name: 'OpenMike',
    picture: 'https://image.nostr.build/eba711a14a30726d5dd454b802d343bb17d8b0db7e477eed9eef7d4b8d65ef7a.jpg',
  },
  {
    pubkey: '81b91540daeee031df309460a9bcf5866a54c70217ff173bcdefd1982f12b0ba',
    npub: 'npub1sxu32sx6amsrrhesj3s2n084se49f3czzll3ww7dalgestcjkzaqfa3ftn',
    name: 'Aaron Tomac',
    picture: 'https://blossom.primal.net/dc0b8135dcefd0840ae3d124f283b7161bcdcbefd44b8966576fac77261d1cd9.jpg',
  },
  {
    pubkey: '7ebbce1843a17cd778a5e169e3d2f679f5ac7b5125d1c43d265e190f7b27538c',
    npub: 'npub106auuxzr597dw799u95785hk0866c763yhgug0fxtcvs77e82wxqsac5uf',
    name: 'Adrien Lacombe',
  },
  {
    pubkey: '179154c2b30226578a14ac5a01f50a3efde8d14032df96371550e1210fffd892',
    npub: 'npub1z7g4fs4nqgn90zs543dqrag28m77352qxt0evdc42rsjzrllmzfqdl96ge',
    name: 'Awakening Mind',
    picture: 'https://blossom.primal.net/e8c5c80b16dc84aceaa759ba091528c704e4bd44ce121927705c3e4b9a96d582.png',
  },
  {
    pubkey: '1f698bd4b5dda804316f09773f903ca699cf5b2a0fcd5b3fe6e0709668d58e60',
    npub: 'npub1ra5ch494mk5qgvt0p9mnlypu56vu7ke2plx4k0lxupcfv6x43esqre4rvx',
    name: 'Dani',
    picture: 'https://pbs.twimg.com/profile_images/1608301873865408513/Ysbig7Wv_400x400.jpg',
  },
  {
    pubkey: '86f7eea066dd4dc574d01b0f9317a03508887f815fb58d8ef66873cc42fe3431',
    npub: 'npub1smm7agrxm4xu2axsrv8ex9aqx5ygslupt76cmrhkdpeucsh7xscsd8zl76',
    name: 'Taljarn',
  },
  {
    pubkey: '0418ca2d6cd6c7fbc4e0391bb745027023a7edbc38f2a60fc3b68f006efb85eb',
    npub: 'npub1qsvv5ttv6mrlh38q8ydmw3gzwq360mdu8re2vr7rk68sqmhmsh4svhsft3',
    name: 'saiy2k',
    picture: 'https://pbs.twimg.com/profile_images/1621557922257072129/y4GR5EFG_400x400.jpg',
  },
  {
    pubkey: '556329e4245ec4889c33b29262c85335a082c2e25cd08b69ff46e17e70b785ec',
    npub: 'npub1243jnepytmzg38pnk2fx9jznxksg9shztnggk60lgmshuu9hshkqzdh58w',
    name: 'OrangePillosophy',
    picture: 'https://blossom.primal.net/3c33216e58dcfa8f24803302b642eb4ccb069d63002b62d2cc18fdcb6981f1d4.png',
  },
  {
    pubkey: 'a2603c88443af5152585f3f836832a67551e3ecad0e47a435c8d6510aa31c843',
    npub: 'npub15fsrezzy8t632fv970urdqe2va23u0k26rj85s6u34j3p233eppsxm7lkd',
    name: 'Carol',
    picture: 'https://m.primal.net/OHIp.jpg',
  },
  {
    pubkey: '24b45900a92fbc4527ccf975bd416988e444c6e4d9f364c5158667f077623fe2',
    npub: 'npub1yj69jq9f977y2f7vl96m6stf3rjyf3hym8ekf3g4senlqamz8l3qfsvhk7',
    name: 'Jose Sammut',
    picture: 'https://image.nostr.build/afa74223797c545885199106cc57e9f4811e7e6cffd7f398b15042f29051747e.jpg',
  },
];
