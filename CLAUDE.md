# RUNSTR REWARDS - Claude Context

## Project Overview
RUNSTR REWARDS is a React Native mobile application that transforms fitness routines into Bitcoin-powered team competitions through Nostr's decentralized protocol. The app focuses on three core pillars: **Teams** (community-driven fitness groups with charity integration), **Competitions** (Bitcoin-incentivized events with ticket sales), and **Workouts** (local-first data with selective publishing). Teams receive payments via Nostr Wallet Connect (NWC), enabling instant Bitcoin transactions without platform custody. Members can pay event entry fees with any Lightning wallet (Cash App, Strike, Alby, self-custodial), and captains can challenge each other to 1v1 competitions with Bitcoin wagers.

📖 **For detailed overview, see**: [RUNSTR_REWARDS_OVERVIEW.md](./RUNSTR_REWARDS_OVERVIEW.md)
📖 **For user flow documentation, see**: [APP_USER_FLOW_AND_CAPTAIN_EXPERIENCE.md](./docs/APP_USER_FLOW_AND_CAPTAIN_EXPERIENCE.md)
🔐 **For environment setup (NWC, secrets), see**: [ENVIRONMENT_SETUP.md](./docs/ENVIRONMENT_SETUP.md)

## Strategic Direction: Three Core Pillars

RUNSTR is refocusing on three essential components that make fitness competitions work:

### 1. **Teams** - Community-Driven Fitness Groups
- Teams discovered through Nostr (kind 33404 metadata)
- Member rosters stored in kind 30000 lists (single source of truth)
- **Charity Integration**: Each team designates a supported charity (OpenSats, HRF, local organizations)
- **NWC Payment Reception**: Teams receive payments via Nostr Wallet Connect connection strings
- **No Platform Custody**: Teams control their own Lightning wallets

### 2. **Competitions** - Bitcoin-Incentivized Events
- Virtual fitness events (5Ks, cycling challenges, strength competitions)
- **Entry Fee Tickets**: Captains set entry fees in satoshis (e.g., 2,100 sats = ~$1-2)
- **Lightning Invoice Generation**: Using Alby MCP tools to create invoices
- **Universal Wallet Support**: Users pay with Cash App, Strike, Alby, or self-custodial wallets
- **Payment Detection**: Automatic confirmation via NWC polling/webhooks
- **Instant Participation**: Payment detected → User added to event locally → Join request to captain
- **1v1 Challenges**: Members challenge each other with Bitcoin wagers (escrow both sides, auto-payout winner)

### 3. **Workouts** - Local-First Data Control
- All workouts stored locally in AsyncStorage/SQLite until published
- **Two Publishing Options**:
  - Kind 1 (social posts with beautiful cards)
  - Kind 1301 (competition entries with structured data)
- HealthKit integration for Apple Watch/iPhone workouts
- User has complete control over when/what to publish

### Target Market: Bitcoin/Nostr Community First
- **50,000+ addressable market** of Bitcoiners and Nostr users
- Solves cold start problem by targeting community that already understands:
  - Private keys (nsec) and public keys (npub)
  - Lightning Network payments and invoices
  - Decentralized protocols and data ownership
- **Auto-Nsec Generation**: Bitcoiners without Nostr accounts get auto-generated keys with backup instructions
- **Proven Product-Market Fit**: Won first place in NosFabrica challenge

## Core User & Captain Experience
**User Flow**: Nsec login → Auto-wallet creation → Profile screen → Teams discovery → Team joining → Competition participation → Earn/send zaps
**Captain Flow**: Teams page → Captain dashboard → Competition creation → Member management → Direct Bitcoin rewards via zaps

