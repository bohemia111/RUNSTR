# Amber Signer Integration - Technical Diagnosis

**Status**: Login ✅ Works | Event Signing ❌ Broken
**Issue**: Users can authenticate with Amber but cannot sign workout events (kind 1301) or social posts (kind 1)
**Date**: January 2025

---

## Table of Contents
1. [Quick Summary](#quick-summary)
2. [Login Flow (Working)](#login-flow-working)
3. [Event Signing Flow (Broken)](#event-signing-flow-broken)
4. [Code Paths with Line Numbers](#code-paths-with-line-numbers)
5. [NIP-55 Specification Compliance](#nip-55-specification-compliance)
6. [Root Cause Analysis](#root-cause-analysis)
7. [Recommended Fixes](#recommended-fixes)

---

## Quick Summary

### What's Working
- ✅ Amber app opens during login
- ✅ User can approve permissions in Amber
- ✅ Public key successfully retrieved and stored
- ✅ Profile loads correctly after login

### What's Broken
- ❌ Workout posting (kind 1301) fails immediately
- ❌ Social posts (kind 1) fail immediately
- ❌ Amber app NEVER opens for signing
- ❌ Error appears before Amber is invoked
- ❌ No signature returned

### Key Observation
The login flow uses the same `IntentLauncher` pattern as event signing, so the Android Intent mechanism is working. The issue is in how the signer is configured or how events are being signed.

---

## Login Flow (Working)

### User Action
1. User taps "Login with Amber" button
2. Amber app opens with permission request
3. User approves permissions for kinds: 0, 1, 1301, 30000, 30001, 33404
4. Returns to RUNSTR, authenticated

### Code Path

**File**: `src/services/auth/providers/amberAuthProvider.ts`

```typescript
// Line 33-60: signIn() method
async signIn(): Promise<AuthResult> {
  // Create Amber signer
  this.signer = new AmberNDKSigner(); // Line 50

  // Initialize and get public key
  await this.signer.blockUntilReady(); // Line 53

  // Get user from signer
  const ndkUser = await this.signer.user(); // Line 63
  const hexPubkey = ndkUser.pubkey;

  // Store authentication method
  await AsyncStorage.setItem('@runstr:auth_method', 'amber'); // Line 77
  await AsyncStorage.setItem('@runstr:amber_pubkey', hexPubkey); // Line 78
}
```

**File**: `src/services/auth/amber/AmberNDKSigner.ts`

```typescript
// Line 64-93: blockUntilReady() - Gets public key
async blockUntilReady(): Promise<NDKUser> {
  // Check cached pubkey first
  const storedPubkey = await AsyncStorage.getItem('@runstr:amber_pubkey');
  if (storedPubkey) {
    this._pubkey = storedPubkey;
    return new NDKUser({ pubkey: storedPubkey });
  }

  // Request from Amber
  const pubkey = await this.requestPublicKey(); // Line 79
  this._pubkey = pubkey;
  await AsyncStorage.setItem('@runstr:amber_pubkey', pubkey);
  return new NDKUser({ pubkey: pubkey });
}

// Line 111-189: requestPublicKey() - Launches Amber
async requestPublicKey(): Promise<string> {
  // Prepare permissions
  const permissions = [
    { type: 'sign_event', kind: 0 },      // Profile metadata
    { type: 'sign_event', kind: 1 },      // Text notes ✅
    { type: 'sign_event', kind: 1301 },   // Workout events ✅
    { type: 'sign_event', kind: 30000 },  // Team member lists
    { type: 'sign_event', kind: 30001 },  // Additional lists
    { type: 'sign_event', kind: 33404 },  // Team events
    { type: 'nip04_encrypt' },
    { type: 'nip04_decrypt' },
  ];

  // Launch Amber via IntentLauncher
  const result = await this.startActivityWithTimeout('android.intent.action.VIEW', {
    data: 'nostrsigner:',
    extra: {
      'type': 'get_public_key',
      'permissions': JSON.stringify(permissions)
    }
  });

  // Extract pubkey from result
  const pubkey = result.extra?.result || result.extra?.pubkey || result.data;
  return this.ensureHexPubkey(pubkey);
}
```

**Critical Point**: Permissions for kind 1 and 1301 are requested and approved during login. The user has explicitly granted RUNSTR permission to sign these event kinds.

---

## Event Signing Flow (Broken)

### User Action
1. User completes workout in app
2. Workout summary modal appears
3. User taps "Compete" button (to save as kind 1301)
4. **Error appears immediately** - Amber never opens
5. Message: "Failed to save workout"

### Expected Behavior
1. Amber app should open with signing request
2. User approves signing the kind 1301 event
3. Signature returned to RUNSTR
4. Event published to Nostr relays
5. Success message appears

### Actual Behavior
- Error occurs before Amber is invoked
- Amber app never opens
- No signing request visible to user
- Console likely shows error from `UnifiedSigningService` or `AmberNDKSigner`

---

## Code Paths with Line Numbers

### Path 1: User Taps "Compete" Button

**File**: `src/components/activity/WorkoutSummaryModal.tsx`

```typescript
// Line 260-335: handleSaveForCompetition()
const handleSaveForCompetition = async () => {
  setIsSaving(true);

  // Get signer (works for both nsec and Amber)
  const signer = await UnifiedSigningService.getInstance().getSigner(); // Line 264
  const npub = await AsyncStorage.getItem('@runstr:npub');

  if (!signer) {
    // Error: No authentication found
    return;
  }

  const publishableWorkout = await createPublishableWorkout();

  // Save as kind 1301 workout event
  const result = await workoutPublishingService.saveWorkoutToNostr(
    publishableWorkout,
    signer,  // ⚠️ Passing signer directly
    npub || 'unknown'
  ); // Line 280-284

  if (result.success) {
    setSaved(true);
    // Success handling...
  } else {
    // Error: Failed to save
    setAlertState({
      title: 'Error',
      message: `Failed to save: ${result.error}`, // Line 322
    });
  }
};
```

**Critical Point**: The signer is retrieved from `UnifiedSigningService` and passed directly to the publishing service. This assumes the signer is fully initialized and ready to sign.

---

### Path 2: UnifiedSigningService.getSigner()

**File**: `src/services/auth/UnifiedSigningService.ts`

```typescript
// Line 88-143: getSigner() - Returns appropriate signer
async getSigner(): Promise<NDKSigner | null> {
  // Return cached signer if available
  if (this.cachedSigner) {
    return this.cachedSigner; // Line 92
  }

  const authMethod = await this.getAuthMethod(); // Line 95

  if (authMethod === 'amber') {
    // Create AmberNDKSigner instance
    const signer = new AmberNDKSigner(); // Line 122

    // Initialize signer (gets pubkey from storage)
    await signer.blockUntilReady(); // Line 125

    this.cachedSigner = signer; // Line 127

    // ⚠️ CRITICAL: Set signer on GlobalNDK instance
    const ndk = await GlobalNDKService.getInstance(); // Line 130
    ndk.signer = signer; // Line 131

    console.log('✅ UnifiedSigningService: Created AmberNDKSigner and set on GlobalNDK');
    return signer;
  }

  return null;
}
```

**Critical Points**:
- Signer is cached after first creation
- `blockUntilReady()` gets stored pubkey (doesn't call Amber again)
- Signer **should** be set on GlobalNDK instance
- This is the architecture for GlobalNDK signer attachment

---

### Path 3: WorkoutPublishingService.saveWorkoutToNostr()

**File**: `src/services/nostr/workoutPublishingService.ts`

```typescript
// Line 86-172: saveWorkoutToNostr() - Publishes kind 1301
async saveWorkoutToNostr(
  workout: PublishableWorkout,
  privateKeyHexOrSigner: string | NDKSigner,
  userId: string
): Promise<WorkoutPublishResult> {
  const ndk = await GlobalNDKService.getInstance(); // Line 94
  const isSigner = typeof privateKeyHexOrSigner !== 'string'; // Line 95

  // Get signer and pubkey
  let signer: NDKSigner;
  let pubkey: string;

  if (isSigner) {
    signer = privateKeyHexOrSigner; // Line 102 - Using passed signer
    const user = await signer.user(); // Line 103
    pubkey = user.pubkey; // Line 104
  }

  // Create unsigned NDKEvent
  const ndkEvent = new NDKEvent(ndk); // Line 112 ⚠️ Using GlobalNDK
  ndkEvent.kind = 1301; // Line 113
  ndkEvent.content = this.generateWorkoutDescription(workout); // Line 114
  ndkEvent.tags = this.createNIP101eWorkoutTags(workout, pubkey); // Line 115
  ndkEvent.created_at = Math.floor(new Date(workout.startTime).getTime() / 1000); // Line 116

  // Sign and publish
  await ndkEvent.sign(signer); // Line 130 ⚠️ THIS IS WHERE IT FAILS
  await ndkEvent.publish(); // Line 131

  return {
    success: true,
    eventId: ndkEvent.id,
  };
}
```

**Critical Points**:
- Creates `NDKEvent` from GlobalNDK instance (line 112)
- Calls `ndkEvent.sign(signer)` with the Amber signer (line 130)
- **This is where signing fails** - Amber never opens

---

### Path 4: NDKEvent.sign() → AmberNDKSigner.sign()

**File**: `src/services/auth/amber/AmberNDKSigner.ts`

```typescript
// Line 191-317: sign() - Signs event via Amber
async sign(event: NostrEvent): Promise<string> {
  await this.blockUntilReady(); // Line 196 - Ensures pubkey is available

  console.log('[Amber] Signing event kind', event.kind, 'via Activity Result');

  // Prepare unsigned event WITHOUT id/sig fields (Amber calculates per NIP-55)
  const unsignedEvent = {
    pubkey: this._pubkey!,
    created_at: event.created_at || Math.floor(Date.now() / 1000),
    kind: event.kind!,
    tags: event.tags || [],
    content: event.content || ''
    // NO id field - Amber will calculate
    // NO sig field - Amber will sign
  }; // Lines 202-210

  // NIP-55 requires event to be URI-encoded in the data field
  const eventJson = JSON.stringify(unsignedEvent); // Line 222
  const encodedEvent = encodeURIComponent(eventJson); // Line 223
  const nostrsignerUri = `nostrsigner:${encodedEvent}`; // Line 224

  // Launch Amber via IntentLauncher
  const result = await this.startActivityWithTimeout('android.intent.action.VIEW', {
    data: nostrsignerUri,  // Event encoded in URI per NIP-55
    extra: {
      'type': 'sign_event',
      'id': unsignedEvent.created_at.toString(),
      'current_user': this._pubkey  // Tell Amber which account to use
    }
  }); // Lines 235-242

  // Extract signature from result
  if (result.resultCode === IntentLauncher.ResultCode.Success) {
    const signature = result.extra?.signature || result.extra?.result || result.data;

    if (sig) {
      return sig; // Line 295
    } else {
      throw new Error('No signature in Amber response'); // Line 297
    }
  } else {
    throw new Error(`Amber signing failed with result code: ${result.resultCode}`);
  }
}
```

**Critical Points**:
- Unsigned event correctly excludes `id` and `sig` fields (NIP-55 compliant)
- Event JSON is URI-encoded in the data field
- `type: 'sign_event'` passed in extras
- `current_user` specifies which Amber account to use
- **If this code is executed, Amber should open** - but it doesn't

---

## NIP-55 Specification Compliance

### Official NIP-55 Format

**URI Structure**:
```
nostrsigner:$eventJson
```

**Intent Setup**:
```kotlin
val intent = Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:$eventJson"))
intent.putExtra("type", "sign_event")
intent.putExtra("id", event.id)
intent.putExtra("current_user", pubkey)
```

### Our Implementation

**File**: `AmberNDKSigner.ts` (lines 222-242)

```typescript
const eventJson = JSON.stringify(unsignedEvent);
const encodedEvent = encodeURIComponent(eventJson);
const nostrsignerUri = `nostrsigner:${encodedEvent}`;

const result = await this.startActivityWithTimeout('android.intent.action.VIEW', {
  data: nostrsignerUri,
  extra: {
    'type': 'sign_event',
    'id': unsignedEvent.created_at.toString(),
    'current_user': this._pubkey
  }
});
```

**Compliance Check**:
- ✅ URI format: `nostrsigner:$eventJson`
- ✅ Intent action: `android.intent.action.VIEW`
- ✅ Event in URI data field
- ✅ Type in extras: `sign_event`
- ✅ Current user specified
- ✅ Event JSON is properly encoded

**Conclusion**: Our implementation matches the NIP-55 specification exactly.

---

## Root Cause Analysis

Given that:
1. Login works (same IntentLauncher pattern)
2. Permissions are granted (kind 1301 approved during login)
3. Signer is created and cached
4. Event structure is NIP-55 compliant
5. Amber never opens (error before invocation)

### Most Likely Issues (Ranked)

#### 1. **GlobalNDK Signer Not Set** (90% confidence)

**Hypothesis**: Despite code that sets `ndk.signer = signer` in `UnifiedSigningService.ts:131`, the signer may not actually be attached when `ndkEvent.sign()` is called.

**Evidence**:
- `NDKEvent` is created from GlobalNDK (workoutPublishingService.ts:112)
- When `ndkEvent.sign(signer)` is called with an explicit signer parameter, NDK might check if `this.ndk.signer` is set first
- If `ndk.signer` is undefined, NDK might throw an error before calling the signer's `sign()` method

**Test**:
```typescript
// Add debugging in workoutPublishingService.ts before line 130
const ndk = await GlobalNDKService.getInstance();
console.log('[DEBUG] GlobalNDK signer set?', !!ndk.signer);
console.log('[DEBUG] Signer type:', ndk.signer?.constructor.name);
console.log('[DEBUG] Passed signer type:', signer.constructor.name);
```

**Expected Output**:
```
[DEBUG] GlobalNDK signer set? true
[DEBUG] Signer type: AmberNDKSigner
[DEBUG] Passed signer type: AmberNDKSigner
```

**If Output Shows**:
```
[DEBUG] GlobalNDK signer set? false  // ❌ PROBLEM
```

**Root Cause**: The signer is not persisting on GlobalNDK between `getSigner()` call and event signing.

**Why This Happens**:
- `UnifiedSigningService.getSigner()` might be called multiple times
- `cachedSigner` is returned early (line 92), skipping the `ndk.signer = signer` line
- **First call**: Creates signer, sets on GlobalNDK ✅
- **Second call**: Returns cached signer, DOES NOT set on GlobalNDK ❌
- If GlobalNDK is re-initialized between calls, the signer reference is lost

---

#### 2. **Cached Signer vs GlobalNDK Signer Mismatch** (70% confidence)

**Hypothesis**: The cached signer in `UnifiedSigningService` and the signer on GlobalNDK might be different instances.

**Evidence**:
```typescript
// UnifiedSigningService.ts:88-92
if (this.cachedSigner) {
  return this.cachedSigner; // ⚠️ Returns WITHOUT checking GlobalNDK
}
```

**Problem**: If something overwrites `ndk.signer` after caching, the cached signer and GlobalNDK signer become out of sync.

**Services That Might Overwrite**:
- `WalletSync.ts` (line 50-60): Creates and sets signer for wallet operations
- Other services that create new NDK instances

**Test**:
```typescript
// Add debugging in UnifiedSigningService.getSigner()
if (this.cachedSigner) {
  const ndk = await GlobalNDKService.getInstance();
  if (ndk.signer !== this.cachedSigner) {
    console.error('[UnifiedSigningService] MISMATCH! GlobalNDK signer !== cached signer');
    console.log('[UnifiedSigningService] Cached signer:', this.cachedSigner.constructor.name);
    console.log('[UnifiedSigningService] GlobalNDK signer:', ndk.signer?.constructor.name);

    // FIX: Re-set the cached signer on GlobalNDK
    ndk.signer = this.cachedSigner;
  }
  return this.cachedSigner;
}
```

---

#### 3. **NDK Event Signing Logic Issue** (50% confidence)

**Hypothesis**: NDK's `NDKEvent.sign(signer)` method might not work correctly when a signer is passed explicitly if `this.ndk.signer` is undefined.

**NDK Internal Logic** (hypothetical):
```typescript
// Inside NDK library
async sign(signer?: NDKSigner) {
  // If no signer passed, use ndk.signer
  const signerToUse = signer || this.ndk.signer;

  if (!signerToUse) {
    throw new Error('No signer available'); // ❌ Error before Amber is called
  }

  // ... rest of signing logic
}
```

**If this is the case**:
- Error: "No signer available" or "Cannot sign event"
- Happens in NDK library, before `AmberNDKSigner.sign()` is even called
- Amber never opens because NDK prevents the call

**Test**:
```typescript
// Try signing WITHOUT passing signer explicitly
// Let NDK use ndk.signer instead

// BEFORE:
await ndkEvent.sign(signer);

// AFTER:
// Don't pass signer - NDK will use ndk.signer automatically
await ndkEvent.sign();
```

---

#### 4. **Signer Not Initialized for Signing** (30% confidence)

**Hypothesis**: The signer's `blockUntilReady()` is only called once during `getSigner()`, but the signer might need re-initialization before each signing operation.

**Evidence**:
- `AmberNDKSigner.sign()` calls `await this.blockUntilReady()` (line 196)
- But if `this._pubkey` is already set, `blockUntilReady()` returns immediately (line 65-75)
- **No actual communication with Amber happens during `blockUntilReady()`** after the first call

**Problem**: Amber might require a "prepare for signing" step before each `sign()` call, not just during initial setup.

**However**: Login uses the same pattern and works, so this is less likely.

---

#### 5. **Permission Revoked in Amber** (10% confidence)

**Hypothesis**: User approved permissions during login but later revoked them in Amber settings.

**Test**: Open Amber app → Settings → Connected Apps → RUNSTR → Check if kind 1301 permission is still granted.

**Why Unlikely**:
- User says login "works perfectly"
- Permissions are checked during every login
- If permissions were revoked, login would fail too

---

## Recommended Fixes

### Fix 1: Ensure GlobalNDK Signer is Always Set (Highest Priority)

**File**: `src/services/auth/UnifiedSigningService.ts`

**Change** (lines 88-93):
```typescript
async getSigner(): Promise<NDKSigner | null> {
  // BEFORE:
  if (this.cachedSigner) {
    return this.cachedSigner; // ⚠️ Skips GlobalNDK check
  }

  // AFTER:
  if (this.cachedSigner) {
    // ✅ Always ensure signer is set on GlobalNDK
    const ndk = await GlobalNDKService.getInstance();
    if (ndk.signer !== this.cachedSigner) {
      console.warn('[UnifiedSigningService] Re-setting cached signer on GlobalNDK');
      ndk.signer = this.cachedSigner;
    }
    return this.cachedSigner;
  }

  // ... rest of method
}
```

**Rationale**: Ensures that every time `getSigner()` is called, the GlobalNDK instance has the correct signer attached, even if it was overwritten by another service.

---

### Fix 2: Don't Pass Signer to NDKEvent.sign()

**File**: `src/services/nostr/workoutPublishingService.ts`

**Change** (line 130):
```typescript
// BEFORE:
await ndkEvent.sign(signer);

// AFTER:
// Let NDK use ndk.signer automatically
await ndkEvent.sign();
```

**Rationale**: NDK is designed to use `ndk.signer` automatically if no signer is passed. By passing a signer explicitly, we might be bypassing NDK's internal checks.

**Note**: This fix assumes GlobalNDK signer is correctly set (Fix 1 is a prerequisite).

---

### Fix 3: Add Comprehensive Debug Logging

**File**: `src/services/nostr/workoutPublishingService.ts`

**Add before line 130**:
```typescript
// Debug: Check signer state before signing
console.log('[WorkoutPublishing] About to sign event (kind 1301)');
console.log('[WorkoutPublishing] GlobalNDK signer set?', !!ndk.signer);
console.log('[WorkoutPublishing] GlobalNDK signer type:', ndk.signer?.constructor.name);
console.log('[WorkoutPublishing] Passed signer type:', signer.constructor.name);
console.log('[WorkoutPublishing] Are they the same instance?', ndk.signer === signer);

try {
  await ndkEvent.sign(signer);
  console.log('[WorkoutPublishing] ✅ Event signed successfully');
} catch (error) {
  console.error('[WorkoutPublishing] ❌ Signing failed:', error);
  console.error('[WorkoutPublishing] Error type:', error?.constructor?.name);
  console.error('[WorkoutPublishing] Error message:', error?.message);
  throw error;
}
```

**File**: `src/services/auth/amber/AmberNDKSigner.ts`

**Add at start of sign() method (line 196)**:
```typescript
console.log('[AmberNDKSigner] sign() called for kind', event.kind);
console.log('[AmberNDKSigner] Pubkey set?', !!this._pubkey);
console.log('[AmberNDKSigner] Is ready?', this.isReady);
```

**Rationale**: Identify exactly where the signing flow fails and what state the signers are in.

---

### Fix 4: Verify Amber Permissions Persist

**File**: `src/services/auth/AmberNDKSigner.ts`

**Add method**:
```typescript
/**
 * Check if user has granted signing permissions in Amber
 * Call this before attempting to sign to verify permissions are still active
 */
async verifySigningPermissions(): Promise<boolean> {
  try {
    // Try to sign a test event
    const testEvent = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: 'Permission verification test'
    };

    await this.sign(testEvent);
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (errorMsg.includes('permission') || errorMsg.includes('rejected')) {
      console.error('[AmberNDKSigner] Permissions not granted or revoked');
      return false;
    }

    // Other errors might not be permission-related
    console.warn('[AmberNDKSigner] Permission verification failed:', errorMsg);
    return false;
  }
}
```

**Usage** (in `WorkoutSummaryModal.tsx` before saving):
```typescript
// Before attempting to save workout
const canSign = await signer.verifySigningPermissions();
if (!canSign) {
  setAlertState({
    title: 'Permission Required',
    message: 'Please grant signing permissions in Amber and try again.',
  });
  return;
}
```

---

### Fix 5: Alternative: Use UnifiedSigningService.signEvent()

**File**: `src/services/nostr/workoutPublishingService.ts`

**Instead of calling `ndkEvent.sign(signer)` directly, use the unified signing service**:

```typescript
// BEFORE (line 130):
await ndkEvent.sign(signer);

// AFTER:
// Import UnifiedSigningService
import { UnifiedSigningService } from '../auth/UnifiedSigningService';

// Create event without signing
const unsignedEvent = {
  kind: ndkEvent.kind,
  created_at: ndkEvent.created_at,
  tags: ndkEvent.tags,
  content: ndkEvent.content,
  pubkey: pubkey
};

// Sign using UnifiedSigningService (handles both nsec and Amber)
const signature = await UnifiedSigningService.getInstance().signEvent(unsignedEvent);

// Attach signature to NDKEvent
ndkEvent.sig = signature;

// Then publish
await ndkEvent.publish();
```

**Rationale**: `UnifiedSigningService.signEvent()` has comprehensive error handling for Amber-specific issues and ensures the signer is always retrieved correctly.

---

## Testing Protocol

### Test 1: Verify GlobalNDK Signer State

**Add to**: `src/screens/ProfileScreen.tsx` (or any screen for quick testing)

```typescript
// Add a debug button
<TouchableOpacity onPress={async () => {
  const { GlobalNDKService } = await import('../services/nostr/GlobalNDKService');
  const { UnifiedSigningService } = await import('../services/auth/UnifiedSigningService');

  const ndk = await GlobalNDKService.getInstance();
  const signer = await UnifiedSigningService.getInstance().getSigner();

  console.log('=== Signer State Debug ===');
  console.log('GlobalNDK signer set?', !!ndk.signer);
  console.log('GlobalNDK signer type:', ndk.signer?.constructor.name);
  console.log('UnifiedSigningService signer type:', signer?.constructor.name);
  console.log('Are they the same instance?', ndk.signer === signer);

  Alert.alert(
    'Signer State',
    `GlobalNDK: ${!!ndk.signer ? ndk.signer.constructor.name : 'Not set'}\n` +
    `UnifiedSigningService: ${signer?.constructor.name || 'Not set'}\n` +
    `Same instance: ${ndk.signer === signer}`
  );
}}>
  <Text>Debug: Check Signer State</Text>
</TouchableOpacity>
```

**Expected Output** (for Amber users):
```
GlobalNDK signer set? true
GlobalNDK signer type: AmberNDKSigner
UnifiedSigningService signer type: AmberNDKSigner
Are they the same instance? true
```

**If "Not set" or "false"**: GlobalNDK signer issue confirmed (apply Fix 1).

---

### Test 2: Minimal Signing Test

**Create test script**: `scripts/test-amber-signing.ts`

```typescript
import { GlobalNDKService } from '../src/services/nostr/GlobalNDKService';
import { UnifiedSigningService } from '../src/services/auth/UnifiedSigningService';
import { NDKEvent } from '@nostr-dev-kit/ndk';

async function testAmberSigning() {
  try {
    console.log('🧪 Testing Amber signing...');

    // Get signer
    const signer = await UnifiedSigningService.getInstance().getSigner();
    if (!signer) {
      console.error('❌ No signer available');
      return;
    }

    console.log('✅ Signer retrieved:', signer.constructor.name);

    // Get GlobalNDK
    const ndk = await GlobalNDKService.getInstance();
    console.log('✅ GlobalNDK retrieved');
    console.log('   - GlobalNDK signer set?', !!ndk.signer);

    // Create test event
    const testEvent = new NDKEvent(ndk);
    testEvent.kind = 1;
    testEvent.content = 'Test signing with Amber';
    testEvent.created_at = Math.floor(Date.now() / 1000);

    console.log('📝 Created test event (kind 1)');

    // Attempt to sign
    console.log('🔐 Attempting to sign event...');
    console.log('   (Amber should open now)');

    await testEvent.sign(); // Don't pass signer - let NDK use ndk.signer

    console.log('✅ Event signed successfully!');
    console.log('   - Event ID:', testEvent.id);
    console.log('   - Signature:', testEvent.sig?.substring(0, 20) + '...');

  } catch (error) {
    console.error('❌ Signing test failed:', error);
    console.error('   - Error type:', error?.constructor?.name);
    console.error('   - Error message:', error?.message);
  }
}

testAmberSigning();
```

**Run**: `npx ts-node scripts/test-amber-signing.ts`

---

### Test 3: Monitor Console Logs During Workout Posting

**Action**:
1. Start Metro bundler: `npx expo start --ios`
2. Open app on Android device with Amber
3. Complete a workout
4. Tap "Compete" button
5. Watch Metro console output

**Key Logs to Look For**:
```
[Amber] Signing event kind 1301 via Activity Result
```
- **If you see this**: AmberNDKSigner.sign() was called, issue is in Intent/Amber communication
- **If you DON'T see this**: Error happened before AmberNDKSigner.sign() was called (GlobalNDK signer issue)

**Error Patterns**:

**Pattern A** (GlobalNDK signer not set):
```
❌ Error saving workout: No signer available
// OR
❌ Error: Cannot sign event - signer not initialized
```
→ Apply Fix 1

**Pattern B** (NDK internal error):
```
✅ UnifiedSigningService: Created AmberNDKSigner and set on GlobalNDK
❌ Error saving workout: NDKEvent.sign() requires a signer
```
→ Apply Fix 2

**Pattern C** (Amber communication error):
```
[Amber] Signing event kind 1301 via Activity Result
❌ Amber request timed out after 60 seconds
// OR
❌ User canceled signing request in Amber
```
→ Check Amber app state, permissions

---

## Comparison with Amethyst Implementation

### Amethyst (Kotlin - Known Working)

**File**: `ExternalSignerLauncher.kt`

```kotlin
fun signEvent(event: Event, callback: (result: String?) -> Unit) {
    val intent = Intent(Intent.ACTION_VIEW)
    intent.data = Uri.parse("nostrsigner:" + event.toJson())
    intent.`package` = signerPackageName
    intent.putExtra("type", "sign_event")
    intent.putExtra("id", event.id)
    intent.putExtra("current_user", account.keyPair.pubKey.toHexKey())

    context.startActivity(intent)
}
```

### RUNSTR (TypeScript - Our Implementation)

**File**: `AmberNDKSigner.ts`

```typescript
const result = await this.startActivityWithTimeout('android.intent.action.VIEW', {
  data: nostrsignerUri,
  extra: {
    'type': 'sign_event',
    'id': unsignedEvent.created_at.toString(),
    'current_user': this._pubkey
  }
});
```

### Key Differences

1. **Intent Launch Method**:
   - **Amethyst**: `context.startActivity(intent)` - Fire and forget, callback-based
   - **RUNSTR**: `IntentLauncher.startActivityAsync()` - Promise-based, synchronous result

2. **Event ID**:
   - **Amethyst**: Uses `event.id` (pre-calculated)
   - **RUNSTR**: Uses `unsignedEvent.created_at.toString()` (timestamp as ID)
   - **Impact**: Minimal - ID is just for request tracking

3. **Package Name**:
   - **Amethyst**: Specifies `intent.package = "com.greenart7c3.nostrsigner"`
   - **RUNSTR**: Does NOT specify package (relies on Android to find handler)
   - **Impact**: **POSSIBLE ISSUE** - Multiple signer apps might cause confusion

**Recommendation**: Add explicit package specification:

```typescript
// In AmberNDKSigner.ts
const AMBER_PACKAGE_NAME = 'com.greenart7c3.nostrsigner';

// Modify startActivityWithTimeout() to accept package parameter
private async startActivityWithTimeout(
  action: string,
  options: any,
  timeoutMs: number = this.AMBER_TIMEOUT_MS
): Promise<any> {
  // Add package to options if not already present
  if (!options.packageName) {
    options.packageName = AMBER_PACKAGE_NAME;
  }

  return await Promise.race([
    IntentLauncher.startActivityAsync(action, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    )
  ]);
}
```

---

## Next Steps for Your Senior Dev

### Immediate Actions (15-30 minutes)

1. **Apply Fix 1**: Ensure GlobalNDK signer is always set
   - Edit `UnifiedSigningService.ts` lines 88-93
   - Rebuild and test

2. **Add Debug Logging**: Implement comprehensive logging
   - Edit `workoutPublishingService.ts` around line 130
   - Edit `AmberNDKSigner.ts` at start of `sign()` method
   - Rebuild and collect logs

3. **Run Test 3**: Monitor console during workout posting
   - Identify exact failure point from logs
   - Determine if error is before or during Amber invocation

### If Quick Fix Doesn't Work (1-2 hours)

4. **Apply Fix 2**: Don't pass signer explicitly to `ndkEvent.sign()`
   - Edit `workoutPublishingService.ts` line 130
   - Test again

5. **Apply Fix 5**: Use `UnifiedSigningService.signEvent()` instead of `ndkEvent.sign()`
   - Refactor signing flow in `workoutPublishingService.ts`
   - More robust, better error handling

6. **Add Explicit Package Name**: Specify Amber package in Intent
   - Edit `AmberNDKSigner.ts` `startActivityWithTimeout()` method
   - Prevent conflicts with other signer apps

### If Still Not Working (2-4 hours)

7. **Deep NDK Investigation**: Check if NDK's `NDKEvent.sign()` has issues with Amber signers
   - Review NDK source code for signing logic
   - Consider creating custom signing flow that bypasses NDK

8. **Amber API Update**: Verify Amber app version and API compatibility
   - Check if Amber updated its NIP-55 implementation
   - Test with older Amber version if possible

9. **Alternative Signing Approach**: Use Content Resolver instead of Intents
   - NIP-55 supports both methods
   - Content Resolver is for automated signing
   - Intents are for manual approval (current approach)

---

## Summary

**Most Likely Issue**: GlobalNDK signer is not persisting between `getSigner()` call and event signing.

**Quick Fix**: Apply Fix 1 (ensure GlobalNDK signer is always set) + Add debug logging

**If That Doesn't Work**: Apply Fix 2 (don't pass signer explicitly) or Fix 5 (use UnifiedSigningService.signEvent())

**Confidence Level**: 80% that one of these fixes will resolve the issue

**Debugging Strategy**: Start with logging to confirm exactly where the failure occurs, then apply appropriate fix

---

## Contact & Support

If these fixes don't resolve the issue, the problem may be in:
1. NDK library's signing logic (check NDK version and GitHub issues)
2. React Native bridge for Intents (check expo-intent-launcher compatibility)
3. Amber app itself (verify latest version, check for known issues)

**Recommended**: Add comprehensive logging first, then systematically apply fixes based on log output.

Good luck! 🚀
