# Chapter 12: Donations Overview

## Summary

In RUNSTR, selecting a team means choosing a charity to support with your fitness activities. The Teams tab presents 12+ Bitcoin-focused charities—from Bitcoin Bay building circular economies in the Bay Area to the ALS Network honoring Hal Finney's legacy. Each organization has a Lightning address ready to receive donations, and your workout efforts can directly fund their missions.

The donation system works through configurable splits. In your Rewards settings, you choose what percentage of your earnings to donate: 0%, 10%, 25%, 50%, or even 100%. When you earn your daily 50-sat reward, the app automatically calculates the split. If you've set 25%, you receive 37 sats and your chosen charity receives 13 sats—both payments sent automatically from the app's NWC wallet.

This architecture using the app's NWC wallet enables payment verification that wouldn't be possible if users sent donations directly. The app can confirm both transactions succeeded, track donation totals accurately, and provide reliable reporting on charitable impact. Your donations are real, verified Bitcoin transfers to organizations doing meaningful work in the Bitcoin ecosystem.

Beyond automatic splits, you can zap charities directly using the lightning bolt button on any team card. Tap to open a donation modal with preset amounts (21, 100, 500, or 1,000 sats), or long-press for a quick 21-sat zap if you have NWC configured. This gives you flexibility to make spontaneous donations beyond your regular workout splits.

The Impact Level system gamifies your charitable giving. As you donate, you accumulate XP that increases your Impact Level—from Impact Starter to higher tiers. Your level and XP progress display prominently on the Rewards screen, providing visible recognition of your cumulative contributions. It transforms fitness from a purely personal pursuit into a force for community good, where every workout can fund causes you believe in.

---

## Teams = Charities

In RUNSTR, **"Teams" and "Charities" are the same thing**. The Teams tab shows organizations you can support through your fitness activities.

When you select a team:
- A percentage of your daily rewards goes to that charity
- Your workouts contribute to that charity's fitness totals
- You become part of a community supporting that cause

---

## How Donations Work

### Donation Split

Users configure what percentage of rewards to donate:

| Setting | You Receive | Charity Receives |
|---------|-------------|------------------|
| 0% | 50 sats | 0 sats |
| 10% | 45 sats | 5 sats |
| 25% | 37 sats | 13 sats |
| 50% | 25 sats | 25 sats |
| 100% | 0 sats | 50 sats |

### Automatic Splitting

When you earn a daily reward:
1. App calculates split based on your percentage
2. App's NWC wallet sends your portion to your Lightning address
3. App's NWC wallet sends charity portion to charity's Lightning address
4. Both transactions are verified by the app
5. Donation totals tracked accurately for Impact Level XP

**Why NWC Wallet?** Using the app's NWC wallet for all payments enables payment verification—the app can confirm donations succeeded and track accurate totals.

---

## Impact Level

As a gamification element, RUNSTR tracks your **Impact Level** based on total donations:

```
┌─────────────────────────────────────┐
│  🏆 IMPACT LEVEL                ℹ  │
│     ┌───────────┐                  │
│     │     2     │  Impact Starter  │
│     │           │  3 / 132 XP      │
│     └───────────┘                  │
└─────────────────────────────────────┘
```

- **Level** - Your current impact level (1, 2, 3...)
- **Title** - Milestone name (Impact Starter, Supporter, etc.)
- **XP** - Progress toward next level

See [Chapter 14: Impact Level](./14-donations-impact-level.md) for details.

---

## Teams Tab

The Teams tab shows:

```
┌─────────────────────────────────────┐
│  YOUR TEAM                          │
│  ┌─────────────────────────────┐   │
│  │ [Logo] ALS Network       ⚡ ✓│   │
│  │ Honoring Hal Finney -       │   │
│  │ Supporting ALS research     │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  ALL TEAMS                          │
│  Select a team to support with      │
│  your workouts                      │
│                                     │
│  [Logo] Bitcoin Bay            ⚡   │
│  Bitcoin circular economy...        │
│                                     │
│  [Logo] Bitcoin Ekasi          ⚡   │
│  Bitcoin circular economy...        │
│                                     │
│  [Logo] Bitcoin Isla           ⚡   │
│  Bitcoin circular economy...        │
│                                     │
│  ... more teams ...                 │
└─────────────────────────────────────┘
```

### Team Card Elements
- **Logo** - Charity's image
- **Name** - Bitcoin Bay, Bitcoin Ekasi, etc.
- **Description** - Brief about the charity
- **Zap Button (⚡)** - Direct donation button
- **Checkmark (✓)** - Indicates selected team

---

## Technical Section

### Core Services

| Service | File | Purpose |
|---------|------|---------|
| CharitySelectionService | `src/services/charity/CharitySelectionService.ts` | Track selected team |
| DonationTrackingService | `src/services/donation/DonationTrackingService.ts` | Record donations |
| ImpactLevelService | `src/services/impact/ImpactLevelService.ts` | XP calculations |

### Charity Constants

**File:** `src/constants/charities.ts`

Contains all supported charities with metadata:

```typescript
interface Charity {
  id: string;
  name: string;
  displayName: string;
  lightningAddress: string;
  description: string;
  website?: string;
  image?: number;  // require() reference
}

const CHARITIES: Charity[] = [
  {
    id: 'bitcoin-bay',
    name: 'Bitcoin Bay',
    displayName: 'Zap Bitcoin Bay',
    lightningAddress: 'sats@donate.bitcoinbay.foundation',
    description: 'Bitcoin circular economy in the Bay Area',
  },
  // ... 12+ more charities
];
```

### Storage Keys

| Key | Purpose |
|-----|---------|
| `@runstr:selected_charity_id` | User's selected team |
| `@runstr:donation_percentage` | Split percentage (0-100) |
| `@runstr:charity_donations:{id}` | Per-charity donation history |

---

## What Donations Should Be

### Ideal Architecture
1. **Teams = Charities** - Simple mental model
2. **One selected team** - User picks one to support
3. **Configurable split** - User controls percentage
4. **Impact Level** - Gamification for engagement
5. **Direct zaps** - Optional manual donations

### What to Avoid
- Separate "Teams" and "Charities" concepts
- Complex team membership
- Donation leaderboards (not implemented)
- Mandatory donations

---

## Navigation

**Previous:** [Chapter 11: Lightning Address](./11-rewards-lightning-address.md)

**Next:** [Chapter 13: Teams (Charities)](./13-donations-teams.md)

**Table of Contents:** [Back to TOC](./00-table-of-contents.md)
