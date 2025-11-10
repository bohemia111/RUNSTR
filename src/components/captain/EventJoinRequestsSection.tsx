/**
 * EventJoinRequestsSection Component - Manages event join request approvals
 * Displays and handles join requests for specific events
 * Integrates with NostrListService for participant management
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { JoinRequestCard } from '../team/JoinRequestCard';
import { PaymentVerificationBadge } from './PaymentVerificationBadge';
import type { PaymentStatus } from './PaymentVerificationBadge';
import { EventJoinRequestService } from '../../services/events/EventJoinRequestService';
import type { EventJoinRequest } from '../../services/events/EventJoinRequestService';
import { NostrListService } from '../../services/nostr/NostrListService';
import { UnifiedSigningService } from '../../services/auth/UnifiedSigningService';
import { CustomAlertManager } from '../ui/CustomAlert';
import { GlobalNDKService } from '../../services/nostr/GlobalNDKService';
import {
  NDKEvent,
  NDKSubscription,
} from '@nostr-dev-kit/ndk';

interface EventJoinRequestsSectionProps {
  captainPubkey: string;
  teamId: string;
  onMemberApproved?: (eventId: string, requesterPubkey: string) => void;
  style?: any;
}

interface GroupedRequests {
  eventId: string;
  eventName: string;
  requests: EventJoinRequest[];
  expandedState: boolean;
}

export const EventJoinRequestsSection: React.FC<
  EventJoinRequestsSectionProps
> = ({ captainPubkey, teamId, onMemberApproved, style }) => {
  const [groupedRequests, setGroupedRequests] = useState<GroupedRequests[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<NDKSubscription | null>(
    null
  );

  const requestService = EventJoinRequestService.getInstance();
  const listService = NostrListService.getInstance();

  // Load initial event join requests
  const loadEventJoinRequests = async () => {
    try {
      setIsLoading(true);
      const joinRequests = await requestService.getEventJoinRequests(
        captainPubkey
      );

      console.log(`📋 Found ${joinRequests.length} total join requests`);

      // Filter out users already in participant lists
      const filteredRequests: EventJoinRequest[] = [];

      for (const request of joinRequests) {
        const dTag = `event-${request.eventId}-participants`;

        // Get participant list for this event
        const participantList = await listService.getListMembers(
          captainPubkey,
          dTag
        );

        // Check if requester is already approved (in participant list)
        const alreadyApproved = participantList.includes(request.requesterId);

        if (alreadyApproved) {
          console.log(
            `⏭️ Skipping request from ${request.requesterId.slice(0, 8)}... (already approved)`
          );
        } else {
          filteredRequests.push(request);
        }
      }

      console.log(
        `✅ Filtered to ${filteredRequests.length} pending requests (${joinRequests.length - filteredRequests.length} already approved)`
      );

      // Group filtered requests by event
      const grouped = filteredRequests.reduce((acc, request) => {
        const existing = acc.find((g) => g.eventId === request.eventId);
        if (existing) {
          existing.requests.push(request);
        } else {
          acc.push({
            eventId: request.eventId,
            eventName: request.eventName,
            requests: [request],
            expandedState: false,
          });
        }
        return acc;
      }, [] as GroupedRequests[]);

      setGroupedRequests(grouped);
    } catch (error) {
      console.error('Failed to load event join requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Subscribe to real-time event join requests
  useEffect(() => {
    const setupSubscription = async () => {
      try {
        // Load initial requests
        await loadEventJoinRequests();

        // Subscribe to new requests
        const sub = await requestService.subscribeToEventJoinRequests(
          captainPubkey,
          (newRequest: EventJoinRequest) => {
            setGroupedRequests((prev) => {
              const updated = [...prev];
              const eventGroup = updated.find(
                (g) => g.eventId === newRequest.eventId
              );

              if (eventGroup) {
                // Check for duplicates
                const exists = eventGroup.requests.some(
                  (r) => r.id === newRequest.id
                );
                if (!exists) {
                  eventGroup.requests.unshift(newRequest);
                }
              } else {
                // New event group
                updated.unshift({
                  eventId: newRequest.eventId,
                  eventName: newRequest.eventName,
                  requests: [newRequest],
                  expandedState: true, // Auto-expand new events
                });
              }

              return updated;
            });
          }
        );
        setSubscription(sub);
      } catch (error) {
        console.error(
          'Failed to setup event join requests subscription:',
          error
        );
      }
    };

    setupSubscription();

    // Cleanup subscription
    return () => {
      if (subscription) {
        console.log('Cleaning up event join requests subscription');
        subscription.stop();
      }
    };
  }, [captainPubkey, teamId]);

  const toggleEventExpanded = (eventId: string) => {
    setGroupedRequests((prev) =>
      prev.map((g) =>
        g.eventId === eventId ? { ...g, expandedState: !g.expandedState } : g
      )
    );
  };

  const handleApproveRequest = async (
    requestId: string,
    requesterPubkey: string,
    eventId: string,
    eventName: string
  ) => {
    let alertVisible = false;
    try {
      // Get signer (supports both nsec and Amber)
      const signingService = UnifiedSigningService.getInstance();
      const signer = await signingService.getSigner();
      if (!signer) {
        CustomAlertManager.alert('Error', 'Authentication required to approve requests', [{ text: 'OK' }]);
        return;
      }

      const captainHexPubkey = await signingService.getUserPubkey();
      if (!captainHexPubkey) {
        CustomAlertManager.alert('Error', 'Invalid captain public key', [{ text: 'OK' }]);
        return;
      }

      // Get current participant list
      const dTag = `event-${eventId}-participants`;
      const currentList = await listService.getList(captainHexPubkey, dTag);

      if (!currentList) {
        // ⚠️ Participant list is missing - this shouldn't happen!
        // Show confirmation dialog explaining the issue
        alertVisible = true;
        CustomAlertManager.alert(
          'Participant List Missing',
          `The participant list for "${eventName}" was not found. This might have happened if event creation was interrupted.\n\nWould you like to create the participant list now and approve this request?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                console.log('❌ Captain cancelled participant list creation');
                alertVisible = false;
              },
            },
            {
              text: 'Create & Approve',
              onPress: async () => {
                try {
                  console.log(
                    '🔧 Creating missing participant list for event:',
                    eventId
                  );

                  // Create initial list with the requester
                  const listData = {
                    name: `${eventName} Participants`,
                    description: `Participants for ${eventName}`,
                    members: [requesterPubkey],
                    dTag,
                    listType: 'people' as const,
                  };

                  const eventTemplate = listService.prepareListCreation(
                    listData,
                    captainHexPubkey
                  );

                  // Sign and publish using UnifiedSigningService
                  const ndk = await GlobalNDKService.getInstance();
                  const ndkEvent = new NDKEvent(ndk, eventTemplate);
                  await ndkEvent.sign(signer);
                  await ndkEvent.publish();

                  console.log('✅ Participant list created successfully');

                  // Remove request from UI
                  setGroupedRequests((prev) => {
                    const updated = [...prev];
                    const eventGroup = updated.find(
                      (g) => g.eventId === eventId
                    );
                    if (eventGroup) {
                      eventGroup.requests = eventGroup.requests.filter(
                        (r) => r.id !== requestId
                      );
                      if (eventGroup.requests.length === 0) {
                        return updated.filter((g) => g.eventId !== eventId);
                      }
                    }
                    return updated;
                  });

                  onMemberApproved?.(eventId, requesterPubkey);

                  // Invalidate event snapshot - participants changed
                  try {
                    const { EventSnapshotStore } = await import(
                      '../../services/event/EventSnapshotStore'
                    );
                    await EventSnapshotStore.deleteSnapshot(eventId);
                    console.log('🗑️ Event snapshot invalidated after list creation');
                  } catch (error) {
                    console.warn('⚠️ Failed to invalidate snapshot (non-critical):', error);
                  }

                  CustomAlertManager.alert(
                    'Success',
                    'Participant list created and user approved',
                    [{ text: 'OK', onPress: () => { alertVisible = false; } }]
                  );
                } catch (createError) {
                  console.error(
                    '❌ Failed to create participant list:',
                    createError
                  );
                  CustomAlertManager.alert(
                    'Error',
                    'Failed to create participant list. Please try again.',
                    [{ text: 'OK', onPress: () => { alertVisible = false; } }]
                  );
                }
              },
            },
          ]
        );
        return; // Exit early - wait for captain's decision
      } else {
        // Add to existing list
        const eventTemplate = listService.prepareAddMember(
          captainHexPubkey,
          dTag,
          requesterPubkey,
          currentList
        );

        if (eventTemplate) {
          // Sign and publish updated list using UnifiedSigningService
          const ndk = await GlobalNDKService.getInstance();
          const ndkEvent = new NDKEvent(ndk, eventTemplate);
          await ndkEvent.sign(signer);
          await ndkEvent.publish();

          // Update cache
          listService.updateCachedList(`${captainHexPubkey}:${dTag}`, [
            ...currentList.members,
            requesterPubkey,
          ]);
        }
      }

      // Remove request from UI
      setGroupedRequests((prev) => {
        const updated = [...prev];
        const eventGroup = updated.find((g) => g.eventId === eventId);
        if (eventGroup) {
          eventGroup.requests = eventGroup.requests.filter(
            (r) => r.id !== requestId
          );
          // Remove group if no more requests
          if (eventGroup.requests.length === 0) {
            return updated.filter((g) => g.eventId !== eventId);
          }
        }
        return updated;
      });

      // Notify parent component
      onMemberApproved?.(eventId, requesterPubkey);

      // Invalidate event snapshot - participants changed
      try {
        const { EventSnapshotStore } = await import(
          '../../services/event/EventSnapshotStore'
        );
        await EventSnapshotStore.deleteSnapshot(eventId);
        console.log('🗑️ Event snapshot invalidated after approval');
      } catch (error) {
        console.warn('⚠️ Failed to invalidate snapshot (non-critical):', error);
      }

      // Clear join request cache to prevent approved requests from reappearing
      try {
        const requestService = EventJoinRequestService.getInstance();
        requestService.clearCache();
        console.log('🗑️ Join request cache cleared after approval');
      } catch (error) {
        console.warn('⚠️ Failed to clear join request cache (non-critical):', error);
      }

      alertVisible = true;
      CustomAlertManager.alert('Success', 'Participant approved and added to event', [
        { text: 'OK', onPress: () => { alertVisible = false; } }
      ]);
    } catch (error) {
      console.error('Failed to approve event join request:', error);
      if (!alertVisible) {
        CustomAlertManager.alert('Error', 'Failed to approve request', [{ text: 'OK' }]);
      }
    }
  };

  const handleRejectRequest = async (requestId: string, eventId: string) => {
    // Simply remove from UI - no need to update list
    setGroupedRequests((prev) => {
      const updated = [...prev];
      const eventGroup = updated.find((g) => g.eventId === eventId);
      if (eventGroup) {
        eventGroup.requests = eventGroup.requests.filter(
          (r) => r.id !== requestId
        );
        // Remove group if no more requests
        if (eventGroup.requests.length === 0) {
          return updated.filter((g) => g.eventId !== eventId);
        }
      }
      return updated;
    });

    CustomAlertManager.alert('Request Declined', 'The join request has been declined', [{ text: 'OK' }]);
  };

  const handleMarkAsPaid = async (requestId: string, eventId: string) => {
    CustomAlertManager.alert(
      'Mark as Paid',
      'Did you receive payment for this entry fee via cash, Venmo, or other method?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Paid',
          style: 'default',
          onPress: () => {
            // Update the request's payment status in state
            setGroupedRequests((prev) => {
              const updated = [...prev];
              const eventGroup = updated.find((g) => g.eventId === eventId);
              if (eventGroup) {
                const request = eventGroup.requests.find(
                  (r) => r.id === requestId
                );
                if (request) {
                  // Mark as manually verified
                  request.paymentProof = 'MANUAL_VERIFICATION';
                }
              }
              return updated;
            });

            CustomAlertManager.alert(
              'Marked as Paid',
              'This request has been marked as paid',
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  };

  const totalRequests = groupedRequests.reduce(
    (sum, g) => sum + g.requests.length,
    0
  );

  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.header}>
          <Text style={styles.title}>Event Join Requests</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Event Join Requests</Text>
        {totalRequests > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalRequests}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadEventJoinRequests}
            tintColor={theme.colors.primary}
          />
        }
      >
        {groupedRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No pending event join requests</Text>
            <Text style={styles.emptySubtext}>
              Event requests will appear here when users request to join your
              events
            </Text>
          </View>
        ) : (
          groupedRequests.map((group) => (
            <View key={group.eventId} style={styles.eventGroup}>
              <TouchableOpacity
                style={styles.eventHeader}
                onPress={() => toggleEventExpanded(group.eventId)}
              >
                <View style={styles.eventInfo}>
                  <Text style={styles.eventName}>{group.eventName}</Text>
                  <Text style={styles.requestCount}>
                    {group.requests.length} request
                    {group.requests.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={styles.expandIcon}>
                  {group.expandedState ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>

              {group.expandedState && (
                <View style={styles.requestsContainer}>
                  {group.requests.map((request) => (
                    <View key={request.id} style={styles.requestWrapper}>
                      <JoinRequestCard
                        request={{
                          id: request.id,
                          teamId: request.teamId,
                          teamName: request.eventName,
                          requesterPubkey: request.requesterId,
                          requesterName: request.requesterName,
                          requestedAt: request.timestamp,
                          message: request.message,
                          nostrEvent: request.nostrEvent,
                        }}
                        teamId={teamId}
                        captainPubkey={captainPubkey}
                        onApprove={() =>
                          handleApproveRequest(
                            request.id,
                            request.requesterId,
                            request.eventId,
                            request.eventName
                          )
                        }
                        onReject={() =>
                          handleRejectRequest(request.id, request.eventId)
                        }
                      />
                      {/* Payment verification badge */}
                      {request.paymentProof ? (
                        <View style={styles.paymentBadgeContainer}>
                          <PaymentVerificationBadge
                            paymentProof={request.paymentProof}
                            amountPaid={request.amountPaid}
                            onVerificationComplete={(verified) => {
                              console.log(
                                `Payment ${
                                  verified ? 'verified' : 'not found'
                                } for request ${request.id}`
                              );
                            }}
                          />
                        </View>
                      ) : request.amountPaid && request.amountPaid > 0 ? (
                        <View style={styles.paymentBadgeContainer}>
                          <PaymentVerificationBadge
                            amountPaid={request.amountPaid}
                            paymentStatus="claimed"
                          />
                          <TouchableOpacity
                            style={styles.markPaidButton}
                            onPress={() =>
                              handleMarkAsPaid(request.id, request.eventId)
                            }
                          >
                            <Ionicons
                              name="checkmark-done"
                              size={16}
                              color="#FF9D42"
                            />
                            <Text style={styles.markPaidButtonText}>
                              Mark as Paid
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  badge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: theme.colors.background,
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    maxHeight: 400,
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  eventGroup: {
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.cardBackground,
    overflow: 'hidden',
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: theme.colors.card,
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  requestCount: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  expandIcon: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },
  requestsContainer: {
    padding: 8,
  },
  requestWrapper: {
    marginBottom: 12,
  },
  paymentBadgeContainer: {
    marginTop: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  markPaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 157, 66, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF9D42',
    alignSelf: 'flex-start',
  },
  markPaidButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF9D42',
  },
});
