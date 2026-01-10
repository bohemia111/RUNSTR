# Chapter 8: Event Leaderboards

## How Leaderboards Work

Leaderboards show ranked participants based on their workout performance during an event. Rankings are calculated from:
- **Participant list** - Who joined the event (from Supabase)
- **Workout data** - Kind 1301 events from Nostr
- **Scoring rules** - Total distance, workout count, etc.

---

## Leaderboard Display

### Activity Tabs

Each leaderboard has tabs for different activities:
- **Running** - Running workouts only
- **Walking** - Walking workouts only
- **Cycling** - Cycling workouts only

Users can switch tabs to see rankings for each activity type.

### Leaderboard Entry

Each entry shows:
- **Rank** - Position (1, 2, 3...)
- **Avatar** - User's profile picture
- **Name** - Display name from Nostr profile
- **Total Distance** - Sum of all qualifying workouts
- **Workout Count** - Number of workouts completed

```
┌───┬─────────────────────┬────────┐
│ 1 │ 🏅 guy      87.1 km │ 10 Runs│
│ 2 │ 🥈 JokerHas 83.1 km │ 7 Runs │
│ 3 │ 🥉 LOPES    45.0 km │ 15 Runs│
│ 4 │    Adrien   42.2 km │ 5 Runs │
│ 5 │    johnny9  38.5 km │ 8 Runs │
└───┴─────────────────────┴────────┘
```

---

## Data Sources

### Participant List (Supabase)
- Query `event_participants` table
- Get list of pubkeys who joined the event
- Cache for performance

### Workout Data (Nostr)
- Query kind 1301 events from participants
- Filter by event date range
- Filter by activity type
- Sum distances per user

### Hybrid Approach

```
Get participants from Supabase
        ↓
For each participant:
  Query kind 1301 events from Nostr
        ↓
Filter workouts by:
  - Activity type (running/walking/cycling)
  - Date range (event start → end)
        ↓
Calculate totals:
  - Total distance (sum)
  - Workout count
        ↓
Sort by total distance (descending)
        ↓
Display ranked leaderboard
```

---

## Scoring Metrics

### Primary: Total Distance
Sum of all workout distances during event period.

```typescript
const totalDistance = workouts.reduce(
  (sum, w) => sum + (w.distance || 0),
  0
);
```

### Secondary: Workout Count
Number of qualifying workouts.

```typescript
const workoutCount = workouts.length;
```

### Displayed Format
- Distance: `87.1 km` or `54.1 mi`
- Count: `10 Runs` or `7 Walks`

---

## Baseline System

For long events like Season II, a **baseline system** improves performance:

### Problem
Fetching 2 months of workouts from Nostr on every load is slow.

### Solution
Pre-compute totals at a snapshot date, then only fetch recent workouts.

```typescript
// Baseline data (pre-computed)
const SEASON2_BASELINE = {
  snapshotDate: '2026-01-15',
  participants: [
    { pubkey: '...', running: 50.5, walking: 20.0, cycling: 30.0 },
    { pubkey: '...', running: 45.2, walking: 15.5, cycling: 25.0 },
    // ...
  ]
};

// Runtime calculation
const currentTotal = baseline.running + freshWorkoutsSinceSnapshot.running;
```

---

## Technical Section

### Season2Service Leaderboard Methods

**File:** `src/services/season/Season2Service.ts`

```typescript
// Get leaderboard for specific activity
async getLeaderboard(
  activityType: 'running' | 'walking' | 'cycling'
): Promise<LeaderboardEntry[]>

// Get all three leaderboards at once
async getAllLeaderboards(): Promise<{
  running: LeaderboardEntry[];
  walking: LeaderboardEntry[];
  cycling: LeaderboardEntry[];
}>

// Build leaderboard from fresh Nostr data
async buildLeaderboardsFromFresh(): Promise<LeaderboardData>

interface LeaderboardEntry {
  rank: number;
  pubkey: string;
  name: string;
  picture?: string;
  totalDistance: number;  // in km
  workoutCount: number;
  charityId?: string;
}
```

### Workout Queries

```typescript
// Query kind 1301 events for participants
const filter = {
  kinds: [1301],
  authors: participantPubkeys,
  since: eventStartTimestamp,
  until: eventEndTimestamp,
};

const events = await ndk.fetchEvents(filter);
```

### Filtering by Activity

```typescript
// Filter by exercise type
const runningWorkouts = workouts.filter(w =>
  w.activityType === 'running'
);

const walkingWorkouts = workouts.filter(w =>
  w.activityType === 'walking'
);

const cyclingWorkouts = workouts.filter(w =>
  w.activityType === 'cycling'
);
```

### Caching

| Data | Cache TTL | Location |
|------|-----------|----------|
| Leaderboard | 5 minutes | Memory |
| Baseline | Static | Code |
| Participants | 5 minutes | AsyncStorage |

---

## UI Components

### Season2Leaderboard

**File:** `src/components/season2/Season2Leaderboard.tsx`

```typescript
interface Season2LeaderboardProps {
  activityType: 'running' | 'walking' | 'cycling';
  currentUserPubkey?: string;
}
```

Features:
- Activity tab selector
- Scrollable list
- Current user highlighted
- Pull-to-refresh
- Loading states

### LeaderboardLimiter

**File:** `src/components/ui/LeaderboardLimiter.tsx`

Limits displayed entries with "Show More" button:
- Initially shows top 10
- Expand to show all participants
- Collapse back to top 10

---

## What Leaderboards Should Be

### Ideal Architecture
1. **Fast loading** - Baseline + fresh data pattern
2. **Accurate data** - Real kind 1301 events from Nostr
3. **Clear ranking** - Obvious who's winning
4. **Activity filtering** - Easy tab switching
5. **Current user visible** - Highlight logged-in user

### What to Avoid
- Full relay queries on every load
- Complex scoring algorithms
- Multiple competing leaderboard services
- Stale cached data

---

## Navigation

**Previous:** [Chapter 7: Joining Events](./07-events-joining.md)

**Next:** [Chapter 9: Rewards Overview](./09-rewards-overview.md)

**Table of Contents:** [Back to TOC](./00-table-of-contents.md)
