# RUNSTR PHASE 1 MVP: Strategic Direction & Implementation Plan

## Executive Summary

Phase 1 focuses on creating a **crisp, focused MVP** that solves the core problem—organizing virtual fitness competitions—without payment complexity. The goal is to validate whether captains will organize events, teams will form around charities, and users will consistently track workouts and compete on leaderboards. Once these core mechanics prove successful, Phase 2 will add automated payment verification infrastructure.

---

## Strategic Vision

### The Core Problem

RUNSTR aims to be the best platform for organizing virtual fitness competitions with charitable missions. The riskiest assumption isn't "can we build Lightning payment verification" (technically solved), but rather **"will people actually use a Nostr-based fitness competition platform?"**

### Phase 1 Approach

**Validate the game before automating the scoreboard.** Ship a minimal but complete fitness competition platform focused purely on:
1. Virtual event/challenge creation and management
2. Activity tracking (GPS, strength, diet, meditation)
3. Real-time leaderboards from kind 1301 workout events
4. Manual captain-controlled participant lists

### Why This Works

- **Reduces onboarding friction**: No NWC wallet required to participate
- **Focuses on core value**: Competition mechanics > Payment automation
- **Proves product-market fit**: If captains organize 10+ weekly events, THEN payment automation makes sense
- **Enables iteration**: Learn what users actually need before building complex features

---

## Phase 1 Scope

### What Stays (Core Features)

#### 1. Free Virtual Events
- Teams create 5K/10K/Half Marathon events (no entry fees)
- Users join events with simple "Join" button
- Captains see join requests and approve with Accept/Decline
- Approved users added to kind 30000 official participant list
- Leaderboards auto-calculate from kind 1301 workout events
- **No payment verification** - All events are free to join

#### 2. P2P Challenges (Honor System)
- Users challenge teammates to 1v1 competitions
- Challenge wizard creates kind 30102 events
- Challenges run for 24-48 hours with automatic leaderboards
- **No wagering or escrow** - Honor system donations only
- Winners get bragging rights, losers can voluntarily zap charity

#### 3. Activity Tracking (Full Featured)
- **GPS Tracker**: Running/walking/cycling with activity-specific metrics
- **Strength Tracker**: Set/rep counting with rest timers
- **Diet Tracker**: Meal logging with fasting features
- **Meditation Tracker**: Timer-based session tracking
- **Workout History**: Unified display of local/Nostr/HealthKit workouts

#### 4. External Zapping (Default Payment Method)
- **Tap = External wallet modal** (QR + invoice for any Lightning wallet)
- **Long press = NWC quick zap** (for power users with configured wallets)
- No NWC wallet required to send zaps
- Works with Cash App, Strike, Alby, Phoenix, Breez, any Lightning wallet

#### 5. Basic Stats (Free Tier)
- Workout count, total distance, calories burned
- Workout history timeline
- Activity type breakdown
- Simple progress tracking

#### 6. Team Management
- Create unlimited teams
- Join unlimited teams
- Captain dashboard for member management
- Kind 30000 list management (add/remove members)
- Team discovery via Nostr relays

---

### What Changes

#### 1. Navigation: 3 Tabs Only
**Before**: Teams | Season | Activity | Profile (4 tabs)
**After**: Discovery | Activity | Profile (3 tabs)

- **Discovery**: Browse teams, events, challenges
- **Activity**: Track workouts (GPS, strength, diet, meditation)
- **Profile**: Personal dashboard, settings, workout history

**Rationale**: Removes Season tab (quarterly competition) to focus on user-created events. Season becomes a regular team event in future iterations.

#### 2. NWC Button Behavior Reversal
**Before**: Tap = NWC quick zap, Long press = External wallet
**After**: Tap = External wallet, Long press = NWC quick zap

**Rationale**:
- Most users don't have NWC wallets configured
- External wallet (tap) becomes default, accessible flow
- NWC (long press) becomes power-user feature
- Reduces onboarding friction (no wallet setup required to zap)

#### 3. QR Scanner Location
**Before**: Accessible from Profile screen header button
**After**: Settings > Lightning Wallet > NWC Configuration

**New UI**: Two NWC connection options
1. **Paste NWC String**: Text input for manual entry
2. **Scan QR Code**: Camera scanner button

