/**
 * EventCreatorControls - Creator management UI for RUNSTR events
 *
 * Shows event management options for the creator:
 * - Payout status and history
 * - Manual payout trigger button
 * - Winner list with payment status
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import {
  RunstrAutoPayoutService,
  PayoutStatus,
  PayoutCalculation,
} from '../../services/events/RunstrAutoPayoutService';
import { NWCWalletService } from '../../services/wallet/NWCWalletService';
import type { SatlantisEvent, SatlantisLeaderboardEntry } from '../../types/satlantis';

interface EventCreatorControlsProps {
  event: SatlantisEvent;
  leaderboard: SatlantisLeaderboardEntry[];
  onPayoutComplete?: () => void;
}

export const EventCreatorControls: React.FC<EventCreatorControlsProps> = ({
  event,
  leaderboard,
  onPayoutComplete,
}) => {
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasNWC, setHasNWC] = useState(false);
  const [calculatedPayouts, setCalculatedPayouts] = useState<PayoutCalculation[]>([]);

  // Load initial status
  useEffect(() => {
    loadStatus();
  }, [event.id]);

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const [status, nwcConfigured] = await Promise.all([
        RunstrAutoPayoutService.getPayoutStatus(event.id),
        NWCWalletService.hasNWCConfigured(),
      ]);

      setPayoutStatus(status);
      setHasNWC(nwcConfigured);

      // Calculate what payouts would be
      if (leaderboard.length > 0) {
        const payouts = RunstrAutoPayoutService.calculatePayouts(event, leaderboard);
        setCalculatedPayouts(payouts);
      }
    } catch (error) {
      console.error('[EventCreatorControls] Error loading status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [event.id, leaderboard]);

  const handlePayoutPress = useCallback(async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      // Calculate payouts
      const payouts = RunstrAutoPayoutService.calculatePayouts(event, leaderboard);
      if (payouts.length === 0) {
        console.log('[EventCreatorControls] No payouts to execute');
        return;
      }

      // Execute payouts
      const result = await RunstrAutoPayoutService.executePayouts(event, payouts);

      // Reload status
      await loadStatus();

      onPayoutComplete?.();
    } catch (error) {
      console.error('[EventCreatorControls] Payout error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [event, leaderboard, isProcessing, loadStatus, onPayoutComplete]);

  // Check payout eligibility
  const { canPayout, reason } = RunstrAutoPayoutService.canAutoPayoutEvent(event);
  const now = Math.floor(Date.now() / 1000);
  const eventEnded = now > event.endTime;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
      </View>
    );
  }

  // Event still running
  if (!eventEnded) {
    return (
      <View style={styles.container}>
        <View style={styles.infoBox}>
          <Ionicons name="time-outline" size={20} color={theme.colors.textMuted} />
          <Text style={styles.infoText}>
            Payouts available after event ends
          </Text>
        </View>
      </View>
    );
  }

  // Already paid out
  if (payoutStatus?.status === 'completed') {
    return (
      <View style={styles.container}>
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
          <Text style={styles.successText}>
            Payouts Complete ({payoutStatus.paidAmount.toLocaleString()} sats)
          </Text>
        </View>

        {/* Show payout breakdown */}
        {payoutStatus.results.length > 0 && (
          <View style={styles.payoutList}>
            <Text style={styles.listTitle}>Payout History</Text>
            {payoutStatus.results.map((result, index) => (
              <View key={index} style={styles.payoutItem}>
                <Text style={styles.payoutNpub}>
                  {result.npub.substring(0, 12)}...
                </Text>
                <View style={styles.payoutAmountRow}>
                  <Text style={styles.payoutAmount}>
                    {result.amountSats.toLocaleString()} sats
                  </Text>
                  <Ionicons
                    name={result.success ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={result.success ? theme.colors.success : '#FF3B30'}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  // Partial payout
  if (payoutStatus?.status === 'partial') {
    return (
      <View style={styles.container}>
        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={20} color="#FF9500" />
          <Text style={styles.warningText}>
            Partial payout - some payments failed
          </Text>
        </View>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={handlePayoutPress}
          disabled={isProcessing || !hasNWC}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={theme.colors.background} />
          ) : (
            <Text style={styles.retryButtonText}>Retry Failed Payments</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Ready to payout
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Event Payouts</Text>

      {/* Payout Preview */}
      {calculatedPayouts.length > 0 && (
        <View style={styles.previewBox}>
          <Text style={styles.previewTitle}>Payout Preview</Text>
          <Text style={styles.schemeText}>
            {RunstrAutoPayoutService.getPayoutSchemeDescription(
              event.payoutScheme || 'winner_takes_all'
            )}
          </Text>

          {calculatedPayouts.map((payout, index) => (
            <View key={index} style={styles.previewItem}>
              <View style={styles.previewRank}>
                <Text style={styles.previewRankText}>#{payout.rank}</Text>
              </View>
              <Text style={styles.previewNpub}>
                {payout.npub.substring(0, 12)}...
              </Text>
              <Text style={styles.previewAmount}>
                {payout.amountSats.toLocaleString()} sats
                {payout.percentage && (
                  <Text style={styles.previewPercent}> ({payout.percentage}%)</Text>
                )}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* NWC Status */}
      {!hasNWC && (
        <View style={styles.warningBox}>
          <Ionicons name="wallet-outline" size={20} color="#FF9500" />
          <Text style={styles.warningText}>
            Set up NWC wallet in Settings to enable auto-payout
          </Text>
        </View>
      )}

      {/* Payout Button */}
      <TouchableOpacity
        style={[
          styles.payoutButton,
          (!hasNWC || !canPayout || calculatedPayouts.length === 0) &&
            styles.payoutButtonDisabled,
        ]}
        onPress={handlePayoutPress}
        disabled={isProcessing || !hasNWC || !canPayout || calculatedPayouts.length === 0}
      >
        {isProcessing ? (
          <ActivityIndicator size="small" color={theme.colors.background} />
        ) : (
          <>
            <Ionicons name="flash" size={20} color={theme.colors.background} />
            <Text style={styles.payoutButtonText}>
              Pay Winners ({event.prizePoolSats?.toLocaleString() || 0} sats)
            </Text>
          </>
        )}
      </TouchableOpacity>

      {!canPayout && reason && (
        <Text style={styles.disabledReason}>{reason}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    marginTop: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 12,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
  },
  infoText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(48, 209, 88, 0.1)',
    borderRadius: 8,
    marginBottom: 12,
  },
  successText: {
    color: theme.colors.success,
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    flex: 1,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 8,
    marginBottom: 12,
  },
  warningText: {
    color: '#FF9500',
    fontSize: 14,
    flex: 1,
  },
  previewBox: {
    padding: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  schemeText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 12,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  previewRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  previewRankText: {
    color: theme.colors.background,
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
  },
  previewNpub: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.text,
  },
  previewAmount: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accent,
  },
  previewPercent: {
    fontWeight: theme.typography.weights.regular,
    color: theme.colors.textMuted,
  },
  payoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    borderRadius: 8,
  },
  payoutButtonDisabled: {
    opacity: 0.5,
  },
  payoutButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
  },
  retryButton: {
    backgroundColor: '#FF9500',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: theme.colors.background,
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
  },
  disabledReason: {
    textAlign: 'center',
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 8,
  },
  payoutList: {
    marginTop: 8,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
  payoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  payoutNpub: {
    fontSize: 13,
    color: theme.colors.text,
  },
  payoutAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payoutAmount: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
});

export default EventCreatorControls;
