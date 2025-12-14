/**
 * RunstrEventPublishService - Publish NIP-52 calendar events to Nostr
 *
 * Creates and publishes kind 31923 calendar events with RUNSTR-specific tags
 * for scoring, payout, and join method configuration.
 */

import { GlobalNDKService } from '../nostr/GlobalNDKService';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import type { NDKSigner } from '@nostr-dev-kit/ndk';
import type {
  RunstrEventConfig,
  RunstrActivityType,
  RunstrScoringType,
  RunstrPayoutScheme,
  RunstrJoinMethod,
  RunstrDuration,
} from '../../types/runstrEvent';
import { DISTANCE_PRESETS, getDurationSeconds } from '../../types/runstrEvent';
import { NWCWalletService } from '../wallet/NWCWalletService';

// NIP-52 Calendar Event kind
const KIND_CALENDAR_EVENT = 31923;

export interface EventPublishResult {
  success: boolean;
  eventId?: string;
  dTag?: string;
  error?: string;
}

class RunstrEventPublishServiceClass {
  private static instance: RunstrEventPublishServiceClass;

  static getInstance(): RunstrEventPublishServiceClass {
    if (!this.instance) {
      this.instance = new RunstrEventPublishServiceClass();
    }
    return this.instance;
  }

  /**
   * Publish a new RUNSTR event to Nostr
   */
  async publishEvent(
    config: RunstrEventConfig,
    signerOrPrivateKey: NDKSigner | string
  ): Promise<EventPublishResult> {
    try {
      console.log('🎯 [RunstrEventPublish] Creating event:', config.title);

      // Validate config
      const validationError = this.validateConfig(config);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // Generate unique d-tag
      const dTag = this.generateDTag(config.title);
      const now = Math.floor(Date.now() / 1000);

      // Check if creator has NWC configured
      const hasNWC = await NWCWalletService.hasNWCConfigured();

      // Build NIP-52 compliant tags
      const tags = this.buildEventTags(config, dTag, hasNWC);

      // Create event content (description or empty)
      const content = config.description || '';

      // Get NDK instance
      const ndk = await GlobalNDKService.getInstance();

      // Create NDK event
      const ndkEvent = new NDKEvent(ndk, {
        kind: KIND_CALENDAR_EVENT,
        content,
        tags,
        created_at: now,
      });

      // Sign event
      if (typeof signerOrPrivateKey === 'string') {
        const { NDKPrivateKeySigner } = await import('@nostr-dev-kit/ndk');
        const signer = new NDKPrivateKeySigner(signerOrPrivateKey);
        await ndkEvent.sign(signer);
      } else {
        await ndkEvent.sign(signerOrPrivateKey);
      }

      // Publish with timeout
      console.log('📤 [RunstrEventPublish] Publishing to relays...');
      const publishPromise = ndkEvent.publish();
      const timeoutPromise = new Promise<Set<any>>((resolve) =>
        setTimeout(() => resolve(new Set()), 10000)
      );

      const relaySet = await Promise.race([publishPromise, timeoutPromise]);
      const publishedCount = relaySet.size;

      if (publishedCount > 0) {
        console.log(
          `✅ [RunstrEventPublish] Published to ${publishedCount} relays`
        );
        return {
          success: true,
          eventId: ndkEvent.id,
          dTag,
        };
      } else {
        return {
          success: false,
          error: 'Failed to publish to any relays. Check your connection.',
        };
      }
    } catch (error) {
      console.error('❌ [RunstrEventPublish] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate unique d-tag for event
   */
  private generateDTag(title: string): string {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `${slug}-${timestamp}-${random}`;
  }

  /**
   * Build NIP-52 compliant tags with RUNSTR extensions
   */
  private buildEventTags(
    config: RunstrEventConfig,
    dTag: string,
    hasNWC: boolean
  ): string[][] {
    const tags: string[][] = [];

    // Standard NIP-52 tags
    tags.push(['d', dTag]);
    tags.push(['title', config.title]);
    tags.push(['start', config.startTime.toString()]);
    tags.push(['end', config.endTime.toString()]);

    // Activity type tags
    tags.push(['t', config.activityType]);

    // RUNSTR marker tag (required for discovery)
    tags.push(['t', 'runstr']);

    // Add sport category tag
    tags.push(['t', 'sports']);

    // Distance-related tags for fastest_time events
    if (config.scoringType === 'fastest_time' && config.targetDistance) {
      console.log(`[RunstrEventPublish] 📏 Adding distance tag: ${config.targetDistance} ${config.targetDistanceUnit || 'km'}`);
      tags.push([
        'distance',
        config.targetDistance.toString(),
        config.targetDistanceUnit || 'km',
      ]);

      // Add common distance tags (5k, 10k, etc.)
      const preset = DISTANCE_PRESETS.find(
        (p) => Math.abs(p.value - config.targetDistance!) < 0.5
      );
      if (preset) {
        console.log(`[RunstrEventPublish] 📏 Adding preset tags: ${preset.tags.join(', ')}`);
        preset.tags.forEach((tag) => tags.push(['t', tag]));
      }
    } else {
      console.log(`[RunstrEventPublish] ⚠️ No distance tag added - scoringType: ${config.scoringType}, targetDistance: ${config.targetDistance}`);
    }

    // RUNSTR-specific configuration tags
    tags.push(['scoring', config.scoringType]);
    tags.push(['payout', config.payoutScheme]);
    tags.push(['join_method', config.joinMethod]);
    tags.push(['duration_type', config.duration]);

    // Entry fee (if paid event)
    if (config.joinMethod === 'paid' && config.entryFeeSats) {
      tags.push(['entry_fee', config.entryFeeSats.toString()]);
    }

    // Prize pool
    if (config.prizePoolSats > 0) {
      tags.push(['prize_pool', config.prizePoolSats.toString()]);
    }

    // Fixed payout amount
    if (config.payoutScheme === 'fixed_amount' && config.fixedPayoutAmount) {
      tags.push(['fixed_payout', config.fixedPayoutAmount.toString()]);
    }

    // Creator NWC status (for auto-payout)
    tags.push(['creator_nwc', hasNWC ? 'true' : 'false']);

    // Activity type for leaderboard queries
    tags.push(['activity_type', config.activityType]);

    return tags;
  }

  /**
   * Validate event configuration
   */
  private validateConfig(config: RunstrEventConfig): string | null {
    if (!config.title?.trim()) {
      return 'Event title is required';
    }

    if (!config.activityType) {
      return 'Activity type is required';
    }

    if (!config.scoringType) {
      return 'Scoring type is required';
    }

    if (config.scoringType === 'fastest_time' && !config.targetDistance) {
      return 'Target distance is required for fastest time events';
    }

    if (config.joinMethod === 'paid' && !config.entryFeeSats) {
      return 'Entry fee is required for paid events';
    }

    if (
      config.scoringType === 'participation' &&
      !['random_lottery', 'fixed_amount'].includes(config.payoutScheme)
    ) {
      return 'Participation events can only use Lottery or Fixed Amount payout';
    }

    if (config.payoutScheme === 'fixed_amount' && !config.fixedPayoutAmount) {
      return 'Fixed payout amount is required';
    }

    if (config.startTime >= config.endTime) {
      return 'End time must be after start time';
    }

    return null;
  }

  /**
   * Build config from form state
   */
  buildConfigFromForm(
    formState: {
      title: string;
      description: string;
      activityType: RunstrActivityType;
      scoringType: RunstrScoringType;
      targetDistance: string;
      duration: RunstrDuration;
      joinMethod: RunstrJoinMethod;
      entryFee: string;
      payoutScheme: RunstrPayoutScheme;
      prizePool: string;
      fixedPayout: string;
    },
    startTime?: number
  ): RunstrEventConfig {
    const start = startTime || Math.floor(Date.now() / 1000);
    const durationSeconds = getDurationSeconds(formState.duration);

    return {
      title: formState.title.trim(),
      description: formState.description.trim() || undefined,
      activityType: formState.activityType,
      scoringType: formState.scoringType,
      targetDistance:
        formState.scoringType === 'fastest_time'
          ? parseFloat(formState.targetDistance) || undefined
          : undefined,
      targetDistanceUnit: 'km',
      payoutScheme: formState.payoutScheme,
      prizePoolSats: parseInt(formState.prizePool, 10) || 0,
      fixedPayoutAmount:
        formState.payoutScheme === 'fixed_amount'
          ? parseInt(formState.fixedPayout, 10) || undefined
          : undefined,
      joinMethod: formState.joinMethod,
      entryFeeSats:
        formState.joinMethod === 'paid'
          ? parseInt(formState.entryFee, 10) || undefined
          : undefined,
      duration: formState.duration,
      startTime: start,
      endTime: start + durationSeconds,
      creatorHasNWC: false, // Will be checked at publish time
    };
  }
}

export const RunstrEventPublishService =
  RunstrEventPublishServiceClass.getInstance();
export default RunstrEventPublishService;
