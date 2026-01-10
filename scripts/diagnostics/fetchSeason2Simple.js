/**
 * Simple fetch script for Season 2 participants
 * Uses raw WebSocket to query Nostr relays
 *
 * Run with: node scripts/diagnostics/fetchSeason2Simple.js
 */

const WebSocket = require('ws');

const RUNSTR_ADMIN_PUBKEY = '611021eaaa2692741b1236bbcea54c6aa9f20ba30cace316c3a93d45089a7d0f';
const PARTICIPANT_LIST_DTAG = 'runstr-season-2-participants';
const RELAY = 'wss://relay.damus.io';

async function queryRelay(filter) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(RELAY);
    const subId = Math.random().toString(36).substring(7);
    const events = [];
    let timeout;

    ws.on('open', () => {
      console.log('Connected to relay');
      ws.send(JSON.stringify(['REQ', subId, filter]));

      timeout = setTimeout(() => {
        ws.close();
        resolve(events);
      }, 10000);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg[0] === 'EVENT' && msg[1] === subId) {
          events.push(msg[2]);
        } else if (msg[0] === 'EOSE') {
          clearTimeout(timeout);
          ws.close();
          resolve(events);
        }
      } catch (e) {
        // Ignore parse errors
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function hexToNpub(hex) {
  // Simple bech32 encoding for npub
  const ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const hrp = 'npub';

  // Convert hex to 5-bit groups
  const data = [];
  for (let i = 0; i < hex.length; i += 2) {
    data.push(parseInt(hex.substr(i, 2), 16));
  }

  // Convert 8-bit to 5-bit
  const converted = [];
  let acc = 0;
  let bits = 0;
  for (const value of data) {
    acc = (acc << 8) | value;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      converted.push((acc >> bits) & 31);
    }
  }
  if (bits > 0) {
    converted.push((acc << (5 - bits)) & 31);
  }

  // Create checksum
  const values = [3, 3, 0, 2, 3].concat(converted).concat([0, 0, 0, 0, 0, 0]);
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) {
        chk ^= [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3][i];
      }
    }
  }
  chk ^= 1;

  const checksum = [];
  for (let i = 0; i < 6; i++) {
    checksum.push((chk >> (5 * (5 - i))) & 31);
  }

  return hrp + '1' + converted.concat(checksum).map(v => ALPHABET[v]).join('');
}

async function main() {
  console.log('🚀 Fetching Season 2 participants...\n');

  // Step 1: Fetch participant list
  console.log('📋 Fetching participant list (kind 30000)...');
  const listEvents = await queryRelay({
    kinds: [30000],
    authors: [RUNSTR_ADMIN_PUBKEY],
    '#d': [PARTICIPANT_LIST_DTAG],
    limit: 1,
  });

  if (listEvents.length === 0) {
    console.error('❌ No participant list found!');
    process.exit(1);
  }

  // Get pubkeys from 'p' tags
  const pubkeys = listEvents[0].tags
    .filter(t => t[0] === 'p')
    .map(t => t[1]);

  console.log(`✅ Found ${pubkeys.length} participants\n`);

  // Step 2: Fetch profiles
  console.log('👤 Fetching profiles (kind 0)...');
  const profileEvents = await queryRelay({
    kinds: [0],
    authors: pubkeys,
  });
  console.log(`✅ Received ${profileEvents.length} profile events\n`);

  // Parse profiles
  const profileMap = new Map();
  for (const event of profileEvents) {
    try {
      const content = JSON.parse(event.content);
      profileMap.set(event.pubkey, {
        name: content.display_name || content.displayName || content.name || 'Unknown',
        picture: content.picture || content.image,
      });
    } catch (e) {
      // Ignore
    }
  }

  // Step 3: Output TypeScript
  console.log('// ============================================================================');
  console.log('// HARDCODED SEASON 2 PARTICIPANTS');
  console.log('// Generated on:', new Date().toISOString());
  console.log('// ============================================================================');
  console.log('');
  console.log('export interface Season2ParticipantData {');
  console.log('  pubkey: string;');
  console.log('  npub: string;');
  console.log('  name: string;');
  console.log('  picture?: string;');
  console.log('}');
  console.log('');
  console.log('export const SEASON_2_PARTICIPANTS: Season2ParticipantData[] = [');

  for (const pubkey of pubkeys) {
    const profile = profileMap.get(pubkey) || { name: `User ${pubkey.slice(0, 8)}` };
    const npub = hexToNpub(pubkey);
    const name = profile.name.replace(/'/g, "\\'").replace(/\n/g, ' ');

    console.log('  {');
    console.log(`    pubkey: '${pubkey}',`);
    console.log(`    npub: '${npub}',`);
    console.log(`    name: '${name}',`);
    if (profile.picture) {
      console.log(`    picture: '${profile.picture}',`);
    }
    console.log('  },');
  }

  console.log('];');
  console.log('');
  console.log(`// Total: ${pubkeys.length} participants, ${profileMap.size} with profiles`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
