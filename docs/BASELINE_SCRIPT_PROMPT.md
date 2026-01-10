# RUNSTR Consolidated Baseline Script Prompt

**Copy this entire prompt to your other project to create the baseline publishing script.**

---

## PROMPT START

Create a Node.js script that computes ALL RUNSTR challenge leaderboard standings and publishes them as a SINGLE consolidated Nostr note. I'll run this script manually 2x/day.

**NOTE**: This project already has an nsec configured for publishing - use that.

**What the script does:**
1. Query kind 1301 (workout) events from ALL participants across 3 challenges
2. Run anti-cheat logic to filter duplicates and unrealistic results
3. Calculate leaderboards for each challenge:
   - **Season 2**: Running/Walking/Cycling distance with charity rankings
   - **Running Bitcoin**: Running + Walking distance combined
   - **January Walking**: STEPS (not distance!)
4. Show me the results and wait for confirmation before publishing
5. Publish a kind 30078 replaceable event with ALL leaderboard data

---

## Nostr Event Structure to Publish

```json
{
  "kind": 30078,
  "pubkey": "RUNSTR_ADMIN_PUBKEY",
  "tags": [
    ["d", "runstr-consolidated-leaderboard-v1"],  // IMPORTANT: Must match exactly
    ["updated", "<unix_timestamp_now>"],
    ["cutoff", "<exact_unix_timestamp_of_last_1301_event_included>"]
  ],
  "content": "<JSON string of ALL leaderboard data>"
}
```

**IMPORTANT**: The d-tag is `runstr-consolidated-leaderboard-v1` (not season2-specific)

---

## Content JSON Structure (ALL CHALLENGES)

```json
{
  "season2": {
    "running": {
      "participants": [
        {"pubkey": "hex", "distance": 87.07, "count": 10, "charityId": "opensats"},
        ...all Season 2 participants sorted by distance
      ],
      "charityRankings": [
        {"rank": 1, "charityId": "opensats", "totalDistance": 234.5, "participantCount": 15},
        ...all charities with distance > 0
      ]
    },
    "walking": { ...same structure },
    "cycling": { ...same structure }
  },
  "runningBitcoin": {
    "participants": [
      {"pubkey": "hex", "totalDistanceKm": 45.2, "workoutCount": 8},
      ...all Running Bitcoin participants sorted by distance
    ],
    "totalDistanceKm": 1234.56
  },
  "januaryWalking": {
    "participants": [
      {"pubkey": "hex", "totalSteps": 125000, "workoutCount": 12},
      ...all January Walking participants sorted by steps
    ],
    "totalSteps": 5678901
  }
}
```

---

## Challenge-Specific Rules

### Season 2 (January 1 - March 1, 2026)
- **Activity Types**: running, walking, cycling (separate leaderboards)
- **Metric**: Distance in km
- **Charity Support**: Track charity per workout, compute charity rankings
- **Date Range**: `1735689600` to `1740787199`

### Running Bitcoin (January 3 - January 31, 2026)
- **Activity Types**: running OR walking (combined into single leaderboard)
- **Metric**: Distance in km
- **No Charity**: Don't track charity for this challenge
- **Date Range**: `1735862400` to `1738367999`

### January Walking Challenge (January 1 - January 31, 2026)
- **Activity Types**: walking OR hiking ONLY
- **Metric**: STEPS (not distance!) - extract from `steps` tag
- **No Charity**: Don't track charity for this challenge
- **Date Range**: `1735689600` to `1738367999`

---

## Kind 1301 Event Format (What You're Querying)

```json
{
  "kind": 1301,
  "pubkey": "user_hex_pubkey",
  "created_at": 1234567890,
  "content": "Morning run in the park",
  "tags": [
    ["d", "workout_uuid_12345"],
    ["title", "Morning Run"],
    ["exercise", "running"],
    ["distance", "5.2", "km"],
    ["duration", "00:30:45"],
    ["calories", "312"],
    ["steps", "6500"],
    ["charity", "opensats", "OpenSats", "opensats@vlt.ge"],
    ["source", "RUNSTR"],
    ["client", "RUNSTR", "0.2.6"],
    ["t", "Running"]
  ]
}
```

