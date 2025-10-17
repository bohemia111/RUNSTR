/**
 * RewardMemberButton - Quick reward button for team members
 * Allows captains to send Bitcoin via NWC to member's Lightning address
 *
 * Payment flow:
 * 1. Captain clicks reward button
 * 2. Gets member's Lightning address from their Nostr profile
 * 3. Requests invoice via LNURL protocol
 * 4. Pays invoice with captain's NWC wallet
 */

import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { theme } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useNWCZap } from '../../hooks/useNWCZap';

interface RewardMemberButtonProps {
  memberPubkey: string;
  memberName: string;
  defaultAmount?: number;
  memo?: string;
  onSuccess?: (amount: number) => void;
  variant?: 'primary' | 'secondary' | 'compact';
}

export const RewardMemberButton: React.FC<RewardMemberButtonProps> = ({
  memberPubkey,
  memberName,
  defaultAmount = 100,
  memo,
  onSuccess,
  variant = 'primary',
}) => {
  const { balance, hasWallet, sendZap, error } = useNWCZap();
  const [isSending, setIsSending] = useState(false);

  const handleReward = async () => {
    // Check if captain has NWC wallet configured
    if (!hasWallet) {
      Alert.alert(
        'Wallet Not Connected',
        'Please connect your NWC wallet in settings to send rewards.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check balance
    if (balance < defaultAmount) {
      Alert.alert(
        'Insufficient Balance',
        `You need ${defaultAmount} sats but only have ${balance} sats available.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Send Reward',
      `Send ${defaultAmount} sats to ${memberName}?\n\nThis will be sent to their Lightning address.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Send',
          onPress: async () => {
            setIsSending(true);
            try {
              const rewardMemo = memo || `Team reward for ${memberName}`;
              const success = await sendZap(memberPubkey, defaultAmount, rewardMemo);

              if (success) {
                Alert.alert(
                  'Reward Sent!',
                  `Successfully sent ${defaultAmount} sats to ${memberName}`,
                  [{ text: 'OK' }]
                );
                onSuccess?.(defaultAmount);
              } else {
                // Show specific error if available
                const errorMessage = error || 'Unable to send reward. Please try again.';
                Alert.alert(
                  'Send Failed',
                  errorMessage,
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              Alert.alert(
                'Error',
                'An unexpected error occurred. Please try again.',
                [{ text: 'OK' }]
              );
            } finally {
              setIsSending(false);
            }
          },
        },
      ]
    );
  };

  const getButtonStyle = () => {
    switch (variant) {
      case 'secondary':
        return [styles.button, styles.secondaryButton];
      case 'compact':
        return [styles.button, styles.compactButton];
      default:
        return [styles.button, styles.primaryButton];
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryText;
      case 'compact':
        return styles.compactText;
      default:
        return styles.primaryText;
    }
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), isSending && styles.buttonDisabled]}
      onPress={handleReward}
      disabled={isSending}
    >
      {isSending ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' ? theme.colors.accent : theme.colors.accentText}
        />
      ) : (
        <>
          <Ionicons
            name="gift"
            size={variant === 'compact' ? 16 : 20}
            color={variant === 'secondary' ? theme.colors.accent : theme.colors.accentText}
          />
          <Text style={getTextStyle()}>
            {variant === 'compact' ? `${defaultAmount}` : `Reward ${defaultAmount} sats`}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: theme.borderRadius.medium,
  },

  primaryButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },

  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },

  compactButton: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  primaryText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accentText,
  },

  secondaryText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accent,
  },

  compactText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },

  buttonDisabled: {
    opacity: 0.6,
  },
});