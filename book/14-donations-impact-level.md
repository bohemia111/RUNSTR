# Chapter 14: Impact Level

## What is Impact Level?

Impact Level is a **gamification system** that rewards consistent donations. As users donate more, they earn XP and level up.

**Key Point:** Impact Level is NOT a leaderboard. It's a personal score that tracks your donation progress.

---

## How It Works

### XP Earning

Simple rule: **1 sat = 1 XP**

Examples:
- Donate 21 sats → Earn 21 XP
- Donate 50 sats → Earn 50 XP
- Donate 100 sats → Earn 100 XP

Easy to remember - your XP equals your total donations!

---

## Level Progression

### XP Requirements

Levels use **exponential scaling** (15% increase per level):

| Level | XP Required | Title |
|-------|-------------|-------|
| 1 | 100 XP | Impact Starter |
| 2 | 115 XP | Impact Starter |
| 5 | 175 XP | Supporter |
| 10 | 405 XP | Contributor |
| 20 | 1,637 XP | Champion |
| 50 | 108,366 XP | Legend |
| 100 | 11,739,086 XP | Philanthropist |

Formula: `XP_needed = 100 × 1.15^(level-1)`

### Milestone Titles

| Level Range | Title |
|-------------|-------|
| 1-4 | Impact Starter |
| 5-9 | Supporter |
| 10-19 | Contributor |
| 20-49 | Champion |
| 50-99 | Legend |
| 100+ | Philanthropist |

---

## Impact Level Card

Displayed on Rewards screen:

```
┌─────────────────────────────────────┐
│  🏆 IMPACT LEVEL                ℹ  │
│     ┌───────────┐                  │
│     │     2     │  Impact Starter  │
│     │   ████░░  │  3 / 132 XP      │
│     └───────────┘                  │
└─────────────────────────────────────┘
```

### Elements
- **Trophy Icon** - Indicates achievement
- **Level Number** - Current level (large)
- **Progress Bar** - Visual XP progress
- **Title** - Current milestone name
- **XP Display** - Current / needed for next level
- **Info Button (ℹ)** - Opens explanation modal

---

## Info Modal

Tapping ℹ shows:

```
┌─────────────────────────────────────┐
│  How Impact Level Works         ✕  │
├─────────────────────────────────────┤
│  Simple: 1 sat = 1 XP              │
│                                     │
│  Donate 21 sats → Earn 21 XP       │
│  Donate 100 sats → Earn 100 XP     │
│                                     │
│  Total Donated: 1,250 sats         │
│  Total XP: 1,250                   │
│                                     │
│  Your XP = Your Impact!            │
└─────────────────────────────────────┘
```

---

## Technical Section

### ImpactLevel Interface

**File:** `src/types/impactLevel.ts`

```typescript
interface ImpactLevel {
  level: number;              // Current level (1+)
  currentXP: number;          // XP in current level
  xpForNextLevel: number;     // XP needed to advance
  totalXP: number;            // Lifetime XP
  progress: number;           // 0-1 progress to next level
  title: string;              // Milestone title
}

interface ImpactStats {
  totalDonations: number;     // Count of donations
  totalSatsDonated: number;   // Sum of all donations
  charitiesSupported: number; // Unique charities
  currentStreak: number;      // Consecutive days
  weeklyDonationDays: boolean[]; // Mon-Sun activity
  level: ImpactLevel;
}
```

### ImpactLevelService

**File:** `src/services/impact/ImpactLevelService.ts`

```typescript
// Calculate XP for a donation (1 sat = 1 XP)
function calculateDonationXP(amount: number): number {
  return amount; // Simple 1:1 ratio
}

// Calculate total XP from donations
function calculateTotalXP(donations: DonationRecord[]): number {
  return donations.reduce((sum, d) => sum + d.amount, 0);
}

// Calculate level from total XP
function calculateLevel(totalXP: number): ImpactLevel {
  let level = 1;
  let xpNeeded = 100;
  let xpAccumulated = 0;

  while (xpAccumulated + xpNeeded <= totalXP) {
    xpAccumulated += xpNeeded;
    level++;
    xpNeeded = Math.floor(100 * Math.pow(1.15, level - 1));
  }

  const currentXP = totalXP - xpAccumulated;
  const progress = currentXP / xpNeeded;
  const title = getMilestoneTitle(level);

  return { level, currentXP, xpForNextLevel: xpNeeded, totalXP, progress, title };
}

// Get milestone title
function getMilestoneTitle(level: number): string {
  if (level >= 100) return 'Philanthropist';
  if (level >= 50) return 'Legend';
  if (level >= 20) return 'Champion';
  if (level >= 10) return 'Contributor';
  if (level >= 5) return 'Supporter';
  return 'Impact Starter';
}
```

### ImpactLevelCard Component

**File:** `src/components/rewards/ImpactLevelCard.tsx`

```typescript
interface ImpactLevelCardProps {
  level: ImpactLevel;
  onInfoPress: () => void;
}
```

Features:
- Circular progress ring
- Large level number
- Title display
- XP progress bar
- Info button

### Caching

| Key | TTL | Purpose |
|-----|-----|---------|
| `@runstr:impact_level:{pubkey}` | 5 minutes | Cached impact stats |

---

## What Impact Level Should Be

### Ideal Architecture
1. **Simple formula** - 1 sat = 1 XP (easy to remember!)
2. **Clear progression** - Visible level and XP
3. **Milestone titles** - Achievement recognition
4. **Personal score** - Not competitive

### What to Avoid
- Complex XP calculations
- Donation leaderboards
- Pay-to-win mechanics
- Confusing multiplier rules

---

## Navigation

**Previous:** [Chapter 13: Teams (Charities)](./13-donations-teams.md)

**Next:** [Chapter 15: Conclusion](./15-conclusion.md)

**Table of Contents:** [Back to TOC](./00-table-of-contents.md)
