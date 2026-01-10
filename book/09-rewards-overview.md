# Chapter 9: Rewards Overview

## Fitness = Bitcoin

RUNSTR's core philosophy: **every workout earns real Bitcoin**.

When you complete a workout or hit step milestones, the app sends satoshis directly to your Lightning address. This creates a direct incentive loop:
- Work out → Earn sats → Stay motivated → Work out more

---

## Reward Types

### 1. Daily Workout Reward
**50 sats per day** for completing a qualifying workout.

- One reward per 24-hour period
- Requires saving workout to the app
- GPS-tracked or manual entry qualifies
- HealthKit/Garmin imports do NOT qualify (prevents gaming)

### 2. Step Milestone Rewards
**5 sats per 1,000 steps** throughout the day.

- Milestone at 1k, 2k, 3k, 4k... steps
- Resets at midnight
- Step count from device sensors
- Multiple rewards possible per day

---

## Reward Values

| Reward Type | Amount | Frequency | Max/Day |
|-------------|--------|-----------|---------|
| Daily Workout | 50 sats | Once per day | 50 sats |
| Step Milestone | 5 sats | Per 1,000 steps | Unlimited |

### Example Day
| Activity | Reward |
|----------|--------|
| Morning run (5K) | 50 sats |
| 1,000 steps | 5 sats |
| 2,000 steps | 5 sats |
| 3,000 steps | 5 sats |
| 4,000 steps | 5 sats |
| 5,000 steps | 5 sats |
| **Total** | **75 sats** |

---

## Rewards Screen

The Rewards tab shows:

```
┌─────────────────────────────────────┐
│  TOTAL REWARDS         1050 sats   │
│  22 workouts • 0 day streak        │
│  0 steps today  [Compete] [Post]   │
├─────────────────────────────────────┤
│  🏆 IMPACT LEVEL                ℹ  │
│     ┌───────────┐                  │
│     │     2     │  Impact Starter  │
│     │           │  3 / 132 XP      │
│     └───────────┘                  │
├─────────────────────────────────────┤
│  ❤ YOUR IMPACT                  ▼  │
├─────────────────────────────────────┤
│  ↕ DONATION SPLITS              ▼  │
├─────────────────────────────────────┤
│  💳 REWARDS ADDRESS             ▼  │
└─────────────────────────────────────┘
```

### Key Elements
- **Total Rewards** - Lifetime sats earned
- **Workout Count** - Total workouts tracked
- **Day Streak** - Consecutive days with workouts
- **Steps Today** - Current step count
- **Impact Level** - Donation gamification (see Chapter 14)
- **Donation Splits** - Configure charity percentage
- **Rewards Address** - Set Lightning address

---

## Silent Failure Philosophy

Rewards are implemented with **silent failure**:
- If reward payment fails, workout still saves
- User is never blocked by payment errors
- Errors are logged but not shown to user
- Retry logic is minimal to avoid delays

### Why Silent Failure?
- Rewards are a bonus, not the core feature
- Payment failures should never frustrate users
- Better UX than error modals interrupting workouts

---

## Technical Section

### Core Services

| Service | File | Purpose |
|---------|------|---------|
| DailyRewardService | `src/services/rewards/DailyRewardService.ts` | 50 sats/workout |
| StepRewardService | `src/services/rewards/StepRewardService.ts` | 5 sats/1k steps |
| StepPollingService | `src/services/rewards/StepPollingService.ts` | Step count polling |
| RewardSenderWallet | `src/services/rewards/RewardSenderWallet.ts` | App's payment wallet |
| RewardNotificationManager | `src/services/rewards/RewardNotificationManager.ts` | Toast notifications |

### RewardSenderWallet

The app has a dedicated wallet for sending rewards:

```typescript
// App's reward wallet (NWC)
const REWARD_SENDER_NWC = "nostr+walletconnect://...";

// Send reward to user's Lightning address
await RewardSenderWallet.sendRewardPayment(invoice, amountSats);
```

### Reward Configuration

**File:** `src/config/rewards.ts`

```typescript
const REWARD_CONFIG = {
  DAILY_WORKOUT_REWARD: 50,        // sats per day
  STEP_MILESTONE_REWARD: 5,        // sats per milestone
  STEP_MILESTONE_INCREMENT: 1000,  // steps per milestone
  MIN_WORKOUT_DISTANCE_METERS: 1000, // 1km minimum
  MAX_REWARDS_PER_DAY: 1,          // daily workout limit
  MAX_RETRY_ATTEMPTS: 0,           // silent failure
};
```

### Storage Keys

| Key | Purpose |
|-----|---------|
| `@runstr:last_reward_date` | Prevent duplicate daily rewards |
| `@runstr:total_rewards_earned` | Lifetime counter |
| `@runstr:weekly_rewards_earned` | Weekly counter |
| `@runstr:step_milestones:{date}` | Today's achieved milestones |

---

## What Rewards Should Be

### Ideal Architecture
1. **Simple rules** - 50/day, 5/1k steps, no complexity
2. **Silent failure** - Never block user experience
3. **Lightning address** - Universal wallet support
4. **Clear tracking** - User sees total and streak

### What to Avoid
- Complex eligibility rules
- Blocking payment errors
- NWC wallet requirements for users
- Retry loops that delay workouts

---

## Navigation

**Previous:** [Chapter 8: Event Leaderboards](./08-events-leaderboards.md)

**Next:** [Chapter 10: Daily & Step Rewards](./10-rewards-daily-step.md)

**Table of Contents:** [Back to TOC](./00-table-of-contents.md)
