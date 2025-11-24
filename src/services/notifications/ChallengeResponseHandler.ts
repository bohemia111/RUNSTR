/**
 * ChallengeResponseHandler - Handles challenge response notifications
 * Processes kinds 1106 (accepts) and 1107 (declines)
 * Notifies challenge creators when their challenges are accepted/declined
 */

import { GlobalNDKService } from '../nostr/GlobalNDKService';
import type { NDKSubscription, NDKEvent } from '@nostr-dev-kit/ndk';
import { getCachedProfile } from './profileHelper';
import { getUserNostrIdentifiers } from '../../utils/nostr';
import { unifiedNotificationStore } from './UnifiedNotificationStore';
import {
  CHALLENGE_ACCEPT_KIND,
  CHALLENGE_DECLINE_KIND,
} from '../../types/challenge';
import type { ChallengeNotificationMetadata } from '../../types/unifiedNotifications';
import { TTLDeduplicator } from '../../utils/TTLDeduplicator';

export interface ChallengeResponseNotification {
  id: string;
  type: 'accepted' | 'declined';
  challengeId: string;
  responderPubkey: string;
  responderName?: string;
  responderPicture?: string;
  declineReason?: string;
  timestamp: number;
  read: boolean;
  nostrEventId: string;
}

export type ChallengeResponseCallback = (
  notification: ChallengeResponseNotification
) => void;

export class ChallengeResponseHandler {
  private static instance: ChallengeResponseHandler;
  private notifications: Map<string, ChallengeResponseNotification> = new Map();
  private callbacks: Set<ChallengeResponseCallback> = new Set();
  private subscription: NDKSubscription | null = null;
  private isActive: boolean = false;
  private deduplicator = new TTLDeduplicator(3600000, 1000); // 1hr TTL, 1000 max entries
  private userHexPubkey: string | null = null;

  private constructor() {}

  static getInstance(): ChallengeResponseHandler {
    if (!ChallengeResponseHandler.instance) {
      ChallengeResponseHandler.instance = new ChallengeResponseHandler();
    }
    return ChallengeResponseHandler.instance;
  }

  /**
   * Start listening for challenge response events
   */
  async startListening(): Promise<void> {
    if (this.isActive) {
      console.log('[ChallengeResponseHandler] Already active');
      return;
    }

    console.log('[ChallengeResponseHandler] Starting monitoring...');

    try {
      const userIdentifiers = await getUserNostrIdentifiers();
      if (!userIdentifiers?.hexPubkey) {
        console.warn(
          '[ChallengeResponseHandler] User not authenticated, cannot start'
        );
        return;
      }

      this.userHexPubkey = userIdentifiers.hexPubkey;

      // Get NDK instance
      const ndk = await GlobalNDKService.getInstance();

      // Subscribe to challenge responses where user is the original challenger
      // These events tag the original challenger with 'p' tag
      this.subscription = ndk.subscribe(
        {
          kinds: [CHALLENGE_ACCEPT_KIND, CHALLENGE_DECLINE_KIND],
          '#p': [this.userHexPubkey], // User is tagged as original challenger
        },
        { closeOnEose: false }
      );

      // Handle incoming events
      this.subscription.on('event', async (ndkEvent: NDKEvent) => {
        await this.handleChallengeResponse(ndkEvent);
      });

      this.isActive = true;
      console.log('[ChallengeResponseHandler] ✅ Monitoring active');
    } catch (error) {
      console.error(
        '[ChallengeResponseHandler] Failed to start monitoring:',
        error
      );
      throw error;
    }
  }

  /**
   * Stop listening for challenge response events
   */
  async stopListening(): Promise<void> {
    console.log('[ChallengeResponseHandler] Stopping monitoring...');

    if (this.subscription) {
      try {
        this.subscription.stop();
        this.subscription = null;
      } catch (error) {
        console.warn(
          '[ChallengeResponseHandler] Failed to stop subscription:',
          error
        );
      }
    }

    this.isActive = false;
    this.deduplicator.clear();

    console.log('[ChallengeResponseHandler] ✅ Monitoring stopped');
  }