**Rationale**:
- NWC configuration is one-time setup, not frequent action
- Moving to Settings declutters Profile screen
- Provides both paste and scan options for flexibility

---

### What's Deferred to Phase 2

#### Payment Automation (Not in Phase 1)
- ❌ Entry fee collection and verification
- ❌ Lightning invoice generation for events
- ❌ PaymentVerificationBadge for captain dashboard
- ❌ EventTransactionHistory filtering
- ❌ Automatic charity forwarding
- ❌ Challenge wagering with escrow
- ❌ Bitcoin prize pool management

**Why defer**: Manual captain verification sufficient until event volume proves automation needed. If captains manage 1-2 casual events, manual is fine. If they're juggling 10+ weekly events with 50+ participants each, then automation becomes valuable.

#### Subscription Paywall (Not in Phase 1)
- ❌ RUNSTR Premium subscription system
- ❌ Stats page paywall (VO2 Max, fitness age, BMI)
- ❌ Fitness Test gating
- ❌ Nostr 1301 import restriction
- ❌ RevenueCat integration
- ❌ In-app purchase flows

**Why defer**: Prove users want the free platform before building premium tier. Need 10,000+ users to accurately measure 15% conversion rate. Premature paywall could kill early adoption.

#### Season System (Not in Phase 1)
- ❌ Quarterly RUNSTR Season competitions
- ❌ Season leaderboards with prize pools
- ❌ Season tab in navigation
- ❌ Season promotional cards

**Reimagined**: RUNSTR Season 2 becomes a regular event created by RUNSTR team using standard event wizard. Demonstrates how any organizer can run monthly charity races. No special infrastructure needed—just another event on the Discovery tab.

---

## Implementation Plan

### Phase 1A: Navigation Simplification ⏱️ 30 minutes

#### File: `src/navigation/BottomTabNavigator.tsx`

**Task 1: Remove Season Tab**
```typescript
// DELETE lines 193-206:
<Tab.Screen
  name="Events"
  options={{
    title: 'Season',
    headerShown: false,
  }}
>
  {() => (
    <Suspense fallback={<LoadingFallback />}>
      <EventsScreen />
    </Suspense>
  )}
</Tab.Screen>
```

**Task 2: Update Tab Icon Logic**
```typescript
// DELETE lines 117-118 (Events case):
} else if (route.name === 'Events') {
  iconName = focused ? 'ticket' : 'ticket-outline';
```

**Result**: 3 tabs (Discovery, Activity, Profile) with correct icons

**Testing Checklist**:
- [ ] Only 3 tabs visible at bottom
- [ ] Discovery tab icon: search
- [ ] Activity tab icon: fitness
- [ ] Profile tab icon: person
- [ ] No navigation errors on app launch
- [ ] Tab switching works smoothly

---

### Phase 1D: NWC Button Behavior Reversal ⏱️ 1 hour

#### File: `src/components/lightning/NWCLightningButton.tsx`

**Current Behavior** (lines 160-192):
- **Tap**: Triggers `performQuickZap()` → NWC 21-sat zap
- **Long Press**: Opens `EnhancedZapModal` → External wallet

**New Behavior** (Phase 1):
- **Tap**: Opens `ExternalZapModal` → QR + invoice for any wallet
- **Long Press**: Triggers `performQuickZap()` → NWC 21-sat zap (if configured)

#### Code Changes

**Before**:
```typescript
const handlePressIn = () => {
  longPressTimer.current = setTimeout(() => {
    // Long press = external wallet modal
    setShowModal(true);
  }, LONG_PRESS_DURATION);
};

const handlePressOut = async () => {
  if (longPressTimer.current) {
    clearTimeout(longPressTimer.current);
    // Tap = NWC quick zap
    await performQuickZap();
  }
};
```

**After**:
```typescript
const handlePressIn = () => {
  longPressTimer.current = setTimeout(() => {
    // Long press = NWC quick zap (power users)
    performQuickZap();
  }, LONG_PRESS_DURATION);
};

const handlePressOut = async () => {
  if (longPressTimer.current) {
    clearTimeout(longPressTimer.current);
    // Tap = external wallet modal (default)
    setShowExternalModal(true);
  }
};
```

**Additional Changes**:
- Update `performQuickZap()` to show alert if NWC not configured
- Ensure `ExternalZapModal` renders with default amount (21 sats)
- Keep both flows functional (external + NWC)

