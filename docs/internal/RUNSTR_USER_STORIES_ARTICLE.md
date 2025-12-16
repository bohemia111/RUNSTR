# The Future of Fitness is Decentralized: RUNSTR User Stories

## The Problem With Modern Fitness Apps

Every fitness app wants your data. Your morning run times. Your heart rate patterns. Your sleep cycles. Your location history. They promise "personalized insights" while building comprehensive surveillance profiles sold to advertisers, insurers, and data brokers. These centralized platforms hold your fitness journey hostage—cancel your subscription and lose your history. Switch apps and start from zero.

The fitness technology industry has created a false choice: accept surveillance or go analog. Pay monthly fees to companies that profit twice—once from your subscription, again from your data. Traditional event management platforms take 5-10% cuts from race registration fees while locking organizers into proprietary systems that disappear when the platform shuts down.

**RUNSTR offers a different path.** A fitness app built on Nostr (a decentralized protocol) and Bitcoin (permissionless money) that gives power back to athletes and organizers. Three core superpowers define RUNSTR's mission:

1. **Anonymous, Local-First Fitness Tracker** - Your data stays on your device until you choose to share it
2. **Competition Management Platform** - Create and manage races without middlemen taking cuts
3. **Charity Crowdfunding** - Direct Bitcoin donations to causes that matter

Let's explore how RUNSTR transforms fitness through two user stories: Sarah, a privacy-conscious runner, and Marcus, a charity race organizer.

---

## Story 1: Sarah's Privacy-First Fitness Journey

### The Anonymous Athlete

Sarah has been running for five years. She tracks workouts with her Apple Watch, shares PRs on Strava, and participates in virtual 5Ks. But she's increasingly uncomfortable with how much these apps know about her. Strava's heat maps revealed military base locations. Fitness app data has been subpoenaed in court cases. She wants the community and competition without the surveillance.

**She discovers RUNSTR.**

### Download to First Run (5 Minutes)

Sarah downloads RUNSTR from the App Store. No email required. No phone number. No identity verification. The app generates a Nostr key pair (nsec/npub)—her cryptographic identity. She backs up her private key (nsec) to her password manager. That's it. No profile questionnaire. No data harvesting consent forms. Just a simple onboarding that explains the app's features.

During setup, RUNSTR requests HealthKit permission. Sarah grants it. The app imports her last 90 days of Apple Watch workouts—runs, cycling sessions, strength training. But here's the difference: **this data stays local**. Stored in her phone's encrypted storage. Not uploaded to RUNSTR's servers (because RUNSTR has no servers). Not shared with third parties. Not used to train AI models. **Local-first architecture.**

### Aggregating Data From Multiple Sources

Sarah uses multiple fitness tools:
- **Apple Watch** for GPS-tracked runs
- **Garmin Edge** for cycling
- **Strong app** for weightlifting logs
- **WHOOP** for recovery metrics

In traditional apps, she'd need to choose one ecosystem. With RUNSTR, she connects all of them. The Apple Health integration already brought in her Apple Watch and Strong data automatically. She connects her Garmin account via OAuth, and cycling rides sync within seconds. Her profile now shows a unified timeline: morning runs, afternoon strength sessions, weekend bike rides—all from their native tracking apps.

**The magic:** Sarah can keep using her preferred tracking tools. RUNSTR doesn't force her to switch to a new GPS tracker or abandon her Garmin Edge 540. It's a **fitness data hub**, not a walled garden.

### Health Insights Without Surveillance

Sarah navigates to the Stats page. A privacy notice appears: "All calculations happen on your device. No data leaves your phone." She taps "Continue."

