/**
 * TeamsScreen - Bitcoin circular economy teams (formerly charities)
 * Users can select ONE team at a time to support with their workouts
 * Selections are stored in AsyncStorage and added to kind 1301/kind 1 posts
 * Features Lightning zap buttons for donations (tap = QR modal, long-press = quick NWC zap)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { theme } from '../styles/theme';
import { CHARITIES, Charity } from '../constants/charities';
import { ExternalZapModal } from '../components/nutzap/ExternalZapModal';
import { useNWCZap } from '../hooks/useNWCZap';
import { NWCWalletService } from '../services/wallet/NWCWalletService';
import { getInvoiceFromLightningAddress } from '../utils/lnurl';

// Storage key - charities are now stored as "teams"
const SELECTED_TEAM_KEY = '@runstr:selected_team_id';

interface TeamCardProps {
  charity: Charity;
  isSelected: boolean;
  onSelect: () => void;
  onZapPress: () => void;
  onZapLongPress: () => void;
  isZapping: boolean;
}

// ✅ PERFORMANCE: React.memo prevents re-renders when props haven't changed
const TeamCardComponent: React.FC<TeamCardProps> = ({
  charity,
  isSelected,
  onSelect,
  onZapPress,
  onZapLongPress,
  isZapping,
}) => {
  const scaleAnimation = useRef(new Animated.Value(1)).current;

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

  const handleZapPress = () => {
    animatePress();
    onZapPress();
  };

  const handleZapLongPress = () => {
    animatePress();
    onZapLongPress();
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      {charity.image ? (
        <Image source={charity.image} style={styles.cardImage} />
      ) : (
        <View style={styles.cardImagePlaceholder}>
          <Ionicons name="people" size={24} color={theme.colors.textMuted} />
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {charity.name}
        </Text>
        <Text style={styles.cardDescription} numberOfLines={2}>
          {charity.description}
        </Text>
      </View>

      {/* Zap Button */}
      <Animated.View style={{ transform: [{ scale: scaleAnimation }] }}>
        <TouchableOpacity
          onPress={handleZapPress}
          onLongPress={handleZapLongPress}
          style={[
            styles.zapButton,
            isZapping && styles.zappingButton,
          ]}
          activeOpacity={0.7}
          delayLongPress={500}
          disabled={isZapping}
        >
          <Ionicons
            name="flash-outline"
            size={16}
            color={theme.colors.orangeBright}
          />
        </TouchableOpacity>
      </Animated.View>

      {/* Selection Checkmark */}
      {isSelected && (
        <Ionicons
          name="checkmark-circle"
          size={24}
          color={theme.colors.success}
          style={styles.checkmark}
        />
      )}
    </TouchableOpacity>
  );
};

const TeamCard = React.memo(TeamCardComponent);

