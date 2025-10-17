/**
 * NWCLightningButton Component
 * Lightning bolt button for quick zapping via NWC to Lightning addresses
 * Visual feedback: black bolt turns yellow after successful zap
 * Accepts both npub and hex pubkey formats
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  View,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../styles/theme';
import { useNWCZap } from '../../hooks/useNWCZap';
import { npubToHex } from '../../utils/ndkConversion';

const DEFAULT_ZAP_AMOUNT = 21;
const LONG_PRESS_DURATION = 500; // ms to trigger long press

interface NWCLightningButtonProps {
  recipientNpub: string;
  recipientName?: string;
  size?: 'small' | 'medium' | 'large' | 'rectangular';
  style?: any;
  onZapSuccess?: () => void;
  disabled?: boolean;
  customLabel?: string;
}

export const NWCLightningButton: React.FC<NWCLightningButtonProps> = ({
  recipientNpub,
  recipientName = 'User',
  size = 'medium',
  style,
  onZapSuccess,
  disabled = false,
  customLabel,
}) => {
  const { balance, sendZap, isInitialized, hasWallet, refreshBalance, error } = useNWCZap();
  const [isZapped, setIsZapped] = useState(false);
  const [isZapping, setIsZapping] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [defaultAmount, setDefaultAmount] = useState(DEFAULT_ZAP_AMOUNT);

  // Animation for the zap effect
  const scaleAnimation = useRef(new Animated.Value(1)).current;

  // Manual timer for long press detection
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Normalize recipient pubkey to hex format for consistency
  const recipientHex = React.useMemo(() => {
    const normalized = npubToHex(recipientNpub);
    if (!normalized) {
      console.warn('[NWCLightningButton] Invalid recipient pubkey:', recipientNpub.slice(0, 20));
      return null;
    }
    return normalized;
  }, [recipientNpub]);

  // Don't render if recipient is invalid
  if (!recipientHex) {
    console.log('[NWCLightningButton] Skipping render - invalid recipient');
    return null;
  }

  // Load zapped state and default amount on mount
  useEffect(() => {
    loadZapState();
    loadDefaultAmount();
  }, [recipientHex]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const loadZapState = async () => {
    try {
      const zappedUsers = await AsyncStorage.getItem('@runstr:zapped_users');
      if (zappedUsers) {
        const parsed = JSON.parse(zappedUsers);
        const today = new Date().toDateString();

        // Reset if it's a new day
        if (parsed.date !== today) {
          await AsyncStorage.setItem(
            '@runstr:zapped_users',
            JSON.stringify({
              date: today,
              users: [],
            })
          );
        } else if (parsed.users.includes(recipientHex)) {
          setIsZapped(true);
        }
      }
    } catch (error) {
      console.error('Error loading zap state:', error);
    }
  };

  const loadDefaultAmount = async () => {
    try {
      const stored = await AsyncStorage.getItem('@runstr:default_zap_amount');
      if (stored) {
        setDefaultAmount(parseInt(stored));
      }
    } catch (error) {
      console.error('Error loading default amount:', error);
    }
  };

  const saveZapState = async () => {
    try {
      const zappedUsers = await AsyncStorage.getItem('@runstr:zapped_users');
      const today = new Date().toDateString();

      let data = { date: today, users: [] as string[] };
      if (zappedUsers) {
        const parsed = JSON.parse(zappedUsers);
        if (parsed.date === today) {
          data = parsed;
        }
      }

      if (!data.users.includes(recipientHex)) {
        data.users.push(recipientHex);
        await AsyncStorage.setItem(
          '@runstr:zapped_users',
          JSON.stringify(data)
        );
      }
    } catch (error) {
      console.error('Error saving zap state:', error);
    }
  };

  const handlePressIn = () => {
    console.log('[NWCLightningButton] Press detected, checking state...');

    if (disabled) {
      console.log('[NWCLightningButton] Button is disabled');
      return;
    }

    if (!isInitialized || !hasWallet) {
      console.log('[NWCLightningButton] Wallet not ready');
      Alert.alert(
        'Wallet Not Connected',
        'Please connect your NWC wallet in settings to send zaps.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Start long press timer for custom amount
    console.log('[NWCLightningButton] Starting long press timer...');
    longPressTimer.current = setTimeout(() => {
      console.log('[NWCLightningButton] Long press detected, would open modal for custom amount');
      // For now, we'll just use default amount
      // In future, you can implement a custom amount modal here
      setShowModal(true);
      longPressTimer.current = null;
    }, LONG_PRESS_DURATION);
  };

  const handlePressOut = async () => {
    console.log('[NWCLightningButton] Press out - Timer active:', longPressTimer.current !== null);

    if (longPressTimer.current) {
      // Timer still active = quick tap (not long press)
      console.log('[NWCLightningButton] Quick tap detected, performing zap');
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;

      // Quick zap with default amount
      await performQuickZap();
    }
  };

  const performQuickZap = async () => {
    if (isZapping) return;

    // Check balance
    if (balance < defaultAmount) {
      Alert.alert(
        'Insufficient Balance',
        `You need ${defaultAmount} sats but only have ${balance} sats`,
        [{ text: 'OK' }]
      );
      return;
    }

    setIsZapping(true);

    // Animate the button press
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1.1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      const memo = `⚡ Quick zap from RUNSTR!`;

      console.log('[NWCLightningButton] Sending zap via NWC...');
      const success = await sendZap(recipientHex, defaultAmount, memo);

      if (success) {
        // Refresh balance
        await refreshBalance();

        // Set zapped state for color change
        setIsZapped(true);
        await saveZapState();
        onZapSuccess?.();

        // Brief success feedback
        Alert.alert(
          '⚡ Zapped!',
          `Sent ${defaultAmount} sats to ${recipientName}`,
          [{ text: 'OK' }],
          { cancelable: true }
        );
      } else {
        const errorMessage = error || 'Unable to send zap. Please try again.';
        Alert.alert('Failed', errorMessage);
      }
    } catch (error) {
      console.error('Quick zap error:', error);
      Alert.alert('Error', 'An error occurred while sending the zap');
    } finally {
      setIsZapping(false);
    }
  };

  const handleDefaultAmountChange = async (newDefault: number) => {
    setDefaultAmount(newDefault);
    try {
      await AsyncStorage.setItem(
        '@runstr:default_zap_amount',
        newDefault.toString()
      );
    } catch (error) {
      console.error('Error saving default amount:', error);
    }
  };

  // Size configurations
  const sizeConfig = {
    small: { icon: 16, button: 28 },
    medium: { icon: 20, button: 36 },
    large: { icon: 24, button: 44 },
    rectangular: { icon: 16, button: 26, width: customLabel ? 120 : 70 },
  };

  const config = sizeConfig[size] || sizeConfig.medium;
  const isRectangular = size === 'rectangular';

  // Always show button, but disable if not ready
  const isDisabled = disabled || !isInitialized || !hasWallet;

  return (
    <View
      onStartShouldSetResponder={() => true}
      onResponderGrant={() => {}}
    >
      <Animated.View
        style={[
          {
            transform: [{ scale: scaleAnimation }],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.button,
            isRectangular ? {
              width: 'width' in config ? config.width : 70,
              height: config.button,
              borderRadius: 4,
              flexDirection: 'row',
              paddingHorizontal: 8,
            } : {
              width: config.button,
              height: config.button,
              borderRadius: config.button / 2,
            },
            isZapped && styles.buttonZapped,
            isDisabled && styles.buttonDisabled,
            style,
          ]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isDisabled || isZapping}
          activeOpacity={0.7}
        >
          {isZapping ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <View style={[styles.buttonContent, isRectangular && styles.rectangularContent]}>
              <Animated.View style={!isInitialized && styles.uninitializedIcon}>
                <Ionicons
                  name="flash-outline"
                  size={config.icon}
                  color={
                    !isInitialized || !hasWallet
                      ? theme.colors.textMuted
                      : isZapped
                        ? theme.colors.background
                        : theme.colors.orangeBright
                  }
                />
              </Animated.View>
              {isRectangular && (
                <Text style={[styles.zapText, isDisabled && styles.zapTextDisabled]}>
                  {customLabel || 'Zap'}
                </Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: theme.colors.orangeDeep,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.orangeBright,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },

  buttonZapped: {
    borderColor: theme.colors.orangeBright,
    backgroundColor: 'rgba(255, 157, 66, 0.3)',
  },

  buttonDisabled: {
    opacity: 0.4,
    backgroundColor: '#0f0f0f',
  },

  uninitializedIcon: {
    opacity: 0.6,
  },

  buttonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  rectangularContent: {
    flexDirection: 'row',
    gap: 4,
  },

  zapText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },

  zapTextDisabled: {
    color: theme.colors.textMuted,
  },
});