**Key tags to extract:**
- `["exercise", "running"]` - Activity type (lowercase)
- `["distance", "5.2", "km"]` - Distance with unit (3 elements!)
- `["steps", "6500"]` - Step count (2 elements, REQUIRED for January Walking)
- `["duration", "00:30:45"]` - Duration in HH:MM:SS format
- `["charity", "id", "name", "lightning_address"]` - User's selected charity (4 elements)
- `["d", "unique_id"]` - Unique workout identifier for deduplication

---

## Activity Type Mapping

```javascript
function getActivityType(exerciseTag) {
  const exercise = exerciseTag?.toLowerCase() || '';
  if (exercise.includes('run') || exercise.includes('jog')) return 'running';
  if (exercise.includes('walk') || exercise.includes('hike')) return 'walking';
  if (exercise.includes('cycl') || exercise.includes('bike')) return 'cycling';
  return null; // Skip other activity types
}

// For January Walking - only walking/hiking counts
function isWalkingActivity(exerciseTag) {
  const exercise = exerciseTag?.toLowerCase() || '';
  return exercise.includes('walk') || exercise.includes('hike');
}

// For Running Bitcoin - running OR walking counts
function isRunningBitcoinActivity(exerciseTag) {
  const exercise = exerciseTag?.toLowerCase() || '';
  return exercise.includes('run') || exercise.includes('jog') ||
         exercise.includes('walk') || exercise.includes('hike');
}
```

---

## Distance Extraction

```javascript
function extractDistanceKm(tags) {
  const distanceTag = tags.find(t => t[0] === 'distance');
  if (!distanceTag) return 0;

  const value = parseFloat(distanceTag[1]) || 0;
  const unit = (distanceTag[2] || 'km').toLowerCase();

  if (unit === 'm' || unit === 'meters') return value / 1000;
  if (unit === 'mi' || unit === 'miles') return value * 1.60934;
  return value; // Assume km
}
```

---

## Steps Extraction (CRITICAL for January Walking)

```javascript
function extractSteps(tags) {
  const stepsTag = tags.find(t => t[0] === 'steps');
  if (!stepsTag) return 0;

  const steps = parseInt(stepsTag[1], 10);
  return isNaN(steps) ? 0 : steps;
}
```

**IMPORTANT**: January Walking uses STEPS, not distance. A workout without a `steps` tag should NOT count for January Walking even if it has distance.

---

## Charity Extraction (Season 2 only)

```javascript
function extractCharity(tags) {
  const charityTag = tags.find(t => t[0] === 'charity');
  if (!charityTag || charityTag.length < 2) return null;

  return {
    id: charityTag[1],
    name: charityTag[2] || charityTag[1],
    lightningAddress: charityTag[3] || null
  };
}
```

---

## Anti-Cheat Logic (REQUIRED)

Run these checks BEFORE computing totals. Log flagged events for my review.

