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
import { CharityZapService } from '../../services/charity/CharityZapService';
import { CharityPaymentModal } from '../charity/CharityPaymentModal';
import { ExternalZapModal } from '../nutzap/ExternalZapModal';
import { NWCWalletService } from '../../services/wallet/NWCWalletService';
import { useNWCZap } from '../../hooks/useNWCZap';
import { getInvoiceFromLightningAddress } from '../../utils/lnurl';

const DEFAULT_ZAP_AMOUNT = 21; // Standard quick zap amount

interface CharitySectionProps {
  charityId?: string;
}

export const CharitySection: React.FC<CharitySectionProps> = ({
  charityId,
}) => {
  // State for modals
  const [showExternalModal, setShowExternalModal] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(DEFAULT_ZAP_AMOUNT);
  const [selectedMemo, setSelectedMemo] = useState('');

  // Animation for button press
  const scaleAnimation = useRef(new Animated.Value(1)).current;

  // Zapped state tracking
  const [isZapped, setIsZapped] = useState(false);
  const [isZapping, setIsZapping] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  // NWC hook for wallet operations
  const { sendZap, hasWallet, balance, refreshBalance } = useNWCZap();

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

      await AsyncStorage.setItem('@runstr:zapped_charities', JSON.stringify(data));
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

  // SINGLE TAP: Open ExternalZapModal with QR code (universal, works for everyone)
  const handleZapPress = () => {
    animatePress();
    console.log('[CharitySection] Tap detected - opening external wallet modal');

    setSelectedAmount(DEFAULT_ZAP_AMOUNT);
    setSelectedMemo(`Donation to ${charity.name}`);
    setShowExternalModal(true);
  };

  // LONG PRESS: Quick NWC zap (21 sats default, power user feature)
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

    // Quick zap with default amount
    setIsZapping(true);
    try {
      console.log(`[CharitySection] Long press NWC zap to ${charity.name} with ${DEFAULT_ZAP_AMOUNT} sats`);

      // Get invoice from charity's Lightning address
      const { invoice } = await getInvoiceFromLightningAddress(
        charity.lightningAddress,
        DEFAULT_ZAP_AMOUNT,
        `Donation to ${charity.name}`
      );

      if (!invoice) {
        Alert.alert('Error', 'Failed to get invoice from charity.');
        setIsZapping(false);
        return;
      }

      // Pay the invoice with NWC wallet
      const paymentResult = await NWCWalletService.sendPayment(invoice);

      if (paymentResult.success) {
        await markAsZapped();
        await refreshBalance(); // Update the balance after payment
        Alert.alert('Success', `Donated ${DEFAULT_ZAP_AMOUNT} sats to ${charity.name}!`);
      } else {
        Alert.alert('Error', paymentResult.error || 'Failed to process donation. Please try again.');
      }
    } catch (error) {
      console.error('[CharitySection] Long press NWC zap error:', error);
      Alert.alert('Error', 'Failed to process donation. Tap to use an external wallet.');
    } finally {
      setIsZapping(false);
    }
  };

  const handleLearnMore = () => {
    if (charity.website) {
      Linking.openURL(charity.website);
    }
  };

  // Handle external wallet payment confirmation
  const handleExternalPaymentConfirmed = async () => {
    await markAsZapped();
    setShowExternalModal(false);
    Alert.alert(
      'Thank You!',
      `Your donation to ${charity.name} has been sent. Thank you for making a difference!`,
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
              isZapping && styles.zappingButton
            ]}
            activeOpacity={0.7}
            delayLongPress={500}  // 500ms long press delay
            disabled={isZapping}
          >
            <Ionicons
              name="flash"
              size={20}
              color={isZapped ? "#FFD700" : "#000000"}
            />
            <Text style={[
              styles.zapButtonText,
              isZapped && styles.zappedButtonText
            ]}>
              {isZapping ? 'Sending...' : isZapped ? 'Zapped' : 'Zap'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* External Wallet Modal for QR code payment */}
      <ExternalZapModal
        visible={showExternalModal}
        onClose={() => setShowExternalModal(false)}
        recipientNpub={charity.lightningAddress}  // Pass Lightning address directly
        recipientName={charity.name}
        amount={selectedAmount}
        memo={selectedMemo}
        onSuccess={handleExternalPaymentConfirmed}
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
