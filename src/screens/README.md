# Screens Directory

Main application screens for the RUNSTR mobile app's user interface.

## Subdirectories

- **activity/** - Activity tracking screens (running, cycling, walking, meditation, strength, diet)
- **routes/** - Route management screens (saved routes library, route details, comparisons)

## Files

- **CaptainDashboardScreen.tsx** - Captain management interface for team oversight and competition creation
- **ChallengeDetailScreen.tsx** - Instant 1v1 running challenges (4 distances, fastest-time only, tag-based)
- **ChallengeLeaderboardScreen.tsx** - Challenge leaderboard with fastest-time comparison
- **CompetitionsListScreen.tsx** - List all user competitions with tabbed view (teams/leagues/events/challenges) (~500 lines)
- **EnhancedTeamScreen.tsx** - Enhanced team view with leagues, events, challenges tabs
- **EnhancedWorkoutHistoryScreen.tsx** - Enhanced workout history with advanced filtering
- **EventDetailScreen.tsx** - Team event details with location, charity support, and entry controls
- **LoginScreen.tsx** - Nostr authentication screen with nsec input
- **OnboardingScreen.tsx** - Initial app onboarding and setup flow
- **ProfileEditScreen.tsx** - Edit profile information and settings
- **ProfileImportScreen.tsx** - Initial profile setup and Nostr data import
- **ProfileScreen.tsx** - User profile tab with workout history and settings
- **SettingsScreen.tsx** - App settings and configuration screen
- **TeamDiscoveryScreen.tsx** - Browse and discover teams from Nostr relays
- **TeamScreen.tsx** - Main teams tab with team feed and creation options
- **WalletScreen.tsx** - Bitcoin wallet interface for competition earnings
- **WorkoutHistoryScreen.tsx** - Unified workout timeline with HealthKit + Nostr workouts