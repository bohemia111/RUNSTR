/**
 * PaymentVerificationBadge - Shows payment status for event join requests
 * Displays verification state and handles NWC payment checking
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { NWCWalletService } from '../../services/wallet/NWCWalletService';

export type PaymentStatus =
  | 'free' // No payment required (free event)
  | 'claimed' // User claims payment made (can't auto-verify)
  | 'verifying' // Checking NWC for payment
  | 'verified' // Payment confirmed via NWC
  | 'not_found' // Payment not found in NWC
  | 'manual_paid'; // Captain manually marked as paid

interface PaymentVerificationBadgeProps {
  paymentProof?: string; // Lightning invoice
  amountPaid?: number; // Amount in sats
  paymentStatus?: PaymentStatus; // Manually set status
  onVerificationComplete?: (verified: boolean) => void;
}

export const PaymentVerificationBadge: React.FC<
  PaymentVerificationBadgeProps
> = ({ paymentProof, amountPaid, paymentStatus, onVerificationComplete }) => {
  const [status, setStatus] = useState<PaymentStatus>(paymentStatus || 'free');
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Check for manual verification first
    if (paymentProof === 'MANUAL_VERIFICATION') {
      setStatus('manual_paid');
      return;
    }

    // Auto-verify on mount if we have payment proof
    if (paymentProof && !paymentStatus) {
      verifyPayment();
    }
  }, [paymentProof]);

  const verifyPayment = async () => {
    if (!paymentProof) return;

    setIsChecking(true);
    setStatus('verifying');

    try {
      const walletService = NWCWalletService;

      // Check if captain has NWC configured
      const hasNWC = await walletService.hasNWCConfigured();

      if (!hasNWC) {
        // Can't auto-verify without NWC
        setStatus('claimed');
        setIsChecking(false);
        return;
      }

      // Try to verify payment via NWC
      const result = await walletService.lookupInvoice(paymentProof);

      if (result.success && result.paid) {
        setStatus('verified');
        onVerificationComplete?.(true);
      } else {
        setStatus('not_found');
        onVerificationComplete?.(false);
      }
    } catch (error) {
      console.error('Payment verification failed:', error);
      setStatus('claimed'); // Fallback to claimed
      onVerificationComplete?.(false);
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'free':
        return {
          icon: 'checkmark-circle' as const,
          color: theme.colors.textMuted,
          bgColor: theme.colors.cardBackground,
          text: 'Free Entry',
        };
      case 'claimed':
        return {
          icon: 'alert-circle' as const,
          color: '#FFA500',
          bgColor: 'rgba(255, 165, 0, 0.1)',
          text: 'Payment Claimed',
        };
      case 'verifying':
        return {
          icon: 'time' as const,
          color: theme.colors.accent,
          bgColor: 'rgba(255, 165, 0, 0.1)',
          text: 'Verifying...',
        };
      case 'verified':
        return {
          icon: 'checkmark-circle' as const,
          color: '#FF9D42',
          bgColor: 'rgba(255, 157, 66, 0.1)',
          text: `Paid ${amountPaid ? amountPaid.toLocaleString() : ''} sats`,
        };
      case 'not_found':
        return {
          icon: 'close-circle' as const,
          color: '#FF5252',
          bgColor: 'rgba(255, 82, 82, 0.1)',
          text: 'Payment Not Found',
        };
      case 'manual_paid':
        return {
          icon: 'checkmark-done' as const,
          color: '#FF9D42',
          bgColor: 'rgba(255, 157, 66, 0.1)',
          text: 'Marked as Paid',
        };
      default:
        return {
          icon: 'help-circle' as const,
          color: theme.colors.textMuted,
          bgColor: theme.colors.cardBackground,
          text: 'Unknown',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={[styles.container, { backgroundColor: config.bgColor }]}>
      {isChecking ? (
        <ActivityIndicator size="small" color={config.color} />
      ) : (
        <Ionicons name={config.icon} size={16} color={config.color} />
      )}
      <Text style={[styles.text, { color: config.color }]}>{config.text}</Text>

      {/* Show retry button for failed verifications */}
      {status === 'not_found' && paymentProof && (
        <TouchableOpacity onPress={verifyPayment} style={styles.retryButton}>
          <Ionicons name="refresh" size={14} color={config.color} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  retryButton: {
    marginLeft: 4,
    padding: 2,
  },
});
