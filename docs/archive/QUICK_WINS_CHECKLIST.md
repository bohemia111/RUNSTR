# RUNSTR Quick Wins Checklist - MVP Launch Preparation

## Overview
This checklist contains **high-impact, low-effort fixes** that will maximize RUNSTR's launch readiness. All items are prioritized by impact/effort ratio and categorized by urgency.

**Total Estimated Time**: 6-8 hours
**Expected Impact**: 90%+ launch readiness score

---

## 🔴 CRITICAL (Fix Before Launch) - 2-3 hours

### 1. Fix TypeScript Compilation Errors (1.5-2 hours)
**Priority**: P0 (Build blocker)
**Impact**: Cannot build production app without this
**Effort**: Medium (80+ errors, many similar patterns)

**Current Status**: 80+ TypeScript errors preventing compilation

**Action Items**:
- [ ] Fix missing module imports (__tests__, scripts)
- [ ] Resolve type mismatches in components (ChallengeButton, CaptainDashboardButton)
- [ ] Fix competition type inconsistencies (Competition vs NostrCompetition)
- [ ] Add missing properties to notification types
- [ ] Fix workout source type issues (PrivateWorkoutsTab.tsx:194)

**Files to Fix** (most critical first):
1. `src/components/profile/ChallengeButton.tsx` - Missing @react-navigation import
2. `src/components/profile/YourCompetitionsBox.tsx` - Same import issue
3. `src/components/competition/LiveLeaderboard.tsx` - Type mismatch (updatedAt field)
4. `src/components/profile/tabs/PrivateWorkoutsTab.tsx` - WorkoutSource type mismatch
5. `src/components/team/NostrMemberManager.tsx` - Missing getTeamMembers method

**Validation**:
```bash
npm run typecheck
# Must show: "No errors found"
```

### 2. Add useEffect Cleanup Functions (30-45 min)
**Priority**: P0 (Memory leaks)
**Impact**: App crashes on unmount, memory exhaustion over time
**Effort**: Low (4 files, simple pattern)

**Current Status**: 4 critical memory leaks identified in audit

**Files to Fix**:
1. `src/components/profile/tabs/PublicWorkoutsTab.tsx:53`
   ```typescript
   // ADD cleanup function
   useEffect(() => {
     const subscription = someService.subscribe(...);
     return () => subscription.unsubscribe(); // ADD THIS
   }, [deps]);
   ```

2. `src/components/team/JoinRequestsSection.tsx:56`
3. `src/components/ui/NostrConnectionStatus.tsx:32`
4. `src/screens/ProfileImportScreen.tsx:47`

**Pattern to Add**:
```typescript
return () => {
  // Unsubscribe from subscriptions
  // Clear timers/intervals
  // Remove event listeners
};
```

**Validation**:
- Run app and navigate away from screens
- No "Can't perform state update on unmounted component" warnings
- Memory usage stays stable

### 3. Verify Core User Flow Works (30 min)
**Priority**: P0 (User-facing)
**Impact**: Users cannot complete basic tasks
**Effort**: Low (testing only)

**Test These Flows**:
- [ ] Login with nsec → Auto-wallet creation → Profile screen
- [ ] Team discovery → Team details → Join team
- [ ] View competition → See leaderboard
- [ ] Post workout → Appears in feed
- [ ] Send/receive Bitcoin payment

**Record**:
- Any crashes or errors
- Missing loading states
- Broken navigation
- Data not appearing

---

## 🟠 HIGH IMPACT (Fix If Time) - 2-3 hours

### 4. Add Nostr Query Limits (1-1.5 hours)
**Priority**: P1 (Performance risk)
**Impact**: Slow queries, potential crashes on large datasets
**Effort**: Low (add 1-2 parameters per query)

**Current Status**: 20+ unbounded queries identified in audit

**Files to Fix** (highest priority first):
1. `src/services/competition/SimpleCompetitionService.ts` (4 locations)
   ```typescript
   // BEFORE
   const events = await ndk.fetchEvents({
     kinds: [30100],
     authors: [teamId]
   });

   // AFTER - Add limit and time bounds
   const events = await ndk.fetchEvents({
     kinds: [30100],
     authors: [teamId],
     limit: 100,
     since: Math.floor(Date.now() / 1000) - (90 * 24 * 60 * 60) // 90 days
   });
   ```

2. `src/services/chat/ChatService.ts` (3 locations)
   - Add `limit: 50` for chat messages
   - Add `since` for recent messages only

3. `src/services/competition/SimpleLeaderboardService.ts:237`
   - Add `limit: 1000` for workout events
   - Add date range based on competition dates

4. `src/services/fitness/NdkWorkoutService.ts:9`
   - Add `limit: 500` for workout queries
   - Add `since` for last 30 days

