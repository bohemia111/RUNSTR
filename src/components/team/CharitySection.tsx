/**
 * CharitySection - Display team's supported charity with zap button
 * Shows charity info below team bio on team detail screens
 * Works with NWC for quick zaps, external wallets for custom amounts
 * Follows standard NWC pattern: single tap = quick 21 sats, long press = amount modal
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { getCharityById } from '../../constants/charities';
import { ExternalZapModal } from '../nutzap/ExternalZapModal';
import { NWCWalletService } from '../../services/wallet/NWCWalletService';
import { RewardSenderWallet } from '../../services/rewards/RewardSenderWallet';
import { DonationTrackingService } from '../../services/donation/DonationTrackingService';
import { useNWCZap } from '../../hooks/useNWCZap';
import { useAuth } from '../../contexts/AuthContext';
import { getInvoiceFromLightningAddress } from '../../utils/lnurl';
import { getUserNostrIdentifiers } from '../../utils/nostr';

const DEFAULT_ZAP_AMOUNT = 21; // Standard quick zap amount

interface CharitySectionProps {
  charityId?: string;
}

export const CharitySection: React.FC<CharitySectionProps> = ({
  charityId,
}) => {
  // State for payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Animation for button press
  const scaleAnimation = useRef(new Animated.Value(1)).current;

  // Zapped state tracking
  const [isZapped, setIsZapped] = useState(false);
  const [isZapping, setIsZapping] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  // NWC hook for wallet operations
  const { hasWallet, balance, refreshBalance } = useNWCZap();

  // Get user info for donation tracking
  const { currentUser } = useAuth();

  // If no charity selected, don't render anything
  if (!charityId) {
    return null;
  }

  const charity = getCharityById(charityId);

  // If charity ID is invalid, don't render
  if (!charity) {
    return null;
  }

  // Load zapped state and wallet balance on mount
  useEffect(() => {
    const loadZappedState = async () => {
      try {
        const today = new Date().toDateString();
        const stored = await AsyncStorage.getItem('@runstr:zapped_charities');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.date === today && parsed.charities?.includes(charity.id)) {
            setIsZapped(true);
          }
        }
      } catch (error) {
        console.log('[CharitySection] Error loading zapped state:', error);
      }
    };

    loadZappedState();
  }, [charity.id]);

  // Update wallet balance when it changes
  useEffect(() => {
    if (hasWallet) {
      setWalletBalance(balance || 0);
    }
  }, [balance, hasWallet]);

  // Update zapped state after successful zap
  const markAsZapped = async () => {
    try {
      const today = new Date().toDateString();
      const stored = await AsyncStorage.getItem('@runstr:zapped_charities');
      const data = stored ? JSON.parse(stored) : { date: today, charities: [] };

      // Reset if it's a new day
      if (data.date !== today) {
        data.date = today;
        data.charities = [];
      }

      // Add this charity if not already zapped
      if (!data.charities.includes(charity.id)) {
        data.charities.push(charity.id);
      }

      await AsyncStorage.setItem(
        '@runstr:zapped_charities',
        JSON.stringify(data)
      );
      setIsZapped(true);
    } catch (error) {
      console.error('[CharitySection] Error saving zapped state:', error);
    }
  };

  // Animation for button press
  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 0.95,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1.0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // SINGLE TAP: Open ExternalZapModal for verified donation
  const handleZapPress = () => {
    animatePress();
    console.log(`[CharitySection] Opening zap modal for ${charity.name}`);
    setShowPaymentModal(true);
  };

  // LONG PRESS: Quick NWC zap (21 sats default, power user feature)
  // Routes through RUNSTR's wallet for donation tracking
  const handleZapLongPress = async () => {
    animatePress();

    // Check for NWC wallet
    if (!hasWallet) {
      Alert.alert(
        'NWC Wallet Not Configured',
        'Tap to donate using external wallets like Cash App or Strike.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check balance
    if (walletBalance < DEFAULT_ZAP_AMOUNT) {
      Alert.alert(
        'Insufficient Balance',
        `You need ${DEFAULT_ZAP_AMOUNT} sats but only have ${walletBalance}. Tap to use an external wallet.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Quick zap with default amount - routes through RUNSTR for tracking
    setIsZapping(true);
    try {
      console.log(
        `[CharitySection] Long press NWC zap to ${charity.name} with ${DEFAULT_ZAP_AMOUNT} sats`
      );

      // Step 1: Create invoice from RUNSTR's wallet (so RUNSTR receives the donation)
      console.log('[CharitySection] Creating invoice from RUNSTR wallet...');
      const invoiceResult = await RewardSenderWallet.createInvoice(
        DEFAULT_ZAP_AMOUNT,
        `Donation to ${charity.name}`
      );

      if (!invoiceResult.success || !invoiceResult.invoice) {
        console.error('[CharitySection] Failed to create RUNSTR invoice:', invoiceResult.error);
        // Fallback: Pay charity directly (legacy behavior)
        const { invoice } = await getInvoiceFromLightningAddress(
          charity.lightningAddress,
          DEFAULT_ZAP_AMOUNT,
          `Donation to ${charity.name}`
        );
        if (invoice) {
          const paymentResult = await NWCWalletService.sendPayment(invoice);
          if (paymentResult.success) {
            await markAsZapped();
            await refreshBalance();
            Alert.alert('Success', `Donated ${DEFAULT_ZAP_AMOUNT} sats to ${charity.name}!`);
          }
        }
        return;
      }

      // Step 2: User pays the RUNSTR invoice with their NWC wallet
      console.log('[CharitySection] User paying RUNSTR invoice...');
      const paymentResult = await NWCWalletService.sendPayment(invoiceResult.invoice);

      if (!paymentResult.success) {
        Alert.alert(
          'Error',
          paymentResult.error || 'Failed to process donation. Please try again.'
        );
        return;
      }

      // Step 3: Record donation and forward to charity
      console.log('[CharitySection] Recording and forwarding donation...');
      const donorName = currentUser?.name || currentUser?.displayName;

      // Get hex pubkey for tracking
      let donorPubkey = 'anonymous';
      try {
        const identifiers = await getUserNostrIdentifiers();
        if (identifiers?.hexPubkey) {
          donorPubkey = identifiers.hexPubkey;
        }
      } catch (e) {
        console.warn('[CharitySection] Could not get hex pubkey');
      }

      await DonationTrackingService.recordAndForward({
        donorPubkey,
        donorName,
        amount: DEFAULT_ZAP_AMOUNT,
        charityId: charity.id,
        charityLightningAddress: charity.lightningAddress,
      });

      await markAsZapped();
      await refreshBalance();
      Alert.alert(
        'Success',
        `Donated ${DEFAULT_ZAP_AMOUNT} sats to ${charity.name}!\nYour donation has been recorded.`
      );
    } catch (error) {
      console.error('[CharitySection] Long press NWC zap error:', error);
      Alert.alert(
        'Error',
        'Failed to process donation. Tap to use an external wallet.'
      );
    } finally {
      setIsZapping(false);
    }
  };

  const handleLearnMore = () => {
    if (charity.website) {
      Linking.openURL(charity.website);
    }
  };

  // Handle verified payment confirmation (called when payment detected)
  const handlePaymentConfirmed = async () => {
    await markAsZapped();
    await refreshBalance();
    setShowPaymentModal(false);
    Alert.alert(
      'Thank You!',
      `Your donation to ${charity.name} has been verified and recorded!`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      {/* Section Label */}
      <Text style={styles.sectionLabel}>Team Charity</Text>

      {/* Charity Card */}
      <View style={styles.charityCard}>
        {/* Charity Icon */}
        <View style={styles.charityIconContainer}>
          <Ionicons name="heart" size={24} color="#FF9D42" />
        </View>

        {/* Charity Info */}
        <View style={styles.charityInfo}>
          <Text style={styles.charityName}>{charity.name}</Text>
          <Text style={styles.charityDescription}>{charity.description}</Text>

          {/* Learn More Link */}
          {charity.website && (
            <TouchableOpacity
              onPress={handleLearnMore}
              style={styles.learnMoreButton}
            >
              <Text style={styles.learnMoreText}>Learn more</Text>
              <Ionicons
                name="open-outline"
                size={14}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Zap Button - Tap for QR code, long press for quick NWC zap */}
        <Animated.View style={{ transform: [{ scale: scaleAnimation }] }}>
          <TouchableOpacity
            onPress={handleZapPress}
            onLongPress={handleZapLongPress}
            style={[
              styles.zapButton,
              isZapped && styles.zappedButton,
              isZapping && styles.zappingButton,
            ]}
            activeOpacity={0.7}
            delayLongPress={500} // 500ms long press delay
            disabled={isZapping}
          >
            <Ionicons
              name="flash"
              size={20}
              color={isZapped ? '#FFD700' : '#000000'}
            />
            <Text
              style={[
                styles.zapButtonText,
                isZapped && styles.zappedButtonText,
              ]}
            >
              {isZapping ? 'Sending...' : isZapped ? 'Zapped' : 'Zap'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* External Zap Modal with charity donation verification */}
      <ExternalZapModal
        visible={showPaymentModal}
        recipientNpub={charity.lightningAddress}
        recipientName={charity.name}
        memo={`Donation to ${charity.name}`}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={handlePaymentConfirmed}
        isCharityDonation={true}
        charityId={charity.id}
        charityLightningAddress={charity.lightningAddress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    marginBottom: 16,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  charityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
  },

  charityIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 157, 66, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  charityInfo: {
    flex: 1,
  },

  charityName: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 4,
  },

  charityDescription: {
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: 8,
  },

  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  learnMoreText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textDecorationLine: 'underline',
  },

  zapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF9D42',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 12,
  },

  zapButtonText: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semiBold,
    color: '#000000',
  },

  zappedButton: {
    backgroundColor: '#FFE4B5', // Light gold when zapped
    borderWidth: 1,
    borderColor: '#FFD700',
  },

  zappingButton: {
    opacity: 0.7,
  },

  zappedButtonText: {
    color: '#000000', // Keep text black on light gold background
  },
});
