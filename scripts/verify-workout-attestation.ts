/**
 * Workout Attestation Verification Script
 *
 * This script verifies that a kind 1301 workout event has a corresponding
 * kind 1302 attestation event from the official RUNSTR app.
 *
 * Usage:
 *   npx ts-node scripts/verify-workout-attestation.ts <event_id>
 *   npx ts-node scripts/verify-workout-attestation.ts <npub>
 *
 * Examples:
 *   # Verify a specific workout event
 *   npx ts-node scripts/verify-workout-attestation.ts abc123...
 *
 *   # Verify all recent workouts from a user
 *   npx ts-node scripts/verify-workout-attestation.ts npub1abc...
 */

import NDK, { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

// RUNSTR Attestation Public Key
// npub: npub1ykgg75r2dh809py86p4p5z6sgef4t3k3ag0q2pm2mvfylmxyc2nqpj73g0
const RUNSTR_ATTESTATION_PUBKEY = '25908f506a6dcef28487d06a1a0b50465355c6d1ea1e05076adb124fecc4c2a6';

// Nostr relays to query
const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

interface VerificationResult {
  workoutEventId: string;
  hasAttestation: boolean;
  attestationEventId?: string;
  workoutAuthor?: string;
  workoutTimestamp?: number;
  error?: string;
}

/**
 * Convert npub to hex pubkey
 */
function npubToHex(npub: string): string {
  const decoded = nip19.decode(npub);
  if (decoded.type !== 'npub') {
    throw new Error('Invalid npub format');
  }
  return decoded.data as string;
}

/**
 * Verify a single workout event has valid attestation
 */
async function verifyWorkout(
  ndk: NDK,
  eventId: string
): Promise<VerificationResult> {
  try {
    // First, fetch the workout event to confirm it exists
    const workoutFilter: NDKFilter = {
      ids: [eventId],
      kinds: [1301],
    };

    const workoutEvents = await ndk.fetchEvents(workoutFilter);
    const workoutEvent = Array.from(workoutEvents)[0];

    if (!workoutEvent) {
      return {
        workoutEventId: eventId,
        hasAttestation: false,
        error: 'Workout event not found',
      };
    }

    // Now check for attestation events that reference this workout
    const attestationFilter: NDKFilter = {
      kinds: [1302],
      '#e': [eventId],
      authors: [RUNSTR_ATTESTATION_PUBKEY],
    };

    const attestationEvents = await ndk.fetchEvents(attestationFilter);

    if (attestationEvents.size > 0) {
      const attestation = Array.from(attestationEvents)[0];
      return {
        workoutEventId: eventId,
        hasAttestation: true,
        attestationEventId: attestation.id,
        workoutAuthor: workoutEvent.pubkey,
        workoutTimestamp: workoutEvent.created_at,
      };
    }

    return {
      workoutEventId: eventId,
      hasAttestation: false,
      workoutAuthor: workoutEvent.pubkey,
      workoutTimestamp: workoutEvent.created_at,
    };
  } catch (error) {
    return {
      workoutEventId: eventId,
      hasAttestation: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify all recent workouts from a user
 */
async function verifyUserWorkouts(
  ndk: NDK,
  userPubkey: string,
  limit: number = 10
): Promise<VerificationResult[]> {
  // Fetch user's recent workouts
  const workoutFilter: NDKFilter = {
    kinds: [1301],
    authors: [userPubkey],
    limit,
  };

  const workoutEvents = await ndk.fetchEvents(workoutFilter);
  const results: VerificationResult[] = [];

  for (const workout of workoutEvents) {
    if (workout.id) {
      const result = await verifyWorkout(ndk, workout.id);
      results.push(result);
    }
  }

  return results;
}

/**
 * Main verification routine
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  npx ts-node scripts/verify-workout-attestation.ts <event_id>');
    console.log('  npx ts-node scripts/verify-workout-attestation.ts <npub>');
    console.log('');
    console.log('Examples:');
    console.log('  # Verify a specific workout event');
    console.log('  npx ts-node scripts/verify-workout-attestation.ts abc123...');
    console.log('');
    console.log('  # Verify all recent workouts from a user');
    console.log('  npx ts-node scripts/verify-workout-attestation.ts npub1abc...');
    process.exit(1);
  }

  const input = args[0];

  // Check if attestation pubkey is configured
  if (RUNSTR_ATTESTATION_PUBKEY === 'YOUR_ATTESTATION_PUBKEY_HEX_HERE') {
    console.error('ERROR: RUNSTR_ATTESTATION_PUBKEY not configured!');
    console.error('');
    console.error('After generating the attestation key with:');
    console.error('  node scripts/generate-attestation-key.cjs');
    console.error('');
    console.error('Update the RUNSTR_ATTESTATION_PUBKEY in this file with the hex pubkey.');
    process.exit(1);
  }

  console.log('Connecting to relays...');
  const ndk = new NDK({ explicitRelayUrls: RELAYS });
  await ndk.connect();

  // Wait for relay connections
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log('Connected to relays');
  console.log('');

  let results: VerificationResult[];

  if (input.startsWith('npub1')) {
    // Verify all workouts from a user
    console.log(`Verifying recent workouts for: ${input}`);
    console.log('');

    const userPubkey = npubToHex(input);
    results = await verifyUserWorkouts(ndk, userPubkey);
  } else {
    // Verify a single event
    console.log(`Verifying workout: ${input}`);
    console.log('');

    const result = await verifyWorkout(ndk, input);
    results = [result];
  }

  // Display results
  console.log('='.repeat(60));
  console.log('VERIFICATION RESULTS');
  console.log('='.repeat(60));
  console.log('');

  let verified = 0;
  let unverified = 0;
  let errors = 0;

  for (const result of results) {
    if (result.error) {
      console.log(`[ERROR] ${result.workoutEventId.slice(0, 16)}...`);
      console.log(`        ${result.error}`);
      errors++;
    } else if (result.hasAttestation) {
      console.log(`[VERIFIED] ${result.workoutEventId.slice(0, 16)}...`);
      console.log(`           Attestation: ${result.attestationEventId?.slice(0, 16)}...`);
      if (result.workoutTimestamp) {
        const date = new Date(result.workoutTimestamp * 1000);
        console.log(`           Time: ${date.toISOString()}`);
      }
      verified++;
    } else {
      console.log(`[UNVERIFIED] ${result.workoutEventId.slice(0, 16)}...`);
      if (result.workoutTimestamp) {
        const date = new Date(result.workoutTimestamp * 1000);
        console.log(`             Time: ${date.toISOString()}`);
      }
      console.log(`             No attestation from RUNSTR app found`);
      unverified++;
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total workouts: ${results.length}`);
  console.log(`Verified (from RUNSTR app): ${verified}`);
  console.log(`Unverified (no attestation): ${unverified}`);
  console.log(`Errors: ${errors}`);
  console.log('');

  if (unverified > 0) {
    console.log('NOTE: Unverified workouts may have been published:');
    console.log('  - Before attestation was implemented');
    console.log('  - From a third-party app');
    console.log('  - Manually via nostr clients');
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
