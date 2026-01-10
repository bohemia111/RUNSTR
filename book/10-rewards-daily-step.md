# Chapter 10: Daily & Step Rewards

## Daily Workout Rewards

### Eligibility
To earn the daily 50 sats reward:

| Requirement | Details |
|-------------|---------|
| Workout saved | Must save workout in the app |
| Qualifying source | GPS tracker or manual entry |
| Once per day | Max 1 reward per 24 hours |
| Minimum distance | 1km (for GPS workouts) |

### Non-Qualifying Sources
These do NOT trigger rewards:
- HealthKit imports
- Health Connect imports
- Garmin imports
- Previously imported Nostr workouts

**Why?** To prevent gaming - users could import endless historical workouts.

### Atomic Streak Tracking

Streak tracking uses an **atomic marker** to prevent race conditions:

```typescript
// Set marker BEFORE sending reward
const markerKey = `@runstr:streak_incremented_today:${dateStr}`;
await AsyncStorage.setItem(markerKey, Date.now().toString());

// Only first workout of day gets past this check
```

This ensures:
- Rapid back-to-back saves don't trigger multiple rewards
- Only the first qualifying workout earns the reward
- No duplicate payments

---

## Step Milestone Rewards

### How It Works

```
Steps:    0 → 999 → 1000 → 1999 → 2000 → ...
Reward:       ❌      ✓       ❌      ✓
```

Every time step count crosses a 1,000 threshold, user earns 5 sats.

### Milestone Detection

```typescript
// Check if new milestone reached
function getNewMilestones(previousSteps: number, currentSteps: number): number[] {
  const previousMilestone = Math.floor(previousSteps / 1000);
  const currentMilestone = Math.floor(currentSteps / 1000);

  const newMilestones = [];
  for (let m = previousMilestone + 1; m <= currentMilestone; m++) {
    newMilestones.push(m * 1000);
  }
  return newMilestones;
}

// Example: previousSteps=1500, currentSteps=3200
// Returns: [2000, 3000]
```

### Daily Reset

Step milestones reset at midnight:
- New date = new milestone tracking
- Previous day's milestones don't carry over
- Storage key includes date: `@runstr:step_milestones:2026-01-09`

---

## Step Polling

### StepPollingService

**File:** `src/services/rewards/StepPollingService.ts`

Polls device step count every 60 seconds while app is active:

```typescript
// Polling loop
setInterval(async () => {
  const currentSteps = await getStepCount();
  await checkAndRewardMilestones(currentSteps);
}, 60000);
```

### App State Integration

Polling only runs when app is in foreground:

```typescript
// Start/stop based on app state
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    startPolling();
  } else {
    stopPolling();
  }
});
```

---

## Technical Section

### DailyRewardService

**File:** `src/services/rewards/DailyRewardService.ts`

```typescript
// Main entry point - called after workout saved
async function checkStreakAndReward(
  userPubkey: string,
  workoutSource: string
): Promise<void> {
  // 1. Check if source qualifies
  if (!['gps_tracker', 'manual_entry'].includes(workoutSource)) {
    return; // Silent exit
  }

  // 2. Check if already rewarded today
  const alreadyRewarded = await hasRewardedToday(userPubkey);
  if (alreadyRewarded) {
    return; // Silent exit
  }

  // 3. Set atomic marker
  await setRewardMarker(userPubkey);

  // 4. Send reward
  await sendReward(userPubkey);
}
```

### StepRewardService

**File:** `src/services/rewards/StepRewardService.ts`

```typescript
// Called by StepPollingService
async function checkAndRewardMilestones(
  currentSteps: number,
  userPubkey: string
): Promise<void> {
  // 1. Get today's achieved milestones
  const achieved = await getAchievedMilestones(userPubkey);

  // 2. Calculate new milestones
  const currentMilestone = Math.floor(currentSteps / 1000) * 1000;
  const newMilestones = [];

  for (let m = 1000; m <= currentMilestone; m += 1000) {
    if (!achieved.includes(m)) {
      newMilestones.push(m);
    }
  }

  // 3. Send rewards for new milestones
  for (const milestone of newMilestones) {
    await sendMilestoneReward(userPubkey, milestone);
    await markMilestoneAchieved(userPubkey, milestone);
  }
}
```

### Counter Storage

```typescript
// Increment counters after successful reward
async function updateCounters(userPubkey: string, amount: number) {
  // Total lifetime
  const totalKey = `@runstr:total_rewards_earned:${userPubkey}`;
  const total = (await getNumber(totalKey)) + amount;
  await setNumber(totalKey, total);

  // Weekly (resets Monday)
  const weekKey = getWeekKey(); // e.g., "2026-W02"
  const weeklyKey = `@runstr:weekly_rewards_earned:${userPubkey}:${weekKey}`;
  const weekly = (await getNumber(weeklyKey)) + amount;
  await setNumber(weeklyKey, weekly);
}
```

### Streak Calculation

```typescript
// Calculate consecutive days with workouts
async function getStreakDays(userPubkey: string): Promise<number> {
  const workouts = await LocalWorkoutStorageService.getAllWorkouts();
  const userWorkouts = workouts.filter(w => w.pubkey === userPubkey);

  let streak = 0;
  let checkDate = new Date();

  while (true) {
    const dateStr = formatDate(checkDate);
    const hasWorkout = userWorkouts.some(w =>
      formatDate(new Date(w.startTime)) === dateStr
    );

    if (!hasWorkout) break;

    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}
```

---

## Flow Diagrams

### Daily Reward Flow

```
User saves workout
        ↓
checkStreakAndReward(pubkey, source)
        ↓
Is source 'gps_tracker' or 'manual_entry'?
        ↓
    NO → Exit silently
    YES ↓
Already rewarded today?
        ↓
    YES → Exit silently
    NO ↓
Set atomic marker (timestamp)
        ↓
Get user's Lightning address
        ↓
Request invoice via LNURL
        ↓
RewardSenderWallet.sendPayment()
        ↓
Update total/weekly counters
        ↓
Show toast notification
```

### Step Reward Flow

```
StepPollingService (every 60s)
        ↓
Get current step count from device
        ↓
checkAndRewardMilestones(steps, pubkey)
        ↓
Get today's achieved milestones from storage
        ↓
Calculate new milestones (1k, 2k, 3k...)
        ↓
For each new milestone:
  - Get user's Lightning address
  - Request invoice
  - Send 5 sats
  - Mark milestone achieved
        ↓
Show toast notification
```

---

## What Daily/Step Rewards Should Be

### Ideal Architecture
1. **Simple eligibility** - GPS or manual entry only
2. **Atomic markers** - Prevent duplicate rewards
3. **Silent failure** - Never block user actions
4. **Clear milestones** - 1k, 2k, 3k... steps
5. **Daily reset** - Fresh milestones each day

### What to Avoid
- Complex eligibility rules
- Reward gaming through imports
- Race conditions on rapid saves
- Verbose error handling

---

## Navigation

**Previous:** [Chapter 9: Rewards Overview](./09-rewards-overview.md)

**Next:** [Chapter 11: Lightning Address](./11-rewards-lightning-address.md)

**Table of Contents:** [Back to TOC](./00-table-of-contents.md)
