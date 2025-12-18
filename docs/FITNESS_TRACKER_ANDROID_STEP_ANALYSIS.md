# Android Step Tracking & Health Connect Integration - Comprehensive Analysis

**Date:** 2025-12-17
**Analyst:** Fitness Tracker Expert Agent
**Scope:** Android cardio tracking, step counting, Health Connect integration, calorie calculation, and GPS behavior

---

## Executive Summary

**CRITICAL FINDING:** Android step counting during cardio workouts is **ZERO** because the app uses **GPS-only tracking** by default. Steps are only populated when:
1. User imports workouts from Health Connect (post-workout)
2. Health Connect permissions are granted AND exercise sessions include step data

The app does NOT actively count steps during tracking - it only calculates distance from GPS coordinates.

---

## 1. How Step Tracking Works During Cardio Workouts

### GPS-Based Tracking Architecture (Default)

**File:** `src/services/activity/SimpleRunTracker.ts`

The app's primary tracking engine uses **GPS location data only**:

```typescript
// Lines 206-209: Memory-only GPS architecture
private cachedGpsPoints: GPSPoint[] = []; // Only last 100 points for elevation/route display
private lastGpsPoint: GPSPoint | null = null; // Last point for incremental distance
private runningDistance: number = 0; // Incrementally calculated distance (meters)
```

**Key Points:**
- Distance is calculated using **Haversine formula** from GPS coordinates (lines 852-866)
- Steps are **estimated from distance** using stride length, NOT counted in real-time
- No step sensor integration during active tracking sessions
- GPS points are processed in background via `SimpleRunTrackerTask.ts`

### Step Estimation Logic

**File:** `src/services/activity/ActivityMetricsService.ts`

```typescript
// Lines 132-134
estimateSteps(distanceMeters: number): number {
  return Math.round(distanceMeters / this.strideLength);
}
```

**Default stride length:** 0.73 meters (line 37)

**This means:**
- For a 1 km walk/run: ~1,370 steps (1000m ÷ 0.73m)
- Steps are **derived from GPS distance**, not sensor data
- If GPS distance is 0 (e.g., indoor treadmill, GPS signal loss), steps will be 0

---

## 2. Health Connect Integration (Android)

### Architecture Overview

**File:** `src/services/fitness/healthConnectService.ts`

Health Connect is an **optional, post-workout import system**, NOT real-time tracking:

```typescript
// Lines 82-89: Required permissions
const HEALTH_CONNECT_PERMISSIONS = [
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
];
```

### How Health Connect Workouts Are Imported

**Process Flow:**
1. User completes workout in **external app** (Google Fit, Samsung Health, etc.)
2. Workout is saved to **Health Connect database**
3. User opens RUNSTR → triggers `fetchRecentWorkouts()` (line 352)
4. RUNSTR queries Health Connect for `ExerciseSession` records
5. For each session, app fetches associated metrics:
   - Distance (lines 441-456)
   - Calories (lines 458-473)
   - **Steps** (lines 475-490)
   - Heart rate (lines 492-515)

**Critical Code - Step Fetching:**
```typescript
// Lines 475-490
try {
  const stepsRecords = await HealthConnect.readRecords('Steps', {
    timeRangeFilter: {
      operator: 'between',
      startTime: session.startTime,
      endTime: session.endTime,
    },
  });

  for (const record of stepsRecords?.records || []) {
    steps += record.count || 0;
  }
} catch (e) {
  debugLog('Health Connect: Could not fetch steps:', e);
}
```

