# EVENT SYSTEM TROUBLESHOOTING GUIDE

**Last Updated**: January 2025
**Status**: Production System - Events are the primary competition format in RUNSTR

This document serves as both a technical reference for understanding how RUNSTR's event system works and a debugging guide when issues arise.

---

## 1. EVENT SYSTEM OVERVIEW

### What are Events in RUNSTR?

Events are **time-bounded fitness competitions** that teams create and participate in. They are the core competition format in RUNSTR, providing structure for community fitness challenges.

**Key Characteristics:**
- **Time-Bounded**: Events have specific start and end dates
- **Distance-Based**: Currently support 5K, 10K, and Half Marathon distances
- **Bitcoin-Powered**: Optional entry fees in satoshis via Lightning Network
- **Nostr-Native**: All event data stored as kind 30101 Nostr events
- **Team-Specific**: Each event belongs to a team and is managed by the team captain

### Supported Event Types

Currently, RUNSTR supports three distance-based running events:
- **5K Race**: 5 kilometer running events
- **10K Race**: 10 kilometer running events
- **Half Marathon**: 21.1 kilometer (13.1 mile) running events

### Event Lifecycle

```
Creation → Publishing → Querying → Display → Participation → Completion
    ↓           ↓            ↓          ↓           ↓             ↓
  Wizard    Kind 30101   Authors    Event     Join      Leaderboard
  Form      to Nostr     Query      Cards    Requests    Results
```

**Phase Breakdown:**

1. **Creation**: Captain uses EventCreationWizard to define event parameters
2. **Publishing**: Event published as kind 30101 to Nostr relays
3. **Querying**: SimpleCompetitionService fetches events using captain's pubkey
4. **Display**: Events shown in SimpleTeamScreen and Captain Dashboard
5. **Participation**: Users submit join requests, pay entry fees, post workouts
6. **Completion**: Leaderboards calculated from kind 1301 workout events

---

## 2. ARCHITECTURE & DATA FLOW

### 2.1 Event Creation Flow

#### User Flow
```
Captain Dashboard
  → Click "Create Event" button
  → EventCreationWizard opens
  → Select event type (5K/10K/Half Marathon)
  → Enter event details (name, dates, entry fee, max participants)
  → Validation checks
  → Submit form
  → Event published to Nostr
  → Success notification
  → Wizard closes, dashboard refreshes
```

#### Technical Flow

**Step 1: Data Collection** (`EventCreationWizard.tsx`)
```typescript
// User fills form with:
- eventName: string (required)
- eventType: '5k' | '10k' | 'half-marathon' (required)
- startDate: Date (required)
- endDate: Date (required, must be after startDate)
- entryFee: number (optional, in satoshis)
- maxParticipants: number (optional)
- description: string (optional)
```

**Step 2: Validation** (wizard-level checks)
- Event name: Required, max 100 characters
- Event type: Must be one of three supported types
- Start date: Must be in the future
- End date: Must be after start date
- Entry fee: If provided, must be positive number
- Max participants: If provided, must be >= 2

**Step 3: Event Publishing** (`NostrCompetitionService.createEvent()`)
```typescript
// 1. Generate unique event ID
const eventId = `event_${Date.now()}_${Math.random()}`;

// 2. Create kind 30101 event
const eventData = {
  kind: 30101,
  pubkey: captainHexPubkey,
  created_at: Math.floor(Date.now() / 1000),
  content: description || '',
  tags: [
    ['d', eventId],
    ['name', eventName],
    ['team', teamId],
    ['activity_type', 'Running'],
    ['event_type', eventType], // '5k', '10k', 'half-marathon'
    ['event_date', startDate.toISOString()],
    ['end_date', endDate.toISOString()],
    ['entry_fee', entryFee?.toString() || '0'],
    ['max_participants', maxParticipants?.toString() || '0'],
    ['participant_list', `${eventId}-participants`],
    ['captain_pubkey', captainPubkey]
  ]
};

// 3. Publish to Nostr relays
await ndk.publish(eventData);

// 4. Create participant list (kind 30000)
const participantList = {
  kind: 30000,
  tags: [
    ['d', `${eventId}-participants`],
    ['title', `Participants: ${eventName}`]
  ]
};
await ndk.publish(participantList);
```

**Step 4: Local Caching** (`CaptainEventStore`)
```typescript
// Store event locally for instant captain dashboard display
await CaptainEventStore.addEvent(teamId, eventData);

// Invalidate team events cache to force refresh
UnifiedNostrCache.invalidate(`team_events_${teamId}`);
```

**Step 5: Success Notification**
- CustomAlert shows success message
- EventAnnouncementPreview modal displays (optional)
- Wizard closes and navigates back to Captain Dashboard

---

### 2.2 Event Storage Architecture

RUNSTR uses a **two-tier storage system** for events:

#### Tier 1: Nostr Relays (Source of Truth)

**Kind 30101 Events** - Event metadata
- **Relay List**:
  - `wss://relay.damus.io`
  - `wss://relay.primal.net`
  - `wss://nos.lol`
  - `wss://relay.nostr.band`
