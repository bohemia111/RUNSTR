/**
 * Test Script: Workout Verification System
 *
 * Tests the HMAC-based verification flow end-to-end:
 * 1. Fetches verification code from Supabase Edge Function
 * 2. Verifies the code format
 * 3. Tests that same npub + version = same code (deterministic)
 *
 * Usage: npx ts-node scripts/test-verification.ts
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://cvoepeskjueskdfrpsnv.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Test npub (can use any valid npub for testing)
const TEST_NPUB = 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsutg0s'; // Dummy npub
const TEST_VERSION = '1.5.0';

async function testVerificationCodeGeneration() {
  console.log('🔐 Testing Workout Verification System\n');
  console.log('='.repeat(50));

  // Check if anon key is available
  if (!SUPABASE_ANON_KEY) {
    console.log('\n⚠️  EXPO_PUBLIC_SUPABASE_ANON_KEY not set in environment');
    console.log('   Attempting without auth header (may fail)...\n');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (SUPABASE_ANON_KEY) {
    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  // Test 1: Fetch verification code
  console.log('\n📡 Test 1: Fetching verification code...');
  console.log(`   URL: ${SUPABASE_URL}/functions/v1/get-verification-code`);
  console.log(`   npub: ${TEST_NPUB.slice(0, 20)}...`);
  console.log(`   version: ${TEST_VERSION}`);

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/get-verification-code`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ npub: TEST_NPUB, version: TEST_VERSION }),
      }
    );

    const data = await response.json();

    console.log(`\n   Response status: ${response.status}`);
    console.log(`   Response body: ${JSON.stringify(data)}`);

    if (data.code) {
      console.log(`\n   ✅ SUCCESS: Got verification code: ${data.code}`);
      console.log(`   Code length: ${data.code.length} chars (expected: 16)`);

      // Test 2: Verify determinism (same input = same output)
      console.log('\n📡 Test 2: Verifying determinism (same request again)...');

      const response2 = await fetch(
        `${SUPABASE_URL}/functions/v1/get-verification-code`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ npub: TEST_NPUB, version: TEST_VERSION }),
        }
      );

      const data2 = await response2.json();

      if (data2.code === data.code) {
        console.log(`   ✅ SUCCESS: Same npub + version = same code (deterministic)`);
      } else {
        console.log(`   ❌ FAIL: Codes don't match!`);
        console.log(`   First:  ${data.code}`);
        console.log(`   Second: ${data2.code}`);
      }

      // Test 3: Different npub = different code
      console.log('\n📡 Test 3: Different npub should give different code...');

      const differentNpub = 'npub1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaatest';
      const response3 = await fetch(
        `${SUPABASE_URL}/functions/v1/get-verification-code`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ npub: differentNpub, version: TEST_VERSION }),
        }
      );

      const data3 = await response3.json();

      if (data3.code && data3.code !== data.code) {
        console.log(`   ✅ SUCCESS: Different npub = different code`);
        console.log(`   npub1: ${data.code}`);
        console.log(`   npub2: ${data3.code}`);
      } else if (!data3.code) {
        console.log(`   ⚠️  No code returned for second npub`);
      } else {
        console.log(`   ❌ FAIL: Same code for different npubs!`);
      }

    } else if (data.message) {
      console.log(`\n   ⚠️  No code returned: ${data.message}`);
      console.log(`\n   This likely means the secret VERIFICATION_SECRET_1_5_0 is not set.`);
      console.log(`   Add it in Supabase Dashboard → Settings → Edge Functions → Secrets`);
    } else if (data.error) {
      console.log(`\n   ❌ ERROR: ${data.error}`);
    }

  } catch (error) {
    console.log(`\n   ❌ FETCH ERROR: ${error}`);
  }

  // Test 4: Invalid inputs
  console.log('\n📡 Test 4: Testing invalid inputs...');

  try {
    const response4 = await fetch(
      `${SUPABASE_URL}/functions/v1/get-verification-code`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ npub: 'invalid', version: TEST_VERSION }),
      }
    );

    const data4 = await response4.json();

    if (data4.error) {
      console.log(`   ✅ Correctly rejected invalid npub: ${data4.error}`);
    } else {
      console.log(`   ⚠️  Accepted invalid npub (should reject)`);
    }
  } catch (error) {
    console.log(`   Error testing invalid input: ${error}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🔐 Verification tests complete\n');
}

// Run tests
testVerificationCodeGeneration();
