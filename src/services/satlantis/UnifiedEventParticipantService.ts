/**
 * UnifiedEventParticipantService - Unified participant handling for Satlantis events
 *
 * This service replaces RSVP-based participant tracking with a simpler local-first approach:
 * - Users must click "Join" to participate (stored locally)
 * - Season II participants are public (visible to all)
 * - Non-Season II participants are private (visible only to themselves)
 *
 * Key Features:
 * - Local AsyncStorage for join tracking (instant, no relay dependencies)
 * - Season II integration for public visibility
 * - Privacy model: Season II = public, others = private
 * - Workout filtering by joined participants only
 *
 * Usage:
 * ```typescript
 * // Check if user is Season II (public visibility)
 * const isPublic = UnifiedEventParticipantService.isPublicParticipant(pubkey);
 *
 * // Get pubkeys for leaderboard filtering
 * const pubkeys = await UnifiedEventParticipantService.getJoinedPubkeys(eventId, viewerPubkey);
 *
 * // Join/leave event
 * await UnifiedEventParticipantService.joinEvent(eventId, pubkey);
 * await UnifiedEventParticipantService.leaveEvent(eventId, pubkey);
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SEASON_2_PARTICIPANTS } from '../../constants/season2';

// Storage key prefix for event joins
const EVENT_JOINS_PREFIX = '@runstr:unified_event_joins:';

// Interface for event join storage
interface EventJoins {
  joinedUsers: string[]; // Array of pubkeys who clicked Join
  joinedAt: Record<string, number>; // pubkey → timestamp
}

// Participant with visibility metadata
export interface VisibleParticipant {
  pubkey: string;
  name?: string;
  picture?: string;
  isPrivate: boolean; // True if only visible to self
  joinedAt?: number;
}

// Set for fast Season II lookup
const SEASON_2_PUBKEY_SET = new Set(
  SEASON_2_PARTICIPANTS.map((p) => p.pubkey)
);

class UnifiedEventParticipantServiceClass {
  private static instance: UnifiedEventParticipantServiceClass;

  static getInstance(): UnifiedEventParticipantServiceClass {
    if (!this.instance) {
      this.instance = new UnifiedEventParticipantServiceClass();
    }
    return this.instance;
  }

  // ============================================================================
  // Public Visibility Check
  // ============================================================================

  /**
   * Check if a user is a Season II participant (public visibility)
   * Season II participants appear on leaderboards for all users
   */
  isPublicParticipant(pubkey: string): boolean {
    return SEASON_2_PUBKEY_SET.has(pubkey);
  }

  /**
   * Get Season II participant data by pubkey
   */
  getSeasonParticipantData(pubkey: string) {
    return SEASON_2_PARTICIPANTS.find((p) => p.pubkey === pubkey);
  }

  // ============================================================================
  // Join/Leave Operations (Local Storage)
  // ============================================================================

  /**
   * Join an event (stores locally)
   * @param eventId - The event's d-tag identifier
   * @param pubkey - User's hex pubkey
   */
  async joinEvent(eventId: string, pubkey: string): Promise<void> {
    try {
      const joins = await this.getEventJoins(eventId);

      // Add user if not already joined
      if (!joins.joinedUsers.includes(pubkey)) {
        joins.joinedUsers.push(pubkey);
        joins.joinedAt[pubkey] = Date.now();
        await this.saveEventJoins(eventId, joins);
        console.log(`[UnifiedParticipant] ✅ Joined event ${eventId}: ${pubkey.slice(0, 12)}...`);
      } else {
        console.log(`[UnifiedParticipant] Already joined: ${pubkey.slice(0, 12)}...`);
      }
    } catch (error) {
      console.error('[UnifiedParticipant] Error joining event:', error);
      throw error;
    }
  }

  /**
   * Leave an event (removes from local storage)
   */
  async leaveEvent(eventId: string, pubkey: string): Promise<void> {
    try {
      const joins = await this.getEventJoins(eventId);

      const index = joins.joinedUsers.indexOf(pubkey);
      if (index !== -1) {
        joins.joinedUsers.splice(index, 1);
        delete joins.joinedAt[pubkey];
        await this.saveEventJoins(eventId, joins);
        console.log(`[UnifiedParticipant] ❌ Left event ${eventId}: ${pubkey.slice(0, 12)}...`);
      }
    } catch (error) {
      console.error('[UnifiedParticipant] Error leaving event:', error);
      throw error;
    }
  }

  /**
   * Check if user has joined an event
   */
  async hasJoined(eventId: string, pubkey: string): Promise<boolean> {
    try {
      const joins = await this.getEventJoins(eventId);
      return joins.joinedUsers.includes(pubkey);
    } catch (error) {
      console.error('[UnifiedParticipant] Error checking join status:', error);
      return false;
    }
  }

  // ============================================================================
  // Participant Queries (for Leaderboard Filtering)
  // ============================================================================

  /**
   * Get all pubkeys whose workouts should appear in leaderboard
   *
   * Returns:
   * - All Season II participants who clicked Join (public)
   * - Current viewer if they clicked Join (private, but visible to self)
   *
   * @param eventId - The event's d-tag identifier
   * @param viewerPubkey - Current user's pubkey (to include their private entry)
   */
  async getJoinedPubkeys(eventId: string, viewerPubkey: string): Promise<string[]> {
    try {
      const joins = await this.getEventJoins(eventId);
      const result: string[] = [];

      for (const pubkey of joins.joinedUsers) {
        // Include if:
        // 1. Season II participant (public) OR
        // 2. Current viewer (private but visible to self)
        if (this.isPublicParticipant(pubkey) || pubkey === viewerPubkey) {
          result.push(pubkey);
        }
      }

      console.log(`[UnifiedParticipant] Joined pubkeys for ${eventId}: ${result.length} visible`);
      return result;
    } catch (error) {
      console.error('[UnifiedParticipant] Error getting joined pubkeys:', error);
      return [];
    }
  }

  /**
   * Get all joined pubkeys for an event (regardless of visibility)
   * Used for participant count display
   */
  async getAllJoinedPubkeys(eventId: string): Promise<string[]> {
    try {
      const joins = await this.getEventJoins(eventId);
      return [...joins.joinedUsers];
    } catch (error) {
      console.error('[UnifiedParticipant] Error getting all joined pubkeys:', error);
      return [];
    }
  }

  /**
   * Get participant metadata for leaderboard display
   * Includes isPrivate flag for each entry
   *
   * @param eventId - The event's d-tag identifier
   * @param viewerPubkey - Current user's pubkey
   */
  async getVisibleParticipants(
    eventId: string,
    viewerPubkey: string
  ): Promise<VisibleParticipant[]> {
    try {
      const joins = await this.getEventJoins(eventId);
      const participants: VisibleParticipant[] = [];

      for (const pubkey of joins.joinedUsers) {
        const isPublic = this.isPublicParticipant(pubkey);
        const isViewer = pubkey === viewerPubkey;

        // Only include if public OR current viewer
        if (isPublic || isViewer) {
          const seasonData = this.getSeasonParticipantData(pubkey);

          participants.push({
            pubkey,
            name: seasonData?.name,
            picture: seasonData?.picture,
            isPrivate: !isPublic && isViewer, // Private if not Season II but is viewer
            joinedAt: joins.joinedAt[pubkey],
          });
        }
      }

      console.log(`[UnifiedParticipant] Visible participants: ${participants.length}`);
      return participants;
    } catch (error) {
      console.error('[UnifiedParticipant] Error getting visible participants:', error);
      return [];
    }
  }

  /**
   * Get participant count (all joined, regardless of visibility)
   * Shows "X participants" in event cards
   */
  async getParticipantCount(eventId: string): Promise<number> {
    try {
      const joins = await this.getEventJoins(eventId);
      return joins.joinedUsers.length;
    } catch (error) {
      console.error('[UnifiedParticipant] Error getting participant count:', error);
      return 0;
    }
  }

  /**
   * Get public participant count (Season II who joined)
   * For display purposes only
   */
  async getPublicParticipantCount(eventId: string): Promise<number> {
    try {
      const joins = await this.getEventJoins(eventId);
      return joins.joinedUsers.filter((p) => this.isPublicParticipant(p)).length;
    } catch (error) {
      console.error('[UnifiedParticipant] Error getting public participant count:', error);
      return 0;
    }
  }

  // ============================================================================
  // Migration: Import existing local joins
  // ============================================================================

  /**
   * Migrate joins from SatlantisEventJoinService to this unified service
   * Called once during app initialization
   */
  async migrateFromLegacyJoins(
    eventId: string,
    legacyPubkeys: string[]
  ): Promise<void> {
    try {
      const joins = await this.getEventJoins(eventId);
      let migrated = 0;

      for (const pubkey of legacyPubkeys) {
        if (!joins.joinedUsers.includes(pubkey)) {
          joins.joinedUsers.push(pubkey);
          joins.joinedAt[pubkey] = Date.now();
          migrated++;
        }
      }

      if (migrated > 0) {
        await this.saveEventJoins(eventId, joins);
        console.log(`[UnifiedParticipant] Migrated ${migrated} legacy joins for ${eventId}`);
      }
    } catch (error) {
      console.error('[UnifiedParticipant] Error migrating legacy joins:', error);
    }
  }

  // ============================================================================
  // Storage Operations
  // ============================================================================

  /**
   * Get event joins from storage
   */
  private async getEventJoins(eventId: string): Promise<EventJoins> {
    try {
      const key = `${EVENT_JOINS_PREFIX}${eventId}`;
      const stored = await AsyncStorage.getItem(key);

      if (stored) {
        return JSON.parse(stored);
      }

      return { joinedUsers: [], joinedAt: {} };
    } catch (error) {
      console.error('[UnifiedParticipant] Error reading event joins:', error);
      return { joinedUsers: [], joinedAt: {} };
    }
  }

  /**
   * Save event joins to storage
   */
  private async saveEventJoins(eventId: string, joins: EventJoins): Promise<void> {
    try {
      const key = `${EVENT_JOINS_PREFIX}${eventId}`;
      await AsyncStorage.setItem(key, JSON.stringify(joins));
    } catch (error) {
      console.error('[UnifiedParticipant] Error saving event joins:', error);
      throw error;
    }
  }

  // ============================================================================
  // Debug Methods
  // ============================================================================

  /**
   * DEBUG: Clear all joins for an event
   */
  async debugClearEventJoins(eventId: string): Promise<void> {
    try {
      const key = `${EVENT_JOINS_PREFIX}${eventId}`;
      await AsyncStorage.removeItem(key);
      console.log(`[UnifiedParticipant] DEBUG: Cleared joins for ${eventId}`);
    } catch (error) {
      console.error('[UnifiedParticipant] DEBUG: Error clearing joins:', error);
    }
  }

  /**
   * DEBUG: Get all event joins
   */
  async debugGetEventJoins(eventId: string): Promise<EventJoins> {
    return this.getEventJoins(eventId);
  }

  /**
   * DEBUG: Force add a user to event (for testing)
   */
  async debugForceJoin(eventId: string, pubkey: string): Promise<void> {
    await this.joinEvent(eventId, pubkey);
    console.log(`[UnifiedParticipant] DEBUG: Force joined ${pubkey.slice(0, 12)}...`);
  }

  /**
   * DEBUG: Get all Season II pubkeys
   */
  debugGetSeasonIIPubkeys(): string[] {
    return Array.from(SEASON_2_PUBKEY_SET);
  }
}

// Export singleton instance
export const UnifiedEventParticipantService =
  UnifiedEventParticipantServiceClass.getInstance();
export default UnifiedEventParticipantService;
