# RUNSTR - Claude Context

## Project Overview
RUNSTR is an anonymous fitness tracker that rewards cardio workouts with Bitcoin and enables charity donations via the Nostr protocol. Built for Bitcoiners and the Nostr community, the app focuses on running, walking, and cycling.

**Core Value:** Fitness earns Bitcoin. Bitcoin supports charities.

📖 **For workout event specification, see**: [docs/KIND_1301_SPEC.md](./docs/KIND_1301_SPEC.md)
🔐 **For environment setup, see**: [docs/ENVIRONMENT_SETUP.md](./docs/ENVIRONMENT_SETUP.md)

## Four Core Pillars

### 1. **Workouts** - GPS Cardio Tracking
- Core activities: Running, Walking, Cycling
- GPS tracking with real-time metrics (pace, distance, elevation, splits)
- HealthKit (iOS), Health Connect (Android), Garmin sync
- Experimental features in settings (strength, diet, wellness)
- Published as kind 1301 Nostr events

### 2. **Rewards** - Bitcoin for Fitness
- **50 sats** per daily workout
- **5 sats** per 1,000 steps
- Delivered via Lightning address (LNURL protocol)
- Real Bitcoin, not points or tokens
- Creates positive feedback loop for healthy behavior

### 3. **Donations** - Teams = Charities
- "Joining" a team means selecting a charity to support
- Team tag embedded in kind 1301 and kind 1 notes
- Split a percentage of rewards to your charity
- Zap charities directly from Lightning wallets (Cash App, Strike, Alby, Zeus)
- **Impact Level** XP system tracks contributions

### 4. **Events** - Fitness Competitions
- Hardcoded events (Season II, January Walking Contest)
- Participation via Supabase database
- Leaderboards by activity type (Running, Walking, Cycling)
- Bitcoin prize pools

### Target Market: Bitcoin/Nostr Community
- **50,000+ addressable market** of Bitcoiners and Nostr users
- Community already understands nsec/npub, Lightning, decentralized protocols
- Solves cold start problem by targeting knowledgeable users

## User Experience

**User Flow:** Nsec login → Profile screen → Select charity → Track workouts → Earn rewards → Join events

**Key Features:**
- **Nostr Authentication**: Direct nsec login with automatic profile import
- **Lightning Address Rewards**: Users enter Lightning address to receive sats
- **Charity Support**: Select a team (charity) to donate portion of rewards
- **HealthKit/Health Connect Sync**: Import workouts from Apple/Android health apps
- **Social Posting**: Share workouts as kind 1 posts with achievement cards
- **Event Participation**: Join competitions via Supabase, workouts count toward leaderboards

**Authentication:**
- Show login screen unless npub/nsec found in local storage
- Manual nsec input only (no platform-specific auth)
- Nsec login → derive npub → store locally in AsyncStorage

## Key Technologies
- **Frontend**: React Native with TypeScript (Expo framework)
- **Workout Data**: Nostr kind 1301 events + HealthKit/Health Connect
- **Event Participation**: Supabase database for joining events and leaderboards
- **Authentication**: Nostr (nsec) - direct authentication only
- **Rewards**: Lightning address via LNURL protocol
- **Nostr Library**: NDK (@nostr-dev-kit/ndk) EXCLUSIVELY - NEVER use nostr-tools
- **Global NDK Instance**: Single shared NDK instance via `GlobalNDKService`
- **Nostr Relays**: Damus, Primal, nos.lol, Nostr.band (4 relays)

## Nostr Event Kinds

### Core Events
- **kind 0**: Profile metadata (name, picture, about, Lightning address)
- **kind 1**: Social posts (workout shares with achievement cards)
- **kind 1301**: Workout events (distance, duration, calories, team tag)

### Kind 1301 Tags
Workouts include tags for:
- `exercise` - Activity type (running, walking, cycling)
- `distance` - Distance with unit (km or mi)
- `duration` - Duration in HH:MM:SS format
- `team` - Charity/team identifier (for donation tracking)

📖 **For complete specification, see**: [docs/KIND_1301_SPEC.md](./docs/KIND_1301_SPEC.md)

## Kind 1301 Workout Event Format

**Overview**: RUNSTR publishes kind 1301 events for fitness tracking, supporting all activities for in-app competitions.

