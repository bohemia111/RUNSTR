# SimpleRunTracker Code Review Document

**Prepared for Senior Developer Review**
**Date:** December 2, 2025
**Files:** `src/services/activity/SimpleRunTracker.ts` (1006 lines), `SimpleRunTrackerTask.ts` (196 lines)

---

## Executive Summary

The SimpleRunTracker is a GPS-based workout tracking system for React Native (Expo). It uses a **dual-component architecture**: a main service class that runs in the foreground, and a TaskManager background task that collects GPS points even when the app is minimized.

**Recent Fix:** Added battery optimization exemption request for Android to prevent OS from killing background location service.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
│                  (RunningTrackerScreen.tsx)                      │
│                                                                  │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│   │   Duration   │    │   Distance   │    │     Pace     │      │
│   │   00:25:30   │    │   3.42 km    │    │  7:28 /km    │      │
│   └──────────────┘    └──────────────┘    └──────────────┘      │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    UI polls every ~1 second
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SimpleRunTracker.ts                           │
│                    (Singleton Service)                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ SimpleDurationTracker (lines 72-166)                       │ │
│  │ - Pure timestamp math: (now - startTime - pausedTime)      │ │
│  │ - No setInterval timers - calculated on-demand             │ │
│  │ - Survives app restarts via state persistence              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ GPS Points Cache (in-memory)                               │ │
│  │ - cachedGpsPoints: GPSPoint[] (max 10,000 points)         │ │
│  │ - Haversine distance calculation                           │ │
│  │ - Real-time updates from background task                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ AsyncStorage Persistence                                   │ │
│  │ - @runstr:gps_points (GPS coordinates)                    │ │
│  │ - @runstr:session_state (tracker state)                   │ │
│  │ - Write queue with 10-second flush interval                │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │
            appendGpsPointsToCache() called directly
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                SimpleRunTrackerTask.ts                           │
│                (Background TaskManager Task)                     │
│                                                                  │
│  - Registered in index.js BEFORE app initialization              │
│  - Receives GPS updates from expo-location                       │
│  - Filters invalid points (accuracy, jitter, teleportation)     │
│  - Sends valid points to SimpleRunTracker singleton              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ GPS Validation Pipeline:                                  │   │
│  │ 1. Accuracy check (reject if > 35m)                      │   │
│  │ 2. GPS warm-up buffer (skip first 3 points)              │   │
│  │ 3. Minimum time interval (1 second)                       │   │
│  │ 4. GPS jitter filter (ignore < 1.5m movement)            │   │
│  │ 5. Teleportation filter (reject > 50m jumps)             │   │
│  │ 6. Speed validation (reject > 15 m/s = 54 km/h)          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    expo-location                                 │
│                (Native GPS Hardware)                             │
│                                                                  │
│  Location.startLocationUpdatesAsync(SIMPLE_TRACKER_TASK, {      │
│    accuracy: BestForNavigation,                                  │
│    timeInterval: 1000ms,                                         │
│    distanceInterval: 2m,                                         │
│    foregroundService: { ... }  // Android notification           │
│  })                                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Dual Data Sources: Timer vs GPS

| Component | Source | Purpose | Reliability |
|-----------|--------|---------|-------------|
| Duration | `SimpleDurationTracker` | Stopwatch timer | 100% - pure math |
| Distance | GPS cache | Distance in meters | ~95% - depends on GPS |

**Why separate?** GPS signal can be lost (tunnels, buildings), but the timer should keep counting. Users expect the stopwatch to be accurate even if distance isn't updating.

### 2. Singleton Pattern (lines 171-221)

```typescript
export class SimpleRunTracker {
  private static instance: SimpleRunTracker;

  static getInstance(): SimpleRunTracker {
    if (!SimpleRunTracker.instance) {
      SimpleRunTracker.instance = new SimpleRunTracker();
    }
    return SimpleRunTracker.instance;
  }
}
```

**Why?** Only one tracking session can be active at a time. The singleton ensures the background task always communicates with the same instance.

### 3. Instant Start Pattern (lines 229-276)

```typescript
async startTracking(activityType, presetDistance): Promise<boolean> {
  // INSTANT: Set state immediately (no await blocking)
  this.sessionId = `run_${Date.now()}`;
  this.isTracking = true;
  this.durationTracker.start(this.startTime);

  // Background tasks (don't block UI)
  this.initializeGPS(activityType).catch((error) => {
    // Timer still runs even if GPS fails!
  });

  return true;  // Returns immediately
}
```

**Why?** User expects the timer to start counting immediately when they tap "Start". GPS initialization can take 2-5 seconds, so it runs in background.

### 4. Write Queue for AsyncStorage (lines 722-752)

```typescript
private flushPendingPointsToStorage(): void {
  const pointsToSave = [...this.pendingPoints];
  this.pendingPoints = [];

  this.writeQueue = this.writeQueue.then(async () => {
    this.isWriting = true;
    await this.appendGpsPointsToStorage(pointsToSave);
    this.isWriting = false;
  });
}
```

**Why?** AsyncStorage has concurrency issues. If multiple writes happen simultaneously, it throws "Sync already in progress" errors. The queue serializes all writes.

### 5. GPS Recovery Mode (lines 623-656)

When GPS signal is lost for >10 seconds then recovered, the first few points are often inaccurate (GPS "jumps"). The tracker skips the first 3 recovery points.

```typescript
if (this.isInGPSRecovery) {
  if (this.recoveryPointsSkipped < 3) {
    this.recoveryPointsSkipped++;
    // Still add to cache for route but don't count for distance
    this.cachedGpsPoints.push(...points);
    return;
  }
}
```

