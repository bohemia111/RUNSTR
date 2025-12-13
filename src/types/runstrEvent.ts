/**
 * RUNSTR Event Types
 *
 * Type definitions for user-created fitness events published as NIP-52 kind 31923 calendar events.
 * These events support configurable leaderboards, payment options, and automated prize payouts.
 */

import type { SatlantisEvent } from './satlantis';

// ============================================================================
// Scoring Types
// ============================================================================

/**
 * Leaderboard scoring types
 * - fastest_time: Race to complete target distance (lowest time wins)
 * - most_distance: Accumulate distance over event duration (highest km wins)
 * - participation: Everyone who completes a qualifying workout is eligible
 */
export type RunstrScoringType = 'fastest_time' | 'most_distance' | 'participation';

// ============================================================================
// Payout Types
// ============================================================================

/**
 * Prize payout schemes
 * - winner_takes_all: 1st place gets 100%
 * - top_3_split: 60% / 25% / 15% split
 * - random_lottery: Random participant wins entire prize
 * - fixed_amount: Each participant gets fixed sats amount
 */
export type RunstrPayoutScheme =
  | 'winner_takes_all'
  | 'top_3_split'
  | 'random_lottery'
  | 'fixed_amount';

/**
 * Get valid payout schemes for a scoring type
 * Participation scoring only allows fixed_amount or random_lottery (no ranking)
 */
export function getValidPayoutSchemes(scoringType: RunstrScoringType): RunstrPayoutScheme[] {
  if (scoringType === 'participation') {
    return ['random_lottery', 'fixed_amount'];
  }
  return ['winner_takes_all', 'top_3_split', 'random_lottery', 'fixed_amount'];
}

// ============================================================================
// Join Methods
// ============================================================================

/**
 * Event join methods
 * - open: Free to join, anyone can participate
 * - paid: Entry fee required (Lightning invoice)
 * - donation: Optional contribution (pay what you want)
 */
export type RunstrJoinMethod = 'open' | 'paid' | 'donation';

// ============================================================================
// Duration Types
// ============================================================================

/**
 * Event duration presets
 * - 1d: 24 hours
 * - 1w: 7 days
 * - 1m: 30 days
 */
export type RunstrDuration = '1d' | '1w' | '1m';

/**
 * Get duration in seconds for a duration type
 */
export function getDurationSeconds(duration: RunstrDuration): number {
  switch (duration) {
    case '1d':
      return 24 * 60 * 60; // 86400
    case '1w':
      return 7 * 24 * 60 * 60; // 604800
    case '1m':
      return 30 * 24 * 60 * 60; // 2592000
  }
}

/**
 * Get human-readable duration label
 */
export function getDurationLabel(duration: RunstrDuration): string {
  switch (duration) {
    case '1d':
      return '1 Day';
    case '1w':
      return '1 Week';
    case '1m':
      return '1 Month';
  }
}

// ============================================================================
// Activity Types
// ============================================================================

/**
 * Supported activity types for RUNSTR events
 * These map to kind 1301 workout exercise types
 */
export type RunstrActivityType = 'running' | 'cycling' | 'walking';

/**
 * Get human-readable activity label
 */
export function getActivityLabel(activity: RunstrActivityType): string {
  switch (activity) {
    case 'running':
      return 'Running';
    case 'cycling':
      return 'Cycling';
    case 'walking':
      return 'Walking';
  }
}

// ============================================================================
// Event Configuration
// ============================================================================

/**
 * Configuration for creating a new RUNSTR event
 */
export interface RunstrEventConfig {
  // Basic info
  title: string;
  description?: string;

  // Activity
  activityType: RunstrActivityType;

  // Scoring
  scoringType: RunstrScoringType;
  targetDistance?: number; // km (for fastest_time events)
  targetDistanceUnit?: 'km' | 'miles';

  // Payout
  payoutScheme: RunstrPayoutScheme;
  prizePoolSats: number;
  fixedPayoutAmount?: number; // sats per person (for fixed_amount scheme)

  // Join method
  joinMethod: RunstrJoinMethod;
  entryFeeSats?: number; // required if joinMethod is 'paid'

  // Duration
  duration: RunstrDuration;
  startTime: number; // Unix timestamp (seconds)
  endTime: number; // Calculated from duration

  // Payment automation
  creatorHasNWC: boolean; // Creator can auto-payout
}

/**
 * Extended SatlantisEvent with RUNSTR-specific configuration
 */
export interface RunstrEvent extends SatlantisEvent {
  /** RUNSTR-specific configuration parsed from tags */
  runstrConfig?: RunstrEventConfig;

  /** True if event has 'runstr' tag */
  isRunstrEvent: boolean;

  /** Creator's pubkey matches current user */
  isCreator?: boolean;
}

// ============================================================================
// Form State
// ============================================================================

/**
 * Form state for event creation wizard
 */
export interface RunstrEventFormState {
  title: string;
  description: string;
  activityType: RunstrActivityType;
  scoringType: RunstrScoringType;
  targetDistance: string; // String for input field
  duration: RunstrDuration;
  joinMethod: RunstrJoinMethod;
  entryFee: string; // String for input field
  payoutScheme: RunstrPayoutScheme;
  prizePool: string; // String for input field
  fixedPayout: string; // String for input field
}