**Key Features**:
- **Nostr-Only Authentication**: Direct nsec login with automatic profile/workout import (auto-generation for Bitcoiners)
- **NWC Lightning Payments**: Teams receive payments via Nostr Wallet Connect connection strings
- **Universal Wallet Support**: Users pay with ANY Lightning wallet (Cash App, Strike, Alby, self-custodial)
- **Event Ticket Sales**: Entry fees generate Lightning invoices, payment detection triggers instant participation
- **1v1 Bitcoin Wagers**: Challenge friends with sats on the line, automatic escrow and winner payout
- **Charity Integration**: Team pages display selected charities (OpenSats, HRF, community organizations)
- **HealthKit Workout Posting**: Transform Apple Health workouts into Nostr events and social media cards
- Real-time team discovery from multiple Nostr relays
- Captain dashboard with join request management
- Competition creation (7 activity types, cascading dropdowns)
- Automatic leaderboard scoring based on captain-defined parameters
- **Beautiful Social Cards**: Instagram-worthy workout achievement graphics with RUNSTR branding
- **Performance Optimizations**: Aggressive caching eliminates loading states, instant navigation after splash

**Authentication**:
- **Simple Login Screen**: Show login screen unless npub/nsec found in local storage
- **Direct Nostr Authentication**: Manual nsec input only (no platform-specific auth)
- **Pure Nostr Flow**: Nsec login → derive npub → store locally in AsyncStorage

## Key Technologies
- **Frontend**: React Native with TypeScript (Expo framework)
- **Data Layer**: Pure Nostr - NO SUPABASE (all data from Nostr events)
- **Authentication**: Nostr (nsec) - direct authentication only
- **Fitness Data**: Kind 1301 events from Nostr relays + Apple HealthKit
- **Team Data**: Custom Nostr event kinds for teams, leagues, events, challenges (see [nostr-native-fitness-competitions.md](./docs/nostr-native-fitness-competitions.md))
- **Bitcoin**: Lightning payments via Nostr Wallet Connect (NWC) + Lightning addresses for universal wallet support
- **Nostr Library**: NDK (@nostr-dev-kit/ndk) EXCLUSIVELY - NEVER use nostr-tools
- **Global NDK Instance**: Single shared NDK instance via `GlobalNDKService` - reduces WebSocket connections by 90%
- **Nostr Relays**: Damus, Primal, nos.lol, Nostr.band (4 relays via global NDK pool)
- **In-App Notifications**: Nostr event-driven notifications (kinds 1101, 1102, 1103) - no push notifications
- **IMPORTANT**: This project uses NO SUPABASE - pure Nostr only

## Nostr Event Kinds Reference

📖 **For comprehensive details, see**: [nostr-native-fitness-competitions.md](./docs/nostr-native-fitness-competitions.md)

**Quick Reference Table:**

### Fitness & Workout Data
- **kind 1301**: Workout events (distance, duration, calories) - **foundation of all competitions**
- **kind 1**: Social workout posts with beautiful cards

### Team Management
- **kind 33404**: Team metadata and discovery
- **kind 30000**: Team member lists (**single source of truth** for membership)
- **kind 30001**: Generic lists (secondary lists)
- **kind 1104**: Team join requests

### Competitions (Leagues & Events)
- **kind 30100**: League definitions (ongoing competitions)
- **kind 30101**: Event definitions (time-bounded competitions)
- **kind 1105**: Event join requests (separate from team joins)

### Challenges (1v1 Competitions)
- **kind 1105**: Challenge requests (initiate 1v1 competition)
- **kind 1106**: Challenge acceptances (creates kind 30000 participant list)
- **kind 1107**: Challenge declines

### Notifications
- **kind 1101**: Competition announcements
- **kind 1102**: Competition results and prize distribution
- **kind 1103**: Competition starting soon reminders