The screen reveals:
- **VO2 Max:** 48 ml/kg/min (excellent for her age)
- **Fitness Age:** 28 (she's actually 34)
- **BMI:** 21.3 (healthy range)
- **7-Day Calorie Balance:** +2,400 kcal burned
- **Current Streak:** 12 consecutive workout days

These aren't just vanity metrics. The VO2 Max calculation uses her running pace and heart rate data from the past 30 days, applying the Cooper 12-minute test estimation formula with age/gender adjustments. Fitness age compares her cardiovascular capacity against population norms. **All computed locally.** No cloud API calls. No data upload. The app's code runs on her device, processes her data, and displays results. When she closes the app, the calculations disappear from memory.

Compare this to commercial apps that upload your workout data to their servers "to provide personalized insights" (and train proprietary AI models they'll monetize).

### Selective Publishing to Nostr

Sarah completes a morning 10K. Her Apple Watch tracks it. The workout appears in RUNSTR's profile tab with two buttons:

- **"Save to Nostr"** - Publishes structured workout data (kind 1301 event) for competitions
- **"Post to Nostr"** - Creates a beautiful social card for Nostr social networks

She ran fast today—46:22, a new PR. She taps "Post to Nostr." The app generates a stunning SVG workout card with RUNSTR branding, her distance, time, pace, and a "Personal Record!" badge. The card publishes to Nostr as a kind 1 event—a social post visible to her Nostr followers.

But here's what she **doesn't** publish: yesterday's recovery run (too slow, not PR-worthy), Tuesday's failed interval workout (felt awful, cut it short), last week's treadmill sessions (boring).

**Selective publishing.** Sarah controls her fitness narrative. In traditional social fitness apps, the default is "share everything." In RUNSTR, the default is "keep private." She publishes when she chooses.

### Joining Her First Competition

Sarah browses the Teams tab. She discovers "Bitcoin Runners NYC"—a local running club with 47 members. The team's profile shows they support OpenSats (a Bitcoin developer charity) and have three active competitions:

1. **November 5K Challenge** - Most 5Ks completed this month (Free entry)
2. **Turkey Trot Virtual Race** - Fastest 5K on Thanksgiving (2,100 sats entry fee)
3. **End of Year Distance Goal** - 100km total for November (Free entry)

Sarah taps "Request to Join." The team captain, Marcus (we'll meet him next), receives a notification. He approves her within an hour. Sarah is now officially on the team roster (stored as a Nostr kind 30000 member list event).

She decides to enter the **November 5K Challenge**. Free entry, casual competition. She taps "Join Event." The app adds her to the participant list. The leaderboard shows 12 current participants—ranging from 3 completed 5Ks to 8.

### Her First Competition Workout

The next Saturday, Sarah runs a 5K in Central Park. Her Apple Watch tracks it. The workout syncs to RUNSTR. She sees an **eligibility notification**: "This workout qualifies for November 5K Challenge!"

She taps "Save to Nostr." The app publishes a kind 1301 event—a structured workout record with tags:

```
kind: 1301
tags: [
  ['exercise_type', 'running'],
  ['distance', '5.1', 'km'],
  ['duration', '00:26:43'],
  ['start_time', '2025-11-08T09:15:00Z']
]
```

Within five minutes, the leaderboard updates. Sarah appears in 4th place with 4 completed 5Ks (tied with two others). She's two runs away from the top spot.

**The architecture:** RUNSTR queries kind 1301 workout events from all team members, filters by activity type (running) and distance (≥5km), counts qualifying workouts, and ranks participants. All client-side. No centralized leaderboard server. Pure Nostr protocol.

### Winning and Supporting Charity

By month's end, Sarah completes seven 5Ks. She wins the challenge. The prize: bragging rights and 50,000 sats (about $30) from the team's prize pool. But Sarah doesn't need the sats. She navigates to the team page, sees the charity section for OpenSats, and taps "Zap OpenSats."

A Lightning invoice appears. She scans it with her Cash App wallet (yes, RUNSTR works with mainstream Lightning apps). She sends 50,000 sats directly to OpenSats' Lightning address. No intermediary. No platform fee. **Direct charity contribution.**

Marcus, the team captain, sees the zap and posts a team announcement celebrating Sarah's win and generous donation. The team rallies around supporting open-source Bitcoin development.

### What Sarah Gets That Other Apps Don't Provide

1. **Data Sovereignty** - Her workouts live on her device, published to Nostr when she chooses, not locked in a proprietary database
2. **Privacy by Default** - No email, no tracking, no data selling, anonymous Nostr identity
3. **Multi-Source Aggregation** - Works with Apple Health, Garmin, manual tracking—use your preferred tools
4. **On-Device Analytics** - Health insights computed locally without cloud surveillance
5. **Real Competition** - Bitcoin-backed events with actual stakes, not gamified "achievements"
6. **Charity Integration** - Competition winnings go to causes that matter
7. **Data Portability** - Her kind 1301 workout events work in any Nostr fitness app

Sarah isn't just tracking workouts. She's participating in a decentralized fitness economy where she owns her data, controls her privacy, and directs her competitive energy toward charitable impact.

---

## Story 2: Marcus Hosts His First Virtual 5K for Charity

### The Frustrated Organizer

Marcus runs a local running club in Brooklyn with 60 active members. For three years, he's organized monthly group runs and an annual charity 5K. Last year, he used Eventbrite for registration. They charged a 3.5% + $1.59 processing fee per ticket. For 200 participants at $25 each ($5,000 total), Eventbrite took $493. Then Stripe took another 2.9% + $0.30 ($175). Total fees: **$668 (13.4%)**.

The charity—Human Rights Foundation—received $4,332 instead of $5,000. Nearly $700 vanished to intermediaries.

Marcus heard about RUNSTR from a Bitcoin friend. "No middleman fees. Direct Lightning payments. Nostr-based event management." He's skeptical but curious.

### Creating His Team (2 Minutes)

Marcus downloads RUNSTR, generates his Nostr keys, and taps the "+" button on the Teams tab. A wizard appears:

**Step 1: Team Basics**
- Team name: "Brooklyn Runners for Human Rights"
- Description: "Monthly group runs and charity races supporting HRF's Bitcoin advocacy"
- Charity: Human Rights Foundation (HRF)

**Step 2: Review & Launch**

He taps "Create Team." The app publishes a kind 33404 Nostr event containing his team's metadata. Within seconds, "Brooklyn Runners for Human Rights" appears on the global team discovery page, visible to anyone using RUNSTR or other Nostr fitness apps.

No payment required. No platform approval. No email verification. **Permissionless team creation.**

### Setting Up a Virtual 5K Race (5 Minutes)

Marcus wants to host a virtual Turkey Trot 5K for Thanksgiving week. Participants run on their own schedule, submit times, compete on a leaderboard. Entry fee: 2,100 sats (~$1.50). All proceeds go to HRF.

He navigates to the Captain Dashboard and taps "Create Event." The Event Creation Wizard loads:

**Step 1: Select Preset**
- He chooses "5K Race"

**Step 2: Event Details**
- Event name: "Turkey Trot Virtual 5K"
- Date: November 28, 2025
- Entry fee: 2,100 sats
- Prize pool: 50,000 sats (from team treasury)
- Payment destination: Team Captain (Marcus will manually send to HRF after event)
- Participation: Virtual (runners complete on their own)

He connects his Lightning wallet by entering his Lightning address: `marcus@getalby.com`. This is where entry fee payments will go.

He taps "Create Event." The app publishes a kind 30101 Nostr event with all event details. A QR code appears on screen—Marcus can print this for in-person promotion or share digitally.

**Total time:** 5 minutes. **Cost:** $0. Compare to Eventbrite's setup fees and per-ticket charges.

### Managing Entry Fee Payments (The Magic)

Marcus shares the event QR code in his running club's group chat and on Nostr. Within an hour, five people request to join. He opens the Captain Dashboard and sees the **Join Requests** section:

**Participant 1: @sarah_runs**
- Entry fee: 2,100 sats
- **Payment Status: Verified ✓** (green badge)

**Participant 2: @mike_cyclist**
- Entry fee: 2,100 sats
- **Payment Status: Verifying...** (yellow badge)

**Participant 3: @jenny_fitness**
- Entry fee: 2,100 sats
- **Payment Status: Payment Claimed ⚠️** (orange badge)

What's happening here?

### The Payment Verification System

RUNSTR uses a **dual-path payment verification system**:

**Path 1: Automatic NWC Verification (Marcus has NWC wallet)**

Marcus connected his Alby wallet via Nostr Wallet Connect (NWC). When participants pay his Lightning address and submit join requests with payment proofs (the Lightning invoice strings), RUNSTR automatically queries Marcus's Alby wallet via NWC:

```
lookupInvoice(invoiceString) → { settled: true }
```

If the wallet confirms the invoice was paid, the badge shows **"Verified ✓"** (green). Sarah's payment was instant—she paid with Cash App, the invoice settled in 2 seconds, auto-verified.

Mike's payment is still processing (Verifying...). Jenny used a slower Lightning wallet, so her payment is still in-flight.

**Path 2: Manual Verification (Lightning Address without NWC)**

If Marcus had only provided a Lightning address (without NWC), the badges would show **"Payment Claimed ⚠️"** because RUNSTR can't auto-verify payments to Lightning addresses—they're just endpoints, not APIs.

In that case, Marcus would:
1. Check his Lightning wallet manually (Alby, Cash App, Strike, etc.)
2. See the incoming 2,100 sat payments
3. Tap "Mark as Paid" for each verified payment

**Path 3: Transaction History (Captain Dashboard Feature)**

Marcus scrolls down to the **Transaction History** section (only visible because he has NWC connected). It shows:

- **Nov 8, 09:42 AM** - Incoming 2,100 sats (matches entry fee ✓)
- **Nov 8, 09:45 AM** - Incoming 2,100 sats (matches entry fee ✓)
- **Nov 8, 09:50 AM** - Incoming 2,150 sats (close enough, ±1% tolerance ✓)

This history helps Marcus cross-reference payments if auto-verification fails. He can manually match incoming transactions to join requests.

### The Lightning Payment Revolution

Here's what just happened that's revolutionary:

1. **Participants paid with ANY Lightning wallet**
   - Sarah used Cash App ($0 app, mainstream adoption)
   - Mike used Strike (another fiat-to-Bitcoin app)
   - Jenny used Alby (Nostr-native Bitcoin wallet)
   - Could have used: Phoenix, Breez, Zeus, or self-custodial Lightning nodes

2. **Marcus received payments directly**
   - No Stripe processing fees (2.9% + $0.30)
   - No Eventbrite platform fees (3.5% + $1.59)
   - Just Lightning network routing fees (~0.1% = 2 sats per payment)

3. **Instant settlement**
   - Sarah's payment confirmed in 2 seconds
   - No 7-day payment holds (like PayPal)
   - No chargebacks (Bitcoin is final)

4. **Global accessibility**
   - Participants from Nigeria, El Salvador, Philippines can pay with Bitcoin
   - No credit card required (excludes 1.4 billion unbanked people)
   - No foreign transaction fees

**Cost comparison for 200 participants at 2,100 sats each (420,000 sats = ~$300):**

- **Traditional platform:** $493 (Eventbrite) + $175 (Stripe) = **$668 in fees (13.4%)**
- **RUNSTR:** ~420 sats in Lightning routing fees = **~$0.30 (0.1%)**

Marcus just saved **$667.70** that goes directly to HRF instead of payment processors.

### Managing the Event Roster

By Thanksgiving week, 47 people have joined Marcus's Turkey Trot. He views them in the **Current Participants** section:

- 39 participants with verified payments ✓
- 5 participants with manually marked payments ✓
- 3 participants still pending payment

He approves all 44 paid participants. The app updates the event's kind 30000 member list. Those 44 people can now submit workout times to the leaderboard.

The 3 pending participants? Marcus sends them a friendly message via Nostr DM: "Hey, just checking if your payment went through! Let me know if you need help."

One responds: "I paid cash at our last group run!" Marcus taps "Mark as Paid" and approves them. The others eventually complete their payments.

### Thanksgiving Day: The Leaderboard Goes Live

Participants start completing their 5Ks:

- Some run Thanksgiving morning before turkey dinner
- Others run Friday (more turkey to burn off)
- A few ambitious souls run both days (only their fastest counts)

Marcus watches the **Event Leaderboard** update in real-time:

| Rank | Name | Time | Type |
|------|------|------|------|
| 1 | @sarah_runs | 23:14 | Virtual |
| 2 | @mike_cyclist | 24:02 | Virtual |
| 3 | @jenny_fitness | 25:37 | In-Person |
| 4 | @alex_runner | 26:11 | Virtual |

**How it works:**
1. Participants complete their 5Ks (tracked in Apple Watch, Garmin, or RUNSTR GPS tracker)
2. Workouts sync to their devices via HealthKit or Garmin Connect
3. They tap "Save to Nostr" in RUNSTR
4. App publishes kind 1301 workout event with distance/duration
5. RUNSTR queries kind 1301 events from all 47 participants
6. Filters for running workouts ≥5km during event window (Nov 27-29)
7. Extracts duration (fastest time wins for 5K races)
8. Sorts and displays leaderboard

The leaderboard updates every 5 minutes (caching for performance). Marcus can pull-to-refresh for instant updates.

Sarah wins with 23:14. Second place goes to Mike at 24:02.

### Prize Distribution and Charity Impact

Marcus has 98,700 sats in his wallet:
- 47 participants × 2,100 sats = 98,700 sats (~$70)

He allocated a 50,000 sat prize pool:
- 1st place (Sarah): 25,000 sats (~$17.50)
- 2nd place (Mike): 15,000 sats (~$10.50)
- 3rd place (Jenny): 10,000 sats (~$7)

But Sarah (remember her from Story 1?) doesn't want the sats. She replies in the team chat: "Donate my winnings to HRF!" Mike and Jenny say the same.

Marcus navigates to the team charity section. He taps "Zap The HRF" and sends the full 98,700 sats directly to HRF's Lightning address: `nostr@btcpay.hrf.org`

**The transaction:**
- Source: Marcus's Alby wallet
- Destination: HRF's BTCPay Server
- Amount: 98,700 sats (~$70)
- Fees: ~98 sats (0.1%)
- Time: 3 seconds
- Intermediaries: Zero

HRF receives 98,602 sats. Compare to the traditional platform where HRF would have received ~$60 after fees ($70 - $10 in processing fees).

### What Marcus Gets That Other Platforms Don't Provide

1. **Zero Platform Fees** - No Eventbrite, no Stripe, no middlemen taking 13%
2. **Direct Bitcoin Payments** - Lightning Network settlements in seconds, not days
3. **Universal Wallet Support** - Participants use Cash App, Strike, Alby, whatever they prefer
4. **Automated Payment Verification** - NWC integration auto-confirms payments
5. **Real-Time Leaderboards** - Nostr-based scoring updates as participants post workouts
6. **Permissionless Event Creation** - No platform approval, no setup fees, instant publishing
7. **QR Code Sharing** - Digital and printable event promotion
8. **Direct Charity Donations** - Send 100% of proceeds to charities without intermediary custody

Marcus isn't just hosting a race. He's running a decentralized charity fundraiser where participants own their workout data, payments go directly to the cause, and no corporation extracts rent from the transaction.

---

## The Three Superpowers: Deep Dive

### 1. Anonymous, Local-First Fitness Tracker

**The Surveillance Capitalism Problem**

Modern fitness apps are data honeypots. Strava's 2018 heat map leak revealed classified military base locations by aggregating soldiers' runs. Fitness data has been subpoenaed in divorce cases, used to challenge insurance claims, and sold to data brokers who correlate it with credit scores and employment records.

The business model is clear: offer free/cheap fitness tracking in exchange for surveillance rights. Your data becomes their product.

**RUNSTR's Alternative: Data Sovereignty**

RUNSTR flips this model:

1. **No email/phone required** - Nostr key-based authentication (nsec/npub)
2. **Local storage first** - All workouts stored in encrypted AsyncStorage on your device
3. **Selective publishing** - You choose what to sync to Nostr, when, and for what purpose
4. **On-device analytics** - Health metrics (VO2 Max, fitness age, BMI) computed locally without cloud APIs
5. **No backend database** - RUNSTR has no centralized server storing your data
6. **Data portability** - Your kind 1301 workout events work in any Nostr fitness app

**Technical Architecture:**

- **Local Storage:** `LocalWorkoutStorageService` uses AsyncStorage (encrypted iOS/Android storage)
- **Nostr Publishing:** Optional, user-initiated via `workoutPublishingService`
- **Health Analytics:** `CardioPerformanceAnalytics`, `BodyCompositionAnalytics` run entirely on-device
- **No Tracking SDKs:** No Google Analytics, Facebook Pixel, or ad attribution tracking

**Multi-Source Aggregation:**

Unlike walled gardens (Strava forces Strava tracking, Garmin pushes Garmin watches), RUNSTR integrates:

- **Apple HealthKit** - Syncs Apple Watch, iPhone workouts, and all HealthKit-compatible apps (Peloton, Nike Run Club, etc.)
- **Garmin Connect** - OAuth integration for Garmin watches (Edge, Forerunner, Fenix)
- **Manual Entry** - In-app GPS tracker for running, cycling, hiking + manual strength/meditation/diet logging
- **Nostr Import** - Pull kind 1301 events from other Nostr fitness apps (interoperability)

**Privacy Features:**

- **Anonymous Identity:** Nostr keys aren't linked to real names/emails
- **Selective Sharing:** Default is private; opt-in to publish
- **No Social Graph Leakage:** Unlike Strava's auto-follow suggestions based on location
- **Local Analytics:** No cloud AI training on your workout patterns

This architecture makes RUNSTR the **fitness data hub** for privacy-conscious athletes. Use your preferred tracking devices, aggregate everything in one place, maintain sovereignty over what you share.

---

### 2. Competition Management Platform

**The Event Platform Extraction Problem**

Traditional race registration platforms (Eventbrite, RaceRoster, RunSignUp) extract 5-15% from registration fees:

- **Eventbrite:** 3.5% + $1.59 per ticket
- **Stripe/PayPal:** 2.9% + $0.30 processing fees
- **Currency conversion:** 2-3% for international participants

For a small charity 5K with 100 participants at $30 each ($3,000 raised):
- Platform fees: ~$400
- Charity receives: ~$2,600
- **Extraction rate: 13.3%**

These platforms provide basic registration forms, email confirmations, and participant lists. They don't handle race-day logistics, leaderboards, or real-time tracking. Organizers still need separate timing systems, manual leaderboard updates, and volunteer coordination.

**RUNSTR's Alternative: Decentralized Event Infrastructure**

RUNSTR provides end-to-end event management without middleman fees:

**Event Creation (5 minutes):**
- **Wizard-driven interface** - Preset templates for 5K, 10K, Half Marathon
- **Customizable parameters** - Date, entry fee (sats), prize pool, payment destination
- **QR code generation** - Instant shareable event codes for digital/print promotion
- **Nostr publication** - Event appears globally on RUNSTR and other Nostr apps

**Payment System:**
- **Lightning invoices** - Generated from captain's Lightning address or NWC wallet
- **Universal wallet support** - Participants pay with Cash App, Strike, Alby, Phoenix, Breez, self-custodial nodes
- **Dual-path verification:**
  - **Auto-verify:** NWC integration queries captain's wallet to confirm invoice settlement
  - **Manual verify:** Captain checks wallet and marks payments as received
- **Transaction history:** Dashboard shows all incoming payments matching entry fee

**Roster Management:**
- **Join request approval** - Captain reviews and approves participants (with payment verification)
- **Member list** - Stored as Nostr kind 30000 list (decentralized, portable)
- **Removal capability** - Captain can remove participants (refunds handled off-platform)

**Real-Time Leaderboards:**
- **Automatic scoring** - Queries kind 1301 workout events from all participants
- **Multiple scoring types:**
  - **Fastest time** (for races: 5K, 10K, marathon)
  - **Total distance** (for monthly challenges)
  - **Consistency** (for streak competitions)
- **5-minute cache** - Performance optimization with manual refresh option
- **Activity eligibility detection** - App suggests submitting qualifying workouts to competitions

**Cost Comparison (200 participants, $30 entry fee = $6,000 total):**

| Platform | Platform Fee | Processing Fee | Total Fees | Charity Receives |
|----------|--------------|----------------|------------|------------------|
| Eventbrite + Stripe | $872 | $192 | $1,064 (17.7%) | $4,936 |
| RUNSTR + Lightning | $0 | ~$4 (0.07%) | $4 (0.07%) | $5,996 |

**Savings: $1,060** that goes to the cause instead of intermediaries.

**Use Cases:**
- **Virtual races** - Participants run on their own schedule, submit times, compete on leaderboard
- **In-person races** - Use RUNSTR for registration/payment, run race normally, participants submit verified times
- **Hybrid events** - Mix of in-person and virtual participants
- **Charity fundraisers** - Direct Lightning donations to charitable causes
- **Team challenges** - Monthly distance goals, consistency streaks, fitness tests

**What You Don't Get (Yet):**
- ❌ Automated prize distribution (captain manually sends winnings)
- ❌ Refund system (handled off-platform)
- ❌ In-app messaging (use Nostr DMs separately)
- ❌ Race-day timing chips (RUNSTR is registration/leaderboards, not on-ground logistics)

RUNSTR replaces the **financial infrastructure** of event management (registration, payment, leaderboards) but doesn't replace race-day operations (timing chips, water stations, volunteers). It's designed for virtual/hybrid events and small-scale in-person races where participants track their own times.

---

### 3. Charity Crowdfunding Platform

**The Overhead Problem with Traditional Fundraising**

Traditional fundraising platforms extract significant overhead:

- **GoFundMe:** 2.9% + $0.30 per donation
- **Patreon:** 5-12% of monthly income
- **Charity Navigator admin overhead:** 10-25% for many nonprofits

Layer on currency conversion fees (for international donors) and credit card processing, and a $100 donation might become $85 to the actual cause.

More fundamentally: **centralized platforms control who can fundraise.** GoFundMe has frozen fundraisers for controversial causes. Patreon has deplatformed creators. Payment processors (Visa, Mastercard, PayPal) have denied service to organizations they disagree with politically.

**RUNSTR's Alternative: Direct Charity Contributions**

RUNSTR enables **direct Lightning payments** from donors to charities:

**How It Works:**

1. **Team Charity Selection:**
   - Teams choose a supported charity during creation (OpenSats, HRF, or custom)
   - Charity's Lightning address stored in team metadata (kind 33404 event)

2. **Direct Zapping:**
   - Team page displays charity section with "Zap [Charity]" button
   - Single tap → 21 sats quick zap
   - Long press → Custom amount modal
   - App generates Lightning invoice from charity's address
   - Donor pays with any Lightning wallet
   - **Charity receives sats directly** (no intermediary)

3. **Competition Charity Routing:**
   - Event creators set `paymentDestination: 'charity'` during setup
   - Entry fees flow to captain's wallet
   - Captain manually sends accumulated fees to charity after event
   - **Roadmap:** Automatic percentage splitting (e.g., "50% to charity, 50% to prize pool")

**Current Charities Supported:**
- **OpenSats** (`opensats@vlt.ge`) - Bitcoin open-source developer grants
- **Human Rights Foundation** (`nostr@btcpay.hrf.org`) - Bitcoin advocacy for human rights

**Technical Implementation:**

- **Lightning Address Protocol:** LNURL-pay standard for invoice generation
- **Invoice Generation:** `CharityZapService` fetches LNURL endpoint, requests invoice for specified amount
- **Payment Detection:** NWC lookups confirm settlement (for captains with NWC wallets)
- **No Custody:** RUNSTR never holds funds; all payments are direct P2P

**Cost Comparison (1,000 donations of $10 each = $10,000):**

| Platform | Processing Fees | Charity Receives |
|----------|-----------------|------------------|
| GoFundMe | $320 (3.2%) | $9,680 |
| RUNSTR Lightning | ~$7 (0.07%) | $9,993 |

**Savings: $313** in fees that go directly to the cause.

**Censorship Resistance:**

Because RUNSTR uses Bitcoin Lightning (permissionless money) and Nostr (permissionless communication), no corporation can:
- Freeze fundraising campaigns
- Deplatform organizations
- Block international donations
- Censor which charities are supported

A charity in Nigeria can receive donations from supporters in Argentina, South Korea, and Germany with equal ease—no foreign transaction fees, no bank account required, just a Lightning address.

**Current Limitations (Honest Assessment):**

RUNSTR's charity functionality is **partially implemented**:

✅ **What Works:**
- Direct Lightning zaps to charities
- Team charity selection and display
- Manual donation routing (captain sends entry fees to charity)

❌ **What's Missing:**
- **Automated donation splitting** - Entry fees go to captain's wallet, not automatically split to charity
- **Fundraising goals** - No target amount tracking ("Raise 1M sats for HRF")
- **Donation leaderboards** - Can't see top contributors or total raised
- **More charities** - Limited to OpenSats and HRF currently
- **Receipts** - No tax-deductible donation receipts (Bitcoin donations aren't tracked by fiat tax systems)

**Roadmap Enhancements:**

To become a full **crowdfunding platform**, RUNSTR needs:

1. **Auto-split payments** - Route percentage of entry fees directly to charity on payment
2. **Fundraising campaigns** - Teams create charity drives with goals, progress bars, leaderboards
3. **Donor recognition** - Display top contributors (opt-in) to encourage competitive giving
4. **Charity verification** - Expand to more charities with verified Lightning addresses
5. **Impact tracking** - Show total sats raised per charity across all RUNSTR teams

**Current Positioning:**

RUNSTR is best described as a **charity-integrated fitness platform** rather than a pure crowdfunding platform. It facilitates direct Bitcoin donations to charities within the context of fitness competitions, but doesn't offer standalone fundraising campaign tools (like GoFundMe pages).

The value proposition: **fitness competitions that benefit causes you care about**, not "earn sats for yourself."

---

## Who Is RUNSTR For?

### The Ideal User Profiles:

**1. Bitcoin/Nostr Community Athletes**
- Already understand Lightning payments and Nostr protocol
- Privacy-conscious and value data sovereignty
- Want to integrate fitness into their Bitcoin circular economy
- **Market size:** ~50,000+ active Nostr users globally

**2. Privacy-Focused Fitness Enthusiasts**
- Uncomfortable with Strava/Garmin/Apple's data practices
- Want multi-source workout aggregation without surveillance
- Prefer local-first architecture and selective sharing
- **Market size:** Millions of potential users concerned about fitness data privacy

**3. Charity Race Organizers**
- Currently using Eventbrite/RaceRoster and frustrated by 10-15% fees
- Running small-to-medium virtual/hybrid races (10-500 participants)
- Want to maximize donations to charity by eliminating middleman fees
- **Market size:** Thousands of charity 5Ks, 10Ks, and virtual races annually

**4. Running Clubs and Fitness Teams**
- Organize monthly challenges and group activities
- Want member management tools without monthly SaaS fees
- Looking for engagement mechanisms (competitions, leaderboards)
- **Market size:** Thousands of running clubs and fitness communities globally

**5. International Participants (Unbanked/Underbanked)**
- Live in countries with limited credit card access
- Can't participate in traditional race registration (requires Visa/Mastercard)
- Have access to Bitcoin/Lightning via mobile wallets
- **Market size:** 1.4 billion unbanked people globally, millions with Lightning access

### Who RUNSTR Is **Not** (Yet) For:

**1. Large-Scale Races (1,000+ participants)**
- Current leaderboard performance optimized for <500 participants
- No race-day timing chip integration
- Limited customer support infrastructure

**2. Non-Technical Users (Short-Term)**
- Requires understanding of Nostr keys (nsec/npub)
- Lightning payments may be unfamiliar to non-Bitcoiners
- **Mitigation:** Auto-generate keys, support mainstream Lightning wallets (Cash App, Strike)

**3. Traditional Corporate Sponsors**
- No fiat payment rails (USD, EUR, etc.)
- Bitcoin-only may limit corporate partnership options
- **Future:** Could add Lightning-to-fiat conversion partnerships

---

## The Competitive Landscape: Where RUNSTR Stands Alone

| Feature | RUNSTR | Strava | Garmin Connect | Eventbrite |
|---------|--------|--------|----------------|------------|
| **Privacy** | Anonymous Nostr keys, local-first | Email required, data mining | Email required, account-locked | Email required, tracking pixels |
| **Data Ownership** | User owns keys + data | Platform owns data | Platform owns data | Platform owns data |
| **Multi-Source Aggregation** | ✅ HealthKit, Garmin, manual | ❌ Strava tracking only | ❌ Garmin devices only | N/A |
| **Event Management** | ✅ Free, Lightning payments | ❌ No event tools | ❌ No event tools | ✅ But 10-15% fees |
| **Payment System** | Lightning Network, 0.1% fees | N/A | N/A | Credit card, 3-5% fees |
| **Charity Integration** | ✅ Direct Lightning zaps | ❌ No built-in charity | ❌ No built-in charity | ✅ But extracts fees |
| **Censorship Resistance** | ✅ Nostr + Bitcoin | ❌ Can deplatform users | ❌ Can deplatform users | ❌ Can freeze campaigns |
| **Global Accessibility** | ✅ Bitcoin works anywhere | ⚠️ Limited in some countries | ⚠️ Limited in some countries | ❌ Credit card required |

**RUNSTR's Unique Value:** The **only** fitness platform that combines:
1. Anonymous, local-first tracking
2. Multi-source workout aggregation
3. Permissionless event management
4. Near-zero-fee Bitcoin payments
5. Direct charity contributions
6. Censorship-resistant infrastructure

---

## Getting Started: From Download to First Competition

### For Athletes:

1. **Download RUNSTR** (iOS App Store, Android coming soon)
2. **Create Identity** - Tap "Start" → Auto-generates Nostr keys → Back up nsec
3. **Connect Data Sources** - Grant HealthKit access, connect Garmin (optional)
4. **Browse Teams** - Find teams by location, activity type, or charity focus
5. **Join a Team** - Request to join, captain approves within 24 hours
6. **Enter Competition** - Pay entry fee (if applicable) with Lightning wallet
7. **Complete Workout** - Track with Apple Watch, Garmin, or RUNSTR GPS tracker
8. **Submit to Competition** - Tap "Save to Nostr" → Appears on leaderboard
9. **Support Charity** - Win prizes, donate to team's charity via Lightning zap

**Need a Lightning Wallet?**
- **Beginners:** Cash App (free, mainstream, works in US)
- **Intermediate:** Strike (global, fiat on/off ramps)
- **Advanced:** Alby (Nostr-integrated, web wallet)
- **Power Users:** Phoenix, Breez (self-custodial, mobile)

### For Event Organizers:

1. **Download RUNSTR** (iOS App Store)
2. **Create Identity** - Generate Nostr keys
3. **Create Team** - Name, description, select charity
4. **Set Up Lightning Wallet** - Alby recommended for NWC auto-verification
5. **Create Event** - Use wizard to set up 5K/10K/etc. with entry fee
6. **Share QR Code** - Digital promotion or print for in-person signup
7. **Manage Join Requests** - Approve participants, verify payments automatically
8. **Monitor Leaderboard** - Real-time updates as participants submit workouts
9. **Distribute Prizes** - Manual Lightning zaps to winners
10. **Send to Charity** - Direct Lightning payment to charity's address

**Recommended Setup:**
- **Alby Wallet** - Provides both Lightning address (for receiving entry fees) and NWC (for auto-verification)
- **Nostr Client** - Use Damus (iOS) or Amethyst (Android) for team communication via Nostr DMs
- **Backup Keys** - Save your nsec in a password manager (1Password, Bitwarden)

---

## The Future of Fitness Is Decentralized

Traditional fitness apps offer a Faustian bargain: convenience in exchange for surveillance. Tracking your runs shouldn't mean surrendering your location history to data brokers. Competing in virtual 5Ks shouldn't enrich payment processors more than charities.

RUNSTR proves a different model is possible:

- **Athletes own their data** through local-first architecture and Nostr identity
- **Organizers keep their revenue** through near-zero-fee Lightning payments
- **Charities receive more donations** by eliminating 10-15% platform extractions
- **Communities form permissionlessly** without corporate gatekeepers

This isn't just a fitness app. It's a demonstration that decentralized protocols (Nostr for communication, Bitcoin for money) can provide better user experiences than surveillance capitalism.

Sarah tracks her workouts without giving Strava her location history. Marcus raises money for human rights without Eventbrite taking 13%. The Human Rights Foundation receives Bitcoin donations from people in countries where traditional payment rails would block them.

**The future of fitness is:**
- **Private by default**, not surveilled
- **User-owned data**, not platform-locked
- **Permissionless competition**, not gated by corporations
- **Direct value transfer**, not rent-seeking intermediaries

RUNSTR is building that future. One run at a time.

---

## Download RUNSTR

**iOS:** Available on App Store (search "RUNSTR Rewards")
**Android:** Coming Q1 2026

**Learn More:**
- **Nostr Protocol:** [nostr.com](https://nostr.com)
- **Lightning Network:** [lightning.network](https://lightning.network)
- **Supported Charities:** [OpenSats](https://opensats.org), [HRF](https://hrf.org)

**Questions?** Find us on Nostr at npub1runstr... or email hello@runstr.com

---

*RUNSTR is open-source software. Contribute on GitHub: [github.com/runstr/runstr-app](https://github.com)*

**Built on Bitcoin. Powered by Nostr. Owned by You.**
