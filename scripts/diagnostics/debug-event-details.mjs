#!/usr/bin/env node
/**
 * Get full details of the Midnight Run event
 */

import NDK from '@nostr-dev-kit/ndk';

const KIND_CALENDAR_EVENT = 31923;

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

const EVENT_ID = 'midnight-run-mj594lhn-nhcv';

async function main() {
  console.log('🔍 MIDNIGHT RUN EVENT DETAILS');
  console.log('==============================\n');

  const ndk = new NDK({ explicitRelayUrls: RELAYS });
  console.log('⏳ Connecting...');
  await ndk.connect();
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('✅ Connected\n');

  const filter = {
    kinds: [KIND_CALENDAR_EVENT],
    '#d': [EVENT_ID],
    limit: 5,
  };

  const events = await ndk.fetchEvents(filter);
  console.log('Events found:', events.size);

  for (const event of events) {
    console.log('\n=== EVENT DATA ===');
    console.log('ID:', event.id);
    console.log('Pubkey:', event.pubkey);
    console.log('Created at:', new Date(event.created_at * 1000).toISOString());
    console.log('\n--- ALL TAGS ---');
    for (const tag of event.tags) {
      console.log(`  ${tag[0]}: ${tag.slice(1).join(', ')}`);
    }

    console.log('\n--- KEY TIMESTAMPS ---');
    const startTag = event.tags.find(t => t[0] === 'start')?.[1];
    const endTag = event.tags.find(t => t[0] === 'end')?.[1];

    if (startTag) {
      const startTime = parseInt(startTag);
      console.log(`Start: ${new Date(startTime * 1000).toISOString()} (unix: ${startTime})`);
    } else {
      console.log('Start: NOT SET');
    }

    if (endTag) {
      const endTime = parseInt(endTag);
      console.log(`End: ${new Date(endTime * 1000).toISOString()} (unix: ${endTime})`);
    } else {
      console.log('End: NOT SET');
    }

    // Check if today's run (Dec 14 05:25) falls within range
    const yourRunTime = new Date('2025-12-14T05:25:11.000Z').getTime() / 1000;
    console.log(`\nYour 10.76km run: ${new Date(yourRunTime * 1000).toISOString()}`);

    if (startTag && endTag) {
      const start = parseInt(startTag);
      const end = parseInt(endTag);
      const inRange = yourRunTime >= start && yourRunTime <= end;
      console.log(`In event range: ${inRange ? '✅ YES' : '❌ NO - This is why it doesn\'t appear!'}`);

      if (!inRange) {
        if (yourRunTime < start) {
          console.log(`  ⚠️ Run was BEFORE event start (${Math.round((start - yourRunTime) / 3600)} hours early)`);
        } else {
          console.log(`  ⚠️ Run was AFTER event end (${Math.round((yourRunTime - end) / 3600)} hours late)`);
        }
      }
    }

    console.log('\n--- CONTENT ---');
    try {
      const content = JSON.parse(event.content);
      console.log(JSON.stringify(content, null, 2));
    } catch {
      console.log(event.content || '(empty)');
    }
  }

  console.log('\n✅ Debug complete');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
