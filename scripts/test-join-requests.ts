/**
 * Join Request Flow Test
 *
 * Tests the complete join request workflow:
 * 1. Create test events (free and paid)
 * 2. Submit join requests (kind 1105) with payment tags
 * 3. Query join requests by captain and event ID
 * 4. Verify payment proof tags are preserved
 *
 * Usage: npx tsx scripts/test-join-requests.ts
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

class JoinRequestTest {
  private results: TestResult[] = [];
  private captainSigner: NDKPrivateKeySigner | null = null;
  private captainPubkey: string = '';
  private userSigner: NDKPrivateKeySigner | null = null;
  private userPubkey: string = '';
  private paidUserSigner: NDKPrivateKeySigner | null = null;
  private paidUserPubkey: string = '';
  private freeEventId: string = '';
  private paidEventId: string = '';
  private ndk: NDK | null = null;

  async run(): Promise<void> {
    console.log('🧪 Starting Join Request Flow Test\n');
    console.log('=' .repeat(60));

    try {
      await this.setup();
      await this.createEvents();
      await this.submitFreeJoinRequest();
      await this.submitPaidJoinRequest();
      await this.testQueryRequests();
      await this.testPaymentProofTags();
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

      // Generate free event user
      this.userSigner = NDKPrivateKeySigner.generate();
      const user = await this.userSigner.user();
      this.userPubkey = user.pubkey;

      // Generate paid event user
      this.paidUserSigner = NDKPrivateKeySigner.generate();
      const paidUser = await this.paidUserSigner.user();
      this.paidUserPubkey = paidUser.pubkey;

      this.addResult(
        'Setup',
        true,
        `Captain + 2 test users created`
      );
    } catch (error) {
      this.addResult('Setup', false, undefined, String(error));
      throw error;
    }
  }

  private async createEvents(): Promise<void> {
    console.log('\n🏃 Creating free and paid test events...');

    try {
      if (!this.ndk || !this.captainSigner) {
        throw new Error('NDK or signer not initialized');
      }

      const timestamp = Math.floor(Date.now() / 1000).toString(36);
      const random1 = Math.random().toString(36).substring(2, 8);
      const random2 = Math.random().toString(36).substring(2, 8);

      this.freeEventId = `event_freejoin_${timestamp}_${random1}`;
      this.paidEventId = `event_paidjoin_${timestamp}_${random2}`;

      // Create free event (entry fee = 0)
      const freeEventTags: string[][] = [
        ['d', this.freeEventId],
        ['name', 'Free Join Test Event'],
        ['entry-fee', '0'],
        ['t', 'fitness'],
      ];

      const freeEvent = new NDKEvent(this.ndk);
      freeEvent.kind = 30101;
      freeEvent.content = 'Test free event';
      freeEvent.tags = freeEventTags;
      freeEvent.created_at = Math.floor(Date.now() / 1000);

      await freeEvent.sign(this.captainSigner);
      await freeEvent.publish();

      // Create paid event (entry fee = 2100 sats)
      const paidEventTags: string[][] = [
        ['d', this.paidEventId],
        ['name', 'Paid Join Test Event'],
        ['entry-fee', '2100'],
        ['t', 'fitness'],
      ];

      const paidEvent = new NDKEvent(this.ndk);
      paidEvent.kind = 30101;
      paidEvent.content = 'Test paid event';
      paidEvent.tags = paidEventTags;
      paidEvent.created_at = Math.floor(Date.now() / 1000);

      await paidEvent.sign(this.captainSigner);
      await paidEvent.publish();

      await this.sleep(2000);

      this.addResult(
        'Event Creation',
        true,
        `Created free event (0 sats) and paid event (2100 sats)`
      );
    } catch (error) {
      this.addResult('Event Creation', false, undefined, String(error));
      throw error;
    }
  }

  private async submitFreeJoinRequest(): Promise<void> {
    console.log('\n📝 Submitting free join request...');

    try {
      if (!this.ndk || !this.userSigner) {
        throw new Error('NDK or signer not initialized');
      }

      const tags: string[][] = [
        ['e', this.freeEventId],
        ['p', this.captainPubkey],
        ['t', 'event-join-request'],
        ['event-id', this.freeEventId],
        ['event-name', 'Free Join Test Event'],
        ['team-id', 'test-team'],
      ];

      const joinRequest = new NDKEvent(this.ndk);
      joinRequest.kind = 1105;
      joinRequest.content = 'Please let me join the free event';
      joinRequest.tags = tags;
      joinRequest.created_at = Math.floor(Date.now() / 1000);

      await joinRequest.sign(this.userSigner);
      await joinRequest.publish();

      await this.sleep(2000);

      this.addResult(
        'Free Join Request',
        true,
        `Join request published for free event`
      );
    } catch (error) {
      this.addResult('Free Join Request', false, undefined, String(error));
      throw error;
    }
  }

  private async submitPaidJoinRequest(): Promise<void> {
    console.log('\n💳 Submitting paid join request with payment proof...');

    try {
      if (!this.ndk || !this.paidUserSigner) {
        throw new Error('NDK or signer not initialized');
      }

      const mockInvoice = 'lnbc21u1p3xyzabc...'; // Mock BOLT11 invoice

      const tags: string[][] = [
        ['e', this.paidEventId],
        ['p', this.captainPubkey],
        ['t', 'event-join-request'],
        ['event-id', this.paidEventId],
        ['event-name', 'Paid Join Test Event'],
        ['team-id', 'test-team'],
        ['payment_proof', mockInvoice], // Payment proof tag
        ['amount_paid', '2100'], // Amount paid tag
        ['payment_timestamp', Date.now().toString()], // Payment timestamp tag
      ];

      const joinRequest = new NDKEvent(this.ndk);
      joinRequest.kind = 1105;
      joinRequest.content = 'Paid 2100 sats entry fee';
      joinRequest.tags = tags;
      joinRequest.created_at = Math.floor(Date.now() / 1000);

      await joinRequest.sign(this.paidUserSigner);
      await joinRequest.publish();

      await this.sleep(2000);

      this.addResult(
        'Paid Join Request',
        true,
        `Join request published with payment proof (2100 sats)`
      );
    } catch (error) {
      this.addResult('Paid Join Request', false, undefined, String(error));
      throw error;
    }
  }

  private async testQueryRequests(): Promise<void> {
    console.log('\n🔍 Testing captain query for join requests...');

    try {
      if (!this.ndk) {
        throw new Error('NDK not initialized');
      }

      // Query all join requests for captain using subscription pattern with timeout
      const filter: NDKFilter = {
        kinds: [1105],
        '#p': [this.captainPubkey],
        limit: 100,
      };

      const requestsArray: any[] = [];
      const subscription = this.ndk.subscribe(filter, { closeOnEose: true });

      subscription.on('event', (event: any) => {
        requestsArray.push(event);
      });

      // Wait for events with timeout
      await this.sleep(3000);
      subscription.stop();

      if (requestsArray.length < 2) {
        throw new Error(
          `Expected at least 2 join requests, got ${requestsArray.length}`
        );
      }

      // Verify requests have correct event IDs
      const eventIds = requestsArray
        .map(r => r.tags.find((t: any) => t[0] === 'event-id')?.[1])
        .filter(Boolean);

      const hasFreeEvent = eventIds.includes(this.freeEventId);
      const hasPaidEvent = eventIds.includes(this.paidEventId);

      if (!hasFreeEvent || !hasPaidEvent) {
        throw new Error(
          `Missing join requests: free=${hasFreeEvent}, paid=${hasPaidEvent}`
        );
      }

      this.addResult(
        'Query Join Requests',
        true,
        `Found ${requestsArray.length} join requests for captain`
      );
    } catch (error) {
      this.addResult('Query Join Requests', false, undefined, String(error));
      throw error;
    }
  }

  private async testPaymentProofTags(): Promise<void> {
    console.log('\n💰 Testing payment proof tags...');

    try {
      if (!this.ndk) {
        throw new Error('NDK not initialized');
      }

      // Query paid event join request using subscription
      const filter: NDKFilter = {
        kinds: [1105],
        authors: [this.paidUserPubkey],
        '#event-id': [this.paidEventId],
        limit: 1,
      };

      const requests: any[] = [];
      const subscription = this.ndk.subscribe(filter, { closeOnEose: true });

      subscription.on('event', (event: any) => {
        requests.push(event);
      });

      await this.sleep(3000);
      subscription.stop();

      const request = requests[0];

      if (!request) {
        throw new Error('Paid join request not found');
      }

      // Verify payment proof tags
      const getTag = (name: string) =>
        request.tags.find((t: any) => t[0] === name)?.[1];

      const paymentProof = getTag('payment_proof');
      const amountPaid = getTag('amount_paid');
      const paymentTimestamp = getTag('payment_timestamp');

      if (!paymentProof) {
        throw new Error('Missing payment_proof tag');
      }

      if (amountPaid !== '2100') {
        throw new Error(`Expected amount_paid=2100, got ${amountPaid}`);
      }

      if (!paymentTimestamp) {
        throw new Error('Missing payment_timestamp tag');
      }

      this.addResult(
        'Payment Proof Tags',
        true,
        `Verified: payment_proof, amount_paid=2100, timestamp=${paymentTimestamp}`
      );
    } catch (error) {
      this.addResult('Payment Proof Tags', false, undefined, String(error));
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
      console.log('🎉 All tests passed! Join request flow is working correctly.\n');
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
const test = new JoinRequestTest();
test.run().catch(console.error);
