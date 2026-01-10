# Chapter 5: Workout Storage & Publishing

## Local-First Storage

RUNSTR follows a **local-first** approach: all workouts are stored locally before being published to Nostr. This ensures:
- Workouts are never lost due to network issues
- User controls when/what to publish
- Fast, responsive UI without network dependency

---

## Storage Flow

```
Workout Completed
        ↓
LocalWorkoutStorageService.saveWorkout()
        ↓
Stored in AsyncStorage
        ↓
User chooses to publish?
        ↓
    YES → WorkoutPublishingService.publishToNostr()
        ↓
    Kind 1301 event sent to 4 relays
        ↓
    WorkoutEventStore cache invalidated
```

---

## Workout Sources

Workouts can come from multiple sources:

| Source | Description | Sync Method |
|--------|-------------|-------------|
| `gps_tracker` | In-app GPS tracking | Real-time |
| `manual_entry` | User manual input | On save |
| `healthkit` | Apple HealthKit | Background sync |
| `health_connect` | Android Health Connect | Background sync |
| `garmin` | Garmin Connect | OAuth sync |
| `nostr` | Imported from Nostr | One-time import |

---

## Health Integrations

### iOS: HealthKit

**File:** `src/services/fitness/healthKitService.ts`

Features:
- Auto-import Apple Watch workouts
- Step count integration
- Heart rate data when available
- Background sync capability

```typescript
// Key methods
initializeHealthKit(): Promise<void>
fetchWorkouts(since: Date): Promise<HealthKitWorkout[]>
fetchStepCount(date: Date): Promise<number>
```

Type Mapping:
| HealthKit Code | RUNSTR Type |
|----------------|-------------|
| 37 | running |
| 52 | walking |
| 13 | cycling |
| 24 | hiking |
| 20, 50, 59 | strength |

### Android: Health Connect

**File:** `src/services/fitness/healthConnectService.ts`

Features:
- Google Health Connect API (Android 14+)
- Step count from phone sensors
- Exercise sessions from other apps

```typescript
// Key methods
initializeHealthConnect(): Promise<void>
readExerciseSessions(since: Date): Promise<ExerciseSession[]>
readStepCount(date: Date): Promise<number>
```

### Garmin

**File:** `src/services/fitness/garminActivityService.ts`

Features:
- OAuth-based authentication
- 7-day historical import
- Progressive chunk loading
- Deduplication by activity ID

```typescript
// Key methods
syncActivities(): Promise<GarminActivity[]>
getActivityDetails(activityId: string): Promise<ActivityDetails>
```

---

## Publishing to Nostr

### WorkoutPublishingService

**File:** `src/services/nostr/workoutPublishingService.ts`

Two publishing methods:

#### 1. Save to Nostr (Kind 1301)
For competition entry - structured workout data.

```typescript
async saveWorkoutToNostr(
  workout: PublishableWorkout,
  signer: NDKSigner,
  userId: string
): Promise<WorkoutPublishResult>
```

#### 2. Post to Nostr (Kind 1)
For social sharing - beautiful workout card with image.

```typescript
async postToNostr(
  workout: PublishableWorkout,
  options: SocialPostOptions,
  signer: NDKSigner
): Promise<WorkoutPublishResult>
```

### Publishing Flow

```
User taps "Save to Nostr"
        ↓
Build kind 1301 event with tags
        ↓
Sign event with user's nsec
        ↓
GlobalNDKService.publish() to 4 relays
        ↓
Mark workout as synced in LocalWorkoutStorageService
        ↓
Invalidate WorkoutEventStore cache
        ↓
Check reward eligibility (DailyRewardService)
        ↓
Show success toast
```

### Relay Distribution

Events are published to 4 relays:
- `wss://relay.damus.io`
- `wss://relay.primal.net`
- `wss://nos.lol`
- `wss://relay.nostr.band`

---

## Technical Section

### LocalWorkoutStorageService

**File:** `src/services/fitness/LocalWorkoutStorageService.ts`

Main storage service for local workouts:

```typescript
// Key methods
saveGPSWorkout(workout: GPSWorkout): Promise<string>
saveManualWorkout(workout: ManualWorkout): Promise<string>
getAllWorkouts(): Promise<LocalWorkout[]>
getUnsyncedWorkouts(): Promise<LocalWorkout[]>
markAsSynced(workoutId: string, nostrEventId: string): Promise<void>
deleteWorkout(workoutId: string): Promise<void>
```

### LocalWorkout Interface

```typescript
interface LocalWorkout {
  id: string;
  type: WorkoutType;
  startTime: string;
  endTime: string;
  duration: number;
  distance?: number;
  calories?: number;
  elevation?: number;
  pace?: number;
  splits?: Split[];

  // Source tracking
  source: 'gps_tracker' | 'manual_entry' | 'healthkit' | ...;
  syncedToNostr: boolean;
  nostrEventId?: string;

  // Activity-specific fields
  reps?: number;
  sets?: number;
  meditationType?: string;
  mealType?: string;
}
```

### AsyncStorage Keys

| Key | Purpose |
|-----|---------|
| `local_workouts` | Array of LocalWorkout objects |
| `workout_id_counter` | Unique ID generation |
| `nostr_workout_import_completed` | One-time import flag |

### WorkoutEventStore

**File:** `src/services/fitness/WorkoutEventStore.ts`

In-memory cache for published workouts:

```typescript
// Singleton access
const store = WorkoutEventStore.getInstance();

// Query methods
store.getAllWorkouts(): StoredWorkout[]
store.getWorkoutsByUser(pubkey): StoredWorkout[]
store.getTodaysWorkouts(): StoredWorkout[]
store.getEventWorkouts(start, end, participants): StoredWorkout[]

// Updates
store.refresh(): Promise<void>
store.subscribe(callback): () => void
```

### Cache Invalidation

When a workout is published:

```typescript
// In WorkoutPublishingService
CacheInvalidationService.invalidateWorkouts();

// This triggers WorkoutEventStore to:
// 1. Clear in-memory cache
// 2. Re-fetch from relays
// 3. Notify subscribers
```

---

## Reward Triggering

Publishing a workout triggers reward eligibility check:

```typescript
// After successful publish
await DailyRewardService.checkStreakAndReward(
  userPubkey,
  workout.source  // 'gps_tracker' or 'manual_entry'
);
```

Only certain sources qualify for rewards:
- `gps_tracker` - GPS-tracked workouts
- `manual_entry` - User-entered workouts

HealthKit/Garmin imports do NOT trigger rewards (prevents gaming).

---

## What Storage Should Be

### Ideal Architecture
1. **Single local store** - LocalWorkoutStorageService only
2. **Single cache** - WorkoutEventStore only
3. **Explicit publish** - User always chooses to publish
4. **Clean sync status** - Clear tracking of what's synced

### What to Avoid
- Multiple competing storage services
- Automatic publishing without consent
- Duplicate workouts from multiple imports
- Cache inconsistencies

---

## Navigation

**Previous:** [Chapter 4: Workout Data Model](./04-workouts-data-model.md)

**Next:** [Chapter 6: Events Overview](./06-events-overview.md)

**Table of Contents:** [Back to TOC](./00-table-of-contents.md)
