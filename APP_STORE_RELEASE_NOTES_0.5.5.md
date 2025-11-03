# App Store Release Notes - Version 0.5.5

## What's New

**Simplified Event Creation**
Event creation has been streamlined to focus on what runners love most! The wizard now features 3 popular running race presets (5K, 10K, Half Marathon) instead of 11 mixed presets. All events automatically run for 24 hours with fastest-time scoring. Creating competitions is now faster and more intuitive.

**Running Tracker Scrollable Interface**
Fixed UI overflow issues on smaller devices! The running tracker screen is now fully scrollable, ensuring all controls and metrics are accessible during your workout, no matter your screen size.

**Cleaner Join Request Management**
Captains no longer see participants they've already approved in the join requests section. The system automatically filters out approved members, making it easier to focus on new pending requests.

**Improved Authentication System**
Enhanced UnifiedSigningService integration provides more reliable signing for Nostr events, supporting both nsec and Amber authentication methods seamlessly.

---

## App Store Connect Format (Character Limit: 4000)

### Copy-paste this version:

```
What's New in Version 0.5.5:

SIMPLIFIED EVENT CREATION
• Streamlined to 3 popular running race presets
• 5K Race, 10K Race, Half Marathon options
• All events auto-set to 24-hour duration
• Fastest-time scoring for competitive racing
• Cleaner wizard interface reduces decision fatigue

RUNNING TRACKER UX IMPROVEMENTS
• Made screen fully scrollable for all device sizes
• Fixed UI overflow on smaller screens
• All controls and metrics now accessible during workouts
• GPS status, battery warning, route recognition all visible
• Improved layout for race preset selection

JOIN REQUEST MANAGEMENT ENHANCEMENT
• Auto-filters already-approved participants
• Captains only see new pending requests
• Reduced clutter in join requests section
• Faster approval workflow for event captains
• Console logging for debugging captain workflows

UNIFIED AUTHENTICATION IMPROVEMENTS
• Enhanced UnifiedSigningService integration
• More reliable event publishing to Nostr
• Supports both nsec and Amber authentication
• Better error handling for signing operations
• Improved stability for competition participation

UNDER THE HOOD
• EventCreationWizard.tsx: -719 lines (massive simplification)
• RunningTrackerScreen.tsx: ScrollView wrapper for better UX
• EventJoinRequestsSection.tsx: Smart filtering logic
• EventParticipationStore.ts: Enhanced participant tracking
• NostrCompetitionService.ts: Improved event queries

Thanks for using RUNSTR! Keep competing and earning Bitcoin through fitness.
```

---

## Alternative Short Version (for space-constrained updates):

```
New in 0.5.5:
• Simplified event creation (3 running race presets)
• Running tracker now scrollable (fixes UI overflow)
• Join requests auto-filter approved participants
• Improved authentication system (UnifiedSigningService)
```

---

## Notes for Review Team (Internal):

**Key Changes:**
- EventCreationWizard.tsx: -719 lines (reduced from 11 presets to 3 running-focused)
- RunningTrackerScreen.tsx: +107 lines (ScrollView wrapper for full content access)
- EventJoinRequestsSection.tsx: +39 lines (filter approved participants)
- EventParticipationStore.ts: +23 lines (enhanced tracking)
- NostrCompetitionService.ts: +11 lines (improved queries)

**Testing Focus:**
- Event creation wizard shows only 3 running presets
- Running tracker scrolls properly on all screen sizes
- Join requests section excludes already-approved participants
- Event publishing works with both nsec and Amber authentication
- All race presets create 24-hour events with fastest-time scoring

**Version Bump Rationale:**
Minor release (0.5.4 → 0.5.5) for UX improvements and simplifications. No breaking changes or new major features - focused on polish and user experience refinement.
