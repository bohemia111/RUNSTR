# RUNSTR Comprehensive Code Audit - Sonnet 4.5 Prompt

## Mission Statement
Conduct a systematic code audit of the RUNSTR React Native app to identify **high-impact, easy-to-fix issues** that directly improve user experience. Focus on UI consistency, TypeScript errors, unused code, and production readiness.

---

## Current State Snapshot (Jan 2025)
- **704 TypeScript compilation errors** (CRITICAL)
- **3,541 console.log statements** across 299 files (production code smell)
- **553 source files** (TypeScript/React Native)
- **Multiple backup files** (.bak, _backup.tsx) cluttering codebase
- **UI inconsistencies** reported by development team
- **Zero loading states** claimed by CLAUDE.md, but unclear if implemented consistently

---

## Audit Objectives (Priority Order)

### 🔴 **P0: Critical User-Facing Issues** (Fix Before Launch)
Focus: Issues that cause crashes, data loss, broken core flows, or confusing UX

**Target Outcomes:**
- All TypeScript errors resolved (704 → 0)
- Core flows work without crashes (auth, teams, competitions, workouts, payments)
- No security vulnerabilities (exposed keys, insecure storage)
- Critical UI blockers fixed (buttons that don't work, navigation dead ends)

### 🟠 **P1: High-Impact Quick Wins** (2-4 Hour Fixes)
Focus: Issues with major UX impact but simple fixes

**Target Outcomes:**
- Consistent loading states across all async operations
- Clear error messages for network failures
- UI consistency (colors, spacing, typography from theme)
- Missing empty states for lists/feeds
- Proper button feedback (disabled states, press indicators)

### 🟡 **P2: Production Readiness** (Post-Launch OK)
Focus: Code quality and maintainability

**Target Outcomes:**
- Remove all console.log statements (3,541 → 0)
- Delete backup files (.bak, _backup, _old)
- Ensure all components follow 500-line file limit
- Update folder READMEs to match current file structure

### 🟢 **P3: Technical Debt** (Backlog)
Focus: Long-term improvements

**Target Outcomes:**
- Refactoring opportunities
- Performance optimizations
- Test coverage improvements
- Documentation enhancements

---

## Systematic Review Protocol

### **Phase 1: TypeScript Error Analysis** (15 minutes)
**Goal: Categorize and prioritize 704 TypeScript errors**

```bash
npm run typecheck 2>&1 | tee typecheck_output.txt
```

**Analysis Tasks:**
1. **Group errors by pattern:**
   - Dynamic import issues (module configuration)
   - Missing properties on types
   - Type mismatches (e.g., CustomAlert.alert usage)
   - Service API changes (UnifiedSigningService, NWCWalletService)
   - Incorrect type assignments

2. **Identify quick fixes:**
   - Find errors affecting 10+ files (likely systemic issue with simple fix)
   - Identify missing type definitions
   - Locate incorrect API usage patterns

3. **Prioritize by impact:**
   - Errors in core flows (auth, teams, workouts) = P0
   - Errors in secondary features (challenges, analytics) = P1
   - Errors in test files = P2

**Deliverable:** Table of error patterns with fix estimates

| Error Pattern | Files Affected | Fix Complexity | Priority | Estimated Time |
|---------------|----------------|----------------|----------|----------------|
| Example: CustomAlert.alert() should be CustomAlertManager.alert() | 3 | Low | P0 | 15 min |

---

### **Phase 2: Core Flow Validation** (20 minutes)
**Goal: Ensure critical user journeys work without errors**

**Core Flows to Audit:**
1. **Authentication Flow** (`LoginScreen.tsx` → `AuthContext.tsx`)
   - [ ] Nsec input → Profile import → Navigation to Profile tab
   - [ ] Auto-wallet creation after login
   - [ ] Secure storage of nsec/npub in AsyncStorage
   - [ ] No exposed private keys in logs

2. **Team Discovery & Join** (`TeamDiscoveryScreen.tsx` → `SimpleTeamScreen.tsx`)
   - [ ] Real-time team loading from Nostr relays
   - [ ] Captain detection working correctly
   - [ ] Join button → Join request → Captain notification
   - [ ] Loading states during Nostr queries
   - [ ] Empty state when no teams found

3. **Competition Participation** (`EventDetailScreen.tsx` → `EventCaptainDashboardScreen.tsx`)
   - [ ] Event details load correctly
   - [ ] Join event → Payment flow (if paid event)
   - [ ] Leaderboard displays team members' workouts
   - [ ] Auto-entry prompt after workout completion
   - [ ] Captain dashboard shows join requests

4. **Workout Posting** (`ProfileScreen.tsx` → HealthKit integration)
   - [ ] HealthKit workouts appear in timeline
   - [ ] "Save to Nostr" button publishes kind 1301
   - [ ] "Post to Nostr" button creates social card
   - [ ] No duplicate posting (status tracking works)
   - [ ] Beautiful social cards render correctly

5. **Lightning Payments** (`NWCWalletService.ts` → Payment flows)
   - [ ] NWC wallet connection initialization
   - [ ] Invoice generation for event entry fees
   - [ ] Payment verification (NWC auto-verify)
   - [ ] Zap sending between users
   - [ ] Balance display accuracy

**For Each Flow:**
- [ ] **TypeScript errors blocking compilation?**
- [ ] **Missing loading indicators during async operations?**
- [ ] **Error handling for network failures?**
- [ ] **Empty states for zero data scenarios?**
- [ ] **UI feedback for button presses?**
- [ ] **Navigation works without dead ends?**

**Deliverable:** Critical flow checklist with issues flagged

---

### **Phase 3: UI Consistency Audit** (15 minutes)
**Goal: Identify inconsistent styling and theme usage**

**Check Against Theme System** (`src/styles/theme.ts`):

```bash
# Find hardcoded colors (should use theme)
grep -r "#[0-9a-fA-F]\{6\}" src/screens src/components --include="*.tsx" | grep -v "theme.colors" | head -50

# Find custom Alert.alert() usage (should use CustomAlertManager.alert())
grep -r "CustomAlert\.alert(" src/ --include="*.tsx"

# Find missing StatusBar imports
grep -l "SafeAreaView" src/screens/*.tsx | xargs grep -L "StatusBar"
```

**UI Consistency Checklist:**
- [ ] All colors from `theme.colors` (no hardcoded `#FF9D42`, `#000000`, etc.)
- [ ] All spacing from `theme.spacing` (no magic numbers like `paddingHorizontal: 16`)
- [ ] All typography from `theme.typography` (font weights, sizes)
- [ ] Consistent button styles (primary vs secondary)
- [ ] Consistent card styles (background, borders, shadows)
- [ ] StatusBar on all screens (dark content on light orange background)

**Common UI Inconsistencies to Find:**
1. **Mixed Alert patterns:**
   - `CustomAlert.alert()` ❌ (doesn't exist)
   - `CustomAlertManager.alert()` ✅ (correct)

2. **Hardcoded colors:**
   - `backgroundColor: '#0a0a0a'` ❌
   - `backgroundColor: theme.colors.cardBackground` ✅

3. **Inconsistent button states:**
   - Missing `disabled` prop styling
   - No `opacity` feedback on press
   - Inconsistent loading indicators

**Deliverable:** List of files with UI inconsistencies + pattern to fix

---

### **Phase 4: Dead Code & Unused Files** (10 minutes)
**Goal: Identify files safe to delete**

**Backup Files to Remove:**
```bash
# Find all backup files
find src/ -type f \( -name "*_backup*" -o -name "*_old*" -o -name "*.bak" \)
```

**Expected Results:**
- `src/App_backup.tsx` (delete)
- `src/screens/AdvancedAnalyticsScreen.tsx.bak` (delete)
- `src/components/profile/tabs/PrivateWorkoutsTab.tsx.bak` (delete)

**Unused Service Detection:**
```bash
# Find services never imported
for file in src/services/**/*.ts; do
  basename=$(basename "$file" .ts)
  grep -r "from.*$basename" src/ --include="*.tsx" --include="*.ts" -q || echo "Unused: $file"
done | head -20
```

**Files to Investigate:**
- [ ] Test files in `/src` (should be in `__tests__/`)
- [ ] Services with "old", "legacy", "backup" in filename
- [ ] Components never imported
- [ ] Utils never called

**Deliverable:** List of files safe to delete (with confidence score)

---

### **Phase 5: Production Code Smell Detection** (15 minutes)
**Goal: Find production-ready violations**

**1. Console Logs (3,541 occurrences)**
```bash
# Count console.logs by file (top offenders)
grep -r "console\\.log(" src/ --include="*.ts" --include="*.tsx" | cut -d: -f1 | sort | uniq -c | sort -rn | head -20
```

**Action Plan:**
- Services with >50 console.logs = Needs logging library
- Test/debug files = OK to keep (label with comment)
- Production screens = Remove immediately

**2. Exposed Secrets**
```bash
# Check for exposed private keys or sensitive data
grep -r "getPrivateKey\|nsec1\|sk_\|API_KEY" src/ --include="*.tsx" --include="*.ts" | grep -v "// Safe:"
```

**3. Missing Error Boundaries**
```bash
# Find screens without error handling
grep -L "try\|catch\|ErrorBoundary" src/screens/*.tsx
```

**4. Memory Leak Patterns**
```bash
# Find useEffect with subscriptions but no cleanup
grep -A 10 "useEffect.*subscribe" src/ --include="*.tsx" | grep -L "return () =>"
```

**Deliverable:** Production readiness violations by severity

---

### **Phase 6: Performance & UX Quick Wins** (10 minutes)
**Goal: Find low-hanging fruit for better perceived performance**

**Loading State Audit:**
```bash
# Find async operations without loading indicators
grep -r "useState.*loading\|isLoading" src/screens/*.tsx src/components/**/*.tsx | cut -d: -f1 | sort -u > loading_screens.txt
grep -r "fetchEvents\|subscribe\|ndk\." src/screens/*.tsx | cut -d: -f1 | sort -u > async_screens.txt
comm -13 loading_screens.txt async_screens.txt  # Screens with async but no loading state
```

**Empty State Audit:**
```bash
# Find lists without empty states
grep -r "FlatList\|ScrollView" src/screens/*.tsx src/components/**/*.tsx -l | xargs grep -L "ListEmptyComponent\|No.*found\|empty"
```

**Query Optimization Opportunities:**
```bash
# Find unbounded Nostr queries (no limit parameter)
grep -r "fetchEvents({" src/ --include="*.ts" -A 5 | grep -v "limit:"
```

**Deliverable:** Quick wins list with implementation effort

| Issue | Impact | Effort | Files Affected |
|-------|--------|--------|----------------|
| Missing loading state on TeamDiscoveryScreen | High | 10 min | 1 |
| No empty state for zero teams | High | 15 min | 1 |
| Unbounded workout query in leaderboard | Medium | 10 min | 1 |

---

## Output Format: Actionable Audit Report

### Executive Summary
```markdown
## RUNSTR Code Audit - [Date]

### Critical Findings
- 🔴 **[NUMBER]** P0 issues (must fix before launch)
- 🟠 **[NUMBER]** P1 issues (high-impact quick wins)
- 🟡 **[NUMBER]** P2 issues (production readiness)
- 🟢 **[NUMBER]** P3 issues (technical debt)

### Estimated Time to Launch-Ready
- Critical fixes: [X] hours
- High-impact wins: [X] hours
- **Total:** [X] hours

### Recommendation: READY / NOT READY / READY WITH CAVEATS
[Brief explanation]
```

---

### Detailed Findings (Grouped by Priority)

#### 🔴 P0: Critical Issues (Fix Before Launch)

**Format for each issue:**
```markdown
### [ISSUE-001] [Short Title]
**Impact:** [User-facing consequence]
**Location:** `src/path/to/file.tsx:line`
**Root Cause:** [Technical explanation]
**Fix:** [Specific steps]
**Effort:** [time estimate]
**Testing:** [How to verify fix]

---
```

**Example:**
```markdown
### [ISSUE-001] CustomAlert.alert() Pattern Incorrect
**Impact:** Modals don't appear when captains try to remove members, breaking team management
**Location:**
- `src/components/captain/EventParticipantManagementSection.tsx:69,79,111` (5 usages)
- `src/components/competition/EventCreationModal.tsx:129,142,274,277` (4 usages)
- `src/components/team/EventsCard.tsx` (unknown count)

**Root Cause:** Components call `CustomAlert.alert()` which doesn't exist. The correct pattern is `CustomAlertManager.alert()` (see `CustomAlert.tsx:126`).

**Fix:**
1. Search codebase: `grep -r "CustomAlert\.alert(" src/ --include="*.tsx"`
2. Replace all instances with `CustomAlertManager.alert(`
3. Ensure `CustomAlertProvider` wraps app in `App.tsx`

**Effort:** 15 minutes

**Testing:**
1. Open Event Captain Dashboard
2. Try to remove a member (should show confirmation modal)
3. Try to create event with missing fields (should show error modal)
```

---

#### 🟠 P1: High-Impact Quick Wins

[Same format as P0, but for 2-4 hour fixes]

---

#### 🟡 P2: Production Readiness Issues

**Console.Log Cleanup Plan:**
- **Strategy:** Remove all 3,541 console.logs in batches
- **Estimated Time:** 3-4 hours (bulk find/replace)
- **Script:**
```bash
# Generate list of files with console.logs
grep -r "console\.log(" src/ --include="*.ts" --include="*.tsx" -l > console_log_files.txt

# For each file, comment out console.logs with "// DEBUG:" prefix
# (Allows easy re-enabling during development if needed)
```

**Backup File Cleanup:**
- Delete 3 backup files immediately
- Update `.gitignore` to prevent future backups
- Estimated Time: 5 minutes

---

#### 🟢 P3: Technical Debt (Backlog)

[Brief bullet list of longer-term improvements]

---

### Pattern-Based Fixes (Batch Operations)

**For issues affecting 10+ files, provide batch fix script:**

```markdown
### Pattern Fix: Missing Loading States

**Files Affected:** 23 screens with Nostr queries but no loading indicators

**Batch Fix Template:**
1. Add state: `const [isLoading, setIsLoading] = useState(false);`
2. Wrap fetch: `setIsLoading(true); await fetch(); setIsLoading(false);`
3. Add UI: `{isLoading && <ActivityIndicator />}`

**Files:**
- `src/screens/TeamDiscoveryScreen.tsx`
- `src/screens/EventDetailScreen.tsx`
- [... rest of list]

**Total Effort:** 2-3 hours (bulk operation)
```

---

### Folder Structure Issues

**Out-of-Date READMEs:**
[List folders where README doesn't match current files]

**Example:**
```markdown
### `src/components/captain/README.md`
**Issue:** Missing 3 new files added in payment verification system
**Fix:** Add entries for:
- `PaymentVerificationBadge.tsx` - Payment status indicator with NWC auto-verify
- `EventTransactionHistory.tsx` - Incoming payment display for captains
- `CaptainArbitrationDashboard.tsx` - Dispute resolution interface

**Effort:** 5 minutes
```

---

## Special Focus Areas for RUNSTR

### 1. Global NDK Usage Validation
**Context:** App uses single global NDK instance to avoid WebSocket explosion

**Audit Task:**
```bash
# Find services creating new NDK instances (anti-pattern)
grep -r "new NDK(" src/services/ --include="*.ts" | grep -v "GlobalNDKService.ts"

# Find services still using NostrRelayManager (legacy pattern)
grep -r "new NostrRelayManager(" src/ --include="*.ts"
```

**Expected:** Zero matches (all services should use `GlobalNDKService.getInstance()`)

---

### 2. Lightning Payment Verification Flow
**Context:** New payment verification system added Jan 2025

**Audit Checklist:**
- [ ] `PaymentVerificationBadge.tsx` TypeScript compiles
- [ ] NWC wallet lookups handle failures gracefully
- [ ] Manual verification button works for non-NWC captains
- [ ] Transaction history filters work correctly
- [ ] Payment hash extraction from invoices is robust

**Files to Review:**
- `src/services/wallet/NWCWalletService.ts`
- `src/components/captain/PaymentVerificationBadge.tsx`
- `src/components/captain/EventTransactionHistory.tsx`

---

### 3. HealthKit Workout Posting
**Context:** Apple HealthKit integration for workout publishing

**Audit Checklist:**
- [ ] Permissions requested correctly
- [ ] Workout parsing handles all activity types
- [ ] Duplicate posting prevention works
- [ ] Social card generation doesn't crash
- [ ] Kind 1301 events have correct format (see `KIND_1301_SPEC.md`)

---

### 4. Captain Detection Caching
**Context:** Captain detection has known cache issues (see `LESSONS_LEARNED.md`)

**Audit Task:**
- [ ] Verify `useCaptainDetection` hook TypeScript compiles
- [ ] Check cache invalidation on team changes
- [ ] Ensure no stale captain status displayed
- [ ] Test navigation to Captain Dashboard

---

## Success Criteria

### Audit Complete When:
1. ✅ All 704 TypeScript errors categorized and prioritized
2. ✅ P0 issues have specific fix plans with time estimates
3. ✅ P1 quick wins identified (at least 10 issues)
4. ✅ Batch fix scripts provided for pattern-based issues
5. ✅ Executive summary shows path to launch-readiness

### Launch-Ready When:
1. ✅ Zero TypeScript compilation errors (`npm run typecheck` passes)
2. ✅ All P0 issues fixed and tested
3. ✅ Core flows validated on physical device
4. ✅ No exposed private keys or sensitive data in logs
5. ✅ All backup files deleted

---

## Tooling & Commands Reference

### TypeScript Analysis
```bash
npm run typecheck 2>&1 | tee typecheck_output.txt
npm run typecheck 2>&1 | grep "error TS" | cut -d: -f1 | sort | uniq -c | sort -rn
```

### Code Search Patterns
```bash
# UI inconsistencies
grep -r "#[0-9a-fA-F]\{6\}" src/ --include="*.tsx" | grep -v "theme.colors"

# Production code smells
grep -r "console\.log(" src/ --include="*.tsx" -c | sort -t: -k2 -rn | head -20

# Missing error handling
grep -L "try\|catch" src/screens/*.tsx

# Memory leak patterns
grep -r "useEffect.*subscribe" src/ --include="*.tsx" -A 10 | grep -L "return () =>"
```

### Backup File Cleanup
```bash
find src/ -type f \( -name "*_backup*" -o -name "*_old*" -o -name "*.bak" \) -delete
```

---

## Implementation Priority Matrix

Use this to triage fixes during the audit:

| User Impact | Fix Complexity | Priority | Action |
|-------------|----------------|----------|--------|
| High | Low | **P0** | Fix immediately |
| High | Medium | **P0/P1** | Fix within 24h |
| High | High | **P1** | Break into smaller tasks |
| Medium | Low | **P1** | Quick win |
| Medium | Medium | **P2** | Post-launch |
| Low | Any | **P3** | Backlog |

---

## Final Deliverable Checklist

Before submitting audit report, ensure:
- [ ] Executive summary shows clear path to launch
- [ ] All P0 issues have specific file:line references
- [ ] Fix estimates are realistic (tested on 1-2 issues)
- [ ] Batch fix scripts are copy-paste ready
- [ ] Success criteria clearly defined
- [ ] No vague recommendations ("improve performance") - all actionable
- [ ] Report length: 10-15 pages (comprehensive but focused)

---

## Notes for Sonnet 4.5

**Use Tools Effectively:**
- `Read` tool to analyze specific files mentioned above
- `Grep` tool to find patterns across codebase
- `Bash` tool to run TypeScript compiler and code analysis commands
- `Glob` tool to find files matching patterns

**Don't:**
- Make any code changes (audit only)
- Recommend major architectural refactors (focus on quick wins)
- Spend time on low-impact issues (stick to priority matrix)
- Create new features (fix existing issues only)

**Time Budget:** 90 minutes total
- Phase 1: 15 min
- Phase 2: 20 min
- Phase 3: 15 min
- Phase 4: 10 min
- Phase 5: 15 min
- Phase 6: 10 min
- Report writing: 15 min

**Start Command:**
```
I'm ready to begin the RUNSTR code audit. Starting with Phase 1: TypeScript Error Analysis...
```