- **Indexed Fields**: `kind`, `pubkey`, `created_at`, `#d` tag
- **Storage Duration**: Permanent (until deleted by author)
- **Query Method**: `authors` filter (captain's pubkey)

**Kind 30000 Participant Lists** - Event participants
- **Format**: `{eventId}-participants`
- **Members**: Array of participant pubkeys added as join requests are approved
- **Updates**: Modified when captain approves/removes participants

#### Tier 2: Local Storage (Performance Cache)

**CaptainEventStore** (`AsyncStorage`)
- **Purpose**: Instant captain dashboard display
- **Key Format**: `captain_events_{teamId}`
- **Data**: Array of captain-created events
- **TTL**: No expiration (cleared on logout)
- **Update Pattern**: Write-through (update on creation/deletion)

**UnifiedNostrCache** (`AsyncStorage`)
- **Purpose**: Team events cache for all users
- **Key Format**: `team_events_{teamId}`
- **Data**: Array of all team events
- **TTL**: 1 hour (configurable in `cacheTTL.ts`)
- **Update Pattern**: Cache-first with background refresh

**Event Metadata Cache**
- **Purpose**: Individual event details
- **Key Format**: `event_detail_{eventId}`
- **TTL**: 30 minutes
- **Use Case**: EventDetailScreen fast loading

---

### 2.3 Event Query Architecture

**CRITICAL: Understanding Nostr Relay Indexing**

Nostr relays only index **standard NIP-01 tags**:
- ✅ `#p` - pubkey references (indexed)
- ✅ `#e` - event references (indexed)
- ✅ `#a` - address references (indexed)
- ✅ `#d` - identifier (indexed for replaceable events)
- ❌ `#team` - **NOT indexed** (custom tag)
- ❌ `#activity_type` - **NOT indexed** (custom tag)
- ❌ `#event_type` - **NOT indexed** (custom tag)

**The Problem with Custom Tag Queries:**

```typescript
// ❌ WRONG: This query will FAIL or return incomplete results
const filter = {
  kinds: [30101],
  "#team": [teamId],  // NOT indexed by relays
  limit: 100
};

// Relay behavior: May return 0 results or timeout
// Why: Relay must scan ALL kind 30101 events to filter by #team
```

**The Solution: Authors-Based Queries**

```typescript
// ✅ CORRECT: Query by captain pubkey (indexed field)
const filter = {
  kinds: [30101],
  authors: [captainPubkey],  // ✅ Indexed - fast query
  limit: 100
};

// Relay behavior: Fast lookup in author index
// Client-side: Filter results by teamId after fetching
```

#### Implementation in SimpleCompetitionService.ts

**Full Query Flow:**

```typescript
async getTeamEvents(teamId: string): Promise<Event[]> {
  // Step 1: Check cache first
  const cacheKey = `team_events_${teamId}`;
  const cached = await UnifiedNostrCache.get<Event[]>(cacheKey);

  if (cached) {
    console.log(`[Cache Hit] Found ${cached.length} events for team ${teamId}`);
    // Start background refresh
    this.refreshEventsInBackground(teamId);
    return cached;
  }

  // Step 2: Get team captain pubkey
  const captain = await this.getTeamCaptain(teamId);
  if (!captain) {
    console.error(`Cannot query events - team ${teamId} has no captain`);
    return [];
  }

  // Step 3: Query Nostr by captain's pubkey
  const ndk = await GlobalNDKService.getInstance();
  const filter = {
    kinds: [30101],
    authors: [captain.hexPubkey],  // ✅ Use indexed field
    limit: 100
  };

  const ndkEvents = await ndk.fetchEvents(filter);

  // Step 4: Client-side filter by teamId
  const events = Array.from(ndkEvents)
    .map(event => this.parseNostrEvent(event))
    .filter(event => event.teamId === teamId);  // Filter by #team tag

  // Step 5: Cache results
  await UnifiedNostrCache.set(cacheKey, events, CACHE_TTL.TEAM_EVENTS);

  console.log(`[Query Complete] Found ${events.length} events for team ${teamId}`);
  return events;
}
```

**Helper Method: Get Team Captain**

```typescript
private async getTeamCaptain(teamId: string): Promise<{hexPubkey: string} | null> {
  // Try cache first
  const teams = await UnifiedNostrCache.get<Team[]>('all_teams');
  if (teams) {
    const team = teams.find(t => t.id === teamId);
    if (team?.captain) {
      return { hexPubkey: team.captain };
    }
  }

  // Fallback: Query Nostr for team metadata
  const teamService = NdkTeamService.getInstance();
  const allTeams = await teamService.discoverAllTeams();
  const team = allTeams.find(t => t.id === teamId);

  return team?.captain ? { hexPubkey: team.captain } : null;
}
```

---

### 2.4 Event Display Flow

Events are displayed in three main locations:

#### Location 1: SimpleTeamScreen (Public View)

**Purpose**: Show all team events to members and visitors

**Query Method**:
```typescript
const events = await SimpleCompetitionService.getTeamEvents(teamId);
```

**Cache Strategy**: Cache-first with background refresh
```typescript
useEffect(() => {
  // 1. Load cached events immediately
  const loadCachedEvents = async () => {
    const cached = await UnifiedNostrCache.get(`team_events_${teamId}`);
    if (cached) {
      setEvents(cached);
      setLoading(false);
    }
  };

  // 2. Fetch fresh events in background
  const refreshEvents = async () => {
    const fresh = await SimpleCompetitionService.getTeamEvents(teamId);
    setEvents(fresh);
  };

  loadCachedEvents();
  refreshEvents();
}, [teamId]);
```

**Display Components**:
- Event cards with name, date, participant count
- Entry fee badge (if applicable)
- "Join Event" button for non-participants
- Navigation to EventDetailScreen on click

**Empty State**: "No events scheduled" when events array is empty

---

#### Location 2: Captain Dashboard (Captain-Only View)

**Purpose**: Show event management interface for team captains

**Query Method**: Combines local and Nostr data
```typescript
const captainEvents = await CaptainEventStore.getTeamEvents(teamId);
const nostrEvents = await SimpleCompetitionService.getTeamEvents(teamId);
const allEvents = [...captainEvents, ...nostrEvents].filter(unique);
```

**Display Components**:
- Event management cards with edit/delete buttons
- Join request count badges
- Payment verification status
- Navigation to EventCaptainDashboardScreen on click

**Special Features**:
- Real-time join request notifications
- Payment status indicators
- Transaction history (if NWC wallet connected)

---

#### Location 3: EventDetailScreen (Individual Event View)

**Purpose**: Show detailed event information and leaderboard

**Data Source**: Navigation params from previous screen
```typescript
const route = useRoute<EventDetailScreenRouteProp>();
const event = route.params.event;
```

**Validation**: Required fields check
```typescript
if (!event.captainPubkey || !event.name || !event.startDate) {
  return <ErrorView message="Event Data Incomplete" />;
}
```

**Display Sections**:
1. **Event Header**: Name, dates, description
2. **Entry Information**: Fee amount, participant limit, slots remaining
3. **Join Button**: Submit join request (with payment if required)
4. **Leaderboard**: Ranked participants with workout stats
5. **Event Announcements**: Captain updates (kind 1101 events)

**Leaderboard Calculation**:
```typescript
// Query kind 1301 workout events from participants
const participants = await getEventParticipants(event.id);
const workouts = await query1301EventsFromMembers(
  participants,
  event.startDate,
  event.endDate
);

// Calculate rankings based on event type
const leaderboard = calculateLeaderboard(workouts, event.eventType);
```

---

## 3. KNOWN ISSUES & FIXES

### Issue 1: Method Name Mismatch (FIXED - January 2025)

**Symptom:**
```
ERROR: _NdkTeamService.default.getInstance().discoverFitnessTeams is not a function
```

**Root Cause:**
- `NdkTeamService` was refactored from `discoverFitnessTeams()` to `discoverAllTeams()`
- `SimpleCompetitionService.ts` line 406 was calling the old method name

**Fix Applied:**
```typescript
// ❌ Before (line 406):
const teams = await NdkTeamService.getInstance().discoverFitnessTeams();

// ✅ After:
const teams = await NdkTeamService.getInstance().discoverAllTeams();
```

**Files Affected:**
- `src/services/competition/SimpleCompetitionService.ts:406`

**Prevention:**
- Use TypeScript strict mode to catch method name mismatches
- Run `npm run typecheck` before committing refactors

---

### Issue 2: Events Not Showing in SimpleTeamScreen

**Symptoms:**
- Captain can see events in Captain Dashboard
- Regular users see "No events scheduled" in SimpleTeamScreen
- Metro logs show: `[Query Complete] Found 0 events for team {teamId}`

**Root Causes:**

**Cause A**: Query fails to get team captain ID
```
ERROR: Cannot query events - team {teamId} has no captain
```

**Solution A**: Verify team metadata has captain field
```typescript
// Check team metadata in NdkTeamService
const team = await NdkTeamService.getInstance().getTeamById(teamId);
console.log('Team captain:', team.captain);

// If undefined, republish team metadata with captain field
```

**Cause B**: Events queried by `#team` tag instead of `authors` field
```typescript
// ❌ This query will fail
const filter = { kinds: [30101], "#team": [teamId] };

// ✅ Use authors field
const filter = { kinds: [30101], authors: [captainPubkey] };
```

**Solution B**: Update query to use `authors` field (see Section 2.3)

**Cause C**: Cache not invalidated after event creation
```
// No log: "Invalidating cache: team_events_{teamId}"
```

**Solution C**: Ensure cache invalidation in event creation flow
```typescript
// In NostrCompetitionService.createEvent():
await UnifiedNostrCache.invalidate(`team_events_${teamId}`);
console.log(`Invalidating cache: team_events_${teamId}`);
```

**Debugging Steps:**
1. Check Metro logs for: `"Error getting team captain for {teamId}"`
2. Verify captain ID exists in team metadata
3. Check if query uses `authors` field (correct) vs `#team` tag (incorrect)
4. Verify cache invalidation log after event creation
5. Force cache clear: Delete `team_events_{teamId}` from AsyncStorage

---

### Issue 3: "Event Data Incomplete" Error in EventDetailScreen

**Symptom:**
Clicking event navigates to `EventDetailScreen` showing error message:
```
"Event Data Incomplete - Missing required event information"
```

**Root Cause:**
Event object missing required `captainPubkey` field

**Required Fields:**
```typescript
interface Event {
  id: string;              // ✅ Required
  name: string;            // ✅ Required
  captainPubkey: string;   // ✅ Required - MOST COMMON ISSUE
  teamId: string;          // ✅ Required
  startDate: string;       // ✅ Required
  endDate: string;         // ✅ Required
  eventType: string;       // ✅ Required
  // Optional fields...
}
```

**Investigation Checklist:**

1. **Check Event Creation** (`NostrCompetitionService.ts`)
```typescript
// Verify captain_pubkey tag is added
tags: [
  ['captain_pubkey', captainPubkey],  // ✅ Must be present
  // ... other tags
]
```

2. **Check Event Parsing** (`SimpleCompetitionService.ts`)
```typescript
private parseNostrEvent(event: NDKEvent): Event {
  const captainPubkey = event.tagValue('captain_pubkey') || event.pubkey;

  console.log('Parsed event:', {
    id: event.tagValue('d'),
    captainPubkey,  // ✅ Should not be undefined
  });

  return { captainPubkey, /* ... */ };
}
```

3. **Check Navigation Params** (calling screen)
```typescript
// Verify complete event object is passed
navigation.navigate('EventDetailScreen', {
  event: completeEventObject  // ✅ Should have all required fields
});

console.log('Navigating with event:', completeEventObject);
```

**Fix:**
If `captainPubkey` is missing, add fallback to event's `pubkey`:
```typescript
const captainPubkey = event.captainPubkey || event.pubkey || event.teamCaptain;
```

---

### Issue 4: Missing Success Notification After Event Creation

**Symptom:**
Wizard closes immediately after event creation without showing:
1. Success alert
2. EventAnnouncementPreview modal

**Expected Flow:**
```
Event Created
  → CustomAlert: "Success! Event '{name}' has been created..."
  → User clicks "Continue"
  → EventAnnouncementPreview modal appears
  → User closes preview
  → Wizard closes and navigates back
```

**Actual Flow:**
```
Event Created
  → Wizard closes immediately (no alert or preview)
```

**Root Cause Options:**

**Option A**: Alert rendered after wizard component unmounts
```typescript
// ❌ Problematic sequence
await createEvent();
navigation.goBack();  // Unmounts wizard
setShowAlert(true);   // Alert never shows (component gone)
```

**Option B**: State management race condition
```typescript
// Alert state not triggering re-render before navigation
setShowAlert(true);
// Need to wait for state update before navigation
```

**Option C**: z-index / layering issue
```typescript
// Modal rendered but hidden behind other UI elements
<CustomAlert style={{ zIndex: 1000 }} />
<EventAnnouncementPreview style={{ zIndex: 1001 }} />
```

**Investigation Steps:**

1. **Check State Management** (`EventCreationWizard.tsx:492-510`)
```typescript
// Add debug logs
const handleEventCreated = async () => {
  console.log('1. Event created');
  setShowSuccessAlert(true);
  console.log('2. Alert state set');

  // Wait for alert to show
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log('3. Alert should be visible');
};
```

2. **Check Alert Rendering**
```typescript
// Verify alert appears in component tree
{showSuccessAlert && (
  <CustomAlert
    visible={showSuccessAlert}
    onClose={() => {
      console.log('Alert closed by user');
      setShowSuccessAlert(false);
      setShowAnnouncementPreview(true);
    }}
  />
)}
```

3. **Check Modal Z-Index**
```typescript
// Ensure modals render on top
<Modal
  visible={showSuccessAlert}
  transparent={true}
  animationType="fade"
  style={{ zIndex: 9999 }}
>
  {/* Alert content */}
</Modal>
```

**Potential Fix:**
```typescript
const handleEventCreated = async (event: Event) => {
  // 1. Show alert first
  setShowSuccessAlert(true);
  setCreatedEvent(event);

  // 2. Don't navigate immediately - wait for user interaction
  // Alert onClose handler will trigger next step
};

const handleAlertClose = () => {
  setShowSuccessAlert(false);
  setShowAnnouncementPreview(true);  // Show preview after alert
};

const handlePreviewClose = () => {
  setShowAnnouncementPreview(false);
  navigation.goBack();  // Navigate only after both modals closed
};
```

---

### Issue 5: Payment Verification Failing for Valid Payments

**Symptom:**
User pays entry fee but PaymentVerificationBadge shows "Not Found ✗"

**Root Causes:**

**Cause A**: Payment hash mismatch
```typescript
// Join request has payment hash
const paymentHash = "abc123...";

// NWC lookup fails because invoice format wrong
await NWCWalletService.lookupInvoice(paymentHash);  // Returns null
```

**Solution A**: Use full invoice string for lookup, not just hash
```typescript
// ✅ Correct approach
await NWCWalletService.lookupInvoice(fullInvoiceString);
```

**Cause B**: Transaction timing - Payment recent but not yet synced
```
Event: 2025-01-15 10:00 AM
Payment: 2025-01-15 10:05 AM
Verification: 2025-01-15 10:05:30 AM (30 seconds later)
Result: Not found (wallet not synced yet)
```

**Solution B**: Add retry mechanism with exponential backoff
```typescript
const verifyPaymentWithRetry = async (invoice: string, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    const result = await NWCWalletService.lookupInvoice(invoice);
    if (result?.settled) return true;

    // Wait before retry: 2s, 4s, 8s
    await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, i)));
  }
  return false;
};
```

**Cause C**: Wrong wallet queried (captain has multiple wallets)
```
Event wallet: wallet-a.getalby.com
Captain connected: wallet-b.getalby.com
Result: Payment not found (checking wrong wallet)
```

**Solution C**: Store wallet identifier with event
```typescript
// Event tags should include:
['payment_wallet', captainWalletId],  // Which wallet receives payments

// Verify using correct wallet
const walletId = event.tagValue('payment_wallet');
await NWCWalletService.lookupInvoice(invoice, walletId);
```

---

## 4. DEBUGGING CHECKLIST

When events aren't working, follow this systematic debugging process:

### Step 1: Verify Event Creation

**Check Metro Logs For:**
```
✅ [EventCreationWizard] Form validation passed
✅ [NostrCompetitionService] Publishing event to 4 relays...
✅ [NostrCompetitionService] Event published successfully: event_{timestamp}
✅ [NostrCompetitionService] Participant list created: event_{timestamp}-participants
✅ [CaptainEventStore] Event cached locally for team: {teamId}
```

**If Missing:**
- Check form validation logic in `EventCreationWizard.tsx`
- Verify all required fields are filled
- Check Nostr signing (ensure user has valid nsec)

---

### Step 2: Verify Event Storage

**Check Metro Logs For:**
```
✅ [NostrCompetitionService] Event created successfully: {eventId}
✅ [UnifiedNostrCache] Invalidating cache: team_events_{teamId}
✅ [CaptainEventStore] Stored event for team: {teamId}
```

**If Missing:**
- Check AsyncStorage write permissions
- Verify cache invalidation logic in `NostrCompetitionService.createEvent()`
- Clear app data and retry

---

### Step 3: Verify Event Query

**Check Metro Logs For:**
```
📋 [SimpleCompetitionService] Fetching events for team: {teamId}
✅ [SimpleCompetitionService] Found team captain from cache: {captainId}
📥 [SimpleCompetitionService] Query filter: { kinds: [30101], authors: ["{captainHexPubkey}"], limit: 100 }
✅ [SimpleCompetitionService] Received {N} events from Nostr
✅ [SimpleCompetitionService] Filtered to {M} events for team {teamId}
✅ [UnifiedNostrCache] Cached {M} events with TTL: 3600s
```

**If Query Fails:**

**Error Pattern A**: `Cannot query events - team {teamId} has no captain`
- **Cause**: Team metadata missing captain field
- **Fix**: Republish team metadata with captain pubkey

**Error Pattern B**: `Received 0 events from Nostr`
- **Cause**: Captain hasn't created any events OR query using wrong pubkey
- **Fix**: Verify captain pubkey in team metadata matches event author

**Error Pattern C**: `Filtered to 0 events for team {teamId}`
- **Cause**: Events exist but don't have matching `#team` tag
- **Fix**: Verify event creation includes `['team', teamId]` tag

---

### Step 4: Verify Event Display

**SimpleTeamScreen Logs:**
```
[SimpleTeamScreen] 🔍 Loading events for team: {teamId}
[SimpleTeamScreen] 📦 Cache hit: Found {N} cached events
[SimpleTeamScreen] 🔄 Starting background refresh...
[SimpleTeamScreen] ✅ Background refresh complete: {M} events
[SimpleTeamScreen] 🎨 Rendering {M} event cards
```

**Captain Dashboard Logs:**
```
[CaptainDashboard] 📋 Loading captain events for team: {teamId}
[CaptainDashboard] 💾 Local events: {N}
[CaptainDashboard] 🌐 Nostr events: {M}
[CaptainDashboard] ✅ Total unique events: {P}
```

**EventDetailScreen Logs:**
```
[EventDetailScreen] 📥 Received event: {eventId}
[EventDetailScreen] ✅ Validation passed - all required fields present
[EventDetailScreen] 🏃 Event type: {eventType}
[EventDetailScreen] 👥 Loading {N} participants
[EventDetailScreen] 📊 Calculating leaderboard...
```

---

### Common Error Patterns & Solutions

| Error Message | Root Cause | Solution |
|--------------|------------|----------|
| `discoverFitnessTeams is not a function` | Method renamed to `discoverAllTeams` | Update to `discoverAllTeams()` (Issue 1) |
| `Cannot query events - team has no captain` | Team metadata missing captain | Republish team metadata |
| `Found 0 events but captain sees events` | Using `#team` query instead of `authors` | Switch to authors-based query |
| `Event Data Incomplete` | Missing `captainPubkey` field | Add fallback: `event.pubkey` |
| `Payment not found` | Invoice lookup failing | Use full invoice string, add retry logic |
| No events showing in UI | Cache stale or not invalidated | Clear cache, verify invalidation logs |

---

## 5. KEY FILES REFERENCE

### Event Creation

**EventCreationWizard.tsx** (`src/components/wizards/`)
- **Purpose**: UI wizard for event creation
- **Key Functions**:
  - `handleSubmit()` - Form validation and submission
  - `validateForm()` - Client-side validation
  - `handleEventCreated()` - Success handling
- **State Management**: Local state for form fields
- **Validation Rules**: Lines 150-200

**NostrCompetitionService.ts** (`src/services/nostr/`)
- **Purpose**: Event publishing to Nostr
- **Key Functions**:
  - `createEvent()` - Publishes kind 30101 event
  - `createParticipantList()` - Creates kind 30000 list
  - `signAndPublish()` - Nostr signing and relay publishing
- **Relay Configuration**: Lines 20-30
- **Event Schema**: Lines 100-150

**CaptainEventStore.ts** (`src/services/event/`)
- **Purpose**: Local captain event cache
- **Key Functions**:
  - `addEvent()` - Cache new event
  - `getTeamEvents()` - Retrieve cached events
  - `removeEvent()` - Delete from cache
- **Storage Backend**: AsyncStorage
- **Cache Key Format**: `captain_events_{teamId}`

---

### Event Querying

**SimpleCompetitionService.ts** (`src/services/competition/`)
- **Purpose**: Main event query service
- **Key Functions**:
  - `getTeamEvents()` - Query events by team (authors-based)
  - `getTeamCaptain()` - Get captain pubkey for query
  - `parseNostrEvent()` - Convert NDK event to Event object
  - `refreshEventsInBackground()` - Background cache refresh
- **Query Logic**: Lines 200-300
- **Cache Integration**: Lines 150-180

**NdkTeamService.ts** (`src/services/team/`)
- **Purpose**: Team discovery and metadata
- **Key Functions**:
  - `discoverAllTeams()` - Query kind 33404 team events
  - `getTeamById()` - Get single team metadata
  - `getCaptainPubkey()` - Extract captain from team
- **Team Schema**: Lines 50-100

---

### Event Display

**SimpleTeamScreen.tsx** (`src/screens/`)
- **Purpose**: Public team view with events
- **Key Components**:
  - Event cards (FlatList)
  - Join event button
  - Loading states
- **Cache Strategy**: Cache-first with background refresh
- **Navigation**: Lines 200-250

**EventDetailScreen.tsx** (`src/screens/`)
- **Purpose**: Individual event details
- **Key Components**:
  - Event header
  - Join request form
  - Leaderboard
  - Payment modal (if entry fee)
- **Validation**: Lines 50-100
- **Leaderboard**: Lines 300-400

**CaptainDashboardScreen.tsx** (`src/screens/`)
- **Purpose**: Captain management view
- **Key Components**:
  - Event list with management actions
  - Join request notifications
  - Payment verification
  - Transaction history
- **Event Actions**: Lines 150-250

---

### Caching

**UnifiedNostrCache.ts** (`src/services/cache/`)
- **Purpose**: Global cache layer for Nostr data
- **Key Functions**:
  - `get()` - Retrieve cached data
  - `set()` - Store data with TTL
  - `invalidate()` - Clear specific cache key
- **Storage Backend**: AsyncStorage
- **TTL Management**: Automatic expiration

**cacheTTL.ts** (`src/constants/`)
- **Purpose**: Cache TTL configurations
- **Event-Related TTLs**:
  ```typescript
  TEAM_EVENTS: 60 * 60,      // 1 hour
  EVENT_DETAIL: 30 * 60,     // 30 minutes
  EVENT_PARTICIPANTS: 5 * 60 // 5 minutes
  ```

---

### Payment Verification

**PaymentVerificationBadge.tsx** (`src/components/captain/`)
- **Purpose**: Visual payment status indicator
- **States**: `free`, `claimed`, `verifying`, `verified`, `not_found`, `manual_paid`
- **Auto-Verify**: Lines 50-100
- **Retry Logic**: Lines 120-150

**EventTransactionHistory.tsx** (`src/components/captain/`)
- **Purpose**: Display incoming Lightning payments
- **Filters**: Amount, date range, transaction type
- **Fuzzy Matching**: ±1% tolerance for network fees
- **UI**: Collapsible component

**NWCWalletService.ts** (`src/services/wallet/`)
- **Purpose**: NWC wallet operations
- **Key Functions**:
  - `listTransactions()` - Query transaction history
  - `lookupInvoice()` - Check payment status
  - `makeInvoice()` - Generate Lightning invoice
- **Alby SDK Integration**: Lines 30-80

---

## 6. NOSTR EVENT FORMAT

### Kind 30101: Event Metadata

**Purpose**: Store event definition and configuration

**Event Structure:**
```json
{
  "kind": 30101,
  "pubkey": "hex_encoded_captain_pubkey",
  "created_at": 1705334400,
  "content": "Join us for our annual 5K fundraiser! All proceeds support local charities.",
  "tags": [
    ["d", "event_1705334400123_0.456"],
    ["name", "Annual 5K Charity Run"],
    ["team", "uuid-team-id-here"],
    ["activity_type", "Running"],
    ["event_type", "5k"],
    ["event_date", "2025-01-20T10:00:00.000Z"],
    ["end_date", "2025-01-20T12:00:00.000Z"],
    ["entry_fee", "2100"],
    ["max_participants", "50"],
    ["participant_list", "event_1705334400123_0.456-participants"],
    ["captain_pubkey", "npub1captain..."]
  ],
  "sig": "event_signature_here"
}
```

**Tag Breakdown:**

| Tag | Required | Description | Example |
|-----|----------|-------------|---------|
| `d` | ✅ Yes | Unique event identifier | `event_1705334400123_0.456` |
| `name` | ✅ Yes | Event display name | `Annual 5K Charity Run` |
| `team` | ✅ Yes | Team UUID | `uuid-team-id-here` |
| `activity_type` | ✅ Yes | Activity category (always "Running") | `Running` |
| `event_type` | ✅ Yes | Specific event distance | `5k`, `10k`, `half-marathon` |
| `event_date` | ✅ Yes | Event start date/time (ISO 8601) | `2025-01-20T10:00:00.000Z` |
| `end_date` | ✅ Yes | Event end date/time (ISO 8601) | `2025-01-20T12:00:00.000Z` |
| `entry_fee` | ❌ No | Entry fee in satoshis (0 = free) | `2100` |
| `max_participants` | ❌ No | Participant limit (0 = unlimited) | `50` |
| `participant_list` | ✅ Yes | Reference to kind 30000 list | `{eventId}-participants` |
| `captain_pubkey` | ✅ Yes | Captain's npub or hex pubkey | `npub1captain...` |

**Event Type Values:**
- `5k` - 5 kilometer race
- `10k` - 10 kilometer race
- `half-marathon` - Half marathon (21.1 km)

---

### Kind 30000: Participant List

**Purpose**: Track event participants

**Event Structure:**
```json
{
  "kind": 30000,
  "pubkey": "hex_encoded_captain_pubkey",
  "created_at": 1705334400,
  "content": "",
  "tags": [
    ["d", "event_1705334400123_0.456-participants"],
    ["title", "Participants: Annual 5K Charity Run"],
    ["p", "hex_participant_1_pubkey"],
    ["p", "hex_participant_2_pubkey"],
    ["p", "hex_participant_3_pubkey"]
  ],
  "sig": "event_signature_here"
}
```

**Tag Breakdown:**

| Tag | Required | Description | Example |
|-----|----------|-------------|---------|
| `d` | ✅ Yes | List identifier (matches event reference) | `{eventId}-participants` |
| `title` | ✅ Yes | Human-readable list name | `Participants: {eventName}` |
| `p` | ❌ No | Participant pubkey (one tag per participant) | `hex_pubkey_here` |

**Participant Management:**
- **Add participant**: Captain publishes updated kind 30000 with new `#p` tag
- **Remove participant**: Captain publishes updated kind 30000 without that `#p` tag
- **Replaceable**: New kind 30000 with same `#d` tag replaces previous version

---

## 7. TESTING COMMANDS

### Check if Events Exist on Nostr

**Using nak CLI tool:**
```bash
# Query all events by captain pubkey
nak req -k 30101 --authors <captain_hex_pubkey> wss://relay.damus.io

# Query specific event by identifier
nak req -k 30101 --tag d=<event_id> wss://relay.damus.io

# Query with multiple relays
nak req -k 30101 --authors <captain_hex_pubkey> \
  wss://relay.damus.io \
  wss://relay.primal.net \
  wss://nos.lol
```

**Expected Output:**
```json
{
  "kind": 30101,
  "pubkey": "captain_pubkey",
  "tags": [["d", "event_id"], ["name", "Event Name"], ...],
  "content": "Event description",
  "created_at": 1705334400
}
```

### Check Participant Lists

```bash
# Query participant list for event
nak req -k 30000 --tag d=<event_id>-participants wss://relay.damus.io

# Expected: kind 30000 with #p tags for each participant
```

---

### Metro Bundler Commands

**Start Metro (standard):**
```bash
npx expo start --ios
# Opens simulator and starts Metro on port 8081
```

**Start Metro with cache clear:**
```bash
npx expo start --clear --port 8081
# Clears Metro cache before starting
# Use when changes aren't appearing
```

**Start Metro with specific host:**
```bash
EXPO_DEV_SERVER_HOST=192.168.0.171 npx expo start --port 8081
# For testing on physical devices
```

**Force reload in simulator:**
```
Cmd+R in iOS Simulator
# Reloads JavaScript from Metro without rebuilding
```

---

### Xcode Commands

**Open workspace:**
```bash
open ios/runstrproject.xcworkspace
# IMPORTANT: Use .xcworkspace, not .xcodeproj
```

**Clean build:**
```bash
# In Xcode: Product > Clean Build Folder (Cmd+Shift+K)
# Then rebuild: Product > Build (Cmd+B)
```

**View device logs:**
```bash
# In Xcode: Window > Devices and Simulators > Open Console
# Shows native iOS logs (less useful for JavaScript debugging)
```

---

### AsyncStorage Debugging

**View cached events:**
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// View team events cache
const cached = await AsyncStorage.getItem('team_events_{teamId}');
console.log('Cached events:', JSON.parse(cached));

// View captain events
const captainEvents = await AsyncStorage.getItem('captain_events_{teamId}');
console.log('Captain events:', JSON.parse(captainEvents));

// Clear specific cache
await AsyncStorage.removeItem('team_events_{teamId}');
```

**Clear all caches:**
```typescript
await AsyncStorage.clear();
console.log('All caches cleared');
```

---

### TypeScript Validation

**Run typecheck:**
```bash
npm run typecheck
# Validates TypeScript without building
# Should show 0 errors before deploying
```

**Auto-fix formatting:**
```bash
npx prettier --write "src/**/*.{ts,tsx}"
# Formats all TypeScript files
```

---

### Network Debugging

**Check Metro connection:**
```bash
# Check if Metro is running
lsof -i :8081

# Kill stale Metro process
kill -9 $(lsof -t -i:8081)

# Restart Metro
npx expo start --clear --ios
```

**Check Nostr relay connections:**
```typescript
// In app code:
const ndk = await GlobalNDKService.getInstance();
const status = GlobalNDKService.getStatus();
console.log(`Connected relays: ${status.connectedRelays}/${status.relayCount}`);

// Expected: "Connected relays: 4/4"
```

---

## 8. FUTURE IMPROVEMENTS

### Short-Term (Next Release)

**Event Editing:**
- Allow captains to edit event name, dates, entry fee after creation
- Implementation: Publish updated kind 30101 with same `#d` tag (replaceable event)
- UI: "Edit Event" button in Captain Dashboard

**Event Deletion:**
- Allow captains to cancel events before start date
- Implementation: Publish kind 5 deletion event referencing kind 30101
- Cleanup: Remove participant list, refund entry fees

**Payment Receipt Generation:**
- Generate Lightning invoice receipt after successful payment
- Include: Event name, amount, payment hash, timestamp
- Format: Shareable image or PDF

---

### Medium-Term (Q1 2025)

**Recurring Events:**
- Allow captains to create weekly/monthly recurring events
- Implementation: Template system with date generation
- UI: "Make Recurring" checkbox in wizard

**Event Templates:**
- Save event configurations as templates
- Use cases: Weekly team runs, monthly challenges
- Implementation: Store templates in AsyncStorage

**Advanced Leaderboard Filters:**
- Filter by gender, age group, location
- Implementation: Parse kind 0 profile metadata
- UI: Dropdown filters in EventDetailScreen

**Team vs Team Events:**
- Events with multiple teams competing
- Implementation: Multi-team participant lists
- Scoring: Aggregate team performance

---

### Long-Term (Q2 2025+)

**Event Discovery Feed:**
- Public feed of all events across RUNSTR
- Implementation: Query kind 30101 from all known teams
- UI: New "Discover Events" tab

**Event Analytics:**
- Captain dashboard with event performance metrics
- Metrics: Participation rate, revenue, retention
- Implementation: Aggregate kind 1301 workouts

**Prize Automation:**
- Automatic winner detection and prize distribution
- Implementation: NWC auto-payments on event completion
- Rules: Top 3 finishers, participation prizes

**Event Streaming:**
- Real-time leaderboard updates during events
- Implementation: WebSocket connections to relay
- UI: Live leaderboard with push notifications

**Social Features:**
- Event comments and reactions
- Implementation: Kind 1 replies to kind 30101 events
- UI: Comment section in EventDetailScreen

---

## 9. APPENDIX: TROUBLESHOOTING WORKFLOW

### Quick Diagnosis Flowchart

```
Event Issue Detected
        ↓
[Step 1] Is event in Captain Dashboard?
    ├─ NO → Event creation failed
    │         ↓
    │   Check Metro logs for creation errors
    │   Verify Nostr signing works
    │   Confirm relay connections
    │
    └─ YES → Event created successfully
              ↓
        [Step 2] Is event in SimpleTeamScreen?
            ├─ NO → Event query failing
            │         ↓
            │   Check team captain ID exists
            │   Verify query uses authors field
            │   Clear team events cache
            │
            └─ YES → Event displays correctly
                      ↓
                [Step 3] Can users join event?
                    ├─ NO → Join request failing
                    │         ↓
                    │   Check EventJoinService logs
                    │   Verify Lightning invoice generation
                    │   Test payment verification
                    │
                    └─ YES → Event system working ✅
```

---

### Emergency Cache Reset

If all else fails, perform a full cache reset:

```typescript
// Run in app console or create debug button
import AsyncStorage from '@react-native-async-storage/async-storage';

const resetAllCaches = async () => {
  console.log('🔥 EMERGENCY CACHE RESET');

  // Clear all event caches
  const keys = await AsyncStorage.getAllKeys();
  const eventKeys = keys.filter(k =>
    k.includes('event') ||
    k.includes('team_events') ||
    k.includes('captain_events')
  );

  await AsyncStorage.multiRemove(eventKeys);
  console.log(`Cleared ${eventKeys.length} event cache keys`);

  // Force re-fetch
  console.log('✅ Caches cleared - restart app to re-fetch');
};

await resetAllCaches();
```

---

## DOCUMENT MAINTENANCE

**This document should be updated when:**
- New event-related bugs are discovered and fixed
- Event system architecture changes
- New event features are added
- Query patterns are modified

**Update Process:**
1. Document the issue in Section 3 (Known Issues & Fixes)
2. Add debugging steps to Section 4 (Debugging Checklist)
3. Update file references in Section 5 if files change
4. Add new testing commands to Section 7 as needed
5. Commit changes with clear description

**Last Updated**: January 2025
**Document Version**: 1.0
**System Status**: Production - Events are core feature

---

**Questions or Issues?**
If you encounter event system issues not covered in this document, please:
1. Follow the debugging checklist in Section 4
2. Check Metro logs for error patterns
3. Document the issue and solution
4. Update this document with findings
