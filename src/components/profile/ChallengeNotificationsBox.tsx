/**
 * ChallengeNotificationsBox - Displays incoming challenge requests on Profile
 * Shows pending challenges with accept/decline functionality
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { CustomAlertManager } from '../ui/CustomAlert';
import { theme } from '../../styles/theme';
import {
  challengeNotificationHandler,
  type ChallengeNotification,
} from '../../services/notifications/ChallengeNotificationHandler';
import { challengeEscrowService } from '../../services/challenge/ChallengeEscrowService';
import { getUserNostrIdentifiers } from '../../utils/nostr';
import { ChallengePaymentModal } from '../challenge/ChallengePaymentModal';

export const ChallengeNotificationsBox: React.FC = () => {
  const [notifications, setNotifications] = useState<ChallengeNotification[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState('');
  const [paymentHash, setPaymentHash] = useState('');
  const [paymentChallengeId, setPaymentChallengeId] = useState('');
  const [paymentWagerAmount, setPaymentWagerAmount] = useState(0);
  const [currentUserPubkey, setCurrentUserPubkey] = useState('');

  useEffect(() => {
    // Load initial notifications
    loadNotifications();

    // Subscribe to new notifications
    const unsubscribe = challengeNotificationHandler.onNotification(
      (notification) => {
        setNotifications((prev) => [notification, ...prev]);
      }
    );

    // Start listening for incoming challenges
    challengeNotificationHandler.startListening().catch((error) => {
      console.error('Failed to start challenge notifications:', error);
    });

    return () => {
      unsubscribe();
      challengeNotificationHandler.stopListening();
    };
  }, []);

  const loadNotifications = () => {
    try {
      const allNotifications = challengeNotificationHandler.getNotifications();
      // Show both request-type and payment_required notifications that haven't been read
      const pendingNotifications = allNotifications.filter(
        (n) =>
          (n.type === 'request' || n.type === 'payment_required') && !n.read
      );
      setNotifications(pendingNotifications);
    } catch (error) {
      console.error('Failed to load challenge notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (notificationId: string) => {
    setProcessingId(notificationId);
    try {
      const result = await challengeNotificationHandler.acceptChallenge(
        notificationId
      );

      if (result.success) {
        // Remove from pending list
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        CustomAlertManager.alert('Success', 'Challenge accepted! Good luck!');
      } else {
        CustomAlertManager.alert('Error', result.error || 'Failed to accept challenge');
      }
    } catch (error) {
      console.error('Error accepting challenge:', error);
      CustomAlertManager.alert('Error', 'An unexpected error occurred');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (notificationId: string) => {
    CustomAlertManager.alert(
      'Decline Challenge',
      'Are you sure you want to decline this challenge?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(notificationId);
            try {
              const result =
                await challengeNotificationHandler.declineChallenge(
                  notificationId
                );

              if (result.success) {
                // Remove from pending list
                setNotifications((prev) =>
                  prev.filter((n) => n.id !== notificationId)
                );
              } else {
                CustomAlertManager.alert(
                  'Error',
                  result.error || 'Failed to decline challenge'
                );
              }
            } catch (error) {
              console.error('Error declining challenge:', error);
              CustomAlertManager.alert('Error', 'An unexpected error occurred');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  /**
   * Handle "Pay to Activate" button for QR challenges
   */
  const handlePayToActivate = async (notification: ChallengeNotification) => {
    try {
      setProcessingId(notification.id);

      // Get user identifiers
      const userIdentifiers = await getUserNostrIdentifiers();
      if (!userIdentifiers?.hexPubkey) {
        throw new Error('User not authenticated');
      }

      setCurrentUserPubkey(userIdentifiers.hexPubkey);

      // Generate Lightning invoice for creator
      const invoiceResult =
        await challengeEscrowService.generateChallengeInvoice(
          notification.challengeId,
          notification.wagerAmount,
          userIdentifiers.hexPubkey,
          'creator'
        );

      if (
        !invoiceResult.success ||
        !invoiceResult.invoice ||
        !invoiceResult.paymentHash
      ) {
        throw new Error(invoiceResult.error || 'Failed to generate invoice');
      }

      // Show payment modal
      setPaymentInvoice(invoiceResult.invoice);
      setPaymentHash(invoiceResult.paymentHash);
      setPaymentChallengeId(notification.challengeId);
      setPaymentWagerAmount(notification.wagerAmount);
      setShowPaymentModal(true);

      console.log('⚡ Payment modal shown for QR challenge creator...');
    } catch (error) {
      console.error('Failed to initiate payment:', error);
      CustomAlertManager.alert(
        'Payment Setup Failed',
        error instanceof Error ? error.message : 'An error occurred'
      );
    } finally {
      setProcessingId(null);
    }
  };

  /**
   * Handle payment confirmed - mark notification as complete
   */
  const handlePaymentConfirmed = () => {
    console.log('✅ Creator payment confirmed!');
    setShowPaymentModal(false);

    // Remove from pending list
    setNotifications((prev) =>
      prev.filter((n) => n.challengeId !== paymentChallengeId)
    );

    CustomAlertManager.alert(
      'Challenge Activated!',
      `Your ${paymentWagerAmount} sats payment confirmed. The challenge is now active!`
    );
  };

  /**
   * Handle payment cancelled
   */
  const handlePaymentCancelled = () => {
    setShowPaymentModal(false);
    CustomAlertManager.alert('Payment Cancelled', 'Challenge was not activated.');
  };

  /**
   * Handle payment timeout
   */
  const handlePaymentTimeout = () => {
    setShowPaymentModal(false);
    CustomAlertManager.alert(
      'Payment Timeout',
      'Challenge was not activated due to payment timeout.'
    );
  };

  // Don't show the box if there are no pending challenges
  if (!loading && notifications.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Challenge Requests</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{notifications.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.text} />
        </View>
      ) : (
        <View style={styles.notificationsList}>
          {notifications.map((notification) => (
            <View key={notification.id} style={styles.notificationCard}>
              {/* Challenger Info */}
              <View style={styles.challengerInfo}>
                <View style={styles.avatar}>
                  {notification.challengerPicture ? (
                    <Image
                      source={{ uri: notification.challengerPicture }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Text style={styles.avatarText}>
                      {notification.challengerName?.charAt(0).toUpperCase() ||
                        '?'}
                    </Text>
                  )}
                </View>
                <View style={styles.challengerDetails}>
                  <Text style={styles.challengerName}>
                    {notification.challengerName || 'Unknown User'}
                  </Text>
                  <Text style={styles.challengeDetails}>
                    {notification.activityType} • {notification.metric} •{' '}
                    {notification.duration} days
                  </Text>
                  <Text style={styles.wagerText}>
                    Wager: {notification.wagerAmount.toLocaleString()} sats
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                {notification.type === 'payment_required' ? (
                  // Payment Required: Show single "Pay to Activate" button
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.payToActivateButton,
                      processingId === notification.id && styles.disabledButton,
                    ]}
                    onPress={() => handlePayToActivate(notification)}
                    disabled={processingId === notification.id}
                  >
                    {processingId === notification.id ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.accentText}
                      />
                    ) : (
                      <Text style={styles.payToActivateButtonText}>
                        Pay {notification.wagerAmount} sats to Activate
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  // Regular Request: Show Accept/Decline buttons
                  <>
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        styles.declineButton,
                        processingId === notification.id &&
                          styles.disabledButton,
                      ]}
                      onPress={() => handleDecline(notification.id)}
                      disabled={processingId === notification.id}
                    >
                      {processingId === notification.id ? (
                        <ActivityIndicator
                          size="small"
                          color={theme.colors.textMuted}
                        />
                      ) : (
                        <Text style={styles.declineButtonText}>Decline</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        styles.acceptButton,
                        processingId === notification.id &&
                          styles.disabledButton,
                      ]}
                      onPress={() => handleAccept(notification.id)}
                      disabled={processingId === notification.id}
                    >
                      {processingId === notification.id ? (
                        <ActivityIndicator
                          size="small"
                          color={theme.colors.accentText}
                        />
                      ) : (
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Payment Modal */}
      {showPaymentModal &&
        paymentInvoice &&
        paymentHash &&
        currentUserPubkey && (
          <ChallengePaymentModal
            visible={showPaymentModal}
            challengeId={paymentChallengeId}
            wagerAmount={paymentWagerAmount}
            invoice={paymentInvoice}
            paymentHash={paymentHash}
            userPubkey={currentUserPubkey}
            role="creator"
            onPaymentConfirmed={handlePaymentConfirmed}
            onCancel={handlePaymentCancelled}
            onTimeout={handlePaymentTimeout}
          />
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
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  badge: {
    backgroundColor: theme.colors.text,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.background,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  notificationsList: {
    gap: 12,
  },
  notificationCard: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
  },
  challengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.buttonBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
  },
  challengerDetails: {
    flex: 1,
  },
  challengerName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  challengeDetails: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  wagerText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  acceptButton: {
    backgroundColor: theme.colors.text,
  },
  disabledButton: {
    opacity: 0.5,
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.background,
  },
  payToActivateButton: {
    backgroundColor: '#FF8C00', // Orange for payment action
    flex: 1,
  },
  payToActivateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.background,
  },
});
