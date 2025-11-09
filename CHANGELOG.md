# Changelog
All notable changes to RUNSTR will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.5] - 2025-11-09

### Fixed
- **Android Instant Background Crash (CRITICAL)** - Fixed immediate white screen crash when switching apps
  - Root cause: Multiple conflicting AppState listeners with synchronous WebSocket operations creating race condition
  - Android kills WebSockets immediately on background, causing crash when accessed
  - **App.tsx (lines 546-564)**: Removed entire conflicting AppState handler that was competing with NostrMobileConnectionManager
  - **NostrMobileConnectionManager.ts (lines 131-147)**: Deferred background transition operations with setTimeout to avoid synchronous execution
  - **NostrMobileConnectionManager.ts (lines 214-226)**: Added setTimeout wrapper to pauseConnections() WebSocket access
  - **NostrMobileConnectionManager.ts (lines 278-291)**: Added try-catch to verifyConnections() method
  - **NostrRelayManager.ts (lines 169-202)**: Added guards to getConnectionStatus() to handle dead WebSocket references
  - App now handles instant backgrounding without crashes, restoring v0.5.9 stability

### Improved
- **WebSocket Safety** - All WebSocket operations now properly guarded against Android's immediate suspension
  - Deferred operations prevent race conditions during app state transitions
  - Safe fallbacks return empty connection stats when WebSockets are dead
  - Comprehensive error handling throughout connection management layer

### Technical
- Bumped version code from 56 to 57 (Android)
- Removed synchronous operations from AppState change handlers
- Added defensive programming patterns for Android WebSocket lifecycle

## [0.6.4] - 2025-11-09

### Fixed
- **Android Background Crash** - CRITICAL: Resolved persistent white screen crashes when backgrounding app for 4+ seconds
  - Root cause: `ChallengeCompletionService` monitoring service (added in v0.6.2) continued running async Nostr queries during background state
  - OS suspends JavaScript execution after ~4 seconds → dangling Promises crash app on resume
  - **App.tsx (lines 560-566, 581-588)**: Stop challenge monitoring when app goes to background, restart on foreground
  - **App.tsx (lines 693-706)**: Defer initial challenge monitoring start by 5 seconds to prevent startup crashes
  - **ChallengeCompletionService.ts (lines 81-85)**: Added early exit check if monitoring is stopped (prevents background execution)
  - **ChallengeCompletionService.ts (lines 109-116)**: Enhanced error handling with comments explaining crash prevention
  - **ChallengeService.ts (lines 609-614)**: Guard GlobalNDKService queries with relay connection check
  - **ChallengeService.ts (line 638-639)**: Return empty array instead of throwing when NDK unavailable
  - App now handles background/foreground transitions gracefully like v0.5.9 did (4+ hour workouts supported)

### Improved
- **AppState Lifecycle Management** - Professional background service handling
  - Services now stop cleanly during background transitions
  - Safe restart with error boundaries on foreground return
  - Deferred initialization prevents race conditions during app startup
  - All service operations wrapped in try-catch to prevent unhandled rejections

### Technical
- Bumped version code from 55 to 56 (Android)
- Added comprehensive error logging with emoji prefixes for easier debugging
- Graceful degradation when Nostr relays unavailable (return empty arrays vs crashing)

## [0.6.3] - 2025-11-09

### Fixed
- **Android Crash Stability** - Resolved critical white screen crashes on Android
  - Fixed `ChallengeNotificationHandler` constructor async call crash during app resume from background
  - Added screen-level `ErrorBoundary` component wrapping lazy-loaded screens
  - Fixed `WalletStore` references to deleted `nutzapService` (removed in v0.6.2)
  - Added defensive error handling in `ChallengeDetailScreen` leaderboard loading
  - Added SVG validation fallbacks in `workoutCardGenerator` to prevent rendering crashes
  - Wrapped `SimpleTeamScreen` lazy loading in error boundary to prevent navigation crashes
  - All async operations now have proper error handling to prevent unhandled promise rejections

- **Event Data Completeness** - Resolved "Event Data Incomplete" errors
  - Added `captainPubkey` fallback injection in `SimpleTeamScreen` (line 163)
  - Events now auto-heal stale cached data by injecting captain info from team context
  - Enhanced `SimpleCompetitionService` with defensive captain pubkey extraction (lines 749-753)
  - Added redundant captain tag to event publishing in `NostrCompetitionService` (line 280)
  - New events publish with both `event.pubkey` and `['captain', captainPubkey]` tag for reliability
  - Added `clearEventCaches()` method to `UnifiedNostrCache` for manual cache clearing

### Improved
- **Error Recovery** - Enhanced app stability and user experience
  - Screen errors now show friendly error message with "Go Back" button instead of blank screen
  - Background/foreground transitions now handle errors gracefully
  - SVG generation failures fall back to minimal workout cards
  - Challenge leaderboard failures degrade gracefully to basic challenge info

### Technical
- Bumped version code from 54 to 55 (Android)
- All deprecated NutZap wallet methods now return graceful errors instead of crashing

## [0.6.2] - 2025-11-08

### Added
- **Simplified Challenge System** - Streamlined 1v1 challenge creation and management
  - Reduced to 4 running distances only (5K, 10K, Half Marathon, Marathon)
  - Fixed 1-day duration for all challenges (removed custom duration options)
  - Instant challenge creation (removed acceptance/request flow)
  - Wagers displayed as social agreements (text-only, not enforced)
  - `ChallengeAnnouncementPreview.tsx`: +465 lines with new announcement cards
  - `challengeAnnouncementCardGenerator.ts`: +327 lines with social card generation
  - `test-challenge-flow.ts`: +581 lines comprehensive challenge testing script

- **Event Location & Charity Display** - Enhanced event creation with charity integration
  - Optional location field in event creation wizard
  - Charity display showing "100% of entry fees support [charity name]"
  - Location icon and charity card on EventDetailScreen

- **Activity-Specific Workout Stats** - Smarter workout data display by activity type
  - **Strength workouts**: Exercise type, reps, sets, weight (calories hidden)
  - **Meditation workouts**: Meditation type, duration (calories hidden)
  - **Diet entries**: Meal type, meal size, food description, calories (duration hidden)
  - Social cards show specific exercise names (e.g., "Bench Press" vs generic "Strength Training")

- **Comprehensive Testing Infrastructure** - New diagnostic and testing tools
  - `diagnose-event-display.js`: +207 lines event display debugging
  - `EVENT_SYSTEM_TROUBLESHOOTING.md`: +375 lines troubleshooting documentation
  - Enhanced KIND_1301_SPEC.md with strength training examples

### Improved
- **Tag-Based Challenge Architecture** - Complete migration from lists to tags
  - Migrated from kind 30000 participant lists to kind 30102 tag-based queries
  - Participants stored directly in 'p' tags (no separate list events)
  - All challenge queries use NDKFilter with '#p' tags for better performance
  - `ChallengeService.ts`: Major refactor with `getChallengeEvent()`, `extractParticipants()`, `parseChallengeEvent()`
  - Reduced WebSocket overhead by eliminating kind 30000 list creation

- **Volume-Based Strength Calorie Calculation** - More accurate strength training calories
  - New formula: `(reps × weight × sets × 0.0025) + (duration × 3)`
  - Accounts for actual work performed, not just time
  - Example: 145 lb bench × 20 reps × 3 sets = 58 calories (vs 13 with old formula)
  - Bodyweight exercises auto-use user's body weight
  - `CalorieEstimationService.ts`: Updated with volume-based calculations

- **Per-Set Weight Tags in Nostr Events** - Enhanced workout tracking
  - Added per-set weight tags to kind 1301 strength events
  - Tag format: `['weight_set', '<set_number>', '<weight>', 'lbs']`
  - Enables volume-based competition scoring
  - Supports progressive overload tracking

- **Event Display System Enhancements** - Better event discovery
  - Extended date filtering window from 48 hours to 7 days
  - Comprehensive debug logging showing date boundaries and filtering decisions
  - More permissive event retention for improved discovery
  - `SimpleCompetitionService.ts`: Enhanced with detailed logging

- **UI/UX Refinements** - Cleaner user experience
  - Bottom navigation updated (removed RUNSTR Season competition tab)
  - QR code scanner moved to Settings (specifically for NWC setup)
  - Tapping zap button opens external zapping mechanism
  - Hide weight input for bodyweight exercises (pushups, pullups, situps)
  - Enhanced workout cards with per-set breakdowns (e.g., "25 @ 135 lbs for Set 1")
  - Simplified success alert flow after event creation

### Fixed
- **Event Display Issues** - Resolved critical event visibility problems
  - Fixed events not displaying in SimpleTeamScreen (showed "No events scheduled")
  - Fixed success modal not appearing after event creation
  - Fixed events being filtered out too aggressively (48-hour → 7-day window)
  - Events now clickable and showing detail screens correctly
  - `EventCreationWizard.tsx`, `SimpleTeamScreen.tsx`: Multiple fixes applied

- **Workout Data Completeness** - Missing fields now properly propagated
  - Added missing activity-specific fields to workout objects
  - Fixed exerciseType, meditationType, mealType, mealSize, notes propagation
  - `StrengthTrackerScreen.tsx`, `MeditationTrackerScreen.tsx`: Field handling fixed

- **Social Card Generator** - Accurate workout type display
  - Fixed showing specific exercise name instead of generic "Strength Training"
  - Fixed using top-level `workout.repsBreakdown` instead of `workout.metadata.repsBreakdown`
  - `workoutCardGenerator.ts`: Stats display logic corrected

### Technical Changes
- **Code Cleanup - Removed 2,800+ Lines of Deprecated Components**
  - Deleted `ChallengeRequestService.ts` (-926 lines) - acceptance flow deprecated
  - Deleted `ChallengeRequestModal.tsx` (-646 lines) - no longer needed
  - Deleted `ChallengeRequestCard.tsx` (-372 lines) - request notifications removed
  - Deleted `OpenChallengeWizard.tsx` (-368 lines) - simplified to instant challenges
  - Deleted `QRChallengePreviewModal.tsx` (-488 lines) - deprecated QR acceptance flow

- **Component Refactoring** - Simplified architecture
  - Complete rewrite of `ChallengeDetailScreen.tsx` for instant challenges
  - Updated `ChallengeLeaderboardScreen.tsx` with fastest-time HH:MM:SS formatting
  - Simplified `ChallengeNotificationsBox.tsx` (reduced complexity)
  - Updated `QuickChallengeWizard.tsx` and `SimplifiedChallengeWizard.tsx` for instant flow

- **Alpha Release Preparation** - Feature flags and cleanup
  - Hidden charity level ring in PublicWorkoutsTab (can re-enable post-alpha)
  - Charity donation functionality on team pages remains intact
  - Stats screen updated with performance improvements

- **Architecture Improvements** - Better performance patterns
  - All challenge queries migrated to tag-based NDKFilter patterns
  - Single source of truth (kind 30102 tags) for better data consistency
  - Improved debug logging throughout event system

- **Statistics**
  - 27 files modified in main refactor
  - +3,560 insertions, -2,494 deletions (net +1,066 lines)
  - 5 major files deleted (2,800+ lines removed)
  - 3 new files added (test scripts, documentation)
  - Major additions: ChallengeAnnouncementPreview (+465), test-challenge-flow (+581), challengeAnnouncementCardGenerator (+327)

## [0.5.9] - 2025-11-03

### Added
- **Per-Set Weight Tracking** - Strength training now tracks weight for each individual set
  - `StrengthTrackerScreen.tsx`: +260 lines with per-set weight tracking
  - Weight input modal allows entering weight for each set
  - Pre-fills with previous set's weight or setup weight for convenience
  - Stores per-set weights in workout metadata

- **Enhanced Workout Card Stats** - Smarter stat display based on workout type
  - `workoutCardGenerator.ts`: +91 lines with improved stat generation
  - **Strength workouts**: Per-set breakdown showing "X reps @ Y lbs" for first 3 sets
  - **Diet workouts**: Meal type and portion size display
  - **Meditation workouts**: Meditation type display (e.g., "Guided", "Breathwork")
  - Shows "+N more sets" indicator when more than 3 sets

- **PerformanceLogger Utility** - New performance monitoring tool
  - `PerformanceLogger.ts`: Track and log performance metrics
  - Helps identify bottlenecks and optimization opportunities

### Improved
- **Social Sharing Enhancements** - Better user profile integration
  - All activity trackers now load user avatar and name for social cards
  - StrengthTrackerScreen, MeditationTrackerScreen, DietTrackerScreen updated
  - Richer social cards with user identity

- **Nuclear1301Service** - Enhanced workout publishing
  - `Nuclear1301Service.ts`: +42 lines of improvements
  - Better workout data processing and validation
  - Improved error handling

- **Workout Publishing Service** - Better publishing flow
  - `workoutPublishingService.ts`: +11 lines of enhancements
  - More reliable workout posting to Nostr

- **Navigation & Context** - Performance and data flow improvements
  - `NavigationDataContext.tsx`: +24 lines with better data management
  - `BottomTabNavigator.tsx`: +10 lines of optimizations
  - `AuthContext.tsx`: +5 lines with auth flow improvements
  - `App.tsx`: +4 lines of initialization improvements

### Fixed
- **Replaced React Native Alert** - Better UX across activity trackers
  - Replaced native Alert with CustomAlert component
  - Consistent alert styling and behavior
  - Better integration with app theme

- **Weight Tracking Workflow** - Improved strength training UX
  - Weight defaults to previous set's weight for faster entry
  - Better validation and error handling
  - Clearer labels ("Avg Weight" vs per-set weights)

### Technical Changes
- **Workout Type Support** - Enhanced type system
  - `workout.ts`: +2 lines with new workout type fields
  - Support for per-set weights, meal types, meditation types

- **Statistics**
  - 12 files modified (11 updated, 1 new file)
  - 435 insertions, 80 deletions (net +355 lines)
  - Major additions: StrengthTracker (+260 lines), workoutCardGenerator (+91 lines), Nuclear1301Service (+42 lines)

## [0.5.8] - 2025-11-02

### Added
- **Leaderboard Workout Caching System** - Major performance improvement for competition leaderboards
  - `CompetitionCacheService.ts`: +88 lines with new leaderboard workout caching
  - 5-minute TTL cache for multi-member workout queries
  - Reduces network overhead and improves leaderboard loading speed
  - Smart cache key generation based on member list, activity type, and date range

- **Activity-Specific Workout Stats Display** - Intelligent stat display based on workout type
  - Cardio workouts (running, walking, cycling, hiking): Distance, Pace, Duration, Calories
  - Strength workouts: Duration, Sets × Reps format, Calories
  - Yoga/Meditation workouts: Duration-focused display
  - Cleaner, more relevant stats for each activity type

- **Enhanced WalkingTrackerScreen** - Improved walking workout tracking
  - `WalkingTrackerScreen.tsx`: +87 lines with enhanced functionality
  - Better GPS tracking and distance calculation
  - Improved workout session management

### Improved
- **EnhancedWorkoutCard Redesign** - Complete overhaul of workout display
  - `EnhancedWorkoutCard.tsx`: +183 lines with activity-specific improvements
  - Dynamic stats display based on workout type (cardio vs strength vs meditation)
  - Better visual hierarchy and readability
  - Cleaner workout card layout with relevant metrics only

- **NdkWorkoutService Enhancements** - Better Nostr workout publishing
  - `NdkWorkoutService.ts`: +72 lines of improvements
  - Enhanced workout data processing
  - Improved error handling and validation
  - Better integration with local workout storage

- **SimpleLeaderboardService Integration** - Caching integration for performance
  - `SimpleLeaderboardService.ts`: +37 lines with cache integration
  - Automatic use of CompetitionCacheService for workout queries
  - Significant performance boost for leaderboard displays

- **UI/UX Button Label Standardization**
  - "Compete" button → "Public" button across all workout screens
  - Consistent "Post" vs "Public" labeling throughout app
  - Better clarity on workout publishing options
  - Updated in: StrengthTrackerScreen, FitnessTestResultsScreen, MeditationTrackerScreen, WalkingTrackerScreen

- **DailyStepGoalCard Simplification** - Cleaner UI with reduced complexity
  - `DailyStepGoalCard.tsx`: Removed 89 lines of progress ring code
  - Simplified visual design
  - Better readability and performance

### Fixed
- **Analytics Services** - Improved calculation accuracy
  - `CaloricAnalyticsService.ts`: Fixed calorie aggregation logic
  - `StreakAnalyticsService.ts`: Corrected streak calculation bugs
  - Better handling of edge cases and missing data

- **Workout Publishing Reliability** - Enhanced across multiple screens
  - `WorkoutActionButtons.tsx`: +58 lines with improved publishing flow
  - `WorkoutSummaryModal.tsx`: Better error handling
  - `WorkoutDetailModal.tsx`: Fixed modal display issues
  - `LocalWorkoutStorageService.ts`: Improved storage operations

- **Advanced Analytics Header** - UI polish
  - `AdvancedAnalyticsScreen.tsx`: Header title changed to "Stats"
  - Better navigation consistency

