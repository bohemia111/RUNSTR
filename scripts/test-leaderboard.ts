/**
 * Leaderboard Calculation Test
 *
 * Tests the complete leaderboard data flow:
 * 1. Create event with participant list
 * 2. Publish mock kind 1301 workout events for participants
 * 3. Query workouts by participant pubkeys
 * 4. Verify workout data structure
 *
 * Usage: npx tsx scripts/test-leaderboard.ts
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

class LeaderboardTest {
  private results: TestResult[] = [];
  private captainSigner: NDKPrivateKeySigner | null = null;
  private captainPubkey: string = '';
  private participantSigners: NDKPrivateKeySigner[] = [];
  private participantPubkeys: string[] = [];
  private eventId: string = '';
  private ndk: NDK | null = null;
  private publishedWorkoutIds: string[] = [];

  async run(): Promise<void> {
    console.log('🧪 Starting Leaderboard Data Flow Test\n');
    console.log('=' .repeat(60));

    try {
      await this.setup();
      await this.createEventAndParticipants();
      await this.publishWorkoutEvents();
      await this.testWorkoutQuery();
      await this.testWorkoutDataStructure();
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

      // Generate captain
      this.captainSigner = NDKPrivateKeySigner.generate();
      const captainUser = await this.captainSigner.user();
      this.captainPubkey = captainUser.pubkey;

      // Generate 3 test participants
      for (let i = 0; i < 3; i++) {
        const signer = NDKPrivateKeySigner.generate();
        const user = await signer.user();
        this.participantSigners.push(signer);
        this.participantPubkeys.push(user.pubkey);
      }

      this.addResult(
        'Setup',
        true,
        `Captain + ${this.participantPubkeys.length} participants created`
      );
    } catch (error) {
      this.addResult('Setup', false, undefined, String(error));
      throw error;
    }
  }

  private async createEventAndParticipants(): Promise<void> {
    console.log('\n🏃 Creating event and participant list...');

    try {
      if (!this.ndk || !this.captainSigner) {
        throw new Error('NDK or signer not initialized');
      }

      // Generate event ID
      const timestamp = Math.floor(Date.now() / 1000).toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      this.eventId = `event_leadertest_${timestamp}_${random}`;

      // Create participant list with all participants
      const allParticipants = [this.captainPubkey, ...this.participantPubkeys];
      const dTag = `event-${this.eventId}-participants`;

      const tags: string[][] = [
        ['d', dTag],
        ['name', 'Leaderboard Test Participants'],
      ];

      // Add all participants
      allParticipants.forEach(pubkey => {
        tags.push(['p', pubkey]);
      });

      tags.push(['t', 'team']);
      tags.push(['t', 'fitness']);

      const listEvent = new NDKEvent(this.ndk);
      listEvent.kind = 30000;
      listEvent.content = 'Test participant list';
      listEvent.tags = tags;
      listEvent.created_at = Math.floor(Date.now() / 1000);

      await listEvent.sign(this.captainSigner);
      await listEvent.publish();

      await this.sleep(2000);

      this.addResult(
        'Event & Participants',
        true,
        `Created event with ${allParticipants.length} participants`
      );
    } catch (error) {
      this.addResult('Event & Participants', false, undefined, String(error));
      throw error;
    }
  }

  private async publishWorkoutEvents(): Promise<void> {
    console.log('\n🏃‍♂️ Publishing workout events (kind 1301)...');

    try {
      if (!this.ndk) {
        throw new Error('NDK not initialized');
      }

      const now = Math.floor(Date.now() / 1000);

      // Participant 1: 5K in 20 minutes
      await this.publishWorkout(
        this.participantSigners[0],
        '5.0',
        '00:20:00',
        '400',
        now
      );

      // Participant 2: 5K in 25 minutes
      await this.publishWorkout(
        this.participantSigners[1],
        '5.0',
        '00:25:00',
        '380',
        now
      );

      // Participant 3: 5K in 30 minutes
      await this.publishWorkout(
        this.participantSigners[2],
        '5.0',
        '00:30:00',
        '350',
        now
      );

      await this.sleep(2000);

      this.addResult(
        'Publish Workouts',
        true,
        `Published ${this.publishedWorkoutIds.length} workout events`
      );
    } catch (error) {
      this.addResult('Publish Workouts', false, undefined, String(error));
      throw error;
    }
  }

  private async publishWorkout(
    signer: NDKPrivateKeySigner,
    distanceKm: string,
    durationStr: string,
    calories: string,
    timestamp: number
  ): Promise<void> {
    if (!this.ndk) throw new Error('NDK not initialized');

    const user = await signer.user();

    const tags: string[][] = [
      ['exercise', 'running'],
      ['distance', distanceKm],
      ['duration', durationStr],
      ['calories', calories],
    ];

    const workoutEvent = new NDKEvent(this.ndk);
    workoutEvent.kind = 1301;
    workoutEvent.content = `Ran ${distanceKm}km in ${durationStr}`;
    workoutEvent.tags = tags;
    workoutEvent.created_at = timestamp;

    await workoutEvent.sign(signer);
    await workoutEvent.publish();

    if (workoutEvent.id) {
      this.publishedWorkoutIds.push(workoutEvent.id);
    }
  }

  private async testWorkoutQuery(): Promise<void> {
    console.log('\n🔍 Testing workout query by participants...');

    try {
      if (!this.ndk) {
        throw new Error('NDK not initialized');
      }

      // Query workouts for all participants
      const allParticipants = [this.captainPubkey, ...this.participantPubkeys];

      const filter: NDKFilter = {
        kinds: [1301],
        authors: allParticipants,
        limit: 100,
      };

      const workouts = await this.ndk.fetchEvents(filter);
      const workoutsArray = Array.from(workouts);

      if (workoutsArray.length < 3) {
        throw new Error(
          `Expected at least 3 workouts, got ${workoutsArray.length}`
        );
      }

      // Verify workouts are from our participants
      const workoutAuthors = new Set(workoutsArray.map(w => w.pubkey));
      const hasExpectedAuthors = this.participantPubkeys.every(pubkey =>
        workoutAuthors.has(pubkey)
      );

      if (!hasExpectedAuthors) {
        throw new Error('Not all participant workouts found');
      }

      this.addResult(
        'Workout Query',
        true,
        `Found ${workoutsArray.length} workouts from ${workoutAuthors.size} participants`
      );
    } catch (error) {
      this.addResult('Workout Query', false, undefined, String(error));
      throw error;
    }
  }

  private async testWorkoutDataStructure(): Promise<void> {
    console.log('\n📊 Testing workout data structure...');

    try {
      if (!this.ndk) {
        throw new Error('NDK not initialized');
      }

      // Query one workout to validate structure
      const filter: NDKFilter = {
        kinds: [1301],
        authors: [this.participantPubkeys[0]],
        limit: 1,
      };

      const workouts = await this.ndk.fetchEvents(filter);
      const workout = Array.from(workouts)[0];

      if (!workout) {
        throw new Error('No workout found for validation');
      }

      // Validate required tags
      const getTag = (name: string) =>
        workout.tags.find(t => t[0] === name)?.[1];

      const exercise = getTag('exercise');
      const distance = getTag('distance');
      const duration = getTag('duration');
      const calories = getTag('calories');

      if (!exercise) throw new Error('Missing exercise tag');
      if (!distance) throw new Error('Missing distance tag');
      if (!duration) throw new Error('Missing duration tag');
      if (!calories) throw new Error('Missing calories tag');

      // Validate values
      if (exercise !== 'running') {
        throw new Error(`Expected exercise=running, got ${exercise}`);
      }

      if (parseFloat(distance) !== 5.0) {
        throw new Error(`Expected distance=5.0, got ${distance}`);
      }

      if (!duration.match(/^\d{2}:\d{2}:\d{2}$/)) {
        throw new Error(`Invalid duration format: ${duration}`);
      }

      this.addResult(
        'Workout Data Structure',
        true,
        `Valid: exercise=${exercise}, distance=${distance}km, duration=${duration}`
      );
    } catch (error) {
      this.addResult('Workout Data Structure', false, undefined, String(error));
      throw error;
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
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Results Summary\n');

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  - ${r.step}: ${r.error}`);
        });
    }

    console.log('\n' + '='.repeat(60));

    if (failed === 0) {
      console.log('🎉 All tests passed! Leaderboard data flow is working correctly.\n');
    } else {
      console.log('⚠️  Some tests failed. Please review errors above.\n');
      process.exit(1);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the test
const test = new LeaderboardTest();
test.run().catch(console.error);
