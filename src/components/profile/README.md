# Profile Components Directory

User profile screen components and profile-related functionality.

## Architecture Overview

The profile section uses a **Public/All tab architecture** with enhanced workout management:

- **Public Tab** - Shows published Nostr kind 1301 workout events
- **All Tab** - Unified view merging HealthKit, Garmin, Google Fit, and Nostr workouts
- **Sync Dropdown** - Manual import control for various fitness data sources
- **Post/Compete Actions** - Buttons to share workouts socially or enter competitions
- **Monthly Organization** - Workouts grouped by month for better navigation

## Files

- **CompactTeamCard.tsx** - 72px compact team card for multi-team display with avatar, badges, and rank
- **CompactWallet.tsx** - Compact wallet display with balance and action buttons
- **MonthlyStatsPanel.tsx** - Monthly statistics panel
- **MyTeamsBox.tsx** - Displays user's team memberships
- **NotificationBadge.tsx** - Red notification badge with unread count
- **NotificationItem.tsx** - Individual notification card component
- **NotificationModal.tsx** - Full-screen notification feed modal
- **PersonalWalletSection.tsx** - Personal wallet management section
- **ProfileHeader.tsx** - Profile screen header with user information and avatar
- **TeamManagementSection.tsx** - Team membership display with conditional rendering
- **WalletSection.tsx** - Bitcoin wallet section for profile screen
- **WatchSyncSection.tsx** - Apple Watch sync section
- **WorkoutLevelRing.tsx** - Workout level progress ring
- **WorkoutsTab.tsx** - Public/All tab navigation with sync dropdown
- **WorkoutTabNavigator.tsx** - Workout tab navigation component
- **YourCompetitionsBox.tsx** - Shows user's active competitions
- **YourWorkoutsBox.tsx** - Displays user's recent workouts

## Subdirectories

- **shared/** - Reusable workout display and action components
- **tabs/** - Public and All workout tab implementations