### Bitcoin/Lightning Payments
- **NWC Connection Strings**: Stored in team metadata for receiving payments (nostr+walletconnect://...)
- **Lightning Addresses**: Fallback payment method (team@getalby.com format)
- **Invoice Generation**: Using Alby MCP tools for Lightning invoice creation
- **Payment Detection**: Polling/webhooks via NWC for instant payment confirmation

### User Profile
- **kind 0**: Profile metadata (name, picture, about)
- **kind 3**: Contact lists (social graph)

**Critical Architecture:**
- **kind 1301** = workout data (what users do)
- **kind 30000** = team rosters (who's competing)
- **Leaderboards** = query kind 30000 for members → query kind 1301 from those members → calculate locally
- **No backend database** - pure client-side Nostr queries

## Kind 1301 Workout Event Format

**Overview**: RUNSTR publishes kind 1301 events for fitness tracking, supporting all activities for in-app competitions.

**Critical Format Rules**:
- Content must be plain text, NOT JSON
- Exercise type: lowercase full words (`running`, not `run`)
- Distance: separate array elements `['distance', '5.2', 'km']`
- Duration: HH:MM:SS format (`00:30:45`)

**Supported Activities**: running, walking, cycling, hiking, swimming, rowing, strength, yoga, meditation, other

📖 **For complete event specification, tag requirements, and examples, see**: [docs/KIND_1301_SPEC.md](./docs/KIND_1301_SPEC.md)

## Architecture Principles
- **File Size Limit**: Maximum 500 lines per file for maintainability
- **Three Core Pillars**: Focus on Teams, Competitions, Workouts - everything else is secondary
- **Pure Nostr Data Model**: All team, competition, and social data from Nostr events
- **No Backend Dependencies**: No Supabase, no traditional backend - pure Nostr
- **NWC Payment Integration**: Non-custodial Lightning payments via Nostr Wallet Connect
- **Performance First**: Aggressive caching eliminates loading states after initial splash
- **Local-First Workouts**: Store locally, sync to Nostr only on user action
- **Real Data Only**: No mock data - all functionality uses actual Nostr events + HealthKit data
- **Folder Documentation**: Update folder READMEs when adding/removing/changing files

## Global NDK Instance Architecture

**CRITICAL: The app uses a single global NDK instance for all Nostr operations**

**Why Global NDK?**
- **Prevents Connection Explosion**: Before global NDK, 9 services × 4 relays = 36 WebSocket connections. After: 1 NDK × 4 relays = 4 connections (90% reduction)
- **Eliminates Timing Issues**: New relay managers need 2-3 seconds to connect, causing "No connected relays available" errors
- **Better Performance**: Reusing one connection pool instead of creating/destroying connections per query
- **Connection Stability**: Single instance maintains persistent relay connections throughout app lifetime

**How to Use:**
```typescript
import { GlobalNDKService } from '../services/nostr/GlobalNDKService';

// In any service that needs to query Nostr:
const ndk = await GlobalNDKService.getInstance();
const events = await ndk.fetchEvents(filter);
```

**IMPORTANT RULES:**
- ✅ **ALWAYS** use `GlobalNDKService.getInstance()` for Nostr queries
- ❌ **NEVER** create new `NostrRelayManager()` instances
- ❌ **NEVER** create new `NDK()` instances (except in GlobalNDKService itself)
- ✅ **USE** `ndk.fetchEvents()` for direct queries (returns promise)
- ✅ **USE** `ndk.subscribe()` for real-time subscriptions (returns subscription object)

**Global NDK Configuration:**
- **Default Relays**: `wss://relay.damus.io`, `wss://relay.primal.net`, `wss://nos.lol`, `wss://relay.nostr.band`
- **Initialized**: On app startup by `GlobalNDKService`
- **Connection Timeout**: 2 seconds
- **Auto-reconnect**: Built into NDK

**Services Using Global NDK:**
- `SimpleCompetitionService` - Fetches leagues/events (kind 30100, 30101)
- `SimpleLeaderboardService` - Queries workout events (kind 1301)
- `NdkTeamService` - Team discovery (kind 33404)
- `JoinRequestService` - Join requests (kind 1104, 1105)
- All other Nostr-dependent services

**Connection Status:**
```typescript
// Check if NDK is connected
const status = GlobalNDKService.getStatus();
console.log(`${status.connectedRelays}/${status.relayCount} relays connected`);

// Force reconnect if needed
await GlobalNDKService.reconnect();
```

## Lightning Payment Architecture (NWC)

**Overview**: RUNSTR uses Lightning payments for event tickets, 1v1 challenges, and team payments via Nostr Wallet Connect (NWC).

**Key Features:**
- Event ticket sales with entry fees (e.g., 2,100 sats)
- 1v1 challenge wagers with Bitcoin escrow
- Payment detection via Alby SDK (@getalby/sdk v6+)
- Universal wallet support (Cash App, Strike, Alby, self-custodial)
- Non-custodial team wallets via NWC connection strings

📖 **For complete implementation details, code examples, and payment flows, see**: [docs/LIGHTNING_IMPLEMENTATION.md](./docs/LIGHTNING_IMPLEMENTATION.md)

## Event Payment Verification System

**Overview**: Complete payment verification system for paid event join requests with dual-path verification (NWC auto-verify + manual override).

### **Architecture Components:**

**1. Payment Data Model** (`EventJoinRequestService.ts`)
- Join requests (kind 1105) include payment tracking fields:
  - `paymentProof`: Lightning invoice string or 'MANUAL_VERIFICATION'
  - `paymentHash`: Extracted payment hash for NWC lookups
  - `amountPaid`: Entry fee amount in satoshis
  - `paymentTimestamp`: When payment was submitted
- Tags automatically extracted when parsing kind 1105 events

**2. Payment Verification Badge** (`PaymentVerificationBadge.tsx`)
- Visual indicator showing payment status with 6 states:
  - `free`: No payment required
  - `claimed`: User claims payment (can't auto-verify)
  - `verifying`: Checking NWC for payment confirmation
  - `verified`: Payment confirmed via NWC
  - `not_found`: Payment not found in NWC transactions
  - `manual_paid`: Captain manually marked as paid
- Auto-verifies payments when captain has NWC wallet configured
- Shows retry button for failed verifications

**3. Transaction History** (`EventTransactionHistory.tsx`)
- Shows incoming Lightning payments matching event entry fee
- Filters transactions by:
  - Amount (entry fee ±1% tolerance for network fees)
  - Date range (event start date → present)
  - Type (incoming only)
- Collapsible UI component (only visible for paid events)
- Requires captain to have NWC wallet configured

**4. NWC Wallet Integration** (`NWCWalletService.ts`)
- `listTransactions()`: Query wallet transaction history with filters
- `lookupInvoice()`: Check if specific invoice has been paid
- Supports both invoice strings and payment hashes
- Returns settled status for payment verification

### **Payment Flows:**

**Flow 1: NWC Auto-Verification (Captains with NWC Wallets)**
1. User pays entry fee → Submits join request with payment proof
2. Captain opens join requests section
3. PaymentVerificationBadge auto-checks NWC wallet via `lookupInvoice()`
4. Badge shows "Verified ✓" if payment found, "Not Found ✗" if missing
5. Captain can retry verification or manually approve

**Flow 2: Lightning Address Manual Verification (Captains without NWC)**
1. User pays entry fee → Submits join request with payment proof
2. Captain sees "Payment Claimed ⚠️" badge (can't auto-verify)
3. Captain clicks "Mark as Paid" button if payment received off-chain
4. Badge updates to "Marked as Paid ✓"

**Flow 3: Off-Chain Payments (Cash/Venmo)**
1. User requests to join with amount specified (no invoice)
2. Captain receives payment via cash/Venmo in person
3. Captain clicks "Mark as Paid" button on join request
4. Join request marked with `MANUAL_VERIFICATION` proof

### **Implementation Files:**
- `src/services/events/EventJoinRequestService.ts` - Payment data model
- `src/services/event/EventJoinService.ts` - Submit join requests with payment tags
- `src/services/wallet/NWCWalletService.ts` - NWC wallet operations + transaction history
- `src/components/captain/PaymentVerificationBadge.tsx` - Payment status indicator
- `src/components/captain/EventTransactionHistory.tsx` - Transaction history display
- `src/components/captain/EventJoinRequestsSection.tsx` - Join request management UI
- `src/screens/EventCaptainDashboardScreen.tsx` - Captain dashboard with transaction history

### **Key Design Decisions:**
- **Dual-Path Verification**: Auto-verify for NWC, manual for everything else
- **No Payment Enforcement**: Captains can always manually approve (trust-based system)
- **Transaction Matching**: Fuzzy matching (±1% tolerance) for network fee variations
- **Special Proof Value**: `'MANUAL_VERIFICATION'` distinguishes captain-approved payments
- **Performance**: Transaction history loads on-demand, not on every screen render

### **Testing Checklist:**
- [ ] NWC captain receives payment → Auto-verification shows "Verified"
- [ ] Lightning address captain receives payment → "Payment Claimed" badge appears
- [ ] Captain clicks "Mark as Paid" → Badge updates to "Marked as Paid"
- [ ] Transaction history shows matching incoming payments
- [ ] Non-NWC captains don't see transaction history section
- [ ] Failed lookups show retry button

## Performance Optimization Strategy

**Problem**: Heavy Nostr usage causing slow app startup and loading states throughout navigation.

**Solution**: Aggressive caching with intelligent TTLs + prefetching during splash screen.

**Key Strategies:**
- **Prefetching**: Load all critical data during splash (2-3 seconds) → Zero loading states after
- **Cache-First Pattern**: Show cached data immediately, fetch fresh in background
- **Smart TTLs**: 24hrs for profiles, 5min for leaderboards, 30sec for wallet balance
- **Batch Queries**: Combine multiple Nostr filters into single fetchEvents call

**Expected Results**: App startup 2-3 seconds, instant screen navigation, 70% faster perceived performance.

📖 **For complete caching architecture, implementation patterns, and optimization techniques, see**: [docs/PERFORMANCE_GUIDE.md](./docs/PERFORMANCE_GUIDE.md)

## Project Structure
```
src/
├── components/        # Reusable UI components (<500 lines each)
│   ├── ui/           # Basic components (Card, Button, Avatar, StatusBar)  
│   ├── team/         # Team-specific components
│   ├── profile/      # Profile-specific components
│   └── fitness/      # Workout posting and display components
├── screens/          # Main app screens
├── services/         # External API integrations
│   └── notifications/ # In-app notification system (no push)
├── store/           # State management
├── types/           # TypeScript definitions
├── utils/           # Helper functions
└── styles/          # Theme system matching HTML mockups exactly
```

## App Flow Architecture
**1. Authentication & Profile Import**:
- Show login screen unless npub/nsec found in local storage
- Nsec login automatically imports profile from kind 0 events
- Derived npub stored locally in AsyncStorage for session persistence
- Workout data synced from kind 1301 events across Nostr relays
- Apple HealthKit workouts automatically imported and available for posting
- Direct navigation to Profile screen after authentication

**2. Two-Tab Navigation**:
- **Profile Tab**: Personal dashboard with unified workout history (HealthKit + Nostr), posting controls, team membership, account settings
- **Teams Tab**: Real-time team discovery, captain detection, join/create functionality

**3. Role-Based Experience**:
- **Members**: Browse teams → Join → Participate in competitions
- **Captains**: Captain dashboard access → Wizard-driven competition creation → Member management

**4. Competition System**:
- **Wizard Creation**: 7 activity types → Dynamic competition options → Time/settings configuration
- **Nostr Event Based**: Competitions published as kind 30100 (leagues) and 30101 (events)
- **Manual Entry**: Participants post kind 1301 workout events to enter competitions
- **Automatic Scoring**: Real-time leaderboards based on captain's wizard parameters
- **Bitcoin Rewards**: Direct P2P zaps via Lightning - captains and members can instantly send satoshis

**5. Team Management**:
- **Two-Tier Membership**: Local joining (instant UX) + Official Nostr lists (captain approval)
- **Join Requests**: Real-time notifications with approval workflow
- **Member Lists**: Nostr kind 30000/30001 lists for fast competition queries

**6. In-App Notification System**:
- **Nostr Event-Driven**: Real-time processing of kinds 1101 (announcements), 1102 (results), 1103 (starting soon)
- **In-App Only**: Notifications appear while app is active (no push notifications)
- **User Preference Integration**: Respects Profile notification settings with granular control
- **Pure Client-Side**: No external push services, all notifications handled locally

**7. HealthKit Workout Posting System**:
- **Unified Workout Display**: Shows both HealthKit and Nostr workouts in single timeline
- **Two-Button System**: "Save to Nostr" (kind 1301 for competitions) vs "Post to Nostr" (kind 1 social)
- **Beautiful Social Cards**: SVG-based workout achievement graphics with RUNSTR branding
- **Smart Status Tracking**: Prevents duplicate posting, shows completion states
- **Achievement Recognition**: Automatic badges for PRs, distance milestones, calorie burns
- **Motivational Content**: Inspirational quotes tailored to workout types

**8. Pure Nostr Competition System**:
- **Kind 30000 Member Lists**: Team members stored in Nostr kind 30000 lists (single source of truth)
- **Competition Query Engine**: `Competition1301QueryService` queries kind 1301 workout events from team members
- **Dynamic Leaderboards**: Real-time calculation based on wizard-defined parameters (no database needed)
- **Captain Member Management**: Approve/remove members directly modifies kind 30000 Nostr lists
- **Cached Performance**: 5-minute cache for member lists, 1-minute cache for competition queries
- **Scoring Algorithms**: Total distance, consistency streaks, average pace, longest workouts, calorie tracking
- **No Backend Required**: Pure client-side Nostr queries replace all database dependencies

## UI Requirements
Simple two-tab interface with dark theme:
- **Colors**: Black background (#000), dark cards (#0a0a0a), borders (#1a1a1a)
- **Navigation**: Bottom tab bar with Teams and Profile tabs
- **Teams Tab**: Feed layout with "+" button for team creation
- **Profile Tab**: Unified workout history with posting controls, notification preferences, team membership
- **Team Dashboard**: Three sections (League, Events, Challenges) when viewing a team
- **In-App Notifications**: Real-time Nostr event notifications displayed while app is active

## Development Workflow & Testing Protocol

**CRITICAL: React Native/Expo requires TWO components running simultaneously:**

### **Metro Bundler (JavaScript Engine)**
- **Purpose**: Transforms and serves your React Native code to the app
- **Start Command**: `npx expo start --ios` (starts on port 8081)
- **Role**: Watches `src/` files, compiles TypeScript/React Native to JavaScript bundles
- **Logs**: Shows app's `console.log()`, React Native errors, service initializations
- **Hot Reload**: Changes to `src/` files appear instantly via Fast Refresh

### **Xcode (Native iOS Shell)**  
- **Purpose**: Builds and runs the native iOS wrapper
- **Start Command**: `open ios/runstrproject.xcworkspace`
- **Role**: Compiles native iOS code, installs app on device/simulator
- **The App Logic**: Native shell downloads JavaScript from Metro at `http://localhost:8081`
- **Logs**: Shows native iOS system events, less useful for app logic debugging

### **Standard Testing Protocol**
**When user says "let's test" or requests testing, Claude should:**

1. **Check Metro Status**: Verify Metro bundler is running on port 8081
   - If not running: Start with `npx expo start --ios` 
   - If running on wrong port: Kill and restart on 8081
   - If stale: Use `npx expo start --clear --ios` to reset cache

2. **Open Xcode Workspace**: `open ios/runstrproject.xcworkspace`
   - Select iOS Simulator (not physical device unless specified)
   - Click Play ▶️ button or Cmd+R

3. **Monitor Metro Logs**: Use BashOutput tool to check Metro's console output
   - Metro logs show actual app behavior and JavaScript execution
   - Look for authentication flows, service initialization, errors
   - Ignore Xcode native system logs unless investigating native issues

4. **Force Refresh if Needed**: 
   - Press `Cmd+R` in iOS Simulator to reload from Metro
   - Or restart Metro with `--clear` flag if changes aren't appearing

### **Development Commands**
- `npm install` - Install dependencies
- `npx expo start --ios` - **REQUIRED**: Start Metro bundler + open simulator
- `npx expo start --clear --ios` - Clear Metro cache and restart
- `open ios/runstrproject.xcworkspace` - Open Xcode (after Metro is running)
- `npm run typecheck` - TypeScript validation
- `npm run lint` - Code linting

### **Android APK Build System**
📖 **For complete Android build instructions, signing configuration, and troubleshooting, see**: [docs/ANDROID_BUILD.md](./docs/ANDROID_BUILD.md)

### **Change Types & Required Actions**
**JavaScript/TypeScript Changes (src/ files):**
- ✅ **Auto-reload**: Metro handles via Fast Refresh
- ✅ **No Xcode rebuild needed**
- 🔄 **If not appearing**: Press Cmd+R in simulator or restart Metro with `--clear`

**Native Configuration Changes:**  
- ❌ **Requires Xcode rebuild**: Changes to `app.json`, iOS permissions, new dependencies
- ❌ **No auto-reload**: Must rebuild and reinstall via Xcode
- 🔄 **Process**: Stop Metro → Make changes → Rebuild in Xcode → Restart Metro

### **Common Issues & Solutions**
- **"No script URL provided"**: Metro not running or wrong port → Start Metro on 8081
- **"Connection refused [61]"**: App can't reach Metro → Check Metro is on localhost:8081  
- **Changes not appearing**: Fast Refresh failed → Press Cmd+R or restart Metro with `--clear`
- **App crashes on startup**: Check Metro logs for JavaScript errors, not Xcode logs

## Local Data Storage
**Pure Nostr Architecture**: All data comes from Nostr events, with local caching for performance.

**Local Storage (AsyncStorage)**:
- User's nsec/npub for authentication:
  - `@runstr:user_nsec` - User's private key (nsec)
  - `@runstr:npub` - User's public key (npub)
  - `@runstr:hex_pubkey` - User's hex-encoded public key
- Cached team membership status
- Workout posting status (to prevent duplicates)
- User preferences and settings

**Captain Detection**:
- Captain status determined from team's Nostr events
- Team captain field checked against user's npub/hex pubkey
- No backend verification needed - pure client-side from Nostr data

## Quality Assurance Requirements
**MANDATORY: Before completing any development phase:**
1. **Run Quality Checks:**
   ```bash
   npm install           # Ensure all dependencies installed
   npm run typecheck     # Verify TypeScript compilation
   npx prettier --write "src/**/*.{ts,tsx}"  # Fix formatting
   ```
2. **Review LESSONS_LEARNED.md** - Check for known issues and prevention strategies
3. **Update Folder READMEs** - Ensure all folder README.md files reflect current file structure
4. **Verify Phase Deliverables** - Ensure all planned functionality works as expected

**Note:** No phase should be marked "complete" until TypeScript compiles without errors, folder READMEs are current, and lessons learned have been reviewed.

## Pre-Launch Review System
**Use before major releases:**
- **Automated**: `npm run audit:pre-launch` (generates AUDIT_REPORT.md with categorized issues)
- **Manual**: Use `docs/CLAUDE_REVIEW_PROMPT.md` for deep Claude analysis

📖 **For complete workflow and usage instructions, see**: [docs/PRE_LAUNCH_REVIEW_GUIDE.md](./docs/PRE_LAUNCH_REVIEW_GUIDE.md)

## Git Workflow Requirements
**Commit after every successful fix or feature:**

**Commit Guidelines:**
- Use prefix format: `Fix:`, `Feature:`, `Refactor:`, `Docs:`
- ✅ Commit: successful fixes, completed features, updated folder READMEs
- ❌ Don't commit: broken code, TypeScript errors, out-of-sync folder READMEs

**Commands:**
```bash
git add . && git status && git commit -m "Fix: description" && git push origin main
```

## Folder Documentation Requirements
**Update folder READMEs when adding/removing/changing files:**
- Every src/ folder must have README.md listing all files
- Keep descriptions concise (1-2 sentences per file)
- Update READMEs as part of file modification commits

## Current Development Status - Payment Verification System Complete (Jan 2025)
✅ Project structure and architecture established
✅ Two-tab navigation (Teams/Profile) with bottom tab navigation
✅ Nostr authentication with profile/workout auto-import
✅ Real-time team discovery from multiple Nostr relays
✅ **FIXED: Captain Detection System** - Single source of truth with caching architecture
✅ **FIXED: Captain Dashboard Navigation** - Button now correctly navigates captains to dashboard
✅ **Competition Wizard System** - Complete Event & League creation wizards
✅ **Captain Dashboard** - Team management with join request approvals and member removal
✅ **Dynamic Scoring System** - Automatic leaderboards based on wizard parameters
✅ **Bitcoin Integration** - NIP-60/61 Lightning P2P payments, direct prize distribution
✅ **NEW: Event Payment Verification** - NWC auto-verify + manual override for paid event join requests
✅ **NEW: Transaction History Dashboard** - Captain view of incoming payments matching entry fees
✅ **NEW: Multi-Path Payment Support** - NWC wallets, Lightning addresses, cash/Venmo manual approval
✅ Two-tier membership system (local + official Nostr lists)
✅ **In-App Notifications** - Nostr event-driven notifications (no push)
✅ **HealthKit Workout Posting** - Transform Apple Health workouts into Nostr events and social cards
✅ **Pure Nostr Competition System** - Kind 30000 member lists, 1301 queries, dynamic leaderboards
✅ All TypeScript compilation successful - Core services production-ready



## Competition Architecture (Wizard-Driven Leaderboards)

**How Competitions Actually Work:**
- Competitions are **local parameter sets** created through wizards, NOT Nostr events
- Captains use wizards to define competition parameters (activity type, dates, scoring method)
- Team membership defined by **kind 30000 Nostr lists** (single source of truth)
- Members publish **kind 1301 workout events** to Nostr as they complete workouts
- App queries 1301 events from team members and applies wizard parameters locally to calculate leaderboards
- Competition parameters cached locally using AsyncStorage for performance

**Competition Data Flow:**
1. Captain creates competition via wizard → Parameters stored locally in AsyncStorage
2. App identifies team members from kind 30000 Nostr list
3. Members post workouts as kind 1301 events (completely independent of competitions)
4. App queries members' 1301 events within competition date range
5. Local scoring engine applies wizard parameters to calculate rankings
6. Leaderboards displayed in real-time (pure client-side calculation)

**Key Architecture Principles:**
- **No Competition Events**: Competitions are NOT published to Nostr (may change in future)
- **No Team Wallets**: Direct P2P Bitcoin payments via NIP-60/61 (no pooled funds)
- **No Backend Database**: Pure Nostr events + AsyncStorage caching only
- **Ephemeral Competitions**: Competitions exist as app-side views over permanent Nostr workout data
- **Working Backend**: Uses NIP-60/61 protocol with mint.coinos.io infrastructure

**Why This Architecture:**
- **Simplicity**: No complex Nostr event types needed for competitions
- **Flexibility**: Different apps can create different competition views over same workout data
- **Privacy**: Competition parameters stay local unless captain chooses to share
- **Performance**: No network calls needed to create/modify competitions
- **Compatibility**: Works with existing kind 1301 workout events standard

## CRITICAL WALLET ARCHITECTURE RULES
**⚠️ NEVER use nostr-tools in wallet code - Use NDK exclusively**
- **NDK handles ALL Nostr operations** including key generation, nip19 encoding/decoding
- **No library mixing** - NDK has everything needed built-in for Nostr functionality
- **Crypto polyfill**: Must use `react-native-get-random-values` imported FIRST in index.js
- **Why this matters**: Mixing NDK with nostr-tools causes crypto errors and initialization failures
- **Key generation**: Use `NDKPrivateKeySigner.generate()` NOT `generateSecretKey()` from nostr-tools

## Lessons Learned
📖 **For detailed troubleshooting history and prevention strategies, see**: [docs/LESSONS_LEARNED.md](./docs/LESSONS_LEARNED.md)


## Important Notes
- All files must stay under 500 lines of code for maintainability
- **Core User Journey**: Login → Auto-wallet → Teams → Competitions → Earn/send Bitcoin
- **Two-Page Focus**: Keep UI simple with just Teams and Profile tabs
- **Nostr-Native Data**: All team/workout data comes from Nostr events
- **Bitcoin Economy**: Every team operates as a circular economy with P2P zaps
- **Real Data Only**: No mock data - all functionality uses actual Nostr events