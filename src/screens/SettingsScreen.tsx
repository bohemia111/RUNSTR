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
  Modal,
  Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { theme } from '../styles/theme';
import {
  TTSPreferencesService,
  type TTSSettings,
} from '../services/activity/TTSPreferencesService';
import { AutoCompetePreferencesService } from '../services/activity/AutoCompetePreferencesService';
import TTSAnnouncementService from '../services/activity/TTSAnnouncementService';
import { DeleteAccountService } from '../services/auth/DeleteAccountService';
import { Card } from '../components/ui/Card';
import { CustomAlert } from '../components/ui/CustomAlert';
import { SettingsAccordion } from '../components/ui/SettingsAccordion';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
// useAuth no longer needed - using RNRestart for sign out
import * as Clipboard from 'expo-clipboard';
import RNRestart from 'react-native-restart';
import { dailyStepCounterService } from '../services/activity/DailyStepCounterService';
import { PPQAPIKeyModal } from '../components/ai/PPQAPIKeyModal';
import { useCoachRunstr } from '../services/ai/useCoachRunstr';
import { ModelManager } from '../services/ai/ModelManager';
import { GPSPermissionsDiagnostics } from '../components/permissions/GPSPermissionsDiagnostics';
import { WearableConnectionModal } from '../components/settings/WearableConnectionModal';
import { WatchSyncSection } from '../components/profile/WatchSyncSection';
import { AntiCheatRequestModal } from '../components/settings/AntiCheatRequestModal';
import Nostr1301ImportService from '../services/fitness/Nostr1301ImportService';
import { CustomAlertManager } from '../components/ui/CustomAlert';
import { useSeason2Registration } from '../hooks/useSeason2';
// useAuth removed - using direct AsyncStorage.clear() + CommonActions.reset()

