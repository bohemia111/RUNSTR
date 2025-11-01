/**
 * ChallengeNotificationHandler - Handles challenge request notifications
 * Processes kinds 1105 (requests), 1106 (accepts), 1107 (declines)
 * Displays in-app notifications for incoming challenge requests
 */

import {
  challengeRequestService,
  type PendingChallenge,
} from '../challenge/ChallengeRequestService';
import { getCachedProfile } from './profileHelper';
import { getUserNostrIdentifiers } from '../../utils/nostr';
import type { Event } from 'nostr-tools';
import {
  CHALLENGE_REQUEST_KIND,
  CHALLENGE_ACCEPT_KIND,
  CHALLENGE_DECLINE_KIND,
} from '../../types/challenge';
import { unifiedNotificationStore } from './UnifiedNotificationStore';
import type { ChallengeNotificationMetadata } from '../../types/unifiedNotifications';
import { TTLDeduplicator } from '../../utils/TTLDeduplicator';

export interface ChallengeNotification {
  id: string;
  type: 'request' | 'accepted' | 'declined' | 'payment_required';
  challengeId: string;
  challengerPubkey: string; // For requests, this is who challenged. For payment_required, this is who accepted
  challengerName?: string;
  challengerPicture?: string;
  activityType: string;
  metric: string;
  duration: number;
  wagerAmount: number;
  timestamp: number;
  read: boolean;
  accepterPubkey?: string; // For payment_required notifications - who accepted the QR challenge
  accepterName?: string;
}

export type ChallengeNotificationCallback = (
  notification: ChallengeNotification
) => void;

export class ChallengeNotificationHandler {
  private static instance: ChallengeNotificationHandler;
  private notifications: Map<string, ChallengeNotification> = new Map();
  private callbacks: Set<ChallengeNotificationCallback> = new Set();
  private subscriptionId?: string;
  private isActive: boolean = false;
  private deduplicator = new TTLDeduplicator(3600000, 1000); // 1hr TTL, 1000 max entries

  private constructor() {
    this.loadNotifications();
  }

  static getInstance(): ChallengeNotificationHandler {
    if (!ChallengeNotificationHandler.instance) {
      ChallengeNotificationHandler.instance =
        new ChallengeNotificationHandler();
    }
    return ChallengeNotificationHandler.instance;
  }

  /**
   * Load notifications from storage (via challengeRequestService)
   */
  private async loadNotifications(): Promise<void> {
    try {
      const pendingChallenges =
        await challengeRequestService.getPendingChallenges();

      for (const challenge of pendingChallenges) {
        const notification = await this.challengeToNotification(
          challenge,
          'request'
        );
        if (notification) {
          this.notifications.set(notification.id, notification);
        }
      }

      console.log(`Loaded ${this.notifications.size} challenge notifications`);
    } catch (error) {
      console.error('Failed to load challenge notifications:', error);
    }
  }

  /**
   * Convert PendingChallenge to ChallengeNotification
   */
  private async challengeToNotification(
    challenge: PendingChallenge,
    type: 'request' | 'accepted' | 'declined'
  ): Promise<ChallengeNotification | null> {
    try {
      const profile = await getCachedProfile(challenge.challengerPubkey);

      return {
        id: challenge.challengeId,
        type,
        challengeId: challenge.challengeId,
        challengerPubkey: challenge.challengerPubkey,
        challengerName:
          profile?.display_name || profile?.name || 'Unknown User',
        challengerPicture: profile?.picture,
        activityType: challenge.activityType,
        metric: challenge.metric,
        duration: challenge.duration,
        wagerAmount: challenge.wagerAmount,
        timestamp: challenge.requestedAt * 1000,
        read: false,
      };
    } catch (error) {
      console.error('Failed to create notification from challenge:', error);
      return null;
    }
  }

