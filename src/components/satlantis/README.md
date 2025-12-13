# Satlantis Components

UI components for displaying Satlantis race events and leaderboards.

## Files

### SatlantisEventCard.tsx
Card component for the event discovery feed.
- Event image with placeholder fallback
- Status badge (UPCOMING / LIVE / ENDED)
- Title, date, location metadata
- Sport type and distance tags
- Participant count display

### SatlantisLeaderboard.tsx
Event leaderboard with zap capability.
- Uses ZappableUserRow for each participant
- Fastest-time ranking display
- Any user can zap any participant
- Empty states for upcoming events / no workouts
- Live update hint during active events

## Usage

```tsx
import { SatlantisEventCard } from './SatlantisEventCard';
import { SatlantisLeaderboard } from './SatlantisLeaderboard';

// Event card in feed
<SatlantisEventCard
  event={event}
  onPress={() => navigate('EventDetail')}
  participantCount={25}
/>

// Leaderboard in event detail
<SatlantisLeaderboard
  entries={leaderboard}
  isLoading={false}
  eventStatus="live"
  currentUserNpub={user?.npub}
/>
```
