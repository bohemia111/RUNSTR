/**
 * Investigate Midnight Run Event
 *
 * This script:
 * 1. Finds the "Midnight Run" event (kind 31923)
 * 2. Counts participants (kind 31925 RSVPs)
 * 3. Queries qualifying workouts (kind 1301)
 */

import NDK, { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

const KIND_CALENDAR_EVENT = 31923;
const KIND_CALENDAR_RSVP = 31925;
const KIND_WORKOUT = 1301;

async function main() {
  console.log('🔍 Investigating Midnight Run Event...\n');

  // Initialize NDK
  const ndk = new NDK({
    explicitRelayUrls: DEFAULT_RELAYS,
  });

  console.log('📡 Connecting to relays...');
  await ndk.connect();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for connections

  // Step 1: Find the Midnight Run event
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📅 STEP 1: Finding Midnight Run Event (kind 31923)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const eventFilter: NDKFilter = {
    kinds: [KIND_CALENDAR_EVENT as any],
    limit: 100,
  };

  const allEvents = await ndk.fetchEvents(eventFilter);
  console.log(`Found ${allEvents.size} total calendar events\n`);

  let midnightRunEvent: NDKEvent | null = null;
  let midnightRunData: any = null;

  for (const event of allEvents) {
    const title = event.tags.find(t => t[0] === 'title')?.[1] ||
                  event.tags.find(t => t[0] === 'name')?.[1] ||
                  '';
    const content = event.content || '';

    if (title.toLowerCase().includes('midnight') ||
        content.toLowerCase().includes('midnight run')) {
      console.log('✅ Found Midnight Run Event!');
      console.log(`   Title: ${title}`);
      console.log(`   Event ID (d-tag): ${event.tags.find(t => t[0] === 'd')?.[1]}`);
      console.log(`   Author: ${event.pubkey.slice(0, 16)}...`);
      console.log(`   Created: ${new Date(event.created_at! * 1000).toISOString()}`);

      // Parse event details
      const dTag = event.tags.find(t => t[0] === 'd')?.[1];
      const startTag = event.tags.find(t => t[0] === 'start')?.[1];
      const endTag = event.tags.find(t => t[0] === 'end')?.[1];

      if (startTag) console.log(`   Start: ${new Date(parseInt(startTag) * 1000).toISOString()}`);
      if (endTag) console.log(`   End: ${new Date(parseInt(endTag) * 1000).toISOString()}`);

      // Log all tags for debugging
      console.log('\n   All tags:');
      event.tags.forEach(tag => {
        console.log(`     [${tag.join(', ')}]`);
      });

      midnightRunEvent = event;
      midnightRunData = {
        id: dTag,
        pubkey: event.pubkey,
        title,
        startTime: startTag ? parseInt(startTag) : null,
        endTime: endTag ? parseInt(endTag) : null,
      };
      break;
    }
  }

  if (!midnightRunEvent || !midnightRunData) {
    console.log('\n❌ Could not find Midnight Run event!');
    console.log('\nAll event titles found:');
    for (const event of allEvents) {
      const title = event.tags.find(t => t[0] === 'title')?.[1] ||
                    event.tags.find(t => t[0] === 'name')?.[1] ||
                    '(no title)';
      console.log(`  - ${title}`);
    }
    process.exit(1);
  }

  // Step 2: Find RSVPs (participants)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👥 STEP 2: Finding Participants (kind 31925 RSVPs)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Query by #d tag (rsvp-{eventId})
  const rsvpFilter1: NDKFilter = {
    kinds: [KIND_CALENDAR_RSVP as any],
    '#d': [`rsvp-${midnightRunData.id}`],
    limit: 500,
  };

  // Query by #a tag (31923:pubkey:d-tag)
  const eventRef = `31923:${midnightRunData.pubkey}:${midnightRunData.id}`;
  const rsvpFilter2: NDKFilter = {
    kinds: [KIND_CALENDAR_RSVP as any],
    '#a': [eventRef],
    limit: 500,
  };

  console.log('Querying RSVPs by #d tag...');
  const rsvps1 = await ndk.fetchEvents(rsvpFilter1);
  console.log(`  Found ${rsvps1.size} RSVPs via #d tag`);

  console.log('Querying RSVPs by #a tag...');
  const rsvps2 = await ndk.fetchEvents(rsvpFilter2);
  console.log(`  Found ${rsvps2.size} RSVPs via #a tag`);

  // Combine and dedupe
  const allRsvps = new Map<string, NDKEvent>();
  for (const rsvp of rsvps1) {
    allRsvps.set(rsvp.pubkey, rsvp);
  }
  for (const rsvp of rsvps2) {
    allRsvps.set(rsvp.pubkey, rsvp);
  }

  console.log(`\n📊 Total unique participants: ${allRsvps.size}`);

  const participantPubkeys: string[] = [];
  if (allRsvps.size > 0) {
    console.log('\nParticipants:');
    let i = 1;
    for (const [pubkey, rsvp] of allRsvps) {
      const status = rsvp.tags.find(t => t[0] === 'status')?.[1] ||
                     rsvp.tags.find(t => t[0] === 'l')?.[1] ||
                     'unknown';
      console.log(`  ${i}. ${pubkey.slice(0, 16)}... (status: ${status})`);
      participantPubkeys.push(pubkey);
      i++;
    }
  }

  // Step 3: Find qualifying workouts
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏃 STEP 3: Finding Qualifying Workouts (kind 1301)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!midnightRunData.startTime || !midnightRunData.endTime) {
    console.log('⚠️ Event missing start/end times, cannot query workouts');
  } else {
    console.log(`Querying workouts from ${new Date(midnightRunData.startTime * 1000).toISOString()}`);
    console.log(`                    to ${new Date(midnightRunData.endTime * 1000).toISOString()}\n`);

    // Query workouts in the event time window
    const workoutFilter: NDKFilter = {
      kinds: [KIND_WORKOUT as any],
      since: midnightRunData.startTime,
      until: midnightRunData.endTime,
      limit: 500,
    };

    const workouts = await ndk.fetchEvents(workoutFilter);
    console.log(`Found ${workouts.size} total workouts in time window\n`);

    // Analyze workouts
    const workoutsByUser = new Map<string, NDKEvent[]>();
    for (const workout of workouts) {
      const existing = workoutsByUser.get(workout.pubkey) || [];
      existing.push(workout);
      workoutsByUser.set(workout.pubkey, existing);
    }

    console.log(`Workouts from ${workoutsByUser.size} unique users:\n`);

    for (const [pubkey, userWorkouts] of workoutsByUser) {
      const isParticipant = participantPubkeys.includes(pubkey);
      const marker = isParticipant ? '✅' : '⚠️ ';

      console.log(`${marker} User: ${pubkey.slice(0, 16)}... ${isParticipant ? '(RSVP\'d)' : '(NO RSVP)'}`);

      for (const workout of userWorkouts) {
        const exerciseTag = workout.tags.find(t => t[0] === 'exercise')?.[1] || 'unknown';
        const distanceTag = workout.tags.find(t => t[0] === 'distance');
        const distance = distanceTag ? `${distanceTag[1]} ${distanceTag[2] || 'units'}` : 'N/A';
        const durationTag = workout.tags.find(t => t[0] === 'duration')?.[1] || 'N/A';

        console.log(`     📊 ${exerciseTag}: ${distance}, duration: ${durationTag}`);
        console.log(`        Created: ${new Date(workout.created_at! * 1000).toISOString()}`);
      }
    }

    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Event: ${midnightRunData.title}`);
    console.log(`Event ID: ${midnightRunData.id}`);
    console.log(`Participants (RSVPs): ${participantPubkeys.length}`);
    console.log(`Total workouts in time window: ${workouts.size}`);
    console.log(`Unique users with workouts: ${workoutsByUser.size}`);

    const participantsWithWorkouts = [...workoutsByUser.keys()].filter(p => participantPubkeys.includes(p));
    console.log(`Participants with qualifying workouts: ${participantsWithWorkouts.length}`);

    const nonParticipantsWithWorkouts = [...workoutsByUser.keys()].filter(p => !participantPubkeys.includes(p));
    console.log(`Non-participants with workouts (open event): ${nonParticipantsWithWorkouts.length}`);
  }

  console.log('\n✅ Investigation complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