---

## Critical Code Sections

### Android Battery Optimization (NEWLY ADDED - lines 288-300)

```typescript
if (Platform.OS === 'android') {
  try {
    const batteryService = BatteryOptimizationService.getInstance();
    await batteryService.requestBatteryOptimizationExemption();
  } catch (e) {
    console.warn('[SimpleRunTracker] Battery optimization request failed:', e);
  }
}
```

**Purpose:** Android aggressively kills background services to save battery. Without exemption, location tracking stops after ~30 seconds when user switches to another app (like Spotify).

**What it does:**
1. Shows alert explaining why exemption is needed
2. Opens Android settings with `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` intent
3. User enables "Unrestricted" mode
4. Tracks that user was prompted (won't spam on subsequent runs)

### Foreground Service Configuration (lines 330-344)

```typescript
await Location.startLocationUpdatesAsync(SIMPLE_TRACKER_TASK, {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 2,
  foregroundService: {
    notificationTitle: `RUNSTR - Running Tracking`,
    notificationBody: 'Tap to return to your run',
    notificationColor: '#FF6B35',
  },
  pausesUpdatesAutomatically: false,
  activityType: Location.ActivityType.Fitness,
  showsBackgroundLocationIndicator: true,
});
```

**Note:** Missing `notificationPriority: 'max'` - may want to add for more aggressive OEMs (Samsung, Xiaomi).

### Haversine Distance Calculation (lines 824-838)

```typescript
private haversineDistance(p1: GPSPoint, p2: GPSPoint): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (p1.latitude * Math.PI) / 180;
  const φ2 = (p2.latitude * Math.PI) / 180;
  const Δφ = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const Δλ = ((p2.longitude - p1.longitude) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
```

**Standard implementation** of the Haversine formula for great-circle distance.

---

## Background Task (SimpleRunTrackerTask.ts)

### GPS Validation Pipeline (lines 66-169)

| Filter | Threshold | Purpose |
|--------|-----------|---------|
| Accuracy | > 35m reject | Poor GPS signal |
| Warm-up | Skip first 3 | Initial GPS lock inaccuracy |
| Time interval | < 1s reject | Reduce noise |
| Jitter | < 1.5m ignore | Stationary noise |
| Teleportation | > 50m reject | GPS jumps |
| Speed | > 15 m/s reject | Impossible movement |

**Note:** 15 m/s = 54 km/h - reasonable max for cycling, but might reject downhill cycling.

### Direct Cache Update (lines 178-181)

```typescript
// REAL-TIME UPDATES: Update SimpleRunTracker cache directly!
simpleRunTracker.appendGpsPointsToCache(validLocations);
```

**Architecture decision:** The background task directly calls the singleton's method. This avoids having to poll AsyncStorage from the UI thread.

---

## Session Persistence & Recovery

### Saved State (lines 860-881)

```typescript
const state: SessionState = {
  sessionId: this.sessionId,
  activityType: this.activityType,
  isTracking: this.isTracking,
  isPaused: this.isPaused,
  startTime: this.startTime,
  pauseCount: this.pauseCount,
  presetDistance: this.presetDistance,
  // Duration tracker state
  trackerStartTime: trackerState.startTime,
  trackerTotalPausedTime: trackerState.totalPausedTime,
  trackerPauseStartTime: trackerState.pauseStartTime,
};
```

### Restore Session (lines 929-1001)

Called when app returns to foreground. Restores:
1. Session metadata
2. Duration tracker state
3. GPS points from storage
4. Restarts GPS tracking if needed

---

## Potential Concerns for Review

### 1. Memory Management
- `cachedGpsPoints` capped at 10,000 points
- AsyncStorage capped at 5,000 points
- For a 2-hour run at 1 point/second = 7,200 points (within limits)

### 2. Error Handling
- GPS failures don't crash the app (timer keeps running)
- AsyncStorage failures are logged but don't stop tracking
- User is alerted after 30 seconds of GPS loss

### 3. Background Task Reliability
- Task must be registered in index.js before app init
- Foreground service keeps task alive on Android
- iOS has ~30 min limit without native HKWorkoutSession (currently disabled)

### 4. Race Conditions
- Write queue serializes AsyncStorage operations
- GPS warm-up buffer prevents initial spike
- Recovery mode prevents post-tunnel distance spikes

### 5. Testing Recommendations
1. Fresh install on Android → verify battery optimization prompt appears
2. Start run → switch to Spotify → verify distance continues tracking
3. Run through tunnel → verify no phantom distance after exit
4. 30+ minute run → verify no memory issues
5. App kill/restart mid-run → verify session restores correctly

---

## Files Summary

| File | Lines | Purpose |
|------|-------|---------|
| `SimpleRunTracker.ts` | 1006 | Main tracking service (singleton) |
| `SimpleRunTrackerTask.ts` | 196 | Background GPS collection task |
| `BatteryOptimizationService.ts` | 497 | Android battery exemption handling |
| `SplitTrackingService.ts` | ~150 | Kilometer split calculations |
| `TTSAnnouncementService.ts` | ~100 | Voice announcements |

---

## Recent Change Log

**December 2, 2025:**
- Added `BatteryOptimizationService.requestBatteryOptimizationExemption()` call in `initializeGPS()`
- Purpose: Fix Android background tracking being killed when user switches apps
- Root cause: Service existed but was never called

---

*Document generated for senior developer code review*
