const WebSocket = require('ws');

// All Season 2 participants
const PARTICIPANTS = [
  { pubkey: '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5', name: 'TheWildHustle' },
  { pubkey: '745eb529d0e42d2fa6c904bbc2c10702deae964b4dd3079803ab8b43536dda12', name: 'guy' },
  { pubkey: 'dae73fdd90d98db1a8405bcecac60cd6ce8d10896a6a2c5e04011125e16cd432', name: 'Lhasa Sensei' },
  { pubkey: '43256bc0859462cf14fa7de594a48babdf189b91abe27f88d824abf69b2343c9', name: 'LOPES' },
  { pubkey: 'e7df627c638d934b37548d8408b43dc5d4762fa270c26abec5916bff62aac80d', name: 'KjetilR' },
  { pubkey: '6b42a3b227b086e850ff659a151863ce070eb60d32bae8a4618928655effc3f6', name: 'JokerHasse' },
  { pubkey: '0c252c138ee446b6f9c0964ff609380fc82e52c8d318529607f293fcdf828bea', name: 'Busch21' },
  { pubkey: 'c8b22b81877eaa54e1ab21e39824f85a29e61f71da9fbabbef8930b171b98da8', name: 'Hoov' },
  { pubkey: '8ce975f57dd070c4293ff8f978b869e20b2cdf4c81f277b46f3676b262c5e823', name: 'clemsy' },
  { pubkey: 'e5237023a5c0929e7ae0e5128d41a8213138400ec110dbe9d8a29278f22b7c13', name: 'Helen Yrmom' },
  { pubkey: '02734f19cae7850e7bca6c0a2bb6a534f152d5acbd86eece1d2bfbd5d6502003', name: 'bitcoin_rene' },
  { pubkey: '5a654b6394bb83ecc1b95f848d6bc44e6d21120de5d832040704d9823b2c0af4', name: 'Drew' },
  { pubkey: '5d405752c1b4ddd0714baf3ce415db52e5506036f345ff575ee16e2b4cf189bf', name: 'Heiunter' },
  { pubkey: 'fad80b7451b03f686fd9e487b05b69c04c808e26a1db655e59e0e296a5c9f4dd', name: 'means' },
  { pubkey: '20d29810d6a5f92b045ade02ebbadc9036d741cc686b00415c42b4236fe4ad2f', name: 'negr0' },
  { pubkey: 'ea28488b659ab6433167cd024eb72e01a375ac17ce54a1cdc6e5dce2f6d93923', name: 'johnny9' },
  { pubkey: '661305095522a18a1095b7b86874ef618da9c5d1ba5f4af375688e2129c07317', name: 'Ajax' },
  { pubkey: '81b91540daeee031df309460a9bcf5866a54c70217ff173bcdefd1982f12b0ba', name: 'Aaron Tomac' },
  { pubkey: 'a80fc4a78634ee26aabcac951b4cfd7b56ae18babd33c5afdcf6bed6dc80ebd1', name: 'Uno' },
  { pubkey: 'd84517802a434757c56ae8642bffb4d26e5ade0712053750215680f5896e579b', name: 'ObjectiF MooN' },
  { pubkey: '86f7eea066dd4dc574d01b0f9317a03508887f815fb58d8ef66873cc42fe3431', name: 'Taljarn' },
  { pubkey: '0f563fe2cfdf180cb104586b95873379a0c1fdcfbc301a80c8255f33d15f039d', name: 'Patrick' },
  { pubkey: '9069532ce6a87223367bfb049b58216646a8415a88b546539d6ffaa2eeb21a9a', name: 'MichaelS' },
  { pubkey: 'f79c4b410929be501f8ac6227e66a585feb84a0a9162f54159aa752658622fad', name: 'Judith' },
];

const SINCE = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);
const UNTIL = Math.floor(new Date('2026-03-01T23:59:59Z').getTime() / 1000);
const RELAYS = ['wss://relay.primal.net', 'wss://nos.lol'];