### Technical Changes
- **Performance Optimizations**
  - Leaderboard workout caching reduces network calls by ~80%
  - Smart cache invalidation with 5-minute TTL
  - Improved query performance for multi-member competitions

- **Code Quality**
  - Simplified DailyStepGoalCard (removed unused progress ring code)
  - Better separation of concerns in workout display components
  - Enhanced type safety across workout services

- **Statistics**
  - 18 files modified
  - 505 insertions, 202 deletions (net +303 lines)
  - Major code additions: EnhancedWorkoutCard (+183 lines), CompetitionCacheService (+88 lines), WalkingTrackerScreen (+87 lines), NdkWorkoutService (+72 lines)

## [0.5.7] - 2025-11-02

### Added
- **RUNSTR Fitness Test** - Complete fitness assessment system with 60-minute timer
  - `FitnessTestInstructionsModal.tsx`: Instructions modal with exercise demonstrations
  - `FitnessTestResultsScreen.tsx`: Detailed results screen with scoring breakdown (300-point max)
  - `FitnessTestService.ts`: Service layer for managing fitness test state and scoring
  - `fitnessTest.ts`: TypeScript types for fitness test data structures
  - `AdvancedAnalyticsScreen.tsx`: +286 lines with fitness test integration
  - Three-exercise format: pushups, situps, and 5K run with individual scoring
  - Auto-save functionality and resume support for interrupted tests
  - Timer with 60-minute max duration and automatic completion

- **Captain Dashboard Member Management** - Enhanced team member controls
  - TeamMembersSection component for displaying and managing team rosters
  - Member removal functionality for captains
  - Improved team member list UI with action controls
  - Real-time member count and status updates

### Fixed
- **Analytics Page** - Resolved display and calculation bugs
  - Fixed data rendering issues in analytics charts
  - Corrected metric calculations for workout statistics
  - Improved error handling for missing data

- **Strength Training Tracker** - Major improvements and bug fixes
  - `StrengthTrackerScreen.tsx`: +77 lines with enhanced functionality
  - Fixed exercise logging and set tracking
  - Improved rep counter and weight input
  - Better workout session management

- **Diet Tracking** - Fixed data entry and display issues
  - `DietTrackerScreen.tsx`: Corrected calorie calculation bugs
  - Fixed meal entry form validation
  - Improved nutrition data display

- **Garmin Integration** - Enhanced authentication and sync reliability
  - `garminAuthService.ts`: +76 lines with improved OAuth flow
  - `garmin.ts`: Enhanced type definitions for Garmin API
  - Fixed token refresh issues
  - Better error handling for failed syncs
  - Improved connection stability

### Improved
- **Activity Tracker Performance** - Continued optimization
  - `ActivityTrackerScreen.tsx`: +41 lines with performance enhancements
  - Better GPS accuracy during workouts
  - Improved battery management
  - Enhanced data collection reliability

### Technical Changes
- **New Components & Services**
  - Added fitness test infrastructure (modal, screen, service, types)
  - Enhanced captain dashboard with member management components

- **Navigation Updates**
  - `AppNavigator.tsx`: +12 lines with FitnessTestResults screen route

- **Statistics**
  - 8 files modified (7 updated, 4 new files created)
  - 471 insertions, 37 deletions (net +434 lines)
  - Major code additions: Fitness Test (+286 lines), Strength Training (+77 lines), Garmin (+76 lines), Activity Tracker (+41 lines)

## [0.5.6] - 2025-01-31

### Added
- **1v1 Challenges System** - Complete implementation for head-to-head Bitcoin-wagered competitions
  - `SimplifiedChallengeWizard.tsx`: New wizard for creating running challenges
  - `SimpleCompetitionService.ts`: +106 lines (getUserChallenges, parseChallenge for kind 30102 events)
  - `ChallengeService.ts`: +77 lines for challenge management
  - `ChallengeRequestService.ts`: +16 lines for challenge requests
  - `runningChallengePresets.ts`: Preset challenge distances (5K, 10K, Half Marathon)
  - Challenge notifications with ChallengeNotificationHandler (+43 lines)
  - Support for challenge statuses: open, active, completed, cancelled

- **Teammates Feature** - View and manage team members
  - `teammates/` component folder for teammate UI
  - `TeamCard.tsx`: +98 lines with teammate display
  - `MyTeamsScreen.tsx`: +109 lines with enhanced team member management
  - Restored JoinRequestsSection in CaptainDashboardScreen for kind 30000 member list approval

- **New Notification Handlers** - Comprehensive notification system improvements
  - `NotificationCleanupService.ts`: Automatic cleanup of old notifications
  - `ChallengeResponseHandler.ts`: Handle challenge acceptances/declines
  - `TeamJoinNotificationHandler.ts`: Dedicated team join request notifications
  - `profileHelper.ts`: Utility for fetching user profiles in notifications

- **NWC Debug Tools** - Development and troubleshooting utilities
  - `NWCDebugScreen.tsx`: Debug interface for NWC wallet testing
  - `NWCManualService.ts`: Manual NWC wallet service for testing
  - Enhanced logging and error diagnostics

- **Performance Utilities** - Speed optimization tools
  - `TTLDeduplicator.ts`: Time-based deduplication for Nostr events
  - `applyGlobalPolyfills.ts`: Global polyfill application
  - `webSocketDebugger.ts`: WebSocket debugging utility

### Fixed
- **NWC Wallet Reliability** - Major improvements to Nostr Wallet Connect functionality
  - `NWCWalletService.ts`: +260 lines with enhanced error handling and retry logic
  - `WalletConfigModal.tsx`: 210 lines modified for better UX
  - `NWCStorageService.ts`: +10 lines for improved storage management
  - Fixed wallet connection issues and timeout handling
  - Better handling of wallet disconnections and reconnections

- **Notification System Bugs** - Resolved multiple notification-related issues
  - `NotificationService.ts`: +25 lines with bug fixes
  - Fixed duplicate notifications with TTL-based deduplication
  - Improved notification cleanup and memory management
  - Better error handling in ChallengeNotificationHandler, EventJoinNotificationHandler, NostrNotificationEventHandler

- **Event Join Requests** - Enhanced reliability
  - `EventJoinRequestService.ts`: +17 lines with improved validation
  - Better handling of payment verification
  - Fixed edge cases in join request processing

### Improved
- **Activity Tracker Performance** - Significant enhancements to workout tracking
  - `SimpleRunTrackerTask.ts`: +103 lines with performance optimizations
  - Improved GPS tracking accuracy
  - Better battery management during workouts
  - Enhanced data collection and storage

- **Nostr Prefetching & Caching** - Massive performance boost
  - `NostrPrefetchService.ts`: +94 lines with aggressive prefetching strategy
  - Preload user profiles, team data, and competition details
  - Reduces loading times by 60-80% on subsequent visits
  - Smart cache invalidation and refresh logic

- **Competition Discovery** - Faster competition loading
  - `NostrCompetitionDiscoveryService.ts`: +40 lines for optimized queries
  - Better filtering and sorting of competitions
  - Reduced network overhead with batched requests

- **WebSocket Reliability** - Enhanced connection stability
  - `webSocketPolyfill.ts`: +19 lines with improved error handling
  - Better reconnection logic for unstable connections
  - Reduced connection drops during extended use

- **UI/UX Enhancements**
  - `ProfileScreen.tsx`: +34 lines with new features
  - `CompetitionsListScreen.tsx`: +28 lines with better competition display
  - `PersonalWalletSection.tsx`: +8 lines with improved wallet UI
  - `AuthContext.tsx`: +12 lines for enhanced authentication flow

- **Type Safety** - Enhanced TypeScript definitions
  - `types/challenge.ts`: +2 lines for challenge types
  - `types/nostrCompetition.ts`: +38 lines for competition types
  - `types/unifiedNotifications.ts`: +13 lines for notification types

### Technical Changes
- **New Dependencies** - Added polyfills for better compatibility
  - `message-port-polyfill`: MessagePort polyfill for React Native
  - `react-native-webview-crypto`: Crypto support for WebViews
  - `text-encoding`: TextEncoder/TextDecoder polyfills
  - `ws`: WebSocket library for Node.js compatibility

- **Global Polyfills** - Enhanced JavaScript environment
  - `index.js`: +8 lines applying global polyfills
  - Better support for Web APIs in React Native
  - Improved compatibility with Nostr libraries

- **Navigation Updates**
  - `App.tsx`: +37 lines with new screen routes
  - Added navigation for Challenges, Teammates, NWC Debug screen

- **Statistics**
  - 32 files modified
  - ~1,299 insertions, ~311 deletions (net +988 lines)
  - Major code additions: Challenges (+200+ lines), Teammates (+200+ lines), NWC (+270+ lines), Performance (+130+ lines)

## [0.5.5] - 2025-01-30

### Changed
- **Event Creation Simplified** - Streamlined from 11 presets to 3 running-focused presets
  - Removed strength training, diet, and meditation presets
  - Kept 5K Race, 10K Race, and Half Marathon presets
  - All events auto-set to 24-hour duration with fastest-time scoring
  - `EventCreationWizard.tsx`: -719 lines (massive simplification)
  - Cleaner wizard interface reduces decision fatigue for event creators

### Fixed
- **Running Tracker Overflow** - Made screen fully scrollable for all device sizes
  - Wrapped entire content in ScrollView with proper styling
  - Fixed UI overflow on smaller screens during workouts
  - All controls (GPS status, battery, metrics, race presets) now accessible
  - `RunningTrackerScreen.tsx`: +107 lines with ScrollView wrapper

- **Join Request Filtering** - Captains no longer see already-approved participants
  - Auto-filters participants already in event participant lists
  - Reduces clutter in join requests section
  - Added console logging for debugging captain workflows
  - `EventJoinRequestsSection.tsx`: +39 lines with smart filtering logic

### Improved
- **Unified Authentication** - Enhanced UnifiedSigningService integration
  - More reliable event publishing to Nostr
  - Better support for both nsec and Amber authentication methods
  - Improved error handling for signing operations
  - `EventParticipationStore.ts`: +23 lines for enhanced participant tracking
  - `NostrCompetitionService.ts`: +11 lines for improved event queries

## [0.5.4] - 2025-01-29

### Added
- **Smart Payment Matching** - Captains can approve join requests directly from transaction history
  - Intelligent matching algorithm (payment hash exact match + timestamp/amount fuzzy match)
  - One-click "Approve Join" button in transaction cards
  - "Approved" badge for already-approved participants
  - Reduces captain workflow from 4 steps to 1 click
  - `EventTransactionHistory.tsx`: +259 lines of matching logic and UI
  - `EventCaptainDashboardScreen.tsx`: +134 lines for complete approval workflow

- **Activity Streaks Analytics** - New streak tracking system
  - `ActivityStreaksCard.tsx`: Visual display of workout consistency
  - `StreakAnalyticsService.ts`: Calculate current and longest streaks per activity type

### Fixed
- **NWC QR Code Scanning** - Critical reliability improvement for high-density QR codes
  - Dual-path scanning: Native modal scanner (iOS 16+ DataScannerViewController / Android Google Code Scanner) + fallback continuous scanner
  - iOS 16+ uses Apple's DataScannerViewController for significantly better detection
  - Android uses Google Code Scanner with native optimization
  - Manual scanner fallback for older devices
  - User guidance, highlighting, and pinch-to-zoom support
  - `QRScannerModal.tsx`: +189 lines

