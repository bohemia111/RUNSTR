# Changelog

All notable changes to RUNSTR will be documented in this file.

## [1.4.6] - 2026-01-10 - Simplification & Refactoring

### Leaderboard Improvements
- Enhanced leaderboard performance and visual design
- Improved ranking accuracy and display

### Running Bitcoin Challenge
- Updated Running Bitcoin event configuration

### UI Simplification
- Simplified Activity Tracker interface for cleaner experience
- Streamlined Rewards screen layout

### Codebase Improvements
- Major refactoring effort (~20k lines of code simplified)
- Bug fixes and UI polish throughout the app

---

## [1.4.5] - 2026-01-08 - Performance & Polish

### Performance Improvements
- Increased overall app speed and responsiveness
- Optimized Nostr queries for faster data loading
- Reduced memory usage across all screens

### Leaderboard Improvements
- Enhanced leaderboard performance and accuracy
- Improved ranking calculations
- Better caching for faster leaderboard updates

### UI Updates
- Polished interface elements throughout the app
- Improved visual consistency
- Minor layout refinements

### Bug Fixes
- Various stability improvements
- Minor bug fixes across the app

---

## [1.4.4] - 2026-01-08 - Step Competitions & Performance

### New Features
- **Step Daily Leaderboard**: New daily leaderboard for step counting competitions
- **Compete/Post for Steps**: Added compete and post functionality to step tracking

### Performance
- Increased app speed and performance across all screens

---

## [1.4.2] - 2026-01-05 - UI Simplification & Performance

### UI Simplification
- Streamlined navigation with cleaner interface
- Removed custom event creation (use standard event wizard instead)
- Consolidated all competitions into the Events page for easier discovery

### Access Control
- Gated experimental features to Season II participants only
- PPQ.AI integration, AI model selection, and Advanced Analytics now require Season Pass

### Performance
- Improved leaderboard performance across all screens
- Optimized Nostr queries for faster data loading

---

## [1.4.0] - 2026-01-03 - Rewards Tab Refresh & Leaderboard Performance

### New Features
- **Impact Level System**: New donation-based leveling system with XP, streak bonuses, and level titles
- **Weekly Rewards Card**: Shows sats earned this week with 7-dot workout streak indicator
- **Personal Impact Section**: Breakdown of your donation history by charity
- **Donation Splits Redesign**: Card-style UI with charity avatar, lightning address, and zap button
- **Running Bitcoin Event**: Special charitable event for ALS Network

### UI Improvements
- Moved "Import from Nostr" button to fitness tracking screen
- Moved RUNSTR Premium features to Settings → Experimental section
- Rewards tab completely redesigned with accordion sections
- Zap buttons styled consistently across the app (outline icon)

### Performance Optimizations
- Leaderboard query performance improvements
- Reduced redundant Nostr queries

---

## [1.3.1] - 2025-12-31 - Bug Fixes

### UI Updates
- "FITNESS TRACKER" → "START WORKOUT" on profile
- "FITNESS HISTORY" → "VIEW HISTORY" on profile
- "FITNESS COMPETITIONS" → "BROWSE COMPETITIONS" on profile
- Team zap buttons now match daily leaderboard style (outline icon)

### Bug Fixes
- Fixed donation split bug (rewards now correctly split with selected team)
- Fixed "undefined is not a function" crash on Leaderboards tab (Map serialization)

## [1.3.0] - 2025-12-31 - Season II Launch & Performance

### Season II
- Registration closed UI with lock icon and closed date
- Removed entry fee display (prizes are sponsor-funded)
- Event-tagged workouts system for reliable leaderboards

### Performance Optimizations
- Season 2 leaderboard: 30s to ~2.5s load time
- AsyncStorage pre-fetch before Nostr queries
- Non-blocking cache writes
- Fixed TTL calculation bug (was 164 years, now 60 days)
- Reduced relay count from 9 to 3 defaults
- Reduced query timeouts for faster responses

### Bug Fixes
- Workout history tab switching no longer flashes "no history"
- Background step tracking toggle now persists across restarts
- Daily steps compete button works with both Amber and nsec signing
- Walking tracker uses same GPS thresholds as running tracker

### UI Improvements
- More compact Routes button
- Tab switching uses display:none pattern (instant switching)

## [1.2.6] - 2025-12-30 - Bug Fixes & UI Updates

### New Teams
- Added Bitcoin Basin team

### UI Updates
- Updated cycling tracker UI
- Updated event creation UI

### Leaderboard
- Added more participants to Season II leaderboard

### Improvements
- Minor improvements to cardio tracker

## [1.2.5] - 2025-12-28 - Simplification

### UI Updates
- Profile Screen redesign
- Bottom navigation buttons

### Teams
- Charities are now teams
- Team competitions added as option in event creation

### Coach RUNSTR
- Bringing your own key is now optional
- Improved prompts

### RUNSTR Premium
- Stats renamed to Premium
- Re-introduced the level system

### Activity Tracker
- Added Compete button to daily steps

### Bug Fixes
- NWC wallet disconnect
- Sign out deletes local data
- Apple Health workouts showing up as "other"
- Reward donation split problems

## [1.2.3] - 2025-12-23

### New Features
- **Workout Pledge System**: Join paid events by pledging future workout rewards instead of paying upfront
  - Commit N daily workouts and rewards go to event destination (captain or charity)
  - One active pledge at a time, no cancellation once committed
  - Progress tracking with ActivePledgeCard on Rewards screen
- **SimpleEventWizardV2**: Redesigned single-page event creation - all options on one screen
- **Enhanced Event Join Flow**: Join events with pledge payment option

### Improvements
- Improved reward earned modal with enhanced UI
- Better frozen event caching with additional utility methods
- Enhanced Season 2 and Satlantis event hooks
- Updated event creation and publishing flow

### Bug Fixes
- Share modal stability improvements
- Workout event store refinements

## [1.2.2] - 2025-12-23

### Bug Fixes
- Fixed share screen crash on Android caused by invalid `transformOrigin` CSS property
- Improved walk tracker GPS accuracy with tuned thresholds (stricter 35m accuracy, looser 12m/s speed filter)
- Reduced GPS recovery skip points from 3 to 2 to minimize distance loss during walks

### Performance Improvements
- Added FrozenEventStore for permanent caching of ended event data (zero network calls for completed events)
- Memory cache initialization during app startup for instant frozen event access

### New Features
- GPS Permissions Diagnostics component in Settings > Fitness Tracking (Android only)
- Shows status and fix actions for: Location Services, Background Location, Location Accuracy, Battery Optimization

## [1.2.1] - 2025-12-20

### Bug Fixes
- Fixed version display in Settings screen (was showing outdated 1.0.5)
- Minor stability improvements

### Walk Tracker Simplification
- **Simplified to match Running Tracker**: Shows distance + duration as hero metrics during active tracking
- **No more step confusion**: Removed step count display during active walks (Health Connect batching caused 0-step display)
- **Clean data sources**: Tracked Steps card now only pulls from Health Connect (no local workout mixing)

## [1.2.0] - 2025-12-XX

### Features
- Major UI/UX improvements
- Enhanced user experience across all screens

## [1.1.0] - 2025-XX-XX

### Features
- Step counter integration
- Coach Claude AI assistant
- Various bug fixes

## [1.0.5] - 2025-XX-XX

### Bug Fixes
- Season II optimization
- Web of Trust (WOT) improvements