/**
 * Default form state
 */
export const DEFAULT_FORM_STATE: RunstrEventFormState = {
  title: '',
  description: '',
  activityType: 'running',
  scoringType: 'fastest_time',
  targetDistance: '5',
  duration: '1d',
  joinMethod: 'open',
  entryFee: '',
  payoutScheme: 'winner_takes_all',
  prizePool: '',
  fixedPayout: '',
};

// ============================================================================
// Distance Presets
// ============================================================================

export interface DistancePreset {
  label: string;
  value: number; // km
  tags: string[]; // Additional Nostr tags
}

export const DISTANCE_PRESETS: DistancePreset[] = [
  { label: '5K', value: 5, tags: ['5k'] },
  { label: '10K', value: 10, tags: ['10k'] },
  { label: '21K', value: 21.1, tags: ['half-marathon', 'half'] },
  { label: '42K', value: 42.2, tags: ['marathon'] },
];

// ============================================================================
// Payout Calculations
// ============================================================================

export interface PayoutRecipient {
  npub: string;
  rank: number;
  lightningAddress?: string;
}

export interface PayoutCalculation {
  recipient: PayoutRecipient;
  amountSats: number;
  percentage?: number;
}

/**
 * Calculate payout amounts based on scheme
 */
export function calculatePayouts(
  prizePoolSats: number,
  payoutScheme: RunstrPayoutScheme,
  recipients: PayoutRecipient[],
  fixedAmountPerPerson?: number
): PayoutCalculation[] {
  if (recipients.length === 0 || prizePoolSats <= 0) {
    return [];
  }

  switch (payoutScheme) {
    case 'winner_takes_all': {
      const winner = recipients.find((r) => r.rank === 1);
      if (!winner) return [];
      return [{ recipient: winner, amountSats: prizePoolSats, percentage: 100 }];
    }

    case 'top_3_split': {
      const payouts: PayoutCalculation[] = [];
      const splits = [0.6, 0.25, 0.15];

      for (let rank = 1; rank <= Math.min(3, recipients.length); rank++) {
        const recipient = recipients.find((r) => r.rank === rank);
        if (recipient) {
          const percentage = splits[rank - 1] * 100;
          payouts.push({
            recipient,
            amountSats: Math.floor(prizePoolSats * splits[rank - 1]),
            percentage,
          });
        }
      }
      return payouts;
    }

    case 'random_lottery': {
      // Random selection happens at event end
      // For calculation, assume any participant could win
      const randomIndex = Math.floor(Math.random() * recipients.length);
      const winner = recipients[randomIndex];
      return [{ recipient: winner, amountSats: prizePoolSats, percentage: 100 }];
    }

    case 'fixed_amount': {
      if (!fixedAmountPerPerson || fixedAmountPerPerson <= 0) {
        return [];
      }

      // Cap at available prize pool
      const maxRecipients = Math.floor(prizePoolSats / fixedAmountPerPerson);
      const eligibleRecipients = recipients.slice(0, maxRecipients);

      return eligibleRecipients.map((recipient) => ({
        recipient,
        amountSats: fixedAmountPerPerson,
      }));
    }
  }
}

// ============================================================================
// Validation
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate event form state
 */
export function validateEventForm(form: RunstrEventFormState): ValidationError[] {
  const errors: ValidationError[] = [];

  // Title required
  if (!form.title.trim()) {
    errors.push({ field: 'title', message: 'Event name is required' });
  }

  // Distance required for fastest_time
  if (form.scoringType === 'fastest_time') {
    const distance = parseFloat(form.targetDistance);
    if (isNaN(distance) || distance <= 0) {
      errors.push({ field: 'targetDistance', message: 'Target distance is required' });
    }
  }

  // Entry fee required for paid events
  if (form.joinMethod === 'paid') {
    const entryFee = parseInt(form.entryFee, 10);
    if (isNaN(entryFee) || entryFee <= 0) {
      errors.push({ field: 'entryFee', message: 'Entry fee is required for paid events' });
    }
  }

  // Prize pool validation (optional but if set, must be positive)
  if (form.prizePool) {
    const prizePool = parseInt(form.prizePool, 10);
    if (isNaN(prizePool) || prizePool < 0) {
      errors.push({ field: 'prizePool', message: 'Prize pool must be a positive number' });
    }
  }

  // Fixed payout required if scheme is fixed_amount
  if (form.payoutScheme === 'fixed_amount') {
    const fixedPayout = parseInt(form.fixedPayout, 10);
    if (isNaN(fixedPayout) || fixedPayout <= 0) {
      errors.push({
        field: 'fixedPayout',
        message: 'Fixed payout amount is required',
      });
    }
  }

  // Payout scheme validation for participation
  if (
    form.scoringType === 'participation' &&
    !['random_lottery', 'fixed_amount'].includes(form.payoutScheme)
  ) {
    errors.push({
      field: 'payoutScheme',
      message: 'Participation events can only use Lottery or Fixed Amount payout',
    });
  }

  return errors;
}
