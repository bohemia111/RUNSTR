/**
 * NotificationCleanupService - Centralized cleanup for all notification handlers
 * Called on logout to properly stop all listeners and clear state
 */

import { challengeNotificationHandler } from './ChallengeNotificationHandler';
import { challengeResponseHandler } from './ChallengeResponseHandler';
import { teamJoinNotificationHandler } from './TeamJoinNotificationHandler';
import { eventJoinNotificationHandler } from './EventJoinNotificationHandler';
import { NostrNotificationEventHandler } from './NostrNotificationEventHandler';

export class NotificationCleanupService {
  private static instance: NotificationCleanupService;

  private constructor() {}

  static getInstance(): NotificationCleanupService {
    if (!NotificationCleanupService.instance) {
      NotificationCleanupService.instance = new NotificationCleanupService();
    }
    return NotificationCleanupService.instance;
  }

  /**
   * Clean up all notification handlers
   * Called on logout to stop listeners and clear state
   */
  async cleanupAllHandlers(): Promise<void> {
    console.log('[NotificationCleanup] Starting cleanup of all notification handlers...');

    const cleanupTasks: Promise<void>[] = [];

    // Stop challenge notifications
    try {
      cleanupTasks.push(challengeNotificationHandler.stopListening());
      console.log('[NotificationCleanup] Stopping challenge notifications...');
    } catch (error) {
      console.error('[NotificationCleanup] Failed to stop challenge notifications:', error);
    }

    // Stop challenge response notifications
    try {
      cleanupTasks.push(challengeResponseHandler.stopListening());
      console.log('[NotificationCleanup] Stopping challenge response notifications...');
    } catch (error) {
      console.error('[NotificationCleanup] Failed to stop challenge response notifications:', error);
    }

    // Stop team join notifications
    try {
      cleanupTasks.push(teamJoinNotificationHandler.stopListening());
      console.log('[NotificationCleanup] Stopping team join notifications...');
    } catch (error) {
      console.error('[NotificationCleanup] Failed to stop team join notifications:', error);
    }

    // Stop event join notifications
    try {
      cleanupTasks.push(eventJoinNotificationHandler.stopListening());
      console.log('[NotificationCleanup] Stopping event join notifications...');
    } catch (error) {
      console.error('[NotificationCleanup] Failed to stop event join notifications:', error);
    }

    // Stop Nostr competition event notifications
    try {
      const nostrEventHandler = NostrNotificationEventHandler.getInstance();
      cleanupTasks.push(nostrEventHandler.stopListening());
      console.log('[NotificationCleanup] Stopping Nostr competition event notifications...');
    } catch (error) {
      console.error('[NotificationCleanup] Failed to stop Nostr event notifications:', error);
    }

    // Wait for all cleanup tasks to complete
    await Promise.allSettled(cleanupTasks);

    // Clear all notification data
    try {
      challengeNotificationHandler.clearAll();
      challengeResponseHandler.clearAll();
      teamJoinNotificationHandler.clearAll();
      eventJoinNotificationHandler.clearAll();
      console.log('[NotificationCleanup] Cleared all notification data');
    } catch (error) {
      console.error('[NotificationCleanup] Failed to clear notification data:', error);
    }

    console.log('[NotificationCleanup] ✅ Cleanup complete');
  }

  /**
   * Clean up specific handler
   */
  async cleanupHandler(handlerType: 'challenge' | 'challengeResponse' | 'teamJoin' | 'eventJoin' | 'nostrEvent'): Promise<void> {
    console.log(`[NotificationCleanup] Cleaning up ${handlerType} handler...`);

    try {
      switch (handlerType) {
        case 'challenge':
          await challengeNotificationHandler.stopListening();
          challengeNotificationHandler.clearAll();
          break;
        case 'challengeResponse':
          await challengeResponseHandler.stopListening();
          challengeResponseHandler.clearAll();
          break;
        case 'teamJoin':
          await teamJoinNotificationHandler.stopListening();
          teamJoinNotificationHandler.clearAll();
          break;
        case 'eventJoin':
          await eventJoinNotificationHandler.stopListening();
          eventJoinNotificationHandler.clearAll();
          break;
        case 'nostrEvent':
          const handler = NostrNotificationEventHandler.getInstance();
          await handler.stopListening();
          // NostrNotificationEventHandler doesn't have clearAll method
          break;
      }
      console.log(`[NotificationCleanup] ✅ ${handlerType} handler cleaned up`);
    } catch (error) {
      console.error(`[NotificationCleanup] Failed to cleanup ${handlerType} handler:`, error);
    }
  }

  /**
   * Restart all notification handlers
   * Called after re-authentication
   */
  async restartAllHandlers(): Promise<void> {
    console.log('[NotificationCleanup] Restarting all notification handlers...');

    const startTasks: Promise<void>[] = [];

    // Start challenge notifications
    try {
      startTasks.push(challengeNotificationHandler.startListening());
      console.log('[NotificationCleanup] Starting challenge notifications...');
    } catch (error) {
      console.error('[NotificationCleanup] Failed to start challenge notifications:', error);
    }

    // Start challenge response notifications
    try {
      startTasks.push(challengeResponseHandler.startListening());
      console.log('[NotificationCleanup] Starting challenge response notifications...');
    } catch (error) {
      console.error('[NotificationCleanup] Failed to start challenge response notifications:', error);
    }

    // Start team join notifications
    try {
      startTasks.push(teamJoinNotificationHandler.startListening());
      console.log('[NotificationCleanup] Starting team join notifications...');
    } catch (error) {
      console.error('[NotificationCleanup] Failed to start team join notifications:', error);
    }

    // Start event join notifications
    try {
      startTasks.push(eventJoinNotificationHandler.startListening());
      console.log('[NotificationCleanup] Starting event join notifications...');
    } catch (error) {
      console.error('[NotificationCleanup] Failed to start event join notifications:', error);
    }

    // Start Nostr competition event notifications
    try {
      const nostrEventHandler = NostrNotificationEventHandler.getInstance();
      startTasks.push(nostrEventHandler.startListening());
      console.log('[NotificationCleanup] Starting Nostr competition event notifications...');
    } catch (error) {
      console.error('[NotificationCleanup] Failed to start Nostr event notifications:', error);
    }

    // Wait for all start tasks to complete
    await Promise.allSettled(startTasks);

    console.log('[NotificationCleanup] ✅ Restart complete');
  }

  /**
   * Get status of all handlers
   */
  getHandlerStatuses(): {
    challenge: any;
    challengeResponse: any;
    teamJoin: any;
    eventJoin: any;
    nostrEvent: any;
  } {
    return {
      challenge: {
        notificationCount: challengeNotificationHandler.getNotifications().length,
        unreadCount: challengeNotificationHandler.getUnreadCount(),
      },
      challengeResponse: {
        notificationCount: challengeResponseHandler.getNotifications().length,
        unreadCount: challengeResponseHandler.getUnreadCount(),
        status: challengeResponseHandler.getStatus(),
      },
      teamJoin: {
        notificationCount: teamJoinNotificationHandler.getNotifications().length,
        unreadCount: teamJoinNotificationHandler.getUnreadCount(),
        status: teamJoinNotificationHandler.getStatus(),
      },
      eventJoin: {
        notificationCount: eventJoinNotificationHandler.getNotifications().length,
        unreadCount: eventJoinNotificationHandler.getUnreadCount(),
      },
      nostrEvent: NostrNotificationEventHandler.getInstance().getStatus(),
    };
  }
}

export const notificationCleanupService = NotificationCleanupService.getInstance();