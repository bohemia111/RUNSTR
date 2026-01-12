/**
 * RewardsScreen - Wallet and earnings dashboard
 * Extracted from SettingsScreen to make wallet features more accessible
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { theme } from '../styles/theme';
import { Card } from '../components/ui/Card';
import { CustomAlert } from '../components/ui/CustomAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NWCStorageService } from '../services/wallet/NWCStorageService';
import { NWCWalletService } from '../services/wallet/NWCWalletService';
import { WalletConfigModal } from '../components/wallet/WalletConfigModal';
import { SendModal } from '../components/wallet/SendModal';
import { ReceiveModal } from '../components/wallet/ReceiveModal';
import { HistoryModal } from '../components/wallet/HistoryModal';
import { QRScannerModal } from '../components/qr/QRScannerModal';
import { NWCQRConfirmationModal } from '../components/wallet/NWCQRConfirmationModal';
import type { QRData } from '../services/qr/QRCodeService';
import { RewardLightningAddressService } from '../services/rewards/RewardLightningAddressService';
import { getCharityById } from '../constants/charities';
import { Avatar } from '../components/ui/Avatar';
import { ExternalZapModal } from '../components/nutzap/ExternalZapModal';
import Toast from 'react-native-toast-message';
import { TotalRewardsCard } from '../components/rewards/TotalRewardsCard';
import { ImpactLevelCard } from '../components/rewards/ImpactLevelCard';
import { PersonalImpactSection } from '../components/rewards/PersonalImpactSection';
import localWorkoutStorage from '../services/fitness/LocalWorkoutStorageService';
import type { LocalWorkout } from '../services/fitness/LocalWorkoutStorageService';
import { DailyRewardService } from '../services/rewards/DailyRewardService';
import { StepRewardService } from '../services/rewards/StepRewardService';
import { dailyStepCounterService } from '../services/activity/DailyStepCounterService';
import { PledgeService } from '../services/pledge/PledgeService';
import { ActivePledgeCard } from '../components/pledge/ActivePledgeCard';
import type { Pledge } from '../types/pledge';
import WorkoutPublishingService from '../services/nostr/workoutPublishingService';
import type { PublishableWorkout } from '../services/nostr/workoutPublishingService';
import { UnifiedSigningService } from '../services/auth/UnifiedSigningService';
import { EnhancedSocialShareModal } from '../components/profile/shared/EnhancedSocialShareModal';

// Storage keys for donation settings
// Note: Teams are now charities (rebranded)
const SELECTED_TEAM_KEY = '@runstr:selected_team_id';
const DONATION_PERCENTAGE_KEY = '@runstr:donation_percentage';

// ✅ PERFORMANCE: React.memo prevents re-renders when props haven't changed
const RewardsScreenComponent: React.FC = () => {
  const navigation = useNavigation<any>();

  // NWC Wallet state
  const [hasNWC, setHasNWC] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showWalletConfig, setShowWalletConfig] = useState(false);

  // Wallet modals state
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [userNpub, setUserNpub] = useState<string>('');

  // QR Scanner state
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showNWCConfirmation, setShowNWCConfirmation] = useState(false);
  const [scannedNWCString, setScannedNWCString] = useState<string>('');

  // User pubkey for Impact Level
  const [userHexPubkey, setUserHexPubkey] = useState<string>('');

  // Lightning Address state
  const [rewardLightningAddress, setRewardLightningAddress] = useState<string>('');
  const [isValidLightningAddress, setIsValidLightningAddress] = useState(false);
  const [isSavingLightningAddress, setIsSavingLightningAddress] = useState(false);

  // Donation settings state (teams are charities now)
  // Default: 100% donation to ALS Network for new users
  const [donationPercentage, setDonationPercentage] = useState<number>(100);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>('als-foundation');

  // Streak rewards state
  const [workouts, setWorkouts] = useState<LocalWorkout[]>([]);
  const [weeklyRewardsEarned, setWeeklyRewardsEarned] = useState(0);

  // Active pledge state
  const [activePledge, setActivePledge] = useState<Pledge | null>(null);

  // Step rewards state
  const [currentSteps, setCurrentSteps] = useState(0);
  const [stepTodaySats, setStepTodaySats] = useState(0);
  const [isPublishingSteps, setIsPublishingSteps] = useState(false);

  // Step social post modal state
  const [showStepSocialModal, setShowStepSocialModal] = useState(false);
  const [isPostingSteps, setIsPostingSteps] = useState(false);
  const [stepWorkoutForPost, setStepWorkoutForPost] = useState<PublishableWorkout | null>(null);

  // Default zap amount state
  const [defaultZapAmount, setDefaultZapAmount] = useState(21);

  // Accordion section states (collapsed by default)
  const [donationExpanded, setDonationExpanded] = useState(false);
  const [lightningExpanded, setLightningExpanded] = useState(false);

  // Charity zap modal state
  const [showZapModal, setShowZapModal] = useState(false);

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<
    Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }>
  >([]);

  // Reload settings whenever screen gains focus (e.g., after selecting charity in TeamsScreen)
  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  const loadSettings = async () => {
    try {
      // Load npub
      const npub = await AsyncStorage.getItem('@runstr:npub');
      if (npub) {
        setUserNpub(npub);
      }

      // Check NWC wallet status (DON'T auto-fetch balance - blocks UI)
      const nwcAvailable = await NWCStorageService.hasNWC();
      setHasNWC(nwcAvailable);
      // Balance loaded on-demand when user taps refresh button

      // Load reward lightning address
      const savedLightningAddress = await RewardLightningAddressService.getRewardLightningAddress();
      if (savedLightningAddress) {
        setRewardLightningAddress(savedLightningAddress);
        setIsValidLightningAddress(true);
      }

      // Load donation settings (teams are charities now)
      // Default: 100% donation to ALS Network for new users
      const [teamId, donationPct, storedZapAmount] = await Promise.all([
        AsyncStorage.getItem(SELECTED_TEAM_KEY),
        AsyncStorage.getItem(DONATION_PERCENTAGE_KEY),
        AsyncStorage.getItem('@runstr:default_zap_amount'),
      ]);
      // Use stored values if they exist, otherwise keep defaults (100% to ALS)
      if (teamId !== null) setSelectedTeamId(teamId || 'als-foundation');
      if (donationPct !== null) setDonationPercentage(parseInt(donationPct, 10));
      if (storedZapAmount) setDefaultZapAmount(parseInt(storedZapAmount, 10) || 21);

      // Load workouts for streak calculation
      const allWorkouts = await localWorkoutStorage.getAllWorkouts();
      setWorkouts(allWorkouts);

      // Load weekly rewards earned and active pledge
      const pubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');
      if (pubkey) {
        setUserHexPubkey(pubkey);
        const weeklyRewards = await DailyRewardService.getWeeklyRewardsEarned(pubkey);
        setWeeklyRewardsEarned(weeklyRewards);

        // Load active pledge
        const pledge = await PledgeService.getActivePledge(pubkey);
        setActivePledge(pledge);
      }
    } catch (error) {
      console.error('[RewardsScreen] Error loading settings:', error);
    }
  };

  const loadWalletBalance = async () => {
    try {
      const result = await NWCWalletService.getBalance();
      if (!result.error) {
        setWalletBalance(result.balance);
      } else {
        console.error('[RewardsScreen] Failed to load wallet balance:', result.error);
      }
    } catch (error) {
      console.error('[RewardsScreen] Error loading wallet balance:', error);
    }
  };

  /**
   * Load step data and check for new milestones to reward
   */
  const loadStepData = async (checkMilestones: boolean = false) => {
    try {
      // Get current steps from device
      const stepData = await dailyStepCounterService.getTodaySteps();
      const steps = stepData?.steps ?? 0;
      setCurrentSteps(steps);

      // Get user pubkey for reward tracking
      const pubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');
      if (!pubkey) {
        return;
      }

      // Load step reward stats
      const stats = await StepRewardService.getStats(pubkey);
      setStepTodaySats(stats.todaySats);

      // Check and reward new milestones if requested
      if (checkMilestones && steps > 0) {
        console.log(`[RewardsScreen] Checking step milestones for ${steps} steps`);
        await StepRewardService.checkAndRewardMilestones(steps, pubkey);

        // Reload stats after potential rewards
        const updatedStats = await StepRewardService.getStats(pubkey);
        setStepTodaySats(updatedStats.todaySats);
      }
    } catch (error) {
      console.error('[RewardsScreen] Error loading step data:', error);
    }
  };

  // Periodic step polling while screen is active
  useFocusEffect(
    useCallback(() => {
      // Initial load with milestone check
      loadStepData(true);

      // Poll every 30 seconds while screen is focused
      const interval = setInterval(() => {
        loadStepData(true);
      }, 30000);

      return () => clearInterval(interval);
    }, [])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadSettings(),
        loadStepData(true),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  /**
   * Create a synthetic walking workout from current step count
   */
  const createStepWorkout = async (): Promise<PublishableWorkout | null> => {
    const pubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');
    if (!pubkey) return null;

    // Estimate duration based on steps (average ~100 steps/minute = ~1.67 steps/second)
    const estimatedDurationSeconds = Math.round(currentSteps / 1.67);

    // Estimate distance based on steps (average stride ~0.762m = 2.5 feet)
    const estimatedDistanceMeters = Math.round(currentSteps * 0.762);

    // Estimate calories (average ~0.04 kcal per step)
    const estimatedCalories = Math.round(currentSteps * 0.04);

    const now = new Date();
    const startTime = new Date(now.getTime() - estimatedDurationSeconds * 1000);

    return {
      id: `steps_${now.toISOString().split('T')[0]}_${Date.now()}`,
      userId: pubkey,
      type: 'walking',
      source: 'manual',
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      duration: estimatedDurationSeconds,
      distance: estimatedDistanceMeters,
      calories: estimatedCalories,
      syncedAt: now.toISOString(),
      metadata: {
        steps: currentSteps,
      },
      unitSystem: 'metric',
    };
  };

  /**
   * Publish today's steps as a kind 1301 walking workout event (competition entry)
   */
  const handleStepCompete = async () => {
    setIsPublishingSteps(true);
    try {
      // Get user's signer using singleton instance
      const signingService = UnifiedSigningService.getInstance();
      const signer = await signingService.getSigner();
      if (!signer) {
        throw new Error('No signer available');
      }

      const stepWorkout = await createStepWorkout();
      if (!stepWorkout) {
        throw new Error('No user pubkey found');
      }

      // Publish to Nostr as kind 1301
      const result = await WorkoutPublishingService.saveWorkoutToNostr(
        stepWorkout,
        signer,
        stepWorkout.userId
      );

      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Steps Published!',
          text2: `${currentSteps.toLocaleString()} steps entered into competition`,
          position: 'top',
          visibilityTime: 3000,
        });
      } else {
        throw new Error(result.error || 'Failed to publish');
      }
    } catch (error) {
      console.error('[RewardsScreen] Step compete error:', error);
      Toast.show({
        type: 'error',
        text1: 'Publish Failed',
        text2: error instanceof Error ? error.message : 'Could not publish steps',
        position: 'top',
      });
    } finally {
      setIsPublishingSteps(false);
    }
  };

  /**
   * Open social share modal to post steps as a kind 1 social post
   */
  const handleStepPost = async () => {
    const stepWorkout = await createStepWorkout();
    if (!stepWorkout) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not create step workout',
        position: 'top',
      });
      return;
    }

    setStepWorkoutForPost(stepWorkout);
    setShowStepSocialModal(true);
  };

  const formatBalance = (sats: number): string => {
    if (sats >= 1000000) {
      return `${(sats / 1000000).toFixed(2)}M sats`;
    } else if (sats >= 1000) {
      return `${(sats / 1000).toFixed(1)}K sats`;
    }
    return `${sats.toLocaleString()} sats`;
  };

  const handleWalletConfigSuccess = async () => {
    // NWC was just saved - set state directly
    setHasNWC(true);
    // Fetch balance immediately (like v1.0.0)
    // Safe now that modal state conflict is fixed via setTimeout deferral
    const result = await NWCWalletService.getBalance();
    if (!result.error) {
      setWalletBalance(result.balance);
    }
  };

  const handleDisconnectWallet = () => {
    setAlertTitle('Disconnect Wallet');
    setAlertMessage('Are you sure you want to disconnect your wallet? You can reconnect anytime.');
    setAlertButtons([
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          try {
            await NWCStorageService.clearNWC();
            NWCWalletService.forceReset();
            setHasNWC(false);
            setWalletBalance(0);
          } catch (error) {
            console.error('[RewardsScreen] Disconnect error:', error);
          }
        },
      },
    ]);
    setAlertVisible(true);
  };

  const handleQRScanned = (qrData: QRData) => {
    try {
      if (qrData.type === 'nwc') {
        if (!qrData.connectionString || typeof qrData.connectionString !== 'string') {
          throw new Error('Invalid NWC connection string');
        }
        setScannedNWCString(qrData.connectionString);
        setShowNWCConfirmation(true);
      } else {
        Alert.alert(
          'Wrong QR Code Type',
          'Please scan an NWC wallet connection QR code.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[RewardsScreen] QR scan error:', error);
      Alert.alert('Error', 'Failed to process QR code. Please try again.', [{ text: 'OK' }]);
    }
  };

  const handleNWCConnected = async () => {
    // Just update NWC status - DON'T call loadSettings() which would try to fetch balance
    const nwcAvailable = await NWCStorageService.hasNWC();
    setHasNWC(nwcAvailable);
    setShowNWCConfirmation(false);
    // Balance will be 0 until user taps refresh - this is intentional
  };

  const handleLightningAddressChange = (text: string) => {
    setRewardLightningAddress(text);
    setIsValidLightningAddress(RewardLightningAddressService.isValidLightningAddress(text));
  };

  const handleSaveLightningAddress = async () => {
    if (!isValidLightningAddress || !rewardLightningAddress.trim()) {
      return;
    }

    setIsSavingLightningAddress(true);
    try {
      await RewardLightningAddressService.setRewardLightningAddress(rewardLightningAddress.trim());
      setAlertTitle('Saved');
      setAlertMessage('Your rewards lightning address has been saved.');
      setAlertButtons([{ text: 'OK' }]);
      setAlertVisible(true);
    } catch (error) {
      console.error('[RewardsScreen] Error saving lightning address:', error);
      setAlertTitle('Error');
      setAlertMessage('Failed to save lightning address. Please try again.');
      setAlertButtons([{ text: 'OK' }]);
      setAlertVisible(true);
    } finally {
      setIsSavingLightningAddress(false);
    }
  };

  const handleDonationPercentageChange = async (percentage: number) => {
    try {
      setDonationPercentage(percentage);
      await AsyncStorage.setItem(DONATION_PERCENTAGE_KEY, percentage.toString());
      console.log('[RewardsScreen] Saved donation percentage:', percentage);
    } catch (error) {
      console.error('[RewardsScreen] Error saving donation percentage:', error);
    }
  };

  const handleZapAmountSelect = async (amount: number) => {
    setDefaultZapAmount(amount);
    try {
      await AsyncStorage.setItem('@runstr:default_zap_amount', amount.toString());
      console.log('[RewardsScreen] Saved default zap amount:', amount);
    } catch (error) {
      console.error('[RewardsScreen] Error saving zap amount:', error);
    }
  };

  // Preset zap amount options
  const ZAP_AMOUNT_OPTIONS = [21, 100, 500, 1000];

  // Get selected team (charity) data
  const selectedTeam = selectedTeamId
    ? getCharityById(selectedTeamId)
    : null;

  // Handle zap to charity - opens ExternalZapModal
  const handleZapCharity = () => {
    if (!selectedTeam) return;
    setShowZapModal(true);
  };

  // Handle successful zap
  const handleZapSuccess = () => {
    if (selectedTeam) {
      Toast.show({
        type: 'success',
        text1: 'Zapped!',
        text2: `Donation to ${selectedTeam.name} verified!`,
        position: 'top',
        visibilityTime: 3000,
      });
    }
    setShowZapModal(false);
  };

  // Calculate reward split based on donation percentage
  const baseReward = 50; // 50 sats per day
  const teamDonation = Math.floor(baseReward * (donationPercentage / 100));
  const userReward = baseReward - teamDonation;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
          />
        }
      >
        {/* Total Rewards Card - Unified Hero Section */}
        <TotalRewardsCard
          workouts={workouts}
          weeklyRewardsEarned={weeklyRewardsEarned}
          stepRewardsEarned={stepTodaySats}
          currentSteps={currentSteps}
          onCompete={handleStepCompete}
          onPost={handleStepPost}
          isPublishing={isPublishingSteps}
          isPosting={isPostingSteps}
        />

        {/* Impact Level Card */}
        {userHexPubkey && (
          <ImpactLevelCard pubkey={userHexPubkey} />
        )}

        {/* Personal Impact Section (collapsed by default) */}
        {userHexPubkey && (
          <PersonalImpactSection pubkey={userHexPubkey} defaultExpanded={false} />
        )}

        {/* Active Pledge Section (only shown if user has active pledge) */}
        {activePledge && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACTIVE PLEDGE</Text>
            <ActivePledgeCard pledge={activePledge} />
          </View>
        )}

        {/* Donation Splits Section - Collapsible */}
        <View style={styles.accordionContainer}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setDonationExpanded(!donationExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.accordionHeaderLeft}>
              <Ionicons name="git-branch-outline" size={18} color="#FF9D42" />
              <Text style={styles.accordionTitle}>DONATION SPLITS</Text>
            </View>
            <Ionicons
              name={donationExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>
          {donationExpanded && (
            <View style={styles.accordionContent}>
              <View style={styles.donationCard}>
                {/* Team Header Row - Avatar + Name + Zap Button */}
                <View style={styles.teamHeaderRow}>
                  <TouchableOpacity
                    style={styles.teamInfoSection}
                    onPress={() => navigation.navigate('Teams')}
                    activeOpacity={0.7}
                  >
                    {selectedTeam ? (
                      <>
                        <Avatar
                          name={selectedTeam.name}
                          size={44}
                          imageSource={selectedTeam.image}
                        />
                        <View style={styles.teamTextSection}>
                          <Text style={styles.teamName}>{selectedTeam.name}</Text>
                          <Text style={styles.teamLightningAddress}>
                            {selectedTeam.lightningAddress}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={styles.emptyAvatarPlaceholder}>
                          <Ionicons name="add" size={24} color="#666" />
                        </View>
                        <View style={styles.teamTextSection}>
                          <Text style={styles.teamNameEmpty}>Select a charity</Text>
                          <Text style={styles.teamLightningAddress}>Tap to choose</Text>
                        </View>
                      </>
                    )}
                  </TouchableOpacity>
                  {selectedTeam && (
                    <TouchableOpacity
                      style={styles.zapButton}
                      onPress={handleZapCharity}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="flash-outline" size={22} color="#FF9D42" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Percentage Selector */}
                <View style={styles.percentageSection}>
                  <View style={styles.percentageButtons}>
                    {[0, 10, 25, 50, 100].map((pct) => (
                      <TouchableOpacity
                        key={pct}
                        style={[
                          styles.percentageButton,
                          donationPercentage === pct && styles.percentageButtonActive,
                        ]}
                        onPress={() => handleDonationPercentageChange(pct)}
                      >
                        <Text
                          style={[
                            styles.percentageButtonText,
                            donationPercentage === pct && styles.percentageButtonTextActive,
                          ]}
                        >
                          {pct}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Reward Split Preview */}
                {donationPercentage > 0 && selectedTeam && (
                  <View style={styles.rewardSplitPreview}>
                    <Text style={styles.splitTextLabel}>You</Text>
                    <Text style={styles.splitTextValue}>{userReward} sats</Text>
                    <Ionicons name="arrow-forward" size={14} color="#666" style={styles.splitArrow} />
                    <Text style={styles.splitTextLabel}>{selectedTeam.displayName}</Text>
                    <Text style={styles.splitTextValue}>{teamDonation} sats</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Lightning Address Section - Collapsible */}
        <View style={styles.accordionContainer}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setLightningExpanded(!lightningExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.accordionHeaderLeft}>
              <Ionicons name="wallet-outline" size={18} color="#FF9D42" />
              <Text style={styles.accordionTitle}>REWARDS ADDRESS</Text>
            </View>
            <Ionicons
              name={lightningExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>
          {lightningExpanded && (
            <View style={styles.accordionContent}>
              <Card style={styles.card}>
                <Text style={styles.lightningAddressDescription}>
                  Your Lightning address for receiving payments and tips
                </Text>
                <View style={styles.lightningAddressInputRow}>
                  <TextInput
                    style={[
                      styles.lightningAddressInput,
                      rewardLightningAddress && !isValidLightningAddress && styles.lightningAddressInputError,
                    ]}
                    value={rewardLightningAddress}
                    onChangeText={handleLightningAddressChange}
                    placeholder="user@getalby.com"
                    placeholderTextColor={theme.colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                  <TouchableOpacity
                    style={[
                      styles.lightningAddressSaveButton,
                      (!isValidLightningAddress || isSavingLightningAddress) && styles.lightningAddressSaveButtonDisabled,
                    ]}
                    onPress={handleSaveLightningAddress}
                    disabled={!isValidLightningAddress || isSavingLightningAddress}
                  >
                    {isSavingLightningAddress ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Ionicons
                        name={isValidLightningAddress ? 'checkmark' : 'save-outline'}
                        size={20}
                        color={isValidLightningAddress ? '#000' : theme.colors.textMuted}
                      />
                    )}
                  </TouchableOpacity>
                </View>
                {rewardLightningAddress && !isValidLightningAddress && (
                  <Text style={styles.lightningAddressError}>
                    Invalid format. Use: user@domain.com
                  </Text>
                )}
              </Card>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Modals */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        onClose={() => setAlertVisible(false)}
      />

      <WalletConfigModal
        visible={showWalletConfig}
        onClose={() => setShowWalletConfig(false)}
        onSuccess={handleWalletConfigSuccess}
        allowSkip={true}
      />

      <SendModal
        visible={showSendModal}
        onClose={() => setShowSendModal(false)}
        currentBalance={walletBalance}
      />

      <ReceiveModal
        visible={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        currentBalance={walletBalance}
        userNpub={userNpub}
      />

      <HistoryModal
        visible={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />

      {/* External Zap Modal for charity donations */}
      {selectedTeam && (
        <ExternalZapModal
          visible={showZapModal}
          recipientNpub={selectedTeam.lightningAddress}
          recipientName={selectedTeam.name}
          memo={`Donation to ${selectedTeam.name}`}
          onClose={() => setShowZapModal(false)}
          onSuccess={handleZapSuccess}
          isCharityDonation={true}
          charityId={selectedTeam.id}
          charityLightningAddress={selectedTeam.lightningAddress}
        />
      )}

      {showQRScanner && (
        <QRScannerModal
          visible={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onScanned={handleQRScanned}
        />
      )}

      {showNWCConfirmation && (
        <NWCQRConfirmationModal
          visible={showNWCConfirmation}
          onClose={() => setShowNWCConfirmation(false)}
          connectionString={scannedNWCString}
          onSuccess={handleNWCConnected}
        />
      )}

      {/* Step Social Share Modal */}
      {stepWorkoutForPost && (
        <EnhancedSocialShareModal
          visible={showStepSocialModal}
          workout={stepWorkoutForPost}
          userId={stepWorkoutForPost.userId}
          onClose={() => {
            setShowStepSocialModal(false);
            setStepWorkoutForPost(null);
          }}
          onSuccess={() => {
            setShowStepSocialModal(false);
            setStepWorkoutForPost(null);
            Toast.show({
              type: 'success',
              text1: 'Steps Posted!',
              text2: 'Your steps are now on Nostr',
              position: 'top',
              visibilityTime: 3000,
            });
          }}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    padding: 16,
  },
  walletCard: {
    padding: 16,
  },

  // Compact balance header
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  headerIconButton: {
    padding: 6,
  },
  refreshButton: {
    padding: 6,
  },

  // Wallet actions
  walletActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  walletActionButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  walletActionText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
  },

  // Quick zap amount styles
  zapSettingContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  zapSettingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  zapSettingLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  zapAmountButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  zapAmountButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  zapAmountButtonActive: {
    backgroundColor: theme.colors.orangeBright,
    borderColor: theme.colors.orangeBright,
  },
  zapAmountButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  zapAmountButtonTextActive: {
    color: '#000',
  },

  // Connect wallet styles
  connectWalletContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  connectWalletTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  connectWalletDescription: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  connectWalletButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.medium,
    paddingVertical: 12,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  connectWalletButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 12,
  },
  connectWalletButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: '#000',
  },
  connectWalletButtonTextSecondary: {
    color: theme.colors.text,
  },

  // Lightning address styles
  lightningAddressDescription: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 12,
  },
  lightningAddressInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lightningAddressInput: {
    flex: 1,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.text,
  },
  lightningAddressInputError: {
    borderColor: theme.colors.error || '#ff4444',
  },
  lightningAddressSaveButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  lightningAddressSaveButtonDisabled: {
    backgroundColor: theme.colors.border,
    opacity: 0.6,
  },
  lightningAddressError: {
    color: theme.colors.error || '#ff4444',
    fontSize: 12,
    marginTop: 6,
  },

  // Donation settings styles - Option B design
  donationCard: {
    padding: 14,
  },
  teamHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  teamInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  teamTextSection: {
    flex: 1,
  },
  teamName: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 2,
  },
  teamNameEmpty: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semiBold,
    color: '#666',
    marginBottom: 2,
  },
  teamLightningAddress: {
    fontSize: 12,
    color: '#888',
  },
  emptyAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  zapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageSection: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    marginBottom: 14,
  },
  percentageButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  percentageButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  percentageButtonActive: {
    backgroundColor: theme.colors.orangeBright,
    borderColor: theme.colors.orangeBright,
  },
  percentageButtonText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  percentageButtonTextActive: {
    color: '#000',
  },
  rewardSplitPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  splitTextLabel: {
    fontSize: 13,
    color: '#888',
  },
  splitTextValue: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  splitArrow: {
    marginHorizontal: 4,
  },

  // Accordion styles
  accordionContainer: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    overflow: 'hidden',
    marginBottom: 12,
  },

  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },

  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  accordionTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
    color: '#FF9D42',
    letterSpacing: 1,
  },

  accordionContent: {
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },

});

// ✅ PERFORMANCE: React.memo prevents re-renders when props haven't changed
export const RewardsScreen = React.memo(RewardsScreenComponent);
export default RewardsScreen;
