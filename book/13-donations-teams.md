# Chapter 13: Teams (Charities)

## Supported Charities

RUNSTR supports 12+ charities, each with a Lightning address for receiving donations:

| Charity | Lightning Address | Focus |
|---------|-------------------|-------|
| Bitcoin Bay | `sats@donate.bitcoinbay.foundation` | Bay Area Bitcoin economy |
| Bitcoin Ekasi | `bitcoinekasi@primal.net` | South Africa |
| Bitcoin Isla | `BTCIsla@primal.net` | Isla Mujeres, Mexico |
| Bitcoin District | `bdi@strike.me` | Washington DC |
| Bitcoin Yucatan | `bitcoinyucatancommunity@geyser.fund` | Mexico |
| Bitcoin Veterans | `opbitcoin@strike.me` | US Veterans support |
| Bitcoin Makueni | `rosechicken19@primal.net` | Kenya |
| Bitcoin House Bali | `btchousebali@walletofsatoshi.com` | Bali, Indonesia |
| Human Rights Foundation | `nostr@btcpay.hrf.org` | Human rights |
| Afribit Kibera | `afribit@blink.sv` | Kenya |
| Bitcoin Basin | `plasticbowl87@walletofsatoshi.com` | Regional Bitcoin |
| ALS Network | `RunningBTC@primal.net` | ALS research (Hal Finney) |

---

## Selecting a Team

### Selection Flow

1. Navigate to Teams tab
2. Scroll through "ALL TEAMS" list
3. Tap on desired team
4. Team moves to "YOUR TEAM" section
5. Checkmark appears on selected team

### One Team at a Time

Users can only have **one active team**:
- Simplifies donation tracking
- Clear focus on single cause
- Can change team anytime

---

## Team Card UI

Each team displays as a card:

```
┌─────────────────────────────────────┐
│  [Logo]  Bitcoin Bay           ⚡   │
│          Bitcoin circular economy   │
│          in the Bay Area            │
└─────────────────────────────────────┘
```

### Elements
- **Logo** - Visual identity
- **Name** - Charity name
- **Description** - Brief mission statement
- **Zap Button (⚡)** - Quick donation

### Selected Team Card

```
┌─────────────────────────────────────┐
│  [Logo]  ALS Network          ⚡ ✓  │
│          Honoring Hal Finney -      │
│          Supporting ALS research    │
│          and patient care           │
└─────────────────────────────────────┘
```

Checkmark (✓) indicates current selection.

---

## Zap Button

The lightning bolt (⚡) button enables direct donations:

### Single Tap
Opens donation modal:
- Select amount (21, 100, 500, 1000 sats)
- Generate invoice
- Pay with any Lightning wallet

### Long Press (500ms)
Quick zap (21 sats) via NWC if configured:
- Instant payment
- No modal needed
- Visual confirmation

---

## Technical Section

### Charity Interface

**File:** `src/constants/charities.ts`

```typescript
interface Charity {
  id: string;                    // 'bitcoin-bay'
  name: string;                  // 'Bitcoin Bay'
  displayName: string;           // 'Zap Bitcoin Bay'
  lightningAddress: string;      // 'sats@donate.bitcoinbay.foundation'
  description: string;           // 'Bitcoin circular economy...'
  website?: string;              // 'https://bitcoinbay.foundation'
  image?: number;                // require('./images/bitcoin-bay.png')
}
```

### Helper Functions

```typescript
// Get charity by ID
function getCharityById(charityId?: string): Charity | undefined

// Get all charities for dropdown
function getCharityOptions(): { label: string; value: string }[]
```

### CharitySelectionService

**File:** `src/services/charity/CharitySelectionService.ts`

```typescript
// Get selected charity ID
async getSelectedCharity(): Promise<string | null>

// Set selected charity
async setSelectedCharity(charityId: string): Promise<void>

// Get charity stats (total earned from wins)
async getCharityStats(): Promise<CharityStats>
```

### CharitySection Component

**File:** `src/components/team/CharitySection.tsx`

Renders the charity card with zap functionality:

```typescript
interface CharitySectionProps {
  charity: Charity;
  isSelected: boolean;
  onSelect: () => void;
  onZap: (amount: number) => void;
}
```

Features:
- Logo image
- Name and description
- Animated zap button
- Selection indicator
- Long-press quick zap

### Teams Screen

**File:** `src/screens/TeamsScreen.tsx`

Main screen showing all teams:

```typescript
// Structure
- "YOUR TEAM" section (selected team)
- "ALL TEAMS" section (all charities)
- Team selection handling
- Zap modal integration
```

---

## Donation Splits in Rewards

When user has a team selected and earns rewards:

### In DailyRewardService

```typescript
async function sendReward(userPubkey: string) {
  // Get donation settings
  const charityId = await CharitySelectionService.getSelectedCharity();
  const percentage = await getDonationPercentage();

  if (charityId && percentage > 0) {
    // Calculate split
    const charityAmount = Math.floor(50 * (percentage / 100));
    const userAmount = 50 - charityAmount;

    // Send to user
    await sendToLightningAddress(userAddress, userAmount);

    // Send to charity
    const charity = getCharityById(charityId);
    await sendToLightningAddress(charity.lightningAddress, charityAmount);

    // Record donation
    await DonationTrackingService.recordDonation({
      charityId,
      amount: charityAmount,
      donorPubkey: userPubkey,
    });
  } else {
    // Full amount to user
    await sendToLightningAddress(userAddress, 50);
  }
}
```

---

## What Teams Should Be

### Ideal Architecture
1. **Simple list** - Scrollable charity cards
2. **One selection** - Single active team
3. **Clear identity** - Logo, name, description
4. **Easy zapping** - Direct donation button
5. **Lightning native** - All charities have Lightning addresses

### What to Avoid
- Complex team membership
- Team rosters/member lists
- Team-based competitions
- Multiple team selections

---

## Navigation

**Previous:** [Chapter 12: Donations Overview](./12-donations-overview.md)

**Next:** [Chapter 14: Impact Level](./14-donations-impact-level.md)

**Table of Contents:** [Back to TOC](./00-table-of-contents.md)
