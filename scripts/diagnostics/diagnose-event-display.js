#!/usr/bin/env node
/**
 * Diagnostic Script: Event Display Investigation
 *
 * This script mirrors the exact flow of SimpleTeamScreen's event fetching logic
 * to diagnose why events aren't displaying despite being successfully parsed.
 *
 * Flow:
 * 1. Connect to Nostr relays via NDK
 * 2. Get team captain ID
 * 3. Query events by captain author (same as SimpleCompetitionService)
 * 4. Parse events (same logic as parseEventEvent)
 * 5. Apply date filtering (same as fetchTeamEventsFromNostr)
 * 6. Apply team filtering
 * 7. Show results at each step
 */

import NDK from '@nostr-dev-kit/ndk';

// Constants from the app
const TEAM_ID = '87d30c8b-aa18-4424-a629-d41ea7f89078';
const CAPTAIN_PUBKEY = '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5';

const RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

async function main() {
  console.log('🔍 RUNSTR Event Display Diagnostic Tool\n');
  console.log('═'.repeat(80));
  console.log(`Team ID: ${TEAM_ID}`);
  console.log(`Captain: ${CAPTAIN_PUBKEY.substring(0, 16)}...`);
  console.log('═'.repeat(80), '\n');

  // Step 1: Connect to NDK
  console.log('📡 Step 1: Connecting to Nostr relays...');
  const ndk = new NDK({
    explicitRelayUrls: RELAY_URLS,
  });

  await ndk.connect();
  console.log(`✅ Connected to ${RELAY_URLS.length} relays\n`);

  // Step 2: Query events by captain author (EXACT same query as app)
  console.log('🔎 Step 2: Querying events by captain author...');
  const filter = {
    kinds: [30101],
    authors: [CAPTAIN_PUBKEY],
    limit: 200,
    since: Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60, // Last 90 days
  };

  console.log('Filter:', JSON.stringify(filter, null, 2));

  const events = await ndk.fetchEvents(filter);
  console.log(`✅ Received ${events.size} total events from Nostr\n`);

  if (events.size === 0) {
    console.log('❌ No events returned from query. Exiting.');
    process.exit(1);
  }

  // Step 3: Parse events (EXACT same logic as parseEventEvent)
  console.log('📋 Step 3: Parsing events...');
  const parsedEvents = [];
  const parseErrors = [];

  for (const event of events) {
    try {
      const getTag = (name) => event.tags.find((t) => t[0] === name)?.[1];

      const id = getTag('d');
      const teamId = getTag('team') || getTag('team_id');
      const name = getTag('name') || 'Unnamed Event';
      const activityType = getTag('activity_type') || 'Running';
      const eventDate = getTag('event_date') || new Date().toISOString();
      const durationMinutesTag = getTag('duration_minutes');

      if (!id) {
        parseErrors.push({ reason: 'Missing id tag', eventId: event.id });
        continue;
      }

      parsedEvents.push({
        id,
        teamId,
        captainPubkey: event.pubkey,
        name,
        activityType,
        eventDate,
        durationMinutes: durationMinutesTag ? parseInt(durationMinutesTag) : undefined,
        allTags: event.tags.slice(0, 5), // First 5 tags for debugging
      });
    } catch (error) {
      parseErrors.push({ reason: error.message, eventId: event.id });
    }
  }

  console.log(`✅ Successfully parsed ${parsedEvents.length} events`);
  if (parseErrors.length > 0) {
    console.log(`⚠️  Failed to parse ${parseErrors.length} events:`);
    parseErrors.forEach(err => console.log(`   - ${err.eventId}: ${err.reason}`));
  }
  console.log();

  // Step 4: Apply team filtering (client-side filter for THIS team only)
  console.log('🔍 Step 4: Filtering by team ID...');
  const teamFilteredEvents = parsedEvents.filter(event => {
    if (event.teamId && event.teamId !== TEAM_ID) {
      console.log(`   ⏩ Skipping event for different team: ${event.name} (team: ${event.teamId?.substring(0, 8)}...)`);
      return false;
    }
    return true;
  });
  console.log(`✅ After team filtering: ${teamFilteredEvents.length} events\n`);

  // Step 5: Apply date filtering (EXACT same logic as app)
  console.log('📅 Step 5: Applying date filtering (events ended >48hrs ago are removed)...');
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  console.log(`Current time: ${now.toISOString()}`);
  console.log(`Two days ago: ${twoDaysAgo.toISOString()}`);
  console.log(`90 days from now: ${ninetyDaysFromNow.toISOString()}\n`);

  const dateFilteredEvents = [];
  const dateRejected = [];

  for (const event of teamFilteredEvents) {
    const eventStartDate = new Date(event.eventDate);
    const durationMinutes = event.durationMinutes || 1440; // Default 24 hours
    const eventEndDate = new Date(eventStartDate.getTime() + durationMinutes * 60 * 1000);

    console.log(`\nEvent: ${event.name}`);
    console.log(`  Start: ${eventStartDate.toISOString()}`);
    console.log(`  Duration: ${durationMinutes} minutes`);
    console.log(`  End: ${eventEndDate.toISOString()}`);

    // Check if event ended more than 48 hours ago
    if (eventEndDate < twoDaysAgo) {
      const hoursAgo = Math.floor((now.getTime() - eventEndDate.getTime()) / (1000 * 60 * 60));
      console.log(`  ❌ REJECTED: Event ended ${hoursAgo} hours ago (>48 hours)`);
      dateRejected.push({ event, reason: `Ended ${hoursAgo}h ago` });
      continue;
    }

    // Check if event starts more than 90 days in the future
    if (eventStartDate > ninetyDaysFromNow) {
      console.log(`  ❌ REJECTED: Event starts more than 90 days in future`);
      dateRejected.push({ event, reason: 'Too far in future' });
      continue;
    }

    console.log(`  ✅ ACCEPTED: Event passes date filtering`);
    dateFilteredEvents.push(event);
  }

  console.log(`\n✅ After date filtering: ${dateFilteredEvents.length} events`);
  if (dateRejected.length > 0) {
    console.log(`❌ Rejected ${dateRejected.length} events due to date filtering:`);
    dateRejected.forEach(({ event, reason }) => {
      console.log(`   - ${event.name}: ${reason}`);
    });
  }
  console.log();

  // Step 6: Final results
  console.log('═'.repeat(80));
  console.log('📊 FINAL RESULTS');
  console.log('═'.repeat(80));
  console.log(`Total events queried: ${events.size}`);
  console.log(`Successfully parsed: ${parsedEvents.length}`);
  console.log(`After team filtering: ${teamFilteredEvents.length}`);
  console.log(`After date filtering: ${dateFilteredEvents.length}`);
  console.log();

  if (dateFilteredEvents.length === 0) {
    console.log('❌ PROBLEM IDENTIFIED: All events filtered out!');
    console.log('\nMost likely causes:');
    console.log('1. Events have already ended (>48 hours ago)');
    console.log('2. Event dates are malformed or in wrong timezone');
    console.log('3. Duration calculation is incorrect');
    console.log('\nRecommendation: Check event creation wizard - ensure dates are set correctly');
  } else {
    console.log('✅ SUCCESS: Events should display!');
    console.log('\nEvents that should appear in SimpleTeamScreen:');
    dateFilteredEvents.forEach((event, i) => {
      console.log(`\n${i + 1}. ${event.name}`);
      console.log(`   ID: ${event.id}`);
      console.log(`   Activity: ${event.activityType}`);
      console.log(`   Date: ${event.eventDate}`);
      console.log(`   Duration: ${event.durationMinutes || 1440} minutes`);
    });
  }

  console.log('\n' + '═'.repeat(80));
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Script error:', error);
  process.exit(1);
});
