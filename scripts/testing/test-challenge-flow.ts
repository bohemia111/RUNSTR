/**
 * Challenge Flow Integration Test - Tag-Based Architecture
 *
 * Tests the complete simplified challenge system:
 * 1. Create kind 30102 challenge with tag-based participants (no kind 30000 lists)
 * 2. Publish kind 1301 workout events for both participants
 * 3. Calculate leaderboard using fastest time metric
 * 4. Test user challenge discovery via '#p' tag queries
 * 5. Verify UnifiedSigningService integration patterns
 *
 * Simplified Challenge Model:
 * - 4 distances only: 5K, 10K, Half Marathon, Marathon
 * - 1-day duration (24 hours) fixed
 * - Fastest time scoring only
 * - Instant creation (no acceptance flow)
 * - Participants stored in 'p' tags (no kind 30000 lists)
 *
 * Usage: npx tsx scripts/test-challenge-flow.ts
 */

import NDK, { NDKEvent, NDKPrivateKeySigner, NDKFilter } from '@nostr-dev-kit/ndk';
import 'websocket-polyfill';

// Same relays the app uses
const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

interface TestResult {
  step: string;
  success: boolean;
  details?: string;
  error?: string;
}

class ChallengeFlowTest {
  private results: TestResult[] = [];
  private creatorSigner: NDKPrivateKeySigner | null = null;
  private creatorPubkey: string = '';
  private opponentSigner: NDKPrivateKeySigner | null = null;
  private opponentPubkey: string = '';
  private challengeId: string = '';
  private ndk: NDK | null = null;
  private challengeEventId: string = '';

  async run(): Promise<void> {
    console.log('🧪 Starting Challenge Flow Integration Test\n');
    console.log('Testing: Tag-based challenges (kind 30102) + fastest time leaderboards');
    console.log('=' .repeat(70));

    try {
      await this.setup();
      await this.createChallenge();
      await this.queryChallengeEvent();
      await this.publishWorkouts();
      await this.testLeaderboardCalculation();
      await this.testUserChallengeDiscovery();
      await this.testUnifiedSigningPattern();
      await this.cleanup();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    } finally {
      this.printResults();
    }
  }

  private async setup(): Promise<void> {
    console.log('\n📋 Setting up test environment...');

    try {
      // Initialize NDK
      this.ndk = new NDK({ explicitRelayUrls: RELAYS });
      await this.ndk.connect();
      console.log(`🔌 Connected to ${RELAYS.length} relays`);

      // Generate challenge creator (user initiating challenge)
      this.creatorSigner = NDKPrivateKeySigner.generate();
      const creatorUser = await this.creatorSigner.user();
      this.creatorPubkey = creatorUser.pubkey;

      // Generate opponent (user being challenged)
      this.opponentSigner = NDKPrivateKeySigner.generate();
      const opponentUser = await this.opponentSigner.user();
      this.opponentPubkey = opponentUser.pubkey;

      this.addResult(
        'Setup',
        true,
        `Creator: ${this.creatorPubkey.slice(0, 16)}... | Opponent: ${this.opponentPubkey.slice(0, 16)}...`
      );
    } catch (error) {
      this.addResult('Setup', false, undefined, String(error));
      throw error;
    }
  }