```javascript
const ANTICHEAT_RULES = {
  // Deduplicate by event ID (same event from multiple relays)
  deduplicateByEventId: true,

  // Deduplicate by d-tag (same workout posted multiple times)
  deduplicateByDTag: true,

  // Maximum realistic speeds (km/h)
  maxSpeeds: {
    running: 25,      // Elite marathon pace ~20km/h, allow buffer
    walking: 10,      // Fast walking ~7km/h, allow buffer
    cycling: 60,      // Fast cycling ~45km/h, allow buffer
  },

  // Maximum realistic single workout distances (km)
  maxDistances: {
    running: 100,     // Ultra marathon territory
    walking: 60,      // Very long hike
    cycling: 300,     // Century+ ride
  },

  // Maximum steps per workout (anti-cheat for January Walking)
  maxStepsPerWorkout: 100000,  // ~50 miles walking

  // Maximum workout duration (hours)
  maxDurationHours: 24,

  // Minimum distance to count (filter GPS glitches)
  minDistanceKm: 0.1,

  // Minimum steps to count
  minSteps: 100,

  // Flag round numbers (potential manual entry cheats)
  flagRoundDistances: true,  // e.g., exactly 10.00 km
  flagRoundDurations: true,  // e.g., exactly 01:00:00
  flagRoundSteps: true,      // e.g., exactly 10000 steps
};

function checkWorkout(workout) {
  const issues = [];

  // Check speed (for distance-based activities)
  if (workout.distanceKm > 0 && workout.durationSeconds > 0) {
    const durationHours = workout.durationSeconds / 3600;
    const speedKmh = workout.distanceKm / durationHours;
    const maxSpeed = ANTICHEAT_RULES.maxSpeeds[workout.activityType];
    if (speedKmh > maxSpeed) {
      issues.push(`Speed ${speedKmh.toFixed(1)} km/h exceeds max ${maxSpeed} km/h`);
    }
  }

  // Check max distance
  if (workout.distanceKm > 0) {
    const maxDist = ANTICHEAT_RULES.maxDistances[workout.activityType];
    if (workout.distanceKm > maxDist) {
      issues.push(`Distance ${workout.distanceKm} km exceeds max ${maxDist} km`);
    }
  }

  // Check max steps (January Walking)
  if (workout.steps > ANTICHEAT_RULES.maxStepsPerWorkout) {
    issues.push(`Steps ${workout.steps} exceeds max ${ANTICHEAT_RULES.maxStepsPerWorkout}`);
  }

  // Check duration
  const durationHours = workout.durationSeconds / 3600;
  if (durationHours > ANTICHEAT_RULES.maxDurationHours) {
    issues.push(`Duration ${durationHours.toFixed(1)} hours exceeds max 24 hours`);
  }

  // Flag round numbers (suspicious but not auto-reject)
  if (workout.distanceKm === Math.round(workout.distanceKm) && workout.distanceKm >= 5) {
    issues.push(`Warning: Suspiciously round distance: exactly ${workout.distanceKm} km`);
  }
  if (workout.steps > 0 && workout.steps % 1000 === 0 && workout.steps >= 5000) {
    issues.push(`Warning: Suspiciously round steps: exactly ${workout.steps}`);
  }

  return issues;
}
```

---

## Relays

Query from all 4 relays (parallel):
- `wss://relay.damus.io`
- `wss://nos.lol`
- `wss://relay.primal.net`
- `wss://relay.nostr.band`

Publish to all 4 relays.

---

## Challenge Date Ranges

### Season 2
- Start: January 1, 2026 00:00:00 UTC (Unix: `1735689600`)
- End: March 1, 2026 23:59:59 UTC (Unix: `1740787199`)

### Running Bitcoin
- Start: January 3, 2026 00:00:00 UTC (Unix: `1735862400`)
- End: January 31, 2026 23:59:59 UTC (Unix: `1738367999`)

### January Walking
- Start: January 1, 2026 00:00:00 UTC (Unix: `1735689600`)
- End: January 31, 2026 23:59:59 UTC (Unix: `1738367999`)

---

## Participant Pubkeys

