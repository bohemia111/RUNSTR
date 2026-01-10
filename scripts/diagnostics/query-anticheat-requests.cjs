#!/usr/bin/env node
/**
 * Query Anti-Cheat Verification Requests
 *
 * Admin script to check for new kind 21301 events (anti-cheat requests).
 * Run daily to see who needs investigation.
 *
 * Usage: node scripts/diagnostics/query-anticheat-requests.cjs
 */

const WebSocket = require('ws');

// Anti-cheat request kind
const ANTICHEAT_REQUEST_KIND = 21301;

// RUNSTR admin pubkey (receives all requests)
const RUNSTR_ADMIN_PUBKEY = '611021eaaa2692741b1236bbcea54c6aa9f20ba30cace316c3a93d45089a7d0f';

// Query last 30 days by default
const DAYS_BACK = 30;

const RELAYS = [
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.damus.io',
];

async function queryRelay(relayUrl, filter) {
  return new Promise((resolve) => {
    const events = [];
    const subId = Math.random().toString(36).substring(7);
    let timeout;

    try {
      const ws = new WebSocket(relayUrl);

      ws.on('open', () => {
        console.log('   Connected to ' + relayUrl);
        ws.send(JSON.stringify(['REQ', subId, filter]));

        timeout = setTimeout(() => {
          ws.close();
          resolve(events);
        }, 15000);
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg[0] === 'EVENT' && msg[1] === subId) {
          events.push(msg[2]);
        } else if (msg[0] === 'EOSE') {
          clearTimeout(timeout);
          ws.close();
          resolve(events);
        }
      });

      ws.on('error', (err) => {
        console.log('   Error on ' + relayUrl + ': ' + err.message);
        clearTimeout(timeout);
        resolve(events);
      });
    } catch (err) {
      console.log('   Failed to connect to ' + relayUrl);
      resolve(events);
    }
  });
}

function formatTimestamp(unixTs) {
  return new Date(unixTs * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

function getTagValue(tags, name) {
  const tag = tags.find(t => t[0] === name);
  return tag ? tag[1] : null;
}

async function main() {
  console.log('Anti-Cheat Verification Requests Query');
  console.log('='.repeat(50));
  console.log('');

  const since = Math.floor(Date.now() / 1000) - (DAYS_BACK * 24 * 60 * 60);

  const filter = {
    kinds: [ANTICHEAT_REQUEST_KIND],
    '#p': [RUNSTR_ADMIN_PUBKEY], // Events tagged to admin
    since: since,
  };

  console.log('Querying last ' + DAYS_BACK + ' days...');
  console.log('');

  const allEvents = new Map();

  for (const relay of RELAYS) {
    console.log('Querying ' + relay + '...');
    const events = await queryRelay(relay, filter);
    console.log('   Found ' + events.length + ' events');
    for (const e of events) {
      allEvents.set(e.id, e);
    }
  }

  const events = Array.from(allEvents.values()).sort((a, b) => b.created_at - a.created_at);

  console.log('');
  console.log('='.repeat(50));
  console.log('RESULTS: ' + events.length + ' request(s) found');
  console.log('='.repeat(50));
  console.log('');

  if (events.length === 0) {
    console.log('No anti-cheat requests in the last ' + DAYS_BACK + ' days.');
    console.log('');
    return;
  }

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const tags = event.tags;

    console.log('REQUEST #' + (i + 1));
    console.log('-'.repeat(40));
    console.log('Date:        ' + formatTimestamp(event.created_at));
    console.log('Event ID:    ' + event.id.slice(0, 16) + '...');
    console.log('Requester:   ' + event.pubkey.slice(0, 16) + '...');

    const suspectPubkey = getTagValue(tags, 'suspect_pubkey');
    const suspectName = getTagValue(tags, 'suspect_name');
    const competition = getTagValue(tags, 'competition');
    const contactMethod = getTagValue(tags, 'contact_method');
    const email = getTagValue(tags, 'email');
    const reason = getTagValue(tags, 'reason');

    if (suspectPubkey) {
      console.log('Suspect PK:  ' + suspectPubkey.slice(0, 16) + '...');
    }
    if (suspectName) {
      console.log('Suspect:     ' + suspectName);
    }
    if (competition) {
      console.log('Competition: ' + competition);
    }
    console.log('Contact:     ' + (contactMethod === 'email' ? email : 'Nostr DM'));
    if (reason) {
      console.log('Reason:      ' + reason);
    }
    console.log('');
    console.log('Full content:');
    console.log(event.content);
    console.log('');
  }

  console.log('='.repeat(50));
  console.log('ACTION ITEMS:');
  console.log('='.repeat(50));
  console.log('');
  console.log('For each request above:');
  console.log('1. Run: node scripts/diagnostics/check-suspects.cjs');
  console.log('   (Update SUSPECTS object with suspect pubkey)');
  console.log('2. Analyze for vCurrentAppVersion or duplicate patterns');
  console.log('3. DM results to requester (or email if specified)');
  console.log('');
}

main().catch(console.error);
