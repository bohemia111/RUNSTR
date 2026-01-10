# RUNSTR Book - Table of Contents

**Version:** 1.4.4
**Last Updated:** January 2026

---

## Introduction

| Chapter | Title | Description |
|---------|-------|-------------|
| 01 | [Introduction](./01-introduction.md) | What is RUNSTR, core pillars, architecture overview |

---

## Part 1: Workouts

| Chapter | Title | Description |
|---------|-------|-------------|
| 02 | [Workouts Overview](./02-workouts-overview.md) | What workouts are, activity categories, health integrations |
| 03 | [Workout Tracking](./03-workouts-tracking.md) | GPS tracking, manual entry, real-time metrics |
| 04 | [Workout Data Model](./04-workouts-data-model.md) | Kind 1301 Nostr events, tag format, activity types |
| 05 | [Workout Storage & Publishing](./05-workouts-storage.md) | Local storage, health sync, Nostr publishing |

---

## Part 2: Events

| Chapter | Title | Description |
|---------|-------|-------------|
| 06 | [Events Overview](./06-events-overview.md) | What events are, hardcoded competitions, prize pools |
| 07 | [Joining Events](./07-events-joining.md) | Supabase participant tracking, join flow |
| 08 | [Event Leaderboards](./08-events-leaderboards.md) | Leaderboard calculation, Running/Walking/Cycling tabs |

---

## Part 3: Rewards

| Chapter | Title | Description |
|---------|-------|-------------|
| 09 | [Rewards Overview](./09-rewards-overview.md) | Fitness = Bitcoin philosophy, reward types |
| 10 | [Daily & Step Rewards](./10-rewards-daily-step.md) | 50 sats/workout, 5 sats/1k steps, streaks |
| 11 | [Lightning Address](./11-rewards-lightning-address.md) | No NWC, LNURL protocol, reward delivery |

---

## Part 4: Donations

| Chapter | Title | Description |
|---------|-------|-------------|
| 12 | [Donations Overview](./12-donations-overview.md) | Teams = Charities, donation splits |
| 13 | [Teams (Charities)](./13-donations-teams.md) | Supported charities, selection, zap button |
| 14 | [Impact Level](./14-donations-impact-level.md) | XP system, level progression, streaks |

---

## Conclusion & Reference

| Chapter | Title | Description |
|---------|-------|-------------|
| 15 | [Conclusion](./15-conclusion.md) | RUNSTR's value, simplicity principle, future vision |
| 16 | [Appendix: Nostr Events](./16-appendix-nostr-events.md) | Kind 1301 spec, tag examples, relay config |

---

## Quick Reference

### Core Concepts
- **Teams = Charities** - Users select one team/charity to support
- **Rewards** - 50 sats per daily workout + 5 sats per 1,000 steps
- **Lightning Address** - Users enter their address to receive rewards (no NWC)
- **Impact Level** - XP-based score from donations
- **Events** - Hardcoded competitions (Season II, January Walking, etc.)

### Key Services
| Service | Purpose | Chapter |
|---------|---------|---------|
| `WorkoutEventStore` | Workout cache | 02-05 |
| `DailyRewardService` | 50 sats/workout | 09-10 |
| `StepRewardService` | 5 sats/1k steps | 09-10 |
| `ImpactLevelService` | XP calculations | 14 |
| `Season2Service` | Event leaderboards | 08 |

### Navigation
- **Profile Tab** - Start Workout, View History, Join Events
- **Teams Tab** - Select charity to support
- **Rewards Tab** - Total rewards, Impact Level, Donation Splits
