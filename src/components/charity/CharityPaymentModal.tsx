/**
 * CharityPaymentModal - Payment modal for charity donations
 * Shows Lightning invoice QR code and copyable invoice
 * Polls for payment verification when paymentHash is provided
 * Works with ANY Lightning wallet (Cash App, Strike, Alby, self-custodial)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { RewardSenderWallet } from '../../services/rewards/RewardSenderWallet';
import { DonationTrackingService } from '../../services/donation/DonationTrackingService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CharityPaymentModalProps {
  visible: boolean;
  charityName: string;
  charityId: string;
  charityLightningAddress: string;
  amount: number;
  invoice: string;
  paymentHash?: string; // If provided, enables auto-verification polling
  onPaymentConfirmed: () => void;
  onCancel: () => void;
}

const { width } = Dimensions.get('window');

const POLL_INTERVAL = 2000; // 2 seconds

export const CharityPaymentModal: React.FC<CharityPaymentModalProps> = ({
  visible,
  charityName,
  charityId,
  charityLightningAddress,
  amount,
  invoice,
  paymentHash,
  onPaymentConfirmed,
  onCancel,
}) => {
  const [copied, setCopied] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentDetected, setPaymentDetected] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Payment verification polling
  useEffect(() => {
    if (visible && paymentHash) {
      console.log('[CharityPaymentModal] Starting payment verification polling...');
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [visible, paymentHash]);

  const startPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      if (!paymentHash) return;

      try {
        const result = await RewardSenderWallet.lookupInvoice(paymentHash);

        if (result.settled) {
          console.log('[CharityPaymentModal] Payment detected!');
          stopPolling();
          setPaymentDetected(true);
          await handlePaymentVerified();
        }
      } catch (error) {
        console.error('[CharityPaymentModal] Poll error:', error);
      }
    }, POLL_INTERVAL);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const handlePaymentVerified = async () => {
    setIsVerifying(true);

    try {
      // Get user pubkey for donation tracking
      const userPubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');

      // Record donation and forward to charity
      await DonationTrackingService.recordAndForward({
        donorPubkey: userPubkey || 'anonymous',
        amount,
        charityId,
        charityLightningAddress,
      });

      console.log('[CharityPaymentModal] Donation recorded and forwarded!');

      // Small delay to show success state
      setTimeout(() => {
        setIsVerifying(false);
        setPaymentDetected(false);
        onPaymentConfirmed();
      }, 1000);
    } catch (error) {
      console.error('[CharityPaymentModal] Error processing payment:', error);
      setIsVerifying(false);
      // Still call onPaymentConfirmed even if forwarding fails
      // (donation is recorded, forwarding will retry)
      onPaymentConfirmed();
    }
  };

  const handleCopyInvoice = async () => {
    try {
      await Clipboard.setStringAsync(invoice);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      Alert.alert('Copied!', 'Lightning invoice copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy invoice');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>⚡ Donate to {charityName}</Text>
          <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Donation Info */}
          <View style={styles.donationInfo}>
            <Text style={styles.charityName}>{charityName}</Text>
            <View style={styles.amountContainer}>
              <Ionicons name="flash" size={20} color={theme.colors.accent} />
              <Text style={styles.amount}>{amount.toLocaleString()} sats</Text>
            </View>
            <Text style={styles.description}>
              Your donation supports {charityName}'s mission.
            </Text>
          </View>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            <View style={styles.qrCodeWrapper}>
              <QRCode
                value={invoice}
                size={Math.min(width - 100, 280)}
                backgroundColor="#ffffff"
                color="#000000"
              />
            </View>
            <Text style={styles.qrLabel}>Scan with any Lightning wallet</Text>
          </View>

          {/* Invoice */}
          <View style={styles.invoiceSection}>
            <Text style={styles.invoiceLabel}>Lightning Invoice</Text>
            <TouchableOpacity
              onPress={handleCopyInvoice}
              style={styles.invoiceContainer}
              activeOpacity={0.7}
            >
              <Text
                style={styles.invoice}
                numberOfLines={3}
                ellipsizeMode="middle"
              >
                {invoice}
              </Text>
              <View style={styles.copyIndicator}>
                <Ionicons
                  name={copied ? 'checkmark-circle' : 'copy-outline'}
                  size={18}
                  color={copied ? '#FF9D42' : theme.colors.accent}
                />
                <Text style={[styles.copyText, copied && styles.copiedText]}>
                  {copied ? 'Copied!' : 'Tap to copy'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>How to Pay:</Text>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>
                Scan QR code or tap to copy invoice
              </Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>
                Pay from Cash App, Strike, Alby, or any Lightning wallet
              </Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>
                {paymentHash
                  ? 'Payment will be detected automatically'
                  : 'Click "I Paid" below after completing payment'}
              </Text>
            </View>
          </View>

          {/* Payment Status / Action Buttons */}
          {paymentHash ? (
            // Auto-verification mode
            <View style={styles.verificationContainer}>
              {paymentDetected || isVerifying ? (
                <View style={styles.successContainer}>
                  <Ionicons name="checkmark-circle" size={48} color={theme.colors.success || '#22c55e'} />
                  <Text style={styles.successText}>
                    {isVerifying ? 'Processing donation...' : 'Payment received!'}
                  </Text>
                </View>
              ) : (
                <View style={styles.waitingContainer}>
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                  <Text style={styles.waitingText}>Waiting for payment...</Text>
                  <Text style={styles.waitingSubtext}>
                    Pay the invoice above and we'll detect it automatically
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.8}
            disabled={isVerifying}
          >
            <Text style={styles.cancelButtonText}>
              {paymentDetected ? 'Close' : 'Cancel'}
            </Text>
          </TouchableOpacity>

          {/* Note */}
          <Text style={styles.note}>
            Thank you for supporting {charityName}! Your donation helps make a
            difference.
          </Text>
        </View>
      </View>
    </Modal>
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },

  closeButton: {
    padding: 4,
  },

  content: {
    flex: 1,
    padding: 20,
  },

  // Donation Info
  donationInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },

  charityName: {
    fontSize: 18,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },

  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.cardBackground,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.medium,
    marginBottom: 8,
  },

  amount: {
    fontSize: 24,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.accent,
  },

  description: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },

  // QR Code
  qrContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },

  qrCodeWrapper: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.large,
    marginBottom: 12,
  },

  qrLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },

  // Invoice
  invoiceSection: {
    marginBottom: 24,
  },

  invoiceLabel: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 8,
  },

  invoiceContainer: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.medium,
    padding: 14,
  },

  invoice: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: theme.colors.textMuted,
    marginBottom: 10,
    lineHeight: 18,
  },

  copyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },

  copyText: {
    fontSize: 13,
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.medium,
  },

  copiedText: {
    color: '#FF9D42',
  },

  // Instructions
  instructionsContainer: {
    marginBottom: 24,
    backgroundColor: theme.colors.cardBackground,
    padding: 16,
    borderRadius: theme.borderRadius.medium,
  },

  instructionsTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 12,
  },

  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },

  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  stepNumberText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.accentText,
  },

  stepText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },

  // Verification States
  verificationContainer: {
    marginBottom: 16,
  },

  waitingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  waitingText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginTop: 12,
  },

  waitingSubtext: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: '#22c55e',
  },

  successText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: '#22c55e',
    marginTop: 8,
  },

  cancelButton: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
  },

  cancelButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },

  // Note
  note: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