// ✅ PERFORMANCE: React.memo prevents re-renders when props haven't changed
const TeamsScreenComponent: React.FC = () => {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Zap modal state
  const [showZapModal, setShowZapModal] = useState(false);
  const [zapTargetCharity, setZapTargetCharity] = useState<Charity | null>(null);
  const [zappingCharityId, setZappingCharityId] = useState<string | null>(null);
  const [defaultZapAmount, setDefaultZapAmount] = useState(21);

  // NWC hook for wallet operations
  const { hasWallet, refreshBalance } = useNWCZap();

  // Load saved selection and default zap amount on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const [teamId, storedZapAmount] = await Promise.all([
          AsyncStorage.getItem(SELECTED_TEAM_KEY),
          AsyncStorage.getItem('@runstr:default_zap_amount'),
        ]);

        if (teamId) setSelectedTeamId(teamId);
        if (storedZapAmount) setDefaultZapAmount(parseInt(storedZapAmount, 10) || 21);
      } catch (error) {
        console.error('[TeamsScreen] Error loading state:', error);
      }
    };
    loadState();
  }, []);

  const handleSelectTeam = useCallback(async (charityId: string) => {
    try {
      // Toggle selection - if already selected, deselect
      const newValue = selectedTeamId === charityId ? null : charityId;
      if (newValue) {
        await AsyncStorage.setItem(SELECTED_TEAM_KEY, newValue);
      } else {
        await AsyncStorage.removeItem(SELECTED_TEAM_KEY);
      }
      setSelectedTeamId(newValue);
      console.log('[TeamsScreen] Selected team:', newValue);
    } catch (error) {
      console.error('[TeamsScreen] Error saving team selection:', error);
    }
  }, [selectedTeamId]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const teamId = await AsyncStorage.getItem(SELECTED_TEAM_KEY);
      if (teamId) setSelectedTeamId(teamId);
    } catch (error) {
      console.error('[TeamsScreen] Error refreshing:', error);
    }
    setIsRefreshing(false);
  }, []);

  // Single tap - open ExternalZapModal (handles invoice creation and verification)
  const handleZapPress = (charity: Charity) => {
    console.log(`[TeamsScreen] Opening zap modal for ${charity.name}`);
    setZapTargetCharity(charity);
    setShowZapModal(true);
  };

  // Long press - quick NWC zap
  const handleZapLongPress = async (charity: Charity) => {
    if (!hasWallet) {
      Toast.show({
        type: 'error',
        text1: 'No Wallet Connected',
        text2: 'Tap the zap button to use external wallets like Cash App or Strike.',
        position: 'top',
        visibilityTime: 4000,
      });
      return;
    }

    // Get FRESH balance directly from service (useNWCZap hook balance can be stale)
    const freshBalance = await NWCWalletService.getBalance();
    if (freshBalance.error || freshBalance.balance < defaultZapAmount) {
      Toast.show({
        type: 'error',
        text1: 'Insufficient Balance',
        text2: `Need ${defaultZapAmount} sats but only have ${freshBalance.balance}. Tap to use external wallet.`,
        position: 'top',
        visibilityTime: 4000,
      });
      return;
    }

    setZappingCharityId(charity.id);
    try {
      console.log(`[TeamsScreen] Quick NWC zap to ${charity.name} with ${defaultZapAmount} sats`);

      const { invoice } = await getInvoiceFromLightningAddress(
        charity.lightningAddress,
        defaultZapAmount,
        `Donation to ${charity.name}`
      );

      if (!invoice) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to get invoice from team.',
          position: 'top',
          visibilityTime: 4000,
        });
        return;
      }

      const paymentResult = await NWCWalletService.sendPayment(invoice);

      if (paymentResult.success) {
        await refreshBalance();
        Toast.show({
          type: 'reward',
          text1: 'Zapped!',
          text2: `Donated ${defaultZapAmount} sats to ${charity.name}`,
          position: 'top',
          visibilityTime: 3000,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: paymentResult.error || 'Failed to process donation.',
          position: 'top',
          visibilityTime: 4000,
        });
      }
    } catch (error) {
      console.error('[TeamsScreen] Quick zap error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to process donation. Tap to use external wallet.',
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setZappingCharityId(null);
    }
  };

  // Handle verified payment confirmation (called when payment detected)
  const handleZapSuccess = async () => {
    if (zapTargetCharity) {
      Toast.show({
        type: 'reward',
        text1: 'Thank You!',
        text2: `Donation to ${zapTargetCharity.name} verified!`,
        position: 'top',
        visibilityTime: 3000,
      });
      await refreshBalance();
    }
    setShowZapModal(false);
    setZapTargetCharity(null);
  };

  // Find selected team object
  const selectedTeam = selectedTeamId
    ? CHARITIES.find((c) => c.id === selectedTeamId)
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.orangeBright}
          />
        }
      >
        {/* Your Selected Team */}
        {selectedTeam && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>YOUR TEAM</Text>
            <TeamCard
              charity={selectedTeam}
              isSelected={true}
              onSelect={() => handleSelectTeam(selectedTeam.id)}
              onZapPress={() => handleZapPress(selectedTeam)}
              onZapLongPress={() => handleZapLongPress(selectedTeam)}
              isZapping={zappingCharityId === selectedTeam.id}
            />
          </View>
        )}

        {/* All Teams */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ALL TEAMS</Text>
          <Text style={styles.sectionSubtitle}>
            Select a team to support with your workouts
          </Text>
          {CHARITIES.map((charity) => (
            <TeamCard
              key={charity.id}
              charity={charity}
              isSelected={selectedTeamId === charity.id}
              onSelect={() => handleSelectTeam(charity.id)}
              onZapPress={() => handleZapPress(charity)}
              onZapLongPress={() => handleZapLongPress(charity)}
              isZapping={zappingCharityId === charity.id}
            />
          ))}
        </View>

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* External Zap Modal with charity donation verification */}
      {zapTargetCharity && (
        <ExternalZapModal
          visible={showZapModal}
          recipientNpub={zapTargetCharity.lightningAddress}
          recipientName={zapTargetCharity.name}
          memo={`Donation to ${zapTargetCharity.name}`}
          onClose={() => {
            setShowZapModal(false);
            setZapTargetCharity(null);
          }}
          onSuccess={handleZapSuccess}
          isCharityDonation={true}
          charityId={zapTargetCharity.id}
          charityLightningAddress={zapTargetCharity.lightningAddress}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: theme.typography.weights.semiBold,
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.medium,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  cardImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    marginBottom: 2,
  },
  cardDescription: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  zapButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  zappingButton: {
    opacity: 0.7,
  },
  checkmark: {
    marginLeft: 8,
  },
});

// ✅ PERFORMANCE: React.memo prevents re-renders when props haven't changed
export const TeamsScreen = React.memo(TeamsScreenComponent);
export default TeamsScreen;