**Validation**:
```bash
# Check network tab in React Native Debugger
# Queries should complete in < 2 seconds
```

### 5. Add Loading States to Key Screens (1 hour)
**Priority**: P1 (User experience)
**Impact**: Users don't know if app is working
**Effort**: Low (ActivityIndicator component)

**Screens Missing Loading States**:
1. `src/screens/ContactSupportScreen.tsx`
   ```typescript
   const [loading, setLoading] = useState(false);

   // In render:
   {loading && <ActivityIndicator size="large" color="#FF9D42" />}
   ```

2. Team discovery screen (during Nostr query)
3. Competition leaderboard screen (during calculation)
4. Wallet balance screen (during NWC fetch)
5. Join request section (during approval)

**Pattern to Add**:
```typescript
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  setLoading(true);
  try {
    const data = await service.fetch();
    // Update state
  } finally {
    setLoading(false);
  }
};
```

### 6. Fix Navigation Edge Cases (30 min)
**Priority**: P1 (User experience)
**Impact**: Users get stuck or confused
**Effort**: Low (conditional rendering)

**Issues to Fix**:
1. Event detail navigation (EventCard.tsx:218, EventsView.tsx:14)
   - Add `onPress` handler to navigate to EventDetailsScreen
   - Pass event ID via navigation params

2. Challenge detail navigation (ChallengeCard.tsx:251)
   - Navigate to ChallengeDetailsScreen
   - Include challenge metadata

3. Back button behavior on captain dashboard
   - Ensure returns to team details, not app exit

**Validation**:
- Navigate through all screens
- No dead ends
- Back button always works

---

## 🟡 MEDIUM PRIORITY (Post-Launch OK) - 1-2 hours

### 7. Clean Up Console.log Statements (30 min)
**Priority**: P2 (Production quality)
**Impact**: Clutters logs, potential info leaks
**Effort**: Very low (search and remove)

**Action**:
```bash
# Find all console.log
grep -r "console.log" src/

# Remove or replace with proper logging
// console.log(...) // DEBUG ONLY
```

**Keep Logging For**:
- Error handling (console.error)
- Critical user actions (with analytics)
- Development debugging (wrapped in __DEV__)

### 8. Add Error Messages to Failed Operations (45 min)
**Priority**: P2 (User experience)
**Impact**: Users don't know what went wrong
**Effort**: Low (Toast notifications)

**Operations Needing Error Messages**:
1. Failed team join
2. Failed payment
3. Failed workout post
4. Failed competition entry
5. Network timeout

**Pattern**:
```typescript
try {
  await operation();
  Toast.show({ type: 'success', text1: 'Success!' });
} catch (error) {
  Toast.show({
    type: 'error',
    text1: 'Failed to join team',
    text2: error.message
  });
}
```

### 9. Verify No Mock Data in Production (30 min)
**Priority**: P2 (Data integrity)
**Impact**: Users see fake data
**Effort**: Very low (search and verify)

**Search For**:
```bash
grep -r "createSample" src/
grep -r "mockData" src/
grep -r "TODO.*real data" src/
```

**Files to Check**:
- SupabaseService.swift:1527 (mock balance returns)
- Any components using loadSampleStats()
- LeagueView.swift:308, 313, 318 (fallback to mock)

**Action**: Remove or comment out all mock data returns

---

## 🟢 LOW PRIORITY (Technical Debt) - Future Sprint

### 10. Add Accessibility Labels (1 hour)
**Priority**: P3 (Accessibility)
**Impact**: Screen reader users
**Effort**: Medium (many components)

**Components Needing Labels**:
- All TouchableOpacity buttons
- Icon-only buttons
- Input fields
- Critical navigation elements

### 11. Consistent Color Usage (1 hour)
**Priority**: P3 (Visual polish)
**Impact**: Brand consistency
**Effort**: Medium (find and replace)

**Issues**:
- Hardcoded `#FF9D42` in multiple components
- Should use theme.colors.primary

**Files with Hardcoded Colors**:
- ChallengesCard.tsx:34
- CompetitionWinnersCard.tsx:96
- JoinRequestsSection.tsx:167
- LeagueRankingsSection.tsx:448
- (and 5+ more)

### 12. Add Empty State Messages (45 min)
**Priority**: P3 (UX polish)
**Impact**: User guidance
**Effort**: Low (conditional rendering)

**Screens Needing Empty States**:
- No teams found (team discovery)
- No competitions (team details)
- No workouts (profile)
- No join requests (captain dashboard)

---

## Execution Roadmap

### Phase 1: Critical Blockers (Day 1, 2-3 hours)
**Goal**: Make app buildable and stable

1. Fix TypeScript compilation errors (1.5-2 hours)
2. Add useEffect cleanup functions (30-45 min)
3. Verify core user flow works (30 min)

