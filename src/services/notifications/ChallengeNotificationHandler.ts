/**
 * ChallengeNotificationHandler - Handles instant challenge notifications
 * Monitors kind 30102 events where user is tagged as participant
 * Displays in-app notifications when challenges are received
 *
 * REFACTORED: Now works with instant challenges (kind 30102) instead of request/accept flow
 */

import { getCachedProfile } from './profileHelper';
import { getUserNostrIdentifiers } from '../../utils/nostr';
import { unifiedNotificationStore } from './UnifiedNotificationStore';
import type { ChallengeNotificationMetadata } from '../../types/unifiedNotifications';
import { TTLDeduplicator } from '../../utils/TTLDeduplicator';
import { GlobalNDKService } from '../nostr/GlobalNDKService';
import type { NDKEvent, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk';
import { ChallengeService } from '../competition/ChallengeService';

export interface ChallengeNotification {
  id: string;
  type: 'challenge_received';
  challengeId: string;
  challengerPubkey: string; // Creator of the challenge
  challengerName?: string;
  challengerPicture?: string;
  challengeName: string;
  distance: number; // km
  duration: number; // hours
  wagerAmount: number;
  timestamp: number;
  read: boolean;
}

export type ChallengeNotificationCallback = (
  notification: ChallengeNotification
) => void;

export class ChallengeNotificationHandler {
  private static instance: ChallengeNotificationHandler;
  private notifications: Map<string, ChallengeNotification> = new Map();
  private callbacks: Set<ChallengeNotificationCallback> = new Set();
  private subscription?: NDKSubscription;
  private isActive: boolean = false;
  private deduplicator = new TTLDeduplicator(3600000, 1000); // 1hr TTL, 1000 max entries

  private constructor() {
    // Load notifications asynchronously without blocking constructor
    this.loadNotifications().catch((error) => {
      console.error(
        '[ChallengeNotificationHandler] Failed to load notifications in constructor:',
        error
      );
    });
  }

  static getInstance(): ChallengeNotificationHandler {
    if (!ChallengeNotificationHandler.instance) {
      ChallengeNotificationHandler.instance =
        new ChallengeNotificationHandler();
    }
    return ChallengeNotificationHandler.instance;
  }

  /**
   * Load notifications from existing challenges
   */
  private async loadNotifications(): Promise<void> {
    try {
      const userIdentifiers = await getUserNostrIdentifiers();
      if (!userIdentifiers?.hexPubkey) {
        console.log('No user authenticated, skipping notification load');
        return;
      }

      // Get all user's challenges
      const challengeService = ChallengeService.getInstance();
      const challenges = await challengeService.getUserChallenges(
        userIdentifiers.hexPubkey
      );

      console.log(`Found ${challenges.length} existing challenges`);

      for (const challenge of challenges) {
        // Only show challenges where user was challenged (not creator)
        if (challenge.creatorPubkey !== userIdentifiers.hexPubkey) {
          const notification = await this.challengeEventToNotification(
            challenge.id,
            challenge.creatorPubkey,
            challenge.name,
            challenge.distance,
            challenge.duration / 24, // Convert hours to days for display
            challenge.wager,
            challenge.createdAt
          );

          if (notification) {
            this.notifications.set(notification.id, notification);
          }
        }
      }

      console.log(`Loaded ${this.notifications.size} challenge notifications`);
    } catch (error) {
      console.error('Failed to load challenge notifications:', error);
    }
  }

  /**
   * Convert challenge data to ChallengeNotification
   */
  private async challengeEventToNotification(
    challengeId: string,
    challengerPubkey: string,
    challengeName: string,
    distance: number,
    duration: number,
    wagerAmount: number,
    createdAt: number
  ): Promise<ChallengeNotification | null> {
    try {
      const profile = await getCachedProfile(challengerPubkey);

      return {
        id: challengeId,
        type: 'challenge_received',
        challengeId,
        challengerPubkey,
        challengerName:
          profile?.display_name || profile?.name || 'Unknown User',
        challengerPicture: profile?.picture,
        challengeName,
        distance,
        duration,
        wagerAmount,
        timestamp: createdAt * 1000,
        read: false,
      };
    } catch (error) {
      console.error('Failed to create notification from challenge:', error);
      return null;
    }
  }

  /**
   * Parse kind 30102 event into notification
   */
  private async parseKind30102Event(
    event: NDKEvent
  ): Promise<ChallengeNotification | null> {
    try {
      const tags = new Map(event.tags.map((t) => [t[0], t[1]]));

      const challengeId = tags.get('d') || '';
      const challengeName = tags.get('name') || 'Challenge';
      const distance = parseFloat(tags.get('distance') || '5');
      const durationHours = parseInt(tags.get('duration') || '24');
      const wagerAmount = parseInt(tags.get('wager') || '0');
      const creatorPubkey = event.pubkey;

      return await this.challengeEventToNotification(
        challengeId,
        creatorPubkey,
        challengeName,
        distance,
        durationHours,
        wagerAmount,
        event.created_at || Math.floor(Date.now() / 1000)
      );
    } catch (error) {
      console.error('Failed to parse kind 30102 event:', error);
      return null;
    }
  }

  /**
   * Start listening for challenge events where user is tagged
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

      const ndk = await GlobalNDKService.getInstance();

      // Subscribe to kind 30102 events where user is in 'p' tags
      const filter: NDKFilter = {
        kinds: [30102],
        '#p': [userIdentifiers.hexPubkey],
      };

      console.log('Subscribing to kind 30102 challenges with filter:', filter);

      // v0.6.8: Re-enabled with proper lifecycle management
      this.subscription = ndk.subscribe(filter, { closeOnEose: false });

      this.subscription.on('event', async (event: NDKEvent) => {
        // Check if app is active before processing events
        const { AppStateManager } = await import('../core/AppStateManager');
        if (!AppStateManager.canDoNetworkOps()) {
          console.log(
            '🔴 App backgrounded, skipping challenge event processing'
          );
          return;
        }

        const challengeId = event.tags.find((t) => t[0] === 'd')?.[1];
        if (!challengeId) {
          console.warn('kind 30102 event missing d-tag:', event.id);
          return;
        }

        // Skip if already seen
        if (this.deduplicator.isDuplicate(challengeId)) {
          return;
        }

        // Skip if user is the creator (don't notify yourself)
        if (event.pubkey === userIdentifiers.hexPubkey) {
          console.log(`Skipping self-created challenge: ${challengeId}`);
          return;
        }

        console.log(`📬 New challenge received: ${challengeId}`);

        const notification = await this.parseKind30102Event(event);
        if (notification) {
          this.notifications.set(notification.id, notification);
          this.notifyCallbacks(notification);

          // Publish to unified notification store
          await this.publishToUnifiedStore(notification);

          console.log(
            `✅ Challenge notification from ${notification.challengerName}: ${notification.challengeName}`
          );
        }
      });

      this.isActive = true;
      console.log('Challenge notification monitoring active');
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

    if (this.subscription) {
      try {
        this.subscription.stop();
      } catch (error) {
        console.warn(
          'Failed to unsubscribe from challenge notifications:',
          error
        );
      }
    }

    this.subscription = undefined;
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
   * Refresh notifications from existing challenges
   */
  async refresh(): Promise<void> {
    await this.loadNotifications();
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
        activityType: 'running', // All challenges are running for now
        metric: 'fastest_time',
        duration: notification.duration,
        wagerAmount: notification.wagerAmount,
      };

      await unifiedNotificationStore.addNotification(
        'challenge_received',
        `${notification.challengerName || 'Someone'} challenged you!`,
        `${notification.challengeName} • ${notification.distance} km • ${
          notification.duration
        }h${
          notification.wagerAmount > 0
            ? ` • ${notification.wagerAmount} sats`
            : ''
        }`,
        metadata,
        {
          icon: 'trophy',
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
