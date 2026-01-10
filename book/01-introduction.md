# Chapter 1: Introduction

## What is RUNSTR?

RUNSTR is a Bitcoin-powered fitness application that rewards users for working out and enables them to support charities through their fitness activities. The app transforms everyday exercise into Bitcoin earnings while creating a community of health-conscious Bitcoiners.

### Core Value Proposition
**Fitness earns Bitcoin. Bitcoin supports charities.**

Every workout you complete earns you satoshis (sats). You can choose to split a portion of your rewards with a charity you care about. The more you work out, the more you earn, and the more impact you have.

---

## The Four Core Pillars

RUNSTR is built on four interconnected pillars:

### 1. Workouts
Track your fitness activities using GPS or manual entry. Workouts are published to the Nostr network as kind 1301 events, creating a permanent, decentralized record of your fitness journey.

**Key Features:**
- GPS tracking for Running, Walking, Cycling
- Manual entry for Strength, Diet, Wellness
- HealthKit (iOS), Health Connect (Android), Garmin sync
- Real-time metrics: pace, distance, elevation, splits

### 2. Events
Compete in fitness challenges with Bitcoin prizes. Events like "RUNSTR Season II" and "January Walking Contest" bring users together in friendly competition.

**Key Features:**
- Hardcoded events (currently no dynamic creation)
- Leaderboards with Running/Walking/Cycling tabs
- Prize pools in satoshis
- Supabase-based participant tracking

### 3. Rewards
Earn Bitcoin for staying active. The app sends real satoshis to your Lightning address for completing workouts and hitting step milestones.

**Key Features:**
- 50 sats per daily workout
- 5 sats per 1,000 steps
- Delivered via Lightning address (LNURL protocol)
- Silent failure - rewards never block workout saving

### 4. Donations
Support Bitcoin-focused charities through your fitness. Select a "team" (charity) to support, and split a percentage of your rewards with them.

**Key Features:**
- Teams = Charities (Bitcoin Bay, Bitcoin Ekasi, ALS Network, etc.)
- Donation split from daily rewards
- Impact Level - XP-based gamification for donations
- Direct zap button for manual donations

---

## Target Market

RUNSTR targets the Bitcoin and Nostr community - approximately 50,000+ addressable users who:
- Already understand private keys (nsec) and public keys (npub)
- Are familiar with Lightning Network payments
- Value decentralized protocols and data ownership
- Care about health and fitness

This focused market solves the "cold start problem" by targeting users who already have the knowledge to use the app immediately.

---

## Technical Architecture

### Overview

RUNSTR uses a **hybrid architecture**:
- **Nostr** - For workouts (kind 1301 events) and user authentication
- **Supabase** - For event participation and leaderboards
- **Lightning** - For reward payments via LNURL

### Key Technical Decisions

| Decision | Implementation | Rationale |
|----------|---------------|-----------|
| Authentication | Nostr (nsec-only) | Decentralized identity |
| Workout Data | Nostr kind 1301 | Interoperable fitness standard |
| Event Joining | Supabase | Simpler than Nostr for participation tracking |
| Rewards | Lightning address | Universal wallet support |
| Charity Selection | Teams tab | Simple UX for choosing charity |

### Global NDK Instance

All Nostr operations use a single global NDK instance (`GlobalNDKService`):
- Reduces WebSocket connections by 90%
- Maintains persistent relay connections
- 4 relays: damus, primal, nos.lol, nostr.band

```typescript
// Usage pattern throughout the app
import { GlobalNDKService } from '../services/nostr/GlobalNDKService';

const ndk = await GlobalNDKService.getInstance();
const events = await ndk.fetchEvents(filter);
```

### Three-Tab Navigation

The app uses a simple three-tab navigation:

| Tab | Purpose | Key Actions |
|-----|---------|-------------|
| **Profile** | User dashboard | Start Workout, View History, Join Events |
| **Teams** | Charity selection | Select team, view all charities, zap |
| **Rewards** | Earnings & donations | View rewards, Impact Level, set donation splits |

---

## Key Files

### Entry Points
- `src/App.tsx` - Main app component
- `src/navigation/AppNavigator.tsx` - Navigation setup
- `src/navigation/BottomTabNavigator.tsx` - Tab bar

### Core Services
- `src/services/nostr/GlobalNDKService.ts` - Nostr connection
- `src/services/fitness/WorkoutEventStore.ts` - Workout cache
- `src/services/rewards/DailyRewardService.ts` - Daily rewards
- `src/services/impact/ImpactLevelService.ts` - XP calculations

### Authentication
- `src/contexts/AuthContext.tsx` - Auth state
- `src/services/auth/authService.ts` - nsec login flow

---

## What This Book Covers

This book documents what RUNSTR **should be** - the idealized architecture that keeps the app simple, focused, and aligned with its core mission.

Each chapter covers:
- **Overview Section** - High-level concepts, user experience, philosophy
- **Technical Section** - File paths, function names, implementation details

By reading this book alongside the codebase, you can:
1. Understand how each feature works
2. Identify code that doesn't match the ideal architecture
3. Make informed decisions about refactoring
4. Ensure alignment between developer and AI assistant

---

## Navigation

**Next:** [Chapter 2: Workouts Overview](./02-workouts-overview.md)

**Table of Contents:** [Back to TOC](./00-table-of-contents.md)
