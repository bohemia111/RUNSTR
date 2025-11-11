# Core Services

Core application services that manage app-wide functionality.

## Files

**AppInitializationService.ts** - Background data initialization service
- Loads user data (profile, teams, workouts, wallet, competitions) in background
- Non-blocking initialization - app shows immediately while data loads
- Replaces the old SplashInitScreen blocking UI
- Uses GlobalNDKService for Nostr connections
- Implements intelligent caching and timeout handling

**AppStateManager.ts** - App state lifecycle management
- Single source of truth for app foreground/background state
- Prevents multiple conflicting AppState listeners
- Manages app resume/pause events
- Handles background location tracking cleanup
