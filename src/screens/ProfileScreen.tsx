/**
 * ProfileScreen - Main profile screen with tab navigation
 * Matches HTML mockup profile screen exactly
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Season2Banner } from '../components/season2/Season2Banner';
import { ChallengeNotificationsBox } from '../components/profile/ChallengeNotificationsBox';
import { YourCompetitionsBox } from '../components/profile/YourCompetitionsBox';
import { YourWorkoutsBox } from '../components/profile/YourWorkoutsBox';
import { NotificationBadge } from '../components/profile/NotificationBadge';
import { NotificationModal } from '../components/profile/NotificationModal';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
// Wallet imports removed - moved to Settings
import AsyncStorage from '@react-native-async-storage/async-storage';
import { npubEncode } from '../utils/nostrEncoding';
import { unifiedNotificationStore } from '../services/notifications/UnifiedNotificationStore';
import { challengeNotificationHandler } from '../services/notifications/ChallengeNotificationHandler';
import { challengeResponseHandler } from '../services/notifications/ChallengeResponseHandler';
import { eventJoinNotificationHandler } from '../services/notifications/EventJoinNotificationHandler';
import { teamJoinNotificationHandler } from '../services/notifications/TeamJoinNotificationHandler';
// TEMPORARILY REMOVED TO DEBUG THEME ERROR
// import { NotificationService } from '../services/notifications/NotificationService';
import { getUserNostrIdentifiers } from '../utils/nostr';
import type { QRData } from '../services/qr/QRCodeService';
import { AppStateManager } from '../services/core/AppStateManager';
import JoinRequestService from '../services/competition/JoinRequestService';
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
  const [userNpub, setUserNpub] = useState<string>('');
  const isMountedRef = useRef(true);

  // Wallet features moved to Settings screen

  // ❌ DISABLED: Notification system initialization to fix iOS freeze (Attempt #14)
  // The app doesn't use notifications, and this was causing AsyncStorage operations
  // during modal transitions, leading to iOS freezes on first launch.
  // The 3-second delay coincided with permission modal cleanup, causing a race condition.
  /* COMMENTED OUT TO FIX iOS FREEZE:
  useEffect(() => {
    isMountedRef.current = true;

    const timer = setTimeout(async () => {
      // Don't initialize if component already unmounted
      if (!isMountedRef.current) return;

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

          // ❌ DISABLED: Background notification subscriptions causing Android crashes
          // All notification handlers now query on-demand instead of persistent subscriptions
          console.log(
            '[ProfileScreen] ⚠️  Background notification subscriptions DISABLED for stability'
          );

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
      isMountedRef.current = false;
      clearTimeout(timer);

      // ✅ FIX: Don't stop handlers that were never started (commented out above)
      // This prevents unnecessary cleanup calls that could cause issues
      // Handlers are currently disabled for stability (see lines 131-154)
    };
  }, []);
  */

  // Simple cleanup for mount tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ❌ DISABLED: AppState lifecycle management for notification handlers
  // No longer needed since we're not running background subscriptions
  /* COMMENTED OUT FOR ANDROID STABILITY:
  useEffect(() => {
    console.log('[ProfileScreen] 🎯 Setting up AppState lifecycle management');

    const unsubscribe = AppStateManager.onStateChange((isActive) => {
      if (!isActive) {
        // App going to background - stop all notification handlers
        console.log('[ProfileScreen] 📱 App backgrounded - stopping notification handlers');
        challengeNotificationHandler.stopListening();
        challengeResponseHandler.stopListening();
        eventJoinNotificationHandler.stopListening();
        teamJoinNotificationHandler.stopListening();
      } else {
        // App coming to foreground - restart notification handlers
        console.log('[ProfileScreen] 📱 App foregrounded - restarting notification handlers');

        // Small delay to ensure app is fully active
        setTimeout(() => {
          challengeNotificationHandler.startListening().catch((err) => {
            console.warn('[ProfileScreen] Failed to restart challenge handler:', err);
          });
          challengeResponseHandler.startListening().catch((err) => {
            console.warn('[ProfileScreen] Failed to restart response handler:', err);
          });
          eventJoinNotificationHandler.startListening().catch((err) => {
            console.warn('[ProfileScreen] Failed to restart event handler:', err);
          });
          teamJoinNotificationHandler.startListening().catch((err) => {
            console.warn('[ProfileScreen] Failed to restart team handler:', err);
          });
        }, 500);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);
  */

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

  // QR scanner and related functions moved to Settings screen

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with Season 2 Banner (centered) and Settings Button */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Season2Banner />
        <View style={styles.headerSpacer}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleSettingsPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="menu-outline" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
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
      {/* QR scanner and related modals moved to Settings screen */}

      {/* Notification Modal */}
      <NotificationModal
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
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
    alignItems: 'flex-end',
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