**Testing Checklist**:
- [ ] Single tap opens external wallet modal
- [ ] External modal shows QR code + copyable invoice
- [ ] External modal works without NWC configuration
- [ ] Long press (hold 400ms) triggers NWC zap
- [ ] Long press shows "Configure NWC wallet" alert if not set up
- [ ] NWC zap works after wallet configuration
- [ ] Visual feedback (yellow bolt) after successful zap
- [ ] Daily zap state tracking works (no duplicate zaps)

---

### Phase 1E: QR Scanner to Settings ⏱️ 1.5 hours

#### Part 1: Remove from Profile Screen

**File**: `src/screens/ProfileScreen.tsx`

**Changes**:
1. Remove `QRScannerModal` import (line 34-36)
2. Remove `showQRScanner` state (line 104-108)
3. Remove QR scanner button from header
4. Remove `QRScannerModal` rendering at bottom of component

**Testing**:
- [ ] Profile screen loads without errors
- [ ] No QR scanner button visible
- [ ] Header layout looks clean

#### Part 2: Add to Settings Screen

**File**: `src/screens/SettingsScreen.tsx`

**New Section: Lightning Wallet Configuration**

```typescript
// Add imports
import QRScannerModal from '../components/qr/QRScannerModal';
import { NWCWalletService } from '../services/wallet/NWCWalletService';

// Add state
const [showQRScanner, setShowQRScanner] = useState(false);
const [nwcString, setNwcString] = useState('');
const [nwcConnected, setNwcConnected] = useState(false);

// Add handler
const handleConnectNWC = async () => {
  try {
    await NWCWalletService.initialize(nwcString);
    setNwcConnected(true);
    Alert.alert('Success', 'NWC wallet connected');
  } catch (error) {
    Alert.alert('Error', 'Failed to connect wallet');
  }
};

const handleQRScan = async (qrData: string) => {
  setNwcString(qrData);
  setShowQRScanner(false);
  await handleConnectNWC();
};

// Add to render (after existing settings sections)
<Card style={styles.card}>
  <Text style={styles.sectionTitle}>Lightning Wallet</Text>

  {/* Option 1: Paste NWC String */}
  <View style={styles.settingItem}>
    <Text style={styles.settingLabel}>NWC Connection String</Text>
    <TextInput
      style={styles.input}
      placeholder="nostr+walletconnect://..."
      value={nwcString}
      onChangeText={setNwcString}
      autoCapitalize="none"
      autoCorrect={false}
    />
    <TouchableOpacity
      style={styles.button}
      onPress={handleConnectNWC}
    >
      <Text style={styles.buttonText}>Connect Wallet</Text>
    </TouchableOpacity>
  </View>

  {/* Option 2: Scan QR Code */}
  <TouchableOpacity
    style={styles.settingItem}
    onPress={() => setShowQRScanner(true)}
  >
    <Ionicons name="camera" size={24} color={theme.colors.text} />
    <Text style={styles.settingTitle}>Scan QR Code</Text>
    <Text style={styles.settingSubtitle}>
      Connect wallet by scanning QR from Alby, Mutiny, or Coinos
    </Text>
    <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
  </TouchableOpacity>

  {/* Connection Status */}
  {nwcConnected && (
    <View style={[styles.settingItem, styles.statusRow]}>
      <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent} />
      <Text style={styles.statusText}>Wallet Connected</Text>
    </View>
  )}
</Card>

{/* QR Scanner Modal */}
<QRScannerModal
  visible={showQRScanner}
  onClose={() => setShowQRScanner(false)}
  onScanSuccess={handleQRScan}
/>
```

**Testing Checklist**:
- [ ] Settings shows "Lightning Wallet" section
- [ ] Can paste NWC string in text input
- [ ] "Connect Wallet" button triggers connection
- [ ] "Scan QR Code" opens camera modal
- [ ] QR scanning works (scan Alby/Mutiny QR)
- [ ] Connection status shows after successful setup
- [ ] NWC wallet works after configuration
- [ ] Can disconnect and reconnect wallet
- [ ] Error handling for invalid connection strings

---

## User Flows (Phase 1)

### Flow 1: New User Onboarding (No NWC Required)

