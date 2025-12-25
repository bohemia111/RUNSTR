/**
 * RewardsScreen - Wallet and earnings dashboard
 * Extracted from SettingsScreen to make wallet features more accessible
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
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
import { StreakRewardsCard } from '../components/rewards/StreakRewardsCard';
import localWorkoutStorage from '../services/fitness/LocalWorkoutStorageService';
import type { LocalWorkout } from '../services/fitness/LocalWorkoutStorageService';
import { DailyRewardService } from '../services/rewards/DailyRewardService';
import { PledgeService } from '../services/pledge/PledgeService';
import { ActivePledgeCard } from '../components/pledge/ActivePledgeCard';
import type { Pledge } from '../types/pledge';

// Storage keys for donation settings
// Note: Team donations disabled until teams have lightning addresses
const SELECTED_CHARITY_KEY = '@runstr:selected_charity_id';
const DONATION_PERCENTAGE_KEY = '@runstr:donation_percentage';

export const RewardsScreen: React.FC = () => {
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

  // Lightning Address state
  const [rewardLightningAddress, setRewardLightningAddress] = useState<string>('');
  const [isValidLightningAddress, setIsValidLightningAddress] = useState(false);
  const [isSavingLightningAddress, setIsSavingLightningAddress] = useState(false);

  // Donation settings state (charity-only, no team donations)
  const [donationPercentage, setDonationPercentage] = useState<number>(0);
  const [selectedCharityId, setSelectedCharityId] = useState<string | null>(null);

  // Streak rewards state
  const [workouts, setWorkouts] = useState<LocalWorkout[]>([]);
  const [weeklyRewardsEarned, setWeeklyRewardsEarned] = useState(0);

  // Active pledge state
  const [activePledge, setActivePledge] = useState<Pledge | null>(null);

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

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load npub
      const npub = await AsyncStorage.getItem('@runstr:npub');
      if (npub) {
        setUserNpub(npub);
      }

      // Check NWC wallet status
      const nwcAvailable = await NWCStorageService.hasNWC();
      setHasNWC(nwcAvailable);

      // Load wallet balance if NWC is configured
      if (nwcAvailable) {
        await loadWalletBalance();
      }

      // Load reward lightning address
      const savedLightningAddress = await RewardLightningAddressService.getRewardLightningAddress();
      if (savedLightningAddress) {
        setRewardLightningAddress(savedLightningAddress);
        setIsValidLightningAddress(true);
      }

      // Load donation settings (charity-only)
      const [charityId, donationPct] = await Promise.all([
        AsyncStorage.getItem(SELECTED_CHARITY_KEY),
        AsyncStorage.getItem(DONATION_PERCENTAGE_KEY),
      ]);
      if (charityId) setSelectedCharityId(charityId);
      if (donationPct) setDonationPercentage(parseInt(donationPct, 10) || 0);

      // Load workouts for streak calculation
      const allWorkouts = await localWorkoutStorage.getAllWorkouts();
      setWorkouts(allWorkouts);

      // Load weekly rewards earned and active pledge
      const pubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');
      if (pubkey) {
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
      const walletService = NWCWalletService;
      const result = await walletService.getBalance();

      if (result.balance !== undefined) {
        setWalletBalance(result.balance);
      } else if (result.error) {
        console.error('[RewardsScreen] Failed to load wallet balance:', result.error);
      }
    } catch (error) {
      console.error('[RewardsScreen] Error loading wallet balance:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadSettings();
    } finally {
      setIsRefreshing(false);
    }
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
    const nwcAvailable = await NWCStorageService.hasNWC();
    setHasNWC(nwcAvailable);
    if (nwcAvailable) {
      await loadWalletBalance();
    }
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
    await loadSettings();
    setShowNWCConfirmation(false);
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

  // Get selected charity name
  const selectedCharity = selectedCharityId
    ? getCharityById(selectedCharityId)
    : null;

  // Calculate reward split based on donation percentage (charity-only)
  const baseReward = 50; // 50 sats per day
  const charityDonation = Math.floor(baseReward * (donationPercentage / 100));
  const userReward = baseReward - charityDonation;

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header - back button only */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
      </View>

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
        {/* Wallet Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WALLET</Text>
          <Card style={styles.walletCard}>
            {hasNWC ? (
              <>
                {/* Compact Balance Display */}
                <View style={styles.balanceHeader}>
                  <View style={styles.balanceLeft}>
                    <Ionicons name="flash" size={20} color={theme.colors.orangeBright} />
                    <Text style={styles.balanceValue}>{formatBalance(walletBalance)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={loadWalletBalance}
                  >
                    <Ionicons name="refresh" size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Wallet Actions */}
                <View style={styles.walletActions}>
                  <TouchableOpacity
                    style={styles.walletActionButton}
                    onPress={() => setShowSendModal(true)}
                  >
                    <Ionicons name="arrow-up-outline" size={22} color={theme.colors.orangeBright} />
                    <Text style={styles.walletActionText}>Send</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.walletActionButton}
                    onPress={() => setShowReceiveModal(true)}
                  >
                    <Ionicons name="arrow-down-outline" size={22} color={theme.colors.orangeBright} />
                    <Text style={styles.walletActionText}>Receive</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.walletActionButton}
                    onPress={() => setShowHistoryModal(true)}
                  >
                    <Ionicons name="time-outline" size={22} color={theme.colors.orangeBright} />
                    <Text style={styles.walletActionText}>History</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* Connect Wallet Prompt */
              <View style={styles.connectWalletContainer}>
                <Ionicons name="wallet-outline" size={48} color={theme.colors.textMuted} />
                <Text style={styles.connectWalletTitle}>Connect Your Wallet</Text>
                <Text style={styles.connectWalletDescription}>
                  Connect a Lightning wallet via Nostr Wallet Connect (NWC) to send and receive Bitcoin payments
                </Text>

                <TouchableOpacity
                  style={styles.connectWalletButton}
                  onPress={() => setShowQRScanner(true)}
                >
                  <Ionicons name="qr-code-outline" size={20} color="#000" style={{ marginRight: 8 }} />
                  <Text style={styles.connectWalletButtonText}>Scan QR Code</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.connectWalletButton, styles.connectWalletButtonSecondary]}
                  onPress={() => setShowWalletConfig(true)}
                >
                  <Ionicons name="create-outline" size={20} color={theme.colors.text} style={{ marginRight: 8 }} />
                  <Text style={[styles.connectWalletButtonText, styles.connectWalletButtonTextSecondary]}>
                    Enter Manually
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        </View>

        {/* Lightning Address Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>REWARDS LIGHTNING ADDRESS</Text>
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

        {/* Active Pledge Section (only shown if user has active pledge) */}
        {activePledge && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACTIVE PLEDGE</Text>
            <ActivePledgeCard pledge={activePledge} />
          </View>
        )}

        {/* Streak Rewards Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>STREAK REWARDS</Text>
          <StreakRewardsCard
            workouts={workouts}
            weeklyRewardsEarned={weeklyRewardsEarned}
          />
        </View>

        {/* Charity Donation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CHARITY DONATION</Text>
          <Card style={styles.card}>
            {/* Selected Charity */}
            <View style={styles.donationRecipients}>
              <View style={styles.recipientRow}>
                <Ionicons name="heart-outline" size={18} color={theme.colors.textMuted} />
                <Text style={styles.recipientLabel}>Charity:</Text>
                <Text style={styles.recipientValue}>
                  {selectedCharity?.name || 'None selected'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.editTeamsButton}
                onPress={() => navigation.navigate('Teams')}
              >
                <Text style={styles.editTeamsButtonText}>Select Charity</Text>
              </TouchableOpacity>
            </View>

            {/* Donation Percentage */}
            <View style={styles.donationPercentageContainer}>
              <Text style={styles.donationPercentageLabel}>
                Donate % of rewards:
              </Text>
              <View style={styles.percentageButtons}>
                {[0, 10, 25, 50].map((pct) => (
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

            {/* Reward Split Preview - Single Line */}
            {donationPercentage > 0 && selectedCharity && (
              <View style={styles.rewardSplitPreview}>
                <Text style={styles.splitText}>
                  Split: You {userReward} · {selectedCharity.name} {charityDonation}
                </Text>
              </View>
            )}
          </Card>
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
  balanceValue: {
    fontSize: 24,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
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

  // Donation settings styles
  donationRecipients: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 16,
    marginBottom: 16,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  recipientLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
    width: 60,
  },
  recipientValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  editTeamsButton: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  editTeamsButtonText: {
    fontSize: 14,
    color: theme.colors.orangeBright,
    fontWeight: theme.typography.weights.semiBold,
  },
  donationPercentageContainer: {
    marginBottom: 16,
  },
  donationPercentageLabel: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 12,
  },
  percentageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  percentageButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  percentageButtonActive: {
    backgroundColor: theme.colors.orangeBright,
    borderColor: theme.colors.orangeBright,
  },
  percentageButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  percentageButtonTextActive: {
    color: '#000',
  },
  rewardSplitPreview: {
    backgroundColor: 'rgba(255, 157, 66, 0.1)',
    borderRadius: theme.borderRadius.medium,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  splitText: {
    fontSize: 14,
    color: theme.colors.text,
    textAlign: 'center',
  },

});

export default RewardsScreen;
