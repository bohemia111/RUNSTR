# Satlantis Screens

Screens for Satlantis race event discovery and detail views.

## Files

### SatlantisDiscoveryScreen.tsx
Main discovery feed for browsing sports events from Satlantis.
- Sport type filter chips (All, Running, Cycling, Walking)
- FlatList of SatlantisEventCard components
- Pull-to-refresh functionality
- Empty state with helpful messaging

### SatlantisEventDetailScreen.tsx
Event detail view with metadata and leaderboard.
- Event image with placeholder
- Status badge (UPCOMING / LIVE / ENDED)
- Metadata: start/end time, location, distance, participants, sport type
- Description section
- SatlantisLeaderboard component with zap functionality
- Satlantis attribution

## Navigation

Access via ProfileScreen "Race Events" menu item:
- `SatlantisDiscovery` - Main discovery feed
- `SatlantisEventDetail` - Event detail with params `{ eventId, eventPubkey }`
