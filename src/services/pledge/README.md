# Pledge Service

This folder contains the workout pledge system for RUNSTR event entry.

## Overview

Users can "pledge" future daily rewards to join events. Instead of paying upfront, they commit a number of daily workouts (e.g., 5 workouts = 250 sats). Their next N daily rewards go to the event destination (captain or charity) instead of their wallet.

## Files

### PledgeService.ts
Core service for managing pledge lifecycle:
- **createPledge()** - Create new pledge when joining paid event
- **getActivePledge()** - Get user's current active pledge (if any)
- **incrementPledgeProgress()** - Called by DailyRewardService after each reward
- **canCreatePledge()** - Check eligibility (enforces one-at-a-time rule)
- **getPledgeHistory()** - Get completed pledges for stats
- **getTotalSatsPledged()** - Calculate lifetime pledged amount

## Key Rules

1. **One pledge at a time** - Users cannot join another paid event until current pledge is complete
2. **No cancellation** - Once pledged, must complete all workouts
3. **Full reward goes to destination** - User's charity donation setting is paused during pledge
4. **Local storage only** - Pledges stored in AsyncStorage, not published to Nostr

## Storage Keys

- `@runstr:active_pledge:{userPubkey}` - Current active pledge (JSON)
- `@runstr:pledge_history:{userPubkey}` - Array of completed pledges

## Integration Points

- **DailyRewardService** - Checks for active pledge before routing rewards
- **EventJoinService** - Creates pledge when user joins paid event
- **RewardsScreen** - Displays ActivePledgeCard showing progress
- **SimpleEventWizardV2** - Captain sets pledge cost and destination