  /**
   * Handle incoming challenge response event
   */
  private async handleChallengeResponse(ndkEvent: NDKEvent): Promise<void> {
    try {
      // Prevent duplicate processing
      if (!ndkEvent.id || this.deduplicator.isDuplicate(ndkEvent.id)) {
        return;
      }

      const isAccept = ndkEvent.kind === CHALLENGE_ACCEPT_KIND;

      console.log(
        `[ChallengeResponseHandler] Processing challenge ${
          isAccept ? 'acceptance' : 'decline'
        }: ${ndkEvent.id}`
      );

      // Parse event tags to get challenge info
      const challengeIdTag = ndkEvent.tags.find((t) => t[0] === 'e');
      const challengeId = challengeIdTag?.[1];

      if (!challengeId) {
        console.warn(
          '[ChallengeResponseHandler] Missing challenge ID in event'
        );
        return;
      }

      // Get responder info
      const responderPubkey = ndkEvent.pubkey;
      const responderProfile = await getCachedProfile(responderPubkey);

      // Create notification
      const notification: ChallengeResponseNotification = {
        id: ndkEvent.id,
        type: isAccept ? 'accepted' : 'declined',
        challengeId,
        responderPubkey,
        responderName:
          responderProfile?.display_name ||
          responderProfile?.name ||
          'Unknown User',
        responderPicture: responderProfile?.picture,
        declineReason: !isAccept ? ndkEvent.content : undefined,
        timestamp: (ndkEvent.created_at || Date.now() / 1000) * 1000,
        read: false,
        nostrEventId: ndkEvent.id,
      };

      // Add to local store
      this.notifications.set(notification.id, notification);
      this.notifyCallbacks(notification);

      // Publish to unified notification store
      await this.publishToUnifiedStore(notification);

      console.log(
        `[ChallengeResponseHandler] ✅ Challenge ${
          isAccept ? 'accepted' : 'declined'
        } by ${notification.responderName}`
      );
    } catch (error) {
      console.error(
        '[ChallengeResponseHandler] Failed to process response:',
        error
      );
    }
  }

  /**
   * Publish notification to unified store
   */
  private async publishToUnifiedStore(
    notification: ChallengeResponseNotification
  ): Promise<void> {
    try {
      const metadata: ChallengeNotificationMetadata = {
        challengeId: notification.challengeId,
        challengerPubkey: notification.responderPubkey,
        challengerName: notification.responderName,
        challengerPicture: notification.responderPicture,
      };

      if (notification.type === 'accepted') {
        await unifiedNotificationStore.addNotification(
          'challenge_accepted',
          'Challenge Accepted! 🎯',
          `${notification.responderName} accepted your challenge`,
          metadata,
          {
            icon: 'checkmark-circle',
            actions: [
              {
                id: 'view',
                type: 'view_challenge',
                label: 'View Challenge',
                isPrimary: true,
              },
            ],
            nostrEventId: notification.nostrEventId,
          }
        );
      } else {
        await unifiedNotificationStore.addNotification(
          'challenge_declined',
          'Challenge Declined',
          `${notification.responderName} declined your challenge${
            notification.declineReason ? ': ' + notification.declineReason : ''
          }`,
          metadata,
          {
            icon: 'close-circle',
            actions: [
              {
                id: 'create_new',
                type: 'create_challenge',
                label: 'Create New Challenge',
                isPrimary: true,
              },
            ],
            nostrEventId: notification.nostrEventId,
          }
        );
      }

      console.log(
        '[ChallengeResponseHandler] Published to unified store:',
        notification.id
      );
    } catch (error) {
      console.error(
        '[ChallengeResponseHandler] Failed to publish to unified store:',
        error
      );
    }
  }

  /**
   * Register callback for new notifications
   */
  onNotification(callback: ChallengeResponseCallback): () => void {
    this.callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Notify all registered callbacks
   */
  private notifyCallbacks(notification: ChallengeResponseNotification): void {
    this.callbacks.forEach((callback) => {
      try {
        callback(notification);
      } catch (error) {
        console.error('[ChallengeResponseHandler] Error in callback:', error);
      }
    });
  }

  /**
   * Get all notifications
   */
  getNotifications(): ChallengeResponseNotification[] {
    return Array.from(this.notifications.values()).sort(
      (a, b) => b.timestamp - a.timestamp
    );
  }

  /**
   * Get unread notification count
   */
  getUnreadCount(): number {
    return Array.from(this.notifications.values()).filter((n) => !n.read)
      .length;
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): void {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.read = true;
      this.notifications.set(notificationId, notification);
    }
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): void {
    this.notifications.forEach((notification) => {
      notification.read = true;
    });
  }

  /**
   * Remove a notification
   */
  removeNotification(notificationId: string): void {
    this.notifications.delete(notificationId);
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    this.notifications.clear();
    console.log('[ChallengeResponseHandler] All notifications cleared');
  }

  /**
   * Get handler status
   */
  getStatus(): {
    isActive: boolean;
    notificationCount: number;
    processedEventCount: number;
  } {
    return {
      isActive: this.isActive,
      notificationCount: this.notifications.size,
      processedEventCount: this.deduplicator.getStats().size,
    };
  }
}

export const challengeResponseHandler = ChallengeResponseHandler.getInstance();
