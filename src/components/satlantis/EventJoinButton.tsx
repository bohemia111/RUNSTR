/**
 * EventJoinButton - Smart join/pay button for Satlantis events
 *
 * Shows different states based on event configuration and user status:
 * - "Join Event" for free events
 * - "Pay to Join (X sats)" for paid events
 * - "Joined ✓" if user already RSVPd
 * - Disabled for ended events
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import {
  SatlantisEventJoinService,
  InvoiceResult,
} from '../../services/satlantis/SatlantisEventJoinService';
import type { SatlantisEvent } from '../../types/satlantis';

interface EventJoinButtonProps {
  event: SatlantisEvent;
  onJoinSuccess?: () => void;
  onPaymentRequired?: (invoiceResult: InvoiceResult) => void;
  onError?: (error: string) => void;
}

type ButtonState =
  | 'loading'
  | 'join_free'
  | 'join_paid'
  | 'joined'
  | 'ended'
  | 'error'
  | 'verifying' // Verifying payment for paid events
  | 'retry_pending'; // Has pending payment that needs retry

export const EventJoinButton: React.FC<EventJoinButtonProps> = ({
  event,
  onJoinSuccess,
  onPaymentRequired,
  onError,
}) => {
  const [state, setState] = useState<ButtonState>('loading');
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimisticJoined, setOptimisticJoined] = useState(false); // Optimistic UI

  // Check initial state
  useEffect(() => {
    checkJoinStatus();
  }, [event.id]);

  const checkJoinStatus = useCallback(async () => {
    try {
      // Check if event has ended
      const now = Math.floor(Date.now() / 1000);
      if (now > event.endTime) {
        setState('ended');
        return;
      }

      // Check if user already joined
      const hasJoined = await SatlantisEventJoinService.hasUserJoined(event);
      if (hasJoined) {
        setState('joined');
        setOptimisticJoined(false); // Clear optimistic state if actually joined
        return;
      }

      // Check for pending join (payment made but RSVP failed)
      const pendingJoin = await SatlantisEventJoinService.getPendingJoinForEvent(event.id);
      if (pendingJoin) {
        setState('retry_pending');
        return;
      }

      // Determine join type
      const requirements =
        SatlantisEventJoinService.getJoinRequirements(event);
      if (!requirements.canJoin) {
        setState('ended');
      } else if (requirements.requiresPayment) {
        setState('join_paid');
      } else {
        setState('join_free');
      }
    } catch (error) {
      console.error('[EventJoinButton] Error checking status:', error);
      setState('error');
    }
  }, [event]);

  const handlePress = useCallback(async () => {
    if (isProcessing) return;

    setIsProcessing(true);

    try {
      if (state === 'join_free') {
        // Optimistic UI - show as joined immediately
        setOptimisticJoined(true);

        // Free join - publish RSVP directly
        const result = await SatlantisEventJoinService.joinEvent(event);

        if (result.success) {
          setState('joined');
          onJoinSuccess?.();
        } else {
          // Revert optimistic state on failure
          setOptimisticJoined(false);
          onError?.(result.error || 'Failed to join event');
        }
      } else if (state === 'join_paid') {
        // Paid join - generate invoice first
        const invoiceResult =
          await SatlantisEventJoinService.generateEntryInvoice(event);

        if (invoiceResult.success && invoiceResult.invoice) {
          onPaymentRequired?.(invoiceResult);
        } else {
          onError?.(invoiceResult.error || 'Failed to generate invoice');
        }
      } else if (state === 'retry_pending') {
        // Retry pending join - payment already made
        const pendingJoin = await SatlantisEventJoinService.getPendingJoinForEvent(event.id);
        if (pendingJoin) {
          setOptimisticJoined(true);

          // Skip verification since we already verified before saving
          const result = await SatlantisEventJoinService.joinEvent(
            event,
            pendingJoin.paymentProof,
            true // skipVerification
          );

          if (result.success) {
            setState('joined');
            onJoinSuccess?.();
          } else {
            setOptimisticJoined(false);
            onError?.(result.error || 'Failed to join event');
          }
        }
      }
    } catch (error) {
      console.error('[EventJoinButton] Error:', error);
      setOptimisticJoined(false);
      onError?.(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsProcessing(false);
    }
  }, [state, event, isProcessing, onJoinSuccess, onPaymentRequired, onError]);

  // Refresh join status (called after payment completion)
  const refreshStatus = useCallback(() => {
    checkJoinStatus();
  }, [checkJoinStatus]);

  // Use optimistic state for display
  const isJoined = state === 'joined' || optimisticJoined;

  // Render based on state
  const renderContent = () => {
    if (state === 'loading' || (isProcessing && !optimisticJoined)) {
      return <ActivityIndicator size="small" color={theme.colors.background} />;
    }

    // Show joined state (actual or optimistic)
    if (isJoined) {
      return (
        <View style={styles.joinedContent}>
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={theme.colors.success}
          />
          <Text style={styles.joinedText}>
            {optimisticJoined && state !== 'joined' ? 'Joining...' : 'Joined'}
          </Text>
        </View>
      );
    }

    switch (state) {
      case 'ended':
        return <Text style={styles.endedText}>Event Ended</Text>;

      case 'join_free':
        return <Text style={styles.buttonText}>Join Event</Text>;

      case 'join_paid':
        return (
          <Text style={styles.buttonText}>
            Pay to Join ({event.entryFeeSats?.toLocaleString()} sats)
          </Text>
        );

      case 'verifying':
        return (
          <View style={styles.verifyingContent}>
            <ActivityIndicator size="small" color={theme.colors.background} />
            <Text style={styles.buttonText}>Verifying...</Text>
          </View>
        );

      case 'retry_pending':
        return (
          <View style={styles.retryContent}>
            <Ionicons name="refresh" size={18} color={theme.colors.background} />
            <Text style={styles.buttonText}>Retry Join</Text>
          </View>
        );

      case 'error':
        return <Text style={styles.errorText}>Error</Text>;

      default:
        return <Text style={styles.buttonText}>Join</Text>;
    }
  };

  // retry_pending should be tappable (not disabled)
  const isDisabled =
    state === 'loading' ||
    isJoined ||
    state === 'ended' ||
    state === 'error' ||
    state === 'verifying' ||
    (isProcessing && state !== 'retry_pending');

  const buttonStyle = [
    styles.button,
    isJoined && styles.buttonJoined,
    state === 'ended' && styles.buttonEnded,
    state === 'join_paid' && styles.buttonPaid,
    state === 'retry_pending' && styles.buttonRetry,
    isDisabled && !isJoined && styles.buttonDisabled,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

// Export refresh function type for parent components
export type EventJoinButtonRef = {
  refreshStatus: () => void;
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonPaid: {
    backgroundColor: theme.colors.orangeBright,
  },
  buttonJoined: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.success,
  },
  buttonEnded: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
  },
  joinedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  joinedText: {
    color: theme.colors.success,
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
  },
  endedText: {
    color: theme.colors.textMuted,
    fontSize: 16,
    fontWeight: theme.typography.weights.medium,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: theme.typography.weights.medium,
  },
  buttonRetry: {
    backgroundColor: theme.colors.orangeBright,
  },
  verifyingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});

export default EventJoinButton;
