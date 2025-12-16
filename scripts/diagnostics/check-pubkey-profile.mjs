import NDK from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

async function checkProfile() {
  const ndk = new NDK({
    explicitRelayUrls: [
      'wss://relay.damus.io',
      'wss://nos.lol', 
      'wss://relay.nostr.band'
    ]
  });
  
  await ndk.connect();
  await new Promise(r => setTimeout(r, 3000));
  
  const hexPubkey = 'f993b4d99ee1cc11638fbba23ddccef5ed991dffa5b7d5e1a8ddde8f6552f697';
  
  // Convert to npub
  const npub = nip19.npubEncode(hexPubkey);
  
  console.log('=== Checking Participant Identity ===\n');
  console.log('Hex pubkey:', hexPubkey);
  console.log('Npub:', npub);
  
  // Fetch profile (kind 0)
  const profileFilter = {
    kinds: [0],
    authors: [hexPubkey],
    limit: 1
  };
  
  const profiles = await ndk.fetchEvents(profileFilter);
  console.log('\nProfile events found:', profiles.size);
  
  for (const profile of profiles) {
    try {
      const content = JSON.parse(profile.content);
      console.log('\nProfile data:');
      console.log('  Name:', content.name || content.display_name || 'N/A');
      console.log('  Display name:', content.display_name || 'N/A');
      console.log('  NIP-05:', content.nip05 || 'N/A');
      console.log('  About:', (content.about || 'N/A').substring(0, 100));
      console.log('  Picture:', content.picture ? 'Yes' : 'No');
      console.log('  Created:', new Date(profile.created_at * 1000).toISOString());
    } catch (e) {
      console.log('Could not parse profile:', e.message);
    }
  }
  
  if (profiles.size === 0) {
    console.log('\n⚠️ NO PROFILE FOUND - This might be a test/spam account or new user');
  }
  
  // Also check when they created their RSVP
  console.log('\n=== Checking their RSVP event ===');
  const rsvpFilter = {
    kinds: [31925],
    authors: [hexPubkey],
    limit: 10
  };
  
  const rsvps = await ndk.fetchEvents(rsvpFilter);
  console.log('RSVPs from this user:', rsvps.size);
  
  for (const rsvp of rsvps) {
    const dTag = rsvp.tags.find(t => t[0] === 'd')?.[1] || '';
    const aTag = rsvp.tags.find(t => t[0] === 'a')?.[1] || '';
    console.log('  RSVP d-tag:', dTag);
    console.log('  RSVP a-tag:', aTag);
    console.log('  Created:', new Date(rsvp.created_at * 1000).toISOString());
    console.log('  All tags:', JSON.stringify(rsvp.tags));
  }
  
  process.exit(0);
}

checkProfile().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
