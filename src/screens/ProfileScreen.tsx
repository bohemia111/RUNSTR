/**
 * ProfileScreen - Main profile screen with tab navigation
 * Matches HTML mockup profile screen exactly
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';
import { ProfileTab, ProfileScreenData, NotificationSettings } from '../types';
import { NotificationPreferencesService } from '../services/notifications/NotificationPreferencesService';

// UI Components
// BottomNavigation removed - using BottomTabNavigator instead

// Profile Components
import { ProfileHeader } from '../components/profile/ProfileHeader';
// Wallet components moved to Settings
import { MyTeamsBox } from '../components/profile/MyTeamsBox';
import { ChallengeNotificationsBox } from '../components/profile/ChallengeNotificationsBox';
import { YourCompetitionsBox } from '../components/profile/YourCompetitionsBox';
import { YourWorkoutsBox } from '../components/profile/YourWorkoutsBox';
import { NotificationBadge } from '../components/profile/NotificationBadge';
import { NotificationModal } from '../components/profile/NotificationModal';
import { QRScannerModal } from '../components/qr/QRScannerModal';
import { JoinPreviewModal } from '../components/qr/JoinPreviewModal';
import { NWCQRConfirmationModal } from '../components/wallet/NWCQRConfirmationModal';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
// Wallet imports removed - moved to Settings
import AsyncStorage from '@react-native-async-storage/async-storage';
import { npubEncode } from '../utils/nostrEncoding';
import { unifiedNotificationStore } from '../services/notifications/UnifiedNotificationStore';
import { challengeNotificationHandler } from '../services/notifications/ChallengeNotificationHandler';
import { eventJoinNotificationHandler } from '../services/notifications/EventJoinNotificationHandler';
// TEMPORARILY REMOVED TO DEBUG THEME ERROR
// import { NotificationService } from '../services/notifications/NotificationService';
import { getUserNostrIdentifiers } from '../utils/nostr';
import type { QRData } from '../services/qr/QRCodeService';
import JoinRequestService from '../services/competition/JoinRequestService';
import { EventJoinRequestService } from '../services/events/EventJoinRequestService';
import { UnifiedSigningService } from '../services/auth/UnifiedSigningService';
import { GlobalNDKService } from '../services/nostr/GlobalNDKService';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { Alert } from 'react-native';

interface ProfileScreenProps {
  data: ProfileScreenData;
  isLoadingTeam?: boolean;
  isLoadingProfile?: boolean;
  onNavigateToTeam: () => void;
  onNavigateToTeamDiscovery?: () => void;
  onViewCurrentTeam?: () => void;
  onCaptainDashboard?: () => void;
  onTeamCreation?: () => void;
  onEditProfile?: () => void;
  onSend?: () => void;
  onReceive?: () => void;
  onWalletHistory?: () => void;
  onSyncSourcePress?: (provider: string) => void;
  onManageSubscription?: () => void;
  onHelp?: () => void;
  onContactSupport?: () => void;
  onPrivacyPolicy?: () => void;
  onSignOut?: () => void;
  onRefresh?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  data,
  isLoadingTeam = false,
  isLoadingProfile = false,
  onNavigateToTeam,
  onNavigateToTeamDiscovery,
  onViewCurrentTeam,
  onCaptainDashboard,
  onTeamCreation,
  onEditProfile,
  onSend,
  onReceive,
  onWalletHistory,
  onSyncSourcePress,
  onManageSubscription,
  onHelp,
  onContactSupport,
  onPrivacyPolicy,
  onSignOut,
  onRefresh,
}) => {
  const navigation = useNavigation<any>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showJoinPreview, setShowJoinPreview] = useState(false);
  const [showNWCConfirmation, setShowNWCConfirmation] = useState(false);
  const [scannedQRData, setScannedQRData] = useState<QRData | null>(null);
  const [scannedNWCString, setScannedNWCString] = useState<string>('');
  const [userNpub, setUserNpub] = useState<string>('');

  // Wallet features moved to Settings screen

  // ✅ PERFORMANCE: Defer notification initialization by 3 seconds
  // Notifications are not critical for initial app load, delay them for better UX
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const userIdentifiers = await getUserNostrIdentifiers();
        if (userIdentifiers?.hexPubkey) {
          console.log(
            '[ProfileScreen] ⚡ Background notification initialization (3s delay)...'
          );

          // Initialize in background - don't block UI
          unifiedNotificationStore
            .initialize(userIdentifiers.hexPubkey)
            .catch((err) => {
              console.warn(
                '[ProfileScreen] Notification store init failed:',
                err
              );
            });

          // Start listeners in background
          challengeNotificationHandler.startListening().catch((err) => {
            console.warn(
              '[ProfileScreen] Challenge notification handler failed:',
              err
            );
          });

          eventJoinNotificationHandler.startListening().catch((err) => {
            console.warn(
              '[ProfileScreen] Event join notification handler failed:',
              err
            );
          });

          console.log(
            '[ProfileScreen] ✅ Notification system initialization started (background)'
          );
        }
      } catch (error) {
        console.error(
          '[ProfileScreen] Failed to initialize notification system:',
          error
        );
      }
    }, 3000);

    // Cleanup on unmount
    return () => {
      clearTimeout(timer);
      challengeNotificationHandler.stopListening();
      eventJoinNotificationHandler.stopListening();
    };
  }, []);

  // Load user npub on mount
  useEffect(() => {
    const loadUserNpub = async () => {
      try {
        // Get user's ID which could be npub or hex pubkey
        const userPubkey = data.user.id;
        if (userPubkey) {
          // Check if it's already an npub
          if (userPubkey.startsWith('npub')) {
            setUserNpub(userPubkey);
          } else if (userPubkey.length === 64) {
            // It's a hex pubkey, encode it
            const npub = npubEncode(userPubkey);
            setUserNpub(npub);
          } else {
            // Fallback: try to use it as-is or get from storage
            const storedNpub = await AsyncStorage.getItem('@runstr:npub');
            if (storedNpub) {
              setUserNpub(storedNpub);
            }
          }
        }
      } catch (error) {
        console.error('Error handling user npub:', error);
        // Try to get npub from storage as fallback
        try {
          const storedNpub = await AsyncStorage.getItem('@runstr:npub');
          if (storedNpub) {
            setUserNpub(storedNpub);
          }
        } catch (storageError) {
          console.error('Error retrieving npub from storage:', storageError);
        }
      }
    };

    loadUserNpub();
  }, [data.user.id]);

  // ✅ CLEAN ARCHITECTURE: Workouts are already prefetched during SplashInit
  // No need to fetch them again here - they're in UnifiedNostrCache
  // PublicWorkoutsTab and PrivateWorkoutsTab will read from cache when opened

  // ✅ PERFORMANCE: Memoize event handlers to prevent recreating on every render
  const handleEditProfile = useCallback(() => {
    onEditProfile?.();
  }, [onEditProfile]);

  // Wallet handlers moved to Settings screen

  const handleSyncSourcePress = useCallback(
    (provider: string) => {
      onSyncSourcePress?.(provider);
    },
    [onSyncSourcePress]
  );

  const handleManageSubscription = useCallback(() => {
    onManageSubscription?.();
  }, [onManageSubscription]);

  const handleHelp = useCallback(() => {
    onHelp?.();
  }, [onHelp]);

  const handleContactSupport = useCallback(() => {
    onContactSupport?.();
  }, [onContactSupport]);

  const handlePrivacyPolicy = useCallback(() => {
    onPrivacyPolicy?.();
  }, [onPrivacyPolicy]);

  const handleSignOut = useCallback(() => {
    onSignOut?.();
  }, [onSignOut]);

  // ✅ PERFORMANCE + ANDROID FIX: Memoized pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    console.log('[ProfileScreen] 🔄 Pull-to-refresh triggered');
    setIsRefreshing(true);

    try {
      // 1. Reconnect GlobalNDK to relays
      const GlobalNDKService =
        require('../services/nostr/GlobalNDKService').GlobalNDKService;
      await GlobalNDKService.reconnect().catch((err: any) => {
        console.warn('[ProfileScreen] Reconnect failed:', err);
      });

      // 2. Refetch profile from Nostr
      const DirectNostrProfileService =
        require('../services/user/directNostrProfileService').DirectNostrProfileService;
      await DirectNostrProfileService.getCurrentUserProfile().catch(
        (err: any) => {
          console.warn('[ProfileScreen] Profile refetch failed:', err);
        }
      );

      // 3. Call original onRefresh if provided
      await onRefresh?.();

      console.log('[ProfileScreen] ✅ Pull-to-refresh complete');
    } catch (error) {
      console.error('[ProfileScreen] Pull-to-refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  const handleSettingsPress = useCallback(() => {
    navigation.navigate('Settings', {
      currentTeam: data.currentTeam,
      onNavigateToTeamDiscovery,
      onViewCurrentTeam,
      onCaptainDashboard,
      onHelp,
      onContactSupport,
      onPrivacyPolicy,
      onSignOut,
    });
  }, [
    navigation,
    data.currentTeam,
    onNavigateToTeamDiscovery,
    onViewCurrentTeam,
    onCaptainDashboard,
    onHelp,
    onContactSupport,
    onPrivacyPolicy,
    onSignOut,
  ]);

  const handleQRScanned = useCallback((qrData: QRData) => {
    try {
      // Route to appropriate modal based on QR type
      if (qrData.type === 'nwc') {
        // Validate NWC data before setting state
        if (!qrData.connectionString || typeof qrData.connectionString !== 'string') {
          throw new Error('Invalid NWC connection string');
        }
        setScannedNWCString(qrData.connectionString);
        setShowNWCConfirmation(true);
      } else {
        // Validate challenge/event data
        if (!qrData) {
          throw new Error('Invalid QR data');
        }
        setScannedQRData(qrData);
        setShowJoinPreview(true);
      }
    } catch (error) {
      console.error('[ProfileScreen] QR scan error:', error);
      Alert.alert(
        'Error',
        'Failed to process QR code. Please try scanning again.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  const handleNWCConnected = useCallback(() => {
    console.log('[ProfileScreen] NWC wallet connected successfully');
    // Modal will close automatically, no additional action needed
  }, []);

  const handleJoinCompetition = useCallback(async (qrData: QRData) => {
    try {
      if (qrData.type === 'challenge') {
        await JoinRequestService.publishChallengeAcceptance(
          qrData.id,
          qrData.creator_npub
        );
        Alert.alert('Success', 'Challenge acceptance request sent!');
      } else if (qrData.type === 'event') {
        // Handle event join using EventJoinRequestService (kind 1105)
        const signer = await UnifiedSigningService.getSigner();
        if (!signer) {
          Alert.alert('Error', 'Authentication required to join events');
          return;
        }

        const userHexPubkey = await UnifiedSigningService.getHexPubkey();
        if (!userHexPubkey) {
          Alert.alert('Error', 'Could not determine user public key');
          return;
        }

        const eventJoinService = EventJoinRequestService.getInstance();

        // Prepare event join request
        const requestData = {
          eventId: qrData.id,
          eventName: qrData.name,
          teamId: qrData.team_id,
          captainPubkey: qrData.captain_npub,
          message: `Requesting to join ${qrData.name} via QR code`,
        };

        const eventTemplate = eventJoinService.prepareEventJoinRequest(
          requestData,
          userHexPubkey
        );

        // Sign and publish the event join request using UnifiedSigningService
        const ndk = await GlobalNDKService.getInstance();
        const ndkEvent = new NDKEvent(ndk, eventTemplate);
        await ndkEvent.sign(signer);
        await ndkEvent.publish();

        Alert.alert(
          'Request Sent',
          'Your join request has been sent to the captain for approval!'
        );
      }
      // NWC type is handled by separate modal, not here
    } catch (error) {
      console.error('Failed to join competition:', error);
      Alert.alert('Error', 'Failed to send join request. Please try again.');
    }
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with QR Scanner and Settings Button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.qrButton}
          onPress={() => setShowQRScanner(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="qr-code-outline"
            size={24}
            color={theme.colors.text}
          />
        </TouchableOpacity>
        <View style={styles.headerSpacer} />

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={handleSettingsPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="menu-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.text}
          />
        }
      >
        {/* Profile Header Box - Tappable to Edit Profile */}
        <View style={styles.profileHeaderContainer}>
          <TouchableOpacity
            onPress={() => {
              const parentNav = navigation.getParent();
              if (parentNav) {
                parentNav.navigate('ProfileEdit' as any);
              } else {
                navigation.navigate('ProfileEdit' as any);
              }
            }}
            activeOpacity={0.7}
          >
            <ProfileHeader user={data.user} isLoading={isLoadingProfile} />
          </TouchableOpacity>

          {/* Notification Badge - positioned in bottom-right of profile header */}
          <NotificationBadge onPress={() => setShowNotificationModal(true)} />
        </View>

        {/* Navigation Buttons */}
        <View style={styles.navigationButtons}>
          {/* My Teams */}
          <View style={styles.boxContainer}>
            <MyTeamsBox />
          </View>

          {/* My Competitions */}
          <View style={styles.boxContainer}>
            <YourCompetitionsBox />
          </View>

          {/* My Workouts */}
          <View style={styles.boxContainer}>
            <YourWorkoutsBox />
          </View>
        </View>
      </ScrollView>

      {/* Wallet modals moved to Settings screen */}

      {/* Notification Modal */}
      <NotificationModal
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />

      {/* QR Scanner Modal */}
      <QRScannerModal
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScanned={handleQRScanned}
      />

      {/* Join Preview Modal */}
      <JoinPreviewModal
        visible={showJoinPreview}
        onClose={() => setShowJoinPreview(false)}
        data={scannedQRData}
        onJoin={handleJoinCompetition}
      />

      {/* NWC Wallet Connection Modal */}
      <NWCQRConfirmationModal
        visible={showNWCConfirmation}
        onClose={() => setShowNWCConfirmation(false)}
        connectionString={scannedNWCString}
        onSuccess={handleNWCConnected}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background, // #000
  },

  // Header with QR, Balance, Settings
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    zIndex: 10,
  },

  headerSpacer: {
    flex: 1,
  },

  qrButton: {
    padding: 4,
  },

  settingsButton: {
    padding: 4,
  },

  // Content container (now scrollable with pull-to-refresh)
  content: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },

  // Profile header container for badge positioning
  profileHeaderContainer: {
    position: 'relative',
    marginTop: 8,
    marginBottom: 12,
  },

  // Navigation buttons container
  navigationButtons: {
    flex: 1,
    gap: 12,
  },

  // Box styling - each button takes equal space
  boxContainer: {
    flex: 1,
  },
});