interface SettingsScreenProps {
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
  onCaptainDashboard,
  onHelp,
  onContactSupport,
  onPrivacyPolicy,
  onSignOut,
}) => {
  const navigation = useNavigation();
  const { isRegistered: isSeason2Participant } = useSeason2Registration();
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
  const [backgroundTrackingEnabled, setBackgroundTrackingEnabled] =
    useState(false);
  const [autoCompeteEnabled, setAutoCompeteEnabled] = useState(false);

  // Coach RUNSTR AI state
  const [showPPQModal, setShowPPQModal] = useState(false);
  const { apiKeyConfigured } = useCoachRunstr();
  const [selectedAIModel, setSelectedAIModel] =
    useState<string>('claude-haiku-4.5');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [wearableModalVisible, setWearableModalVisible] = useState(false);
  const [showAntiCheatModal, setShowAntiCheatModal] = useState(false);
  const [importing, setImporting] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // ✅ Load teams from NavigationDataContext - REMOVED: Users now auto-assigned to Team RUNSTR
  // useEffect(() => {
  //   if (profileData?.teams && Array.isArray(profileData.teams)) {
  //     const navigationTeams = profileData.teams;
  //     const localMemberships: LocalMembership[] = navigationTeams.map(
  //       (team: any) => ({
  //         teamId: team.id,
  //         teamName: team.name,
  //         captainPubkey: team.captainPubkey || team.captain || '',
  //         joinedAt: team.joinedAt || Date.now(),
  //         status: team.role === 'captain' ? 'official' : team.status || 'local',
  //       })
  //     );

  //     console.log(
  //       `[SettingsScreen] Loaded ${localMemberships.length} teams from NavigationDataContext (including captain teams)`
  //     );
  //     setFollowedTeams(localMemberships);
  //   } else {
  //     console.log('[SettingsScreen] No teams found in NavigationDataContext');
  //     setFollowedTeams([]);
  //   }
  // }, [profileData?.teams]);

  const loadSettings = async () => {
    try {
      // Load TTS settings
      const ttsPrefs = await TTSPreferencesService.getTTSSettings();
      setTtsSettings(ttsPrefs);

      // ✅ PERFORMANCE FIX: Batch AsyncStorage reads using multiGet
      // This is 3x faster than sequential getItem calls
      const keys = ['@runstr:user_role', '@runstr:user_nsec'];
      const values = await AsyncStorage.multiGet(keys);

      const storedRole = values[0][1]; // [key, value] pairs
      const nsec = values[1][1];

      setUserRole(storedRole as 'captain' | 'member' | null);
      setUserNsec(nsec);

      // Check if background step tracking is enabled (reads from AsyncStorage)
      const trackingEnabled = await dailyStepCounterService.isBackgroundTrackingEnabled();
      setBackgroundTrackingEnabled(trackingEnabled);

      // Load auto-compete setting
      const autoCompete = await AutoCompetePreferencesService.isAutoCompeteEnabled();
      setAutoCompeteEnabled(autoCompete);

      // Load selected AI model
      const model = await ModelManager.getSelectedModel();
      setSelectedAIModel(model);
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

      if (granted) {
        // Save the enabled setting to AsyncStorage
        await dailyStepCounterService.setBackgroundTrackingEnabled(true);
        setBackgroundTrackingEnabled(true);
      } else {
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
            onPress: () => dailyStepCounterService.openSettings(),
          },
        ]);
        setAlertVisible(true);
      }
    } else {
      // Save the disabled setting to AsyncStorage and update UI
      await dailyStepCounterService.setBackgroundTrackingEnabled(false);
      setBackgroundTrackingEnabled(false);
    }
  };

  const handleAutoCompeteToggle = async (enabled: boolean) => {
    try {
      await AutoCompetePreferencesService.setAutoCompeteEnabled(enabled);
      setAutoCompeteEnabled(enabled);
    } catch (error) {
      console.error('Error saving auto-compete setting:', error);
      // Revert on error
      const current = await AutoCompetePreferencesService.isAutoCompeteEnabled();
      setAutoCompeteEnabled(current);
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
          setAlertVisible(false);

          // Clear all auth data
          await AsyncStorage.multiRemove([
            '@runstr:user_nsec',
            '@runstr:npub',
            '@runstr:hex_pubkey',
            '@runstr:auth_method',
            '@runstr:amber_pubkey',
            '@runstr:app_init_completed',
          ]);
          await SecureStore.deleteItemAsync('nwc_string');

          // Restart the app - it will boot fresh and find no auth → show Login
          RNRestart.restart();
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
      '• Request deletion from servers (cannot be guaranteed)\n';
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
                text: 'Delete Account',
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
    setAlertVisible(false);

    // Clear ALL local data for account deletion
    await AsyncStorage.clear();
    await SecureStore.deleteItemAsync('nwc_string');

    // Restart the app - it will boot fresh and find no auth → show Login
    RNRestart.restart();
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

  const handleImportNostrHistory = async () => {
    try {
      setImporting(true);

      // Get user pubkey
      const pubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');
      if (!pubkey) {
        console.error('[Settings] No pubkey found - cannot import workouts');
        CustomAlertManager.alert('Error', 'No user key found. Please sign in again.');
        setImporting(false);
        return;
      }

      console.log('[Settings] Starting Nostr workout import...');

      const result = await Nostr1301ImportService.importUserHistory(pubkey);

      if (result.success) {
        console.log(`[Settings] ✅ Imported ${result.imported} workouts`);
        CustomAlertManager.alert(
          'Import Complete',
          `Successfully imported ${result.imported} workout${result.imported !== 1 ? 's' : ''}.`
        );
      } else {
        throw new Error(result.error || 'Import failed');
      }
    } catch (error) {
      console.error('[Settings] ❌ Nostr import failed:', error);
      CustomAlertManager.alert('Import Failed', 'Could not import workouts. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const handleModelSelect = async (modelId: string) => {
    try {
      await ModelManager.setSelectedModel(modelId);
      setSelectedAIModel(modelId);
      setShowModelPicker(false);
    } catch (error) {
      console.error('Error setting AI model:', error);
      setShowModelPicker(false);
      setTimeout(() => {
        setAlertTitle('Error');
        setAlertMessage('Failed to update AI model. Please try again.');
        setAlertButtons([{ text: 'OK' }]);
        setAlertVisible(true);
      }, 100);
    }
  };

  // REMOVED: handleChangeCompetitionTeam - Users now auto-assigned to Team RUNSTR
  // const handleChangeCompetitionTeam = (teamId: string | null) => {
  //   // If selecting the same team, just close modal
  //   if (teamId === competitionTeam) {
  //     setShowTeamSelectionModal(false);
  //     return;
  //   }

  //   // Close the modal first
  //   setShowTeamSelectionModal(false);

  //   // Show confirmation for actual change
  //   setAlertTitle('Change Competition Team?');
  //   setAlertMessage(
  //     teamId
  //       ? `Your workouts will appear on ${
  //           followedTeams.find((t) => t.teamId === teamId)?.teamName ||
  //           'this team'
  //         }'s leaderboards`
  //       : 'Your workouts will not appear on any team leaderboards'
  //   );
  //   setAlertButtons([
  //     { text: 'Cancel', style: 'cancel' },
  //     {
  //       text: 'Confirm',
  //       onPress: async () => {
  //         try {
  //           if (teamId) {
  //             await LocalTeamMembershipService.setCompetitionTeam(teamId);
  //           } else {
  //             await LocalTeamMembershipService.clearCompetitionTeam();
  //           }
  //           setCompetitionTeam(teamId);
  //         } catch (error) {
  //           console.error('Error changing competition team:', error);
  //           setTimeout(() => {
  //             setAlertTitle('Error');
  //             setAlertMessage(
  //               'Failed to change competition team. Please try again.'
  //             );
  //             setAlertButtons([{ text: 'OK' }]);
  //             setAlertVisible(true);
  //           }, 100);
  //         }
  //       },
  //     },
  //   ]);
  //   setAlertVisible(true);
  // };

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

        {/* Fitness Tracking Accordion */}
        <View style={styles.section}>
          <SettingsAccordion title="FITNESS TRACKING" defaultExpanded={false}>
            <Card style={styles.accordionCard}>
              {/* Background Step Tracking */}
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>
                    Background Step Tracking
                  </Text>
                  <Text style={styles.settingSubtitle}>
                    Automatically count steps throughout the day
                  </Text>
                </View>
                <Switch
                  value={backgroundTrackingEnabled}
                  onValueChange={handleBackgroundTrackingToggle}
                  trackColor={{
                    false: theme.colors.warning,
                    true: theme.colors.accent,
                  }}
                  thumbColor={theme.colors.orangeBright}
                />
              </View>

              {/* Auto-Compete */}
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Auto-Compete</Text>
                  <Text style={styles.settingSubtitle}>
                    Automatically enter workouts into competitions
                  </Text>
                </View>
                <Switch
                  value={autoCompeteEnabled}
                  onValueChange={handleAutoCompeteToggle}
                  trackColor={{
                    false: theme.colors.warning,
                    true: theme.colors.accent,
                  }}
                  thumbColor={theme.colors.orangeBright}
                />
              </View>

              {/* Health Profile */}
              <SettingItem
                title="Health Profile"
                subtitle="Set weight, height, age for better analytics (optional)"
                onPress={() => (navigation as any).navigate('HealthProfile')}
              />

              {/* Import Workouts */}
              <SettingItem
                title="Import"
                subtitle="Download your workout history"
                onPress={handleImportNostrHistory}
                rightElement={
                  importing ? (
                    <ActivityIndicator size="small" color={theme.colors.orangeBright} />
                  ) : (
                    <Ionicons name="cloud-download-outline" size={20} color={theme.colors.textMuted} />
                  )
                }
              />

              {/* GPS Permissions Diagnostics (Android only) */}
              {Platform.OS === 'android' && <GPSPermissionsDiagnostics />}

              {/* Voice Announcements Subsection */}
              <View style={styles.voiceSubsection}>
                <Text style={styles.subsectionTitle}>Voice Announcements</Text>

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
                    trackColor={{
                      false: theme.colors.warning,
                      true: theme.colors.accent,
                    }}
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
                    trackColor={{
                      false: theme.colors.warning,
                      true: theme.colors.accent,
                    }}
                    thumbColor={theme.colors.orangeBright}
                    disabled={!ttsSettings.enabled}
                  />
                </View>

                {/* Include Splits */}
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>
                      Include Split Details
                    </Text>
                    <Text style={styles.settingSubtitle}>
                      Announce kilometer splits in summary
                    </Text>
                  </View>
                  <Switch
                    value={ttsSettings.includeSplits}
                    onValueChange={(value) =>
                      handleTTSSettingChange('includeSplits', value)
                    }
                    trackColor={{
                      false: theme.colors.warning,
                      true: theme.colors.accent,
                    }}
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
                    trackColor={{
                      false: theme.colors.warning,
                      true: theme.colors.accent,
                    }}
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
              </View>
            </Card>
          </SettingsAccordion>
        </View>

        {/* Wearables Accordion */}
        <View style={styles.section}>
          <SettingsAccordion title="WEARABLES" defaultExpanded={false}>
            <Card style={styles.accordionCard}>
              <SettingItem
                title="Connect Wearable"
                subtitle="Sync workouts from your watch or fitness tracker"
                onPress={() => setWearableModalVisible(true)}
              />

              {/* Apple Watch Identity Sync */}
              <WatchSyncSection />
            </Card>
          </SettingsAccordion>
        </View>

        {/* Advanced Features Accordion */}
        <View style={styles.section}>
          <SettingsAccordion title="ADVANCED FEATURES" defaultExpanded={false}>
            <Card style={styles.accordionCard}>
              {/* PPQ.AI API Key */}
              <SettingItem
                title="PPQ.AI API Key"
                subtitle={
                  apiKeyConfigured
                    ? 'Configured - AI insights enabled'
                    : 'Not configured - Tap to set up'
                }
                onPress={() => setShowPPQModal(true)}
                rightElement={
                  <View style={styles.securityIcon}>
                    <Ionicons
                      name={
                        apiKeyConfigured
                          ? 'checkmark-circle'
                          : 'add-circle-outline'
                      }
                      size={20}
                      color={
                        apiKeyConfigured ? '#FF9D42' : theme.colors.textMuted
                      }
                    />
                  </View>
                }
              />

              {/* AI Model Selection */}
              <SettingItem
                title="AI Model"
                subtitle={ModelManager.getModelName(selectedAIModel)}
                onPress={() => setShowModelPicker(true)}
                rightElement={
                  <View style={styles.securityIcon}>
                    <Ionicons
                      name="swap-horizontal"
                      size={20}
                      color={theme.colors.textMuted}
                    />
                  </View>
                }
              />

              {/* Advanced Analytics */}
              <SettingItem
                title="Advanced Analytics"
                subtitle="Body composition, fitness age & AI coaching"
                onPress={() => (navigation as any).navigate('AdvancedAnalytics')}
                rightElement={
                  <View style={styles.securityIcon}>
                    <Ionicons
                      name="analytics"
                      size={20}
                      color={theme.colors.textMuted}
                    />
                  </View>
                }
              />

              {/* Extended Activities (Strength, Diet, Wellness) */}
              <SettingItem
                title="Extended Activities"
                subtitle="Strength, diet & wellness tracking"
                onPress={() => (navigation as any).navigate('Exercise', { showExperimentalMenu: true })}
                rightElement={
                  <View style={styles.securityIcon}>
                    <Ionicons
                      name="flask"
                      size={20}
                      color={theme.colors.textMuted}
                    />
                  </View>
                }
              />

            </Card>
          </SettingsAccordion>
        </View>

        {/* Password Accordion (collapsed by default) */}
        <View style={styles.section}>
          <SettingsAccordion title="PASSWORD" defaultExpanded={false}>
            <Card style={styles.accordionCard}>
              {/* Account Security */}
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
          </SettingsAccordion>
        </View>

        {/* Support & Legal Accordion */}
        <View style={styles.section}>
          <SettingsAccordion title="SUPPORT & LEGAL" defaultExpanded={false}>
            <Card style={styles.accordionCard}>
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
              <SettingItem
                title="Anti-Cheat Verification"
                subtitle="Request cheater investigation (5,000 sats)"
                onPress={() => setShowAntiCheatModal(true)}
              />
            </Card>
          </SettingsAccordion>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Delete Account - Destructive Action */}
        <View style={styles.section}>
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
              <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* App Version Info */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.5.1 (Build 151)</Text>
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


      {/* PPQ.AI API Key Configuration Modal */}
      <PPQAPIKeyModal
        visible={showPPQModal}
        onClose={() => setShowPPQModal(false)}
        onSuccess={() => {
          setShowPPQModal(false);
          // Reload settings to update UI
          loadSettings();
        }}
      />

      {/* AI Model Selection Modal */}
      <Modal
        visible={showModelPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModelPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modelPickerContainer}>
            <View style={styles.modelPickerHeader}>
              <Text style={styles.modelPickerTitle}>Select AI Model</Text>
              <TouchableOpacity
                onPress={() => setShowModelPicker(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modelList}>
              {ModelManager.getAvailableModels().map((model) => (
                <TouchableOpacity
                  key={model.id}
                  style={[
                    styles.modelItem,
                    selectedAIModel === model.id && styles.modelItemSelected,
                  ]}
                  onPress={() => handleModelSelect(model.id)}
                >
                  <Text
                    style={[
                      styles.modelName,
                      selectedAIModel === model.id && styles.modelNameSelected,
                    ]}
                  >
                    {model.name}
                  </Text>
                  {selectedAIModel === model.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#FF9D42"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Wearable Connection Modal */}
      <WearableConnectionModal
        visible={wearableModalVisible}
        onClose={() => setWearableModalVisible(false)}
        onConnectionSuccess={() => {
          setWearableModalVisible(false);
        }}
      />

      {/* Anti-Cheat Request Modal */}
      <AntiCheatRequestModal
        visible={showAntiCheatModal}
        onClose={() => setShowAntiCheatModal(false)}
      />

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

  accordionCard: {
    marginBottom: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 12,
  },

  cardTitle: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semiBold,
    marginBottom: 12,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  voiceSubsection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },

  subsectionTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: '#FFB366', // Light orange to match Profile screen
    marginBottom: 12,
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

  // Sign Out Button - matches LoginScreen button styling
  signOutButton: {
    backgroundColor: theme.colors.orangeBright,
    borderRadius: theme.borderRadius.large,
    paddingVertical: 16,
    alignItems: 'center',
  },

  signOutButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accentText, // Black text on orange
  },

  // Delete Account Button - matches LoginScreen button styling
  deleteAccountButton: {
    backgroundColor: theme.colors.orangeBright,
    borderRadius: theme.borderRadius.large,
    paddingVertical: 16,
    alignItems: 'center',
  },

  deleteAccountButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accentText, // Black text on orange
  },

  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingBottom: 40,
  },

  versionText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
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

  // Competition Team Styles
  competitionTeamSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },

  competitionTeamName: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.accent,
    marginTop: 4,
    marginBottom: 4,
  },

  // Lightning Address Styles
  lightningAddressSection: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },

  lightningAddressInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
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

  unlockRewardsLink: {
    marginTop: 12,
  },

  unlockRewardsText: {
    fontSize: 14,
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.semiBold,
  },

  // Model Picker Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },

  modelPickerContainer: {
    backgroundColor: theme.colors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 34, // Account for home indicator on iOS
  },

  modelPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  modelPickerTitle: {
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },

  modalCloseButton: {
    padding: 4,
  },

  modelList: {
    maxHeight: 400,
  },

  modelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  modelItemSelected: {
    backgroundColor: 'rgba(255, 157, 66, 0.1)',
  },

  modelName: {
    fontSize: 16,
    color: theme.colors.text,
  },

  modelNameSelected: {
    fontWeight: theme.typography.weights.semiBold,
    color: '#FF9D42',
  },
});
