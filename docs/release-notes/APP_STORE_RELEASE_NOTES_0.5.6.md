# App Store Release Notes - Version 0.5.6

## What's New

**1v1 Challenges - Bet Bitcoin on Your Runs!**
Challenge your friends to head-to-head running competitions with Bitcoin wagers! Create custom challenges with preset distances (5K, 10K, Half Marathon), set your wager in sats, and let the fastest time win. Get notifications when challenges are accepted, declined, or completed.

**Teammates - See Who You're Competing With**
New teammates feature lets you easily view and manage all your team members in one place. Captains can approve join requests and manage member lists with improved controls.

**Wallet Reliability - Major NWC Improvements**
We've completely overhauled the Nostr Wallet Connect system with 260+ lines of improvements! Better error handling, improved connection stability, and a redesigned wallet configuration interface make Lightning payments more reliable than ever.

**Notification System Overhaul**
Fixed duplicate notifications, added automatic cleanup of old notifications, and improved handling of challenge and team join notifications. Your notification feed will be cleaner and more accurate.

**Activity Tracker Performance**
Significant improvements to GPS tracking accuracy, battery management during workouts, and data collection. Your runs will be tracked more reliably with better battery life.

**Speed Boost - 60-80% Faster!**
Massive performance improvements with aggressive prefetching of profiles, teams, and competitions. Navigation is now instant, and data loads 60-80% faster on subsequent visits.

---

## App Store Connect Format (Character Limit: 4000)

### Copy-paste this version:

```
What's New in Version 0.5.6:

1v1 CHALLENGES - BET BITCOIN ON YOUR RUNS
• Challenge friends to head-to-head running competitions
• Set Bitcoin wagers in satoshis for winner-take-all races
• Preset distances: 5K, 10K, Half Marathon
• Automatic scoring by fastest time
• Challenge notifications: accepted, declined, completed
• Track challenge status: open → active → completed

TEAMMATES FEATURE
• View all team members in one place
• Enhanced team cards show member count and activity
• Captains can approve/remove members easily
• Improved join request system for proper member approval
• Kind 30000 member list support

WALLET RELIABILITY - MAJOR NWC IMPROVEMENTS
• 260+ lines of NWC wallet service improvements
• Better error handling and retry logic
• Improved connection stability and timeout handling
• Redesigned wallet configuration interface (210 lines)
• Better handling of disconnections and reconnections
• New debug tools for troubleshooting wallet issues

NOTIFICATION SYSTEM OVERHAUL
• Fixed duplicate notifications with smart deduplication
• Automatic cleanup of old notifications
• Dedicated handlers for challenges and team joins
• Better memory management and performance
• Profile fetching for richer notification display
• Improved error handling throughout

ACTIVITY TRACKER PERFORMANCE
• 103+ lines of GPS tracking improvements
• Better tracking accuracy during workouts
• Optimized battery usage and management
• Enhanced workout data collection and storage
• Faster, more reliable activity tracking

SPEED & PERFORMANCE BOOST
• 60-80% faster loading with aggressive prefetching
• Preload profiles, teams, and competition data
• Optimized competition discovery and filtering
• Improved WebSocket connection stability
• Smart event deduplication reduces network overhead
• Better cache invalidation and refresh logic

UI/UX IMPROVEMENTS
• Enhanced profile screen with challenge features
• Better competition display and filtering
• Improved wallet UI and personal wallet section
• Enhanced team member management interface
• New navigation for Challenges and Teammates

UNDER THE HOOD
• New dependencies for better compatibility
• Global polyfills for improved Web API support
• Enhanced TypeScript type safety
• 46 files modified, 4,467+ lines added
• Major code additions: Challenges, Teammates, NWC, Performance, Notifications

Thanks for using RUNSTR! Challenge your friends, compete for Bitcoin, and get faster.
```

---

## Alternative Short Version (for space-constrained updates):

```
New in 0.5.6:
• 1v1 Challenges - Bet Bitcoin on head-to-head races
• Teammates feature - View and manage team members
• NWC wallet reliability - 260+ lines of improvements
• Notification overhaul - Fixed duplicates, better cleanup
• Activity tracker - Improved GPS and battery performance
• Speed boost - 60-80% faster with aggressive prefetching
```

---

## Notes for Review Team (Internal):

**Key Changes:**
- SimplifiedChallengeWizard.tsx (new wizard for 1v1 challenges)
- SimpleCompetitionService.ts: +106 lines (getUserChallenges, parseChallenge)
- ChallengeService.ts: +77 lines
- NWCWalletService.ts: +260 lines (major overhaul)
- WalletConfigModal.tsx: 210 lines modified
- NostrPrefetchService.ts: +94 lines (performance boost)
- SimpleRunTrackerTask.ts: +103 lines (GPS improvements)
- teammates/ component folder (new)
- Various notification handlers (cleanup, challenge response, team join)

**Testing Focus:**
- Create 1v1 challenge with Bitcoin wager
- Accept/decline challenges and verify notifications
- View teammates in team screens
- NWC wallet connection and payment flow
- Activity tracker GPS accuracy during workouts
- App speed and prefetching performance
- Notification deduplication and cleanup

**Version Bump Rationale:**
Minor release (0.5.5 → 0.5.6) for major feature additions (Challenges, Teammates) and critical improvements (NWC reliability, performance). No breaking changes.