### Season 2 Participants (43 total)
```javascript
const SEASON_2_PUBKEYS = [
  '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5', // TheWildHustle
  '745eb529d0e42d2fa6c904bbc2c10702deae964b4dd3079803ab8b43536dda12', // guy
  'dae73fdd90d98db1a8405bcecac60cd6ce8d10896a6a2c5e04011125e16cd432', // Lhasa Sensei
  '43256bc0859462cf14fa7de594a48babdf189b91abe27f88d824abf69b2343c9', // LOPES
  'e7df627c638d934b37548d8408b43dc5d4762fa270c26abec5916bff62aac80d', // KjetilR
  '9358c67695d9e78bde2bf3ce1eb0a5059553687632a177e7d25deeff9f2912fc', // Kamo Weasel
  'c9943d8f8e9c2aa9facb6e579af6ec38b7205c0570de1b0fb8f99f65dc5f786e', // Zed
  '6b42a3b227b086e850ff659a151863ce070eb60d32bae8a4618928655effc3f6', // JokerHasse
  '0c252c138ee446b6f9c0964ff609380fc82e52c8d318529607f293fcdf828bea', // Busch21
  'c8b22b81877eaa54e1ab21e39824f85a29e61f71da9fbabbef8930b171b98da8', // Hoov
  '8ce975f57dd070c4293ff8f978b869e20b2cdf4c81f277b46f3676b262c5e823', // clemsy
  '9fce3aea32b35637838fb45b75be32595742e16bb3e4742cc82bb3d50f9087e6', // MAKE SONGS LONGER
  'e5237023a5c0929e7ae0e5128d41a8213138400ec110dbe9d8a29278f22b7c13', // Helen Yrmom
  '02734f19cae7850e7bca6c0a2bb6a534f152d5acbd86eece1d2bfbd5d6502003', // bitcoin_rene
  '939ffb4e552ed5c0fa780985ab7163f441798409ae7ed81c62c07ac4683b4222', // Johan
  '5a654b6394bb83ecc1b95f848d6bc44e6d21120de5d832040704d9823b2c0af4', // Drew
  '5d405752c1b4ddd0714baf3ce415db52e5506036f345ff575ee16e2b4cf189bf', // Heiunter
  '14ca97caaea1565dc3f8277394a8f7d03364745a8d18536d8423dbac3f363b7f', // Satty
  'de7ab932ca17278b2144a6628c3531a0628fcc7b58074111d6e5b949ecb0e377', // Harambe's last Bitcoin
  'a80fc4a78634ee26aabcac951b4cfd7b56ae18babd33c5afdcf6bed6dc80ebd1', // Uno
  'a723805cda67251191c8786f4da58f797e6977582301354ba8e91bcb0342dc9c', // Seth
  '0ae9dc5f42febd11c5c895b0af0bbabbe02261591b0f24eefe22c0d9ca8d0286', // MoonKaptain
  'fad80b7451b03f686fd9e487b05b69c04c808e26a1db655e59e0e296a5c9f4dd', // means
  'a9046cc9175dc5a45fb93a2c890f9a8b18c707fa6d695771aab9300081d3e21a', // Ben Cousens
  '20d29810d6a5f92b045ade02ebbadc9036d741cc686b00415c42b4236fe4ad2f', // negr0
  'ea28488b659ab6433167cd024eb72e01a375ac17ce54a1cdc6e5dce2f6d93923', // johnny9
  'c6f0f4279f12200f77e1943cd26aaedf6081fda8585695f9a923b4723686da12', // Tumbleweed
  '661305095522a18a1095b7b86874ef618da9c5d1ba5f4af375688e2129c07317', // Ajax
  '933a52008116743cd652eca47209f57e4ca4c439d8c2526d8c48a47bf7072ec7', // Nell
  '312f54da0da1cf0cdcf1d6385fa8d6e5d8218f7122297d30b22482edada44649', // HumbleStacker
  '9416112efa3cdc0675156e4cb6ae46b2cca51973065c61bcbc002ca99e5dcdf2', // Lat51_Training
  '0f563fe2cfdf180cb104586b95873379a0c1fdcfbc301a80c8255f33d15f039d', // Patrick
  'd84517802a434757c56ae8642bffb4d26e5ade0712053750215680f5896e579b', // ObjectiF MooN
  'eeb11961b25442b16389fe6c7ebea9adf0ac36dd596816ea7119e521b8821b9e', // OpenMike
  '81b91540daeee031df309460a9bcf5866a54c70217ff173bcdefd1982f12b0ba', // Aaron Tomac
  '7ebbce1843a17cd778a5e169e3d2f679f5ac7b5125d1c43d265e190f7b27538c', // Adrien Lacombe
  '179154c2b30226578a14ac5a01f50a3efde8d14032df96371550e1210fffd892', // Awakening Mind
  '1f698bd4b5dda804316f09773f903ca699cf5b2a0fcd5b3fe6e0709668d58e60', // Dani
  '86f7eea066dd4dc574d01b0f9317a03508887f815fb58d8ef66873cc42fe3431', // Taljarn
  '0418ca2d6cd6c7fbc4e0391bb745027023a7edbc38f2a60fc3b68f006efb85eb', // saiy2k
  '556329e4245ec4889c33b29262c85335a082c2e25cd08b69ff46e17e70b785ec', // OrangePillosophy
  'a2603c88443af5152585f3f836832a67551e3ecad0e47a435c8d6510aa31c843', // Carol
  '24b45900a92fbc4527ccf975bd416988e444c6e4d9f364c5158667f077623fe2', // Jose Sammut
];
```

