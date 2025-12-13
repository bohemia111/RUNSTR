/**
 * useRunstrEventCreation - Form state and validation for event creation
 *
 * Manages form state, validation, and submission for the event creation modal.
 */

import { useState, useCallback, useMemo } from 'react';
import type {
  RunstrEventFormState,
  RunstrActivityType,
  RunstrScoringType,
  RunstrPayoutScheme,
  RunstrJoinMethod,
  RunstrDuration,
  ValidationError,
} from '../types/runstrEvent';
import {
  DEFAULT_FORM_STATE,
  validateEventForm,
  getValidPayoutSchemes,
} from '../types/runstrEvent';
import {
  RunstrEventPublishService,
  EventPublishResult,
} from '../services/events/RunstrEventPublishService';
import UnifiedSigningService from '../services/auth/UnifiedSigningService';

export interface UseRunstrEventCreationReturn {
  // Form state
  form: RunstrEventFormState;
  updateField: <K extends keyof RunstrEventFormState>(
    field: K,
    value: RunstrEventFormState[K]
  ) => void;
  resetForm: () => void;

  // Validation
  errors: ValidationError[];
  isValid: boolean;

  // Payout scheme options (filtered by scoring type)
  validPayoutSchemes: RunstrPayoutScheme[];

  // Submission
  isSubmitting: boolean;
  submitError: string | null;
  submitEvent: () => Promise<EventPublishResult>;

  // Helpers
  showDistanceInput: boolean;
  showEntryFeeInput: boolean;
  showFixedPayoutInput: boolean;
}

export function useRunstrEventCreation(): UseRunstrEventCreationReturn {
  const [form, setForm] = useState<RunstrEventFormState>(DEFAULT_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Update single field
  const updateField = useCallback(
    <K extends keyof RunstrEventFormState>(
      field: K,
      value: RunstrEventFormState[K]
    ) => {
      setForm((prev) => {
        const updated = { ...prev, [field]: value };

        // Auto-adjust payout scheme if switching to participation
        if (field === 'scoringType' && value === 'participation') {
          const validSchemes = getValidPayoutSchemes('participation');
          if (!validSchemes.includes(updated.payoutScheme)) {
            updated.payoutScheme = 'random_lottery';
          }
        }

        return updated;
      });
      setSubmitError(null);
    },
    []
  );

  // Reset form to defaults
  const resetForm = useCallback(() => {
    setForm(DEFAULT_FORM_STATE);
    setSubmitError(null);
  }, []);

  // Validation
  const errors = useMemo(() => validateEventForm(form), [form]);
  const isValid = errors.length === 0;

  // Valid payout schemes based on scoring type
  const validPayoutSchemes = useMemo(
    () => getValidPayoutSchemes(form.scoringType),
    [form.scoringType]
  );

  // Conditional field visibility
  const showDistanceInput = form.scoringType === 'fastest_time';
  const showEntryFeeInput = form.joinMethod === 'paid';
  const showFixedPayoutInput = form.payoutScheme === 'fixed_amount';

  // Submit event
  const submitEvent = useCallback(async (): Promise<EventPublishResult> => {
    if (!isValid) {
      const errorMsg = errors.map((e) => e.message).join(', ');
      return { success: false, error: errorMsg };
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Get signer from UnifiedSigningService
      const signingService = UnifiedSigningService.getInstance();
      const signer = await signingService.getSigner();

      if (!signer) {
        setSubmitError('Not authenticated');
        return { success: false, error: 'Not authenticated' };
      }

      // Build config from form state
      const config = RunstrEventPublishService.buildConfigFromForm(form);

      // Publish to Nostr
      const result = await RunstrEventPublishService.publishEvent(
        config,
        signer
      );

      if (!result.success) {
        setSubmitError(result.error || 'Failed to create event');
      }

      return result;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error';
      setSubmitError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsSubmitting(false);
    }
  }, [form, isValid, errors]);

  return {
    form,
    updateField,
    resetForm,
    errors,
    isValid,
    validPayoutSchemes,
    isSubmitting,
    submitError,
    submitEvent,
    showDistanceInput,
    showEntryFeeInput,
    showFixedPayoutInput,
  };
}

// ============================================================================
// Preset helpers
// ============================================================================

export const ACTIVITY_OPTIONS: { value: RunstrActivityType; label: string }[] =
  [
    { value: 'running', label: 'Run' },
    { value: 'cycling', label: 'Cycle' },
    { value: 'walking', label: 'Walk' },
  ];

export const SCORING_OPTIONS: { value: RunstrScoringType; label: string }[] = [
  { value: 'fastest_time', label: 'Fastest' },
  { value: 'most_distance', label: 'Distance' },
  { value: 'participation', label: 'All' },
];

export const DURATION_OPTIONS: { value: RunstrDuration; label: string }[] = [
  { value: '1d', label: '1 Day' },
  { value: '1w', label: '1 Week' },
  { value: '1m', label: '1 Month' },
];

export const JOIN_OPTIONS: { value: RunstrJoinMethod; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'paid', label: 'Paid' },
  { value: 'donation', label: 'Donate' },
];

export const PAYOUT_OPTIONS: { value: RunstrPayoutScheme; label: string }[] = [
  { value: 'winner_takes_all', label: 'Winner' },
  { value: 'top_3_split', label: 'Top 3' },
  { value: 'random_lottery', label: 'Lottery' },
  { value: 'fixed_amount', label: 'Fixed' },
];

export const DISTANCE_OPTIONS = [
  { label: '5K', value: '5' },
  { label: '10K', value: '10' },
  { label: '21K', value: '21.1' },
  { label: '42K', value: '42.2' },
];

export default useRunstrEventCreation;