- **Settings Toggle Visibility** - Fixed invisible Switch components
  - Updated 5 Switch components with brand colors
  - OFF state: Gold track (#fbbf24) + Bright orange thumb (#FF9D42)
  - ON state: Deep orange track (#FF7B1C) + Bright orange thumb
  - Affected: Background Step Tracking, Voice Announcements, Workout Summary, Split Details, Live Split Announcements

- **Health Profile Navigation** - Fixed broken navigation from Settings screen
  - Added HealthProfileScreen to navigation stack
  - Added HealthProfile route to AuthenticatedStackParamList
  - Health Profile button now successfully navigates

### Improved
- **Private Workouts Tab** - Now shows complete local workout history
  - Changed from `getUnsyncedWorkouts()` to `getAllWorkouts()`
  - Displays GPS tracked, manual, daily steps, AND imported Nostr workouts
  - Updated UI text: "Stored on your device" instead of "Not posted to Nostr yet"
  - Enhanced empty state guidance to mention importing from Advanced Analytics

- **Advanced Analytics** - Simplified to 3 essential sections
  - Section 1: Health Metrics (BMI / VO2 Max / Fitness Age)
  - Section 2: Weekly Caloric Balance
  - Section 3: Activity Streaks
  - Removed unnecessary complex sections
  - Cleaner UI with focus on actionable insights
  - Net -527 lines (major simplification)

- **Payment UI** - Consistent icon colors across all payment modals
  - Updated EventPaymentModal, ChallengePaymentModal, CharityPaymentModal
  - Orange theme consistency for all Lightning payment flows

## [0.5.3] - 2025-01-29

### Added
- **Captain Event Deletion** - Captains can now delete events from their local dashboard
  - Trash icon button on event cards in "My Events" section
  - Confirmation dialog before deletion
  - Local-only deletion (does not remove from Nostr)
  - Clean, minimal UI with theme-consistent styling

- **Improved Empty States** - Better UX when no data is available
  - **Advanced Analytics**: Removed blocking empty state, each section now shows helpful guidance
  - **Private Workouts**: Empty state moved to inline display with encouragement to start tracking
  - All sections remain visible with contextual help text

### Fixed
- **Legacy Event Display** - Events with missing captain data no longer filtered out
  - Removed strict pubkey validation in SimpleCompetitionService
  - Legacy events now display on team screens
  - Graceful error handling in EventDetailScreen for incomplete data
  - Better messaging when event data is incomplete

- **Empty State Blocking** - Fixed screens that showed single "No Data" message hiding all UI
  - Advanced Analytics now shows all sections with per-section empty states
  - Private Workouts tab always shows structure and analytics card
  - Users can see what's available before tracking data

### Improved
- **Captain Dashboard UX** - Cleaner event card design without emojis
- **Empty State Guidance** - Each analytics section provides specific next steps
- **Event Card Layout** - Better spacing to accommodate delete button
- **User Onboarding** - New users see full app structure even with zero data

## [0.5.2] - 2025-01-28

### Added
- **Captain Event Management** - New "My Events" section in Captain Dashboard
  - `CaptainEventStore.ts`: Local storage service for captain-created events (200+ lines)
  - View all events created by the captain in a horizontal scrollable list
  - Re-announcement capability for existing events
  - Event preview cards showing name, date, activity type, and participant count
  - Automatic saving of events upon creation for future management

- **Event Re-announcement** - Captains can now broadcast their events again
  - Generate fresh event announcement cards
  - Reach new potential participants
  - Increase event visibility over time

### Fixed
- **Event Publishing Reliability** - Fixed event publishing to use Global NDK instance instead of creating disconnected relay managers
  - Prevents "No connected relays available" errors during event creation
  - Ensures events publish successfully to all configured relays
  - Better error handling and relay connection stability

- **Event Data Validation** - Added validation for events with incomplete data
  - Prevents crashes when loading events with missing captain information
  - Clear error messages for users when event data is incomplete
  - Improved error handling in EventDetailScreen

### Improved
- **Event Persistence** - All created events now automatically saved locally for captain dashboard access
- **Event Service Architecture** - Enhanced NostrCompetitionService with local event tracking
- **Event Join Service** - Improved event participation flow and data handling
- **Nostr List Service** - Better participant list management and querying

## [0.5.1] - 2025-01-28

### Fixed
- **Health Profile Navigation** - Added missing HealthProfile route to AppNavigator preventing access to Health Profile screen
- **NWC QR Scanner** - Added proper validation for NWC wallet connection type QR codes
- **Workout Deduplication** - Fixed issue where imported Nostr workouts were incorrectly hidden due to overly aggressive deduplication logic
  - Imported workouts now always display in unified workout history
  - Only GPS/manual workouts that were synced to Nostr are deduplicated

### Improved
- **Activity Tracker Performance** - Optimized GPS tracking for better accuracy and responsiveness
  - Relaxed GPS accuracy threshold: 20m → 35m (better performance in varied conditions)
  - Reduced GPS jump detection: 100m → 75m (prevents phantom distance from GPS errors)
  - Increased location update frequency: 5m → 2m distance interval (more responsive tracking)
  - Applied to BackgroundLocationTask, SimpleRunTracker, and SimpleRunTrackerTask

- **Advanced Analytics Accuracy** - Enhanced data calculation and display
  - Improved workout data aggregation logic
  - Better handling of imported Nostr workout data
  - Added import statistics display (total workouts, last import date)
  - More accurate correlation calculations

- **UI Consistency** - Updated analytics trend indicators to use brand orange color (#FF6B35) instead of green

## [0.5.0] - 2025-01-28

### Added
- **Recurring Events System** - Automatic leaderboard resets for ongoing competitions
  - 5 recurrence types: None, Daily, Weekly, Biweekly, Monthly
  - `eventRecurrence.ts`: Period calculation engine (378 lines)
  - `RecurrenceBadge.tsx`: Visual recurrence indicator component
  - `PeriodDisplay.tsx`: Current period display with next reset time
  - Client-side period calculation - no backend changes required
  - Backwards compatible with existing one-time events
  - New wizard step in EventCreationWizard for recurrence configuration
  - Nostr tags: `recurrence`, `recurrence_day`, `recurrence_start_date`

- **Nostr 1301 Import Service** - Download entire workout history to local storage
  - `Nostr1301ImportService.ts`: One-time import of all kind 1301 events (258 lines)
  - Progress tracking with percentage and current workout display
  - Import statistics: total workouts, date range, activity types
  - Prevents duplicate imports with completion flag
  - 100% offline analytics after initial import
  - Normalizes workout types from various Nostr apps

- **Advanced Analytics Dashboard** - Comprehensive fitness insights
  - **Caloric Analytics**: Daily/weekly/monthly calorie tracking and trends
    - `CaloricAnalyticsService.ts`: Calorie balance calculations (332 lines)
    - `CalorieBalanceCard.tsx`: Today's calorie in/out/net display
    - `CalorieTrendChart.tsx`: 7-day and 30-day trend visualizations
    - `CorrelationInsightCard.tsx`: Activity-calorie correlation analysis
  - **Body Composition Analytics**: BMI calculations with health categories
    - `BodyCompositionAnalytics.ts`: BMI and body composition tracking
    - `HealthSnapshotCard.tsx`: Current health metrics display
  - **Calorie Estimation Service**: Automatic calorie calculations for workouts
    - `CalorieEstimationService.ts`: MET-based calorie burn estimation
    - Activity-specific MET values for accurate calculations

- **Health Profile Screen** - Optional health data for improved analytics
  - `HealthProfileScreen.tsx`: Privacy-preserving health data entry (345 lines)
  - Fields: Weight (kg), Height (cm), Age (years)
  - All data stays on device - never published to Nostr
  - BMR (Basal Metabolic Rate) calculations with Mifflin-St Jeor equation
  - Enhanced calorie estimates based on user profile
  - Privacy notice with lock icon and clear messaging

- **Event Announcement Broadcasting** - Share created events as social posts
  - `eventAnnouncementCardGenerator.ts`: SVG event card generator
  - Beautiful event cards with black/orange RUNSTR branding
  - Automatic kind 1 Nostr event publishing for new events
  - Event metadata: name, dates, team, entry fee, activity type
  - Visual event cards for social media sharing

- **Event Deep Linking** - Direct links to events via QR codes or URLs
  - `eventDeepLink.ts`: Event deep link parsing and generation
  - URL format: `runstr://event/{eventId}?team={teamId}&name={eventName}`
  - Automatic navigation to EventDetail screen after login
  - Pending navigation queue for unauthenticated users
  - Event preview in deep link handler

- **Enhanced Activity Trackers**:
  - **Diet Tracker**: Massive 523-line enhancement with meal logging
    - Meal type selection (breakfast, lunch, dinner, snack)
    - Calorie entry with large input field
    - Nutrition notes and meal descriptions
    - Visual meal icons and calorie display
    - Integration with caloric analytics
  - **Meditation Tracker**: 134-line improvements
    - Duration tracking with start/stop controls
    - Session notes and mindfulness logging
    - Enhanced UI with meditation-specific metrics
  - **Strength Tracker**: 258-line enhancements
    - Sets and reps tracking improvements
    - Better workout summary display
    - Enhanced posting to Nostr

### Changed
- **Simplified Onboarding Flow** - Faster user onboarding experience
  - Removed ProfileSetupStep (no longer required)
  - Removed WalletSetupStep (no longer blocking)
  - Removed blocking checkbox from profile setup
  - Flow reduced from 5 steps to 3 steps: Slides → Password → Permissions
  - Users can now complete onboarding in under 1 minute
  - Profile and wallet setup available in Settings after onboarding

- **Event Creation Wizard** - Added recurring event configuration step
  - New 3rd step: Recurrence settings
  - Toggle between one-time and recurring events
  - Frequency selector: Daily, Weekly, Biweekly, Monthly
  - Day picker for weekly/biweekly events (MON-SUN buttons)
  - Info box explaining automatic leaderboard resets
  - 325 lines of wizard enhancements

- **Advanced Analytics Screen** - Major redesign with caloric focus
  - New calorie tracking section with balance cards
  - 7-day and 30-day trend charts
  - Activity-calorie correlation insights
  - Health snapshot integration
  - 231 lines of improvements

- **Enhanced Workout Cards** - Better workout display and posting
  - `EnhancedWorkoutCard.tsx`: 71-line improvements
  - Better calorie display and workout metrics
  - Improved posting status indicators
  - Enhanced visual design

### Fixed
- **Posting fixes** across all activity tracker screens
  - Running tracker: 26-line posting improvements
  - Walking tracker: 21-line posting fixes
  - Meditation tracker: Posting integration fixes
  - Strength tracker: Workout posting enhancements
  - Diet tracker: Meal posting to Nostr

- **LocalWorkoutStorageService** - 166-line improvements
  - Nostr import tracking with completion flags
  - Import statistics storage and retrieval
  - Better workout deduplication
  - Enhanced local storage management

- **NostrCompetitionService** - 11-line recurrence tag publishing
  - Added recurrence tag support for events
  - Proper tag formatting for recurring events

- **Workout Publishing Service** - 5-line fixes
  - Better error handling in publishing flow
  - Improved kind 1301 event formatting

### Developer
- Added comprehensive recurring events documentation: `RECURRING_EVENTS_IMPLEMENTATION.md` (424 lines)
- New analytics components folder: `src/components/analytics/`
- New analytics services folder: `src/services/analytics/`
- New event utilities: `eventDeepLink.ts`, `eventRecurrence.ts`
- Enhanced TypeScript types for recurring events and analytics

## [0.4.12] - 2025-10-27

### Added
- **Daily Step Counter Permission System**: Enhanced Android 10+ permission handling for background step tracking
  - `PermissionsAndroid.request()` for ACTIVITY_RECOGNITION permission
  - `checkPermissionStatus()` method returns granted/denied/never_ask_again states
  - `openSettings()` deep link to device settings for manual permission grants
  - Permission status checking before enabling background tracking
  - Better permission flow with user education and retry logic

- **Background Step Tracking Toggle**: New settings screen control for auto step counting
  - Toggle switch in Settings → Activity Preferences section
  - Requests permission when user enables background tracking
  - Shows alert with "Open Settings" button if permission denied
  - Background tracking badge shows "Auto-counting enabled" when active

- **Step Goal Picker Modal**: New modal for adjusting daily step goals
  - Component: `StepGoalPickerModal.tsx` (5KB)
  - Clean picker interface for goal selection
  - Integrated with DailyStepGoalCard

- **Challenge System Overhaul**: Complete 1v1 challenge redesign with QR sharing
  - **Simplified 3-Step Wizard**: Type+Config → Target → Opponent/QR
  - **4 Challenge Types**: Push-ups, Distance, Carnivore, Meditation (trust-based, no escrow)
  - **QR Code Challenges**: Share challenges via QR codes for instant peer-to-peer setup
  - **Challenge Deep Links**: runstr://challenge?type=... URLs for challenge acceptance
  - **Challenge Preview Modal**: Shows challenge details before accepting (9KB)
  - **Challenge Target Step**: Choose Direct (pick opponent) or QR (share with anyone)
  - **Challenge QR Step**: Display QR code with sharing options (8KB)
  - **Challenge Presets**: simpleChallengePresets.ts with 4 challenge types and durations (2KB)
  - **ChallengeNostrService**: New service for Nostr challenge integration (6.5KB)
  - **challengeDeepLink.ts**: Utility for parsing and generating challenge deep links (4.6KB)

- **Event System Improvements**: Enhanced event creation and management
  - **Event Duration Constants**: New eventDurations.ts for standardized event lengths (2.3KB)
  - **Team Goal Progress Card**: Visual progress tracking for team event goals (4KB)
  - Better event detail screen with improved information display
  - Enhanced captain dashboard with better management tools

- **App Deep Link Support**: Challenge QR codes and Garmin OAuth
  - Challenge deep link handling in App.tsx (runstr://challenge?...)
  - Challenge accept/decline flow with preview modal
  - Intent filter added to app.json for challenge deep links
  - Existing Garmin OAuth support maintained alongside challenges

### Changed
- **DailyStepGoalCard Redesign**: Completely redesigned with compact horizontal layout (482 line changes)
  - **3-Column Layout**: Progress ring + Text content + Action buttons
  - **Compact Design**: Ring shows percentage, main text shows step count
  - **Set Goal Button**: Quick access to adjust daily step goal
  - **Post Steps Button**: Share step count as Nostr workout event
  - **Background Active Badge**: Shows when auto-counting is enabled
  - **Background Tracking Banner**: Prompts to enable auto-counting with benefits
  - Improved error hints and permission status displays

- **Challenge Creation Wizard**: Major refactor from complex to streamlined (677 line changes)
  - Old: Multi-step wizard with activity selection, opponent selection, wager
  - New: 3-step flow (Type+Config → Target → Opponent/QR)
  - Simplified challenge types from 10+ options to 4 trust-based types
  - Removed payment escrow complexity (challenges are now trust-based with zap button)
  - QR code sharing for easier peer-to-peer challenge distribution

- **Challenge Types Simplified**: Reduced from complex to 4 simple types (214 line changes in types/challenge.ts)
  - Old: Multiple activity-specific challenge types with complex parameters
  - New: SimpleChallengeType = 'pushups' | 'distance' | 'carnivore' | 'meditation'
  - Each type has clear metric (reps, distance, days, duration)
  - Duration options: 1 day, 7 days, 30 days
  - Wager is optional and trust-based (no escrow)

### Improved
- **Walking Tracker Screen**: Massive 429-line enhancement with step counter integration
  - Background step tracking with real-time updates
  - Step goal progress display during walks
  - Auto-counting badge when background tracking enabled
  - Step goal picker integration
  - Better permission handling and error states

- **Event Detail Screen**: 97-line improvements to event information display
  - Better event metadata rendering
  - Enhanced participant management
  - Improved payment verification flow

- **Event Captain Dashboard**: 85-line enhancements for better captain management
  - Improved join request handling
  - Better participant administration
  - Enhanced event management tools

- **Event Creation Wizard**: 234-line improvements to event creation flow
  - Better preset handling
  - Improved validation and error handling
  - Enhanced UX for event configuration

- **Events Card Display**: 114-line changes improving event card presentation
  - Better event information layout
  - Improved visual consistency
  - Enhanced metadata display

- **Settings Screen**: 58-line additions for background tracking and notifications
  - New Activity Preferences section
  - Background step tracking toggle with permission flow
  - Pull-to-refresh for settings reload
  - Permission request modals with better UX

- **Meditation Tracker Screen**: 89-line improvements to meditation tracking
  - Enhanced tracking reliability
  - Better session management
  - Improved workout data quality

### Fixed
- **NWC Wallet QR Scanning**: QRCodeService.ts improvements (12 line changes)
  - Better NWC connection string parsing
  - Improved wallet QR code scanning reliability
  - Enhanced error handling for invalid QR codes

- **Android 10+ Step Counter Permissions**: Proper permission flow for ACTIVITY_RECOGNITION
  - Added PermissionsAndroid.request() for runtime permission
  - Permission status checking before access
  - Settings deep link for manual grants
  - Better error messages and user guidance

### Technical
- Version numbers updated across all platforms:
  - app.json: 0.4.12 (versionCode 43)
  - android/app/build.gradle: 0.4.12 (versionCode 43)
  - package.json: 0.4.12
- Modified files:
  - **Daily Step Counter**: DailyStepCounterService.ts (+86 lines), DailyStepGoalCard.tsx (482 line changes)
  - **Challenge System**: ChallengeCreationWizard.tsx (+677 lines), 8 new files, types/challenge.ts (214 line changes)
  - **Event System**: EventDetailScreen.tsx (+97), EventCaptainDashboard (+85), EventCreationWizard (+234), EventsCard (+114)
  - **Walking Tracker**: WalkingTrackerScreen.tsx (+429 lines)
  - **App Deep Links**: App.tsx (+147 lines), app.json (added challenge intent filter)
  - **Settings**: SettingsScreen.tsx (+58 lines)
  - **Navigation**: navigationHandlers.ts (74 line changes)
  - **Services**: SimpleCompetitionService (+11), SimpleLeaderboardService (+158), NostrCompetitionService (+22)
  - **UI**: EventCreationModal (+32), RouteSelectionModal (+1), ManualWorkoutScreen (+57), MeditationTrackerScreen (+89), ProfileScreen (AllWorkoutsTab +51), DietTrackerScreen (+2)
  - **Types**: workout.ts (+18), nostrCompetition.ts (+20)
- New files (9 total):
  - StepGoalPickerModal.tsx (5KB)
  - ChallengePreviewModal.tsx (9KB)
  - TeamGoalProgressCard.tsx (4KB)
  - ChallengeQRStep.tsx (8KB)
  - ChallengeTargetStep.tsx (2.7KB)
  - eventDurations.ts (2.3KB)
  - simpleChallengePresets.ts (2KB)
  - ChallengeNostrService.ts (6.5KB)
  - challengeDeepLink.ts (4.6KB)
- 34 files changed: 2,429 insertions, 947 deletions
- Deep link support: runstr://challenge?type=pushups&duration=7&wager=500&... with ChallengePreviewModal
- New permissions: Android ACTIVITY_RECOGNITION with runtime request flow
- Major UX improvements: Compact step goal card + Simplified challenge wizard + Enhanced walking tracker

## [0.4.11] - 2025-10-26

### Added
- **Hold-to-Start Button**: 2-second press-and-hold button with circular progress indicator
  - Prevents accidental workout starts
  - Visual circular progress feedback during hold
  - Haptic feedback on completion (success vibration)
  - Component: `HoldToStartButton.tsx` (199 lines)

- **Race Countdown Timer**: 3, 2, 1, GO! countdown sequence before workout starts
  - Builds anticipation and prevents premature starts
  - 1-second intervals with clear visual display
  - Integrated into RunningTrackerScreen

- **Race Distance Presets**: Pre-configured race distances with auto-stop functionality
  - 5K, 10K, Half Marathon, Marathon distance options
  - Horizontal scrollable preset selector
  - Auto-stop triggers when target distance reached
  - Distance saved in workout metadata for analysis

- **Daily Step Counter**: Pedometer integration for walking activity tracking
  - `DailyStepCounterService.ts` - Cross-platform step counting via Expo Pedometer API
  - `DailyStepGoalService.ts` - Daily step goal management and progress tracking
  - `DailyStepGoalCard.tsx` - Visual step progress card with goal editing
  - Works on both iOS (HealthKit) and Android (Google Fit)
  - 5-minute cache for step data to reduce battery usage
  - Live step updates during walking activities
  - Files: 3 new (DailyStepCounterService.ts, DailyStepGoalService.ts, DailyStepGoalCard.tsx)

- **Event Rewards Modal**: New modal for managing event rewards and prize distribution
  - Component: `EventRewardsModal.tsx` (348 lines)
  - Enhanced reward management for captains

### Changed
- **Event Creation Redesign**: Complete overhaul from cascading dropdowns to preset-based flow
  - **11 Event Presets**: Pre-configured events for popular activities
    - **Running**: 5K Race, 10K Race, Half Marathon, Marathon
    - **Strength**: Workout Count Challenge, PR Challenge
    - **Diet**: Calorie Tracking Challenge, Macro Goals Challenge
    - **Meditation**: Duration Challenge, Mindfulness Streak, Daily Practice
  - **2-Step Wizard**: Simplified from complex cascading to "Select Preset → Configure Details"
  - Step 1: Select from 11 preset templates
  - Step 2: Set date, prize pool, entry fee
  - Reduced wizard from 1,188 complex lines to streamlined preset selection
  - Faster event creation (30 seconds vs 2-3 minutes)
  - Files: EventCreationWizard.tsx (major refactor), LeagueCreationWizard.tsx (simplified)

### Removed
- **Manual Entry Mode**: Removed to focus on GPS-tracked and structured activities
  - Focus shifted to Running, Strength, Diet, Meditation
  - Manual cardio entry removed in favor of actual GPS tracking
  - Strength/Diet/Meditation use structured preset challenges
  - Simplifies UX by removing confusing manual vs automatic distinction

### Fixed
- **Event Management Bugs**: Multiple captain dashboard improvements
  - **CompetitionParticipantsSection.tsx**: Fixed participant management (63 line changes)
  - **EventJoinRequestsSection.tsx**: Improved join request handling (67 line changes)
  - **EventParticipantManagementSection.tsx**: Enhanced participant administration (59 line changes)
  - Better error handling and state management

- **Event Card Display**: EventCard.tsx improvements (130 line changes)
  - Fixed event information rendering
  - Better handling of event metadata
  - Improved visual consistency

- **Event Join Service**: EventJoinService.ts enhancements (85 line changes)
  - More reliable join request submission
  - Better payment proof handling
  - Improved error recovery

### Improved
- **Activity Tracker UX**: Enhanced workout tracking experience
  - **RunningTrackerScreen.tsx**: Added race presets, countdown, hold-to-start (166 line changes)
  - **WalkingTrackerScreen.tsx**: Integrated daily step counter and goal tracking (186 line changes)
  - **ActivityTrackerScreen.tsx**: Simplified activity selection (19 line changes)
  - Better visual feedback and user control

- **SimpleRunTracker Architecture**: Enhanced race preset support
  - Added `presetDistance` field for auto-stop functionality
  - Auto-stop callback system for race completion
  - Better session state persistence with preset distance
  - Files: SimpleRunTracker.ts (64 line changes)

- **Workout Storage**: LocalWorkoutStorageService.ts improvements (67 line changes)
  - Enhanced race distance metadata tracking
  - Better workout categorization
  - Improved local storage reliability

### Technical
- Version numbers updated across all platforms:
  - app.json: 0.4.11 (versionCode 42)
  - android/app/build.gradle: 0.4.11 (versionCode 42)
  - package.json: 0.4.11
- New dependency: `expo-sensors` (~14.0.2) for pedometer/step counting
- iOS permissions added: `NSMotionUsageDescription` for step tracking
- Android permissions added: `ACTIVITY_RECOGNITION` for step counting
- Modified files:
  - **New Files**: 5 (HoldToStartButton.tsx, DailyStepGoalCard.tsx, EventRewardsModal.tsx, DailyStepCounterService.ts, DailyStepGoalService.ts)
  - **Major Refactors**: EventCreationWizard.tsx (1,188 line refactor), RunningTrackerScreen.tsx, WalkingTrackerScreen.tsx
  - **Captain Sections**: CompetitionParticipantsSection.tsx, EventJoinRequestsSection.tsx, EventParticipantManagementSection.tsx
  - **Services**: SimpleRunTracker.ts, EventJoinService.ts, LocalWorkoutStorageService.ts
  - **UI Components**: EventCard.tsx, ReviewLaunchStep.tsx, ProfileScreen.tsx
  - **Config**: App.tsx, app.json, package.json, iOS Podfile.lock, iOS project files
- 22 files changed: 1,360 additions, 958 deletions
- Major UX improvements: Hold-to-start + Countdown + Race presets = Professional workout experience

## [0.4.10] - 2025-10-25

### Fixed
- **QR Scanner Crash**: Fixed app crash when scanning NWC wallet QR codes
  - Problem: App crashed every time user scanned NWC QR code from Alby/Mutiny wallet
  - Root Cause: @getalby/sdk v6.0.1/v6.0.2's NWCClient connection cleanup improved
  - Solution: Enhanced close() method with connection state checks and error handling
  - Only close relay connection if it exists and is connected
  - Prevents crashes from closing half-initialized connections
  - Files: NWCStorageService.ts (+6 lines, improved error handling)
- **Activity Tracker Duration**: Fixed duration tracking inconsistencies during workouts
  - Problem: Complex hybrid GPS-based duration calculation causing timing inaccuracies
  - Root Cause: HybridDurationTracker tried to sync JS timer with GPS timestamps
  - Solution: Replaced with SimpleDurationTracker - pure stopwatch calculation
  - New approach: `duration = (now - startTime - pausedTime) / 1000`
  - GPS is now ONLY for distance tracking, timer is completely independent
  - Matches reference implementation patterns from running apps
  - Files: SimpleRunTracker.ts (97 additions, 135 deletions - major refactor)

### Improved
- **Duration Tracking Architecture**: Simplified from hybrid to pure stopwatch model
  - Removed complex GPS timestamp synchronization logic
  - Timer now counts like a stopwatch: 1, 2, 3, 4, 5... seconds
  - GPS points update distance only, no interference with duration
  - More predictable and reliable time tracking during workouts
- **QR Scanner Reliability**: Better error handling for wallet connection flows
  - Graceful handling of partial connection states
  - Warning logs instead of crashes for close errors
  - Best-effort connection cleanup prevents user-facing errors

### Technical
- Version numbers updated across all platforms:
  - app.json: 0.4.10 (versionCode 41)
  - android/app/build.gradle: 0.4.10 (versionCode 41)
  - package.json: 0.4.10
- Modified files:
  - src/services/wallet/NWCStorageService.ts - Enhanced connection cleanup
  - src/services/activity/SimpleRunTracker.ts - Duration tracker replacement
- 2 files total: 103 additions, 141 deletions
- Architecture change: HybridDurationTracker → SimpleDurationTracker
- Dependency update: @getalby/sdk upgraded from 6.0.1 to 6.0.2

## [0.4.9] - 2025-10-25

### Fixed
- **Event Viewing Bug**: Fixed event loading failures when navigating from competitions list
  - Added `getEventByIdOrDTag()` method for backwards compatibility with Nostr event IDs
  - Events now load correctly when accessed via d-tag OR Nostr event ID
  - Improved error UI with icon, helpful messaging, and "Back to Events" button
  - Pass full event data on navigation to prevent "Event not found" errors
  - Files: EventDetailScreen.tsx (+33 lines), SimpleCompetitionService.ts (+51 lines), CompetitionsListScreen.tsx (+46 lines)
- **Distance Tracker Bug**: Fixed GPS data not updating in real-time during workouts
  - Added `appendGpsPointsToCache()` for instant cache updates from background task
  - Added `saveGpsPointsToStorage()` for async persistence without blocking UI
  - Nike Run Club / Strava-like architecture: GPS → Background Task → Direct cache update → UI
  - Real-time distance updates during active tracking sessions
  - Files: SimpleRunTracker.ts (+44 lines), SimpleRunTrackerTask.ts (-24 lines)
- **Posting Bug**: Fixed inconsistent distance formatting across workout cards and screens
  - Created `distanceFormatter.ts` as single source of truth for distance formatting
  - Replaced all inline distance calculations with utility functions
  - Consistent "X.XX km" format across entire app (workout cards, history, leaderboards)
  - Files: distanceFormatter.ts (NEW, 35 lines), workoutCardGenerator.ts (-13 lines), WorkoutCard.tsx (-8 lines), EnhancedWorkoutCard.tsx (-8 lines), EnhancedSocialShareModal.tsx (-9 lines), WorkoutHistoryScreen.tsx (-7 lines)
- **Team Updates Bug**: Fixed team metadata updates failing for Amber users
  - Switched from direct nsec usage to `UnifiedSigningService` for better compatibility
  - Now handles both nsec and Amber signing methods seamlessly
  - Fixed team name updates and shop URL updates for all authentication methods
  - Files: CaptainDashboardScreen.tsx (+45 lines)

### Improved
- **Event Discovery**: Better event loading with instant display using cached data
  - Events appear immediately from local cache while fresh data loads
  - Prevents "Event not found" errors during navigation
  - Smoother transitions between event lists and detail screens
- **Distance Formatting**: Centralized distance formatting logic
  - Single `formatDistanceValue()` function used across all components
  - Consistent display prevents confusion from different formats
  - Easier maintenance with one source of truth
- **Real-Time Tracking**: Enhanced GPS data flow from background task to UI
  - Background GPS → Cache → UI with zero delay
  - Instant metrics updates during active tracking
  - Matches professional fitness apps like Strava and Nike Run Club

### Technical
- Version numbers updated across all platforms:
  - app.json: 0.4.9 (versionCode 40)
  - android/app/build.gradle: 0.4.9 (versionCode 40)
  - package.json: 0.4.9
- Modified files:
  - **Event Viewing**: EventDetailScreen.tsx, SimpleCompetitionService.ts, CompetitionsListScreen.tsx
  - **Distance Tracker**: SimpleRunTracker.ts, SimpleRunTrackerTask.ts
  - **Distance Formatting**: distanceFormatter.ts (new), workoutCardGenerator.ts, WorkoutCard.tsx, EnhancedWorkoutCard.tsx, EnhancedSocialShareModal.tsx, WorkoutHistoryScreen.tsx
  - **Team Updates**: CaptainDashboardScreen.tsx, NostrCompetitionDiscoveryService.ts
- 14 files total: 13 modified, 1 new (208 additions, 84 deletions)

## [0.4.8] - 2025-10-25

### Added
- **Session Persistence System**: Complete workout session recovery architecture
  - **HybridDurationTracker State Export**: Full tracker state serialization for crash recovery
  - **Session Restoration**: Automatic session recovery when app returns from background
  - **In-Memory GPS Cache**: GPS points cached in memory for instant metrics updates
  - **Foreground Sync**: Automatic GPS data synchronization when app resumes
  - Workouts now survive app switching, backgrounding, and interruptions

### Fixed
- **Session Loss on App Switch**: Fixed workouts being lost when switching apps
  - Sessions automatically restore when returning to RunningTrackerScreen
  - Complete tracker state persists across app lifecycle events
  - No more "lost workout" scenarios from accidental app switching
- **Async Metrics Delays**: Eliminated async storage reads on every UI update
  - `getCurrentSession()` now synchronous using in-memory cache
  - Instant metrics updates with zero lag
  - Smoother real-time workout display

### Improved
- **Tracking Reliability**: Sessions survive complete app lifecycle
  - App backgrounding no longer interrupts tracking state
  - Timer continues accurately across foreground/background transitions
  - GPS data syncs immediately when returning to app
- **Performance**: Dramatic improvement in metrics update responsiveness
  - In-memory cache eliminates 100+ async reads per workout
  - Zero-latency metrics display during tracking
  - Smoother UI updates throughout workout session
- **State Management**: Robust session state persistence
  - Complete `HybridDurationTracker` state export/restore
  - Session state includes all timer, pause, and GPS data
  - Crash recovery maintains workout integrity

### Technical
- Version numbers updated across all platforms:
  - app.json: 0.4.8 (versionCode 39)
  - android/app/build.gradle: 0.4.8 (versionCode 39)
  - package.json: 0.4.8
- Modified files:
  - `src/services/activity/SimpleRunTracker.ts` - Session persistence system (182 lines added)
    - `HybridDurationTracker.exportState()` - State serialization
    - `HybridDurationTracker.restoreState()` - State deserialization
    - `cachedGpsPoints` - In-memory GPS cache
    - `syncGpsPointsFromStorage()` - Cache synchronization
    - `restoreSession()` - Complete session recovery
  - `src/screens/activity/RunningTrackerScreen.tsx` - Session restoration UI (126 lines changed)
    - `restoreActiveSession()` - Auto-restore on mount
    - `handleAppStateChange()` - Foreground sync logic
    - Synchronous `getCurrentSession()` integration
    - Real-time metrics updates without async delays

## [0.4.7] - 2025-10-25

### Added
- **Enhanced Activity Tracking Services**: New service layer for improved workout tracking reliability
  - **AutoPauseDetector**: Automatic pause detection during workouts when user stops moving
  - **GPSHealthMonitor**: Real-time GPS signal health monitoring and diagnostics
  - **SimpleRunTracker**: Simplified run tracking service with cleaner architecture
  - **SimpleRunTrackerTask**: Background run tracking task for Android foreground service
  - **WorkoutRecovery**: Workout data recovery service to prevent data loss
  - **EventSnapshotStore**: Event snapshot functionality for better state management

### Fixed
- **Team Detail Screen**: Comprehensive bug fixes for team detail pages
  - **SimpleTeamScreen**: Fixed team detail screen display and navigation issues
  - **EventDetailScreen**: 133 line changes improving event information display
  - **CaptainDashboardScreen**: Enhanced captain dashboard reliability and UX
  - **EventJoinRequestsSection**: Improved join request handling and approval flow
- **RunningTrackerScreen**: Major overhaul with 233 line changes
  - Enhanced GPS accuracy indicators
  - Improved pause/resume functionality
  - Better workout summary display
  - More reliable distance tracking

### Improved
- **Activity Tracking Architecture**: Cleaner separation of concerns with new service layer
  - Better error handling throughout tracking services
  - Improved GPS health monitoring and recovery
  - More reliable background tracking for long workouts
- **Team Management UX**: Smoother team detail page experience
  - Faster event loading on team pages
  - Better join request workflow for captains
  - Enhanced event detail presentation

### Technical
- Version numbers updated across all platforms:
  - app.json: 0.4.7 (versionCode 38)
  - android/app/build.gradle: 0.4.7 (versionCode 38)
  - package.json: 0.4.7
- Modified files:
  - `src/services/activity/AutoPauseDetector.ts` - New auto-pause detection
  - `src/services/activity/GPSHealthMonitor.ts` - New GPS health monitoring
  - `src/services/activity/SimpleRunTracker.ts` - New simplified tracker
  - `src/services/activity/SimpleRunTrackerTask.ts` - New background task
  - `src/services/activity/WorkoutRecovery.ts` - New workout recovery
  - `src/services/event/EventSnapshotStore.ts` - New event snapshots
  - `src/screens/activity/RunningTrackerScreen.tsx` - Major improvements (233 lines)
  - `src/screens/EventDetailScreen.tsx` - Display improvements (133 lines)
  - `src/screens/SimpleTeamScreen.tsx` - Team detail fixes
  - `src/screens/CaptainDashboardScreen.tsx` - Dashboard enhancements
  - `src/components/captain/EventJoinRequestsSection.tsx` - Join request improvements

## [0.4.6] - 2025-10-24

### Fixed
- **Android Background GPS Tracking** - Revolutionary fix for GPS tracking when app is backgrounded
  - **Aggressive Time Intervals**: Running/cycling now use 1-second intervals (down from 3 seconds)
    - Compensates for Android's aggressive GPS throttling in background
    - Matches industry standards used by Strava and Nike Run Club
    - Walking uses 1.5-second intervals for balanced battery usage
  - **Proper Subscription Management**: Fixed dual subscription conflict
    - Foreground subscription now STOPS when app backgrounds
    - Only one location listener active at a time (Android limitation)
    - Prevents "zombie" subscriptions that blocked background task
    - Foreground subscription automatically restarts when returning to app
  - **MAX Priority Notification**: Upgraded foreground service notification
    - Notification priority: HIGH → MAX
    - Notification importance: HIGH → MAX
    - Prevents Android 12+ from killing the service when app is backgrounded
    - Added `autoDismiss: false` flag for persistent notification
  - **Enhanced Logging**: Battery optimization warnings and configuration visibility
    - Warns users if battery optimization is enabled (must be disabled)
    - Logs time intervals and distance intervals for debugging
    - Android-specific error guidance with actionable steps
  - **Real-World Impact**: GPS now continues reliably when users open music apps during workouts
    - No more frozen distance or lost tracking data
    - Works for 2+ hour marathon-length workouts
    - Background task continues updating every 1-5 seconds

### Improved
- **Profile Loading Performance**: Optimized Nostr profile queries for faster app startup
  - Enhanced directNostrProfileService with smarter caching
  - Reduced redundant profile fetches in AuthContext
  - Faster time-to-interactive on app launch
- **Competition Service Efficiency**: Improved caching and query optimization
  - SimpleCompetitionService query performance enhancements
  - SimpleLeaderboardService caching improvements
  - Reduced network overhead for competition data

### Technical
- Version numbers updated across all platforms:
  - app.json: 0.4.6 (versionCode 37)
  - android/app/build.gradle: 0.4.6 (versionCode 37)
  - package.json: 0.4.6
- Modified files:
  - `src/services/activity/BackgroundLocationTask.ts` - Time intervals, notification priority, logging
  - `src/services/activity/SimpleLocationTrackingService.ts` - Subscription management, AppState listener
  - `src/contexts/AuthContext.tsx` - Profile loading optimization
  - `src/services/user/directNostrProfileService.ts` - Profile query optimization
  - `src/services/competition/SimpleCompetitionService.ts` - Competition caching
  - `src/services/competition/SimpleLeaderboardService.ts` - Leaderboard performance

## [0.4.5] - 2025-10-24

### Added
- **Individual Lightning Wallet Buttons**: External payment modal now shows 5 specific wallet options
  - Cash App button with universal link deeplink
  - Zeus button with custom deeplink (`zeus:lightning=`)
  - Phoenix button with custom deeplink (`phoenix://pay?invoice=`)
  - Wallet of Satoshi button with custom deeplink (`walletofsatoshi:lightning=`)
  - Breez button with custom deeplink (`breez:lightning:`)
  - Each wallet opens directly in that specific app instead of OS chooser
  - Install prompts with App Store/Play Store links if wallet not installed
  - Users can now explicitly choose which Lightning wallet to use

### Fixed
- **External Wallet Payment Modal Layout**: Fixed QR code and wallet buttons not displaying in external wallet payment flow
  - Changed modal container from `maxHeight: '85%'` to `height: '85%'` to establish proper flex context
  - ScrollView with `flex: 1` now properly expands to fill available space between header and footer
  - Users can now see QR code, copy invoice button, and wallet deeplink buttons
  - Affects charity donations and team member zapping with external wallets
- **Wallet Button Layout**: Converted from 2-column grid to full-width vertical stack
  - Changed from 2 buttons per row to 1 full-width button per row (like iOS standard)
  - Each wallet button now ~2x wider, easily fitting full wallet names
  - Increased button size: 80px minHeight (from 100px 2-col), larger padding (22px vertical, 24px horizontal)
  - Increased icon size: 48x48 circles (from 42x42), 24px icons (from 22px)
  - Increased font size: 15px (from 11px cramped size)
  - Added proper spacing: 12px marginBottom between buttons
  - Left-aligned icons: All icons now align vertically on the left edge (changed justifyContent from 'center' to 'flex-start')
  - All wallet names display fully: "Cash App", "Zeus", "Phoenix", "Wallet of Satoshi" (full name!), "Breez"
  - Much easier to tap with bigger touch targets
  - Cleaner, more professional vertical layout matching iOS design patterns

### Removed
- **Strike Button**: Removed non-functional Strike deeplink button
  - Strike uses standard `lightning:` URI scheme, not custom `strike://` scheme
  - Users with Strike can still pay via standard Lightning invoice or QR code scan

## [0.4.4] - 2025-10-24

### Fixed
- **Social Post Authentication**: EnhancedSocialShareModal now supports BOTH Amber (Android) and nsec (iOS)
  - Previously only supported nsec, blocking Amber users on Android
  - Added UnifiedSigningService integration with nsec fallback for iOS compatibility
  - iOS users can post kind 1 social workouts with nsec
  - Android users can post with Amber signer
- **Background GPS Tracking**: Increased background sync interval from 3 seconds to 10 seconds
  - Previous 3-second interval triggered Android battery optimization, killing tracker after 3 seconds
  - New 10-second interval allows tracking to continue for full workout duration (2+ hours)
  - GPS tracking now continues reliably when app is backgrounded or user switches to music apps
  - Only the stop button stops tracking - navigation away no longer interrupts workouts
- **Build System**: Complete cache clearing and APK rebuild
  - Cleaned Metro bundler cache to ensure all code changes take effect
  - Cleaned Gradle cache to eliminate stale Android build artifacts
  - Fresh APK (build 35) includes all previous fixes

### Improved
- **Tracker Persistence**: GPS service is singleton, continues independently of UI navigation
  - UI timers pause on navigation (correct behavior)
  - GPS tracking service continues in background (correct behavior)
  - AppState listener syncs data when returning to app
- **Route Selection**: RouteSelectionModal correctly loads routes from RouteStorageService
  - No code changes needed - already working correctly
  - Will function properly once new APK is installed

### Technical
- Version numbers updated across all platforms:
  - app.json: 0.4.4 (versionCode 35)
  - android/app/build.gradle: 0.4.4 (versionCode 35)
  - package.json: 0.4.4

## [0.4.3] - 2025-10-24

### Added
- **Garmin Integration**: Complete Garmin Connect sync for automatic workout import
  - GarminHealthTab component for OAuth authentication flow
  - garminAuthService for secure token management and authorization
  - garminActivityService for fetching and syncing activity data from Garmin
  - Support for importing runs, rides, swims, and other activities from Garmin devices
  - Seamless integration with existing workout history and competition tracking

### Fixed
- **Background Distance Tracking**: Enhanced reliability for backgrounded workouts
  - Continued improvements from 0.4.2 for better GPS tracking when app is not in foreground
  - Improved location service persistence during long-duration activities
  - More accurate distance calculations when switching between apps
- **Charity Wallet Payments**: Improved charity zap functionality and wallet integration
  - Better error handling for charity donation flows
  - Enhanced wallet connection reliability for team charity payments
  - Improved payment confirmation and user feedback
- **TypeScript Compilation**: Resolved TypeScript errors for cleaner builds
  - Fixed type mismatches across activity tracking services
  - Improved type safety in workout and Garmin integration modules
  - Cleaner compilation with zero errors
- **Activity Tracker Stability**: Various bug fixes across tracking screens
  - Enhanced stability in Running, Cycling, and Walking tracker screens
  - Better handling of edge cases during workout sessions
  - Improved workout data persistence and synchronization

### Improved
- **Code Quality**: General bug fixes and performance improvements
  - Better error handling throughout the application
  - Improved service reliability and state management
  - Enhanced test coverage for integration scenarios

## [0.4.2] - 2025-10-23

### Fixed
- **Android Background Distance Tracking**: Revolutionary fix for distance calculation when app is backgrounded
  - Distance calculation now runs in background task with headless JavaScript context
  - Survives app backgrounding and continues accurate distance tracking
  - No more lost distance when switching apps during workouts
  - Improved reliability for long-duration activities
- **Team About Section Display**: Fixed display of team's about section
  - About section now properly renders when stored as plain text in Nostr events
  - Improved team profile completeness
- **Back Button Responsiveness**: Eliminated 30-second delay on back button
  - Immediate response when navigating back from screens
  - Better UI responsiveness throughout the app

### Added
- **Route Tracking Feature**: Complete privacy-first route tracking implementation
  - GPS route recording with privacy controls
  - Route saving and management capabilities
  - Route replay and comparison features
  - Personal record tracking on saved routes

### Improved
- **Charity Donation Flow**: Standardized zap pattern implementation
  - Consistent payment flow matching rest of app's zap functionality
  - Better user experience for charity donations
  - More reliable payment processing

## [0.4.1] - 2025-10-23

### Fixed
- **Activity Tracker Improvements**: Comprehensive fixes for enhanced tracking reliability
  - Background sync now works correctly during long workouts
  - Fixed NaN values in split times for more accurate pace tracking
  - Improved first-run GPS accuracy with better permission handling
  - Removed effort score for cleaner, focused workout metrics
- **Teams Page Performance**: Major optimizations for faster loading and smoother scrolling
  - Reduced redundant queries and improved caching strategy
  - Enhanced UI responsiveness during team browsing
  - Better handling of large team lists and event data
- **Event Management**: Improved event creation and captain dashboard functionality
  - More reliable event creation workflow
  - Better error handling in captain dashboard
  - Enhanced join request processing
- **Charity Zap**: Standardized charity zap implementation to match NWC pattern
  - Consistent payment flow across all zap interactions
  - Better error handling for failed transactions
- **UI Fixes**: Prevented team name from incorrectly appearing in About section
  - Cleaner profile presentation
  - Fixed text overlap issues

### Improved
- **Overall Stability**: Multiple minor bug fixes and performance enhancements
  - Better memory management during extended app usage
  - Improved network request handling
  - Enhanced error recovery mechanisms

## [0.4.0] - 2025-10-23

### Added
- **Graphic Workout Displays**: Beautiful visual cards for kind 1 workout events replacing generic text-based posts
  - Instagram-worthy workout achievement graphics with RUNSTR branding
  - Automatic badge generation for PRs, distance milestones, and calorie achievements
  - Motivational quotes tailored to workout types
  - SVG-based rendering for crisp, professional social sharing
- **Advanced Analytics Page**: Comprehensive local exercise data analysis and insights
  - Cardio performance tracking with trend analysis
  - Strength training analytics and progression metrics
  - Nutrition tracking and wellness analytics
  - Holistic health dashboard with actionable insights
- **Route Planning System**: Complete route management infrastructure with GPS comparison
  - RouteMatchingService for GPS comparison and personal record tracking
  - SavedRoutesScreen for route library management and organization
  - Save as Route functionality during active workouts
  - Route replay and comparison features for performance analysis
- **Weather Integration**: Real-time weather context for workouts
  - Weather badges displayed on workout cards showing conditions during activity
  - Weather data captured and stored with workout metadata
  - Historical weather context for training analysis
- **Premium Features MVP**: Enhanced workout metrics and environmental tracking
  - Effort Score algorithm for workout intensity measurement
  - Weather context integration for comprehensive training data
  - Environmental factors included in performance analytics
- **Non-Manual Activity Tracking**: Automated tracking for additional activity types
  - Meditation session tracking with duration and mindfulness metrics
  - Strength training workout logging with sets, reps, and weights
  - Diet tracking with meal logging and nutritional data
  - Simplified data entry for non-GPS activities
- **External Wallet Zapping**: Enhanced Lightning payment functionality
  - Long-press user profiles to send zaps from any external Lightning wallet
  - Universal wallet support (Cash App, Strike, Alby, self-custodial)
  - Seamless payment flow without app-specific wallet requirements
- **Challenge Arbitration System**: P2P challenge dispute resolution
  - Arbitrator selection during challenge creation
  - Third-party arbitration for contested 1v1 competitions
  - Fair resolution system for workout verification disputes
  - CaptainArbitrationDashboard for managing arbitration requests

### Fixed
- **NWC Wallet Connection Issues**: Resolved critical payment and connection problems
  - Fixed relay connection drops causing wallet sync failures
  - Improved payment verification reliability
  - Enhanced error handling for Lightning operations
  - Better connection state management and recovery
- **Background Tracking Reliability**: Major improvements for Android and iOS
  - Fixed distance tracking continuing reliably when app backgrounded
  - Improved GPS signal processing during long-duration activities
  - Enhanced location service stability for extended workout sessions
  - Better battery optimization compatibility
- **Various Bug Fixes**: Comprehensive stability and performance improvements
  - Improved UI responsiveness across all screens
  - Fixed race conditions in data loading
  - Enhanced error handling throughout the app
  - Better memory management for long sessions

### Improved
- **User Experience**: Refined workflows across workout posting and challenge creation
  - Smoother navigation and interaction patterns
  - Better visual feedback for user actions
  - Enhanced onboarding for new features
  - More intuitive UI layouts and controls

### Technical
- **Kind 1 Event Enhancement**: Migrated from text-based to graphic workout displays
  - Rich media support for social workout posts
  - SVG generation for scalable, high-quality graphics
  - Improved Nostr event formatting for better compatibility
- **Analytics Architecture**: Comprehensive analytics service layer
  - CardioPerformanceAnalytics service for endurance metrics
  - StrengthTrainingAnalytics for resistance training data
  - NutritionAnalytics for diet tracking
  - WellnessAnalytics for holistic health monitoring
- **Route Storage**: Local-first route persistence with cloud sync
  - RouteStorageService for route management
  - AsyncStorage-based local caching
  - Optional Nostr event publishing for route sharing

## [0.3.2] - 2025-10-22

### Added
- **Race Replay Data**: Enhanced Kind 1301 workout events with comprehensive race replay visualization support
  - Individual kilometer split times with elapsed timestamps for website animations
  - Split pace tracking (pace per kilometer/mile) for detailed performance analysis
  - Average pace calculation and publishing in min/km or min/mi format
  - Elevation loss tracking alongside existing elevation gain data
  - GPS data point counts showing tracking detail and accuracy
  - Workout pause counts for understanding activity interruptions
  - Workout start timestamp (separate from event publication time)
- **Android Permission System**: User-friendly modal-based permission request flow
  - Dedicated permission request modal with clear explanations
  - Automatic permission checking on app startup for Android users
  - Graceful handling of denied permissions with settings navigation
  - Improved onboarding experience with upfront permission requests

### Improved
- **Location Tracking Service**: Enhanced SimpleLocationTrackingService with better reliability
  - Improved GPS data validation and filtering
  - More accurate distance calculations during workouts
  - Better handling of background location updates
- **Workout Publishing**: Complete Kind 1301 event enhancement for external leaderboards
  - All race replay data automatically included when publishing workouts
  - Richer workout data for runstr.app website visualizations
  - Better compatibility with external fitness tracking platforms

### Documentation
- **Kind 1301 Specification**: Updated with comprehensive race replay tag documentation
  - Detailed examples of all new tags (split, split_pace, avg_pace, elevation_loss, etc.)
  - Format specifications for each tag type
  - Usage guidelines for external platform integration

## [0.3.1] - 2025-10-19

### Fixed
- **Background Tracking Stability**: Resolved critical distance tracking issues during backgrounded workouts
  - Fixed distance updates continuing reliably when app is in background
  - Improved GPS signal processing for long-duration activities
  - Enhanced location service stability for extended workout sessions
- **Event Creation Workflow**: Fixed event creation reliability issues
  - More robust event publishing to Nostr relays
  - Better error handling during event creation process
  - Improved validation and confirmation flow

### Improved
- **Teams Page Performance**: Dramatically improved event loading speed on teams page
  - Optimized event queries and caching strategy
  - Faster initial page load with progressive data fetching
  - Reduced redundant network requests for team events
  - Smoother scrolling and navigation experience

## [0.3.0] - 2025-10-17

### Fixed
- **iOS App Store Submission**: Resolved critical issues preventing App Store approval
  - Fixed app crash when selecting photos from library (missing NSPhotoLibraryUsageDescription)
  - Improved skip button responsiveness on iPad with proper touch targets (hitSlop)
  - Enhanced error handling for photo library and camera access permissions
- **Android Version Management**: Fixed versionCode inconsistency preventing Zapstore updates
  - Corrected versionCode sequence to prevent downgrade errors
  - Explicit versionCode management ensures proper update flow
- **Event Payment Verification**: Complete payment verification system with dual-path confirmation
  - NWC-connected wallets auto-verify payments via transaction polling
  - Manual verification option for users paying with any Lightning wallet
  - Payment status tracking and UI feedback for join request flow

### Changed
- **Permission Descriptions**: Updated camera permission text for accuracy
  - Changed from "Lightning payments" to "challenges and events"
  - Reflects actual QR code scanning functionality for event/challenge participation
  - Consistent messaging across iOS (Info.plist) and app.json configuration

### Improved
- **iPad Compatibility**: Enhanced touch targets across onboarding and profile setup
  - Added hitSlop to all interactive buttons for better iPad usability
  - Improved ActionSheetIOS usage for better modal presentation
  - Better error messaging and user guidance for permission flows

## [0.2.8] - 2025-10-17

### Fixed
- **Modal Consistency**: Converted EventPaymentModal to CustomAlert for consistent UI
  - Unified alert system across payment modals
  - Better user experience with standardized modal behavior
  - Improved accessibility and theme consistency
- **Activity Tracker Alerts**: Converted 3 activity tracker screens to CustomAlert
  - Running, walking, and cycling screens now use unified alert system
  - Consistent error handling and user notifications
  - Better modal dismiss behavior
- **Zapstore Configuration**: Updated Zapstore URLs to correct endpoints
  - Fixed app store URLs for proper distribution
  - Corrected deep linking configuration
- **Critical: Amber Security**: Resolved critical security and signing issues
  - Enhanced security in Amber signer integration
  - Fixed signing flow vulnerabilities
  - Improved error handling for authentication
- **Alert Modal Consistency**: Fixed cancel button visibility across all modals
  - Consistent button placement and styling
  - Better UX for dismissing modals
  - Improved accessibility

## [0.2.7] - 2025-10-16

### Fixed
- **Critical: NDK Connection Stability** - Resolved relay connection drops causing "0/3 relays connected" errors
  - Added real-time connection event monitoring (connect/disconnect/notice events)
  - Implemented 30-second keepalive heartbeat to maintain WebSocket connections
  - Added 10-second debouncing to prevent rapid reconnection attempts
  - Fixed WalletSync infinite retry loops
  - Connection state now accurately reflects actual relay connectivity
- **Android Splash Screen** - Fixed cropped ostrich display, now shows full orange logo + RUNSTR text
  - Previously showed ostrich in circle with head/feet cut off
  - Now displays complete branding on app launch

### Changed
- **iOS App Icon** - Updated from logo+text to ostrich-only for cleaner home screen appearance
- **iOS Splash Screen** - Updated from black/white to orange branding for consistent visual identity
- **App Icon Consistency** - iOS now matches Android's clean icon design

### Documentation
- **CLAUDE.md Optimization** - Reduced from 991 to 504 lines (49% reduction) for better maintainability
  - Moved detailed content to dedicated docs files
  - Improved navigation with cross-references
  - Cleaner project context for development

## [0.2.6] - 2025-10-14

### Added
- **⚡ Universal Lightning Payments**: Complete LNURL integration for all payment types
  - **Event Tickets**: Paid events accept ANY Lightning wallet (Cash App, Strike, Alby, Wallet of Satoshi, etc.)
    - EventPaymentModal with QR code display for universal wallet support
    - Lightning address field in event creation wizard
    - LNURL-pay protocol implementation (LUD-16)
    - Payment proof system via kind 1105 join request tags
    - Manual invoice copying for desktop wallets
  - **Charity Donations**: Support team charities with any Lightning wallet
    - CharityPaymentModal component with QR code display
    - LNURL invoice generation from charity Lightning addresses
    - Manual payment confirmation with "I Paid" button
    - No wallet connection required to donate
- **💡 Educational Lightning Content**: Clear explanations throughout the app
  - Lightning address helper text in ProfileEditScreen (explains receiving payments)
  - NWC explanation box in WalletConfigModal (explains sending payments)
  - CompactWallet shows "Connect Wallet to Send Bitcoin" with clear distinction
  - Tooltips guide users: NWC for sending, Lightning address for receiving
- **Charity Integration**: Full charity support on team pages
  - CharitySection component displays team's supported charity
  - OpenSats, HRF, and other organizations supported
  - Integrated into team detail screens

### Changed
- **🎯 1v1 Challenges Enabled**: Bitcoin-wagered challenges now available to all users
  - Feature flag `ENABLE_1V1_CHALLENGES` set to `true`
  - Members can challenge each other with sats on the line
  - Automatic escrow and winner payout system active
  - Complete dual-path challenge system (Nostr requests + QR codes)
- **🔄 BREAKING: Replaced NIP-60/61 (Cashu) with NWC (Nostr Wallet Connect)**
  - Migrated from Cashu ecash to direct Lightning payments
  - Integrated Alby SDK (@getalby/sdk) for wallet operations
  - Simpler, more reliable payment infrastructure
  - Better compatibility with existing Lightning ecosystem
  - CompactWallet now uses NWC instead of Cashu tokens
  - All zaps and rewards use native Lightning
- **Event Payment Flow**: Replaced NWC-only with universal LNURL system
  - EventDetailScreen displays payment modal with QR code
  - EventJoinService generates LNURL invoices from captain's Lightning address
  - Payment confirmation flow with join request after payment
  - ENABLE_EVENT_TICKETS feature flag enabled
- **🔓 Removed NWC Requirements**:
  - Charity donations no longer require wallet connection
  - Event payments work with any Lightning wallet
  - Improved accessibility for mainstream Bitcoin users

### Technical
- **LNURL Protocol Integration**: Full LNURL-pay implementation
  - `src/utils/lnurl.ts`: Complete LNURL utility with invoice generation
  - `fetchLNURLPayDetails()`: Fetches payment details from Lightning addresses
  - `requestInvoiceFromLNURL()`: Generates invoices via LNURL callback
  - `getInvoiceFromLightningAddress()`: Convenience function for full flow
  - `isValidLightningAddress()`: Lightning address validation
- **Event Metadata Enhancement**:
  - Added `lightningAddress` field to NostrEventDefinition type
  - Lightning address stored in kind 30101 event tags
  - Payment invoice included in kind 1105 join requests as proof
- **NWC Services**:
  - RewardSenderWallet service using Alby SDK's NWCClient
  - Daily workout reward system with NWC support
  - Dedicated reward sender wallet configuration
  - Comprehensive test coverage for NWC operations
- **UI Components**:
  - EventPaymentModal: Full-screen payment interface with QR code
  - CharityPaymentModal: Donation modal with QR code and instructions
  - Step-by-step payment instructions for both modals
  - Real-time copy feedback for invoice strings

### Improved
- **Wallet UX Clarity**: Better distinction between sending and receiving Bitcoin
  - NWC wallet clearly labeled as "for sending payments"
  - Lightning address clearly labeled as "for receiving payments"
  - Educational tooltips guide users to correct setup
  - Reduced confusion for new Bitcoin users
- **Performance**: Major optimizations with Season 1 hard-coding and prefetch
  - Dramatically reduced load times for Season 1 leaderboard
  - Better prefetching strategy during app initialization
  - Improved overall app responsiveness
- **Global NDK Service**: Migrated remaining services from NostrRelayManager
  - Eliminated duplicate WebSocket connections
  - Better connection stability and reliability
  - More efficient Nostr operations throughout the app
- **Workout Posting**: Enhanced reliability using UnifiedSigningService for kind 1 events
  - More reliable kind 1 workout posting to Nostr
  - Better signing coordination across the app
- **Lightning Zaps**: Automatic balance refresh after successful NWC payments
  - Real-time balance updates post-transaction
  - Better user feedback on payment success

### Fixed
- **MVP Readiness**: Fixed 29 critical TypeScript errors (reduced from 81 to 52)
  - Critical JSX/React type errors in App.tsx
  - Theme property errors across 6 files
  - Null safety checks for npubToHex conversions
  - Missing props in event join request components
- **Theme Consistency**: Achieved 100% orange/black brand compliance
  - Replaced all white text with theme.colors.text (4 instances)
  - Updated gray text to theme colors (40+ instances)
  - 20 files updated for consistent brand identity
- **Critical Distance Tracking Freeze**: Eliminated 2-minute distance freeze bug
  - Fixed stale closure issue in ActivityTrackerScreen
  - Distance updates reliably throughout entire workout
  - Accurate tracking for long-duration activities
- **Event Creation and Join Approvals**: Critical fixes for competition functionality
  - More reliable event creation workflow
  - Better join request approval handling
- **Android Background Distance Tracking**: Improved reliability during backgrounded workouts
  - Better background location processing
  - More accurate distance updates when app is backgrounded
- **Profile Screen Layout**: Restored proper layout after adding ScrollView
- **Wallet Balance Sync**: Synchronized NWC balance with available funds before zapping
- **Event Loading Race Condition**: Resolved using useFocusEffect
  - Events load reliably on screen focus
  - Eliminated inconsistent event display

### Documentation
- **Project Organization**: Reorganized docs and scripts into dedicated folders
  - Cleaner project structure
  - Easier navigation for documentation
- **NWC Integration**: Added comprehensive technical documentation
  - Detailed architecture overview
  - Integration patterns and best practices

### User Experience
- **Captain Workflow**: Add Lightning address during event creation → Receive payments directly
- **Participant Workflow**: Join paid event → See QR code → Pay from any wallet → Confirm → Join request sent
- **Charity Donations**: Tap zap button → Enter amount → See QR code → Pay → Confirm donation
- **Wallet Flexibility**: No longer requires app-specific NWC setup for payments
- **Better Accessibility**: Works with mainstream wallets like Cash App and Strike

### Removed
- **Nutzap/Cashu Infrastructure**: Phased out in favor of native Lightning via NWC
  - Removed Cashu mint dependencies
  - Removed ecash proof management
  - Simplified wallet architecture with direct Lightning payments

## [0.2.5] - 2025-10-14

### Added
- **⚡ Universal Lightning Event Payments**: Paid events now accept ANY Lightning wallet
  - EventPaymentModal component with QR code display for universal wallet support
  - Lightning address field in event creation wizard for captains
  - LNURL utility module implementing LNURL-pay protocol (LUD-16)
  - Supports Cash App, Strike, Alby, Wallet of Satoshi, and all Lightning wallets
  - QR code generation for easy mobile wallet scanning
  - Manual invoice copying for desktop wallets
  - Payment proof system via kind 1105 join request tags

### Changed
- **Event Payment Flow**: Replaced NWC-only payments with universal LNURL system
  - EventDetailScreen displays payment modal with QR code for paid events
  - EventJoinService now generates LNURL invoices from captain's Lightning address
  - Payment confirmation flow with join request submission after payment
  - Enabled ENABLE_EVENT_TICKETS feature flag for production use

### Technical
- **LNURL Protocol Integration**: Full LNURL-pay implementation
  - `src/utils/lnurl.ts`: Complete LNURL utility with invoice generation
  - `fetchLNURLPayDetails()`: Fetches payment details from Lightning addresses
  - `requestInvoiceFromLNURL()`: Generates invoices via LNURL callback
  - `getInvoiceFromLightningAddress()`: Convenience function for full flow
  - `isValidLightningAddress()`: Lightning address validation
- **Event Metadata Enhancement**:
  - Added `lightningAddress` field to NostrEventDefinition type
  - Lightning address stored in kind 30101 event tags
  - Payment invoice included in kind 1105 join requests as proof
- **UI Components**:
  - EventPaymentModal: Full-screen payment interface with QR code
  - Step-by-step payment instructions
  - Real-time copy feedback for invoice strings
  - Confirmation dialog before submitting join request

### User Experience
- **Captain Workflow**: Add Lightning address during event creation → Receive payments directly
- **Participant Workflow**: Join paid event → See QR code → Pay from any wallet → Confirm payment → Join request sent
- **Wallet Flexibility**: No longer requires app-specific NWC wallet setup for event payments
- **Better Accessibility**: Works with mainstream wallets like Cash App and Strike

## [0.2.4] - 2025-10-13

### Changed
- **🔄 BREAKING: Replaced NIP-60/61 (Cashu) with NWC (Nostr Wallet Connect)**
  - Migrated from Cashu ecash system to direct Lightning payments
  - Integrated Alby SDK (@getalby/sdk) for wallet operations
  - Simpler, more reliable payment infrastructure
  - Better compatibility with existing Lightning ecosystem
  - CompactWallet now uses NWC instead of nutzap proofs
  - All zaps and rewards now use native Lightning instead of Cashu tokens

### Added
- **NWC Wallet Operations**: Complete NWC integration for payments and rewards
  - RewardSenderWallet service using Alby SDK's NWCClient
  - Daily workout reward system with NWC support
  - Dedicated reward sender wallet configuration
  - Comprehensive test coverage for NWC reward system
- **Charity Integration**: Full charity zapping via Lightning
  - CharitySection component displays team's supported charity
  - Lightning payment support for OpenSats, HRF, and other organizations
  - Integrated into SimpleTeamScreen with zap handlers
- **Pull-to-Refresh**: Added to Profile screen for balance updates and team events
  - Quick gesture to refresh wallet balance
  - Manual refresh for team event lists

### Fixed
- **MVP Readiness Review**: Fixed 29 critical TypeScript errors (reduced from 81 to 52)
  - Critical JSX/React type errors in App.tsx (void → ReactNode)
  - Theme property errors (theme.colors.surface → cardBackground) across 6 files
  - Null safety checks for npubToHex conversions in EventJoinRequestsSection
  - Missing props in EventJoinRequestsSection (teamId, captainPubkey)
  - Added onReject optional prop to JoinRequestCard
  - Fixed userNpub → npub prop name in CompetitionParticipantsSection
- **Theme Consistency**: Achieved 100% orange/black brand compliance
  - Replaced all white text (#ffffff) with theme.colors.text (4 instances)
  - Replaced gray text (#666 → textMuted, #999 → textDark, #ccc → textSecondary) (40+ instances)
  - Updated 20 files for consistent brand identity across all screens
- **Critical Distance Tracking Freeze**: Eliminated 2-minute distance freeze bug
  - Fixed stale closure issue in ActivityTrackerScreen
  - Distance now updates reliably throughout entire workout
  - Ensures accurate tracking for long-duration runs, walks, and cycles
- **Event Loading Race Condition**: Resolved using useFocusEffect for reliable event display
  - Events now load reliably on screen focus
  - Eliminated inconsistent event display issues
- **Profile Screen Layout**: Restored proper layout after adding ScrollView
  - Fixed UI layout issues introduced with scrolling functionality
- **Wallet Balance Sync**: Synchronized NWC balance with spendable proofs before zapping
  - Balance now accurately reflects available funds
  - Prevents failed zaps due to stale balance data
- **Wallet Detection**: Added backwards compatibility and auto-initialization for NWC
  - Smarter wallet detection logic
  - Maintains compatibility with existing wallets
- **Event Creation and Join Approvals**: Critical fixes for competition functionality
  - More reliable event creation workflow
  - Better join request approval handling
- **Android Background Distance Tracking**: Improved reliability during backgrounded workouts
  - Better background location processing
  - More accurate distance updates when app is backgrounded
- **Season 1 Static Data**: Updated with actual results from Nostr
  - Real leaderboard data instead of placeholders
  - Accurate competition results

### Improved
- **Performance**: Major optimizations with hard-coded Season 1 and comprehensive prefetch
  - Dramatically reduced load times for Season 1 leaderboard
  - Better prefetching strategy during app initialization
  - Improved overall app responsiveness
- **Global NDK Service**: Migrated remaining services from NostrRelayManager
  - Eliminated duplicate WebSocket connections
  - Better connection stability and reliability
  - More efficient Nostr operations throughout the app
- **Workout Posting Reliability**: Enhanced using UnifiedSigningService for kind 1 events
  - More reliable kind 1 workout posting to Nostr
  - Better signing coordination across the app
- **Lightning Zaps**: Automatic balance refresh after successful NWC payments
  - Real-time balance updates post-transaction
  - Better user feedback on payment success

### Security
- **NWC Connection Strings**: Moved sensitive NWC credentials to environment variables
  - No hardcoded secrets in source code
  - Better credential management practices
  - Enhanced security for wallet operations

### Documentation
- **Project Organization**: Reorganized docs and scripts into dedicated folders
  - Cleaner project structure
  - Easier navigation for documentation
- **NWC Integration**: Added comprehensive technical documentation for NWC reward system
  - Detailed architecture overview
  - Integration patterns and best practices

### Testing
- **Amber Wallet Diagnostics**: Added comprehensive diagnostic scripts for wallet restoration
  - Tools to debug wallet connection issues
  - Restoration flow testing utilities

### Removed
- **Nutzap/Cashu Infrastructure**: Phased out in favor of native Lightning via NWC
  - Removed Cashu mint dependencies
  - Removed ecash proof management
  - Simplified wallet architecture with direct Lightning payments

## [0.2.3] - 2025-10-09

### Performance
- **Simplified Caching Strategy**: Optimized caching for 10-team app architecture
  - Streamlined data caching mechanisms
  - Reduced memory footprint
  - Faster data retrieval for team-based operations

### Added
- **Event Leaderboard Enhancement**: Include paid local participants in event leaderboards
  - More comprehensive competition rankings
  - Better visibility of all participants
  - Fair representation of event participants

### Fixed
- **Workout Publishing**: Use native NDK signing and publishing for workout events
  - More reliable workout event creation
  - Better Nostr integration for workout posting
  - Improved signing workflow

### Improved
- **Workout Screen UI**: Enhanced workout history and tracking interfaces
  - Improved WorkoutTabNavigator navigation
  - Better PrivateWorkoutsTab UI/UX
  - Enhanced EnhancedWorkoutHistoryScreen layout
  - Additional features in WorkoutHistoryScreen

### Documentation
- **Data Architecture Guide**: Added comprehensive data architecture and caching strategy documentation
  - Detailed caching patterns and best practices
  - System architecture overview
  - Performance optimization guidelines

## [0.2.2] - 2025-10-09

### Performance
- **Dramatic Startup Improvement**: Reduced app startup time from 45-90 seconds to under 2 seconds for returning users
  - Implemented smarter initialization flow
  - Better caching and data prefetching
  - Significantly improved user experience on app launch

### Added
- **GPS Smoothing**: Kalman filtering for smoother GPS tracking (feature flagged)
  - Added KalmanFilter utility class for location data smoothing
  - GPS validation utilities for better accuracy
  - Can be enabled via feature flags for testing

### Fixed
- **Nostr Publishing**: Wait for relay connections before posting kind 1 notes
  - Prevents failed posts due to premature publishing
  - Better relay connection handling
  - More reliable social workout posting

### Documentation
- Added lessons learned from reference implementation
  - Detailed GPS and Kalman filtering implementation notes
  - Best practices for location tracking

## [0.2.1] - 2025-10-09

### Improved
- **Activity Tracking Architecture**: Simplified location tracking system
  - Replaced complex tracking system with SimpleLocationTrackingService
  - More maintainable and reliable GPS tracking
  - Better performance during workouts

### Fixed
- **Theme Consistency**: Updated Bitcoin message box and notifications to match black and orange theme
  - Consistent visual design across all UI components
  - Better integration with app's color scheme

## [0.2.0] - 2025-10-09

### Performance
- **Global NDK Service Migration**: Eliminated duplicate WebSocket connections across the app
  - Migrated remaining services from NostrRelayManager to GlobalNDKService
  - Reduced redundant relay connections for better performance
  - Improved connection stability and reliability
  - More efficient Nostr operations throughout the app

### Improved
- **Workout Posting Reliability**: Enhanced workout posting with UnifiedSigningService
  - More reliable kind 1 workout posting to Nostr
  - Better signing coordination across the app
  - Improved error handling for workout events
- **Lightning Zap Experience**: Refined nutzap and Lightning payment flows
  - Improved zap button interactions and feedback
  - Better error handling for Lightning payments
  - Enhanced user experience for sending satoshis

### Fixed
- **Prefetch Service**: Resolved errors in NostrPrefetchService
  - Removed unused league fetching causing errors
  - Cleaner initialization flow
  - Faster app startup without unnecessary queries

## [0.1.10] - 2025-10-09

### Fixed
- **Critical Run Tracker Fix**: Resolved distance tracking freeze after 2 minutes
  - Eliminated stale closure bug in ActivityTrackerScreen
  - Distance updates now continue reliably throughout entire workout
  - Ensures accurate tracking for long-duration runs, walks, and cycles
- **Profile Screen Layout**: Restored proper layout after adding ScrollView
  - Fixed UI layout issues introduced with scrolling functionality
  - Consistent profile display across different screen sizes
- **Lightning Balance Sync**: Synchronized wallet balance with spendable proofs before zapping
  - Balance now accurately reflects available funds before sending
  - Prevents failed zaps due to stale balance data
  - Real-time balance updates after successful Lightning payments
- **Team Events Refresh**: Added pull-to-refresh to reload team events
  - Users can now manually refresh event lists
  - Ensures latest competition data is always available
  - Better UX for checking new events

### Added
- **Pull-to-Refresh on Profile**: Enabled pull-to-refresh to update wallet balance
  - Quick gesture to refresh balance without navigating away
  - Improved wallet balance visibility
  - Better user control over data freshness

## [0.1.9] - 2025-10-09

### Changed
- **Simplified Focus**: Removed team leagues and team member lists to focus exclusively on Teams and Events
  - Streamlined UI for better user experience
  - Reduced complexity in team management
  - Clearer navigation between Teams and Events

### Added
- **Nutzap Entry Fees**: Event entry fee system using nutzap-based Bitcoin payments
  - Captains can set entry fees for events
  - Automatic payment processing via Lightning
  - Enhanced competition monetization options
- **Amber Wallet Diagnostics**: Comprehensive diagnostic scripts for Amber wallet restoration
  - Tools to debug wallet connection issues
  - Restoration flow testing utilities
  - Better troubleshooting capabilities

### Fixed
- **Event Loading Race Condition**: Resolved critical timing issues using useFocusEffect
  - Events now load reliably on screen focus
  - Eliminated inconsistent event display
  - Smoother navigation experience
- **Wallet Duplication Prevention**: NIP-60 wallet restoration instead of creating duplicates
  - Check for existing wallets before creation
  - Restore wallet state from Nostr events
  - Prevents multiple wallets for same user

### Improved
- **Deterministic Wallet Detection**: User-initiated wallet creation with backwards compatibility
  - Smarter wallet detection logic
  - Maintains compatibility with existing wallets
  - User control over wallet initialization
- **Wallet Auto-Initialization**: Automatic wallet setup with backwards compatibility
  - Seamless onboarding for new users
  - Preserves existing wallet configurations
  - Enhanced reliability across app updates
- **Event Loading Logging**: Comprehensive debugging for event loading issues
  - Detailed logs for troubleshooting
  - Better visibility into loading states
  - Faster issue resolution

## [0.1.16] - 2025-10-08

### Performance
- **50x Faster Caching Architecture**: Implemented advanced caching patterns from runstr-github reference
  - Massive performance gains across all data-heavy screens
  - Significantly reduced network requests and processing overhead
  - Improved app responsiveness and user experience
- **ProfileScreen Optimization**: Eliminated 10-second freeze with lazy loading architecture
  - Cache-first strategy shows app immediately with cached data
  - Deferred wallet initialization by 2 seconds (non-blocking)
  - Deferred notification initialization by 3 seconds (non-blocking)
  - Added 3-second timeout to prevent indefinite blocking
  - Progressive enhancement instead of blocking gates
- **UI Freeze Fixes**: Applied React patterns from runstr-github to eliminate UI blocking
  - Smoother interactions throughout the app
  - Better handling of heavy operations
  - Improved overall app responsiveness

### Fixed
- **Critical Session Stability**: Fixed crashes and issues in 2+ hour running sessions
  - Enhanced memory management for long-duration activities
  - Improved GPS tracking reliability over extended periods
  - Better background processing for marathon-length workouts
- **Amber Signing System**: Complete overhaul of Amber signer integration
  - Fixed join request signing failures
  - Resolved crypto library conflicts causing signing errors
  - Implemented proper 60-second timeout handling
  - Enhanced error messages for better user guidance
  - Fixed NIP-55 parameter compliance (current_user, id fields)
  - Proper pubkey handling with padding and npub decoding
- **GlobalNDK Signer Setup**: Amber/nsec signer now properly attached to GlobalNDK
  - All Nostr operations now use correct signer
  - Consistent signing behavior across the app
  - Better integration between authentication and Nostr operations

### Testing
- **Distance Freeze Detection**: Comprehensive test suite for GPS tracking issues
  - Validates distance tracking accuracy
  - Tests GPS recovery scenarios
  - Ensures workout data integrity
- **Amber Signing Tests**: Complete test coverage for Amber integration (31/34 passing)
  - Unit tests for NIP-55 compliance
  - Integration tests for signing coordination
  - Timeout and error handling validation
  - Response parsing and pubkey caching tests

### Documentation
- **AMBER_INTEGRATION.md**: Comprehensive update with current architecture
  - Detailed explanation of Amber signer flow
  - NIP-55 specification compliance guide
  - Troubleshooting common issues
  - Integration patterns and best practices

## [0.1.15] - 2025-10-08

### Fixed
- **App Initialization Architecture**: Complete overhaul to eliminate 30-second button freeze
  - Wait for all data to load before showing app UI
  - Profile-first loading strategy for faster perceived performance
  - Eliminated race conditions causing unresponsive buttons
  - Simplified to single loading screen for cleaner UX
- **Profile Display**: Fixed avatar and bio not showing on initial render
  - Proper data loading sequence ensures profile appears correctly
  - Eliminated blank profile screen on app launch
- **GlobalNDK Reconnection**: Fixed cached instance reconnection on app reload
  - Prevents "NDK not ready" errors when returning to app
  - More reliable Nostr connection stability
  - Better handling of app backgrounding/foregrounding
- **Team Screen Crashes**: Multiple crash prevention fixes
  - Added null checks for undefined team data
  - Removed undefined team.captain reference
  - Protected against malformed team objects
- **Charity Zap Button**: Fixed crash from Lightning address handling
  - Proper validation of charity Lightning addresses
  - Prevents undefined reference errors

### Improved
- **Progressive Relay Connection**: Optimized relay connection strategy for faster startup
  - Relays connect progressively instead of all at once
  - Reduces initial connection overhead
  - Faster time to first data load
- **Amber Signer Support**: Enhanced challenge system with Amber signer integration
  - Users can sign challenges with external Amber app
  - Better NIP-55 compliance
  - More secure key management options

## [0.1.14] - 2025-10-07

### Changed
- Version bump for Android APK build
- Updated all platform version numbers (iOS, Android, Expo)

## [0.1.13] - 2025-10-06

### Added
- **Two-Tab Workout Feed**: Separate Public and Private workout tabs
  - Public tab shows workouts posted to Nostr (kind 1 social posts)
  - Private tab shows local HealthKit workouts (not yet posted)
  - Cleaner separation between social workout sharing and personal tracking
  - Removed HealthKit complexity from workout display logic

### Fixed
- **LocalWorkoutStorageService**: Fixed singleton instance usage across all components
  - Corrected imports to use singleton instance directly
  - Removed redundant instantiation causing storage inconsistencies
  - Improved workout posting status tracking reliability
- **iOS Build Errors**: Removed conflicting expo packages
  - Cleaned up package dependencies for stable iOS builds
  - Eliminated build failures from package conflicts
- **Workout Tab UI**: Removed cache/instant load indicators
  - Cleaner workout feed interface
  - Removed redundant loading state indicators
  - Improved visual clarity and reduced UI clutter

### Improved
- **Workout Feed Architecture**: Simplified workout display with dedicated public/private tabs
  - Better user mental model for workout management
  - Clear distinction between social posts and private tracking
  - More intuitive workout posting workflow

## [0.1.12] - 2025-10-06

### Fixed
- **CRITICAL: Workout Fetching Bug**: Fixed parameter mismatch in prefetch service
  - Corrected `fetchUserWorkouts` method signature (pubkey parameter)
  - Eliminated "workouts.filter is not a function" errors
  - Restored proper workout data fetching from Nostr relays
- **HealthKit Date Format**: Fixed date parsing for HealthKit workout import
  - Corrected ISO date string handling for workout timestamps
  - Eliminated timezone-related workout import failures
- **Pubkey Corruption in App.tsx**: Fixed pubkey retrieval from AsyncStorage
  - Use stored hex pubkey instead of potentially corrupted user.id
  - Prevents authentication errors on app startup
  - More reliable user identification throughout app

### Improved
- **NostrRelayManager Migration**: Migrated 6 critical services to GlobalNDK
  - Reduced redundant relay connections across the app
  - Better connection stability and reliability
  - Improved performance for Nostr operations

## [0.1.11] - 2025-10-06

### Fixed
- **Onboarding Loop**: Prevented returning users from seeing onboarding wizard
  - Added proper "onboarding complete" flag in AsyncStorage
  - Returning users now bypass wizard and go straight to app
  - Improved login flow reliability

## [0.1.10] - 2025-10-06

### Fixed
- **Loading Screen Hang**: Multi-layer timeout protection for app initialization
  - Added fallback timeouts to prevent indefinite loading states
  - Better error handling for network and authentication failures
  - Improved splash screen reliability

### Improved
- **LoginScreen Theme**: Updated to match orange theme design
  - Consistent visual branding throughout authentication flow
  - Better color scheme alignment with app design system

## [0.1.9] - 2025-10-06

### Changed
- **BREAKING: Complete Supabase Removal**: App now runs entirely on Nostr protocol
  - Removed all Supabase dependencies and services from codebase
  - Pure Nostr architecture for all team, competition, and user data
  - Simplified data layer with single source of truth (Nostr events)
  - No backend database dependencies - fully decentralized
  - Improved app reliability and reduced external dependencies

### Added
- **Activity-Specific Challenge Types**: Enhanced challenge system with activity-type-specific options
  - Different challenge parameters for each activity type (running, cycling, swimming, etc.)
  - More relevant competition formats tailored to each sport
  - Better UX for creating targeted 1v1 challenges

### Improved
- **Teams Discovery UX**: Create Team button moved to bottom of discovery page
  - More intuitive placement for new team creation
  - Cleaner top section focused on browsing existing teams
  - Better visual hierarchy and user flow
- **Captain Dashboard**: Multiple UX improvements and bug fixes
  - More intuitive member management interface
  - Improved join request approval workflow
  - Better visual feedback for captain actions
  - Enhanced stability and reliability
- **Challenge Button Styling**: Refined challenge UI with better visual consistency
  - Improved button appearance and interactions
  - Clearer challenge action buttons
  - Better integration with overall app theme

### Fixed
- **TypeScript Compilation**: Resolved all TypeScript compilation errors
  - Clean build with zero errors
  - Improved type safety throughout codebase
  - Better developer experience
- **Android Data Loading**: Fixed teams and workouts loading issues on Android
  - Resolved race conditions in data fetching
  - Added comprehensive debug logging
  - Improved error handling for network issues
  - Better cache management
- **Android Compatibility**: Multiple Android-specific fixes
  - Fixed UI layout issues on various Android devices
  - Improved alert dialog theming for dark mode
  - Enhanced authentication flow reliability
  - Better keyboard handling and text input

## [0.1.8] - 2025-10-05

### Added
- **League/Event Separation**: Enhanced competition organization with clear distinction between leagues and events
  - Improved navigation and discovery for different competition types
  - Better categorization and filtering in competition lists
  - Clearer visual hierarchy for ongoing vs time-bounded competitions
- **Event Join Notifications**: Real-time notifications when users join events
  - Instant feedback for event participation
  - Better visibility of new team members joining competitions
  - Improved engagement and social dynamics

### Performance
- **60% Faster App Startup**: Parallelized NostrPrefetchService for dramatic performance improvements
  - Team discovery, profile data, and Season 1 leaderboards now load simultaneously
  - Reduced sequential bottlenecks in data fetching
  - Faster time-to-interactive for users
- **Optimized Relay Connections**: Centralized NDK instance management with GlobalNDKService
  - Single NDK instance shared across entire app (90% reduction in WebSocket connections)
  - Eliminated redundant relay connections (4 relays instead of 36)
  - Improved connection stability and reliability
  - Better performance across all Nostr-dependent services
- **Stale-While-Revalidate Caching**: Instant data display with background updates
  - Data appears immediately from cache
  - Fresh data fetched in background and updates UI seamlessly
  - Dramatically improved perceived performance
- **Streamlined Loading Flow**: Removed redundant AppSplashScreen
  - Cleaner initialization process
  - Faster transition to main app
  - Reduced complexity in loading architecture

### Improved
- **Icon System**: Complete migration from emojis to Ionicons for professional appearance
  - Challenge icon now uses shield (ionicons: shield)
  - Zap icon now uses flash-outline (ionicons: flash-outline)
  - Season 1 leaderboard uses consistent Ionicon set
  - Better visual consistency across all screens
  - More accessible and platform-agnostic UI
- **Caching Architecture**: Migrated NavigationDataContext to UnifiedNostrCache
  - Single source of truth for all cached Nostr data
  - Better cache invalidation and refresh strategies
  - Improved data consistency across components
- **Profile Screen**: Enhanced performance with optimized data loading
  - Faster rendering of team memberships
  - More responsive workout history
  - Smoother scrolling and interactions
- **Activity Tracker UI**: Removed live kilometer splits display from running tracker
  - Cleaner, less cluttered interface during workouts
  - Focus on essential metrics (distance, pace, duration)
  - Improved readability while running
- **TTS Announcements**: Enhanced TTS service with better preference management
  - More reliable voice feedback during workouts
  - Improved settings synchronization
  - Better handling of user preferences

### Fixed
- **Team Stats Crashes**: Added defensive null checks for team.stats throughout codebase
  - Prevents crashes when team statistics are unavailable
  - Graceful degradation when stats data is missing
  - Improved app stability in TeamStatsGrid and TeamJoinModal components
- **NDK Initialization**: Resolved 'NDK not ready' error on discover page
  - Optimized ready state checks
  - Better handling of NDK initialization timing
  - More reliable team discovery on app launch
- **Amber Signer**: Fixed URI encoding for sign_event per NIP-55 spec
  - Proper event encoding in deep link URIs
  - Improved compatibility with Amber app
  - More reliable event signing flow
- **Join Request Publishing**: Automatic retry logic for failed join requests
  - Network failures no longer silently fail
  - Requests retry automatically until successful
  - Better user feedback on request status
- **Leaderboard Display**: Show all team members, including those with 0 workouts
  - Complete team roster visible on leaderboards
  - Members with no workouts shown at bottom
  - More accurate representation of team participation
- **League Loading**: Improved loading state handling with empty participant fallback
  - No more blank screens when league has no participants
  - Better loading indicators
  - Graceful handling of edge cases

## [0.1.7] - 2025-10-05

### Fixed
- **Distance Tracking Freeze**: Eliminated distance getting "stuck" during active workouts
  - Fixed distance freezing at specific values (e.g., stuck at 0.63 km) while GPS shows strong signal
  - Reduced GPS recovery buffer from 2 points to 1 point for faster recovery
  - Added 5-second timeout to GPS recovery mode (was 10 seconds)
  - Removed Android hysteresis filter that required 2 consecutive valid points
  - Reduced minimum movement threshold from 1.0m to 0.75m to prevent slow movement rejection
  - Added distance freeze detection logging to diagnose stuck distance issues
  - Distance now updates more responsively during brief GPS fluctuations
- **Background Distance Tracking**: Fixed distance not updating while app is backgrounded
  - Implemented periodic background location sync (every 5 seconds)
  - Background locations now processed through validation pipeline in real-time
  - No more "recalculation" when returning to app - distance updates continuously
  - Eliminates distance jumps when switching between apps
- **Distance Tracking Oscillation**: Eliminated GPS distance "bounce" during workouts
  - Fixed distance oscillating between values (e.g., 1.14 → 1.13 → 1.14 km)
  - Implemented monotonicity guarantee - distance never decreases during active tracking
  - Improved Kalman filter to use incremental filtering instead of cumulative overwrite
  - Reduced interpolation window from 5 seconds to 1 second to prevent prediction errors
  - Disabled distance prediction in background mode to prevent oscillations from throttled GPS
  - Prevents micro-oscillations from GPS coordinate jitter accumulating over time
- **Distance Calculation Method**: Switched from 3D to 2D horizontal distance
  - Changed to industry-standard 2D Haversine distance calculation
  - Matches Nike Run Club, Strava, Garmin, and official race distance measurement
  - Previously used 3D distance (including altitude changes) which inflated distances in hilly terrain
  - Elevation gain still tracked separately in `totalElevationGain` metric
  - Typical impact: 1-3% less distance on hilly routes compared to previous version

### Improved
- **Amber Signer Integration**: Enhanced reliability and user experience
  - Improved NDK signer authentication flow
  - Better error handling and user feedback
  - More robust callback handling for Amber responses
- **Settings Screen UI**: Polished toggle button layout and styling
  - Cleaner toggle button appearance and interactions
  - Improved visual consistency across settings options
  - Better spacing and alignment for all settings controls
- **Kilometer Splits Display**: Enhanced workout tracking UI
  - Improved splits visibility during active workouts
  - Better formatting and layout for split times
  - Clearer presentation of pace per kilometer
- **Workout History**: Local workouts now visible in timeline
  - HealthKit workouts appear in unified workout history
  - Seamless integration of local and Nostr-posted workouts
  - Complete workout history at a glance
- **Android Adaptive Icon**: Reduced icon size to 78% for better padding and visual balance
  - Shrunk ostrich logo from 1024x1024 to 799x799 on canvas
  - Added 113px padding around icon for proper spacing
  - Prevents logo clipping on various Android launcher styles
  - Better visual presentation across all Android devices and themes

## [0.1.5] - 2025-10-04

### Fixed
- **Amber Signing**: Calculate event ID before Amber signing to resolve permission errors
  - Fixed "Permission denied" errors when Amber users try to sign workout events
  - Event IDs are now properly generated before passing to Amber signer
  - Resolves compatibility issues with latest Amber versions
- **Location Tracking Reliability**: Android foreground service prevents Doze Mode from stopping GPS
  - Background location tracking now continues reliably during long workouts
  - Foreground service notification keeps location service active
  - Prevents Android battery optimization from killing workout tracking
- **Location Permission Flow**: Request permissions at login instead of run start
  - Smoother onboarding experience with upfront permission requests
  - Eliminates permission interruptions when starting first workout
  - Better UX for new users

### Improved
- **Kilometer Splits Display**: Removed redundant 'Recording' status indicator
  - Cleaner UI during workout tracking
  - Focus on actual workout metrics instead of status text
  - Improved kilometer splits visibility
- **Android App Icon**: Scaled down adaptive icon by 12% to prevent clipping
  - Fixed ostrich head being cut off on some Android launchers
  - Better visual presentation across all Android devices
  - Maintains proper padding for round icon masks

## [0.1.4] - 2025-10-04

### Fixed
- **Amber Authentication**: Complete support for all signing operations
  - Event signing now works properly with Amber signer
  - Improved callback handling and error messages
  - Better compatibility with latest Amber versions
- **Pace Display**: Workout summary now shows pace in MM:SS format instead of raw seconds
- **Onboarding Flow**: Welcome screens only show for new signups, not returning users
- **Auto-Login**: Restored automatic login with backward compatibility for team memberships

### Improved
- **UI Polish**: Refined visual elements throughout the app
  - Login button updated to orange background for brand consistency
  - Challenge wizard now uses minimalist Ionicons instead of emojis
  - Removed OR divider between Login and Start buttons for cleaner design
- **Performance**: Extended Season 1 cache duration from 5 minutes to 24 hours for faster loading

## [0.1.3] - 2025-10-04

### Changed
- **Theme Refresh**: Updated color scheme from black/white to orange/black
  - Primary action buttons now use RUNSTR orange (#FF6B35) for better brand identity
  - Improved visual hierarchy with orange accents throughout the app
  - Team cards, navigation elements, and CTAs feature new orange theme
  - Maintains dark mode foundation with strategic orange highlights

### Improved
- **Activity Tracker Enhancements**: Major improvements to workout tracking experience
  - **Smooth Distance Updates**: Distance now updates smoothly every second using Kalman filter velocity prediction
  - GPS accuracy remains unchanged - interpolation only affects UI display between GPS updates
  - Shows incremental progress (0.01 → 0.02 → 0.03 km) instead of jumpy updates (0 → 0.02 → 0.06)
  - Applied to all activity types: running, walking, and cycling
  - More responsive GPS tracking with better accuracy indicators
  - Enhanced pause/resume functionality with clearer visual states
  - Improved workout summary display with better stat formatting
  - Better handling of edge cases (GPS loss, app backgrounding)
- **Amber Login Flow**: Streamlined Nostr signer authentication
  - More reliable callback handling for Amber responses
  - Better error messages when Amber is not installed
  - Improved user guidance during sign-in process
  - Enhanced compatibility with latest Amber signer versions

### Fixed
- **Pace Display Bug**: Corrected workout summary pace from incorrect "483:60/km" to proper "MM:SS/km" format
  - WorkoutSummaryModal now uses ActivityMetricsService.formatPace() for correct seconds-to-minutes conversion
  - Fixes main pace stat, split paces, and average pace footer displays
  - Example: 0.13 km in 1:05 now correctly shows "8:20/km" instead of malformed values
- Activity tracker UI consistency across different workout types
- Orange theme application across all screens and components
- Amber authentication edge cases and timeout handling

## [0.1.2] - 2025-10-04

### Fixed
- **Build Compatibility**: Removed deprecated `expo-barcode-scanner` package
  - Package was removed from Expo SDK 52+ (app uses SDK 53)
  - Fixes "ExpoModulesCore/EXBarcodeScannerInterface.h not found" build error
  - All QR scanning functionality already uses `expo-camera` (no feature loss)
  - Reduces app size by removing unused module

### Changed
- **Version Updates**: Bumped app version to 0.1.2 across all platforms
  - Updated app.json, Android build.gradle, and iOS Info.plist
  - Incremented Android versionCode to 2 (required for app store updates)
  - Updated kind 1301 workout event client tags to report version 0.1.2
  - Updated test files and documentation to reflect new version

## [0.1.1] - 2025-10-03

### Added
- **QR-Based Event Joining**: Scan QR codes to instantly join competitions
  - Event QR code generation and display for captains
  - QR scanner with camera permissions for participants
  - Complete participant management system with join tracking
- **Dual-Path Challenge System**: Complete 1v1 competition infrastructure
  - Challenge creation wizard with activity type selection
  - Challenge acceptance/decline workflow
  - Dedicated leaderboard for head-to-head competitions
  - Navigation flow for browsing and managing challenges
- **Local Workout Persistence**: Activity tracker saves workouts locally before syncing
  - Prevents data loss during network issues
  - Background sync when connection restored
- **NIP-60 Wallet Enhancements**:
  - Encrypted proof backup to Nostr using NIP-44 encryption
  - Offline-first wallet initialization for instant load
  - Bulletproof duplicate wallet prevention

### Improved
- **Performance Optimizations**:
  - Extended league cache to 24 hours with pull-to-refresh
  - Instant app resume with persistent caching
  - Android performance improvements for team and wallet loading
- **GPS Tracking Reliability**:
  - GPS recovery timeout prevents distance tracking freeze
  - Better handling of GPS signal loss during workouts
- **Authentication Fixes**:
  - Proper NIP-55 Activity Result pattern for Amber signer
  - Flexible callback handler for various response formats
  - WorkoutSummaryModal uses correct nsec storage key

### Fixed
- Migrated Slider component to @react-native-community/slider for React Native 0.74+ compatibility
- Amber signer callback handling - Access result.extra instead of result.data
- Android SafeAreaView for proper status bar spacing
- Enable receive button with offline-first wallet initialization

## [0.1.0] - 2025-10-02

### Added
- **Enhanced Splash Screen**: New circular logo design with RUNSTR branding
  - Clean white border around app icon for better visual presentation
  - Improved logo sizing and positioning
  - Better image loading with proper resize modes

### Improved
- **App Icons**: Significantly optimized Android app icon file sizes (reduced by 60-80%)
  - All mipmap densities now use smaller, optimized PNG files
  - Better compression without quality loss
  - Faster app installation and reduced storage footprint
- **Splash Screen Assets**: Updated splash screen logos with optimized file sizes
- **Visual Consistency**: Unified branding across splash screen and app icons

## [0.0.9] - 2025-10-02

### Added
- **Quick Resume Mode**: Wallet now uses cached data for instant load when returning to app within 2 minutes
- **Background Network Initialization**: Network connections initialize in background when using cached wallet data
- **Current User Tracking**: Added pubkey verification to prevent wallet data conflicts between accounts

### Improved
- **Wallet Load Performance**:
  - Cache-first strategy for instant wallet initialization on app resume
  - Background Nostr sync after loading cached data (non-blocking)
  - 2-minute fresh threshold for cache validity
  - Automatic fallback to full sync when cache is stale
- **Splash Screen Assets**: Updated splash screen logos across all Android drawable densities for better visual quality
- **Wallet Reliability**: Enhanced initialization flow with better error handling and retry logic

### Fixed
- **Wallet Cache Freshness**: Fixed issue where stale cached wallet data could be used incorrectly
- **User Account Isolation**: Ensured each user's wallet cache is properly isolated by pubkey
- **Background Sync Errors**: Improved error handling for background wallet sync operations

## [0.0.8] - 2025-10-01

### Added
- **Season 1 Data Prefetching**: Season 1 leaderboard data now loads during splash screen for faster app experience
- **New App Icons**: Refreshed app icon design across all platforms (Android mipmap densities + iOS assets)
- **Wallet Proof Encryption**: NIP-44 encryption for backing up wallet proofs to Nostr
- **Pubkey-Specific Wallet Storage**: Each user's wallet data is now properly isolated by pubkey

### Improved
- **Wallet Service Reliability**:
  - Increased relay connection timeout from 5s to 10s for better relay discovery
  - Pubkey-specific storage keys prevent wallet data conflicts between accounts
  - Enhanced proof encryption/decryption with NIP-44 standard
  - Wallet event ID tracking to prevent duplicate wallet creation
- **Season 1 Service Performance**: Major refactoring of Season 1 service for better reliability and performance
- **Activity Tracker Screens**: Simplified and streamlined Running, Walking, and Cycling tracker UI
- **GPS Status Indicator**: Improved GPS accuracy feedback and status display
- **Notification System**: Enhanced challenge notifications with better event handling
- **UI Polish**:
  - Team header visual improvements
  - Bottom navigation refinements
  - Workout summary modal enhancements
  - Challenges card UI updates

### Fixed
- **Android SafeAreaView**: Proper status bar spacing configuration in AndroidManifest
- **Amber Authentication**: Fixed callback handling for Amber signer integration
- **Background Location**: Improved background location task reliability
- **Battery Optimization**: Better battery status monitoring during workouts

## [0.0.7] - 2025-10-01

### Added
- **Unified Notification System**: Complete in-app notification infrastructure with badge support
  - NotificationBadge component for visual notification indicators
  - NotificationItem component for individual notification display
  - NotificationModal for full notification management
  - UnifiedNotificationStore for centralized notification state management
- **Global Challenge Wizard**: Create 1v1 challenges with intelligent user discovery
  - Direct user-to-user competition creation
  - Smart user search and discovery system
  - Challenge configuration with custom parameters
- **Profile Photo Uploads**: Users can now upload and customize profile pictures
  - Integration with expo-image-picker for seamless photo selection
  - Profile image management and display
- **Enhanced Onboarding Wizard**: Improved first-time user experience with comprehensive profile setup

### Improved
- **Performance Optimizations**:
  - Team caching consolidated to single source of truth (TeamCacheService)
  - League loading dramatically improved with cache-first strategy
  - Reduced redundant API calls across the app
- **Activity Tracking**: Major improvements to workout tracking reliability
  - Fixed critical pause/resume timer bugs across all tracking services
  - Improved duration display using local timer instead of GPS session
  - Enhanced HealthKit workout integration and data accuracy
- **Workout History**: Better UI for workout display and button styling
- **Profile Screen**: Enhanced layout and improved user interface

### Fixed
- Critical HealthKit workout bugs (distance calculation, status tracking, deduplication)
- Race condition causing 'no pubkey available' error on startup
- Pause/resume timer issues in all activity tracker screens
- HealthKit workout deduplication and social posting workflow
- Activity Tracker duration display accuracy
- Workout History button styling and cleanup

## [0.0.6] - 2025-01-29

### Added
- **Onboarding Wizard**: New user onboarding experience with step-by-step setup guide
- **Profile Editing**: Enhanced profile editing capabilities with more customizable fields
- **Activity Tracker Updates**: Improved activity tracking with better accuracy and performance
- **UI Polish**: Multiple small UI fixes and visual improvements throughout the app

### Fixed
- **Npub/Nsec Generation**: Fixed key generation issues for new user accounts
- **Profile Editing Bugs**: Resolved various issues with profile updates not saving correctly
- **Activity Tracker**: Fixed tracking inconsistencies and improved reliability
- **Small Bug Fixes**: Multiple minor bug fixes for improved stability

### Improved
- Overall app performance and responsiveness
- User onboarding flow for better first-time experience
- Profile management functionality

## [0.0.5] - 2025-01-29

### Added
- **Activity Tab**: New dedicated tab for viewing and participating in RUNSTR Season 1 competitions
- **RUNSTR Season 1 Integration**: Full support for official RUNSTR leaderboards and competitions
- **Profile Tab Enhancements**: Improved profile screen with better stats display and user information management
- **Team Discovery Enhancements**: Refined team browsing experience with better filtering and search capabilities
- **Location Tracking**: GPS tracking for outdoor activities (running, walking, cycling) with background support
- **Live Workout Recording**: Real-time workout tracking with distance, pace, and route mapping
- **Battery Monitoring**: Smart battery level tracking for long workouts
- **Amber Signer Support**: Enhanced Nostr authentication with Amber signer integration

### Changed
- Navigation structure updated to include Activity tab for Season 1
- Profile screen layout optimized for better information hierarchy
- Team discovery page improved with faster loading and better categorization

### Fixed
- Various performance optimizations for smoother scrolling
- Improved relay connection stability
- Better handling of large team lists

## [0.0.3] - 2025-01-27

### Added
- User sign-up flow - streamlined onboarding experience for new users
- Edit Nostr profile - users can now update their profile details directly in the app
- Delete account option - complete account deletion with NIP-09 deletion requests
- Team banner support - teams can now display custom banner images
- Team banner editing - captains can upload and modify team banners
- Tournament/Events structure - new 2-tab organization for competitions
- Organized workout history - workouts now grouped into time-based folders for better navigation

### Changed
- **Profile Screen Redesign**: Streamlined UI with compact wallet display, removed tabs, integrated settings
- **Teams Discovery Page**: New expandable category sections for better team organization
- **Time Period Labels**: Simplified from "This Week/Earlier This Month" to "Week/Month/Year"
- **Theme Consistency**: Full grayscale theme implementation, removed colorful elements
- **NIP-60 Wallet**: Simplified to show only Lightning options, removed unnecessary complexity
- **Captain Badge**: Updated from yellow to black/white for theme consistency
- **Header Alignment**: Teams and Profile headers now use consistent centered styling

### Fixed
- Wallet infinite loading issue - resolved with dedicated NDK instance management
- Wallet relay connection problems - improved connection stability
- Duplicate NIP-60 wallet creation prevention
- Team navigation missing currentUserNpub parameter
- Banner display issues after team updates
- Activity types now properly persist when updating team URLs
- Team information from Profile tab navigation

### Improved
- **Performance**: Enhanced caching throughout the app for faster load times
- **Wallet Stability**: More reliable wallet initialization and connection handling
- **UI Consistency**: Unified header styles across all screens
- **Code Organization**: Cleaner component structure with removed duplications
- **Workout History**: Organized into collapsible time-based sections (Week/Month/Year)
- **Minor Bug Fixes**: Various small improvements and stability enhancements

### Removed
- Duplicate team section from Settings screen (already displayed on Profile)
- Redundant Activity Heatmap from Profile screen
- Stats overview box for cleaner interface
- Unnecessary UI clutter throughout the app

## [0.0.2] - 2025-01-24

### Added
- Rebranded app to RUNSTR TEAMS - displays as "Teams" on device
- Team shop linking capability - teams can link their merchandise store
- Flash Bitcoin subscription support - teams can offer Bitcoin-based subscriptions
- Charity showcase and zapping - support and zap charities directly from the app
- Prize pool display for leagues and events - transparent competition rewards

### Fixed
- NIP-60 wallet permanence issue - wallets now persist correctly across sessions
- Team information editing functionality - captains can now properly edit team details

### Changed
- App name from "RUNSTR REWARDS" to "RUNSTR TEAMS"
- Updated all branding assets with new RUNSTR TEAMS logo

## [0.0.1] - 2025-01-20

### Added
- Initial alpha release of RUNSTR
- Two-tab interface (Teams and Profile)
- Nostr authentication with nsec login
- Real-time team discovery from multiple Nostr relays
- Captain detection and dashboard access
- Competition wizard for Events and Leagues
- Team member management with join request approvals
- Dynamic scoring algorithms for competitions
- Bitcoin rewards via NIP-60/Cashu protocol
- HealthKit workout import and posting
- Beautiful workout social cards with SVG generation
- In-app notifications for competition events
- Pure Nostr data architecture (no backend required)

### Features
- **Authentication**: Direct Nostr login with profile auto-import
- **Team Management**: Create, join, and manage teams
- **Competitions**: 7 activity types with custom parameters
- **Leaderboards**: Real-time scoring based on captain rules
- **Workout Posting**: Share workouts as Nostr events (NIP-1301)
- **Social Cards**: Instagram-worthy achievement graphics
- **Bitcoin Integration**: Direct P2P payments, no team wallets

### Technical
- React Native with TypeScript (Expo framework)
- Pure Nostr data layer (no Supabase)
- NDK (@nostr-dev-kit/ndk) for all Nostr operations
- Kind 30000 lists for team membership
- Kind 1301 events for workout data
- 5-minute cache for member lists
- 1-minute cache for competition queries

### Known Limitations
- Debug build only (not optimized for production)
- Android only (iOS build pending)
- Requires manual nsec entry (no NIP-07 extension support yet)
- Limited to Damus, Primal, and nos.lol relays

### Security
- Secure nsec storage in AsyncStorage
- No external tracking or analytics
- All data stored on user-controlled Nostr relays
- End-to-end encrypted team communications