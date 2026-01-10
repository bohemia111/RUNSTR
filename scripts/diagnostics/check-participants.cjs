require('dotenv').config();

const CLEMSY_NPUB = 'npub13n5htata6pcvg2fllruh3wrfug9jeh6vs8e80dr0xemtyck9aq3sfhp723';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function main() {
  // Check competition_participants for clemsy
  const participantsUrl = `${SUPABASE_URL}/rest/v1/competition_participants?npub=eq.${CLEMSY_NPUB}&select=*`;

  const response = await fetch(participantsUrl, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });

  const participants = await response.json();

  console.log('=== CLEMSY COMPETITION REGISTRATIONS ===\n');
  console.log('Participants entries:', participants.length);

  if (participants.length > 0) {
    for (const p of participants) {
      console.log(`  Competition: ${p.competition_id}`);
    }
  } else {
    console.log('  ❌ Clemsy is NOT registered in any competitions!');
  }

  // Check all competition IDs
  console.log('\n=== ALL COMPETITIONS ===\n');

  const compsUrl = `${SUPABASE_URL}/rest/v1/competitions?select=id,external_id,activity_type`;

  const compsResponse = await fetch(compsUrl, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });

  const comps = await compsResponse.json();

  for (const c of comps) {
    console.log(`  ${c.external_id}: ${c.id} (${c.activity_type})`);
  }

  // Check participant count per competition
  console.log('\n=== PARTICIPANT COUNTS ===\n');

  const allParticipantsUrl = `${SUPABASE_URL}/rest/v1/competition_participants?select=competition_id`;

  const allParticipantsResponse = await fetch(allParticipantsUrl, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });

  const allParticipants = await allParticipantsResponse.json();

  const counts = {};
  for (const p of allParticipants) {
    counts[p.competition_id] = (counts[p.competition_id] || 0) + 1;
  }

  for (const c of comps) {
    console.log(`  ${c.external_id}: ${counts[c.id] || 0} participants`);
  }
}

main().catch(console.error);
