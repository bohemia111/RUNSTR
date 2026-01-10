# iOS Timer Block Fix - Season II Leaderboard

## Problem Summary

The Season II leaderboard was showing a loading spinner for **43-67 seconds** AFTER successfully fetching Nostr data. The fetch completed in 3-5 seconds (~180 events), but React couldn't render the update until much later.

**Root Cause**: iOS blocks the native timer queue (setTimeout, requestAnimationFrame) after receiving many WebSocket messages. The block duration scales with event count.

## Discovery Timeline

### Initial Symptoms
- Pull-to-refresh triggered fetch that completed in ~4 seconds
- Spinner remained stuck for 43-67 additional seconds
- Data was present in memory, but UI wouldn't update

### Key Diagnostic Finding
```
[BLOCK-1] setTimeout(0) after fetchEvents: 67,000ms  ← BLOCKED!
[BLOCK-1] setImmediate after fetchEvents: 2ms        ← Works!
[BLOCK-1] Promise.resolve after fetchEvents: 1ms     ← Works!
```

This revealed that **macrotasks (setTimeout, requestAnimationFrame)** were blocked while **microtasks (Promise.resolve) and setImmediate** worked fine.

## Test Matrix - Author/Event Threshold

We tested different numbers of authors to find where the block became problematic:

| Authors | Events | Block Time | UX Impact |
|---------|--------|------------|-----------|
| 1 | ~5 | 504ms | Instant |
| 10 | 65 | 74ms | Instant |
| 12 | ~80 | ~500ms | Acceptable |
| 15 | 100 | 8,654ms | Noticeable delay |
| 20 | 113 | 34,000ms | Unacceptable |
| 43 | 178 | 67,000ms | Broken |

**Threshold**: ~65-80 events works, 100+ events causes significant blocking.

## Solutions Attempted

### Option B: Subscribe Pattern (FAILED)
**Hypothesis**: Streaming events one-by-one via `ndk.subscribe()` instead of `ndk.fetchEvents()` might avoid overwhelming iOS.

**Result**: Still blocked for 64+ seconds. The issue is at the iOS WebSocket/timer queue level, not how NDK delivers events.

```
[Subscribe] 🏁 EOSE received: 182 events in 4643ms
[BLOCK-1] setTimeout(0) after SUBSCRIBE: 64915ms  ← Still blocked!
```

### Option A: Batched Fetching (SUCCESS!)
**Hypothesis**: Fetch authors in groups of 10 with yields between batches to stay under the ~65-80 event threshold.

**Result**: Timer block reduced from 64,000ms to 64ms! UI updates progressively.

## Final Solution: Batched Fetching

### Implementation (`UnifiedWorkoutCache.ts`)

```typescript
const EXPERIMENT_FLAGS = {
  useBatchedFetch: true,  // Enable batched fetching
};

// Priority authors fetched first (most active users)
const PRIORITY_AUTHORS = [
  '6b42a3b227b086e850ff659a151863ce070eb60d32bae8a4618928655effc3f6', // JokerHasse
  '745eb529d0e42d2fa6c904bbc2c10702deae964b4dd3079803ab8b43536dda12', // guy
  // ... 8 more priority users
];
```

### How It Works

1. **Batch 1 (Priority)**: Fetch 10 most active users first
   - Returns ~70 events (under threshold)
   - UI shows initial leaderboard immediately

2. **Batches 2-5**: Fetch remaining 33 authors in groups of 10
   - Each batch returns 20-50 events (under threshold)
   - UI updates progressively after each batch

3. **Between batches**: `await yieldToReact()` using setImmediate
   - Allows React to render the updated state
   - Prevents timer queue from building up

### Results

| Metric | Before | After |
|--------|--------|-------|
| setTimeout block | 64,000ms | 64ms |
| Total fetch time | ~5s | ~6s |
| Time to first data | 67s (stuck spinner) | 2s |
| UI responsiveness | Frozen | Progressive updates |

### Batch Timing Breakdown

```
Batch 1 (Priority): 73 events, 2083ms, setTimeout: 64ms ✅
Batch 2: 54 events, 1653ms
Batch 3: 23 events, 845ms
Batch 4: 29 events, 1012ms
Batch 5: 3 events, 359ms
Total: 182 events in 5962ms
```

## Key Technical Insights

### iOS WebSocket Timer Blocking
- iOS's native WebSocket implementation affects the JS timer queue
- After receiving many messages rapidly, setTimeout/requestAnimationFrame are delayed
- The delay scales roughly linearly with message count
- This is NOT a React Native bug - it's iOS behavior

### Workarounds That Work
1. **setImmediate**: Bypasses the blocked timer queue (React Native specific)
2. **Promise.resolve().then()**: Microtasks are not blocked
3. **Batched fetching**: Keep each batch under ~80 events

### Workarounds That DON'T Work
1. **Streaming with subscribe()**: Still triggers the block
2. **Disconnecting relays after fetch**: Triggers NDK auto-reconnect (worse!)
3. **Using requestAnimationFrame**: Also blocked (same queue as setTimeout)

## Files Modified

- `src/services/cache/UnifiedWorkoutCache.ts` - Added batched fetch implementation
- `src/hooks/useSeason2.ts` - Uses microtask for state updates
- `src/screens/season2/Season2Screen.tsx` - Uses setImmediate for refresh state

## Future Considerations

1. **Priority list maintenance**: Keep PRIORITY_AUTHORS updated with most active users
2. **Batch size tuning**: 10 authors works well, could test 12-15
3. **Cache persistence**: Could cache workouts to avoid full fetch on app restart
4. **Progressive rendering**: Could show partial leaderboard while loading

## Related Issues

- This affects ANY Nostr query returning 100+ events on iOS
- Other leaderboards (Satlantis, Running Bitcoin) may need similar treatment
- Android does not appear to have this issue

---

*Documented: January 7, 2026*
*Issue discovered and fixed in ~4 hours of debugging*
