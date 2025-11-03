# App Store Release Notes - Version 0.5.2

## What's New

**Event Management for Captains**
Captains can now easily view and manage all their created events in one place! Access your event history from the Captain Dashboard and re-announce events to boost participation.

**Improved Reliability**
We've fixed issues that could prevent events from being published and improved how the app handles event data. Your events will now publish more reliably.

**Bug Fixes**
- Fixed crashes that could occur when viewing certain events
- Improved error handling throughout the app
- Better performance when loading event details

---

## App Store Connect Format (Character Limit: 4000)

### Copy-paste this version:

```
What's New in Version 0.5.2:

EVENT MANAGEMENT FOR CAPTAINS
• View all your created events in one place from the Captain Dashboard
• Re-announce existing events to boost participation
• All events are automatically saved for easy management

IMPROVEMENTS
• More reliable event publishing
• Better error handling when viewing events
• Faster event detail loading

BUG FIXES
• Fixed crashes when viewing events with incomplete data
• Resolved event publishing failures
• Improved overall app stability

Thanks for using RUNSTR! Keep competing, earning Bitcoin, and achieving your fitness goals.
```

---

## Alternative Short Version (for space-constrained updates):

```
New in 0.5.2:
• Captain Event Dashboard - manage all your events in one place
• Re-announce events to boost participation
• Improved event publishing reliability
• Bug fixes and performance improvements
```

---

## Notes for Review Team (Internal):

**Key Changes:**
- New CaptainEventStore service for local event persistence
- Captain Dashboard now includes "My Events" section
- Event publishing now uses Global NDK instance
- Added validation for event data integrity

**Testing Focus:**
- Captain dashboard event list loading
- Event re-announcement flow
- Event detail screen with various data states
