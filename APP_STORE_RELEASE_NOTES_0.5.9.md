# App Store Release Notes - Version 0.5.9

## What's New

**Per-Set Weight Tracking - Train Smarter with Detailed Set Data**
Strength training just got a major upgrade! Now track the exact weight you lift for each individual set, not just an average. When you complete a set, RUNSTR automatically pre-fills the weight from your previous set for faster entry. Workout cards now display beautiful per-set breakdowns showing "12 reps @ 135 lbs" for each set, giving you and your team complete visibility into your strength progression.

**Enhanced Workout Cards - Activity-Specific Stats**
Your workout achievements now display smarter stats based on activity type. Strength workouts show the first 3 sets with per-set breakdowns plus a "+N more sets" indicator. Diet entries display meal type and portion size. Meditation sessions show meditation type (Guided, Breathwork, etc.). Every card is optimized to highlight what matters most for that specific activity.

**Richer Social Sharing - User Identity on All Cards**
All activity trackers now include your user avatar and name on social workout cards. When you publish strength training, meditation, or diet workouts to Nostr, your identity appears beautifully integrated with your achievement. Build your fitness reputation with professionally designed social cards that showcase both your workouts and your profile.

**Performance Monitoring - Under the Hood Improvements**
New PerformanceLogger utility helps identify bottlenecks and optimization opportunities. Nuclear1301Service received 42 lines of improvements with better workout data processing, validation, and error handling. Publishing flow is more reliable with enhanced workout posting to Nostr.

**Better UX Consistency**
Replaced React Native's native Alert component with our custom CustomAlert component across all activity trackers for consistent styling, better theme integration, and improved user experience.

---

## App Store Connect Format (Character Limit: 4000)

### Copy-paste this version:

```
What's New in Version 0.5.9:

PER-SET WEIGHT TRACKING
• Track exact weight for each individual set during strength workouts
• Smart pre-fill: Weight defaults to previous set's weight
• Per-set breakdown display: "12 reps @ 135 lbs" for each set
• Stores per-set weights in workout metadata
• Better strength progression tracking
• View detailed set-by-set performance on workout cards

ENHANCED WORKOUT CARD STATS
• Activity-specific stat display based on workout type
• Strength: First 3 sets with "X reps @ Y lbs" breakdown
• Strength: "+N more sets" indicator for workouts with 4+ sets
• Diet: Meal type and portion size display
• Meditation: Meditation type (Guided, Breathwork, Mindfulness, etc.)
• Cardio: Distance, pace, duration optimized for running/cycling/walking
• Smarter, cleaner workout achievement cards

RICHER SOCIAL SHARING
• User avatar and name now appear on all activity tracker posts
• Strength training social cards include your profile
• Meditation tracker social cards include your profile
• Diet tracker social cards include your profile
• Build your fitness reputation with identity-rich workout posts
• Professionally designed cards for every workout type

WORKOUT PUBLISHING IMPROVEMENTS
• Nuclear1301Service: +42 lines of enhancements
• Better workout data processing and validation
• Improved error handling for failed publishes
• More reliable posting to Nostr network
• Enhanced metadata management
• Faster, more robust workout publishing

PERFORMANCE MONITORING
• New PerformanceLogger utility for tracking app performance
• Helps identify bottlenecks and optimization opportunities
• Better diagnostics for slow operations
• Foundation for future performance improvements

UX CONSISTENCY
• Replaced React Native Alert with CustomAlert component
• Consistent alert styling across all trackers
• Better integration with app theme
• Improved user experience on all dialogs

UNDER THE HOOD
• 12 files modified (435 insertions, 80 deletions)
• Major additions: StrengthTracker (+260 lines), workoutCardGenerator (+91 lines), Nuclear1301Service (+42 lines)
• New utility: PerformanceLogger for performance tracking
• Enhanced workout type support with new metadata fields
• Better navigation and data flow management

Thanks for using RUNSTR! Track your sets with precision, share your achievements, and compete with your team for Bitcoin rewards.
```

---

## Alternative Short Version (for space-constrained updates):

```
New in 0.5.9:
• Per-Set Weight Tracking - Track exact weight for each strength training set
• Enhanced Workout Cards - Activity-specific stats (strength, diet, meditation)
• Richer Social Sharing - User avatar and name on all workout posts
• Publishing Improvements - More reliable Nostr workout posting
• Performance Monitoring - New PerformanceLogger utility
• UX Consistency - CustomAlert component across all trackers
```

---

## Notes for Review Team (Internal):

**Key Changes:**
- StrengthTrackerScreen.tsx: +260 lines (per-set weight tracking with modal input)
- workoutCardGenerator.ts: +91 lines (activity-specific stat display)
- Nuclear1301Service.ts: +42 lines (enhanced workout publishing)
- PerformanceLogger.ts: new utility file (3.5KB, performance tracking)
- MeditationTrackerScreen.tsx: +14 lines (social sharing with user profile)
- DietTrackerScreen.tsx: +13 lines (social sharing with user profile)
- workoutPublishingService.ts: +11 lines (better publishing flow)

**Testing Focus:**
- Start strength training workout and complete multiple sets
- Verify weight input modal appears after each set
- Confirm weight pre-fills from previous set or setup weight
- View workout card and verify per-set breakdown display ("X reps @ Y lbs")
- Complete strength workout with 4+ sets and verify "+N more sets" indicator
- Publish strength workout and verify social card includes avatar/name
- Log diet entry and verify meal type + portion size on card
- Complete meditation session and verify meditation type displays
- Test CustomAlert appearance across all activity trackers
- Verify workout publishing to Nostr completes successfully

**Version Bump Rationale:**
Minor release (0.5.8 → 0.5.9) for per-set weight tracking feature, enhanced workout card display, and social sharing improvements. Includes performance monitoring utility and publishing reliability enhancements. No breaking changes.
