/**
 * Register all Season II participants in Running Bitcoin competition
 *
 * Running Bitcoin challenge tracks both running AND walking toward 21km goal.
 * All Season II participants are auto-registered for Running Bitcoin.
 *
 * Usage: node scripts/register-running-bitcoin-participants.cjs
 */

require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// All Season II participants (same as register-season2-participants.cjs)
const SEASON_2_PARTICIPANTS = [
  'npub1xrwkkyuuwgaqktrvz27jj4q0eesd8y8ldel0k68nv3stpn53w06skmq3kk', // TheWildHustle
  'npub1w30jfjtj585s8x8g90exx5rl9vn8lkvqqpyflwmjcjexc4zcfzfqnq7e3u', // guy
  'npub1m40n87vrtwdpnqpfgs5vkv2sjlcnz7s8g9zppp3qgahv33xfrkzst8hzzg', // Lhasa Sensei
  'npub1gv2kwq84rmfh60dyu4yy45j5adzr0xrphm0n0uq6zzxf8x3j8jysae06g3', // LOPES
  'npub1ul0mcuc7gkutn5asqaghqnrwup752a286pqcn4u8vwnd9hezycus0kp8ug', // KjetilR
  'npub1jxtx8rmgskn2l4crltv4pwdhxn7j80qaf8ezxugxm95u6w0ucc6sfa2pka', // Kamo Weasel
  'npub1exypa0ce3awc4wqmgvlty40a04vgr0vkrkqvhrmj4aak89nl8cnsywpz3c', // Zed
  'npub1dvy5wvjwcp5w90h9vk0csfxpqwxlrqkek0qgftxfagjrn4lf0dkq4q72yy', // JokerHasse
  'npub1pxj2vfcwez3k7extyh3x8plg83qljgtexh3qr8qhlpypk00j8845stzjsp', // Busch21
  'npub1e9z27vpul46fj8c4g2nnqpj0ccdgp2fp3apc9ulze5jmqvxhxv5qgc77dx', // Hoov
  'npub13n5htata6pcvg2fllruh3wrfug9jeh6vs8e80dr0xemtyck9aq3sfhp723', // clemsy
  'npub1nle3a25n4nvr4kxjxkv0cnqtkj9lpj7n8rn5fypdhm9tk5n8sleqalftgu', // MAKE SONGS LONGER
  'npub1ujr8syzgtqyffeeqh290yz9xgtyj6gqzns8qensnqhkkz0fruc3sl0yl3t', // Helen Yrmom
  'npub1qfn5ew85dc2l9mevq6jxyrzmj7k82jh9ak0p0ev3kzl0mffvspps22e9gt', // bitcoin_rene
  'npub1jv87lz9htjgvxef3rrhp4fwfg8x8v7zsq08mnqtyvr2awjjxgjgs7c5k50', // Johan
  'npub1tf9f4ny4fwx7knck5wgm4kyup5jp5ygzrfk0pmskkqux0zux9u9q9v6sj0', // Drew
  'npub1t4qz4fc8d5ta4zu29nc2n9cjdz6kmxnqm4303mtggjm6z06yp0lspqdzag', // Heiunter
  'npub1zn9fu4wgdzkv8s2yw8awle0rxq88kcfqc0xz04g2ym8gv7ukwl0sg5qmgt', // Satty
  'npub1me6lf9vyhynfumjyvjfaqn2xrwgs0suhvdph3ca30dke4hk9cuwsrry8de', // Harambe's last Bitcoin
  'npub15q0c548xnf887l5xykvh9nl0elv2cc47h5n0zh3djhhmddqaq7gsrh8vak', // Uno
  'npub15jrsqp8xdmz0dxr7fpznrqnm3pcydyuf8qesxkf00ecdkq0e0yushh7hx4', // Seth
  'npub1pwnslh29e6a9n8zdaelh3zl8qpgkq5xe2gcfqda6s8z6m5qdq5xqs7c5l7', // MoonKaptain
  'npub1ltvpd652xdh068lk0n4ct5lq6lpwr3xvqvktzml5vnw6ejmdzamsd7cckk', // means
  'npub149yx3j9rhnf8x5zvc5ae5tpy4p2y54nxhk95v65njr4zrvstcjaqjyf3ys', // Ben Cousens
  'npub1yrffpyqtflqdspxqpzs40ajhv4j3d6z9eec3z7qcq04ysp7jq3tseh6afq', // negr0
  'npub1a2zygwty6d2rtvr3lv59w4h37emr3t2stqyy0ghl57t3eqmnexysxq2dcr', // johnny9
  'npub1cmc05uxf8f8qv880g9w2yq0ag0r2lsv6wjfrzjlm0rd8e6d7yfyqypqqlq', // Tumbleweed
  'npub1vcfsvzhz2yx8s67d22w2dqxtc2kzlyd3ewwnp3dg4xshe3yuecthshqj0a', // Ajax
  'npub1jva22pqzgfj48ve7a9pvgufhgx5t4zxu8ype8uh58yfrmqe53j8s9ykakx', // Nell
  'npub1xy02jx6pkduwzwwxrzhs960yzl5fpfwsmwxxz34xjj9jzwq5xfys02ql8v', // HumbleStacker
  'npub1j9tz3y8l8rxmtjrca8a5xdh5k9jfvx89xclrtssmqvjxugw2ely2t9fpvj', // Lat51_Training
  'npub1pad8l0xv7ws5rcq2z25r8vq0an7qdyul20cztvx0c5t7elv0g8as40u7cp', // Patrick
  'npub1my29upq5g6gan4u09y2lht5da4xhpuyjfr35xu53graq0j0et0dswlcpxj', // ObjectiF MooN
  'npub1a6yetnf5c5gy0dkfhehkc05w57mpu4mhc67w0ky4xvjhvzwzcylskkzr0v', // OpenMike
  'npub1sxu3tg4h30qmr3l5yxamz87fxt65h4pv8hh3mn3j0j7h6xjzpmas0n9wpl', // Aaron Tomac
  'npub1067u03rpt89lgaz38jwj0n5l07j3lsg4hue8dhz944ryh5ay4uvqk46wzs', // Adrien Lacombe
  'npub1z73tz3ewz40ja5evcpj70e8fnj0ahrxtejdr2gclw85eqltgvjfsdmfy78', // Awakening Mind
  'npub1ra3xa6d0p8d3cnwz5qsp6exxjlvpsxh4xz4qajlpe6jqt3wpct0quhqlxv', // Dani
  'npub1sml7k6s8m9km25nkqle9nw83shhrdllxryvw83kl7w3c5rjgjnqsv0rp7d', // Taljarn
  'npub1qpr9ztwstud7mauqw5peqj9d78kwzlzfmfq2c8un87uwsukhpavshtwvq8', // saiy2k
  'npub124vjew5j3tr6zc4zlm90g0jgx7pyzl89gzf8fxfcvn5hel44tmkqgxguxf', // OrangePillosophy
  'npub15fsvufr3y4wqsz08resk8gc7e93gwt55cdl4nlcpwkrk36u2c5pqgqkuv9', // Carol
  'npub1yjkysjya974e3yhn085w4cyxg382xyulel2j0xhfr7j7kh7rgl3qnumsdt', // Jose Sammut
];

