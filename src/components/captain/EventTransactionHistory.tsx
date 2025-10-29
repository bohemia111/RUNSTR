/**
 * EventTransactionHistory - Shows incoming payments for paid events
 * Only available for captains with NWC wallets configured
 * Displays transaction list filtered by event date range and entry fee amount
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { NWCWalletService } from '../../services/wallet/NWCWalletService';
import type { EventJoinRequest } from '../../services/events/EventJoinRequestService';

interface Transaction {
  type: 'incoming' | 'outgoing';
  invoice?: string;
  description?: string;
  preimage?: string;
  payment_hash: string;
  amount: number;
  fees_paid?: number;
  created_at: number;
  settled_at?: number;
  metadata?: any;
}

interface EventTransactionHistoryProps {
  eventId: string;
  eventName: string;
  eventStartDate: number; // Unix timestamp
  entryFee: number; // Amount in sats
  pendingJoinRequests?: EventJoinRequest[]; // Join requests awaiting approval
  approvedParticipants?: string[]; // List of approved participant pubkeys
  onApproveJoinRequest?: (request: EventJoinRequest) => Promise<void>; // Approval callback
  style?: any;
}

export const EventTransactionHistory: React.FC<
  EventTransactionHistoryProps
> = ({
  eventId,
  eventName,
  eventStartDate,
  entryFee,
  pendingJoinRequests,
  approvedParticipants,
  onApproveJoinRequest,
  style
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNWC, setHasNWC] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const walletService = NWCWalletService;

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if captain has NWC configured
      const nwcConfigured = await walletService.hasNWCConfigured();
      setHasNWC(nwcConfigured);

      if (!nwcConfigured) {
        setIsLoading(false);
        return;
      }

      // Fetch transactions from event start date to now
      const now = Math.floor(Date.now() / 1000);
      const result = await walletService.listTransactions({
        from: eventStartDate,
        until: now,
        type: 'incoming',
        limit: 100,
      });

      if (result.success && result.transactions) {
        // Filter transactions that match entry fee (with 1% tolerance for fees)
        const tolerance = Math.max(1, Math.floor(entryFee * 0.01));
        const matchingTransactions = result.transactions.filter(
          (tx: Transaction) =>
            tx.type === 'incoming' &&
            tx.amount >= entryFee - tolerance &&
            tx.amount <= entryFee + tolerance
        );

        setTransactions(matchingTransactions);
      } else {
        setError(result.error || 'Failed to load transactions');
      }
    } catch (err) {
      console.error('Failed to load event transactions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAmount = (amount: number): string => {
    return `${amount.toLocaleString()} sats`;
  };

  /**
   * Find matching join request for a transaction
   * Priority 1: Exact payment hash match
   * Priority 2: Timestamp + amount match (within 5 minutes)
   */
  const findMatchingRequest = (tx: Transaction): EventJoinRequest | null => {
    if (!pendingJoinRequests || pendingJoinRequests.length === 0) return null;

    // Priority 1: Exact payment hash match
    if (tx.payment_hash) {
      const hashMatch = pendingJoinRequests.find(
        (r) => r.paymentHash === tx.payment_hash
      );
      if (hashMatch) return hashMatch;
    }

    // Priority 2: Timestamp + amount match (within 5 minutes)
    const timeTolerance = 5 * 60; // 5 minutes in seconds
    const txTimestamp = tx.settled_at || tx.created_at;

    const timeAmountMatch = pendingJoinRequests.find((r) => {
      if (!r.paymentTimestamp || !r.amountPaid) return false;

      const timeDiff = Math.abs(r.paymentTimestamp - txTimestamp);
      const amountMatch = r.amountPaid === tx.amount; // Already filtered to ±1% in loadTransactions

      return timeDiff <= timeTolerance && amountMatch;
    });

    return timeAmountMatch || null;
  };

  /**
   * Check if a join request's user is already approved
   */
  const isAlreadyApproved = (request: EventJoinRequest): boolean => {
    return approvedParticipants?.includes(request.requesterId) || false;
  };

  /**
   * Handle approval from transaction history
   */
  const handleApproveMatch = async (request: EventJoinRequest) => {
    if (!onApproveJoinRequest) return;

    try {
      setIsLoading(true);
      await onApproveJoinRequest(request);
      console.log('✅ Join request approved from transaction history');
    } catch (error) {
      console.error('❌ Failed to approve join request:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show if captain doesn't have NWC
  if (!hasNWC && !isLoading) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="wallet" size={20} color={theme.colors.accent} />
          <Text style={styles.title}>Payment History</Text>
          {transactions.length > 0 && !expanded && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{transactions.length}</Text>
            </View>
          )}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.accent} />
              <Text style={styles.loadingText}>Loading transactions...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={24} color="#FF5252" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                onPress={loadTransactions}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : transactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="receipt-outline"
                size={32}
                color={theme.colors.textMuted}
              />
              <Text style={styles.emptyText}>No payments received yet</Text>
              <Text style={styles.emptySubtext}>
                Payments matching {formatAmount(entryFee)} will appear here
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.transactionList}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isLoading}
                  onRefresh={loadTransactions}
                  tintColor={theme.colors.accent}
                />
              }
            >
              {transactions.map((tx, index) => {
                const matchedRequest = findMatchingRequest(tx);
                const alreadyApproved =
                  matchedRequest && isAlreadyApproved(matchedRequest);

                return (
                  <View
                    key={tx.payment_hash || index}
                    style={styles.transactionCard}
                  >
                    <View style={styles.transactionHeader}>
                      <View style={styles.transactionIcon}>
                        <Ionicons name="arrow-down" size={16} color="#FF9D42" />
                      </View>
                      <View style={styles.transactionDetails}>
                        <Text style={styles.transactionAmount}>
                          +{formatAmount(tx.amount)}
                        </Text>
                        <Text style={styles.transactionDate}>
                          {formatDate(tx.settled_at || tx.created_at)}
                        </Text>
                      </View>
                      <View style={styles.verifiedBadge}>
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color="#FF9D42"
                        />
                        <Text style={styles.verifiedText}>Verified</Text>
                      </View>
                    </View>

                    {/* Matched participant section */}
                    {matchedRequest && (
                      <View style={styles.matchedRequestSection}>
                        <View style={styles.matchedRequestHeader}>
                          <Ionicons
                            name="person-circle-outline"
                            size={16}
                            color={theme.colors.textMuted}
                          />
                          <Text style={styles.matchedRequestName}>
                            {matchedRequest.requesterName ||
                              `${matchedRequest.requesterId.slice(0, 8)}...`}
                          </Text>
                          {matchedRequest.message && (
                            <Text
                              style={styles.matchedRequestMessage}
                              numberOfLines={1}
                            >
                              • {matchedRequest.message}
                            </Text>
                          )}
                        </View>

                        {alreadyApproved ? (
                          <View style={styles.alreadyApprovedBadge}>
                            <Ionicons
                              name="checkmark-circle"
                              size={14}
                              color="#FF9D42"
                            />
                            <Text style={styles.alreadyApprovedText}>
                              Approved
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.approveButton}
                            onPress={() => handleApproveMatch(matchedRequest)}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name="add-circle"
                              size={16}
                              color={theme.colors.accentText}
                            />
                            <Text style={styles.approveButtonText}>
                              Approve Join
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {tx.description && (
                      <Text
                        style={styles.transactionDescription}
                        numberOfLines={1}
                      >
                        {tx.description}
                      </Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Showing payments of ~{formatAmount(entryFee)} since{' '}
              {formatDate(eventStartDate)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  badge: {
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.accentText,
  },
  content: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#FF5252',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.accentText,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textMuted,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    marginTop: 4,
  },
  transactionList: {
    maxHeight: 300,
    padding: 12,
  },
  transactionCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  transactionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 157, 66, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionDetails: {
    flex: 1,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF9D42',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 157, 66, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF9D42',
  },
  transactionDescription: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 6,
    marginLeft: 38,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: 12,
  },
  footerText: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
  matchedRequestSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  matchedRequestHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchedRequestName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  matchedRequestMessage: {
    fontSize: 12,
    color: theme.colors.textMuted,
    flex: 1,
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.accent, // #FF7B1C orange
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.accentText, // #000000 black on orange
  },
  alreadyApprovedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 157, 66, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  alreadyApprovedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9D42',
  },
});