async function queryRelay(url, pubkeys) {
  return new Promise((resolve) => {
    const events = [];
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => { ws.close(); resolve(events); }, 20000);
    ws.on('open', () => {
      ws.send(JSON.stringify(['REQ', 'sub1', { kinds: [1301], authors: pubkeys, since: SINCE, until: UNTIL, limit: 2000 }]));
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg[0] === 'EVENT') events.push(msg[2]);
      else if (msg[0] === 'EOSE') { clearTimeout(timeout); ws.close(); resolve(events); }
    });
    ws.on('error', () => { clearTimeout(timeout); resolve(events); });
  });
}

async function main() {
  console.log('DUPLICATE SCAN - ALL SEASON 2 PARTICIPANTS\n');
  
  const pubkeys = PARTICIPANTS.map(p => p.pubkey);
  const nameMap = new Map(PARTICIPANTS.map(p => [p.pubkey, p.name]));
  const allEvents = new Map();

  for (const relay of RELAYS) {
    console.log('Querying ' + relay + '...');
    const events = await queryRelay(relay, pubkeys);
    console.log('  Found ' + events.length + ' events');
    for (const e of events) allEvents.set(e.id, e);
  }

  const events = Array.from(allEvents.values());
  console.log('\nTotal unique events: ' + events.length + '\n');

  // Group by user
  const userEvents = new Map();
  for (const e of events) {
    if (!userEvents.has(e.pubkey)) userEvents.set(e.pubkey, []);
    userEvents.get(e.pubkey).push(e);
  }

  console.log('='.repeat(70));
  console.log('DUPLICATE ANALYSIS BY USER');
  console.log('='.repeat(70) + '\n');

  const issues = [];
  
  for (const [pubkey, evts] of userEvents) {
    const name = nameMap.get(pubkey) || pubkey.slice(0,8);
    
    // Check for same-timestamp events
    const timestamps = evts.map(e => e.created_at);
    const uniqueTs = new Set(timestamps);
    const dupTs = timestamps.length - uniqueTs.size;
    
    // Check for vCurrentAppVersion
    const badVersion = evts.filter(e => {
      const client = e.tags.find(t => t[0] === 'client');
      return client && client[2] && client[2].includes('CurrentAppVersion');
    }).length;
    
    // Check for same distance at same time (different event IDs)
    const distanceGroups = new Map();
    for (const e of evts) {
      const dist = e.tags.find(t => t[0] === 'distance');
      if (dist) {
        const key = e.created_at + '_' + dist[1];
        if (!distanceGroups.has(key)) distanceGroups.set(key, []);
        distanceGroups.get(key).push(e);
      }
    }
    const sameDist = Array.from(distanceGroups.values()).filter(g => g.length > 1).length;
    
    if (dupTs > 0 || badVersion > 0 || sameDist > 0) {
      issues.push({ name, evts: evts.length, dupTs, badVersion, sameDist });
    }
  }

  if (issues.length === 0) {
    console.log('No duplicate issues found!\n');
  } else {
    console.log('USERS WITH DUPLICATE ISSUES:\n');
    issues.sort((a, b) => (b.dupTs + b.badVersion + b.sameDist) - (a.dupTs + a.badVersion + a.sameDist));
    for (const i of issues) {
      console.log(i.name + ' (' + i.evts + ' events):');
      if (i.dupTs > 0) console.log('  - ' + i.dupTs + ' duplicate timestamps');
      if (i.badVersion > 0) console.log('  - ' + i.badVersion + ' events with vCurrentAppVersion (SUSPICIOUS)');
      if (i.sameDist > 0) console.log('  - ' + i.sameDist + ' distance groups with duplicates');
      console.log('');
    }
  }

  // Summary
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log('Users scanned: ' + userEvents.size);
  console.log('Users with issues: ' + issues.length);
  const severeIssues = issues.filter(i => i.badVersion > 0);
  if (severeIssues.length > 0) {
    console.log('\nSEVERE (vCurrentAppVersion detected): ' + severeIssues.map(i => i.name).join(', '));
  }
}

main().catch(console.error);
