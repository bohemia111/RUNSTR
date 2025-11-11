/**
 * SettingsScreen - Consolidated settings for Account, Teams, and Notifications
 * Accessed from Profile screen settings button
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
  Switch,
  RefreshControl,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { theme } from '../styles/theme';
import { Team } from '../types';
import {
  TTSPreferencesService,
  type TTSSettings,
} from '../services/activity/TTSPreferencesService';
import TTSAnnouncementService from '../services/activity/TTSAnnouncementService';
import { DeleteAccountService } from '../services/auth/DeleteAccountService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CustomAlert } from '../components/ui/CustomAlert';
import { NotificationsTab } from '../components/profile/NotificationsTab';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, CommonActions } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { NWCStorageService } from '../services/wallet/NWCStorageService';
import { WalletConfigModal } from '../components/wallet/WalletConfigModal';
import { SendModal } from '../components/wallet/SendModal';
import { ReceiveModal } from '../components/wallet/ReceiveModal';
import { HistoryModal } from '../components/wallet/HistoryModal';
import { QRScannerModal } from '../components/qr/QRScannerModal';
import { NWCQRConfirmationModal } from '../components/wallet/NWCQRConfirmationModal';
import type { QRData } from '../services/qr/QRCodeService';
import { useNutzap } from '../hooks/useNutzap';
import { useWalletStore } from '../store/walletStore';
import { dailyStepCounterService } from '../services/activity/DailyStepCounterService';
import { CharitySelectionService } from '../services/charity/CharitySelectionService';
import type { Charity } from '../constants/charities';
import { Alert } from 'react-native';

interface SettingsScreenProps {
  currentTeam?: Team;
  onNavigateToTeamDiscovery?: () => void;
  onViewCurrentTeam?: () => void;
  onCaptainDashboard?: () => void;
  onHelp?: () => void;
  onContactSupport?: () => void;
  onPrivacyPolicy?: () => void;
  onSignOut?: () => void;
}

interface SettingItemProps {
  title: string;
  subtitle: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

const SettingItem: React.FC<SettingItemProps> = ({
  title,
  subtitle,
  onPress,
  rightElement,
}) => {
  const Wrapper: React.ComponentType<any> = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={styles.settingItem}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      {rightElement || (onPress && <Text style={styles.chevron}>›</Text>)}
    </Wrapper>
  );
};

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  currentTeam,
  onNavigateToTeamDiscovery,
  onViewCurrentTeam,
  onCaptainDashboard,
  onHelp,
  onContactSupport,
  onPrivacyPolicy,
  onSignOut,
}) => {
  const navigation = useNavigation();
  const [userRole, setUserRole] = useState<'captain' | 'member' | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [userNsec, setUserNsec] = useState<string | null>(null);
  const [ttsSettings, setTtsSettings] = useState<TTSSettings>({
    enabled: true,
    speechRate: 1.0,
    announceOnSummary: true,
    includeSplits: false,
    announceLiveSplits: false,
  });
  const [backgroundTrackingEnabled, setBackgroundTrackingEnabled] = useState(false);

  // Charity Selection state
  const [selectedCharity, setSelectedCharity] = useState<Charity | null>(null);

  // NWC Wallet state
  const [hasNWC, setHasNWC] = useState(false);
  const [showWalletConfig, setShowWalletConfig] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Wallet modals state
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [userNpub, setUserNpub] = useState<string>('');

  // QR Scanner state (Phase 1: moved from ProfileScreen)
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showNWCConfirmation, setShowNWCConfirmation] = useState(false);
  const [scannedNWCString, setScannedNWCString] = useState<string>('');

  // Wallet balance state (don't initialize hooks unconditionally to prevent infinite loop)
  const [walletBalance, setWalletBalance] = useState(0);

  // Alert state for CustomAlert
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
      // Load TTS settings
      const ttsPrefs = await TTSPreferencesService.getTTSSettings();
      setTtsSettings(ttsPrefs);

      // ✅ PERFORMANCE FIX: Batch AsyncStorage reads using multiGet
      // This is 3x faster than sequential getItem calls
      const keys = ['@runstr:user_role', '@runstr:user_nsec', '@runstr:npub'];
      const values = await AsyncStorage.multiGet(keys);

      const storedRole = values[0][1]; // [key, value] pairs
      const nsec = values[1][1];
      const npub = values[2][1];

      setUserRole(storedRole as 'captain' | 'member' | null);
      setUserNsec(nsec);

      if (npub) {
        setUserNpub(npub);
      }

      // Check NWC wallet status (don't initialize to prevent infinite loop)
      const nwcAvailable = await NWCStorageService.hasNWC();
      setHasNWC(nwcAvailable);

      // Check if background step tracking is available and enabled
      const available = await dailyStepCounterService.isAvailable();
      if (available) {
        const permissionStatus = await dailyStepCounterService.checkPermissionStatus();
        setBackgroundTrackingEnabled(permissionStatus === 'granted');
      }

      // Load selected charity
      const charity = await CharitySelectionService.getSelectedCharity();
      setSelectedCharity(charity);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleTTSSettingChange = async <K extends keyof TTSSettings>(
    key: K,
    value: TTSSettings[K]
  ) => {
    try {
      setTtsSettings((prev) => ({
        ...prev,
        [key]: value,
      }));

      const updatedSettings = await TTSPreferencesService.updateTTSSetting(
        key,
        value
      );
      setTtsSettings(updatedSettings);
    } catch (error) {
      console.error(`Error updating TTS setting ${key}:`, error);
      // Revert on error
      const currentSettings = await TTSPreferencesService.getTTSSettings();
      setTtsSettings(currentSettings);
    }
  };

  const handleTestTTS = async () => {
    try {
      await TTSAnnouncementService.testSpeech();
    } catch (error) {
      console.error('Test TTS failed:', error);
      setAlertTitle('Error');
      setAlertMessage('Failed to play test announcement');
      setAlertButtons([{ text: 'OK' }]);
      setAlertVisible(true);
    }
  };

  const handleBackgroundTrackingToggle = async (enabled: boolean) => {
    if (enabled) {
      // Request permission when user toggles on
      const granted = await dailyStepCounterService.requestPermissions();
      setBackgroundTrackingEnabled(granted);

      if (!granted) {
        // Show alert if permission denied
        setAlertTitle('Permission Required');
        setAlertMessage(
          'Background step tracking requires motion permission to automatically count steps throughout the day.\n\n' +
          'You can enable this permission in your device settings.'
        );
        setAlertButtons([
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => dailyStepCounterService.openSettings()
          }
        ]);
        setAlertVisible(true);
      }
    } else {
      // Just disable the toggle - permissions stay granted on device level
      setBackgroundTrackingEnabled(false);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleSignOut = async () => {
    setAlertTitle('Sign Out');
    setAlertMessage('Are you sure you want to sign out?');
    setAlertButtons([
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            // Clear all stored data
            await AsyncStorage.multiRemove([
              '@runstr:user_nsec',
              '@runstr:npub',
              '@runstr:hex_pubkey',
              '@runstr:user_role',
            ]);

            // Call the provided sign out handler
            onSignOut?.();
          } catch (error) {
            console.error('Error signing out:', error);
            setAlertTitle('Error');
            setAlertMessage('Failed to sign out. Please try again.');
            setAlertButtons([{ text: 'OK' }]);
            setAlertVisible(true);
          }
        },
      },
    ]);
    setAlertVisible(true);
  };

  const handleDeleteAccount = async () => {
    // Get data summary first
    const deleteService = DeleteAccountService.getInstance();
    const dataSummary = await deleteService.getDataSummary();

    // Build warning message with actual data
    let warningDetails = 'This action will:\n\n';
    warningDetails += '• Permanently remove your nsec from this device\n';
    if (dataSummary.hasWallet) {
      warningDetails +=
        '• Delete your Lightning wallet and any remaining balance\n';
    }
    if (dataSummary.teamCount > 0) {
      warningDetails += `• Remove you from ${dataSummary.teamCount} team${
        dataSummary.teamCount > 1 ? 's' : ''
      }\n`;
    }
    if (dataSummary.workoutCount > 0) {
      warningDetails += `• Delete ${dataSummary.workoutCount} cached workout${
        dataSummary.workoutCount > 1 ? 's' : ''
      }\n`;
    }
    warningDetails +=
      '• Request deletion from Nostr relays (cannot be guaranteed)\n';
    warningDetails += '\nThis action CANNOT be undone!';

    // First warning dialog
    setAlertTitle('Delete Account');
    setAlertMessage(
      'Are you sure you want to permanently delete your account?'
    );
    setAlertButtons([
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () => {
          // Close first alert and show second warning
          setAlertVisible(false);
          setTimeout(() => {
            setAlertTitle('⚠️ Final Warning');
            setAlertMessage(warningDetails);
            setAlertButtons([
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'I Understand, Delete My Account',
                style: 'destructive',
                onPress: () => performAccountDeletion(),
              },
            ]);
            setAlertVisible(true);
          }, 100);
        },
      },
    ]);
    setAlertVisible(true);
  };

  const performAccountDeletion = async () => {
    setIsDeletingAccount(true);

    try {
      const deleteService = DeleteAccountService.getInstance();
      await deleteService.deleteAccount();

      // Navigate to login screen and reset navigation stack
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        })
      );

      // Show success message after navigation
      setTimeout(() => {
        setAlertTitle('Account Deleted');
        setAlertMessage('Your account has been successfully deleted.');
        setAlertButtons([{ text: 'OK' }]);
        setAlertVisible(true);
      }, 100);
    } catch (error) {
      console.error('Account deletion failed:', error);
      setAlertTitle('Deletion Failed');
      setAlertMessage(
        'Failed to delete your account. Please try again or contact support.'
      );
      setAlertButtons([{ text: 'OK' }]);
      setAlertVisible(true);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleWalletConfigSuccess = async () => {
    // Reload NWC status after successful configuration
    const nwcAvailable = await NWCStorageService.hasNWC();
    setHasNWC(nwcAvailable);

    // Wallet initialization removed to prevent infinite loop
    // Balance will be loaded when user opens wallet features
  };

  // Helper function to format balance
  const formatBalance = (sats: number): string => {
    if (sats >= 1000000) {
      return `${(sats / 1000000).toFixed(2)}M sats`;
    } else if (sats >= 1000) {
      return `${(sats / 1000).toFixed(1)}K sats`;
    }
    return `${sats} sats`;
  };

  const handleDisconnectWallet = async () => {
    setAlertTitle('Disconnect Wallet?');
    setAlertMessage(
      'This will remove your wallet connection. You can reconnect anytime.'
    );
    setAlertButtons([
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await NWCStorageService.clearNWC();
          setHasNWC(false);
        },
      },
    ]);
    setAlertVisible(true);
  };

  // QR Scanner handlers (Phase 1: moved from ProfileScreen)
  const handleQRScanned = (qrData: QRData) => {
    try {
      // Only handle NWC QR codes in Settings
      if (qrData.type === 'nwc') {
        // Validate NWC data before setting state
        if (!qrData.connectionString || typeof qrData.connectionString !== 'string') {
          throw new Error('Invalid NWC connection string');
        }
        setScannedNWCString(qrData.connectionString);
        setShowNWCConfirmation(true);
      } else {
        // Other QR types not handled in Settings
        Alert.alert(
          'Wrong QR Code Type',
          'Please scan an NWC wallet connection QR code. Event and challenge QR codes should be scanned from the event pages.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[SettingsScreen] QR scan error:', error);
      Alert.alert(
        'Error',
        'Failed to process QR code. Please try scanning again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleNWCConnected = async () => {
    console.log('[SettingsScreen] NWC wallet connected successfully');
    // Reload settings to update wallet status
    await loadSettings();
    setShowNWCConfirmation(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      console.log('[SettingsScreen] Pull-to-refresh: Reloading settings...');
      await loadSettings();
      console.log('[SettingsScreen] Settings reloaded successfully');
    } catch (error) {
      console.error('[SettingsScreen] Settings refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleChangeCharity = () => {
    // Get all available charities
    const charities = CharitySelectionService.getAllCharities();

    // Create buttons for each charity
    const charityButtons = charities.map((charity) => ({
      text: charity.name,
      onPress: async () => {
        try {
          const success = await CharitySelectionService.setSelectedCharity(
            charity.id
          );
          if (success) {
            setSelectedCharity(charity);
            // Show success message
            setAlertVisible(false);
            setTimeout(() => {
              setAlertTitle('Charity Updated');
              setAlertMessage(
                `You are now supporting ${charity.name}. All your competition winnings will go to this charity.`
              );
              setAlertButtons([{ text: 'OK' }]);
              setAlertVisible(true);
            }, 100);
          }
        } catch (error) {
          console.error('Error setting charity:', error);
          setAlertVisible(false);
          setTimeout(() => {
            setAlertTitle('Error');
            setAlertMessage('Failed to update charity. Please try again.');
            setAlertButtons([{ text: 'OK' }]);
            setAlertVisible(true);
          }, 100);
        }
      },
    }));

    // Add cancel button
    charityButtons.push({ text: 'Cancel', style: 'cancel' });

    setAlertTitle('Select Your Charity');
    setAlertMessage(
      'Choose which charity will receive your competition winnings'
    );
    setAlertButtons(charityButtons as any);
    setAlertVisible(true);
  };

  const handleBackupPassword = () => {
    if (!userNsec) {
      setAlertTitle('Error');
      setAlertMessage('No account key found. Please sign in again.');
      setAlertButtons([{ text: 'OK' }]);
      setAlertVisible(true);
      return;
    }

    // First warning dialog with education
    setAlertTitle('🔐 Backup Your Password');
    setAlertMessage(
      'Your password is the master key to your account.\n\n' +
        '⚠️ IMPORTANT:\n' +
        '• We do not keep backups of passwords\n' +
        '• Your password is only stored locally on your phone\n' +
        '• If you lose your password, you lose access to your account\n' +
        '• Keep your password safe - write it down or use a password manager\n' +
        '• NEVER share it with anyone\n' +
        '• This is the ONLY way to recover your account\n\n' +
        'Would you like to copy your password?'
    );
    setAlertButtons([
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, Copy Password',
        onPress: async () => {
          try {
            await Clipboard.setStringAsync(userNsec);

            // Close first alert and show success
            setAlertVisible(false);
            setTimeout(() => {
              setAlertTitle('✅ Password Copied');
              setAlertMessage(
                'Your password has been copied to your clipboard.\n\n' +
                  '🔒 Security Tips:\n' +
                  '1. Paste it in a secure password manager NOW\n' +
                  '2. Clear your clipboard after saving it\n' +
                  '3. Never paste it in untrusted apps\n' +
                  '4. Remember: We do not keep backups - if you lose it, your account is gone forever'
              );
              setAlertButtons([{ text: 'I Understand', style: 'default' }]);
              setAlertVisible(true);
            }, 100);
          } catch (error) {
            console.error('Failed to copy nsec:', error);
            setAlertVisible(false);
            setTimeout(() => {
              setAlertTitle('Error');
              setAlertMessage('Failed to copy password. Please try again.');
              setAlertButtons([{ text: 'OK' }]);
              setAlertVisible(true);
            }, 100);
          }
        },
      },
    ]);
    setAlertVisible(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
      >
        {/* Captain Dashboard Access */}
        {userRole === 'captain' && onCaptainDashboard && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TEAM MANAGEMENT</Text>
            <Card style={styles.card}>
              <SettingItem
                title="Captain Dashboard"
                subtitle="Manage your team, events, and members"
                onPress={onCaptainDashboard}
              />
            </Card>
          </View>
        )}

        {/* Account Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT SECURITY</Text>
          <Card style={styles.card}>
            <SettingItem
              title="Backup Password"
              subtitle={
                userNsec ? 'Tap to backup your account key' : 'Not available'
              }
              onPress={handleBackupPassword}
              rightElement={
                <View style={styles.securityIcon}>
                  <Ionicons
                    name="lock-closed"
                    size={20}
                    color={theme.colors.textMuted}
                  />
                </View>
              }
            />
          </Card>
        </View>

        {/* Wallet Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WALLET</Text>
          <Card style={styles.card}>
            {hasNWC ? (
              <>
                {/* Balance Display */}
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Balance</Text>
                    <Text style={styles.walletBalance}>
                      {formatBalance(walletBalance)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={() => {
                      // Balance refresh removed to prevent infinite loop
                      console.log('[Settings] Balance refresh disabled');
                    }}
                  >
                    <Ionicons
                      name="refresh"
                      size={20}
                      color={theme.colors.text}
                    />
                  </TouchableOpacity>
                </View>

                {/* Wallet Actions */}
                <View style={styles.walletActions}>
                  <TouchableOpacity
                    style={styles.walletActionButton}
                    onPress={() => setShowSendModal(true)}
                  >
                    <Ionicons
                      name="arrow-up-outline"
                      size={20}
                      color={theme.colors.text}
                    />
                    <Text style={styles.walletActionText}>Send</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.walletActionButton}
                    onPress={() => setShowReceiveModal(true)}
                  >
                    <Ionicons
                      name="arrow-down-outline"
                      size={20}
                      color={theme.colors.text}
                    />
                    <Text style={styles.walletActionText}>Receive</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.walletActionButton}
                    onPress={() => setShowHistoryModal(true)}
                  >
                    <Ionicons
                      name="time-outline"
                      size={20}
                      color={theme.colors.text}
                    />
                    <Text style={styles.walletActionText}>History</Text>
                  </TouchableOpacity>
                </View>

                {/* Disconnect Option */}
                <TouchableOpacity
                  style={styles.disconnectWalletButton}
                  onPress={handleDisconnectWallet}
                >
                  <Text style={styles.disconnectWalletText}>
                    Disconnect Wallet
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Connect Wallet Prompt */
              <View style={styles.connectWalletContainer}>
                <Ionicons
                  name="wallet-outline"
                  size={48}
                  color={theme.colors.textMuted}
                />
                <Text style={styles.connectWalletTitle}>
                  Connect Your Wallet
                </Text>
                <Text style={styles.connectWalletDescription}>
                  Connect a Lightning wallet via Nostr Wallet Connect (NWC) to send and receive Bitcoin payments
                </Text>

                {/* Two connection options */}
                <TouchableOpacity
                  style={styles.connectWalletButton}
                  onPress={() => setShowQRScanner(true)}
                >
                  <Ionicons
                    name="qr-code-outline"
                    size={20}
                    color={theme.colors.background}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.connectWalletButtonText}>
                    Scan QR Code
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.connectWalletButton, styles.connectWalletButtonSecondary]}
                  onPress={() => setShowWalletConfig(true)}
                >
                  <Ionicons
                    name="create-outline"
                    size={20}
                    color={theme.colors.text}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.connectWalletButtonText, styles.connectWalletButtonTextSecondary]}>
                    Enter Manually
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        </View>

        {/* Activity Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIVITY PREFERENCES</Text>
          <Card style={styles.card}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Background Step Tracking</Text>
                <Text style={styles.settingSubtitle}>
                  Automatically count steps throughout the day
                </Text>
              </View>
              <Switch
                value={backgroundTrackingEnabled}
                onValueChange={handleBackgroundTrackingToggle}
                trackColor={{ false: theme.colors.warning, true: theme.colors.accent }}
                thumbColor={theme.colors.orangeBright}
              />
            </View>
          </Card>
        </View>

        {/* Health Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HEALTH PROFILE</Text>
          <Card style={styles.card}>
            <SettingItem
              title="Health Profile"
              subtitle="Set weight, height, age for better analytics (optional)"
              onPress={() => (navigation as any).navigate('HealthProfile')}
            />
          </Card>
        </View>

        {/* Charity Selection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CHARITY SUPPORT</Text>
          <Card style={styles.card}>
            <SettingItem
              title="Selected Charity"
              subtitle={
                selectedCharity
                  ? `${selectedCharity.name} - All competition winnings go here`
                  : 'Loading...'
              }
              onPress={handleChangeCharity}
              rightElement={
                <View style={styles.charityIcon}>
                  <Ionicons
                    name="heart"
                    size={20}
                    color={theme.colors.accent}
                  />
                </View>
              }
            />
          </Card>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
          <Card style={styles.card}>
            <NotificationsTab />
          </Card>
        </View>

        {/* Voice Announcements Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>VOICE ANNOUNCEMENTS</Text>
          <Card style={styles.card}>
            {/* Enable TTS */}
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>
                  Enable Voice Announcements
                </Text>
                <Text style={styles.settingSubtitle}>
                  Hear workout summaries read aloud
                </Text>
              </View>
              <Switch
                value={ttsSettings.enabled}
                onValueChange={(value) =>
                  handleTTSSettingChange('enabled', value)
                }
                trackColor={{ false: theme.colors.warning, true: theme.colors.accent }}
                thumbColor={theme.colors.orangeBright}
              />
            </View>

            {/* Announce on Summary */}
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Workout Summary</Text>
                <Text style={styles.settingSubtitle}>
                  Announce stats when workout completes
                </Text>
              </View>
              <Switch
                value={ttsSettings.announceOnSummary}
                onValueChange={(value) =>
                  handleTTSSettingChange('announceOnSummary', value)
                }
                trackColor={{ false: theme.colors.warning, true: theme.colors.accent }}
                thumbColor={theme.colors.orangeBright}
                disabled={!ttsSettings.enabled}
              />
            </View>

            {/* Include Splits */}
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Include Split Details</Text>
                <Text style={styles.settingSubtitle}>
                  Announce kilometer splits in summary
                </Text>
              </View>
              <Switch
                value={ttsSettings.includeSplits}
                onValueChange={(value) =>
                  handleTTSSettingChange('includeSplits', value)
                }
                trackColor={{ false: theme.colors.warning, true: theme.colors.accent }}
                thumbColor={theme.colors.orangeBright}
                disabled={!ttsSettings.enabled}
              />
            </View>

            {/* Live Split Announcements */}
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>
                  Live Split Announcements
                </Text>
                <Text style={styles.settingSubtitle}>
                  Announce each kilometer as you run
                </Text>
              </View>
              <Switch
                value={ttsSettings.announceLiveSplits}
                onValueChange={(value) =>
                  handleTTSSettingChange('announceLiveSplits', value)
                }
                trackColor={{ false: theme.colors.warning, true: theme.colors.accent }}
                thumbColor={theme.colors.orangeBright}
                disabled={!ttsSettings.enabled}
              />
            </View>

            {/* Speech Rate Slider */}
            <View style={styles.settingItem}>
              <View style={styles.sliderContainer}>
                <View style={styles.sliderHeader}>
                  <Text style={styles.settingTitle}>Speech Speed</Text>
                  <Text style={styles.sliderValue}>
                    {ttsSettings.speechRate.toFixed(1)}x
                  </Text>
                </View>
                <Text style={styles.settingSubtitle}>
                  Adjust how fast announcements are read
                </Text>
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderLabel}>Slow</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0.5}
                    maximumValue={2.0}
                    step={0.1}
                    value={ttsSettings.speechRate}
                    onValueChange={(value) =>
                      handleTTSSettingChange('speechRate', value)
                    }
                    minimumTrackTintColor={theme.colors.accent}
                    maximumTrackTintColor="#3e3e3e"
                    thumbTintColor={theme.colors.accent}
                    disabled={!ttsSettings.enabled}
                  />
                  <Text style={styles.sliderLabel}>Fast</Text>
                </View>
              </View>
            </View>

            {/* Test Button */}
            <TouchableOpacity
              style={[
                styles.testButton,
                !ttsSettings.enabled && styles.testButtonDisabled,
              ]}
              onPress={handleTestTTS}
              disabled={!ttsSettings.enabled}
              activeOpacity={0.7}
            >
              <Ionicons
                name="volume-high"
                size={20}
                color={
                  ttsSettings.enabled
                    ? theme.colors.text
                    : theme.colors.textMuted
                }
              />
              <Text
                style={[
                  styles.testButtonText,
                  !ttsSettings.enabled && styles.testButtonTextDisabled,
                ]}
              >
                Test Announcement
              </Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Support & Legal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUPPORT & LEGAL</Text>
          <Card style={styles.card}>
            <SettingItem
              title="Help & Support"
              subtitle="FAQ and troubleshooting"
              onPress={onHelp}
            />
            <SettingItem
              title="Contact Support"
              subtitle="Get direct help"
              onPress={onContactSupport}
            />
            <SettingItem
              title="Privacy Policy"
              subtitle="How we protect your data"
              onPress={onPrivacyPolicy}
            />
          </Card>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Card style={styles.card}>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Delete Account - Destructive Action */}
        <View style={styles.section}>
          <Card style={styles.card}>
            <TouchableOpacity
              style={[
                styles.deleteAccountButton,
                isDeletingAccount && styles.buttonDisabled,
              ]}
              onPress={handleDeleteAccount}
              activeOpacity={0.8}
              disabled={isDeletingAccount}
            >
              {isDeletingAccount ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#fca5a5" />
                  <Text
                    style={[styles.deleteAccountButtonText, { marginLeft: 8 }]}
                  >
                    Deleting Account...
                  </Text>
                </View>
              ) : (
                <Text style={styles.deleteAccountButtonText}>
                  Delete Account
                </Text>
              )}
            </TouchableOpacity>
          </Card>
        </View>
      </ScrollView>

      {/* Custom Alert Modal */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        onClose={() => setAlertVisible(false)}
      />

      {/* Wallet Configuration Modal */}
      <WalletConfigModal
        visible={showWalletConfig}
        onClose={() => setShowWalletConfig(false)}
        onSuccess={handleWalletConfigSuccess}
        allowSkip={true}
      />

      {/* Send Modal */}
      <SendModal
        visible={showSendModal}
        onClose={() => setShowSendModal(false)}
        currentBalance={walletBalance}
      />

      {/* Receive Modal */}
      <ReceiveModal
        visible={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        currentBalance={walletBalance}
        userNpub={userNpub}
      />

      {/* History Modal */}
      <HistoryModal
        visible={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />

      {/* QR Scanner Modal (Phase 1: moved from ProfileScreen) */}
      {showQRScanner && (
        <QRScannerModal
          visible={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onScanned={handleQRScanned}
        />
      )}

      {/* NWC Wallet Connection Confirmation Modal */}
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

  // Header
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
    width: 32, // Match back button width for centering
  },

  // Scroll
  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingVertical: 16,
  },

  // Sections
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  card: {
    marginBottom: 0,
  },

  cardTitle: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semiBold,
    marginBottom: 12,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Setting Items
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  settingInfo: {
    flex: 1,
  },

  settingTitle: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 2,
  },

  settingSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },

  chevron: {
    color: theme.colors.textMuted,
    fontSize: 20,
  },

  // Sign Out Button
  signOutButton: {
    backgroundColor: theme.colors.orangeDeep,
    borderRadius: theme.borderRadius.medium,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },

  signOutButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accentText,
  },

  // Delete Account Button - More destructive styling
  deleteAccountButton: {
    backgroundColor: theme.colors.orangeBurnt,
    borderRadius: theme.borderRadius.medium,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.orangeDeep,
  },

  deleteAccountButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accentText,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  securityIcon: {
    marginLeft: 8,
  },

  // Wallet Creation Styles
  statusCheck: {
    fontSize: 18,
    color: theme.colors.primary,
  },

  createButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },

  createButtonText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '600',
  },

  disconnectButton: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },

  disconnectButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // TTS Settings Styles
  sliderContainer: {
    flex: 1,
  },

  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },

  sliderValue: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accent,
  },

  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },

  slider: {
    flex: 1,
    marginHorizontal: 12,
    height: 40,
  },

  sliderLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    minWidth: 35,
  },

  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.medium,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  testButtonDisabled: {
    opacity: 0.5,
  },

  testButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },

  testButtonTextDisabled: {
    color: theme.colors.textMuted,
  },

  // Wallet Section Styles
  walletBalance: {
    fontSize: 24,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.accent, // Orange color for balance
    marginTop: 4,
  },

  refreshButton: {
    padding: 8,
    borderRadius: theme.borderRadius.small,
    backgroundColor: theme.colors.cardBackground,
  },

  walletActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  walletActionButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.cardBackground,
    minWidth: 80,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  walletActionText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginTop: 4,
  },

  disconnectWalletButton: {
    backgroundColor: theme.colors.orangeBurnt,
    borderRadius: theme.borderRadius.medium,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 16,
  },

  disconnectWalletText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accentText,
  },

  // Connect Wallet Styles
  connectWalletContainer: {
    alignItems: 'center',
    paddingVertical: 32,
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
    paddingHorizontal: 24,
    marginBottom: 24,
  },

  connectWalletButton: {
    backgroundColor: theme.colors.accent, // Orange button
    borderRadius: theme.borderRadius.medium,
    paddingVertical: 12,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#000', // Black text on orange button
  },

  connectWalletButtonTextSecondary: {
    color: theme.colors.text,
  },

  // Charity Selection Styles
  charityIcon: {
    marginLeft: 8,
  },
});
