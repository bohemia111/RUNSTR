const WebSocket = require('ws');

const SUSPECTS = {
  'MichaelS': '9069532ce6a87223367bfb049b58216646a8415a88b546539d6ffaa2eeb21a9a',
  'Judith': 'f79c4b410929be501f8ac6227e66a585feb84a0a9162f54159aa752658622fad'
};

const SINCE = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);
const UNTIL = Math.floor(new Date('2026-03-01T23:59:59Z').getTime() / 1000);
const RELAYS = ['wss://relay.primal.net', 'wss://nos.lol', 'wss://relay.nostr.band'];

async function queryRelay(url, pubkeys) {
  return new Promise((resolve) => {
    const events = [];
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => { ws.close(); resolve(events); }, 15000);

    ws.on('open', () => {
      ws.send(JSON.stringify(['REQ', 'sub1', { kinds: [1301], authors: pubkeys, since: SINCE, until: UNTIL }]));
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
  console.log('Investigating MICHAEL and JUDITH kind 1301 events\n');
  const pubkeys = Object.values(SUSPECTS);
  const allEvents = new Map();

  for (const relay of RELAYS) {
    console.log('Querying ' + relay + '...');
    const events = await queryRelay(relay, pubkeys);
    console.log('  Found ' + events.length + ' events');
    for (const e of events) allEvents.set(e.id, e);
  }

  console.log('\nTotal unique events: ' + allEvents.size + '\n');
  const events = Array.from(allEvents.values()).sort((a, b) => b.created_at - a.created_at);

  for (const [name, pubkey] of Object.entries(SUSPECTS)) {
    const userEvents = events.filter(e => e.pubkey === pubkey);
    console.log('='.repeat(60));
    console.log(name + ' (' + userEvents.length + ' events)');
    console.log('Pubkey: ' + pubkey);
    console.log('='.repeat(60) + '\n');

    if (userEvents.length === 0) {
      console.log('  NO EVENTS FOUND\n');
      continue;
    }

    let totalDist = 0;
    for (const event of userEvents) {
      const created = new Date(event.created_at * 1000);
      let exercise = '', distance = 0, unit = 'km', duration = '', client = '';
      for (const tag of event.tags) {
        if (tag[0] === 'exercise') exercise = tag[1];
        if (tag[0] === 'distance') { distance = parseFloat(tag[1]); unit = tag[2] || 'km'; }
        if (tag[0] === 'duration') duration = tag[1];
        if (tag[0] === 'client') client = tag[1];
      }
      totalDist += distance;

      console.log('Event: ' + event.id.substring(0, 16) + '...');
      console.log('  Created: ' + created.toISOString() + ' (Unix: ' + event.created_at + ')');
      console.log('  Exercise: ' + exercise);
      console.log('  Distance: ' + distance + ' ' + unit);
      console.log('  Duration: ' + (duration || 'NOT SET'));
      console.log('  Client: ' + (client || 'MISSING'));
      console.log('  Content: "' + event.content.substring(0, 80) + '"');
      console.log('');
    }
    console.log('Total Distance: ' + totalDist.toFixed(2) + ' km\n');

    // Pattern analysis
    console.log('PATTERN ANALYSIS:');
    const noClient = userEvents.filter(e => !e.tags.find(t => t[0] === 'client'));
    if (noClient.length > 0) console.log('  WARNING: ' + noClient.length + '/' + userEvents.length + ' events have NO CLIENT TAG');
    
    userEvents.sort((a, b) => a.created_at - b.created_at);
    for (let i = 1; i < userEvents.length; i++) {
      const gap = userEvents[i].created_at - userEvents[i-1].created_at;
      if (gap < 300) console.log('  WARNING: ' + gap + 's between consecutive posts');
    }
    console.log('\n');
  }

  // Raw dump
  console.log('FULL RAW EVENT DUMP\n');
  for (const event of events) {
    const name = Object.entries(SUSPECTS).find(([n, p]) => p === event.pubkey);
    console.log('--- ' + (name ? name[0] : 'Unknown') + ' ---');
    console.log('Tags: ' + JSON.stringify(event.tags));
    console.log('Content: ' + event.content);
    console.log('Created: ' + new Date(event.created_at * 1000).toISOString());
    console.log('');
  }
}

main().catch(console.error);
