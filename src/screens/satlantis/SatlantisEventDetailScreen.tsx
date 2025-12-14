/**
 * SatlantisEventDetailScreen - Event detail with participants and leaderboard
 * Shows event metadata, participant count, and fastest-time leaderboard
 * Supports RUNSTR event joining with free/paid options
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { useSatlantisEventDetail } from '../../hooks/useSatlantisEvents';
import { SatlantisLeaderboard } from '../../components/satlantis/SatlantisLeaderboard';
import { EventJoinButton } from '../../components/satlantis/EventJoinButton';
import { EventCreatorControls } from '../../components/satlantis/EventCreatorControls';
import { EventPaymentModal } from '../../components/event/EventPaymentModal';
import { SatlantisEventJoinService } from '../../services/satlantis/SatlantisEventJoinService';
import { CustomAlert } from '../../components/ui/CustomAlert';
import { useAuth } from '../../contexts/AuthContext';
import { formatEventDateTime } from '../../types/satlantis';
import type { InvoiceResult, PendingJoin } from '../../services/satlantis/SatlantisEventJoinService';
import { nip19 } from 'nostr-tools';

interface SatlantisEventDetailScreenProps {
  route: {
    params: {
      eventId: string;
      eventPubkey: string;
    };
  };
  navigation: any;
}

// Debug Section Component - for troubleshooting RSVP issues
const DebugSection: React.FC<{
  eventId: string;
  eventPubkey: string;
  onRefresh: () => void;
  currentUserHexPubkey: string | null;
}> = ({ eventId, eventPubkey, onRefresh, currentUserHexPubkey }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const handleClearLocalJoin = async () => {
    console.log('[DEBUG] Clearing local join for event:', eventId);
    await SatlantisEventJoinService.debugClearLocalJoin(eventPubkey, eventId);
    setDebugInfo('Local join cleared! You can now re-join.');
    // Wait a moment then refresh
    setTimeout(() => {
      onRefresh();
    }, 500);
  };

  const handleForceLocalJoin = async () => {
    if (!currentUserHexPubkey) {
      setDebugInfo('Error: No user pubkey available');
      return;
    }
    console.log('[DEBUG] Force adding local join for user:', currentUserHexPubkey.slice(0, 16) + '...');
    await SatlantisEventJoinService.debugForceLocalJoin(eventPubkey, eventId, currentUserHexPubkey);
    setDebugInfo('Force joined locally! Refreshing...');
    setTimeout(() => {
      onRefresh();
    }, 500);
  };

  const handleForceReJoin = async () => {
    if (!currentUserHexPubkey) {
      setDebugInfo('Error: No user pubkey available');
      return;
    }
    setDebugInfo('Publishing new RSVP to Nostr...');
    console.log('[DEBUG] Force re-joining event with pubkey:', currentUserHexPubkey.slice(0, 16) + '...');

    // First clear local join to allow re-joining
    await SatlantisEventJoinService.debugClearLocalJoin(eventPubkey, eventId);

    // Create a minimal SatlantisEvent object for joinEvent
    const minimalEvent = {
      id: eventId,
      pubkey: eventPubkey,
      title: 'Event',
      startTime: 0,
      endTime: 0,
      sportType: 'running',
      joinMethod: 'open',
    } as any;

    // Publish new RSVP
    const result = await SatlantisEventJoinService.joinEvent(minimalEvent);

    if (result.success) {
      setDebugInfo(`✅ New RSVP published!\nEvent ID: ${result.rsvpEventId?.slice(0, 16)}...\nYour pubkey: ${currentUserHexPubkey.slice(0, 16)}...\n\nRefreshing...`);
      setTimeout(() => {
        onRefresh();
      }, 1000);
    } else {
      setDebugInfo(`❌ Failed: ${result.error}`);
    }
  };

  const handleShowDebugInfo = async () => {
    const allJoins = await SatlantisEventJoinService.debugGetAllLocalJoins();
    const key = `${eventPubkey}:${eventId}`;
    const eventJoin = allJoins[key];
    const info = [
      `Event ID: ${eventId}`,
      `Event Pubkey: ${eventPubkey.slice(0, 16)}...`,
      `Your Pubkey: ${currentUserHexPubkey?.slice(0, 16) || 'N/A'}...`,
      `---`,
      `Local join for this event:`,
      eventJoin ? JSON.stringify(eventJoin, null, 2) : 'None',
      `---`,
      `All local joins count: ${Object.keys(allJoins).length}`,
    ];
    setDebugInfo(info.join('\n'));
  };

  if (!isExpanded) {
    return (
      <TouchableOpacity
        style={styles.debugToggle}
        onPress={() => setIsExpanded(true)}
      >
        <Ionicons name="bug" size={14} color={theme.colors.textMuted} />
        <Text style={styles.debugToggleText}>Debug Tools</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.debugSection}>
      <TouchableOpacity
        style={styles.debugHeader}
        onPress={() => setIsExpanded(false)}
      >
        <Ionicons name="bug" size={16} color={theme.colors.accent} />
        <Text style={styles.debugTitle}>RSVP Debug Tools</Text>
        <Ionicons name="chevron-up" size={16} color={theme.colors.textMuted} />
      </TouchableOpacity>

      <View style={styles.debugButtonRow}>
        <TouchableOpacity style={styles.debugButton} onPress={handleClearLocalJoin}>
          <Text style={styles.debugButtonText}>Clear Local Join</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.debugButton} onPress={handleForceLocalJoin}>
          <Text style={styles.debugButtonText}>Force Local Join</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.debugButton, { backgroundColor: theme.colors.accent }]} onPress={handleForceReJoin}>
        <Text style={[styles.debugButtonText, { fontWeight: 'bold' }]}>🔄 Force Re-Join (Publish RSVP)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.debugButton} onPress={handleShowDebugInfo}>
        <Text style={styles.debugButtonText}>Show Debug Info</Text>
      </TouchableOpacity>

      {debugInfo ? (
        <View style={styles.debugInfoBox}>
          <Text style={styles.debugInfoText}>{debugInfo}</Text>
        </View>
      ) : null}

      <Text style={styles.debugHint}>
        Use these tools if your join isn't being detected. Check Metro logs for detailed output.
      </Text>
    </View>
  );
};

export const SatlantisEventDetailScreen: React.FC<SatlantisEventDetailScreenProps> = ({
  route,
  navigation,
}) => {
  const { eventId, eventPubkey } = route.params;
  const { currentUser } = useAuth();

  const {
    event,
    participants,
    leaderboard,
    eventStatus,
    isLoading,
    isLoadingLeaderboard,
    error,
    refresh,
    addLocalParticipant,
  } = useSatlantisEventDetail(eventPubkey, eventId);

  // Get user's hex pubkey for optimistic UI
  const currentUserHexPubkey = React.useMemo(() => {
    if (!currentUser?.npub) return null;
    try {
      const decoded = nip19.decode(currentUser.npub);
      return decoded.data as string;
    } catch {
      return null;
    }
  }, [currentUser?.npub]);

  // Payment modal state
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [pendingInvoice, setPendingInvoice] = useState<InvoiceResult | null>(
    null
  );

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
  });

  // Pending payment state
  const [pendingPayment, setPendingPayment] = useState<PendingJoin | null>(null);

  // Check for pending payments on mount
  useEffect(() => {
    const checkPendingPayments = async () => {
      const pending = await SatlantisEventJoinService.getPendingJoinForEvent(eventId);
      setPendingPayment(pending);
    };

    checkPendingPayments();
  }, [eventId]);

  // Handle successful join
  const handleJoinSuccess = useCallback(() => {
    setPendingPayment(null); // Clear pending payment on success

    // Add user to local participant list immediately for optimistic UI
    if (currentUserHexPubkey) {
      addLocalParticipant(currentUserHexPubkey);
    }

    setAlertConfig({
      title: 'Joined!',
      message: 'You have successfully joined this event.',
    });
    setAlertVisible(true);
    refresh();
  }, [refresh, currentUserHexPubkey, addLocalParticipant]);

  // Handle payment required (paid events)
  const handlePaymentRequired = useCallback((invoiceResult: InvoiceResult) => {
    setPendingInvoice(invoiceResult);
    setPaymentModalVisible(true);
  }, []);

  // Handle payment confirmation
  const handlePaymentConfirmed = useCallback(async () => {
    if (!event || !pendingInvoice?.invoice) return;

    setPaymentModalVisible(false);

    // Join event with payment proof
    const result = await SatlantisEventJoinService.joinEvent(
      event,
      pendingInvoice.invoice
    );

    if (result.success) {
      // Add user to local participant list immediately for optimistic UI
      if (currentUserHexPubkey) {
        addLocalParticipant(currentUserHexPubkey);
      }

      setAlertConfig({
        title: 'Joined!',
        message: 'Payment received. You have joined the event.',
      });
      setAlertVisible(true);
      refresh();
    } else {
      setAlertConfig({
        title: 'Error',
        message: result.error || 'Failed to join event',
      });
      setAlertVisible(true);
    }

    setPendingInvoice(null);
  }, [event, pendingInvoice, refresh, currentUserHexPubkey, addLocalParticipant]);

  // Handle join error
  const handleJoinError = useCallback((error: string) => {
    setAlertConfig({
      title: 'Error',
      message: error,
    });
    setAlertVisible(true);
  }, []);

  const getStatusStyles = () => {
    switch (eventStatus) {
      case 'live':
        return { backgroundColor: theme.colors.accent };
      case 'upcoming':
        return { backgroundColor: theme.colors.accent };
      case 'ended':
        return { backgroundColor: theme.colors.textMuted };
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Loading event...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons
            name="warning-outline"
            size={48}
            color={theme.colors.textMuted}
          />
          <Text style={styles.errorText}>{error || 'Event not found'}</Text>
          <TouchableOpacity
            style={styles.backButtonError}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonErrorText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
      >
        {/* Event Image */}
        {event.image ? (
          <Image source={{ uri: event.image }} style={styles.eventImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons
              name="trophy-outline"
              size={48}
              color={theme.colors.textMuted}
            />
          </View>
        )}

        {/* Event Info */}
        <View style={styles.infoSection}>
          {/* Status Badge */}
          <View style={[styles.statusBadge, getStatusStyles()]}>
            <Text style={styles.statusText}>{eventStatus.toUpperCase()}</Text>
          </View>

          <Text style={styles.eventTitle}>{event.title}</Text>

          {/* Date/Time */}
          <View style={styles.metaRow}>
            <Ionicons name="calendar" size={18} color={theme.colors.accent} />
            <View style={styles.metaContent}>
              <Text style={styles.metaLabel}>Start</Text>
              <Text style={styles.metaValue}>
                {formatEventDateTime(event.startTime)}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="flag" size={18} color={theme.colors.accent} />
            <View style={styles.metaContent}>
              <Text style={styles.metaLabel}>End</Text>
              <Text style={styles.metaValue}>
                {formatEventDateTime(event.endTime)}
              </Text>
            </View>
          </View>

          {/* Location */}
          {event.location && (
            <View style={styles.metaRow}>
              <Ionicons name="location" size={18} color={theme.colors.accent} />
              <View style={styles.metaContent}>
                <Text style={styles.metaLabel}>Location</Text>
                <Text style={styles.metaValue}>{event.location}</Text>
              </View>
            </View>
          )}

          {/* Distance */}
          {event.distance && (
            <View style={styles.metaRow}>
              <Ionicons
                name="speedometer"
                size={18}
                color={theme.colors.accent}
              />
              <View style={styles.metaContent}>
                <Text style={styles.metaLabel}>Distance</Text>
                <Text style={styles.metaValue}>
                  {event.distance} {event.distanceUnit || 'km'}
                </Text>
              </View>
            </View>
          )}

          {/* Participants count */}
          <View style={styles.metaRow}>
            <Ionicons name="people" size={18} color={theme.colors.accent} />
            <View style={styles.metaContent}>
              <Text style={styles.metaLabel}>Participants</Text>
              <Text style={styles.metaValue}>
                {participants.length} registered
              </Text>
            </View>
          </View>

          {/* Sport Type */}
          <View style={styles.metaRow}>
            <Ionicons name="fitness" size={18} color={theme.colors.accent} />
            <View style={styles.metaContent}>
              <Text style={styles.metaLabel}>Sport</Text>
              <Text style={styles.metaValue}>
                {event.sportType.charAt(0).toUpperCase() +
                  event.sportType.slice(1)}
              </Text>
            </View>
          </View>

          {/* Description */}
          {event.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionTitle}>About</Text>
              <Text style={styles.descriptionText}>{event.description}</Text>
            </View>
          )}

          {/* RUNSTR Event Info */}
          {event.isRunstrEvent && (
            <View style={styles.runstrInfoSection}>
              <Text style={styles.runstrBadge}>RUNSTR EVENT</Text>
              <View style={styles.runstrInfoGrid}>
                {event.scoringType && (
                  <View style={styles.runstrInfoItem}>
                    <Text style={styles.runstrInfoLabel}>Scoring</Text>
                    <Text style={styles.runstrInfoValue}>
                      {event.scoringType === 'fastest_time'
                        ? 'Fastest Time'
                        : event.scoringType === 'most_distance'
                          ? 'Most Distance'
                          : 'Participation'}
                    </Text>
                  </View>
                )}
                {event.payoutScheme && (
                  <View style={styles.runstrInfoItem}>
                    <Text style={styles.runstrInfoLabel}>Payout</Text>
                    <Text style={styles.runstrInfoValue}>
                      {event.payoutScheme === 'winner_takes_all'
                        ? 'Winner Takes All'
                        : event.payoutScheme === 'top_3_split'
                          ? 'Top 3 Split'
                          : event.payoutScheme === 'random_lottery'
                            ? 'Random Lottery'
                            : 'Fixed Amount'}
                    </Text>
                  </View>
                )}
                {event.prizePoolSats && event.prizePoolSats > 0 && (
                  <View style={styles.runstrInfoItem}>
                    <Text style={styles.runstrInfoLabel}>Prize Pool</Text>
                    <Text style={styles.runstrInfoValueHighlight}>
                      {event.prizePoolSats.toLocaleString()} sats
                    </Text>
                  </View>
                )}
                {event.joinMethod === 'paid' && event.entryFeeSats && (
                  <View style={styles.runstrInfoItem}>
                    <Text style={styles.runstrInfoLabel}>Entry Fee</Text>
                    <Text style={styles.runstrInfoValue}>
                      {event.entryFeeSats.toLocaleString()} sats
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Pending Payment Banner */}
          {pendingPayment && (
            <View style={styles.pendingPaymentBanner}>
              <View style={styles.pendingPaymentContent}>
                <Ionicons name="warning" size={20} color={theme.colors.orangeBright} />
                <View style={styles.pendingPaymentText}>
                  <Text style={styles.pendingPaymentTitle}>Payment Saved</Text>
                  <Text style={styles.pendingPaymentMessage}>
                    Your payment of {pendingPayment.amountSats.toLocaleString()} sats was saved.
                    Tap the button below to complete joining.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Join Button */}
          <View style={styles.joinButtonContainer}>
            <EventJoinButton
              event={event}
              onJoinSuccess={handleJoinSuccess}
              onPaymentRequired={handlePaymentRequired}
              onError={handleJoinError}
            />
          </View>
        </View>

        {/* Leaderboard */}
        <View style={styles.leaderboardSection}>
          <SatlantisLeaderboard
            entries={leaderboard}
            isLoading={isLoadingLeaderboard}
            eventStatus={eventStatus}
            currentUserNpub={currentUser?.npub}
          />
        </View>

        {/* Creator Controls - shown only to event creator for RUNSTR events */}
        {event.isRunstrEvent &&
          event.prizePoolSats &&
          event.prizePoolSats > 0 &&
          currentUser?.npub &&
          (() => {
            try {
              const decoded = nip19.decode(currentUser.npub);
              return decoded.data === event.pubkey;
            } catch {
              return false;
            }
          })() && (
            <View style={styles.creatorControlsSection}>
              <EventCreatorControls
                event={event}
                leaderboard={leaderboard}
                onPayoutComplete={refresh}
              />
            </View>
          )}

        {/* Debug Section - for troubleshooting RSVP issues */}
        <DebugSection
          eventId={eventId}
          eventPubkey={eventPubkey}
          onRefresh={refresh}
          currentUserHexPubkey={currentUserHexPubkey}
        />

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Payment Modal */}
      {event && pendingInvoice && (
        <EventPaymentModal
          visible={paymentModalVisible}
          eventName={event.title}
          amountSats={pendingInvoice.amountSats || 0}
          invoice={pendingInvoice.invoice || ''}
          onPaid={handlePaymentConfirmed}
          onCancel={() => {
            setPaymentModalVisible(false);
            setPendingInvoice(null);
          }}
        />
      )}

      {/* Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={[{ text: 'OK', style: 'default', onPress: () => setAlertVisible(false) }]}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginHorizontal: 12,
  },
  headerSpacer: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: theme.colors.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  backButtonError: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.colors.accent,
    borderRadius: 8,
  },
  backButtonErrorText: {
    color: theme.colors.background,
    fontWeight: theme.typography.weights.semiBold,
  },
  eventImage: {
    width: '100%',
    height: 200,
    backgroundColor: theme.colors.border,
  },
  imagePlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: {
    padding: 16,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.background,
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  metaContent: {
    marginLeft: 12,
    flex: 1,
  },
  metaLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  metaValue: {
    fontSize: 15,
    color: theme.colors.text,
    marginTop: 2,
  },
  descriptionSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  leaderboardSection: {
    paddingHorizontal: 16,
  },
  creatorControlsSection: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  bottomPadding: {
    height: 40,
  },
  // RUNSTR Info Section
  runstrInfoSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  runstrBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.accent,
    color: theme.colors.background,
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  runstrInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  runstrInfoItem: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 12,
    minWidth: '45%',
    flex: 1,
  },
  runstrInfoLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  runstrInfoValue: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  runstrInfoValueHighlight: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.accent,
  },
  // Join Button
  joinButtonContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  // Pending Payment Banner
  pendingPaymentBanner: {
    marginTop: 16,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.orangeBright,
    overflow: 'hidden',
  },
  pendingPaymentContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
  },
  pendingPaymentText: {
    flex: 1,
  },
  pendingPaymentTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.orangeBright,
    marginBottom: 4,
  },
  pendingPaymentMessage: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  // Debug Section Styles
  debugToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    opacity: 0.5,
    gap: 6,
  },
  debugToggleText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  debugSection: {
    margin: 16,
    padding: 16,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  debugTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  debugButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  debugButton: {
    flex: 1,
    backgroundColor: theme.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  debugButtonText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  debugInfoBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  debugInfoText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  debugHint: {
    marginTop: 12,
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default SatlantisEventDetailScreen;
