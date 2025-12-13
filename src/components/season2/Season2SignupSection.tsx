/**
 * Season2SignupSection - Sign Up button for Season 2
 * Handles registration flow for Season 2
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { useSeason2Registration, useSeason2Status } from '../../hooks/useSeason2';
import { SEASON_2_CONFIG } from '../../constants/season2';

export const Season2SignupSection: React.FC = () => {
  const {
    isRegistered,
    isOfficial,
    isLocalOnly,
    isLoading,
  } = useSeason2Registration();
  const { isEnded } = useSeason2Status();

  // Don't show if season ended
  if (isEnded) {
    return (
      <View style={styles.statusContainer}>
        <Ionicons
          name="checkmark-circle"
          size={24}
          color={theme.colors.textMuted}
        />
        <Text style={styles.statusText}>Season 2 has ended</Text>
      </View>
    );
  }

  // Already registered (official)
  if (isRegistered && isOfficial) {
    return (
      <View style={styles.statusContainer}>
        <Ionicons
          name="checkmark-circle"
          size={24}
          color={theme.colors.success}
        />
        <Text style={styles.registeredText}>You're registered!</Text>
      </View>
    );
  }

  // Registered locally, pending verification
  if (isRegistered && isLocalOnly) {
    return (
      <View style={styles.statusContainer}>
        <Ionicons
          name="time-outline"
          size={24}
          color={theme.colors.accent}
        />
        <Text style={styles.pendingText}>Registration pending verification</Text>
        <Text style={styles.pendingSubtext}>
          You'll appear on the leaderboard once verified
        </Text>
      </View>
    );
  }

  const handleSignUp = () => {
    if (SEASON_2_CONFIG.paymentUrl) {
      Linking.openURL(SEASON_2_CONFIG.paymentUrl);
    } else {
      Alert.alert(
        'Coming Soon',
        'Payment page is not available yet. Check back later!'
      );
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sign Up Button */}
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleSignUp}
        activeOpacity={0.7}
      >
        <Text style={styles.primaryButtonText}>Purchase Season Pass</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginBottom: 24,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.large,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
  },
  statusContainer: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.large,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  registeredText: {
    color: theme.colors.success,
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
  },
  pendingText: {
    color: theme.colors.accent,
    fontSize: 16,
    fontWeight: theme.typography.weights.medium,
  },
  pendingSubtext: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  statusText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
});

export default Season2SignupSection;