### Running Bitcoin Participants
```javascript
// Use same list as Season 2, but filter to only those who have opted in
// OR use a separate list if Running Bitcoin has different participants
const RUNNING_BITCOIN_PUBKEYS = SEASON_2_PUBKEYS; // Adjust as needed
```

### January Walking Participants
```javascript
// Use same list as Season 2
const JANUARY_WALKING_PUBKEYS = SEASON_2_PUBKEYS; // Adjust as needed
```

---

## Valid Charity IDs (Season 2 only)

If a workout has no charity tag, use `'opensats'` as default.

```javascript
const VALID_CHARITIES = [
  'bitcoin-bay',
  'bitcoin-ekasi',
  'bitcoin-isla',
  'bitcoin-district',
  'bitcoin-yucatan',
  'bitcoin-veterans',
  'bitcoin-makueni',
  'bitcoin-house-bali',
  'human-rights-foundation',
  'afribit-kibera',
  'bitcoin-basin',
  'als-foundation',
  'central-pennsylvania-bitcoiners',
  'opensats',  // Default
  'hrf',       // Alias for human-rights-foundation
];
```

---

## Script Workflow

1. **Connect to all 4 relays**

2. **Query kind 1301 events** from ALL participants (use union of all participant lists)
   - Date range: earliest start (Jan 1) to latest end (Mar 1)
   - This gets all workouts that might apply to ANY challenge

3. **Deduplicate**:
   - By event ID (same event from multiple relays)
   - By d-tag (same workout posted multiple times, keep latest)

4. **Run anti-cheat checks** on each workout, log issues

5. **Route workouts to challenges**:
   - Each workout may count for multiple challenges if it meets criteria
   - Season 2: Check date range + activity type
   - Running Bitcoin: Check date range + is running/walking
   - January Walking: Check date range + is walking + HAS STEPS TAG

6. **Compute leaderboards** for each challenge:
   - Season 2: 3 activity leaderboards + charity rankings
   - Running Bitcoin: 1 combined distance leaderboard
   - January Walking: 1 steps-based leaderboard

7. **Display results** in readable table format (all 3 challenges)

8. **Wait for my confirmation** (y/n prompt)

9. **Publish** single kind 30078 event to all 4 relays

10. **Verify** publication by fetching the event back

---

## Expected Output Format

```
Connecting to 4 relays...
✓ relay.damus.io
✓ nos.lol
✓ relay.primal.net
✓ relay.nostr.band

Fetching kind 1301 events for all participants...
Fetched 250 raw events in 2.5s

Deduplication:
  - Removed 15 duplicate events (same ID from multiple relays)
  - Removed 5 duplicate workouts (same d-tag, kept latest)
  - 230 unique workouts remaining

Anti-cheat flagged 3 workouts:
  ❌ REJECTED: means - 48.86km walk in 12:00:00
     Exactly round distance+duration
  ⚠️ WARNING: Helen - 10000 steps exactly
     Suspiciously round steps (still counted)
  ...

After filtering: 227 valid workouts

============ SEASON 2: RUNNING ============
Rank  Name           Distance    Workouts  Charity
1     JokerHasse     87.07 km    10        opensats
2     guy            45.04 km    8         hrf
3     LOPES          38.21 km    15        bitcoin-bay
...

Charity Rankings (Running):
1. OpenSats        234.5 km (15 participants)
2. HRF             189.2 km (12 participants)
...

============ SEASON 2: WALKING ============
...

============ SEASON 2: CYCLING ============
...

============ RUNNING BITCOIN ============
Rank  Name           Distance    Workouts
1     TheWildHustle  125.4 km    18
2     guy            89.2 km     12
...
Total Distance: 1,234.56 km

============ JANUARY WALKING (STEPS) ============
Rank  Name           Steps       Workouts
1     Helen          245,000     15
2     Hoov           198,500     12
...
Total Steps: 2,345,678

Cutoff timestamp: 1704722400 (2026-01-08T14:00:00Z)

Publish this consolidated baseline? (y/n):
```

---

## Admin Pubkey for Publishing

Use this pubkey (the app expects this specific pubkey):
```
611021eaaa2692741b1236bbcea54c6aa9f20ba30cace316c3a93d45089a7d0f
```

---

## PROMPT END
