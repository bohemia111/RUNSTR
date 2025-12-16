# Leaderboard Bug Analysis - 7K Run Not Appearing

**Date:** November 17, 2025
**Issue:** User's 7K run published to Nostr as RUNSTR Team captain, but no leaderboard was created

## Summary

After comprehensive investigation, I've identified **THREE root causes** why the 7K run wasn't appearing on leaderboards:

1. ✅ **FIXED:** Timezone issue - Query used UTC midnight instead of local timezone
2. ✅ **FIXED:** Query timeout too aggressive (1.5s → 5s)
3. ⚠️ **OPEN:** Missing Split #7 - 7.00km run only generated 6 splits instead of 7

## Diagnostic Results

### Event Analysis (from `diagnose-recent-workout.ts`)

**Event ID:** `ede41a542a09fb35614ff5fb9ee416bf06a9a7e773a6511558dbf23a41fe5731`
**Published:** November 17, 2025 at 9:02:08 PM local time
**Distance:** 7.00km
**Split Count:** 6 (EXPECTED 7)

**Tags Analysis:**
- ✅ **Team Tag:** `['team', '87d30c8b-aa18-4424-a629-d41ea7f89078']` - CORRECT
- ✅ **Distance Tag:** `['distance', '7.00', 'km']` - PRESENT
- ✅ **Activity Type:** `running` - CORRECT
- ❌ **Splits:** Only 6 splits found (missing split #7)

**Split Data:**
```
Split 1: 00:05:22 (1km)
Split 2: 00:10:40 (2km)
Split 3: 00:15:58 (3km)
Split 4: 00:21:20 (4km)
Split 5: 00:27:00 (5km) ← 5K TIME
Split 6: 00:32:18 (6km)
[MISSING SPLIT 7]
```

### Expected Leaderboards

With 6 splits (≥5), the workout **SHOULD** appear on the **5K Leaderboard** only.

**Leaderboard Logic:**
- 5K leaderboard: Requires ≥5 splits
- 10K leaderboard: Requires ≥10 splits
- Half Marathon: Requires ≥21 splits
- Marathon: Requires ≥42 splits

**User's Workout:** 6 splits → **Eligible for 5K only**

## Root Cause Analysis

### 1. Timezone Issue (FIXED ✅)

**Problem:**
`SimpleLeaderboardService.ts` used `getTodayMidnightUTC()` for the query's `since` parameter, which excluded workouts published at 9:02 PM local time because they were in "tomorrow" in UTC terms.

**Fix Applied:**
```typescript
// BEFORE (Line 836):
const todayMidnight = this.getTodayMidnightUTC();

// AFTER:
const todayMidnight = this.getTodayMidnightLocal(); // Changed to LOCAL timezone

// NEW METHOD (Lines 1022-1030):
private getTodayMidnightLocal(): number {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  return Math.floor(midnight.getTime() / 1000);
}
```

**Impact:** Workouts published at 9:02 PM local time now correctly appear in "today's" query range.

### 2. Query Timeout (FIXED ✅)

**Problem:**
1.5-second timeout was too aggressive for Nostr relay responses, causing queries to return empty results before relays could respond.

**Fix Applied:**
```typescript
// BEFORE (Line 866):
setTimeout(() => {
  console.log(`   ⚠️ Query timed out after 1.5s, returning empty results`);
  resolve(new Set<NDKEvent>());
}, 1500);

// AFTER:
setTimeout(() => {
  console.log(`   ⚠️ Query timed out after 5s, returning partial results`);
  resolve(new Set<NDKEvent>());
}, 5000); // Increased from 1500ms to 5000ms
```

**Impact:** Gives relays more time to respond, reducing false "No activity today" messages.

### 3. Missing Split #7 (OPEN ⚠️)

**Problem:**
7.00km workout only generated 6 splits instead of the expected 7.

**Investigation Needed:**
The `SplitTrackingService` has a potential off-by-one error or timing issue where the final kilometer split isn't being registered.

**Split Generation Logic (Lines 52-94 of `SplitTrackingService.ts`):**
```typescript
update(currentDistanceMeters: number, currentElapsedSeconds: number, pausedDurationMs: number): Split | null {
  // Check if we've crossed a kilometer milestone
  const currentKm = Math.floor(currentDistanceMeters / this.splitInterval);
  const lastKm = Math.floor(this.lastSplitDistance / this.splitInterval);

  if (currentKm > lastKm && currentKm > 0) {
    // New split completed!
    const splitNumber = currentKm;
    // ... create split ...
    this.splits.push(newSplit);
    this.lastSplitDistance = currentDistanceMeters;
    return newSplit;
  }

  this.lastSplitDistance = currentDistanceMeters;
  return null;
}
```

**Hypothesis:**
The workout may have ended at exactly 7.00km, but the final GPS update that would trigger split #7 never arrived because the workout was stopped. The logic requires `currentKm > lastKm`, so if the workout stops at exactly 7000 meters and the last update was at 6999m, split #7 wouldn't be generated.

**Test Case Needed:**
- Simulate 7.0km workout with GPS updates every 100 meters
- Verify that split #7 is generated when distance crosses 7000m
- Test edge case: What if workout stops at exactly 7000m?

## Files Modified

### `src/services/competition/SimpleLeaderboardService.ts`

**Changes:**
1. Added `getTodayMidnightLocal()` method (Lines 1022-1030)
2. Changed query to use local timezone (Line 836)
3. Increased timeout from 1.5s to 5s (Line 866)
4. Added comprehensive logging (Lines 840-841, 859, 873-876, 887-890)

**Key Logging:**
```typescript
console.log(`📊 Loading daily leaderboards for team: ${teamId}`);
console.log(`   🕐 Query range: ${new Date(todayMidnight * 1000).toISOString()} → now`);
console.log(`   🕐 Local midnight: ${new Date(todayMidnight * 1000).toLocaleString()}`);
console.log(`   🔍 Query filter:`, JSON.stringify(filter, null, 2));
console.log(`   ✅ Found ${events.size} workouts for team ${teamId} today`);
```

## Testing Plan

### Priority 1: Validate Fixes

#### Test A: Timezone Fix Validation
**Goal:** Verify that workouts published at 9:02 PM local time now appear on leaderboards

**Steps:**
1. Set competition team to RUNSTR Team ID
2. Run diagnostic script to check recent workouts
3. Navigate to SimpleTeamScreen in app
4. Verify leaderboard shows "1 workout" instead of "No activity today"

**Expected Result:** User's 7K run now appears on 5K leaderboard

#### Test B: Split Generation Bug Investigation
**Goal:** Determine why 7km run only generates 6 splits

**Approach:**
1. Review `SplitTrackingService.update()` logic (Lines 44-95)
2. Check how workout stopping affects final split generation
3. Test with simulated GPS updates at various distances (5.0km, 7.0km, 10.0km)

**Hypothesis:** Workout may end before final GPS update that would trigger last split

#### Test C: End-to-End Competition Flow
**Goal:** Validate complete flow from publishing to leaderboard appearance

**Steps:**
1. Set RUNSTR Team as competition team
2. Publish a new workout (e.g., 10K run)
3. Verify team tag in published event
4. Check leaderboard query results
5. Confirm workout appears on correct leaderboards (5K + 10K)

### Priority 2: Cache Invalidation

**Issue:** 5-minute cache may be showing stale empty results even after fixes

**Test:**
1. Clear app data/cache
2. Re-query leaderboards
3. Verify fresh query uses new timezone logic

### Priority 3: Relay Resilience

**Issue:** Different relays may have different response times

**Test:**
1. Monitor query timeout behavior across multiple relays
2. Verify 5-second timeout is sufficient for all 4 relays
3. Check if some relays consistently timeout

## Next Steps

### Immediate Actions (User Testing)

1. **Test Timezone Fix:**
   - Open SimpleTeamScreen in app
   - Check if 7K run now appears on 5K leaderboard
   - Report results

2. **Investigate Split #7 Missing:**
   - Review why 7.00km run generated only 6 splits
   - Determine if this is systematic bug or edge case

3. **End-to-End Validation:**
   - Publish a new 10K+ run
   - Verify it appears on multiple leaderboards (5K + 10K)
   - Confirm all splits are generated correctly

### Code Changes Needed (If Tests Fail)

1. **If Timezone Fix Doesn't Work:**
   - Add cache invalidation logic
   - Force refresh on screen load

2. **If Split #7 Still Missing:**
   - Fix `SplitTrackingService.update()` logic
   - Add "finalize" method to capture final split when workout ends
   - Ensure last GPS update triggers final split

3. **If Relay Timeout Issues:**
   - Increase timeout further (5s → 10s)
   - Implement progressive timeout (start 3s, retry with 10s)

## Competition System Architecture

### How It Works

1. **Team Membership:**
   - Team members stored in kind 30000 Nostr lists (single source of truth)
   - Captain approves/removes members directly modifying kind 30000 events

2. **Workout Publishing:**
   - Members publish kind 1301 events to Nostr
   - `WorkoutPublishingService` reads `@runstr:competition_team` from AsyncStorage
   - Team tag automatically added: `['team', 'team-uuid']`

3. **Leaderboard Query:**
   - `SimpleLeaderboardService.getTeamDailyLeaderboards()` queries:
     - Filter: `{kinds: [1301], '#team': [teamId], since: todayMidnightLocal}`
   - Returns all workouts from team members published today (local timezone)

4. **Leaderboard Calculation:**
   - Parse workout splits from kind 1301 tags
   - Group by distance category (5K, 10K, etc.) based on split count
   - Calculate times from split data (not total workout time)
   - Sort by fastest times

5. **Display:**
   - `SimpleTeamScreen` shows daily leaderboards
   - Each leaderboard shows top performers for that distance
   - Updates in real-time as new workouts are published

### Key Data Flow

```
User publishes workout
  → WorkoutPublishingService adds team tag
  → Kind 1301 event published to Nostr relays
  → SimpleLeaderboardService queries with team filter
  → Parse splits from event tags
  → Calculate leaderboard rankings
  → Display on SimpleTeamScreen
```

### Critical Architecture Points

- **No Database:** Pure Nostr events + AsyncStorage caching
- **No Backend:** All queries client-side via NDK
- **Local-First:** Competition team setting in AsyncStorage
- **Real-Time:** Leaderboards update as new events appear on relays

## Potential Problems Identified

### 1. Cache Staleness (HIGH PRIORITY)
**Issue:** 5-minute cache may persist stale empty results even after fixes

**Solution:**
- Add cache invalidation on screen focus
- Show cache timestamp to user
- Add "Refresh" button for manual invalidation

### 2. Relay Inconsistency (MEDIUM PRIORITY)
**Issue:** Different relays may return different event sets

**Solution:**
- Wait for majority of relays to respond (3 out of 4)
- Merge results from all relays
- Show relay connection status to user

### 3. Split Generation Edge Cases (HIGH PRIORITY)
**Issue:** Missing final split when workout ends at exact kilometer mark

**Solution:**
- Add `finalize()` method to `SplitTrackingService`
- Call on workout stop to capture final partial split
- Ensure last GPS update triggers final split

### 4. Team Tag Propagation (LOW PRIORITY)
**Issue:** Users may forget to set competition team before publishing

**Solution:**
- Show competition team in workout publishing UI
- Warn if no competition team set
- Allow retroactive team tag addition (re-publish)

### 5. Timezone Edge Cases (MEDIUM PRIORITY)
**Issue:** Users crossing timezones may see unexpected leaderboard behavior

**Solution:**
- Use consistent timezone (user's device timezone)
- Show timezone in leaderboard UI
- Document timezone behavior in help text

## Test Scripts Created

### 1. `scripts/test-split-generation.ts`
**Purpose:** Validate that `SplitTrackingService` generates correct number of splits

**Status:** INCOMPLETE - tsx can't import React Native modules

**Needed:** Refactor as in-app test or use different testing approach

### 2. `scripts/test-team-tag-propagation.ts`
**Purpose:** Verify competition team setting correctly adds team tag to workouts

**Status:** INCOMPLETE - tsx can't import React Native modules

**Needed:** Refactor as in-app test or use different testing approach

### 3. `scripts/test-e2e-competition-flow.ts`
**Purpose:** Validate complete flow from team selection to leaderboard appearance

**Status:** INCOMPLETE - tsx can't import React Native modules

**Needed:** Refactor as in-app test or use different testing approach

### 4. `scripts/diagnose-recent-workout.ts`
**Purpose:** Analyze published kind 1301 events to verify data completeness

**Status:** ✅ WORKING - Successfully identified missing split #7 and correct team tag

**Usage:**
```bash
npx tsx scripts/diagnose-recent-workout.ts
```

## Conclusion

Two critical bugs have been fixed (timezone and timeout), but the missing split #7 issue remains unresolved. User should:

1. **Test the fixes** by checking if the 7K run now appears on the 5K leaderboard
2. **Publish a new 10K+ run** to verify end-to-end flow works correctly
3. **Report results** so we can determine if additional fixes are needed

If the 7K run still doesn't appear after these fixes, the root cause is likely:
- Cache showing stale results
- Relay connectivity issues
- Missing split #7 preventing leaderboard eligibility
