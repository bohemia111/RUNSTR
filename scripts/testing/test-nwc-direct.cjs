// scripts/test-nwc-direct.js
// Run with: node scripts/test-nwc-direct.js

const WebSocket = require('ws');
global.WebSocket = WebSocket;

// Your actual connection string
const CONNECTION_STRING = 'nostr+walletconnect://6257ae16115e98057b4806059cd2cc9d3bbc0c50dbac29cd797a3f211b7bc9dc?relay=wss://relay.getalby.com/v1&secret=92da1e8b8953181f6ff38f3dbf3631a9e686f48354ff4449f81b10b880ef2d53&lud16=hustle@getalby.com';

async function testDirectConnection() {
  console.log('Testing NWC connection directly...\n');

  // Parse the connection string
  const url = new URL(CONNECTION_STRING);
  const relay = url.searchParams.get('relay');
  const secret = url.searchParams.get('secret');
  const pubkey = url.hostname;

  console.log('Parsed connection details:');
  console.log('- Relay:', relay);
  console.log('- Pubkey:', pubkey);
  console.log('- Secret:', secret ? 'Present' : 'Missing');
  console.log('');

  // Test raw WebSocket connection first
  console.log('Step 1: Testing raw WebSocket to relay...');

  return new Promise((resolve) => {
    const ws = new WebSocket(relay);

    ws.on('open', () => {
      console.log('✅ WebSocket connected to relay!');

      // Test Nostr handshake
      console.log('\nStep 2: Sending Nostr REQ message...');

      // Create a subscription request
      const subscriptionId = Math.random().toString(36).substring(7);
      const reqMessage = JSON.stringify([
        "REQ",
        subscriptionId,
        {
          kinds: [23194], // NWC request kind
          authors: [pubkey],
          limit: 1
        }
      ]);

      ws.send(reqMessage);
      console.log('Sent:', reqMessage);

      // Set timeout for response
      setTimeout(() => {
        console.log('⏱️ No response after 5 seconds');
        ws.close();
        resolve();
      }, 5000);
    });

    ws.on('message', (data) => {
      console.log('📨 Received:', data.toString());
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      resolve();
    });

    ws.on('close', () => {
      console.log('WebSocket closed');
      resolve();
    });
  });
}

// Now test with the SDK
async function testSDKConnection() {
  console.log('\n\nStep 3: Testing with @getalby/sdk...\n');

  try {
    const { NWCClient, webln } = require('@getalby/sdk');

    // Try different initialization approaches
    console.log('Approach 1: Basic initialization');
    try {
      const client1 = new NWCClient({
        nostrWalletConnectUrl: CONNECTION_STRING
      });

      // Check if client has relay property
      console.log('Client created:', !!client1);
      console.log('Client relay:', client1.relay ? 'Present' : 'Missing');

      // Try to get info
      console.log('Attempting getInfo()...');
      const info = await Promise.race([
        client1.getInfo(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout after 5 seconds')), 5000)
        )
      ]);
      console.log('✅ Info received:', info);
    } catch (error) {
      console.log('❌ Basic approach failed:', error.message);
    }

    // Try with explicit WebSocket
    console.log('\nApproach 2: With explicit WebSocket');
    try {
      const client2 = new NWCClient({
        nostrWalletConnectUrl: CONNECTION_STRING,
        websocketImplementation: WebSocket
      });

      console.log('Attempting getBalance()...');
      const balance = await Promise.race([
        client2.getBalance(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout after 5 seconds')), 5000)
        )
      ]);
      console.log('✅ Balance:', balance);
    } catch (error) {
      console.log('❌ WebSocket implementation approach failed:', error.message);
    }

    // Try webln approach
    console.log('\nApproach 3: Using webln.NostrWebLNProvider');
    try {
      if (webln && webln.NostrWebLNProvider) {
        const provider = new webln.NostrWebLNProvider({
          nostrWalletConnectUrl: CONNECTION_STRING
        });

        console.log('Enabling provider...');
        await provider.enable();
        console.log('✅ Provider enabled!');

        const info = await provider.getInfo();
        console.log('✅ Info via webln:', info);
      } else {
        console.log('webln.NostrWebLNProvider not available in SDK');
      }
    } catch (error) {
      console.log('❌ webln approach failed:', error.message);
    }

  } catch (error) {
    console.error('SDK test failed:', error);
  }
}

// Run tests
async function runTests() {
  console.log('=================================');
  console.log('NWC Connection Test Script');
  console.log('=================================\n');

  await testDirectConnection();
  await testSDKConnection();

  console.log('\n=================================');
  console.log('Test Complete');
  console.log('=================================');

  process.exit(0);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});