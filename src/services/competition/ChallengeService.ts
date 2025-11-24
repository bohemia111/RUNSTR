/**
 * ChallengeService - SIMPLIFIED
 * Manages 1v1 running challenges using kind 30102 events with participant tags
 * - 4 distances: 5K, 10K, Half Marathon, Marathon
 * - 1-day duration (24 hours) only
 * - Fastest time scoring only
 * - Instant creation (no acceptance flow)
 * - Participants stored in 'p' tags (no kind 30000 lists)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ChallengeMetadata,
  ChallengeStatus,
  ChallengeLeaderboard,
  ChallengeParticipant,
} from '../../types/challenge';
import { getUserNostrIdentifiers } from '../../utils/nostr';
import { Competition1301QueryService } from './Competition1301QueryService';
import type { Kind1301Event } from '../season/Season1Service';
import { GlobalNDKService } from '../nostr/GlobalNDKService';
import { NDKEvent, type NDKSigner, type NDKFilter } from '@nostr-dev-kit/ndk';
import type { NostrChallengeDefinition } from '../../types/nostrCompetition';

export class ChallengeService {
  private static instance: ChallengeService;
  private queryService: Competition1301QueryService;
  private readonly STORAGE_KEY_PREFIX = '@runstr:challenge:';

  constructor() {
    this.queryService = Competition1301QueryService.getInstance();
  }

  static getInstance(): ChallengeService {
    if (!ChallengeService.instance) {
      ChallengeService.instance = new ChallengeService();
    }
    return ChallengeService.instance;
  }

  /**
   * Publish kind 30102 challenge definition to Nostr
   * @param challengeData - Challenge configuration
   * @param signer - NDK signer for signing the event
   * @returns Challenge ID and published event
   */
  async publishChallengeDefinition(
    challengeData: {
      name: string;
      distance: number; // 5, 10, or 21.1 km
      duration: number; // hours (24, 48, or 168)
      wager: number; // sats
      opponentPubkey?: string; // Optional for direct challenges
    },
    signer: NDKSigner
  ): Promise<{ success: boolean; challengeId: string; event?: NDKEvent }> {
    try {
      const ndk = await GlobalNDKService.getInstance();

      // Generate unique challenge ID
      const challengeId = `challenge_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}`;

      // Calculate timestamps
      const startDate = new Date();
      const endDate = new Date(
        startDate.getTime() + challengeData.duration * 60 * 60 * 1000
      );

      // Get creator pubkey from signer
      const creatorPubkey = signer.user?.pubkey || '';
      if (!creatorPubkey) {
        throw new Error('No pubkey available from signer');
      }

      // Build tags
      const tags: string[][] = [
        ['d', challengeId],
        ['name', challengeData.name],
        ['activity', 'running'],
        ['distance', challengeData.distance.toString()],
        ['metric', 'fastest_time'],
        ['duration', challengeData.duration.toString()],
        ['start_date', startDate.toISOString()],
        ['end_date', endDate.toISOString()],
        ['wager', challengeData.wager.toString()],
        ['max_participants', '2'],
        ['status', 'open'],
        ['p', creatorPubkey], // Creator tagged as participant
      ];

      // If opponent specified, add them as participant
      if (challengeData.opponentPubkey) {
        tags.push(['p', challengeData.opponentPubkey]);
      }

      // Create kind 30102 event
      const event = new NDKEvent(ndk);
      event.kind = 30102;
      event.content = `${challengeData.name} - ${challengeData.duration}h`;
      event.tags = tags;

      await event.sign(signer);
      await event.publish();

      console.log(`✅ Published challenge definition: ${challengeId}`);

      return { success: true, challengeId, event };
    } catch (error) {
      console.error('Error publishing challenge definition:', error);
      return {
        success: false,
        challengeId: '',
      };
    }
  }

  /**
   * Fetch kind 30102 challenge event by d-tag
   * @param challengeId - Challenge d-tag identifier
   * @returns Challenge event or null if not found
   */
  async getChallengeEvent(challengeId: string): Promise<NDKEvent | null> {
    try {
      const ndk = await GlobalNDKService.getInstance();

      const filter: NDKFilter = {
        kinds: [30102],
        '#d': [challengeId],
        limit: 1,
      };

      const events = await ndk.fetchEvents(filter);
      const eventArray = Array.from(events);

      if (eventArray.length === 0) {
        console.log(`Challenge not found: ${challengeId}`);
        return null;
      }

      return eventArray[0];
    } catch (error) {
      console.error('Error fetching challenge event:', error);
      return null;
    }
  }

  /**
   * Extract participant pubkeys from challenge 'p' tags
   * @param challengeEvent - Kind 30102 challenge event
   * @returns Array of participant pubkeys
   */
  private extractParticipants(challengeEvent: NDKEvent): string[] {
    return challengeEvent.tags
      .filter((tag) => tag[0] === 'p')
      .map((tag) => tag[1])
      .filter(Boolean);
  }

  /**
   * Parse kind 30102 challenge event into NostrChallengeDefinition
   * @param event - Kind 30102 challenge event
   * @returns Parsed challenge definition
   */
  private parseChallengeEvent(
    event: NDKEvent
  ): NostrChallengeDefinition | null {
    try {
      const tags = new Map(event.tags.map((t) => [t[0], t[1]]));
      const participants = this.extractParticipants(event);

      return {
        id: tags.get('d') || '',
        creatorPubkey: event.pubkey,
        name: tags.get('name') || 'Unnamed Challenge',
        description: event.content,
        activityType: 'running',
        distance: parseFloat(tags.get('distance') || '5'),
        metric: 'fastest_time',
        startDate: tags.get('start_date') || new Date().toISOString(),
        endDate:
          tags.get('end_date') ||
          new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        duration: 24,
        participants,
        maxParticipants: 2,
        wager: parseInt(tags.get('wager') || '0'),
        status: (tags.get('status') as any) || 'open',
        createdAt: event.created_at || Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      console.error('Error parsing challenge event:', error);
      return null;
    }
  }

  /**
   * DEPRECATED: Create a new challenge using kind 30000 lists
   * Use publishChallengeDefinition() instead for instant challenges
   * @deprecated
   */
  async createChallenge(
    metadata: Omit<ChallengeMetadata, 'id' | 'status' | 'createdAt'>,
    creatorPubkey?: string
  ): Promise<string> {
    const challengeId = `challenge-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const now = Math.floor(Date.now() / 1000);

    // Get user's identifiers
    const userIdentifiers = await getUserNostrIdentifiers();
    if (!userIdentifiers?.hexPubkey) {
      throw new Error('User not authenticated');
    }

    // Use provided creator or default to current user
    const listCreator = creatorPubkey || userIdentifiers.hexPubkey;

    const fullMetadata: ChallengeMetadata = {
      ...metadata,
      id: challengeId,
      status: ChallengeStatus.ACTIVE, // Changed from PENDING - active when list is created
      createdAt: now,
      challengerPubkey: metadata.challengerPubkey || userIdentifiers.hexPubkey,
    };

    // Store challenge metadata locally
    await this.storeChallengeLocally(fullMetadata);

    // Prepare kind 30000 list for the challenge
    // Include both participants if challenged pubkey is provided
    const members = metadata.challengedPubkey
      ? [metadata.challengerPubkey, metadata.challengedPubkey]
      : [userIdentifiers.hexPubkey];

    const listData: ListCreationData = {
      name: metadata.name,
      description:
        metadata.description ||
        `${metadata.activity} challenge for ${metadata.wager} sats`,
      members,
      dTag: challengeId,
      listType: 'people',
    };

    // Create the list event template (needs external signing)
    const listEvent = this.listService.prepareListCreation(
      listData,
      listCreator
    );

    // Add challenge-specific tags
    if (listEvent) {
      listEvent.tags.push(
        ['t', 'challenge'],
        ['t', 'fitness'],
        ['t', 'competition'],
        ['t', metadata.activity],
        ['activity', metadata.activity],
        ['metric', metadata.metric],
        ['wager', metadata.wager.toString()],
        ['status', 'pending'],
        ['starts', metadata.startsAt.toString()],
        ['expires', metadata.expiresAt.toString()]
      );

      if (metadata.target) {
        listEvent.tags.push(['target', metadata.target]);
      }
    }

    console.log(`✅ Created challenge: ${challengeId}`);
    return challengeId;
  }

  /**
   * Get challenge metadata
   */
  async getChallenge(challengeId: string): Promise<ChallengeMetadata | null> {
    try {
      // Try local storage first
      const local = await this.getChallengeFromLocal(challengeId);
      if (local) return local;

      // Try to reconstruct from Nostr list
      const userIdentifiers = await getUserNostrIdentifiers();
      if (!userIdentifiers?.hexPubkey) return null;

      // Query for the challenge list
      const lists = await this.listService.getListsContainingUser(
        userIdentifiers.hexPubkey,
        {
          tags: ['challenge'],
        }
      );

      const challengeList = lists.find((list) => list.dTag === challengeId);
      if (!challengeList) return null;

      return this.reconstructChallengeFromList(challengeList);
    } catch (error) {
      console.error('Error getting challenge:', error);
      return null;
    }
  }

  /**
   * Get challenge leaderboard (tag-based)
   * Uses 'p' tags from kind 30102 event to identify participants
   */
  async getChallengeLeaderboard(
    challengeId: string
  ): Promise<ChallengeLeaderboard | null> {
    try {
      // Fetch kind 30102 challenge event
      const challengeEvent = await this.getChallengeEvent(challengeId);
      if (!challengeEvent) {
        console.log(`Challenge event not found: ${challengeId}`);
        return null;
      }

      // Extract participants from 'p' tags
      const participants = this.extractParticipants(challengeEvent);
      if (participants.length === 0) {
        console.log('No participants in challenge');
        return null;
      }

      // Parse challenge metadata
      const tags = new Map(challengeEvent.tags.map((t) => [t[0], t[1]]));
      const startDate = tags.get('start_date') || new Date().toISOString();
      const endDate =
        tags.get('end_date') ||
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const startTime = Math.floor(new Date(startDate).getTime() / 1000);
      const endTime = Math.floor(new Date(endDate).getTime() / 1000);

      const participantProgress: ChallengeParticipant[] = [];

      for (const pubkey of participants) {
        // Get workouts for this participant (running only)
        const workouts = await this.queryService.queryUserWorkouts(
          pubkey,
          startTime,
          endTime,
          'running'
        );

        // Calculate progress based on metric (fastest time for running)
        const progress = this.calculateProgress(workouts, 'fastest_time');

        participantProgress.push({
          pubkey,
          name: pubkey.slice(0, 8) + '...', // Will be replaced with actual name
          currentProgress: progress.value,
          lastWorkoutAt: progress.lastWorkoutAt,
          workoutCount: workouts.length,
        });
      }

      // Sort by progress (for fastest_time, lower is better)
      participantProgress.sort((a, b) => {
        // Handle cases where no workouts yet (value = 0)
        if (a.currentProgress === 0) return 1; // Move to end
        if (b.currentProgress === 0) return -1; // Move to end
        return a.currentProgress - b.currentProgress; // Lower time = better
      });

      // Determine leader and if tied
      const leader = participantProgress[0]?.pubkey;
      const tied =
        participantProgress.length > 1 &&
        participantProgress[0].currentProgress > 0 &&
        participantProgress[0].currentProgress ===
          participantProgress[1].currentProgress;

      return {
        challengeId,
        participants: participantProgress,
        metric: 'fastest_time',
        target: parseFloat(tags.get('distance') || '5'),
        wager: parseInt(tags.get('wager') || '0'),
        status:
          (tags.get('status') as ChallengeStatus) || ChallengeStatus.ACTIVE,
        startsAt: startTime,
        expiresAt: endTime,
        leader,
        tied,
      };
    } catch (error) {
      console.error('Error calculating challenge leaderboard:', error);
      return null;
    }
  }

  /**
   * Update challenge status
   */
  async updateChallengeStatus(
    challengeId: string,
    status: ChallengeStatus,
    winnerId?: string
  ): Promise<void> {
    const challenge = await this.getChallenge(challengeId);
    if (!challenge) {
      throw new Error('Challenge not found');
    }

    challenge.status = status;

    // If this is a completion with a winner, store the winner ID
    if (winnerId && status === ChallengeStatus.COMPLETED) {
      challenge.winnerId = winnerId;
    }

    await this.storeChallengeLocally(challenge);

    console.log(
      `✅ Updated challenge ${challengeId} status to ${status}${
        winnerId ? ` (winner: ${winnerId.slice(0, 8)}...)` : ''
      }`
    );
  }

  /**
   * Add participant to challenge (after acceptance)
   */
  async addParticipant(
    challengeId: string,
    participantPubkey: string
  ): Promise<void> {
    const userIdentifiers = await getUserNostrIdentifiers();
    if (!userIdentifiers?.hexPubkey) {
      throw new Error('User not authenticated');
    }

    // Get current list
    const list = await this.listService.getList(
      userIdentifiers.hexPubkey,
      challengeId
    );
    if (!list) {
      throw new Error('Challenge list not found');
    }

    // Prepare updated list with new participant
    const updatedListEvent = this.listService.prepareAddMember(
      userIdentifiers.hexPubkey,
      challengeId,
      participantPubkey,
      list
    );

    if (updatedListEvent) {
      // Update status to active
      updatedListEvent.tags = updatedListEvent.tags.map((tag) =>
        tag[0] === 'status' ? ['status', 'active'] : tag
      );
    }

    // Note: Actual publishing needs to be done externally with signing
    console.log(
      `✅ Prepared to add participant ${participantPubkey} to challenge ${challengeId}`
    );
  }

  /**
   * Calculate progress based on metric
   * SIMPLIFIED: Supports fastest_time for running challenges only
   */
  private calculateProgress(
    workouts: Kind1301Event[],
    metric: string
  ): { value: number; lastWorkoutAt?: number } {
    if (workouts.length === 0) {
      return { value: 0 };
    }

    let value = 0;
    let lastWorkoutAt = 0;

    switch (metric) {
      case 'fastest_time':
        // For running challenges - find fastest time (seconds)
        // Filter for workouts with valid duration
        const validTimes = workouts
          .map((w) => this.extractDuration(w))
          .filter((t) => t > 0);

        if (validTimes.length > 0) {
          value = Math.min(...validTimes); // Lowest time = fastest
        }
        break;

      case 'distance':
        // Sum total distance (legacy support)
        value = workouts.reduce((sum, w) => {
          const distance = this.extractDistance(w);
          return sum + distance;
        }, 0);
        break;

      case 'duration':
        // Sum total duration in seconds (legacy support)
        value = workouts.reduce((sum, w) => {
          const duration = this.extractDuration(w);
          return sum + duration;
        }, 0);
        break;

      case 'count':
        // Count of workouts (legacy support)
        value = workouts.length;
        break;

      default:
        console.warn(`Unsupported metric: ${metric}. Using count.`);
        value = workouts.length;
        break;
    }

    // Get timestamp of last workout
    if (workouts.length > 0) {
      lastWorkoutAt = Math.max(...workouts.map((w) => w.created_at || 0));
    }

    return { value, lastWorkoutAt };
  }

  private extractDistance(workout: Kind1301Event): number {
    const distanceTag = workout.tags?.find((t) => t[0] === 'distance');
    if (distanceTag && distanceTag[1]) {
      const value = parseFloat(distanceTag[1]);
      const unit = distanceTag[2] || 'km';
      // Convert to meters for standardization
      if (unit === 'km') return value * 1000;
      if (unit === 'mi') return value * 1609.34;
      return value; // Assume meters
    }
    return 0;
  }

  private extractDuration(workout: Kind1301Event): number {
    const durationTag = workout.tags?.find((t) => t[0] === 'duration');
    if (durationTag && durationTag[1]) {
      // Parse HH:MM:SS format
      const parts = durationTag[1].split(':');
      if (parts.length === 3) {
        return (
          parseInt(parts[0]) * 3600 +
          parseInt(parts[1]) * 60 +
          parseInt(parts[2])
        );
      }
    }
    return 0;
  }

  /**
   * Store challenge locally
   */
  private async storeChallengeLocally(
    challenge: ChallengeMetadata
  ): Promise<void> {
    const key = `${this.STORAGE_KEY_PREFIX}${challenge.id}`;
    await AsyncStorage.setItem(key, JSON.stringify(challenge));
  }

  /**
   * Get challenge from local storage
   */
  private async getChallengeFromLocal(
    challengeId: string
  ): Promise<ChallengeMetadata | null> {
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${challengeId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error reading challenge from storage:', error);
      return null;
    }
  }

  /**
   * Reconstruct challenge metadata from Nostr list
   */
  private reconstructChallengeFromList(list: any): ChallengeMetadata {
    const tags = new Map(list.tags.map((t: string[]) => [t[0], t[1]]));

    return {
      id: list.dTag,
      name: list.name,
      description: list.description,
      activity: (tags.get('activity') as any) || 'running',
      metric: (tags.get('metric') as any) || 'distance',
      target: tags.get('target'),
      wager: parseInt(tags.get('wager') || '0'),
      status:
        (tags.get('status') as ChallengeStatus) || ChallengeStatus.PENDING,
      createdAt: list.createdAt,
      startsAt: parseInt(tags.get('starts') || '0'),
      expiresAt: parseInt(tags.get('expires') || '0'),
      challengerPubkey: list.author,
      challengedPubkey:
        list.members.find((m: string) => m !== list.author) || '',
    };
  }

  /**
   * Get all user's challenges (tag-based)
   * Queries kind 30102 events where user is tagged in 'p' tags
   */
  async getUserChallenges(
    userPubkey: string
  ): Promise<NostrChallengeDefinition[]> {
    try {
      const ndk = await GlobalNDKService.getInstance();

      // ✅ FIX: Check if NDK instance has connected relays before querying
      const status = GlobalNDKService.getStatus();
      if (status.connectedRelays === 0) {
        console.warn('⚠️  No connected relays - cannot fetch user challenges');
        return []; // Graceful degradation instead of crash
      }

      // Query kind 30102 events with user's pubkey in 'p' tags
      const filter: NDKFilter = {
        kinds: [30102],
        '#p': [userPubkey],
      };

      const events = await ndk.fetchEvents(filter);
      const eventArray = Array.from(events);

      console.log(`Found ${eventArray.length} challenges for user`);

      // Parse each event into NostrChallengeDefinition
      const challenges: NostrChallengeDefinition[] = [];
      for (const event of eventArray) {
        const challenge = this.parseChallengeEvent(event);
        if (challenge) {
          challenges.push(challenge);
        }
      }

      return challenges;
    } catch (error) {
      console.error('❌ Error fetching user challenges:', error);
      return []; // ✅ Always return empty array instead of throwing
    }
  }

  /**
   * Get all active challenges that haven't expired yet (tag-based)
   * Used by ChallengeCompletionService for monitoring
   */
  async getActiveChallenges(): Promise<NostrChallengeDefinition[]> {
    try {
      const userIdentifiers = await getUserNostrIdentifiers();
      if (!userIdentifiers?.hexPubkey) {
        console.log('No user authenticated, returning empty active challenges');
        return [];
      }

      // Get all challenges the user is involved in
      const allChallenges = await this.getUserChallenges(
        userIdentifiers.hexPubkey
      );

      // Filter for active/open challenges only
      const activeChallenges = allChallenges.filter(
        (challenge) =>
          challenge.status === 'active' || challenge.status === 'open'
      );

      console.log(
        `Found ${activeChallenges.length} active challenges for user`
      );
      return activeChallenges;
    } catch (error) {
      console.error('Error getting active challenges:', error);
      return [];
    }
  }
}

export default ChallengeService.getInstance();