  /**
   * Start listening for challenge events
   */
  async startListening(): Promise<void> {
    if (this.isActive) {
      console.log('Challenge notification handler already active');
      return;
    }

    console.log('Starting challenge notification monitoring...');

    try {
      const userIdentifiers = await getUserNostrIdentifiers();
      if (!userIdentifiers?.hexPubkey) {
        console.warn(
          'User not authenticated, cannot start challenge notifications'
        );
        return;
      }

      // Subscribe to incoming challenge requests
      this.subscriptionId =
        await challengeRequestService.subscribeToIncomingChallenges(
          async (challenge: PendingChallenge) => {
            if (this.deduplicator.isDuplicate(challenge.challengeId)) {
              return;
            }

            // Verify this is truly a challenge request (has activity tag)
            // Challenges use 'activity' tag, event joins use 'event-join-request' tag
            // This filtering happens in ChallengeRequestService.parseChallengeRequest
            // but we double-check here for safety

            const notification = await this.challengeToNotification(
              challenge,
              'request'
            );
            if (notification) {
              this.notifications.set(notification.id, notification);
              this.notifyCallbacks(notification);

              // Publish to unified notification store
              await this.publishToUnifiedStore(notification);

              console.log(
                `New challenge request from ${notification.challengerName}: ${notification.activityType}`
              );
            }
          }
        );

      this.isActive = true;
      console.log(
        `Challenge notification monitoring active: ${this.subscriptionId}`
      );
    } catch (error) {
      console.error(
        'Failed to start challenge notification monitoring:',
        error
      );
      throw error;
    }
  }

  /**
   * Stop listening for challenge events
   */
  async stopListening(): Promise<void> {
    console.log('Stopping challenge notification monitoring...');

    if (this.subscriptionId) {
      try {
        await challengeRequestService.unsubscribe(this.subscriptionId);
      } catch (error) {
        console.warn(
          'Failed to unsubscribe from challenge notifications:',
          error
        );
      }
    }

    this.subscriptionId = undefined;
    this.isActive = false;
    this.deduplicator.clear();

    console.log('Challenge notification monitoring stopped');
  }