**Critical Format Rules**:
- Content must be plain text, NOT JSON
- Exercise type: lowercase full words (`running`, not `run`)
- Distance: separate array elements `['distance', '5.2', 'km']`
- Duration: HH:MM:SS format (`00:30:45`)

**Supported Activities**: running, walking, cycling, hiking, strength, meditation, diet, other

📖 **For complete event specification, tag requirements, and examples, see**: [docs/KIND_1301_SPEC.md](./docs/KIND_1301_SPEC.md)

## Architecture Principles
- **File Size Limit**: Maximum 500 lines per file for maintainability
- **Four Core Pillars**: Workouts, Rewards, Donations, Events
- **Cardio Focus**: Running, Walking, Cycling are core; other features are experimental
- **Teams = Charities**: Team selection means choosing a charity to support
- **Lightning Address Rewards**: Users receive sats via LNURL protocol
- **Supabase for Events**: Event participation and leaderboards via database
- **Nostr for Workouts**: Kind 1301 events for fitness data
- **Performance First**: Aggressive caching eliminates loading states
- **Local-First**: Store locally, sync to Nostr on user action

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

**1. Authentication**:
- Show login screen unless npub/nsec found in local storage
- Nsec login imports profile from kind 0 events
- Derived npub stored locally in AsyncStorage

**2. Three-Tab Navigation**:
- **Profile Tab**: Workout tracking, history, settings, Lightning address entry
- **Teams Tab**: Browse/select charities to support
- **Rewards Tab**: Total earnings, Impact Level XP, donation splits

**3. Workout Flow**:
- Track cardio via GPS (Running, Walking, Cycling)
- Sync from HealthKit/Health Connect/Garmin
- Publish as kind 1301 to Nostr
- Share as kind 1 social post with achievement card

**4. Rewards Flow**:
- Complete daily workout → Earn 50 sats
- Walk 1,000 steps → Earn 5 sats
- Rewards sent to user's Lightning address via LNURL

**5. Donation Flow**:
- Select a team (charity) to support
- Set donation split percentage
- Team tag embedded in workout events
- Zap charities directly from any Lightning wallet

**6. Event Flow**:
- Join hardcoded events via Supabase
- Workouts during event period count toward leaderboard
- Leaderboards organized by activity type
- Prize pools distributed to winners

## UI Requirements
Simple three-tab interface with dark theme:
- **Colors**: Black background (#000), dark cards (#0a0a0a), borders (#1a1a1a)
- **Navigation**: Bottom tab bar with Profile, Teams, Rewards
- **Profile Tab**: Start workout, workout history, settings, Lightning address
- **Teams Tab**: Browse charities, select one to support, zap button
- **Rewards Tab**: Total sats earned, Impact Level XP, donation split settings

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

**Local Storage (AsyncStorage)**:
- User authentication:
  - `@runstr:user_nsec` - User's private key (nsec)
  - `@runstr:npub` - User's public key (npub)
  - `@runstr:hex_pubkey` - User's hex-encoded public key
- Lightning address for receiving rewards
- Selected team/charity
- Workout posting status (to prevent duplicates)
- User preferences and settings

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

## Current Development Status (Jan 2026)
✅ Three-tab navigation (Profile, Teams, Rewards)
✅ Nostr authentication with nsec
✅ GPS cardio tracking (Running, Walking, Cycling)
✅ HealthKit, Health Connect, Garmin sync
✅ Kind 1301 workout publishing
✅ Kind 1 social posts with achievement cards
✅ Daily rewards (50 sats/workout)
✅ Step rewards (5 sats/1k steps)
✅ Lightning address reward delivery via LNURL
✅ Teams = Charities with donation splitting
✅ Impact Level XP system
✅ Hardcoded events with leaderboards (Season II, January Walking)
✅ Supabase event participation
✅ All TypeScript compilation successful



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
- **Core User Journey**: Login → Select charity → Track workouts → Earn rewards → Donate
- **Three-Tab Focus**: Profile (workouts), Teams (charities), Rewards (earnings)
- **Teams = Charities**: Always use this framing, not "social groups"
- **Cardio Focus**: Running, Walking, Cycling are core activities
- **Bitcoin, not crypto**: Never use "cryptocurrency" - Bitcoin is Bitcoin
- **Lightning Address**: Users receive rewards via LNURL, no NWC required
- **Real Data Only**: No mock data - all functionality uses actual Nostr/Supabase