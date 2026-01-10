# Chapter 2: Workouts Overview

## What is a Workout in RUNSTR?

A workout in RUNSTR is any fitness activity that a user tracks through the app. Workouts can be:
- **GPS-tracked** - Running, walking, cycling with real-time location
- **Manually entered** - Strength training, diet logging, wellness activities
- **Health-synced** - Imported from HealthKit, Health Connect, or Garmin

Once saved, workouts can be published to the Nostr network as **kind 1301 events**, making them visible on leaderboards and creating a permanent fitness record.

---

## Four Activity Categories

RUNSTR organizes activities into four main categories:

### 1. Cardio
GPS-tracked outdoor activities with distance, pace, and elevation metrics.

| Activity | Tracking Method | Key Metrics |
|----------|-----------------|-------------|
| Running | GPS | Distance, pace, splits, elevation |
| Walking | GPS + Steps | Distance, steps, pace |
| Cycling | GPS | Distance, speed, elevation |

### 2. Strength
Manual entry for gym and bodyweight exercises.

| Activity | Entry Method | Key Metrics |
|----------|--------------|-------------|
| Weights | Manual | Sets, reps, weight |
| Pushups | Manual | Reps |
| Pullups | Manual | Reps |

### 3. Diet
Meal and nutrition tracking.

| Activity | Entry Method | Key Metrics |
|----------|--------------|-------------|
| Meals | Manual | Meal type, size |
| Fasting | Timer | Duration |

### 4. Wellness
Mind-body activities.

| Activity | Entry Method | Key Metrics |
|----------|--------------|-------------|
| Meditation | Timer | Duration, type |
| Yoga | Timer/Manual | Duration |

---

## Publishing to Nostr

Workouts are stored locally first, then optionally published to Nostr:

### Kind 1301 Events
The standard Nostr event type for fitness data. Publishing a workout as kind 1301:
- Makes it visible on RUNSTR leaderboards
- Creates a permanent, decentralized record
- Allows other Nostr fitness apps to read your data

### Two Publishing Options
1. **Save to Nostr** - Publishes kind 1301 event (for competitions)
2. **Post to Nostr** - Creates social post with workout card (kind 1)

---

## Health Integrations

RUNSTR syncs with external fitness platforms:

### iOS: HealthKit
- Automatic import of Apple Watch workouts
- Step count integration
- Heart rate data (when available)

### Android: Health Connect
- Google Health Connect API (Android 14+)
- Step count from phone sensors
- Exercise sessions from other apps

### Garmin
- OAuth-based Garmin Connect sync
- 7-day historical import
- Automatic activity type mapping

---

## Technical Section

### Core Services

| Service | File | Purpose |
|---------|------|---------|
| WorkoutEventStore | `src/services/fitness/WorkoutEventStore.ts` | In-memory workout cache |
| LocalWorkoutStorageService | `src/services/fitness/LocalWorkoutStorageService.ts` | AsyncStorage persistence |
| WorkoutPublishingService | `src/services/nostr/workoutPublishingService.ts` | Nostr event creation |

### Data Flow

```
User tracks workout
        ↓
SimpleRunTracker (GPS) or ManualWorkoutScreen (manual)
        ↓
LocalWorkoutStorageService.saveWorkout()
        ↓
Stored in AsyncStorage
        ↓
[Optional] WorkoutPublishingService.publishToNostr()
        ↓
Kind 1301 event published to 4 relays
        ↓
WorkoutEventStore cache invalidated
        ↓
Leaderboards updated
```

### WorkoutEventStore

The `WorkoutEventStore` is the **single source of truth** for workout data in memory:

```typescript
// Key methods
getAllWorkouts(): StoredWorkout[]
getWorkoutsByUser(pubkey: string): StoredWorkout[]
getTodaysWorkouts(): StoredWorkout[]
getEventWorkouts(start, end, participants): StoredWorkout[]
```

Features:
- Singleton pattern (one global instance)
- Backed by AsyncStorage for persistence
- 2-day fetch window from relays for performance
- Subscription system for component updates

### Key Interfaces

```typescript
interface StoredWorkout {
  id: string;
  pubkey: string;
  teamId?: string;
  activityType: string;
  distance?: number;  // meters
  duration?: number;  // seconds
  calories?: number;
  pace?: number;      // seconds per km
  elevation?: number; // meters
  createdAt: number;  // unix timestamp
  splits?: Map<number, number>;
  eventIds?: string[];
}
```

---

## What Workouts Should Be

### Ideal Architecture
1. **Local-first** - All workouts stored locally before publishing
2. **User control** - User decides what to publish and when
3. **Simple categories** - Four clear categories (Cardio, Strength, Diet, Wellness)
4. **Automatic sync** - Health platforms sync in background
5. **Single cache** - WorkoutEventStore is the only source of truth

### What to Avoid
- Multiple competing cache systems
- Automatic publishing without user consent
- Complex workout type hierarchies
- Direct relay queries bypassing WorkoutEventStore

---

## Navigation

**Previous:** [Chapter 1: Introduction](./01-introduction.md)

**Next:** [Chapter 3: Workout Tracking](./03-workouts-tracking.md)

**Table of Contents:** [Back to TOC](./00-table-of-contents.md)