**Why Steps Might Be Zero:**
1. **External app didn't write steps to Health Connect** (e.g., GPS-only cycling app)
2. **Step permission not granted** (line 888-895: `hasStepsPermission()`)
3. **No step data exists for that time range** (device doesn't have step sensor)
4. **Health Connect not available** (Android < 14 without Health Connect app installed)

### Daily Step Counter (Walking Screen)

**File:** `src/services/activity/DailyStepCounterService.ts`

Android uses **TWO different step counting methods:**

#### Method 1: Health Connect Aggregation (Primary - Lines 182-204)
```typescript
// Uses HealthConnect.aggregateRecord() for cumulative steps
const result = await HealthConnect.aggregateRecord({
  recordType: 'Steps',
  timeRangeFilter: {
    operator: 'between',
    startTime: todayStart,
    endTime: now,
  },
});

const totalSteps = result?.COUNT_TOTAL || 0;
```

**Requirements:**
- Health Connect installed AND authorized
- Device writing step data to Health Connect
- Steps permission granted

#### Method 2: Local Workout Tracking (Fallback - Lines 182-204)
```typescript
// Falls back to LocalWorkoutStorageService.getTodayTrackedSteps()
// Sums steps from completed workouts only
```

**File:** `src/services/fitness/LocalWorkoutStorageService.ts` (lines 824-844)
```typescript
async getTodayTrackedSteps(): Promise<{
  steps: number;
  workoutCount: number;
}> {
  const workouts = await this.getAllWorkouts();

  // Filter workouts for today that have step data
  const todayWorkouts = workouts.filter((workout) => {
    const workoutDate = new Date(workout.startTime);
    const isToday = workoutDate >= todayStart;
    const hasSteps = (workout.steps || 0) > 0;
    return isToday && hasSteps;
  });

  return {
    steps: totalSteps,
    workoutCount: todayWorkouts.length,
  };
}
```

**This method ONLY counts:**
- Completed workouts saved locally
- Workouts that already have step data populated
- Does NOT count steps during active tracking

---

## 3. GPS_TRACKER vs Step Tracking Relationship

**No direct relationship found.** There is NO `GPS_TRACKER` constant in the codebase.

**Search Results:**
```
src/services/fitness/LocalWorkoutStorageService.ts
src/services/ai/CoachClaudeService.ts
src/types/workout.ts
src/services/fitness/workoutMergeService.ts
```

**Closest match:** `source: 'gps_tracker'` in workout metadata (type field, not tracking mode)

**Actual GPS Tracking:**
- Task name: `SIMPLE_TRACKER_TASK = 'runstr-simple-tracker'` (SimpleRunTracker.ts line 42)
- Background task: `SimpleRunTrackerTask.ts` (registered with expo-task-manager)
- GPS updates handled via `Location.startLocationUpdatesAsync()` (SimpleRunTracker.ts line 402)

**Key Distinction:**
- **GPS tracking** = Active location monitoring during workout
- **Step tracking** = Either sensor-based (via Health Connect) OR calculated from GPS distance
- These are **independent systems** - GPS can work without steps, steps can exist without GPS

---

## 4. Calorie Calculation Logic

### For GPS-Tracked Workouts

**File:** `src/services/activity/ActivityMetricsService.ts` (lines 138-179)

**Formula:** MET (Metabolic Equivalent) × Weight (kg) × Duration (hours)

**MET Values by Activity & Speed:**

#### Running (lines 152-158):
```typescript
if (speedKmh < 8)  met = 8;   // Jogging
if (speedKmh < 10) met = 10;  // Running
if (speedKmh < 12) met = 11.5;
if (speedKmh < 14) met = 13;
else               met = 15;  // Fast running
```

#### Walking (lines 160-164):
```typescript
if (speedKmh < 3.2) met = 2.5;  // Slow walk
if (speedKmh < 4.8) met = 3.5;  // Normal walk
if (speedKmh < 6.4) met = 5;    // Brisk walk
else                met = 7;    // Fast walk / power walking
```

#### Cycling (lines 166-172):
```typescript
if (speedKmh < 16) met = 4;   // Leisure
if (speedKmh < 20) met = 6;
if (speedKmh < 24) met = 8;
if (speedKmh < 28) met = 10;
else               met = 12;  // Racing
```

**Default Weight:** 70 kg (154 lbs) - line 143

**Example Calculation (Walking):**
- Distance: 2 km
- Duration: 30 minutes (0.5 hours)
- Speed: 4 km/h → MET = 3.5
- Calories = 3.5 × 70 × 0.5 = **122.5 calories**

### For Health Connect Imported Workouts

**File:** `src/services/fitness/healthConnectService.ts` (lines 458-473)

Health Connect provides **actual calories burned** from external apps:

```typescript
const caloriesRecords = await HealthConnect.readRecords('ActiveCaloriesBurned', {
  timeRangeFilter: {
    operator: 'between',
    startTime: session.startTime,
    endTime: session.endTime,
  },
});

for (const record of caloriesRecords?.records || []) {
  totalCalories += record.energy?.inKilocalories || 0;
}
```

**Fallback:** If Health Connect doesn't provide calories, app uses ActivityMetricsService calculation

---

## 5. Airplane Mode Behavior During Tracking

### GPS Signal Loss Detection

**File:** `src/services/activity/SimpleRunTracker.ts`

**Watchdog System (lines 972-1002):**
```typescript
private readonly GPS_TIMEOUT_MS = 15000; // 15 seconds without GPS = dead
private readonly WATCHDOG_CHECK_MS = 5000; // Check every 5 seconds
private readonly MAX_GPS_RESTARTS = 100;

// Watchdog runs every 5 seconds
this.watchdogInterval = setInterval(async () => {
  const gap = Date.now() - this.lastGPSUpdate;

  if (gap > this.GPS_TIMEOUT_MS) {
    console.warn(`GPS silent for ${gap/1000}s - attempting recovery`);
    await this.attemptGPSRecovery();
  }
}, this.WATCHDOG_CHECK_MS);
```

**GPS Recovery Process (lines 1018-1059):**
1. Stop existing GPS task
2. Wait 500ms
3. Restart GPS via `initializeGPS()`
4. Reset last GPS timestamp
5. Retry up to 100 times (resets on successful GPS point)

### What Happens in Airplane Mode:

**Immediate Effects:**
1. **GPS signal lost** - no new coordinates received
2. **Distance stops accumulating** - Haversine calculation requires 2 points
3. **Duration continues counting** - timer is JS-based, not GPS-dependent (lines 132-142)
4. **Steps remain at last calculated value** - based on frozen distance

**Recovery Behavior:**
- **iOS:** GPS remains available in Airplane Mode (uses internal chip, not cellular)
- **Android:** GPS typically remains functional (separate from cellular radio)
- **Exception:** If user disables "Location" toggle, GPS will fail completely

**User Experience:**
```
Distance: 2.43 km → 2.43 km (frozen)
Duration: 15:23 → 15:24 → 15:25 (keeps counting)
Steps: 3,342 → 3,342 (frozen)
Elevation: 12 m → 12 m (frozen)
```

**Recovery Alert (lines 676-684):**
```typescript
if (timeSinceLastGPS > 30000 && this.gpsFailureCount > 3) {
  CustomAlert.alert(
    'GPS Signal Lost',
    'Distance tracking has stopped. Please ensure you have a clear view of the sky.',
    [{ text: 'OK', style: 'default' }]
  );
}
```

---

## 6. Potential Issues Causing Zero Step Counts

### Issue 1: GPS Distance is Zero

**Root Cause:** No valid GPS movement detected

**Scenarios:**
- Indoor treadmill workout (no GPS signal)
- Stationary bike workout
- GPS accuracy too poor (all points filtered out)
- Airplane mode with Location disabled

**Evidence:**
```typescript
// SimpleRunTrackerTask.ts lines 192-195
if (distance < thresholds.minDistance) {
  // Don't log - this is normal when stationary
  continue; // GPS jitter - ignore point
}
```

**Fix:** Steps should be populated from device step sensor, not GPS distance

---

### Issue 2: Health Connect Not Authorized

**Root Cause:** User hasn't granted Health Connect permissions

**Check:**
```typescript
// healthConnectService.ts line 888-895
async hasStepsPermission(): Promise<boolean> {
  const permissions = await HealthConnect.getGrantedPermissions();
  return permissions.some(
    (p: any) => p.recordType === 'Steps' && p.accessType === 'read'
  );
}
```

**Symptoms:**
- Daily step counter shows "Install Health Connect from Play Store for step counting"
- Imported workouts have 0 steps even though external app recorded them
- `getTodaySteps()` returns null

**Fix:** Request permissions via `healthConnectService.requestPermissions()`

---

### Issue 3: External App Doesn't Write Steps to Health Connect

**Root Cause:** Fitness app doesn't integrate with Health Connect

**Examples:**
- GPS-only cycling apps (distance but no steps)
- Manual entry apps (user logs workout, no sensor data)
- Apps that write to proprietary databases only

**Evidence:**
```typescript
// healthConnectService.ts lines 527-528
steps: steps > 0 ? steps : undefined,
```

**Detection:** Check `workout.metadata.sourceApp` - if it's a GPS-only app, steps won't be available

---

### Issue 4: Stride Length Incorrectly Configured

**Root Cause:** Default stride length doesn't match user's actual stride

**Default:** 0.73 meters (ActivityMetricsService.ts line 37)

**Impact on 1 km walk:**
- Default (0.73m): 1,370 steps
- Short stride (0.60m): 1,667 steps (+21%)
- Long stride (0.85m): 1,176 steps (-14%)

**Fix:** Allow user to calibrate stride length via Settings

---

### Issue 5: Walking Screen Uses Health Connect, Not Live Tracking

**File:** `src/screens/activity/WalkingTrackerScreen.tsx` (lines 165-200)

**Architecture Issue:**
```typescript
// Lines 171-179: Step counter checks Health Connect availability
const available = await dailyStepCounterService.isAvailable();
if (!available) {
  // Device doesn't support step counting - GPS-only mode
  setShowBackgroundBanner(false);
  if (Platform.OS === 'android') {
    setStepCounterError('Install Health Connect from Play Store for step counting');
  }
  return;
}
```

**This means:**
1. Daily step counter queries Health Connect for **all-day steps** (not workout-specific)
2. During active tracking, steps are **calculated from GPS distance**
3. After workout completes, steps are **saved to local storage**
4. Daily counter **sums local workout steps** if Health Connect unavailable

**Expected Behavior:**
- User starts walking workout → Distance tracking begins (GPS)
- Steps display updates every 5 seconds → **Calculated from GPS distance** (line 132: `estimateSteps()`)
- User completes workout → Steps saved to LocalWorkoutStorageService
- Next day, daily counter shows yesterday's workout steps

**Why Steps Might Be Zero:**
- GPS distance is 0 (no movement detected)
- GPS accuracy too poor (all points filtered)
- User is indoors (GPS signal blocked)
- Health Connect integration failed (permissions denied)

---

## 7. Architecture Recommendations

### Critical Gap: No Real-Time Step Sensor Integration

**Current State:**
- GPS-based distance → Estimated steps (stride length calculation)
- Health Connect integration → Post-workout import only
- No live step sensor reading during tracking

**Recommended Implementation:**

**1. Android Step Sensor Integration (ACTION_RECOGNITION)**
```typescript
// New service: LiveStepCounterService.ts
import { Sensors } from 'expo-sensors';

class LiveStepCounterService {
  private stepsSinceStart = 0;
  private subscription: any = null;

  async startCounting() {
    // Subscribe to device step counter
    this.subscription = await Sensors.Pedometer.watchStepCount(result => {
      this.stepsSinceStart = result.steps;
    });
  }

  getCurrentSteps(): number {
    return this.stepsSinceStart;
  }

  stopCounting() {
    this.subscription?.remove();
  }
}
```

**2. Hybrid Step Tracking**
```typescript
// Combine GPS distance + step sensor
calculateSteps(): number {
  // Use device step sensor if available
  if (this.liveStepCounter.isAvailable()) {
    return this.liveStepCounter.getCurrentSteps();
  }

  // Fallback to GPS-based estimation
  return this.estimateStepsFromDistance(this.runningDistance);
}
```

**3. Health Connect Write Support**
```typescript
// Write completed workouts to Health Connect
async writeWorkoutToHealthConnect(workout: RunSession) {
  await HealthConnect.writeRecords([
    {
      recordType: 'ExerciseSession',
      startTime: workout.startTime,
      endTime: workout.endTime,
      exerciseType: mapToHealthConnectType(workout.activityType),
    },
    {
      recordType: 'Steps',
      count: workout.steps,
      startTime: workout.startTime,
      endTime: workout.endTime,
    }
  ]);
}
```

---

## 8. Testing Checklist for Step Counting

### GPS-Only Tracking Test
- [ ] Start outdoor walk/run → Verify steps update based on distance
- [ ] Check step count every 100 meters → Should match `distance / stride_length`
- [ ] Complete workout → Verify final steps saved to LocalWorkoutStorageService
- [ ] View workout summary → Steps should be displayed

### Health Connect Import Test
- [ ] Complete workout in Google Fit (with step tracking enabled)
- [ ] Open RUNSTR → Trigger Health Connect sync
- [ ] Verify imported workout has step count
- [ ] Check if step count matches Google Fit

### Zero Step Count Scenarios
- [ ] Indoor treadmill workout → GPS distance = 0 → Steps = 0 (EXPECTED)
- [ ] Walk in GPS-blocked area (tunnel, dense building) → Steps may be 0
- [ ] Cycling workout → Steps may be 0 (correct - cycling doesn't generate steps)
- [ ] Health Connect not authorized → All imports have 0 steps

### Airplane Mode Test
- [ ] Start outdoor walk → Enable airplane mode after 1 km
- [ ] Verify distance freezes but duration continues
- [ ] Check step count → Should freeze at value when GPS lost
- [ ] Exit airplane mode → Verify GPS recovery within 15 seconds
- [ ] Complete workout → Check if recovered distance/steps are included

---

## 9. Key Files Reference

| File | Purpose | Lines of Interest |
|------|---------|------------------|
| `SimpleRunTracker.ts` | Main GPS tracking engine | 132-134 (steps), 852-866 (distance) |
| `SimpleRunTrackerTask.ts` | Background GPS processing | 119-221 (filtering), 239 (cache update) |
| `ActivityMetricsService.ts` | Step estimation & calorie calculation | 132-134 (steps), 138-179 (calories) |
| `healthConnectService.ts` | Health Connect integration | 352-415 (import), 475-490 (steps), 766-854 (daily steps) |
| `DailyStepCounterService.ts` | Daily step counter (Android/iOS) | 124-143 (getTodaySteps), 182-204 (Android method) |
| `LocalWorkoutStorageService.ts` | Workout persistence | 824-844 (getTodayTrackedSteps) |
| `WalkingTrackerScreen.tsx` | Walking UI | 165-200 (step counter init), 64-69 (metrics state) |

---

## 10. Conclusion

**Primary Finding:** Android step counts are zero during tracking because the app uses **GPS-only distance calculation** with stride-length-based step estimation. Steps are NOT counted via device sensors in real-time.

**Impact:**
- **Indoor workouts** (treadmill, stationary bike) show 0 steps
- **Poor GPS conditions** (tunnels, buildings) result in 0 steps
- **Airplane mode** freezes step count until GPS recovers
- **Health Connect imports** may have 0 steps if source app doesn't write step data

**Recommended Fix Priority:**
1. **HIGH:** Integrate live step sensor for walking/running activities
2. **MEDIUM:** Add Health Connect write support (so RUNSTR workouts appear in other apps)
3. **LOW:** Improve GPS filtering to reduce false zero-step scenarios

**Current Workarounds:**
- Use Health Connect import for accurate step data (post-workout)
- Ensure GPS signal is strong before starting outdoor workouts
- Accept estimated steps from GPS distance for now