**Success Criteria**:
- ✅ `npm run typecheck` passes
- ✅ No memory leak warnings
- ✅ User can complete: login → join team → view competition

### Phase 2: Performance & UX (Day 2, 2-3 hours)
**Goal**: Make app fast and responsive

4. Add Nostr query limits (1-1.5 hours)
5. Add loading states to key screens (1 hour)
6. Fix navigation edge cases (30 min)

**Success Criteria**:
- ✅ All queries complete in < 2 seconds
- ✅ Users see loading indicators
- ✅ No navigation dead ends

### Phase 3: Polish (Day 3, 1-2 hours)
**Goal**: Production-quality finish

7. Clean up console.log statements (30 min)
8. Add error messages to failed operations (45 min)
9. Verify no mock data in production (30 min)

**Success Criteria**:
- ✅ Clean production logs
- ✅ Users get helpful error messages
- ✅ All data is real

### Phase 4: Validation (Day 3, 1 hour)
**Goal**: Confirm launch readiness

1. Re-run full test suite
2. Test on physical device
3. Run final audit: `npm run audit:pre-launch`
4. Generate launch readiness report

**Success Criteria**:
- ✅ 90%+ launch readiness score
- ✅ No critical issues
- ✅ Core flows work end-to-end

---

## Progress Tracking

### Daily Checklist

**Day 1: Critical Fixes**
- [ ] Morning: Fix TypeScript errors (2 hours)
- [ ] Afternoon: Add useEffect cleanups (45 min)
- [ ] End of day: Test core user flow (30 min)
- [ ] Result: App builds and runs stably

**Day 2: Performance & UX**
- [ ] Morning: Add Nostr query limits (1.5 hours)
- [ ] Afternoon: Add loading states (1 hour)
- [ ] End of day: Fix navigation (30 min)
- [ ] Result: App feels fast and responsive

**Day 3: Polish & Launch**
- [ ] Morning: Clean up logs and errors (1 hour)
- [ ] Midday: Remove mock data (30 min)
- [ ] Afternoon: Final validation (1 hour)
- [ ] Result: **LAUNCH READY**

---

## Success Metrics

### Launch Ready When:
- ✅ TypeScript compiles: 0 errors
- ✅ Critical memory leaks: 0 remaining
- ✅ Unbounded queries: < 5 remaining (non-critical paths)
- ✅ Loading states: 100% on key screens
- ✅ Navigation: 0 dead ends
- ✅ Core user flow: 100% functional
- ✅ Error messages: 100% on critical operations
- ✅ Mock data: 0% in production

### Current Status (Baseline)
- ❌ TypeScript: 80+ errors
- ❌ Memory leaks: 4 critical
- ❌ Unbounded queries: 20+ identified
- ⚠️ Loading states: ~60% coverage
- ⚠️ Navigation: Some edge cases
- ⚠️ Core flow: Needs validation
- ⚠️ Error messages: Partial coverage
- ⚠️ Mock data: Some remaining

### Target Status (After Quick Wins)
- ✅ TypeScript: 0 errors
- ✅ Memory leaks: 0 remaining
- ✅ Unbounded queries: < 5 remaining
- ✅ Loading states: 90%+ coverage
- ✅ Navigation: All edge cases fixed
- ✅ Core flow: Validated working
- ✅ Error messages: 100% critical ops
- ✅ Mock data: 0% remaining

---

## Notes for Implementation

### TypeScript Error Patterns
Many errors follow similar patterns - fixing one often fixes 5-10 similar errors:
- Missing imports: Add to respective files
- Type mismatches: Update type definitions
- Missing properties: Add to interfaces or make optional

### Memory Leak Pattern
All 4 memory leaks follow same pattern:
```typescript
useEffect(() => {
  const subscription = service.subscribe(...);
  return () => subscription.unsubscribe(); // Add this line
}, [deps]);
```

### Query Limit Strategy
Default limits by data type:
- Chat messages: 50 per query
- Workout events: 500 per query (30 days)
- Competition events: 100 per team
- Team member lists: No limit (small datasets)

### Loading State Pattern
Consistent pattern across all screens:
```typescript
const [loading, setLoading] = useState(false);

useEffect(() => {
  fetchData();
}, []);

const fetchData = async () => {
  setLoading(true);
  try {
    const data = await service.fetch();
    setData(data);
  } catch (error) {
    showError(error);
  } finally {
    setLoading(false);
  }
};

return (
  <View>
    {loading ? <ActivityIndicator /> : <DataView />}
  </View>
);
```

---

**Last Updated**: January 2025
**Version**: 1.0
**Estimated Total Time**: 6-8 hours across 3 days
**Expected Launch Readiness**: 90%+
