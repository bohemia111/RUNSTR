/**
 * ChallengePaymentModal - Universal payment modal for challenge charity donations
 * Shows Lightning invoice QR code and copyable invoice
 * User manually confirms payment (no automatic polling)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

export interface ChallengePaymentModalProps {
  visible: boolean;
  challengeId: string;
  challengeName: string;
  wagerAmount: number;
  invoice: string;
  role: 'creator' | 'accepter' | 'loser';
  onPaymentConfirmed: () => void;
  onCancel: () => void;
}

const { width } = Dimensions.get('window');

export const ChallengePaymentModal: React.FC<ChallengePaymentModalProps> = ({
  visible,
  challengeId,
  challengeName,
  wagerAmount,
  invoice,
  role,
  onPaymentConfirmed,
  onCancel,
}) => {
  const [copied, setCopied] = useState(false);

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

  const handlePaid = () => {
    Alert.alert(
      'Confirm Payment',
      'Have you paid this invoice from your Lightning wallet?',
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Yes, I Paid',
          style: 'default',
          onPress: onPaymentConfirmed,
        },
      ]
    );
  };

  const getRoleText = () => {
    if (role === 'creator') return 'Charity Donation';
    if (role === 'accepter') return 'Charity Donation';
    return 'Charity Payout';
  };

  const getDescription = () => {
    if (role === 'loser') {
      return `You lost the challenge. Pay ${wagerAmount.toLocaleString()} sats to winner's charity.`;
    }
    return 'Pay your donation to join this challenge.';
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
          <Text style={styles.headerTitle}>{getRoleText()}</Text>
          <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Challenge Info */}
          <View style={styles.challengeInfo}>
            <Text style={styles.challengeName}>{challengeName}</Text>
            <View style={styles.amountContainer}>
              <Ionicons name="flash" size={20} color={theme.colors.accent} />
              <Text style={styles.amount}>
                {wagerAmount.toLocaleString()} sats
              </Text>
            </View>
            <Text style={styles.description}>{getDescription()}</Text>
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
                Click "I Paid" below after completing payment
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={styles.paidButton}
            onPress={handlePaid}
            activeOpacity={0.8}
          >
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={theme.colors.accentText}
            />
            <Text style={styles.paidButtonText}>I Paid This Invoice</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          {/* Note */}
          <Text style={styles.note}>
            {role === 'loser'
              ? 'This completes the challenge after you confirm payment.'
              : 'The challenge will become active after both participants confirm payment.'}
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

  // Challenge Info
  challengeInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },

  challengeName: {
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

  // Buttons
  paidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.accent,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.medium,
    marginBottom: 12,
  },

  paidButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accentText,
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