1. **Download RUNSTR** → Auto-generate nsec + npub
2. **Backup nsec** → Copy to password manager
3. **Navigate to Discovery tab** → Browse teams/events
4. **Join a team** → Tap "Join Team" → Added locally + join request sent
5. **Captain approves** → User added to kind 30000 official list
6. **Join a 5K event** → Tap "Join Event" → Added to event list
7. **Track first workout** → Use GPS tracker → Post as kind 1301
8. **See leaderboard** → Automatic ranking based on fastest time
9. **Zap teammate** → Tap lightning button → External wallet modal → Pay with Cash App
10. **Continue tracking** → Build workout history, compete weekly

**Key Insight**: User never needs NWC wallet for core experience. Can participate, compete, and zap using external wallets.

### Flow 2: Captain Creates Free Event

1. **Navigate to Team page** → Tap "Create Event"
2. **Event wizard opens** → Select preset (5K, 10K, Half Marathon)
3. **Configure event** → Name, description, date/time
4. **Publish event** → Creates kind 30101 event on Nostr
5. **Share event** → Post kind 1 announcement card to feed
6. **Receive join requests** → Users tap "Join Event"
7. **Review requests** → Captain dashboard shows pending requests
8. **Approve participants** → Tap "Accept" → User added to kind 30000 list
9. **Monitor leaderboard** → Automatic updates as users post workouts
10. **Announce winner** → Zap winner directly from leaderboard

**Key Insight**: Captain manages event with simple approve/decline. No payment verification burden.

### Flow 3: 1v1 Challenge (Honor System)

1. **Navigate to Team page** → Tap "Challenge" button
2. **Select opponent** → Search team members or enter npub
3. **Choose distance** → 5K, 10K, or Half Marathon
4. **Set duration** → 24 hours, 48 hours, 1 week
5. **Send challenge** → Creates kind 30102 event
6. **Both users track workouts** → Post kind 1301 events
7. **Leaderboard updates** → Real-time ranking
8. **Challenge ends** → Winner declared automatically
9. **Optional donation** → Loser zaps winner's charity (honor system)
10. **Trash talk** → Reply with comments on winner's workout card

**Key Insight**: Challenge provides structure and competition without payment complexity. Social pressure drives honor system donations.

---

## Free vs Premium Features

### Free Forever (Phase 1)

**Community Features**:
- Create unlimited teams
- Host unlimited events
- Join unlimited competitions
- Invite unlimited members
- Captain dashboard (member management, join requests)
- Real-time leaderboards

**Activity Tracking**:
- GPS tracking (running, walking, cycling)
- Strength training tracker
- Diet tracker with fasting features
- Meditation timer
- Unlimited workout history

**Social Features**:
- Post kind 1 workout cards (beautiful SVG graphics)
- Post kind 1301 competition entries
- Zap teammates (external wallets)
- Comment on workouts
- Team chat/DMs

**Basic Analytics**:
- Workout count
- Total distance (lifetime + weekly)
- Calories burned
- Workout streak
- Activity type breakdown

### Premium Features (Phase 2 - Not in Phase 1)

**RUNSTR Premium ($4.99/month or $49/year)**:
- **Advanced Stats Page**:
  - VO2 Max estimation (Jack Daniels VDOT formula)
  - Fitness age calculation
  - BMI + body composition tracking
  - Weekly caloric balance analysis
  - Workout streak analytics with graphs
- **RUNSTR Fitness Test**:
  - Standardized 60-min assessment
  - Pushups, situps, 5K run scoring
  - Historical progress tracking
  - Grade classification (Elite/Advanced/Intermediate/Developing/Baseline)
- **Nostr 1301 Import**:
  - Download entire workout history from Nostr
  - Import to local storage for offline analytics
  - Progress tracking during import
- **AI Workout Analysis** (Future):
  - GPT-4 analysis of training patterns
  - Personalized recommendations
  - Injury risk assessment
- **Workout Plans** (Future):
  - Adaptive training programs
  - Half marathon, 10K, 5K training plans
  - Strength + cardio hybrid programs

**Monetization Philosophy**: Premium targets serious athletes (15% of user base) seeking performance optimization. Community features remain 100% free to maximize event creation and participation.

---

## Technical Architecture (Phase 1)

### Nostr Event Kinds

**Competition Structure**:
- **kind 33404**: Team metadata (name, description, captain, charity)
- **kind 30000**: Participant lists (team members, event participants)
- **kind 30101**: Event definitions (5K/10K/Half Marathon)
- **kind 30102**: Challenge definitions (1v1 competitions)
- **kind 1105**: Join requests (team + event joins)
- **kind 1301**: Workout events (distance, duration, splits, calories)
- **kind 1**: Social posts (workout cards, announcements)

