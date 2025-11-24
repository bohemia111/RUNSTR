/**
 * Hardcoded Teams from Nostr
 *
 * This file contains static team data fetched from Nostr relays.
 * It eliminates the need to query Nostr for team discovery on app startup.
 *
 * Generated: 2025-11-15
 * Teams: 10
 *
 * To update:
 *   npx ts-node scripts/fetchTeams.ts > src/constants/hardcodedTeams.ts
 */

export const BUNDLE_UPDATED = '2025-11-15';

export const HARDCODED_TEAMS = [
  {
    id: '87d30c8b-aa18-4424-a629-d41ea7f89078',
    name: 'RUNSTR',
    description: 'RUNSTR',
    captain: 'npub1xr8tvnnnr9aqt9vv30vj4vreeq2mk38mlwe7khvhvmzjqlcghh6sr85uum',
    captainHex:
      '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5',
    createdAt: 1759348986,
    rawEvent: {
      created_at: 1759348986,
      content: 'The Official RUNSTR Team',
      tags: [
        ['d', '87d30c8b-aa18-4424-a629-d41ea7f89078'],
        ['name', 'RUNSTR'],
        ['about', 'RUNSTR'],
        [
          'captain',
          '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5',
        ],
        ['t', 'team'],
        ['t', 'fitness'],
        ['t', 'runstr'],
        ['charity', 'opensats'],
        [
          'banner',
          'https://blossom.primal.net/473c4f185f3b64d040b70bead27fd45fd2c21333bb06ba130bc532e83ca2c128.png',
        ],
      ],
      kind: 33404,
      pubkey:
        '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5',
      id: '8fe5e4a9577b686682b3d8b731f3f5a11ab628bf9b6a325f94116297066725f8',
      sig: 'a1b5ed40d5533d8f4c585575ae1c6f8ae94618cb4199c5b09c519652d0afc8e76cef42406846b38c419b802fe8be2e330042651e301d9524d250d74893879f2d',
    },
  },
  {
    id: '072e6926-8a7c-4c5e-9360-1c728eaaddc9',
    name: 'LATAM Corre 🧉🥑🏃🏻‍♂️⚡',
    description: '',
    captain: 'npub1jdvvva54m8nchh3t708pav99qk24x6rkx2sh0e7jthh0l8efzt7q9y7jlj',
    captainHex:
      '9358c67695d9e78bde2bf3ce1eb0a5059553687632a177e7d25deeff9f2912fc',
    createdAt: 1751493894,
    rawEvent: {
      created_at: 1751493894,
      content:
        'Un club de entrenamiento para usuarios de NOSTR de Latinoamérica en español.',
      tags: [
        ['d', '072e6926-8a7c-4c5e-9360-1c728eaaddc9'],
        ['name', 'LATAM Corre 🧉🥑🏃🏻‍♂️⚡'],
        ['public', 'true'],
        [
          'captain',
          '9358c67695d9e78bde2bf3ce1eb0a5059553687632a177e7d25deeff9f2912fc',
        ],
        ['t', 'team'],
        ['t', 'running'],
        ['type', 'running_club'],
        [
          'image',
          'https://blossom.primal.net/76fa8378a0356eb74453a573480525e333472ea603335cd74e0abd4296d77617.jpg',
        ],
        [
          'member',
          '9358c67695d9e78bde2bf3ce1eb0a5059553687632a177e7d25deeff9f2912fc',
        ],
        [
          'member',
          'npub12pluyzs2n3kxvx6t8fsqaa8j23f4n7syy45fny0cah46uaxqm5pqgfgy5m',
        ],
        [
          'member',
          'npub1er0k46yxcugmp6r6mujd5qvp75yp72m98fs6ywcs2k3kqg3f8grqd9py3m',
        ],
      ],
      kind: 33404,
      pubkey:
        '9358c67695d9e78bde2bf3ce1eb0a5059553687632a177e7d25deeff9f2912fc',
      id: 'a85efa00f6cfbc6bb590906d50f00d8783cb67555c4589ce63663e2ba59f0ca1',
      sig: '0256588f3f58d2def7d7fc7b0222c8b02e556f3f33a9aaa1b75d7c439df88b6c3fb7c1e5b117ed799a5847887fc3ec553a7264bf41d035e6cb9cdc229a565235',
    },
  },
  {
    id: 'bitcoin-runners-mgoz22bi',
    name: 'Bitcoin Runners',
    description:
      'Bitcoin Runners is an open-source running club at the intersection of two community-led movements enabling sovereignty of one’s wealth, while improving one’s health.\n',
    captain: 'npub1mlq3pk5cp5x5f80d8h6wpy756cmyzxc8vq7mhjf6lrfkg46cdrgqe67u32',
    captainHex:
      'dfc110da980d0d449ded3df4e093d4d636411b07603dbbc93af8d364575868d0',
    createdAt: 1760350198,
    rawEvent: {
      created_at: 1760350198,
      content:
        '{"name":"Bitcoin Runners","about":"Bitcoin Runners is an open-source running club at the intersection of two community-led movements enabling sovereignty of one’s wealth, while improving one’s health.\\n","captain":"npub1mlq3pk5cp5x5f80d8h6wpy756cmyzxc8vq7mhjf6lrfkg46cdrgqe67u32","createdAt":1760350198590,"version":"1.0.0"}',
      tags: [
        ['d', 'bitcoin-runners-mgoz22bi'],
        ['name', 'Bitcoin Runners'],
        [
          'about',
          'Bitcoin Runners is an open-source running club at the intersection of two community-led movements enabling sovereignty of one’s wealth, while improving one’s health.\n',
        ],
        [
          'captain',
          'dfc110da980d0d449ded3df4e093d4d636411b07603dbbc93af8d364575868d0',
        ],
        ['t', 'team'],
        ['t', 'fitness'],
        ['t', 'runstr'],
        ['activity', 'Running'],
        ['t', 'running'],
        ['public', 'true'],
      ],
      kind: 33404,
      pubkey:
        'dfc110da980d0d449ded3df4e093d4d636411b07603dbbc93af8d364575868d0',
      id: '6d0d4b79e09963a7ee46eb691df634bee328087ef62b251a5f0115f83b7387ac',
      sig: '3a4376c295ceb53c15289a20e8b30ef94a38b2693fb315ba52dc2949547f4ee5f301f8cad81731a85e2a7b288228bcb737ce273d41f569986d0e09bca3e28bd7',
    },
  },
  {
    id: '7293184b-130e-4fb5-9fec-669a7c0daccf',
    name: 'BULLISH',
    description: 'BULLISH',
    captain: 'npub169g6736xpscfwsepzzhvpd9xjmfd632mxhwpvfk2ea2pjx3tugvswfudm7',
    captainHex:
      'd151af47460c3097432110aec0b4a696d2dd455b35dc1626cacf54191a2be219',
    createdAt: 1759814345,
    rawEvent: {
      created_at: 1759814345,
      content: 'The official BULLISH fitness team.',
      tags: [
        ['d', '7293184b-130e-4fb5-9fec-669a7c0daccf'],
        ['name', 'BULLISH'],
        ['about', 'BULLISH'],
        [
          'captain',
          'd151af47460c3097432110aec0b4a696d2dd455b35dc1626cacf54191a2be219',
        ],
        ['t', 'team'],
        ['t', 'fitness'],
        ['t', 'runstr'],
        [
          'banner',
          'https://image.nostr.build/53636a9d132c0ccb6aeddd0c39d78e19c15ae18fc2d71de8c24a6a0a00bfe734.jpg',
        ],
        [
          'member',
          'd151af47460c3097432110aec0b4a696d2dd455b35dc1626cacf54191a2be219',
        ],
      ],
      kind: 33404,
      pubkey:
        'd151af47460c3097432110aec0b4a696d2dd455b35dc1626cacf54191a2be219',
      id: '6fd9db7f03fec9334c15274a52587b347d042960081308a14a78d92055e0e61b',
      sig: 'a394611a949926855bf2e9d4993268cdf1c8f3647217efc1c194134ba674a3e454085a1d89ed245867fa7a88fa80bcc5b7e49e9739be48b14b0d75fb9160d100',
    },
  },
  {
    id: '2ecc62e5-3445-432b-b708-2017f1e8e27b',
    name: 'Ohio Ruckers ',
    description: '',
    captain: 'npub1rsvhkyk2nnsyzkmsuaq9h9ms7rkxhn8mtxejkca2l4pvkfpwzepql3vmtf',
    captainHex:
      '1c197b12ca9ce0415b70e7405b9770f0ec6bccfb59b32b63aafd42cb242e1642',
    createdAt: 1752892397,
    rawEvent: {
      created_at: 1752892397,
      content:
        "We're a troop of mostly dad-bods trying to maintain our waistlines, here in Cleveland, Ohio. All are welcome.",
      tags: [
        ['d', '2ecc62e5-3445-432b-b708-2017f1e8e27b'],
        ['name', 'Ohio Ruckers '],
        ['public', 'true'],
        [
          'captain',
          '1c197b12ca9ce0415b70e7405b9770f0ec6bccfb59b32b63aafd42cb242e1642',
        ],
        ['t', 'team'],
        ['t', 'running'],
        ['type', 'running_club'],
        [
          'image',
          'https://thumbs.dreamstime.com/b/camping-elements-equipment-top-mountain-backpack-hiking-shoes-world-map-sunny-day-43194966.jpg',
        ],
        [
          'member',
          '1c197b12ca9ce0415b70e7405b9770f0ec6bccfb59b32b63aafd42cb242e1642',
        ],
      ],
      kind: 33404,
      pubkey:
        '1c197b12ca9ce0415b70e7405b9770f0ec6bccfb59b32b63aafd42cb242e1642',
      id: '3392e1ead43611a7f355e384ffc139ff02c4edb05d77df0226e7341c75966a02',
      sig: '1aa4374784ad60ab5c409602d3af6f08d6c215407314b998d5fb68138eac0bc8f54dc3707519e3dafd73d14a35b55edb91c7e6f7b45db5432910a437e3e4aa22',
    },
  },
  {
    id: 'f2154c92-7d38-4305-8cd3-41f4fabaf2c6',
    name: 'Pleb Walkstr',
    description: '',
    captain: 'npub1marc26z8nh3xkj5rcx7ufkatvx6ueqhp5vfw9v5teq26z254renshtf3g0',
    captainHex:
      'df478568479de26b4a83c1bdc4dbab61b5cc82e1a312e2b28bc815a12a951e67',
    createdAt: 1752063972,
    rawEvent: {
      created_at: 1752063972,
      content:
        'Pleb Walkstr was inspired by https://twentyone.world/\n\nI tried hosting a plebwalk on meetup.com, but nobody near me was interested in walking and talking about bitcoin.\n\nI am experimenting with an online version of this plebwalk idea using Runstr.\n\nOn the last Saturday of each month, I will open up a corny chat and walk 3 miles at 9:00 a.m. kPST)\n\nThe corny chat link will be sent to members of this team. We can walk and talk anout bitcoin.\n\n',
      tags: [
        ['d', 'f2154c92-7d38-4305-8cd3-41f4fabaf2c6'],
        ['name', 'Pleb Walkstr'],
        ['public', 'true'],
        [
          'captain',
          'df478568479de26b4a83c1bdc4dbab61b5cc82e1a312e2b28bc815a12a951e67',
        ],
        [
          'member',
          'df478568479de26b4a83c1bdc4dbab61b5cc82e1a312e2b28bc815a12a951e67',
        ],
        ['t', 'team'],
        ['t', 'running'],
        ['type', 'running_club'],
        [
          'image',
          'https://ideogram.ai/api/images/ephemeral/7W6vzEI6TqyR3Ah43fFZiQ.png?exp=1752150316&sig=328c4b99e332effa06aa2651decb0d3747f99a7b19cb0d8fdbbeb384dc368d8e',
        ],
      ],
      kind: 33404,
      pubkey:
        'df478568479de26b4a83c1bdc4dbab61b5cc82e1a312e2b28bc815a12a951e67',
      id: '5fe1dd8b9c9d4e528f018981ae60daabc2fafc0a0463d0242b959d78a8aff041',
      sig: '8ab56571b55beda0dc23ca82c86b76bc964f0a4ac6efb6f2f0a1548e99ea231ba9271d68be0810e5993d0ed9406ac10236ff7cab51d125d7694737f1f0b01b2b',
    },
  },
  {
    id: '101f4947-43a4-4f26-bb1e-56f6959bc4ec',
    name: 'CYCLESTR',
    description: '',
    captain: 'npub1vgldyxx7syc30qm9v7padnnfpdfp4zwymsyl9ztzuklaf7j5jfyspk36wu',
    captainHex:
      '623ed218de81311783656783d6ce690b521a89c4dc09f28962e5bfd4fa549249',
    createdAt: 1750903771,
    rawEvent: {
      created_at: 1750903771,
      content: 'A club for nostriches who love riding bicycles.',
      tags: [
        ['d', '101f4947-43a4-4f26-bb1e-56f6959bc4ec'],
        ['name', 'CYCLESTR'],
        ['public', 'true'],
        [
          'captain',
          '623ed218de81311783656783d6ce690b521a89c4dc09f28962e5bfd4fa549249',
        ],
        [
          'member',
          '623ed218de81311783656783d6ce690b521a89c4dc09f28962e5bfd4fa549249',
        ],
        ['t', 'team'],
        ['t', 'running'],
        ['type', 'running_club'],
        [
          'image',
          'https://raw.githubusercontent.com/bitcoinpup/PhotoHost/main/file_000000006484620a91763b74fd8eba71%20(1).png',
        ],
      ],
      kind: 33404,
      pubkey:
        '623ed218de81311783656783d6ce690b521a89c4dc09f28962e5bfd4fa549249',
      id: '3854adb1fc38dd77a70ed51e2a2ec6dcff2234f66489e5f590fa2b17b241e79d',
      sig: '0fd54dcdb92be74b42c048d20068d768513388d43ef50e33d0764a78c94ae6ab19b29d3e3183f67dcae9e60c4b948063d841bba14faaa5f38ca92de112e03b42',
    },
  },
  {
    id: 'spanish-family-tracks-mhjnpecd',
    name: 'Family Walks & Hikes',
    description: 'Family Walks & Hikes',
    captain: 'npub1wf02ttnmqfmvm63f2cuzgkwrm75gltw88z5uhrhzvl3gaprj248qunget5',
    captainHex:
      '725ea5ae7b0276cdea2956382459c3dfa88fadc738a9cb8ee267e28e8472554e',
    createdAt: 1762333513,
    rawEvent: {
      created_at: 1762333513,
      content: 'Family Walks & hikes around the world.',
      tags: [
        ['d', 'spanish-family-tracks-mhjnpecd'],
        ['name', 'Family Walks & Hikes'],
        ['about', 'Family Walks & Hikes'],
        [
          'captain',
          '725ea5ae7b0276cdea2956382459c3dfa88fadc738a9cb8ee267e28e8472554e',
        ],
        ['t', 'team'],
        ['t', 'fitness'],
        ['t', 'runstr'],
        ['charity', 'opensats'],
        ['banner', 'https://iili.io/KZ2j1Nn.jpg'],
      ],
      kind: 33404,
      pubkey:
        '725ea5ae7b0276cdea2956382459c3dfa88fadc738a9cb8ee267e28e8472554e',
      id: '79067833a714bb577d2f2f2fcf4cb04fe3a7e137aac70bcd140f7f521ab68b3f',
      sig: '4357b35a42567c81934f790e984ca2fa9d587ee0b2ee30b970d55d39d0b2f526a80b2953d0b09bcd955c45154c81035a6e6237c7b7944f4f1387c84d8d380a67',
    },
  },
  {
    id: '0075ed82-32b7-487c-b17d-c1b8cae05275',
    name: 'Ruckstr',
    description: '',
    captain: 'npub1n0v3dq4j0yf0vuf64tpkzdhhyzcw232vsjjtcneexwlsarrmjqkszkt4g0',
    captainHex:
      '9bd91682b27912f6713aaac36136f720b0e5454c84a4bc4f3933bf0e8c7b902d',
    createdAt: 1752781076,
    rawEvent: {
      created_at: 1752781076,
      content: 'We ruck! ',
      tags: [
        ['d', '0075ed82-32b7-487c-b17d-c1b8cae05275'],
        ['name', 'Ruckstr'],
        ['public', 'true'],
        [
          'captain',
          '9bd91682b27912f6713aaac36136f720b0e5454c84a4bc4f3933bf0e8c7b902d',
        ],
        [
          'member',
          '9bd91682b27912f6713aaac36136f720b0e5454c84a4bc4f3933bf0e8c7b902d',
        ],
        ['t', 'team'],
        ['t', 'running'],
        ['type', 'running_club'],
      ],
      kind: 33404,
      pubkey:
        '9bd91682b27912f6713aaac36136f720b0e5454c84a4bc4f3933bf0e8c7b902d',
      id: 'e72f40421fa689359b014788b7a33aeaf17003982fb8cc22c05a51a13fb53df8',
      sig: '8d77a6c0c572b86e39cd0ebba251e7af895ffaf3754a74f841e838d00389eb70fa9d84b53da63bdd849fe9728e8491741c8fa5b8752d7a8a10894f72353b4204',
    },
  },
  {
    id: '9cca15c3-2804-4da6-bc77-e0baf5b8d406',
    name: 'Spain scape',
    description: '',
    captain: 'npub1qqqqqqzs0udz0dpa93ra5thgycmcmwsqw5qave53ltdrd75nrptqv5h62x',
    captainHex:
      '00000000507f1a27b43d2c47da2ee826378dba007501d66691fada36fa931856',
    createdAt: 1752421946,
    rawEvent: {
      created_at: 1752421946,
      content: 'Españoles intentando escapar de la agenda 2030',
      tags: [
        ['d', '9cca15c3-2804-4da6-bc77-e0baf5b8d406'],
        ['name', 'Spain scape'],
        ['public', 'true'],
        [
          'captain',
          '00000000507f1a27b43d2c47da2ee826378dba007501d66691fada36fa931856',
        ],
        ['t', 'team'],
        ['t', 'running'],
        ['type', 'running_club'],
        [
          'image',
          'https://blossom.primal.net/028761128cb14544ecefa16d6180e82784da38832d48d782bf828027fc41d056.jpg',
        ],
        [
          'member',
          '00000000507f1a27b43d2c47da2ee826378dba007501d66691fada36fa931856',
        ],
        [
          'member',
          'npub1hcnntn7hnwe4punz62favp6fz9r3j5exw0wmxpaj7hgfyqypxqzqpxqygc',
        ],
      ],
      kind: 33404,
      pubkey:
        '00000000507f1a27b43d2c47da2ee826378dba007501d66691fada36fa931856',
      id: 'c49851dd5aa1b68e6ea5d1f32e97f1b305c122c6d5ee5a8ff64b7db2664f42c9',
      sig: '5836d792658729649514bb847dce308f6da00fff414a98b5a6702782d0e3c8205a87294a03cb60d713503b8c51dd1d0223fb1d135ba3718af1a2c545d3e29794',
    },
  },
];

export interface HardcodedTeam {
  id: string;
  name: string;
  description: string;
  captain: string;
  captainHex: string;
  image?: string;
  charityName?: string;
  charityDescription?: string;
  nwcConnectionString?: string;
  lightningAddress?: string;
  createdAt: number;
  rawEvent: any;
}
