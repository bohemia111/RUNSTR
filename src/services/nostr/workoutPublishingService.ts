/**
 * WorkoutPublishingService - Nostr Event Creation for HealthKit Workouts
 * Creates both kind 1301 (structured workout data) and kind 1 (social posts) events
 * Integrates with existing NostrProtocolHandler and NostrRelayManager
 */

import { GlobalNDKService } from './GlobalNDKService';
import { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import {
  WorkoutCardGenerator,
  type WorkoutCardOptions,
} from './workoutCardGenerator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Workout } from '../../types/workout';
import type { WorkoutType } from '../../types/workout';
import type { NDKSigner } from '@nostr-dev-kit/ndk';
import { CacheInvalidationService } from '../cache/CacheInvalidationService';
import { DailyRewardService } from '../rewards/DailyRewardService';
import { RewardLightningAddressService } from '../rewards/RewardLightningAddressService';
import { FEATURES } from '../../config/features';
import { ImageUploadService } from '../media/ImageUploadService';
import { LocalTeamMembershipService } from '../team/LocalTeamMembershipService';
import { CharitySelectionService } from '../charity/CharitySelectionService';
import { CHARITIES, getCharityById, type Charity } from '../../constants/charities';
import { SatlantisEventJoinService } from '../satlantis/SatlantisEventJoinService';
import { withTimeout, fireAndForget, NOSTR_TIMEOUTS } from '../../utils/nostrTimeout';
import { SupabaseCompetitionService } from '../backend/SupabaseCompetitionService';
import { RunningBitcoinService } from '../challenge/RunningBitcoinService';
import { isRunningBitcoinActive, isEligibleActivityType } from '../../constants/runningBitcoin';
import { nip19 } from 'nostr-tools';

// Import split type for race replay data
import type { Split } from '../activity/SplitTrackingService';

// Extended workout interface for publishing (simplified from UnifiedWorkout)
export interface PublishableWorkout extends Workout {
  elevationGain?: number;
  elevationLoss?: number;
  unitSystem?: 'metric' | 'imperial';
  nostrEventId?: string;
  sourceApp?: string;
  canSyncToNostr?: boolean;
  canPostToSocial?: boolean;
  // Strength training fields (inherited from Workout, but explicit for clarity)
  sets?: number;
  reps?: number;
  notes?: string;
  // Race replay data (kilometer splits for running)
  splits?: Split[];
  // Enhanced tracking data
  positions?: Array<{ latitude: number; longitude: number; timestamp: number }>;
  pauseCount?: number;
  // Meditation-specific fields
  meditationType?:
    | 'guided'
    | 'unguided'
    | 'breathwork'
    | 'body_scan'
    | 'gratitude';
  mindfulnessRating?: number;
  // Diet/Fasting-specific fields
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  mealTime?: string;
  mealSize?: 'small' | 'medium' | 'large' | 'xl';
  fastingDuration?: number;
  // Strength training-specific fields
  exerciseType?: string;
  repsBreakdown?: number[];
  restTime?: number;
  // Competition team for leaderboard participation
  competitionTeam?: string | null;
}

export interface WorkoutPublishResult {
  success: boolean;
  eventId?: string;
  error?: string;
  publishedToRelays?: number;
  failedRelays?: string[];
  rewardEarned?: boolean;
  rewardAmount?: number;
}

export interface SocialPostOptions {
  customMessage?: string;
  includeStats?: boolean;
  includeMotivation?: boolean;
  cardTemplate?: 'achievement' | 'progress' | 'minimal' | 'stats';
  cardOptions?: WorkoutCardOptions;
  includeCard?: boolean;
  userAvatar?: string; // User's profile picture URL
  userName?: string; // User's display name
  cardImageUri?: string; // Pre-rendered card image URI (optional)
}

interface WorkoutEventData {
  type: string;
  duration: number;
  distance?: number;
  calories?: number;
  pace?: number;
  elevationGain?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  startTime: string;
  endTime: string;
}

export class WorkoutPublishingService {
  private static instance: WorkoutPublishingService;
  private cardGenerator: WorkoutCardGenerator;
  private imageUploadService: ImageUploadService;

  private constructor() {
    this.cardGenerator = WorkoutCardGenerator.getInstance();
    this.imageUploadService = ImageUploadService.getInstance();
  }

  static getInstance(): WorkoutPublishingService {
    if (!WorkoutPublishingService.instance) {
      WorkoutPublishingService.instance = new WorkoutPublishingService();
    }
    return WorkoutPublishingService.instance;
  }

  /**
   * Save HealthKit workout as Kind 1301 Nostr event (NIP-101e compliant)
   * Supports both direct privateKeyHex (nsec users) and NDKSigner (Amber users)
   */
  async saveWorkoutToNostr(
    workout: PublishableWorkout,
    privateKeyHexOrSigner: string | NDKSigner,
    userId: string
  ): Promise<WorkoutPublishResult> {
    try {
      console.log(
        `🔄 Publishing workout ${workout.id} as kind 1301 event (runstr format)...`
      );

      const ndk = await GlobalNDKService.getInstance();
      const isSigner = typeof privateKeyHexOrSigner !== 'string';

      // Get signer and pubkey
      let signer: NDKSigner;
      let pubkey: string;

      if (isSigner) {
        signer = privateKeyHexOrSigner;
        const user = await signer.user();
        pubkey = user.pubkey;
      } else {
        signer = new NDKPrivateKeySigner(privateKeyHexOrSigner);
        const user = await signer.user();
        pubkey = user.pubkey;
      }

      // Get user's selected team from TeamsScreen (charities ARE teams now)
      // The selected_team_id now stores charity ID directly
      const selectedTeamId = await AsyncStorage.getItem('@runstr:selected_team_id');

      // Look up the charity data (team data) from the charity ID
      // This provides both team ID for the team tag AND full charity data for the charity tag
      const selectedCharity = selectedTeamId ? getCharityById(selectedTeamId) : null;

      // Get user's reward lightning address for tagging (for external reward scripts)
      const rewardLightningAddress =
        await RewardLightningAddressService.getRewardLightningAddress();

      // Create unsigned NDKEvent
      const ndkEvent = new NDKEvent(ndk);
      ndkEvent.kind = 1301;
      ndkEvent.content = this.generateWorkoutDescription(workout);
      ndkEvent.tags = await this.createNIP101eWorkoutTags(
        workout,
        pubkey,
        selectedCharity, // Charity provides both team ID and charity data
        rewardLightningAddress
      );
      ndkEvent.created_at = Math.floor(
        new Date(workout.startTime).getTime() / 1000
      );

      // Validate runstr format compliance
      const eventTemplate = {
        kind: ndkEvent.kind,
        content: ndkEvent.content,
        tags: ndkEvent.tags,
        created_at: ndkEvent.created_at,
      };
      if (!this.validateNIP101eStructure(eventTemplate)) {
        throw new Error('Event structure does not comply with runstr format');
      }

      // Sign and publish WITH TIMEOUT PROTECTION
      // These operations can hang indefinitely without timeouts
      await withTimeout(
        ndkEvent.sign(signer),
        NOSTR_TIMEOUTS.SIGN,
        'Event signing'
      );
      await withTimeout(
        ndkEvent.publish(),
        NOSTR_TIMEOUTS.PUBLISH,
        'Event publishing'
      );

      console.log(`✅ Workout saved to Nostr (runstr format): ${ndkEvent.id}`);

      // ============================================================================
      // FIRE-AND-FORGET: Non-critical operations that should NEVER block UI
      // ============================================================================

      // Cache invalidation (non-blocking) - user will see workout on next refresh
      fireAndForget(
        CacheInvalidationService.invalidateWorkout(pubkey),
        'cacheInvalidation'
      );

      // 🎁 Reward check (non-blocking) - don't block publish for rewards
      // Rewards are processed in background, user sees notification if successful
      if (FEATURES.ENABLE_DAILY_REWARDS) {
        fireAndForget(
          DailyRewardService.sendReward(pubkey).then((result) => {
            if (result.success) {
              console.log(`🎉 User earned ${result.amount} sats reward!`);
            }
          }),
          'rewardCheck'
        );
      }

      // ============================================================================
      // SUPABASE SUBMISSION: Submit workout to Supabase for competition tracking
      // ============================================================================
      const exerciseType = this.getExerciseVerb(workout.type);
      const npub = nip19.npubEncode(pubkey);

      fireAndForget(
        (async () => {
          try {
            // Submit workout to Supabase Edge Function (anti-cheat validation)
            const supabaseResult = await SupabaseCompetitionService.submitWorkoutSimple({
              eventId: ndkEvent.id || '',
              npub,
              type: exerciseType,
              distance: workout.distance,
              duration: workout.duration,
              calories: workout.calories,
              startTime: workout.startTime,
            });

            if (supabaseResult.success && !supabaseResult.flagged) {
              console.log(`✅ Workout submitted to Supabase: ${ndkEvent.id}`);

              // Check Running Bitcoin auto-pay for eligible activity types
              if (isRunningBitcoinActive() && isEligibleActivityType(exerciseType)) {
                console.log('[WorkoutPublishing] Checking Running Bitcoin auto-pay...');
                const autoPayResult = await RunningBitcoinService.checkAndAutoPayReward(npub);
                if (autoPayResult.paid) {
                  console.log('🏃⚡ Running Bitcoin: Auto-paid 1000 sats for 21km completion!');
                }
              }
            } else if (supabaseResult.flagged) {
              console.warn(`⚠️ Workout flagged by anti-cheat: ${supabaseResult.error}`);
            }
          } catch (error) {
            console.warn('⚠️ Supabase submission failed (non-blocking):', error);
          }
        })(),
        'supabaseSubmission'
      );

      // Return immediately - don't wait for non-critical operations
      return {
        success: true,
        eventId: ndkEvent.id,
        rewardEarned: false, // Will be updated via notification if successful
        rewardAmount: undefined,
      };
    } catch (error) {
      console.error('❌ Error saving workout to Nostr:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Post workout as Kind 1 social event with workout card image
   * Supports both direct privateKeyHex (nsec users) and NDKSigner (Amber users)
   *
   * New feature: Generates SVG card, converts to PNG, uploads to nostr.build,
   * and includes as rich media in Nostr post using NIP-94 imeta tags
   */
  async postWorkoutToSocial(
    workout: PublishableWorkout,
    privateKeyHexOrSigner: string | NDKSigner,
    userId: string,
    options: SocialPostOptions = {}
  ): Promise<WorkoutPublishResult> {
    try {
      console.log(`🔄 Creating social post for workout ${workout.id}...`);

      const ndk = await GlobalNDKService.getInstance();
      const isSigner = typeof privateKeyHexOrSigner !== 'string';

      // Get signer
      let signer: NDKSigner;
      if (isSigner) {
        signer = privateKeyHexOrSigner;
      } else {
        signer = new NDKPrivateKeySigner(privateKeyHexOrSigner);
      }

      // Generate workout card image if requested
      let imageUrl: string | undefined;
      let imageDimensions: { width: number; height: number } | undefined;

      if (options.includeCard !== false) {
        console.log('🎨 Generating workout card image...');

        try {
          // Fetch competition team name for card branding
          const competitionTeamId =
            await LocalTeamMembershipService.getCompetitionTeam();
          let teamName: string | undefined;

          if (competitionTeamId) {
            try {
              const NdkTeamService = (await import('../team/NdkTeamService'))
                .default;
              const teamData = await NdkTeamService.getTeamById(
                competitionTeamId
              );
              teamName = teamData?.name ? `Team ${teamData.name}` : undefined;
            } catch (err) {
              console.warn('⚠️ Failed to fetch team name for card:', err);
            }
          }

          // Generate SVG card
          const cardData = await this.cardGenerator.generateWorkoutCard(
            workout,
            {
              template: options.cardTemplate || 'achievement',
              userAvatar: options.userAvatar,
              userName: options.userName,
              teamName,
              ...options.cardOptions,
            }
          );

          // Note: Image conversion will happen in the UI layer (SocialShareModal)
          // using WorkoutCardRenderer + captureRef, then pass cardImageUri in options
          if (options.cardImageUri) {
            console.log(
              '📤 Uploading card image to nostr.build with NIP-98 auth...',
              {
                uri: options.cardImageUri,
                filename: `runstr-workout-${workout.id}.png`,
                hasSigner: !!signer,
              }
            );
            const uploadResult = await this.imageUploadService.uploadImage(
              options.cardImageUri,
              `runstr-workout-${workout.id}.png`,
              signer
            );

            console.log('📤 Upload result:', {
              success: uploadResult.success,
              hasUrl: !!uploadResult.url,
              hasDimensions: !!uploadResult.dimensions,
              error: uploadResult.error,
            });

            if (uploadResult.success && uploadResult.url) {
              imageUrl = uploadResult.url;
              imageDimensions = uploadResult.dimensions || cardData.dimensions;
              console.log(`✅ Image uploaded successfully to: ${imageUrl}`);
            } else {
              // Throw error instead of continuing silently - user needs feedback
              throw new Error(
                `Image upload failed: ${uploadResult.error || 'Unknown error'}`
              );
            }
          } else {
            console.warn('⚠️ No cardImageUri provided - posting without image');
          }
        } catch (cardError) {
          console.warn('⚠️ Card generation failed (non-blocking):', cardError);
          // Continue without image - post will still have text content
        }
      }

      // Get user's selected team (charity) for tagging
      const selectedTeamId = await AsyncStorage.getItem('@runstr:selected_team_id');
      const selectedCharity = selectedTeamId ? getCharityById(selectedTeamId) : null;

      // Create unsigned NDKEvent
      const ndkEvent = new NDKEvent(ndk);
      ndkEvent.kind = 1;
      ndkEvent.content = await this.generateSocialPostContent(
        workout,
        options,
        imageUrl
      );
      ndkEvent.tags = this.createSocialPostTags(
        workout,
        imageUrl,
        imageDimensions,
        selectedCharity // Charity provides both team ID and charity data
      );
      ndkEvent.created_at = Math.floor(Date.now() / 1000);

      // Sign and publish WITH TIMEOUT PROTECTION
      await withTimeout(
        ndkEvent.sign(signer),
        NOSTR_TIMEOUTS.SIGN,
        'Social post signing'
      );
      await withTimeout(
        ndkEvent.publish(),
        NOSTR_TIMEOUTS.PUBLISH,
        'Social post publishing'
      );

      console.log(`✅ Workout posted to social: ${ndkEvent.id}`);

      // Cache invalidation (fire-and-forget) - social post appears on next refresh
      signer.user().then((user) => {
        fireAndForget(
          CacheInvalidationService.invalidateWorkout(user.pubkey),
          'socialCacheInvalidation'
        );
      });

      return {
        success: true,
        eventId: ndkEvent.id,
      };
    } catch (error) {
      console.error('❌ Error posting workout to social:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Convert Workout to Nostr event data format
   */
  private convertWorkoutToEventData(
    workout: PublishableWorkout
  ): WorkoutEventData {
    return {
      type: workout.type,
      duration: workout.duration,
      distance: workout.distance,
      calories: workout.calories,
      pace: workout.pace,
      elevationGain: workout.elevationGain,
      averageHeartRate: workout.heartRate?.avg,
      maxHeartRate: workout.heartRate?.max,
      startTime: workout.startTime,
      endTime: workout.endTime,
    };
  }

  /**
   * Create runstr-compatible tags for kind 1301 workout events
   * Matches the exact format used by runstr GitHub implementation
   * ✅ UPDATED: Charity is now the team - adds charity ID to BOTH team AND charity tags
   * ✅ UPDATED: Now includes lightning address tag for external reward scripts
   */
  private async createNIP101eWorkoutTags(
    workout: PublishableWorkout,
    pubkey: string,
    selectedCharity: Charity | null,
    rewardLightningAddress: string | null
  ): Promise<string[][]> {
    // Map workout type to simple exercise verb (run, walk, cycle)
    const exerciseVerb = this.getExerciseVerb(workout.type);

    // Format duration as HH:MM:SS string
    const durationFormatted = this.formatDurationHHMMSS(workout.duration);

    // Get specific exercise name for better title
    const specificExercise = this.getSpecificExerciseName(workout);
    const title = specificExercise
      ? `${
          specificExercise.charAt(0).toUpperCase() + specificExercise.slice(1)
        }`
      : `${
          exerciseVerb.charAt(0).toUpperCase() + exerciseVerb.slice(1)
        } Workout`;

    // Determine source tag value based on workout origin
    // Manual entries are tagged differently to exclude from GPS-based competitions
    const isManual = (workout as any).isManualEntry === true ||
                     (workout as any).source === 'manual_entry';
    const sourceTag = isManual ? 'manual' : 'gps';

    // Start with required tags (always present)
    const tags: string[][] = [
      ['d', workout.id], // Unique workout ID
      ['title', title],
      ['exercise', exerciseVerb], // Simple activity type: running, yoga, strength, etc.
      ['duration', durationFormatted], // HH:MM:SS format (always included)
      ['source', sourceTag], // Data source: 'gps' for tracked, 'manual' for manual entry
      ['client', 'RUNSTR', '0.1.7'], // Client info with version
      ['t', this.getActivityHashtag(workout.type)], // Primary hashtag
    ];

    // Add distance for cardio activities (running, cycling, treadmill, etc.)
    // EXCLUDE strength training and gym workouts (they use reps/sets instead)
    const isStrengthWorkout =
      workout.type === 'strength_training' || workout.type === 'gym';
    if (workout.distance && workout.distance > 0 && !isStrengthWorkout) {
      const distanceKm = (workout.distance / 1000).toFixed(2);
      const distanceUnit = workout.unitSystem === 'imperial' ? 'mi' : 'km';
      const distanceValue =
        workout.unitSystem === 'imperial'
          ? (parseFloat(distanceKm) * 0.621371).toFixed(2)
          : distanceKm;
      tags.push(['distance', distanceValue, distanceUnit]);
    }

    // Add elevation if available (for running, hiking, cycling)
    if (workout.elevationGain && workout.elevationGain > 0) {
      const elevationUnit = workout.unitSystem === 'imperial' ? 'ft' : 'm';
      const elevationValue =
        workout.unitSystem === 'imperial'
          ? Math.round(workout.elevationGain * 3.28084).toString()
          : Math.round(workout.elevationGain).toString();
      tags.push(['elevation_gain', elevationValue, elevationUnit]);
    }

    // Add calories if available
    if (workout.calories && workout.calories > 0) {
      tags.push(['calories', Math.round(workout.calories).toString()]);
    }

    // Add steps count for walking/step-based workouts (enables step-based competition scoring)
    const steps = (workout.metadata as any)?.steps;
    if (steps && typeof steps === 'number' && steps > 0) {
      tags.push(['steps', steps.toString()]);
    }

    // Add sets and reps for strength training workouts (pushups, pullups, etc.)
    if (workout.sets && workout.sets > 0) {
      tags.push(['sets', workout.sets.toString()]);
    }
    if (workout.reps && workout.reps > 0) {
      tags.push(['reps', workout.reps.toString()]);
    }

    // Add weight for strength training workouts (non-breaking - optional field)
    if (workout.weight && workout.weight > 0) {
      tags.push(['weight', workout.weight.toString(), 'lbs']);
    }

    // Add per-set weight data for strength training (enables volume-based competition scoring)
    if (workout.weightsPerSet && Array.isArray(workout.weightsPerSet)) {
      workout.weightsPerSet.forEach((weight, index) => {
        if (weight > 0) {
          tags.push([
            'weight_set',
            (index + 1).toString(), // Set number (1-indexed)
            weight.toString(),
            'lbs',
          ]);
        }
      });
    }

    // Add meditation subtype for meditation workouts
    if (workout.meditationType) {
      tags.push(['meditation_type', workout.meditationType]);
    }

    // Add meal type for diet/nutrition workouts
    if (workout.mealType) {
      tags.push(['meal_type', workout.mealType]);
    }

    // Add meal size for diet/nutrition workouts (non-breaking - optional field)
    if (workout.mealSize) {
      tags.push(['meal_size', workout.mealSize]);
    }

    // Add exercise type for strength training workouts
    if (workout.exerciseType) {
      tags.push(['exercise_type', workout.exerciseType]);
    }

    // Add split times for running workouts (race replay data)
    if (workout.splits && workout.splits.length > 0) {
      for (const split of workout.splits) {
        // Format: ["split", "km_number", "elapsed_time_HH:MM:SS"]
        const elapsedTimeFormatted = this.formatDurationHHMMSS(
          split.elapsedTime
        );
        tags.push(['split', split.number.toString(), elapsedTimeFormatted]);
      }

      // Add individual split paces (seconds per km/mi)
      for (const split of workout.splits) {
        // Format: ["split_pace", "split_number", "pace_in_seconds"]
        tags.push([
          'split_pace',
          split.number.toString(),
          Math.round(split.splitTime).toString(),
        ]);
      }

      // Calculate and add average pace from splits
      const totalSplitTime = workout.splits.reduce(
        (sum, s) => sum + s.splitTime,
        0
      );
      const averagePaceSeconds = totalSplitTime / workout.splits.length;
      const paceFormatted = this.formatPaceMMSS(averagePaceSeconds);
      const paceUnit = workout.unitSystem === 'imperial' ? 'min/mi' : 'min/km';

      // If using imperial, convert pace from min/km to min/mi
      if (workout.unitSystem === 'imperial') {
        const paceMinPerMile = averagePaceSeconds * 1.60934; // Convert km pace to mile pace
        const paceFormattedMiles = this.formatPaceMMSS(paceMinPerMile);
        tags.push(['avg_pace', paceFormattedMiles, paceUnit]);
      } else {
        tags.push(['avg_pace', paceFormatted, paceUnit]);
      }
    }

    // Add elevation loss if available (for running, hiking, cycling)
    if (workout.elevationLoss && workout.elevationLoss > 0) {
      const elevationUnit = workout.unitSystem === 'imperial' ? 'ft' : 'm';
      const elevationValue =
        workout.unitSystem === 'imperial'
          ? Math.round(workout.elevationLoss * 3.28084).toString()
          : Math.round(workout.elevationLoss).toString();
      tags.push(['elevation_loss', elevationValue, elevationUnit]);
    }

    // Add GPS data point count if available
    if (workout.positions && workout.positions.length > 0) {
      tags.push(['data_points', workout.positions.length.toString()]);
    }

    // Add pause count if available
    if (workout.pauseCount !== undefined) {
      tags.push(['recording_pauses', workout.pauseCount.toString()]);
    }

    // Add workout start timestamp (Unix seconds)
    if (workout.startTime) {
      const startTimestamp = this.toUnixSeconds(workout.startTime);
      tags.push(['workout_start_time', startTimestamp]);
    }

    // Add team AND charity tags (charities ARE teams now)
    // Both tags use the same charity data for backwards compatibility
    if (selectedCharity) {
      // Team tag for leaderboards and competition filtering
      tags.push(['team', selectedCharity.id]);
      console.log(`   ✅ Added team tag: ${selectedCharity.id}`);

      // Charity tag for external client parsing and donations
      tags.push([
        'charity',
        selectedCharity.id,
        selectedCharity.name,
        selectedCharity.lightningAddress,
      ]);
      console.log(`   ✅ Added charity tag: ${selectedCharity.name}`);
    }

    // Add reward lightning address tag (for external reward scripts)
    if (rewardLightningAddress) {
      tags.push(['lightning', rewardLightningAddress]);
      console.log(`   ✅ Added lightning address tag: ${rewardLightningAddress}`);
    }

    // Add event tags for active RUNSTR events (workout belongs to these events)
    // This enables event leaderboards to query workouts by event ID without RSVP queries
    try {
      const activeEventIds = await SatlantisEventJoinService.getActiveEventIds();
      for (const eventId of activeEventIds) {
        tags.push(['e', eventId]);
        console.log(`   ✅ Added event tag: ${eventId}`);
      }
      if (activeEventIds.length > 0) {
        console.log(`   📋 Workout tagged with ${activeEventIds.length} active event(s)`);
      }
    } catch (error) {
      console.warn('   ⚠️ Failed to get active events for tagging:', error);
      // Non-blocking - workout publishing continues without event tags
    }

    return tags;
  }

  /**
   * Get simple exercise verb for in-app competitions
   * Supports cardio, strength, wellness, and nutrition activities
   */
  private getExerciseVerb(workoutType: string): string {
    const type = workoutType.toLowerCase();
    // Cardio activities
    if (type.includes('run') || type === 'running') return 'running';
    if (type.includes('walk') || type === 'walking') return 'walking';
    if (type.includes('cycl') || type === 'cycling' || type.includes('bike'))
      return 'cycling';
    if (type.includes('hik')) return 'hiking';
    if (type.includes('swim')) return 'swimming';
    if (type.includes('row')) return 'rowing';
    // Strength activities
    if (
      type.includes('strength') ||
      type.includes('gym') ||
      type.includes('weight')
    )
      return 'strength';
    if (
      type.includes('pushup') ||
      type.includes('pullup') ||
      type.includes('situp')
    )
      return 'strength';
    if (type.includes('squat') || type.includes('burpee')) return 'strength';
    // Wellness activities
    if (type.includes('yoga')) return 'yoga';
    if (type.includes('meditation')) return 'meditation';
    // Nutrition activities
    if (type.includes('diet') || type.includes('meal')) return 'diet';
    if (type.includes('fasting') || type.includes('fast')) return 'fasting';
    // Default to 'running' for unrecognized types (never 'other')
    return 'running';
  }

  /**
   * Format duration as HH:MM:SS string for runstr compatibility
   */
  private formatDurationHHMMSS(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format pace as MM:SS string for avg_pace tag
   */
  private formatPaceMMSS(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }

  /**
   * Get activity hashtag for in-app competitions
   * Supports cardio, strength, wellness, and nutrition activities
   */
  private getActivityHashtag(workoutType: string): string {
    const type = workoutType.toLowerCase();
    // Cardio hashtags
    if (type.includes('run') || type === 'running') return 'Running';
    if (type.includes('walk') || type === 'walking') return 'Walking';
    if (type.includes('cycl') || type === 'cycling' || type.includes('bike'))
      return 'Cycling';
    if (type.includes('hik')) return 'Hiking';
    if (type.includes('swim')) return 'Swimming';
    if (type.includes('row')) return 'Rowing';
    // Strength hashtags
    if (
      type.includes('gym') ||
      type.includes('strength') ||
      type.includes('weight')
    )
      return 'Strength';
    if (
      type.includes('pushup') ||
      type.includes('pullup') ||
      type.includes('situp')
    )
      return 'Strength';
    if (type.includes('squat') || type.includes('burpee')) return 'Strength';
    // Wellness hashtags
    if (type.includes('yoga')) return 'Yoga';
    if (type.includes('meditation')) return 'Meditation';
    // Nutrition hashtags
    if (type.includes('diet') || type.includes('meal')) return 'Diet';
    if (type.includes('fasting') || type.includes('fast')) return 'Fasting';
    return 'Fitness';
  }

  /**
   * Convert date/time to Unix timestamp in seconds (NIP-101e requirement)
   */
  private toUnixSeconds(dateInput: string | Date | number): string {
    let timestamp: number;

    if (typeof dateInput === 'string') {
      timestamp = new Date(dateInput).getTime();
    } else if (typeof dateInput === 'number') {
      // Check if already in seconds (Unix timestamp)
      timestamp = dateInput < 10000000000 ? dateInput * 1000 : dateInput;
    } else if (dateInput instanceof Date) {
      timestamp = dateInput.getTime();
    } else {
      timestamp = Date.now();
    }

    return Math.floor(timestamp / 1000).toString();
  }

  /**
   * Generate human-readable workout description for content field
   * Matches runstr GitHub format
   */
  private generateWorkoutDescription(workout: PublishableWorkout): string {
    const exerciseVerb = this.getExerciseVerb(workout.type);
    const specificExercise = this.getSpecificExerciseName(workout);

    // Priority 1: User's custom notes (if not auto-generated from preset)
    if (workout.notes && !this.isAutoGeneratedNote(workout.notes)) {
      return workout.notes;
    }
    if (workout.metadata?.notes && workout.metadata.notes.length > 0) {
      return workout.metadata.notes;
    }

    // Priority 2: Strength workouts with sets/reps and specific exercise name
    if (
      (workout.sets || workout.reps) &&
      exerciseVerb === 'strength' &&
      specificExercise
    ) {
      if (workout.reps && workout.sets) {
        return `Completed ${workout.reps} ${specificExercise} in ${workout.sets} sets with RUNSTR!`;
      } else if (workout.reps) {
        return `Completed ${workout.reps} ${specificExercise} with RUNSTR!`;
      }
    }

    // Priority 3: Any workout with a specific exercise name (yoga, meditation, treadmill, etc.)
    if (specificExercise) {
      return `Completed a ${specificExercise} with RUNSTR!`;
    }

    // Priority 4: Generic descriptions with proper grammar
    switch (exerciseVerb) {
      case 'running':
        return 'Completed a run with RUNSTR!';
      case 'walking':
        return 'Completed a walk with RUNSTR!';
      case 'cycling':
        return 'Completed a bike ride with RUNSTR!';
      case 'hiking':
        return 'Completed a hike with RUNSTR!';
      case 'strength':
        return 'Completed a strength training workout with RUNSTR!';
      case 'meditation':
        return 'Completed a meditation session with RUNSTR!';
      default:
        return 'Completed a workout with RUNSTR!';
    }
  }

  /**
   * Check if notes field is auto-generated from preset name
   * Auto-generated notes are just the exercise name (e.g., "Pushups", "Yoga")
   */
  private isAutoGeneratedNote(notes: string): boolean {
    const autoGenerated = [
      'pushups',
      'pullups',
      'situps',
      'yoga',
      'meditation',
      'treadmill',
      'weight training',
      'stretching',
    ];
    return autoGenerated.includes(notes.toLowerCase().split(':')[0]);
  }

  /**
   * Extract specific exercise name from workout metadata or type
   * Returns exercise name like "pushups", "pullups", "yoga session", etc.
   */
  private getSpecificExerciseName(workout: PublishableWorkout): string | null {
    // Check meditation subtype first
    if (workout.meditationType) {
      const meditationTypeMap: Record<string, string> = {
        guided: 'guided meditation',
        unguided: 'unguided meditation',
        breathwork: 'breathwork session',
        body_scan: 'body scan meditation',
        gratitude: 'gratitude meditation',
      };
      return meditationTypeMap[workout.meditationType] || 'meditation session';
    }

    // Check meal type for diet workouts
    if (workout.mealType) {
      return `${workout.mealType} meal`;
    }

    // Check exercise type for strength workouts
    if (workout.exerciseType) {
      return workout.exerciseType;
    }

    // Check notes first (where we store the specific exercise name from manual entry)
    if (workout.notes) {
      const notes = workout.notes.toLowerCase();
      // Strength exercises
      if (notes.includes('pushup')) return 'pushups';
      if (notes.includes('pullup')) return 'pullups';
      if (notes.includes('situp') || notes.includes('sit-up')) return 'situps';
      if (notes.includes('squat')) return 'squats';
      if (notes.includes('burpee')) return 'burpees';
      if (notes.includes('weight training') || notes.startsWith('weights'))
        return 'weight training';
      // Cardio exercises
      if (notes.includes('treadmill')) return 'treadmill run';
      // Wellness activities
      if (notes.startsWith('yoga')) return 'yoga session';
      if (notes.startsWith('meditation')) return 'meditation session';
      if (notes.startsWith('stretching')) return 'stretching session';
    }

    // Check metadata (from manual entry screen)
    if (workout.metadata?.title) {
      const title = workout.metadata.title.toLowerCase();
      // Strength exercises
      if (title.includes('pushup')) return 'pushups';
      if (title.includes('pullup')) return 'pullups';
      if (title.includes('situp') || title.includes('sit-up')) return 'situps';
      if (title.includes('squat')) return 'squats';
      if (title.includes('burpee')) return 'burpees';
      if (title.includes('weight training') || title.includes('weights'))
        return 'weight training';
      // Cardio exercises
      if (title.includes('treadmill')) return 'treadmill run';
      // Wellness activities
      if (title.includes('yoga')) return 'yoga session';
      if (title.includes('meditation')) return 'meditation session';
      if (title.includes('stretching')) return 'stretching session';
    }

    // Check workout type string
    const typeStr = workout.type.toLowerCase();
    if (typeStr.includes('pushup')) return 'pushups';
    if (typeStr.includes('pullup')) return 'pullups';
    if (typeStr.includes('situp') || typeStr.includes('sit-up'))
      return 'situps';
    if (typeStr.includes('squat')) return 'squats';
    if (typeStr.includes('burpee')) return 'burpees';

    // Check sourceApp for exercise type
    if (workout.sourceApp) {
      const sourceStr = workout.sourceApp.toLowerCase();
      if (sourceStr.includes('pushup')) return 'pushups';
      if (sourceStr.includes('pullup')) return 'pullups';
      if (sourceStr.includes('situp')) return 'situps';
      if (sourceStr.includes('weight')) return 'weight training';
      if (sourceStr.includes('treadmill')) return 'treadmill run';
    }

    return null;
  }

  /**
   * Get readable workout type for social posts
   */
  private getReadableWorkoutType(workoutType: string): string {
    const type = workoutType.toLowerCase();
    if (type.includes('run') || type === 'running') return 'run';
    if (type.includes('walk') || type === 'walking') return 'walk';
    if (type.includes('cycl') || type === 'cycling' || type.includes('bike'))
      return 'bike ride';
    if (type.includes('hik')) return 'hike';
    if (type.includes('swim')) return 'swim';
    if (type.includes('row')) return 'rowing session';
    if (type.includes('gym') || type.includes('strength')) return 'gym workout';
    if (type.includes('yoga')) return 'yoga';
    if (type.includes('meditation')) return 'meditation';
    if (type.includes('stretch')) return 'stretching';
    return 'workout';
  }

  /**
   * Format duration for social posts (MM:SS or HH:MM:SS)
   */
  private formatDurationForPost(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Calculate pace (min:sec per km or mi)
   */
  private calculatePace(
    distanceMeters: number,
    durationSeconds: number,
    unitSystem?: 'metric' | 'imperial'
  ): string {
    if (distanceMeters <= 0 || durationSeconds <= 0) return 'N/A';

    const distanceKm = distanceMeters / 1000;
    const distanceMiles = distanceKm * 0.621371;

    const minutesPerUnit =
      unitSystem === 'imperial'
        ? durationSeconds / 60 / distanceMiles
        : durationSeconds / 60 / distanceKm;

    const paceMinutes = Math.floor(minutesPerUnit);
    const paceSeconds = Math.round((minutesPerUnit - paceMinutes) * 60);

    const unit = unitSystem === 'imperial' ? '/mi' : '/km';
    return `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')} ${unit}`;
  }

  /**
   * Format duration for human-readable description
   */
  private formatDurationForDescription(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes} minutes`;
    }
  }

  /**
   * Validate that an event template complies with runstr format
   */
  private validateNIP101eStructure(eventTemplate: {
    kind: number;
    content: string;
    tags: string[][];
    created_at?: number;
  }): boolean {
    // Check that content is plain text, not JSON
    if (typeof eventTemplate.content !== 'string') {
      console.error('Validation failed: content must be a string');
      return false;
    }

    // Check for required runstr-compatible tags (distance is optional now)
    const requiredTags = ['d', 'exercise', 'duration', 'source'];
    const tagKeys = eventTemplate.tags.map((tag) => tag[0]);

    for (const required of requiredTags) {
      if (!tagKeys.includes(required)) {
        console.error(`Validation failed: missing required tag '${required}'`);
        return false;
      }
    }

    // Validate exercise tag is simple (just activity type)
    const exerciseTag = eventTemplate.tags.find((tag) => tag[0] === 'exercise');
    if (!exerciseTag || exerciseTag.length !== 2) {
      console.error(
        'Validation failed: exercise tag must be simple ["exercise", activityType]'
      );
      return false;
    }

    // Validate exercise type is one of the supported values for in-app competitions
    const validExerciseTypes = [
      'running',
      'walking',
      'cycling',
      'hiking',
      'swimming',
      'rowing',
      'strength',
      'yoga',
      'meditation',
      'diet',
      'fasting',
      'other',
    ];
    if (!validExerciseTypes.includes(exerciseTag[1])) {
      console.warn(
        `Exercise type '${exerciseTag[1]}' is non-standard - competitions may not recognize it`
      );
    }

    // Validate distance tag if present (optional for wellness activities)
    const distanceTag = eventTemplate.tags.find((tag) => tag[0] === 'distance');
    if (distanceTag && distanceTag.length !== 3) {
      console.error(
        'Validation failed: distance tag must have value and unit when present'
      );
      return false;
    }

    // Validate duration is HH:MM:SS format (always required)
    const durationTag = eventTemplate.tags.find((tag) => tag[0] === 'duration');
    if (!durationTag || !/^\d{2}:\d{2}:\d{2}$/.test(durationTag[1])) {
      console.error('Validation failed: duration must be in HH:MM:SS format');
      return false;
    }

    return true;
  }

  /**
   * Create tags for kind 1 social posts with NIP-94 image metadata
   * ✅ UPDATED: Charity is now the team - adds charity ID to BOTH team AND charity tags
   */
  private createSocialPostTags(
    workout: PublishableWorkout,
    imageUrl?: string,
    imageDimensions?: { width: number; height: number },
    selectedCharity?: Charity | null
  ): string[][] {
    const tags: string[][] = [
      ['t', 'fitness'], // General fitness hashtag
      ['t', workout.type], // Activity-specific hashtag
      ['t', 'RUNSTR'], // RUNSTR brand hashtag
    ];

    // Add specific tags based on workout type
    if (workout.type === 'running') {
      tags.push(['t', 'running']);
      if (workout.distance && workout.distance >= 5000) {
        tags.push(['t', '5K']);
      }
      if (workout.distance && workout.distance >= 10000) {
        tags.push(['t', '10K']);
      }
    } else if (workout.type === 'cycling') {
      tags.push(['t', 'cycling']);
      tags.push(['t', 'bike']);
    } else if (workout.type === 'gym' || workout.type === 'strength_training') {
      tags.push(['t', 'gym']);
      tags.push(['t', 'strength']);
    }

    // Add NIP-94 image metadata tag (imeta) if image was uploaded
    if (imageUrl) {
      const imetaTag = ['imeta', `url ${imageUrl}`];
      if (imageDimensions) {
        imetaTag.push(`dim ${imageDimensions.width}x${imageDimensions.height}`);
      }
      imetaTag.push('m image/png');
      tags.push(imetaTag);
    }

    // Reference the original workout event if it exists
    if (workout.nostrEventId) {
      tags.push(['e', workout.nostrEventId]);
    }

    // Add team AND charity tags (charities ARE teams now)
    if (selectedCharity) {
      // Team tag for leaderboards and competition filtering
      tags.push(['team', selectedCharity.id]);

      // Team name hashtag
      const teamHashtag = selectedCharity.name.replace(/[^a-zA-Z0-9]/g, '');
      tags.push(['t', teamHashtag]);

      console.log(`   ✅ Added team tag to kind 1: ${selectedCharity.id}`);

      // Charity tag for external client parsing and donations
      tags.push([
        'charity',
        selectedCharity.id,
        selectedCharity.name,
        selectedCharity.lightningAddress,
      ]);
      console.log(`   ✅ Added charity tag to kind 1: ${selectedCharity.name}`);
    }

    return tags;
  }

  /**
   * Generate social post content with clean format
   * If imageUrl is provided, content is minimal (image + hashtags only)
   * Otherwise, full text stats are included
   * ✅ UPDATED: Now includes team mention (charities ARE teams)
   */
  private async generateSocialPostContent(
    workout: PublishableWorkout,
    options: SocialPostOptions,
    imageUrl?: string
  ): Promise<string> {
    let content = '';
    const activityHashtag = this.getActivityHashtag(workout.type);

    // Get selected team (charity) from TeamsScreen selection
    const selectedTeamId = await AsyncStorage.getItem('@runstr:selected_team_id');
    const selectedCharity = selectedTeamId ? getCharityById(selectedTeamId) : null;
    const teamName = selectedCharity?.name || null;

    // Generate activity-specific team mention (e.g., "Running for Bitcoin Beach!")
    const getTeamMention = () => {
      if (!teamName) return null;
      const exerciseVerb = this.getExerciseVerb(workout.type);
      const verbMap: Record<string, string> = {
        running: 'Running',
        walking: 'Walking',
        cycling: 'Cycling',
        hiking: 'Hiking',
        swimming: 'Swimming',
        rowing: 'Rowing',
        strength: 'Training',
        yoga: 'Practicing yoga',
        meditation: 'Meditating',
        diet: 'Eating healthy',
        fasting: 'Fasting',
      };
      const verb = verbMap[exerciseVerb] || 'Working out';
      return `${verb} for ${teamName}!`;
    };

    // If we have an image, keep it minimal - the card has all the stats
    if (imageUrl) {
      content = `${imageUrl}\n\n`;
      const teamMention = getTeamMention();
      if (teamMention) {
        content += `${teamMention}\n\n`;
      }
      content += `#RUNSTR #${activityHashtag}`;
      if (teamName) {
        const teamHashtag = teamName.replace(/[^a-zA-Z0-9]/g, '');
        content += ` #${teamHashtag}`;
      }
      return content;
    }

    // Fallback: Full text content when no image is available
    // Custom message takes priority
    if (options.customMessage) {
      content = options.customMessage + '\n\n';
    } else {
      // Generate clean header with specific exercise details
      const exerciseVerb = this.getExerciseVerb(workout.type);
      const specificExercise = this.getSpecificExerciseName(workout);

      // For strength workouts with sets/reps and specific exercise, create detailed header
      if (
        (workout.sets || workout.reps) &&
        exerciseVerb === 'strength' &&
        specificExercise
      ) {
        if (workout.reps && workout.sets) {
          content = `Completed ${workout.reps} ${specificExercise} in ${workout.sets} sets with RUNSTR!\n\n`;
        } else if (workout.reps) {
          content = `Completed ${workout.reps} ${specificExercise} with RUNSTR!\n\n`;
        } else {
          content = `Completed ${specificExercise} with RUNSTR!\n\n`;
        }
      }
      // For any workout with a specific exercise name (yoga, meditation, treadmill, etc.)
      else if (specificExercise) {
        content = `Completed ${specificExercise} with RUNSTR!\n\n`;
      }
      // Generic format with readable workout type
      else {
        const workoutType = this.getReadableWorkoutType(workout.type);
        content = `Just completed ${workoutType} with RUNSTR!\n\n`;
      }
    }

    // Add workout stats in vertical format
    content += this.formatWorkoutStats(workout);

    // Add team mention (activity-specific shout-out)
    const teamMention = getTeamMention();
    if (teamMention) {
      content += `\n\n${teamMention}`;
    }

    // Add hashtags (including team hashtag if user has selected a team)
    content += `\n\n#RUNSTR #${activityHashtag}`;
    if (teamName) {
      const teamHashtag = teamName.replace(/[^a-zA-Z0-9]/g, '');
      content += ` #${teamHashtag}`;
    }

    return content.trim();
  }

  /**
   * Generate motivational message based on workout
   */
  private generateMotivationalMessage(workout: PublishableWorkout): string {
    const messages = {
      running: [
        'Just crushed another run! 🏃‍♂️',
        'Miles conquered, goals achieved! 🎯',
        'Every step counts toward greatness! ⚡',
        'Running toward my best self! 🌟',
      ],
      cycling: [
        'Bike ride complete! 🚴‍♂️',
        'Pedaling toward my goals! 🎯',
        'Two wheels, infinite possibilities! ⚡',
        'Cycling into a stronger me! 💪',
      ],
      gym: [
        'Gym session: COMPLETE! 💪',
        'Another step closer to my goals! 🎯',
        'Strength builds character! ⚡',
        'Iron sharpens iron! 🔥',
      ],
      walking: [
        'Walk complete! One step at a time! 🚶‍♂️',
        'Movement is medicine! 🌟',
        'Every step matters! ⚡',
        'Walking my way to wellness! 💚',
      ],
    };

    const typeMessages =
      messages[workout.type as keyof typeof messages] || messages.gym;
    return typeMessages[Math.floor(Math.random() * typeMessages.length)];
  }

  /**
   * Format workout stats for social post in vertical list format
   */
  private formatWorkoutStats(workout: PublishableWorkout): string {
    const stats = [];

    // Strength training stats (sets/reps) - show first for strength workouts
    if (workout.reps && workout.reps > 0) {
      stats.push(`💪 Reps: ${workout.reps}`);
    }
    if (workout.sets && workout.sets > 0) {
      stats.push(`🔢 Sets: ${workout.sets}`);
    }

    // Duration - format as HH:MM:SS or MM:SS
    const durationFormatted = this.formatDurationForPost(workout.duration);
    stats.push(`⏱️ Duration: ${durationFormatted}`);

    // Distance
    if (workout.distance && workout.distance > 0) {
      const distanceKm = (workout.distance / 1000).toFixed(2);
      const distanceDisplay =
        workout.unitSystem === 'imperial'
          ? `${(parseFloat(distanceKm) * 0.621371).toFixed(2)} mi`
          : `${distanceKm} km`;
      stats.push(`📏 Distance: ${distanceDisplay}`);

      // Pace - only if we have both distance and duration
      if (workout.duration > 0) {
        const paceStr = this.calculatePace(
          workout.distance,
          workout.duration,
          workout.unitSystem
        );
        stats.push(`⚡ Pace: ${paceStr}`);
      }
    }

    // Calories
    if (workout.calories && workout.calories > 0) {
      stats.push(`🔥 Calories: ${Math.round(workout.calories)} kcal`);
    }

    // Elevation gain
    if (workout.elevationGain && workout.elevationGain > 0) {
      const elevationDisplay =
        workout.unitSystem === 'imperial'
          ? `${Math.round(workout.elevationGain * 3.28084)} ft`
          : `${Math.round(workout.elevationGain)} m`;
      stats.push(`🏔️ Elevation Gain: ${elevationDisplay}`);
    }

    return stats.join('\n');
  }

  /**
   * Generate achievement callouts
   */
  private generateAchievements(workout: PublishableWorkout): string | null {
    const achievements = [];

    // Distance-based achievements
    if (workout.distance) {
      const km = workout.distance / 1000;
      if (km >= 21.1) achievements.push('🏃‍♂️ Half Marathon Distance!');
      else if (km >= 10) achievements.push('🎯 10K Achievement!');
      else if (km >= 5) achievements.push('⭐ 5K Complete!');
    }

    // Duration-based achievements
    if (workout.duration >= 3600) {
      achievements.push('⏰ 1+ Hour Workout!');
    } else if (workout.duration >= 1800) {
      achievements.push('💪 30+ Minute Session!');
    }

    // Calorie achievements
    if (workout.calories && workout.calories >= 500) {
      achievements.push('🔥 500+ Calories Burned!');
    }

    return achievements.length > 0 ? achievements.join(' ') : null;
  }

  /**
   * Batch publish multiple workouts
   * Supports both direct privateKeyHex (nsec users) and NDKSigner (Amber users)
   */
  async batchSaveWorkouts(
    workouts: PublishableWorkout[],
    privateKeyHexOrSigner: string | NDKSigner,
    userId: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<{
    successful: number;
    failed: number;
    results: WorkoutPublishResult[];
  }> {
    const results: WorkoutPublishResult[] = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < workouts.length; i++) {
      const workout = workouts[i];

      try {
        const result = await this.saveWorkoutToNostr(
          workout,
          privateKeyHexOrSigner,
          userId
        );
        results.push(result);

        if (result.success) {
          successful++;
        } else {
          failed++;
        }

        onProgress?.(i + 1, workouts.length);

        // Small delay between publishes to avoid overwhelming relays
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failed++;
      }
    }

    return { successful, failed, results };
  }
}

export default WorkoutPublishingService.getInstance();