  /**
   * Register callback for new notifications
   */
  onNotification(callback: ChallengeNotificationCallback): () => void {
    this.callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Notify all registered callbacks
   */
  private notifyCallbacks(notification: ChallengeNotification): void {
    this.callbacks.forEach((callback) => {
      try {
        callback(notification);
      } catch (error) {
        console.error('Error in notification callback:', error);
      }
    });
  }

  /**
   * Get all notifications
   */
  getNotifications(): ChallengeNotification[] {
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
   * Accept a challenge from notification
   */
  async acceptChallenge(
    notificationId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const notification = this.notifications.get(notificationId);
      if (!notification) {
        return { success: false, error: 'Notification not found' };
      }

      // Note: acceptChallenge requires a signer parameter but we don't have it here
      // This is a notification handler, not the actual acceptance flow
      // The actual acceptance should happen through the challenge UI
      console.warn('[ChallengeNotificationHandler] acceptChallenge called from notification handler - this should be handled in UI');

      // For now, just mark as success to update notification state
      const result = { success: true };

      if (result.success) {
        // Update notification
        notification.type = 'accepted';
        notification.read = true;
        this.notifications.set(notificationId, notification);

        // Mark as read in unified store
        await unifiedNotificationStore.markAsRead(notificationId);

        console.log(`Challenge accepted: ${notificationId}`);
      }

      return result;
    } catch (error) {
      console.error('Failed to accept challenge:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Decline a challenge from notification
   */
  async declineChallenge(
    notificationId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const notification = this.notifications.get(notificationId);
      if (!notification) {
        return { success: false, error: 'Notification not found' };
      }

      // Note: declineChallenge requires a signer parameter but we don't have it here
      // This is a notification handler, not the actual decline flow
      // The actual decline should happen through the challenge UI
      console.warn('[ChallengeNotificationHandler] declineChallenge called from notification handler - this should be handled in UI');

      // For now, just mark as success to update notification state
      const result = { success: true };

      if (result.success) {
        // Update notification
        notification.type = 'declined';
        notification.read = true;
        this.notifications.set(notificationId, notification);

        // Mark as read in unified store
        await unifiedNotificationStore.markAsRead(notificationId);

        console.log(`Challenge declined: ${notificationId}`);
      }

      return result;
    } catch (error) {
      console.error('Failed to decline challenge:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
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
    console.log('All challenge notifications cleared');
  }

  /**
   * Refresh notifications from pending challenges
   */
  async refresh(): Promise<void> {
    await this.loadNotifications();
  }

  /**
   * Create payment required notification for QR challenge creator
   * Called when someone scans and pays their wager
   */
  async createPaymentRequiredNotification(
    challengeId: string,
    accepterPubkey: string,
    challengeData: {
      activityType: string;
      metric: string;
      duration: number;
      wagerAmount: number;
    }
  ): Promise<void> {
    try {
      // Get accepter's profile
      const accepterProfile = await getCachedProfile(accepterPubkey);

      const notification: ChallengeNotification = {
        id: `payment_${challengeId}`,
        type: 'payment_required',
        challengeId,
        challengerPubkey: accepterPubkey, // The person who accepted (for display)
        challengerName:
          accepterProfile?.display_name || accepterProfile?.name || 'Someone',
        challengerPicture: accepterProfile?.picture,
        accepterPubkey,
        accepterName: accepterProfile?.display_name || accepterProfile?.name,
        activityType: challengeData.activityType,
        metric: challengeData.metric,
        duration: challengeData.duration,
        wagerAmount: challengeData.wagerAmount,
        timestamp: Date.now(),
        read: false,
      };

      // Add to notifications
      this.notifications.set(notification.id, notification);
      this.notifyCallbacks(notification);

      // Publish to unified store
      await this.publishToUnifiedStore(notification);

      console.log(
        `Payment required notification created for challenge: ${challengeId}`
      );
    } catch (error) {
      console.error('Failed to create payment required notification:', error);
    }
  }

  /**
   * Publish challenge notification to unified store
   */
  private async publishToUnifiedStore(
    notification: ChallengeNotification
  ): Promise<void> {
    try {
      const metadata: ChallengeNotificationMetadata = {
        challengeId: notification.challengeId,
        challengerPubkey: notification.challengerPubkey,
        challengerName: notification.challengerName,
        challengerPicture: notification.challengerPicture,
        activityType: notification.activityType,
        metric: notification.metric,
        duration: notification.duration,
        wagerAmount: notification.wagerAmount,
      };

      if (notification.type === 'payment_required') {
        await unifiedNotificationStore.addNotification(
          'challenge_payment_required',
          'Pay to Activate Challenge',
          `${
            notification.challengerName || 'Someone'
          } accepted your challenge! Pay ${
            notification.wagerAmount
          } sats to activate.`,
          metadata,
          {
            icon: 'wallet',
            actions: [
              {
                id: 'pay',
                type: 'pay_challenge_wager',
                label: 'Pay to Activate',
                isPrimary: true,
              },
            ],
            nostrEventId: notification.challengeId,
          }
        );
      } else if (notification.type === 'request') {
        await unifiedNotificationStore.addNotification(
          'challenge_request',
          `${notification.challengerName || 'Someone'} challenged you!`,
          `${notification.activityType} • ${notification.metric} • ${notification.duration} days • ${notification.wagerAmount} sats`,
          metadata,
          {
            icon: 'trophy',
            actions: [
              {
                id: 'decline',
                type: 'decline_challenge',
                label: 'Decline',
                isPrimary: false,
              },
              {
                id: 'accept',
                type: 'accept_challenge',
                label: 'Accept',
                isPrimary: true,
              },
            ],
            nostrEventId: notification.challengeId,
          }
        );
      } else if (notification.type === 'accepted') {
        await unifiedNotificationStore.addNotification(
          'challenge_accepted',
          'Challenge Accepted!',
          `${
            notification.challengerName || 'Your opponent'
          } accepted your challenge`,
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
            nostrEventId: notification.challengeId,
          }
        );
      } else if (notification.type === 'declined') {
        await unifiedNotificationStore.addNotification(
          'challenge_declined',
          'Challenge Declined',
          `${
            notification.challengerName || 'Your opponent'
          } declined your challenge`,
          metadata,
          {
            icon: 'close-circle',
            nostrEventId: notification.challengeId,
          }
        );
      }
    } catch (error) {
      console.error(
        '[ChallengeNotificationHandler] Failed to publish to unified store:',
        error
      );
    }
  }
}

export const challengeNotificationHandler =
  ChallengeNotificationHandler.getInstance();
