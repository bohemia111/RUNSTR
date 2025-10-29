/**
 * EventCaptainDashboardScreen - Event-specific captain management
 * Shows QR code generation, participant management, and join requests
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { QRDisplayModal } from '../components/qr/QRDisplayModal';
import { EventTransactionHistory } from '../components/captain/EventTransactionHistory';
import { EventJoinRequestsSection } from '../components/captain/EventJoinRequestsSection';
import { CustomAlert } from '../components/ui/CustomAlert';
import QRCodeService from '../services/qr/QRCodeService';
import type { EventQRData } from '../services/qr/QRCodeService';
import type { RootStackParamList } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventJoinRequestService } from '../services/events/EventJoinRequestService';
import type { EventJoinRequest } from '../services/events/EventJoinRequestService';
import { NostrListService } from '../services/nostr/NostrListService';
import { UnifiedSigningService } from '../services/auth/UnifiedSigningService';
import { GlobalNDKService } from '../services/nostr/GlobalNDKService';
import { NDKEvent } from '@nostr-dev-kit/ndk';

type EventCaptainDashboardRouteProp = RouteProp<
  RootStackParamList,
  'EventCaptainDashboard'
>;
type EventCaptainDashboardNavigationProp = StackNavigationProp<
  RootStackParamList,
  'EventCaptainDashboard'
>;

interface EventCaptainDashboardScreenProps {
  route: EventCaptainDashboardRouteProp;
  navigation: EventCaptainDashboardNavigationProp;
}

export const EventCaptainDashboardScreen: React.FC<
  EventCaptainDashboardScreenProps
> = ({ route, navigation }) => {
  const { eventId, eventData } = route.params;

  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [eventQRData, setEventQRData] = useState<EventQRData | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<EventJoinRequest[]>([]);

  // Participant profile interface
  interface ParticipantProfile {
    pubkey: string;
    name?: string;
    picture?: string;
    displayName: string;
  }
  const [participantProfiles, setParticipantProfiles] = useState<
    ParticipantProfile[]
  >([]);

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message?: string;
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }>;
  }>({
    title: '',
    message: '',
    buttons: [],
  });

  useEffect(() => {
    loadParticipants();
    loadPendingJoinRequests();
  }, [eventId]);

  const loadParticipants = async () => {
    try {
      setIsLoadingParticipants(true);

      // Get event-specific participants from kind 30000 list
      const NostrListService = (
        await import('../services/nostr/NostrListService')
      ).NostrListService.getInstance();
      const eventParticipants = await NostrListService.getListMembers(
        eventData.captainPubkey, // Author of the participant list
        `event-${eventId}-participants` // Event-specific d-tag
      );

      setParticipants(eventParticipants);
      console.log(
        `📊 Loaded ${eventParticipants.length} event participants for event ${eventId}`
      );

      // Fetch profiles for each participant
      const ProfileService = (await import('../services/user/profileService'))
        .ProfileService;
      const profiles: ParticipantProfile[] = await Promise.all(
        eventParticipants.map(async (pubkey) => {
          try {
            const profile = await ProfileService.getUserProfile(pubkey);
            return {
              pubkey,
              name: profile?.name,
              picture: profile?.picture,
              displayName:
                profile?.name || `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`,
            };
          } catch (error) {
            console.warn(
              `Failed to load profile for ${pubkey.slice(0, 16)}:`,
              error
            );
            return {
              pubkey,
              displayName: `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`,
            };
          }
        })
      );

      setParticipantProfiles(profiles);
      console.log(`✅ Loaded ${profiles.length} participant profiles`);
    } catch (error) {
      console.error('❌ Failed to load event participants:', error);
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  const loadPendingJoinRequests = async () => {
    try {
      const requests = await EventJoinRequestService.getInstance().getEventJoinRequests(
        eventData.captainPubkey,
        eventId
      );
      setPendingJoinRequests(requests);
      console.log(`📊 Loaded ${requests.length} pending join requests for event`);
    } catch (error) {
      console.error('❌ Failed to load pending join requests:', error);
    }
  };

  const handleApproveFromTransaction = async (request: EventJoinRequest) => {
    try {
      console.log('🔄 Approving join request from transaction history');

      // Get signer
      const signer = await UnifiedSigningService.getSigner();
      if (!signer) {
        setAlertConfig({
          title: 'Error',
          message: 'Authentication required to approve requests',
          buttons: [{ text: 'OK', style: 'default' }],
        });
        setAlertVisible(true);
        return;
      }

      const captainHexPubkey = await UnifiedSigningService.getHexPubkey();
      if (!captainHexPubkey) {
        setAlertConfig({
          title: 'Error',
          message: 'Invalid captain public key',
          buttons: [{ text: 'OK', style: 'default' }],
        });
        setAlertVisible(true);
        return;
      }

      // Get participant list
      const listService = NostrListService.getInstance();
      const dTag = `event-${eventId}-participants`;
      const currentList = await listService.getList(captainHexPubkey, dTag);

      if (!currentList) {
        // Create new participant list
        console.log('🔧 Creating participant list for event');
        const listData = {
          name: `${eventData.name} Participants`,
          description: `Participants for ${eventData.name}`,
          members: [request.requesterId],
          dTag,
          listType: 'people' as const,
        };

        const eventTemplate = listService.prepareListCreation(listData, captainHexPubkey);
        const ndk = await GlobalNDKService.getInstance();
        const ndkEvent = new NDKEvent(ndk, eventTemplate);
        await ndkEvent.sign(signer);
        await ndkEvent.publish();
      } else {
        // Add to existing list
        console.log('➕ Adding participant to existing list');
        const eventTemplate = listService.prepareAddMember(
          captainHexPubkey,
          dTag,
          request.requesterId,
          currentList
        );

        if (eventTemplate) {
          const ndk = await GlobalNDKService.getInstance();
          const ndkEvent = new NDKEvent(ndk, eventTemplate);
          await ndkEvent.sign(signer);
          await ndkEvent.publish();

          // Update cache
          listService.updateCachedList(`${captainHexPubkey}:${dTag}`, [
            ...currentList.members,
            request.requesterId,
          ]);
        }
      }

      // Invalidate event snapshot
      try {
        const { EventSnapshotStore } = await import(
          '../services/event/EventSnapshotStore'
        );
        await EventSnapshotStore.deleteSnapshot(eventId);
        console.log('🗑️ Event snapshot invalidated after approval');
      } catch (error) {
        console.warn('⚠️ Failed to invalidate snapshot (non-critical):', error);
      }

      // Remove from pending requests
      setPendingJoinRequests((prev) => prev.filter((r) => r.id !== request.id));

      // Refresh participant list
      await loadParticipants();

      console.log('✅ Join request approved successfully');

      setAlertConfig({
        title: 'Success',
        message: `${request.requesterName || 'Participant'} has been added to the event`,
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
    } catch (error) {
      console.error('❌ Failed to approve join request:', error);
      setAlertConfig({
        title: 'Error',
        message: 'Failed to approve join request. Please try again.',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadParticipants(), loadPendingJoinRequests()]);
    setIsRefreshing(false);
  };

  const handleRemoveParticipant = async (
    participantPubkey: string,
    participantName: string
  ) => {
    setAlertConfig({
      title: 'Remove Participant',
      message: `Are you sure you want to remove ${participantName} from this event?`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log(
                '🗑️ Removing participant:',
                participantPubkey.slice(0, 20)
              );

              // Remove from kind 30000 participant list
              const NostrListService = (
                await import('../services/nostr/NostrListService')
              ).NostrListService.getInstance();
              await NostrListService.removeMember(
                `event-${eventId}-participants`, // d-tag
                participantPubkey // member to remove
              );

              // Refresh participant list
              await loadParticipants();

              setAlertConfig({
                title: 'Success',
                message: `${participantName} has been removed from the event`,
                buttons: [{ text: 'OK', style: 'default' }],
              });
              setAlertVisible(true);
            } catch (error) {
              console.error('❌ Failed to remove participant:', error);
              setAlertConfig({
                title: 'Error',
                message: 'Failed to remove participant. Please try again.',
                buttons: [{ text: 'OK', style: 'default' }],
              });
              setAlertVisible(true);
            }
          },
        },
      ],
    });
    setAlertVisible(true);
  };

  const handleGenerateQR = async () => {
    try {
      // Get captain's npub for QR data
      const captainNpub = await AsyncStorage.getItem('@runstr:npub');
      if (!captainNpub) {
        setAlertConfig({
          title: 'Error',
          message: 'Captain authentication not found',
          buttons: [{ text: 'OK', style: 'default' }],
        });
        setAlertVisible(true);
        return;
      }

      // Parse event date to timestamp
      const eventDate = new Date(eventData.eventDate);
      const startTimestamp = Math.floor(eventDate.getTime() / 1000);
      const endTimestamp = startTimestamp + 86400; // Add 1 day

      // Generate QR data
      const qrString = QRCodeService.getInstance().generateEventQR(
        eventId,
        eventData.teamId,
        captainNpub,
        eventData.name,
        startTimestamp,
        endTimestamp,
        eventData.description
      );

      // Parse QR string to EventQRData object
      const parsedQR = JSON.parse(qrString) as EventQRData;
      setEventQRData(parsedQR);
      setQrModalVisible(true);

      console.log('✅ QR code generated for event:', eventId);
    } catch (error) {
      console.error('❌ Failed to generate QR code:', error);
      setAlertConfig({
        title: 'Error',
        message: 'Failed to generate QR code',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const formatEventDate = () => {
    if (!eventData?.eventDate) return 'Unknown date';
    const eventDate = new Date(eventData.eventDate);
    return eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Captain Dashboard</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
      >
        {/* Event Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.captainBadge}>
            <Ionicons name="shield" size={16} color={theme.colors.background} />
            <Text style={styles.captainBadgeText}>CAPTAIN</Text>
          </View>

          <Text style={styles.eventName}>{eventData.name}</Text>
          <Text style={styles.eventDate}>{formatEventDate()}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{participants.length}</Text>
              <Text style={styles.statLabel}>Participants</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {eventData.activityType || 'Any'}
              </Text>
              <Text style={styles.statLabel}>Activity</Text>
            </View>
          </View>
        </View>

        {/* QR Code Generation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event QR Code</Text>
          <Text style={styles.sectionDescription}>
            Generate a QR code for participants to scan and join this event
          </Text>
          <TouchableOpacity
            style={styles.qrButton}
            onPress={handleGenerateQR}
            activeOpacity={0.8}
          >
            <Ionicons
              name="qr-code"
              size={20}
              color={theme.colors.background}
            />
            <Text style={styles.qrButtonText}>Generate QR Code</Text>
          </TouchableOpacity>
        </View>

        {/* Participants Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Participants</Text>

          {isLoadingParticipants ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.accent} />
              <Text style={styles.loadingText}>Loading participants...</Text>
            </View>
          ) : participants.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="people-outline"
                size={48}
                color={theme.colors.textMuted}
              />
              <Text style={styles.emptyStateText}>No participants yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Share the QR code to invite people to join
              </Text>
            </View>
          ) : (
            <View style={styles.participantsList}>
              {participantProfiles.map((profile, index) => (
                <View key={profile.pubkey} style={styles.participantItem}>
                  <View style={styles.participantInfo}>
                    {/* Avatar with profile picture or initial */}
                    {profile.picture ? (
                      <Image
                        source={{ uri: profile.picture }}
                        style={styles.participantAvatarImage}
                      />
                    ) : (
                      <View style={styles.participantAvatar}>
                        <Text style={styles.participantAvatarText}>
                          {profile.displayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.participantDetails}>
                      <Text style={styles.participantName}>
                        {profile.displayName}
                      </Text>
                      <Text style={styles.participantRole}>
                        {index === 0 ? 'Captain' : 'Participant'}
                      </Text>
                    </View>
                  </View>

                  {/* Remove Button (don't show for captain) */}
                  {index !== 0 && (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() =>
                        handleRemoveParticipant(
                          profile.pubkey,
                          profile.displayName
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={theme.colors.error}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Join Requests Section */}
        <EventJoinRequestsSection
          captainPubkey={eventData.captainPubkey}
          teamId={eventData.teamId}
          onMemberApproved={async () => {
            // Refresh participant list when request is approved
            console.log(
              '✅ Join request approved - refreshing participant list'
            );
            await loadParticipants();
          }}
          style={styles.joinRequestsSection}
        />

        {/* Transaction History (only for paid events with NWC) */}
        {eventData.entryFeesSats && eventData.entryFeesSats > 0 && (
          <EventTransactionHistory
            eventId={eventId}
            eventName={eventData.name}
            eventStartDate={Math.floor(
              new Date(eventData.eventDate).getTime() / 1000
            )}
            entryFee={eventData.entryFeesSats}
            pendingJoinRequests={pendingJoinRequests}
            approvedParticipants={participants}
            onApproveJoinRequest={handleApproveFromTransaction}
            style={styles.transactionHistory}
          />
        )}

        {/* Event Controls Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Controls</Text>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => {
              setAlertConfig({
                title: 'Coming Soon',
                message: 'Event editing will be available soon',
                buttons: [{ text: 'OK', style: 'default' }],
              });
              setAlertVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="create-outline"
              size={20}
              color={theme.colors.text}
            />
            <Text style={styles.controlButtonText}>Edit Event Details</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* QR Code Modal */}
      {eventQRData && (
        <QRDisplayModal
          visible={qrModalVisible}
          onClose={() => {
            setQrModalVisible(false);
            setEventQRData(null);
          }}
          data={eventQRData}
        />
      )}

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  summaryCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  captainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.accent,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
    marginBottom: 12,
  },
  captainBadgeText: {
    color: theme.colors.background,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  eventName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  section: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  qrButtonText: {
    color: theme.colors.accentText,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    marginTop: 12,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  participantsList: {
    gap: 8,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.cardBackground,
  },
  participantAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  participantDetails: {
    flex: 1,
  },
  participantPubkey: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  participantRole: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  removeButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    gap: 12,
  },
  controlButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text,
  },
  transactionHistory: {
    marginTop: 16,
  },
  joinRequestsSection: {
    marginTop: 16,
  },
});

export default EventCaptainDashboardScreen;