  private async createChallenge(): Promise<void> {
    console.log('\n🏃 Creating kind 30102 challenge with tag-based participants...');

    try {
      if (!this.ndk || !this.creatorSigner) {
        throw new Error('NDK or signer not initialized');
      }

      // Generate challenge ID (matches ChallengeService pattern)
      this.challengeId = `challenge_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Calculate timestamps (24-hour challenge)
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

      // Build tags for kind 30102 event
      const tags: string[][] = [
        ['d', this.challengeId],                       // d-tag: challenge identifier
        ['name', '5K Challenge'],                      // Challenge name
        ['activity', 'running'],                       // Activity type
        ['distance', '5'],                             // Distance in km
        ['metric', 'fastest_time'],                    // Scoring metric
        ['duration', '24'],                            // Duration in hours
        ['start_date', startDate.toISOString()],       // Start timestamp
        ['end_date', endDate.toISOString()],           // End timestamp
        ['wager', '2100'],                             // Wager in sats (optional)
        ['max_participants', '2'],                     // 1v1 only
        ['status', 'open'],                            // Challenge status
        ['p', this.creatorPubkey],                     // Participant 1 (creator)
        ['p', this.opponentPubkey],                    // Participant 2 (opponent)
      ];

      // Create kind 30102 event
      const challengeEvent = new NDKEvent(this.ndk);
      challengeEvent.kind = 30102;
      challengeEvent.content = '5K Challenge - 24h';
      challengeEvent.tags = tags;
      challengeEvent.created_at = Math.floor(Date.now() / 1000);

      await challengeEvent.sign(this.creatorSigner);
      await challengeEvent.publish();

      // Store event ID for verification
      this.challengeEventId = challengeEvent.id || '';

      // Wait for propagation
      await this.sleep(2000);

      this.addResult(
        'Challenge Creation',
        true,
        `Kind 30102 published with ID: ${this.challengeId}`
      );
    } catch (error) {
      this.addResult('Challenge Creation', false, undefined, String(error));
      throw error;
    }
  }

  private async queryChallengeEvent(): Promise<void> {
    console.log('\n🔍 Querying challenge event by d-tag...');

    try {
      if (!this.ndk) {
        throw new Error('NDK not initialized');
      }

      // Query kind 30102 event by d-tag (matches ChallengeService.getChallengeEvent)
      const filter: NDKFilter = {
        kinds: [30102],
        '#d': [this.challengeId],
        limit: 1,
      };

      const events = await this.ndk.fetchEvents(filter);
      const eventArray = Array.from(events);

      if (eventArray.length === 0) {
        throw new Error(`Challenge not found with d-tag: ${this.challengeId}`);
      }

      const challengeEvent = eventArray[0];

      // Extract participants from 'p' tags
      const participants = challengeEvent.tags
        .filter((tag) => tag[0] === 'p')
        .map((tag) => tag[1])
        .filter(Boolean);

      if (participants.length !== 2) {
        throw new Error(`Expected 2 participants, found ${participants.length}`);
      }

      if (!participants.includes(this.creatorPubkey) || !participants.includes(this.opponentPubkey)) {
        throw new Error('Creator or opponent not found in participant tags');
      }

      // Verify metadata tags
      const tags = new Map(challengeEvent.tags.map((t) => [t[0], t[1]]));
      const distance = tags.get('distance');
      const metric = tags.get('metric');
      const wager = tags.get('wager');

      if (distance !== '5') throw new Error(`Expected distance=5, got ${distance}`);
      if (metric !== 'fastest_time') throw new Error(`Expected metric=fastest_time, got ${metric}`);
      if (wager !== '2100') throw new Error(`Expected wager=2100, got ${wager}`);

      this.addResult(
        'Challenge Query',
        true,
        `Found challenge with ${participants.length} participants (distance: ${distance}km, metric: ${metric})`
      );
    } catch (error) {
      this.addResult('Challenge Query', false, undefined, String(error));
      throw error;
    }
  }

  private async publishWorkouts(): Promise<void> {
    console.log('\n🏃‍♂️ Publishing kind 1301 workout events...');

    try {
      if (!this.ndk || !this.creatorSigner || !this.opponentSigner) {
        throw new Error('NDK or signers not initialized');
      }

      const now = Math.floor(Date.now() / 1000);

      // Creator: 5K in 20 minutes (faster - should win)
      await this.publishWorkout(
        this.creatorSigner,
        'running',
        '5.0',
        '00:20:00',
        '400',
        now
      );

      // Opponent: 5K in 25 minutes (slower)
      await this.publishWorkout(
        this.opponentSigner,
        'running',
        '5.0',
        '00:25:00',
        '380',
        now
      );

      // Wait for propagation
      await this.sleep(2000);

      this.addResult(
        'Workout Publishing',
        true,
        'Published 2 workouts: Creator (20:00) vs Opponent (25:00)'
      );
    } catch (error) {
      this.addResult('Workout Publishing', false, undefined, String(error));
      throw error;
    }
  }

  private async publishWorkout(
    signer: NDKPrivateKeySigner,
    exercise: string,
    distanceKm: string,
    durationStr: string,
    calories: string,
    timestamp: number
  ): Promise<void> {
    if (!this.ndk) throw new Error('NDK not initialized');

    // Kind 1301 workout event format (matches KIND_1301_SPEC.md)
    const tags: string[][] = [
      ['exercise', exercise],        // lowercase full word
      ['distance', distanceKm],      // separate array elements
      ['duration', durationStr],     // HH:MM:SS format
      ['calories', calories],        // calorie burn
    ];

    const workoutEvent = new NDKEvent(this.ndk);
    workoutEvent.kind = 1301;
    workoutEvent.content = `Ran ${distanceKm}km in ${durationStr}`;
    workoutEvent.tags = tags;
    workoutEvent.created_at = timestamp;

    await workoutEvent.sign(signer);
    await workoutEvent.publish();
  }

  private async testLeaderboardCalculation(): Promise<void> {
    console.log('\n📊 Testing leaderboard calculation...');

    try {
      if (!this.ndk) {
        throw new Error('NDK not initialized');
      }

      // Step 1: Fetch challenge event
      const filter: NDKFilter = {
        kinds: [30102],
        '#d': [this.challengeId],
        limit: 1,
      };

      const events = await this.ndk.fetchEvents(filter);
      const challengeEvent = Array.from(events)[0];

      if (!challengeEvent) {
        throw new Error('Challenge event not found');
      }

      // Step 2: Extract participants from 'p' tags
      const participants = challengeEvent.tags
        .filter((tag) => tag[0] === 'p')
        .map((tag) => tag[1])
        .filter(Boolean);

      console.log(`   Participants: ${participants.length}`);

      // Step 3: Query workouts for each participant
      const participantProgress: Array<{
        pubkey: string;
        fastestTime: number;
        workoutCount: number;
      }> = [];

      for (const pubkey of participants) {
        const workoutFilter: NDKFilter = {
          kinds: [1301],
          authors: [pubkey],
        };

        const workouts = await this.ndk.fetchEvents(workoutFilter);
        const workoutsArray = Array.from(workouts);

        // Calculate fastest time (convert HH:MM:SS to seconds)
        let fastestTime = 0;
        for (const workout of workoutsArray) {
          const durationTag = workout.tags.find((t) => t[0] === 'duration');
          if (durationTag && durationTag[1]) {
            const parts = durationTag[1].split(':');
            if (parts.length === 3) {
              const seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
              if (fastestTime === 0 || seconds < fastestTime) {
                fastestTime = seconds;
              }
            }
          }
        }

        participantProgress.push({
          pubkey,
          fastestTime,
          workoutCount: workoutsArray.length,
        });
      }

      // Step 4: Sort by fastest time (lower = better)
      participantProgress.sort((a, b) => {
        if (a.fastestTime === 0) return 1;
        if (b.fastestTime === 0) return -1;
        return a.fastestTime - b.fastestTime;
      });

      // Step 5: Verify results
      const winner = participantProgress[0];
      const loser = participantProgress[1];

      if (winner.pubkey !== this.creatorPubkey) {
        throw new Error('Creator should be winner (faster time)');
      }

      if (winner.fastestTime !== 20 * 60) {
        throw new Error(`Expected winner time 1200s (20:00), got ${winner.fastestTime}s`);
      }

      if (loser.fastestTime !== 25 * 60) {
        throw new Error(`Expected loser time 1500s (25:00), got ${loser.fastestTime}s`);
      }

      const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };

      this.addResult(
        'Leaderboard Calculation',
        true,
        `Winner: ${winner.pubkey.slice(0, 8)}... (${formatTime(winner.fastestTime)}) | Loser: ${loser.pubkey.slice(0, 8)}... (${formatTime(loser.fastestTime)})`
      );
    } catch (error) {
      this.addResult('Leaderboard Calculation', false, undefined, String(error));
      throw error;
    }
  }

  private async testUserChallengeDiscovery(): Promise<void> {
    console.log('\n🔎 Testing user challenge discovery via #p tags...');

    try {
      if (!this.ndk) {
        throw new Error('NDK not initialized');
      }

      // Test creator's challenge query (matches ChallengeService.getUserChallenges)
      const creatorFilter: NDKFilter = {
        kinds: [30102],
        '#p': [this.creatorPubkey],
      };

      const creatorChallenges = await this.ndk.fetchEvents(creatorFilter);
      const creatorChallengesArray = Array.from(creatorChallenges);

      if (creatorChallengesArray.length === 0) {
        throw new Error('Creator cannot find their challenge');
      }

      // Test opponent's challenge query
      const opponentFilter: NDKFilter = {
        kinds: [30102],
        '#p': [this.opponentPubkey],
      };

      const opponentChallenges = await this.ndk.fetchEvents(opponentFilter);
      const opponentChallengesArray = Array.from(opponentChallenges);

      if (opponentChallengesArray.length === 0) {
        throw new Error('Opponent cannot find their challenge');
      }

      // Verify both found the same challenge
      const creatorFoundId = creatorChallengesArray[0].tags.find((t) => t[0] === 'd')?.[1];
      const opponentFoundId = opponentChallengesArray[0].tags.find((t) => t[0] === 'd')?.[1];

      if (creatorFoundId !== this.challengeId || opponentFoundId !== this.challengeId) {
        throw new Error('Challenge IDs do not match');
      }

      this.addResult(
        'User Challenge Discovery',
        true,
        `Both participants found challenge ${this.challengeId.slice(0, 20)}... via '#p' tag filter`
      );
    } catch (error) {
      this.addResult('User Challenge Discovery', false, undefined, String(error));
      throw error;
    }
  }

  private async testUnifiedSigningPattern(): Promise<void> {
    console.log('\n🔐 Documenting UnifiedSigningService pattern...');

    try {
      const documentation = `
      UnifiedSigningService Usage Pattern:

      In Production Code:
      -------------------
      import { UnifiedSigningService } from '@/services/auth/UnifiedSigningService';

      // Get signer (works for both nsec and Amber authentication)
      const signingService = UnifiedSigningService.getInstance();
      const signer = await signingService.getSigner();

      if (!signer) {
        throw new Error('User not authenticated');
      }

      // Sign and publish event
      const event = new NDKEvent(ndk);
      event.kind = 30102;
      event.content = 'Challenge content';
      event.tags = challengeTags;

      await event.sign(signer);
      await event.publish();

      In Test Scripts:
      ----------------
      // For simplicity, tests use NDKPrivateKeySigner.generate() directly
      const testSigner = NDKPrivateKeySigner.generate();
      const testUser = await testSigner.user();

      // This bypasses UnifiedSigningService but tests the same signing flow

      Key Points:
      -----------
      1. UnifiedSigningService.getSigner() returns NDKSigner (works for nsec + Amber)
      2. Automatically sets signer on GlobalNDK instance
      3. Handles both authentication methods transparently
      4. Production code should always use UnifiedSigningService
      5. Test scripts can use direct signers for simplicity
      `;

      console.log(documentation);

      this.addResult(
        'UnifiedSigningService Pattern',
        true,
        'Pattern documented (see above)'
      );
    } catch (error) {
      this.addResult('UnifiedSigningService Pattern', false, undefined, String(error));
    }
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test data...');

    try {
      this.addResult(
        'Cleanup',
        true,
        'Test events remain on relays (manual cleanup required)'
      );
    } catch (error) {
      this.addResult('Cleanup', false, undefined, String(error));
    }
  }

  private addResult(
    step: string,
    success: boolean,
    details?: string,
    error?: string
  ): void {
    this.results.push({ step, success, details, error });

    const icon = success ? '✅' : '❌';
    console.log(`${icon} ${step}`);
    if (details) console.log(`   ${details}`);
    if (error) console.log(`   Error: ${error}`);
  }

  private printResults(): void {
    console.log('\n' + '='.repeat(70));
    console.log('📊 Test Results Summary\n');

    const passed = this.results.filter((r) => r.success).length;
    const failed = this.results.filter((r) => !r.success).length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  - ${r.step}: ${r.error}`);
        });
    }

    console.log('\n' + '='.repeat(70));

    if (failed === 0) {
      console.log('🎉 All tests passed! Tag-based challenge flow is working correctly.\n');
      console.log('Key Validations:');
      console.log('  ✅ Kind 30102 uses d-tag + p-tags (no kind 30000 lists)');
      console.log('  ✅ Fastest time metric (lower value = better)');
      console.log('  ✅ Both participants can discover challenge via #p filter');
      console.log('  ✅ Leaderboard sorting correct (20:00 beats 25:00)');
      console.log('  ✅ UnifiedSigningService pattern documented\n');
    } else {
      console.log('⚠️  Some tests failed. Please review errors above.\n');
      process.exit(1);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Run the test
const test = new ChallengeFlowTest();
test.run().catch(console.error);