// Running Bitcoin competition ID (will be created if doesn't exist)
const COMPETITION_EXTERNAL_ID = 'running-bitcoin';

async function getOrCreateCompetition() {
  // First check if competition exists
  const checkUrl = `${SUPABASE_URL}/rest/v1/competitions?external_id=eq.${COMPETITION_EXTERNAL_ID}&select=id,external_id`;

  const checkResponse = await fetch(checkUrl, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });

  const existing = await checkResponse.json();

  if (existing && existing.length > 0) {
    console.log(`  Found existing competition: ${existing[0].id}`);
    return existing[0].id;
  }

  // Create competition if it doesn't exist
  console.log('  Creating Running Bitcoin competition...');
  const createUrl = `${SUPABASE_URL}/rest/v1/competitions`;

  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      external_id: COMPETITION_EXTERNAL_ID,
      name: 'Running Bitcoin Challenge',
      // Use 'running' as base type - we'll query both running AND walking in code
      activity_type: 'running',
      start_date: '2026-01-10',
      end_date: '2026-01-31',
      scoring_method: 'total_distance',
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create competition: ${error}`);
  }

  const created = await createResponse.json();
  console.log(`  Created competition: ${created[0].id}`);
  return created[0].id;
}

async function registerParticipant(competitionId, npub) {
  const url = `${SUPABASE_URL}/rest/v1/competition_participants`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        competition_id: competitionId,
        npub: npub,
      }),
    });

    return response.ok || response.status === 409; // 409 = already exists
  } catch (err) {
    console.error(`Error registering ${npub}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('  REGISTERING RUNNING BITCOIN PARTICIPANTS');
  console.log('='.repeat(60));
  console.log();
  console.log(`Participants: ${SEASON_2_PARTICIPANTS.length}`);
  console.log();

  // Get or create the competition
  const competitionId = await getOrCreateCompetition();
  console.log();

  let totalRegistrations = 0;
  let errors = 0;

  console.log(`📊 Registering participants for Running Bitcoin:`);

  for (const npub of SEASON_2_PARTICIPANTS) {
    const success = await registerParticipant(competitionId, npub);
    if (success) {
      totalRegistrations++;
      process.stdout.write('.');
    } else {
      errors++;
      process.stdout.write('x');
    }
  }

  console.log(` Done!`);

  console.log('\n');
  console.log('='.repeat(60));
  console.log(`  COMPLETE: ${totalRegistrations} registrations, ${errors} errors`);
  console.log('='.repeat(60));

  process.exit(0);
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
