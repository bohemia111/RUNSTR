# App Store Release Notes - Version 0.5.7

## What's New

**RUNSTR Fitness Test - Complete Physical Assessment**
Test your overall fitness with our new standardized fitness test! Complete three exercises in 60 minutes: maximum pushups, maximum situps, and fastest 5K run time. Get scored out of 300 points and track your progress over time. Perfect for benchmarking your fitness level and setting improvement goals.

**Captain Dashboard Enhancements - Better Team Management**
Captains can now view and manage their team members more easily with the new TeamMembersSection component. See your complete roster at a glance, remove members when needed, and keep your team organized with improved member list UI and real-time status updates.

**Tracker Improvements - More Reliable Activity Recording**
Major improvements to activity tracking accuracy and reliability. Strength training tracker now handles exercise logging and set tracking better. Diet tracker has fixed calorie calculations and meal entry forms. Activity tracker performance continues to improve with better GPS accuracy and battery management.

**Garmin Integration Fixes - Sync More Reliably**
Enhanced Garmin authentication and sync reliability with 76 lines of improvements. Fixed token refresh issues, better error handling for failed syncs, and improved connection stability. Your Garmin workouts will now sync more consistently to RUNSTR.

**Analytics Page Fixes**
Resolved display bugs and calculation errors in the Advanced Analytics screen. Charts now render correctly, metric calculations are accurate, and error handling is improved for missing data.

---

## App Store Connect Format (Character Limit: 4000)

### Copy-paste this version:

```
What's New in Version 0.5.7:

RUNSTR FITNESS TEST
• Complete physical assessment: pushups, situps, 5K run
• 60-minute timer with auto-save and resume support
• 300-point maximum score with detailed breakdown
• Track your fitness progress over time
• Benchmark your overall physical performance
• Instructions modal with exercise demonstrations

CAPTAIN DASHBOARD ENHANCEMENTS
• TeamMembersSection for easy roster management
• View all team members in one place
• Remove members with improved controls
• Real-time member count and status updates
• Better team organization tools

TRACKER IMPROVEMENTS
• Strength Training: Fixed exercise logging and set tracking
• Strength Training: Improved rep counter and weight input
• Diet Tracker: Fixed calorie calculation bugs
• Diet Tracker: Corrected meal entry form validation
• Activity Tracker: Better GPS accuracy during workouts
• Activity Tracker: Improved battery management
• Enhanced data collection reliability

GARMIN INTEGRATION FIXES
• Fixed token refresh issues (76 lines of improvements)
• Better error handling for failed syncs
• Improved connection stability
• More reliable workout sync from Garmin devices
• Enhanced OAuth flow

ANALYTICS PAGE FIXES
• Fixed data rendering issues in charts
• Corrected metric calculations for workout statistics
• Improved error handling for missing data
• Better display of workout analytics

UNDER THE HOOD
• 8 files modified, 4 new files created
• 471 insertions, 37 deletions (net +434 lines)
• Major additions: Fitness Test (+286 lines), Strength Training (+77 lines), Garmin (+76 lines)
• New services: FitnessTestService for test state management
• New screens: FitnessTestResultsScreen with detailed scoring

Thanks for using RUNSTR! Test your fitness, manage your teams, and track your progress toward your goals.
```

---

## Alternative Short Version (for space-constrained updates):

```
New in 0.5.7:
• RUNSTR Fitness Test - 60-minute assessment with 300-point scoring
• Captain Dashboard enhancements - Better team member management
• Strength Training tracker fixes - Improved exercise logging
• Diet Tracker fixes - Corrected calorie calculations
• Garmin integration improvements - More reliable sync
• Analytics page fixes - Better data display
```

---

## Notes for Review Team (Internal):

**Key Changes:**
- FitnessTestInstructionsModal.tsx (new modal for test instructions)
- FitnessTestResultsScreen.tsx (new screen for test results, 16KB)
- FitnessTestService.ts (new service, 11KB)
- fitnessTest.ts (new types, 1.9KB)
- AdvancedAnalyticsScreen.tsx: +286 lines (fitness test integration)
- StrengthTrackerScreen.tsx: +77 lines (tracker improvements)
- garminAuthService.ts: +76 lines (authentication fixes)
- ActivityTrackerScreen.tsx: +41 lines (performance improvements)

**Testing Focus:**
- Start RUNSTR Fitness Test and complete all three exercises
- Verify timer counts correctly and auto-saves progress
- Test fitness test resume after interruption
- View fitness test results and scoring breakdown
- Captain: View team members in TeamMembersSection
- Captain: Remove team member and verify roster updates
- Log strength training workout with sets and reps
- Track diet with meal entries and calorie calculations
- Sync Garmin workouts and verify authentication
- View Advanced Analytics and verify chart rendering

**Version Bump Rationale:**
Minor release (0.5.6 → 0.5.7) for new fitness test feature and multiple bug fixes across trackers and integrations. No breaking changes.