**Data Flow**:
1. Captain creates event → Publishes kind 30101
2. User joins event → Publishes kind 1105 join request + adds locally
3. Captain approves → Updates kind 30000 participant list
4. User tracks workout → Saves locally
5. User posts workout → Publishes kind 1301
6. Leaderboard queries → Fetches kind 30000 list + kind 1301 events
7. Leaderboard calculates → Client-side scoring with 5-min cache

### Local-First Architecture

**Why Local-First**:
- Instant UX (no network delays)
- Offline functionality
- Privacy (data stays on device until user publishes)
- Resilience (works without Nostr relays)

**Implementation**:
- **Workouts**: Saved to AsyncStorage immediately
- **Teams**: Cached locally after first fetch
- **Events**: Cached with 5-min TTL
- **Leaderboards**: Cached with 1-min TTL
- **Publishing**: Queued and retried if network unavailable

---

## Success Metrics (Phase 1)

### Primary Metrics (Product-Market Fit)

1. **Event Creation Rate**:
   - Target: 10+ weekly events created by community captains
   - Indicates: Captains find value in platform

2. **Event Participation Rate**:
   - Target: Average 15+ participants per event
   - Indicates: Users want to compete in virtual races

3. **Workout Posting Consistency**:
   - Target: 50%+ of users post 3+ workouts/week
   - Indicates: Platform drives habit formation

4. **Leaderboard Engagement**:
   - Target: 70%+ of event participants check leaderboard 3+ times during event
   - Indicates: Competition drives engagement

5. **Team Formation**:
   - Target: 20+ active teams with 10+ members each
   - Indicates: Community building works

### Secondary Metrics (Growth)

6. **User Acquisition**:
   - Target: 1,000 users in first 3 months
   - Source: Bitcoin/Nostr community word-of-mouth

7. **Retention**:
   - Target: 40%+ weekly active users (WAU/MAU ratio)
   - Indicates: Sticky product

8. **Zap Activity**:
   - Target: 500+ zaps sent per week
   - Indicates: Bitcoin integration adds value

### Phase 2 Trigger Conditions

**When to add payment automation**:
- Captains managing 10+ events with 50+ participants each
- Captains complaining about manual verification workload
- 5+ support requests per week about payment verification

**When to add subscription paywall**:
- 10,000+ monthly active users
- 70%+ users accessing basic stats weekly
- 15%+ conversion rate validated through surveys

---

## Rationale: Why Phase 1 First?

### 1. Validates Core Value Proposition

**Question**: Will people organize fitness competitions on Nostr?
**Test**: Ship event creation + leaderboards without payment complexity
**Learn**: If captains organize weekly 5Ks and users compete, core value exists

### 2. Reduces Technical Complexity

**Payment Infrastructure Requires**:
- Lightning invoice generation (LNURL protocol)
- NWC wallet integration (connection string management)
- Payment verification (polling, webhooks, lookups)
- Transaction history (filtering, matching, accounting)
- Error handling (failed payments, expired invoices, refunds)
- Privacy considerations (who sees what payment data)

**Phase 1 Eliminates**:
- All Lightning invoice logic
- Payment verification components
- Transaction history UI
- Error handling edge cases
- Privacy architecture complexity

**Result**: 3,000+ lines of code deferred, 2-3 weeks development time saved

### 3. Lowers User Onboarding Friction

**With Payment Verification**:
- User must configure NWC wallet OR understand Lightning invoices
- User must have sats in wallet to participate
- User must understand payment proofs and verification
- Captain must understand payment destination (wallet vs charity)
- Captain must verify payments manually or configure NWC lookups

**Without Payment Verification (Phase 1)**:
- User taps "Join Event" → Done
- Captain taps "Accept" → Done
- Optional: User zaps charity with external wallet (Cash App)

**Result**: 90% reduction in onboarding complexity

### 4. Enables Rapid Iteration

**Phase 1 Allows Testing**:
- Event formats (presets vs custom distances)
- Leaderboard scoring modes (fastest time vs consistency)
- Challenge durations (24h vs 48h vs 1 week)
- Team discovery mechanisms (relay queries vs recommendations)
- Workout posting UX (when to prompt for publishing)

