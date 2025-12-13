# Satlantis Services

Services for integrating with Satlantis calendar events (NIP-52) to display virtual race leaderboards.

## Files

### SatlantisEventService.ts
Discovers and parses NIP-52 calendar events (kind 31923) from Nostr relays.
- `discoverSportsEvents(filter?)` - Query sports events with optional filters
- `getEventById(eventId, pubkey)` - Fetch single event by ID
- Parses event metadata: title, dates, location, sport type, distance
- 5-minute cache for discovery, 1-hour cache for single events

### SatlantisRSVPService.ts
Fetches RSVPs (kind 31925) for calendar events to get participant lists.
- `getEventRSVPs(eventPubkey, eventDTag)` - Get all RSVPs for an event
- `getEventParticipants(eventPubkey, eventDTag)` - Get accepted participant pubkeys
- `getParticipantCount(eventPubkey, eventDTag)` - Get count for display
- Deduplicates RSVPs by user (keeps most recent)
- 5-minute cache TTL

## Usage

```typescript
import { SatlantisEventService } from './SatlantisEventService';
import { SatlantisRSVPService } from './SatlantisRSVPService';

// Discover sports events
const events = await SatlantisEventService.discoverSportsEvents({
  sportTypes: ['running'],
  includePast: false,
});

// Get participants for an event
const participants = await SatlantisRSVPService.getEventParticipants(
  event.pubkey,
  event.id
);
```

## Nostr Event Kinds

- **Kind 31923**: Calendar events (NIP-52)
- **Kind 31925**: RSVPs referencing calendar events via `a` tag
