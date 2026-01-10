# Notifications Services Directory

Team-branded push notification system with Nostr event integration for RUNSTR.

## Files

- **EventJoinNotificationHandler.ts** - Handles event join notifications
- **ExpoNotificationProvider.ts** - Expo push notification provider and device token management
- **index.ts** - Central export file for notification services
- **LocalNotificationTrigger.ts** - Local notification triggering service
- **NostrNotificationEventHandler.ts** - Real-time processing of Nostr competition events (kinds 1101, 1102, 1103)
- **NotificationCleanupService.ts** - Cleanup service for old notifications
- **NotificationPreferencesService.ts** - User notification preference management and granular controls
- **NotificationScheduler.ts** - Notification scheduling and delivery timing management
- **NotificationService.ts** - Main notification service coordinating all notification functionality
- **profileHelper.ts** - Profile helper utilities for notifications
- **TeamContextService.ts** - Single source of truth for team membership and context in notifications
- **TeamJoinNotificationHandler.ts** - Handles team join notifications
- **TeamNotificationFormatter.ts** - Team-branded notification formatting and rich content generation
- **UnifiedNotificationStore.ts** - Unified store for notification state management
