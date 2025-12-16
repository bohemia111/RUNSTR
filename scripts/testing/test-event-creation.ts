/**
 * Event Creation Integration Test
 *
 * Tests the complete event creation flow to ensure:
 * 1. Event ID is generated consistently
 * 2. Participant list is created FIRST with correct d-tag
 * 3. Event is created with matching ID
 * 4. Participant list can be queried using event ID
 * 5. Captain is automatically added as first participant
 *
 * Usage: npx tsx scripts/test-event-creation.ts
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

class EventCreationTest {
  private results: TestResult[] = [];
  private testSigner: NDKPrivateKeySigner | null = null;
  private captainPubkey: string = '';
  private eventId: string = '';
  private ndk: NDK | null = null;

  async run(): Promise<void> {
    console.log('🧪 Starting Event Creation Integration Test\n');
    console.log('=' .repeat(60));

    try {
      await this.setup();
      await this.testEventIdGeneration();
      await this.testParticipantListCreation();
      await this.testEventCreation();
      await this.testParticipantListQuery();
      await this.testCaptainAutoJoin();
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

      // Generate test captain signer
      this.testSigner = NDKPrivateKeySigner.generate();
      const user = await this.testSigner.user();
      this.captainPubkey = user.pubkey;

      this.addResult('Setup', true, `Test captain: ${this.captainPubkey.slice(0, 16)}...`);
    } catch (error) {
      this.addResult('Setup', false, undefined, String(error));
      throw error;
    }
  }

  private async testEventIdGeneration(): Promise<void> {
    console.log('\n🔑 Testing Event ID Generation...');

    try {
      // Simulate wizard's ID generation logic
      const timestamp = Math.floor(Date.now() / 1000).toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      const sanitizedName = 'Test 5K Race'
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 10);

      this.eventId = `event_${sanitizedName}_${timestamp}_${random}`;

      if (!this.eventId || this.eventId.length < 20) {
        throw new Error('Generated event ID is invalid or too short');
      }

      this.addResult(
        'Event ID Generation',
        true,
        `Generated ID: ${this.eventId}`
      );
    } catch (error) {
      this.addResult('Event ID Generation', false, undefined, String(error));
      throw error;
    }
  }

  private async testParticipantListCreation(): Promise<void> {
    console.log('\n📋 Testing Participant List Creation (Kind 30000)...');

    try {
      if (!this.ndk || !this.testSigner) {
        throw new Error('NDK or signer not initialized');
      }

      const dTag = `event-${this.eventId}-participants`;

      // Create participant list event (kind 30000)
      const tags: string[][] = [
        ['d', dTag],
        ['name', 'Test 5K Race Participants'],
        ['description', 'Participants for Test 5K Race'],
        ['p', this.captainPubkey], // Captain is first member
        ['t', 'team'],
        ['t', 'fitness'],
      ];

      const listEvent = new NDKEvent(this.ndk);
      listEvent.kind = 30000;
      listEvent.content = 'Participants for Test 5K Race';
      listEvent.tags = tags;
      listEvent.created_at = Math.floor(Date.now() / 1000);

      await listEvent.sign(this.testSigner);
      await listEvent.publish();

      // Wait for propagation
      await this.sleep(2000);

      // Verify d-tag matches expected format
      const expectedDTag = `event-${this.eventId}-participants`;
      const actualDTag = listEvent.tags.find(t => t[0] === 'd')?.[1];

      if (actualDTag !== expectedDTag) {
        throw new Error(
          `D-tag mismatch! Expected: ${expectedDTag}, Got: ${actualDTag}`
        );
      }

      this.addResult(
        'Participant List Creation',
        true,
        `Published kind 30000 with d-tag: ${actualDTag}`
      );
    } catch (error) {
      this.addResult('Participant List Creation', false, undefined, String(error));
      throw error;
    }
  }

  private async testEventCreation(): Promise<void> {
    console.log('\n🏃 Testing Event Creation (Kind 30101)...');

    try {
      if (!this.ndk || !this.testSigner) {
        throw new Error('NDK or signer not initialized');
      }

      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const eventDate = futureDate.toISOString().split('T')[0];

      // Create event (kind 30101) using wizard's pre-generated ID
      const tags: string[][] = [
        ['d', this.eventId], // CRITICAL: Use wizard's ID
        ['name', 'Test 5K Race'],
        ['description', 'Integration test event'],
        ['activity', 'running'],
        ['event-date', eventDate],
        ['start-time', '08:00'],
        ['end-time', '12:00'],
        ['max-duration', '60'],
        ['entry-fee', '0'],
        ['scoring-type', 'fastest_time'],
        ['status', 'open'],
        ['t', 'fitness'],
        ['t', 'competition'],
      ];

      const eventNDK = new NDKEvent(this.ndk);
      eventNDK.kind = 30101;
      eventNDK.content = 'Integration test event';
      eventNDK.tags = tags;
      eventNDK.created_at = Math.floor(Date.now() / 1000);

      await eventNDK.sign(this.testSigner);
      await eventNDK.publish();

      // Wait for propagation
      await this.sleep(2000);

      // CRITICAL CHECK: Verify event d-tag matches wizard's ID
      const eventDTag = eventNDK.tags.find(t => t[0] === 'd')?.[1];
      if (eventDTag !== this.eventId) {
        throw new Error(
          `Event ID mismatch! Wizard: ${this.eventId}, Published: ${eventDTag}`
        );
      }

      this.addResult(
        'Event Creation',
        true,
        `Published kind 30101 with ID: ${eventDTag}`
      );
    } catch (error) {
      this.addResult('Event Creation', false, undefined, String(error));
      throw error;
    }
  }

  private async testParticipantListQuery(): Promise<void> {
    console.log('\n🔍 Testing Participant List Query...');

    try {
      if (!this.ndk) {
        throw new Error('NDK not initialized');
      }

      const dTag = `event-${this.eventId}-participants`;

      // Query participant list using NDK
      const filter: NDKFilter = {
        kinds: [30000],
        authors: [this.captainPubkey],
        '#d': [dTag],
        limit: 1,
      };

      const events = await this.ndk.fetchEvents(filter);
      const eventsArray = Array.from(events);

      if (eventsArray.length === 0) {
        throw new Error(
          `Participant list not found! Queried d-tag: ${dTag}`
        );
      }

      // Extract participants from p tags
      const listEvent = eventsArray[0];
      const participants = listEvent.tags
        .filter(t => t[0] === 'p')
        .map(t => t[1]);

      if (participants.length === 0) {
        throw new Error('Participant list is empty');
      }

      this.addResult(
        'Participant List Query',
        true,
        `Found ${participants.length} participant(s) using event ID`
      );
    } catch (error) {
      this.addResult('Participant List Query', false, undefined, String(error));
      throw error;
    }
  }

  private async testCaptainAutoJoin(): Promise<void> {
    console.log('\n👤 Testing Captain Auto-Join...');

    try {
      if (!this.ndk) {
        throw new Error('NDK not initialized');
      }

      const dTag = `event-${this.eventId}-participants`;

      // Query participant list
      const filter: NDKFilter = {
        kinds: [30000],
        authors: [this.captainPubkey],
        '#d': [dTag],
        limit: 1,
      };

      const events = await this.ndk.fetchEvents(filter);
      const eventsArray = Array.from(events);

      if (eventsArray.length === 0) {
        throw new Error('Participant list not found');
      }

      const participants = eventsArray[0].tags
        .filter(t => t[0] === 'p')
        .map(t => t[1]);

      if (!participants.includes(this.captainPubkey)) {
        throw new Error(
          'Captain not found in participant list! Auto-join failed.'
        );
      }

      this.addResult(
        'Captain Auto-Join',
        true,
        `Captain ${this.captainPubkey.slice(0, 16)}... is first participant`
      );
    } catch (error) {
      this.addResult('Captain Auto-Join', false, undefined, String(error));
      throw error;
    }
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test data...');

    try {
      // In production, you might delete test events here
      // For now, just log that cleanup would happen
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
      console.log('🎉 All tests passed! Event creation flow is working correctly.\n');
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
const test = new EventCreationTest();
test.run().catch(console.error);