**Learning Before Building**:
- Do users prefer team events or 1v1 challenges?
- Do captains want daily races or weekly races?
- Do users want public leaderboards or private team-only?
- What charity integration do users actually want?

**Result**: Build payment automation for proven workflows, not hypothetical ones

### 5. Proves Business Model Viability

**Chicken-and-Egg Problem**:
- Need users to validate premium conversion rates
- Need free features to acquire users
- Can't validate $4.99/month pricing without 10,000+ users

**Phase 1 Solves**:
- Ship 100% free platform to maximize adoption
- Target Bitcoin/Nostr community (50,000+ addressable market)
- Prove organic growth through event creation virality
- Survey users about willingness to pay for advanced stats
- Then build subscription system with validated pricing

**Result**: Data-driven monetization decision instead of guessing

---

## What's Next: Phase 2 Roadmap

### Phase 2A: Payment Automation (After Phase 1 Success)

**Trigger Conditions Met**:
- 10+ weekly events with manual captain verification
- Captains requesting automated payment verification
- Event participation exceeds 50 users per event

**Features to Add**:
- Lightning invoice generation for event entry fees
- NWC wallet verification for automatic payment confirmation
- PaymentVerificationBadge for captain dashboard
- EventTransactionHistory with filtering and CSV export
- Challenge wagering with escrow (both sides pay upfront)
- Automatic charity forwarding with provable zap receipts

**Timeline**: 2-3 weeks development after Phase 1 validation

### Phase 2B: Subscription System (After 10K+ Users)

**Trigger Conditions Met**:
- 10,000+ monthly active users
- 70%+ users checking basic stats weekly
- Survey shows 15%+ willing to pay $4.99/month

**Features to Gate**:
- Advanced Stats page (VO2 Max, fitness age, BMI, caloric balance)
- RUNSTR Fitness Test with historical tracking
- Nostr 1301 Import tool for workout history download
- AI workout analysis (GPT-4 training insights)
- Personalized workout plans (adaptive programs)

**Implementation**:
- RevenueCat SDK for iOS/Android in-app purchases
- SubscriptionStore for subscription state management
- PremiumFeatureGate component for paywall UI
- 7-day free trial with payment method required

**Timeline**: 3 weeks development after user base validated

### Phase 2C: RUNSTR Season (After Community Established)

**Trigger Conditions Met**:
- 20+ active teams with 10+ members each
- Weekly event participation exceeds 200 users
- Community demonstrates commitment to regular competition

**Season Structure**:
- RUNSTR team creates monthly Half Marathon event
- Entry: 2,100-sat donation to HRF/OpenSats
- Top 3 finishers receive 10k/5k/2.1k sat prizes
- Event uses standard wizard (no special infrastructure)
- Demonstrates template for other organizers to copy

**Timeline**: Ongoing monthly events after community critical mass

---

## Conclusion

Phase 1 delivers a **complete, focused MVP** that solves the core problem—organizing virtual fitness competitions—without premature optimization. The platform enables teams to compete, captains to manage events, and users to track workouts, all without payment complexity or subscription barriers.

By deferring payment automation and subscription paywalls to Phase 2, we can:
- **Ship faster** (3 hours vs 3+ weeks)
- **Learn faster** (real user behavior vs hypothetical workflows)
- **Iterate faster** (change event formats without payment logic dependencies)
- **Grow faster** (zero friction onboarding)

**Success looks like**: 1,000 users, 20+ teams, 10+ weekly events, 500+ zaps per week, all within 3 months of launch. At that point, we'll have validated the core value proposition and can confidently build payment automation and premium features based on real user needs, not guesses.

---

## Files Modified (Phase 1 Summary)

1. `src/navigation/BottomTabNavigator.tsx` - Remove Season tab (3 tabs only)
2. `src/components/lightning/NWCLightningButton.tsx` - Reverse tap/long press behavior
3. `src/screens/ProfileScreen.tsx` - Remove QR scanner from header
4. `src/screens/SettingsScreen.tsx` - Add Lightning Wallet configuration section

**Total Changes**: 4 files, ~3 hours development time

**Testing**: Navigation flow, zap button behavior, NWC configuration in Settings

**Launch Readiness**: After testing, Phase 1 MVP ready for Bitcoin/Nostr community beta release
