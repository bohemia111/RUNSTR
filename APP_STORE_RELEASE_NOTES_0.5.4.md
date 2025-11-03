# App Store Release Notes - Version 0.5.4

## What's New

**One-Click Join Approval for Captains**
Captains can now approve event participants directly from the transaction history! The app automatically matches payments to join requests and displays an "Approve Join" button right in the transaction card. No more switching between screens - just one tap to approve!

**Critical QR Scanner Fix**
Fixed unreliable scanning of NWC wallet QR codes. We now use Apple's native scanner on iOS 16+ for significantly better detection of complex QR codes. Includes pinch-to-zoom and guidance features.

**Activity Streaks**
New streak tracking shows your workout consistency! See your current streak and longest streak for each activity type, encouraging you to maintain your fitness habits.

**Settings Toggles Now Visible**
Fixed toggle switches in Settings that were hard to see. All switches now use bright orange and gold colors for clear visibility.

**Complete Workout History**
The Local Workouts tab now shows your complete local history - GPS tracked workouts, manual entries, daily steps, and imported Nostr workouts all in one place.

**Simplified Analytics**
Streamlined Advanced Analytics to focus on what matters most: Health Metrics (BMI/VO2 Max), Weekly Caloric Balance, and Activity Streaks.

---

## App Store Connect Format (Character Limit: 4000)

### Copy-paste this version:

```
What's New in Version 0.5.4:

CAPTAIN WORKFLOW - ONE-CLICK APPROVAL
• Approve event participants directly from transaction history
• Automatic payment matching (exact or fuzzy timestamp/amount match)
• "Approve Join" button appears inline with transactions
• Green checkmark for already-approved participants
• Reduces workflow from 4 steps to just 1 click

CRITICAL FIX - QR CODE SCANNER
• Fixed unreliable NWC wallet QR code scanning
• iOS 16+ uses Apple's native scanner (DataScannerViewController)
• Significantly better detection of complex QR codes
• Pinch-to-zoom, guidance, and highlighting features
• Fallback scanner for older devices

ACTIVITY STREAKS ANALYTICS
• New streak tracking shows workout consistency
• Current and longest streaks per activity type
• Visual cards encourage daily habits
• Beautiful design integrated with Advanced Analytics

SETTINGS IMPROVEMENTS
• Fixed invisible toggle switches
• Bright orange and gold colors for clear visibility
• Affects all voice, summary, and tracking toggles
• Health Profile navigation now works correctly

LOCAL WORKOUTS ENHANCEMENT
• Shows complete local history (not just unsynced)
• GPS tracked, manual entries, daily steps, imported Nostr workouts
• "Stored on your device" label for clarity
• Better guidance for new users

SIMPLIFIED ANALYTICS
• Streamlined to 3 essential sections
• Health Metrics (BMI/VO2 Max/Fitness Age)
• Weekly Caloric Balance
• Activity Streaks
• Cleaner UI with actionable insights

Thanks for using RUNSTR! Keep competing and earning Bitcoin through fitness.
```

---

## Alternative Short Version (for space-constrained updates):

```
New in 0.5.4:
• One-click approval for captains (transaction history matching)
• Fixed NWC QR scanner (native iOS scanner for reliability)
• Activity streaks tracking (workout consistency)
• Visible settings toggles (orange/gold colors)
• Complete local workout history
• Simplified analytics (3 core sections)
```

---

## Notes for Review Team (Internal):

**Key Changes:**
- EventTransactionHistory.tsx: +259 lines (smart matching algorithm)
- EventCaptainDashboardScreen.tsx: +134 lines (approval workflow)
- QRScannerModal.tsx: +189 lines (native scanner implementation)
- SettingsScreen.tsx: 20 lines (toggle color fixes)
- AdvancedAnalyticsScreen.tsx: -527 lines (major simplification)
- New files: ActivityStreaksCard.tsx, StreakAnalyticsService.ts

**Testing Focus:**
- Captain transaction history approval workflow
- NWC QR code scanning (especially on iOS 16+)
- Settings toggle visibility
- Health Profile navigation
- Activity streaks display
- Local workouts tab showing all workout types
