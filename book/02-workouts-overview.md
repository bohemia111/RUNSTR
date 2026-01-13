# Chapter 2: Workouts Overview

## Summary

RUNSTR transforms your smartphone into a powerful GPS fitness tracker for running, walking, and cycling. When you're ready to work out, simply select your activity type, hold the start button through a deliberate countdown, and begin moving. The app tracks your distance, duration, pace, elevation gain, and kilometer splits in real-time, giving you the metrics you need to understand your performance as it happens.

The tracking experience prioritizes intentionality and reliability. The hold-to-start mechanism prevents accidental workout starts while giving your phone's GPS time to acquire a strong signal. During your workout, you can pause and resume freely without losing any data—perfect for stopping at traffic lights or taking a water break. The interface displays your most important metrics prominently, with secondary stats readily available.

When you finish your workout, you're presented with two clear options: Compete or Post. Tapping Compete publishes your workout as a kind 1301 event to Nostr, making it visible to the decentralized network. Tapping Post opens the Enhanced Share Modal, where you can choose from different visual templates to create a social post celebrating your achievement. Leaderboard results are calculated outside of the app by aggregating kind 1301 events from Nostr, then displayed inside the app with updates every 2 minutes.

Privacy sits at the core of RUNSTR's workout architecture. While the app uses GPS to calculate your metrics, your actual route coordinates never leave your device. Only aggregated data—total distance, duration, elevation gain—gets published if you choose to share. This means you can participate in competitions and share achievements without revealing where you run, walk, or cycle.

RUNSTR also integrates with Apple Health on iOS and Health Connect on Android, allowing workouts tracked by other apps or wearables to sync into RUNSTR. These imported workouts qualify for rewards and can be published to competitions, giving you flexibility in how you track your fitness while still participating in the RUNSTR ecosystem.

---

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
1. **Compete** - Publishes kind 1301 event to Nostr (counts for competitions/leaderboards)
2. **Post** - Opens Enhanced Share Modal with different style templates for social posting (kind 1)

---

## GPS Data Handling

RUNSTR takes a privacy-conscious approach to GPS data:

### Local Storage Only

- **Last 100 GPS points** are held in memory during tracking for real-time route display
- **Old points are deleted** to make room for new ones as you move
- GPS coordinates are used locally for distance calculation and route visualization
- **GPS coordinates are NEVER published** to Nostr or any external server

### What Gets Published vs. What Stays Local

| Data Type | Published | Stays Local |
|-----------|-----------|-------------|
| Distance (total) | ✅ Yes | - |
| Duration | ✅ Yes | - |
| Activity type | ✅ Yes | - |
| Elevation gain/loss | ✅ Yes | - |
| Split times | ✅ Yes | - |
| GPS coordinates | ❌ Never | ✅ Local only |
| Route map | ❌ Never | ✅ Local only |
| Real-time location | ❌ Never | ✅ Local only |

### Technical Implementation

```typescript
// SimpleRunTracker.ts - GPS point management
private cachedGpsPoints: GPSPoint[] = []; // Only last 100 points

// Trim to last 100 points when exceeded
if (this.cachedGpsPoints.length > 100) {
  this.cachedGpsPoints = this.cachedGpsPoints.slice(-100);
}
```

The `data_points` tag in kind 1301 events only records **how many** GPS points were collected, not the actual coordinates.

---

## Health Integrations

RUNSTR syncs with external fitness platforms:

### iOS: HealthKit
- Automatic import of Apple Watch workouts
- Step count integration
- Heart rate data (when available)
- **Imported workouts qualify for rewards**

### Android: Health Connect
- Google Health Connect API (Android 14+)
- Step count from phone sensors
- Exercise sessions from other apps
- **Imported workouts qualify for rewards**

### Garmin & Other Wearables
- No direct integration
- Garmin data syncs through Apple Health or Health Connect
- Workouts flow: Garmin → Apple Health → RUNSTR

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
