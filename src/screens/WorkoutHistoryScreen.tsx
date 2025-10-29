/**
 * WorkoutHistoryScreen - Two-Tab Workout View
 * Public Tab: 1301 notes from Nostr (cache-first instant display)
 * Private Tab: Local Activity Tracker workouts (zero loading time)
 * Simple architecture with no merge complexity
 *
 * IMPORTANT: This replaced the old complex merge-based screen
 * Old features removed: WorkoutCacheService, HealthKit, filter tabs, "Sync Now" button
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CustomAlertManager } from '../components/ui/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../styles/theme';
import { WorkoutPublishingService } from '../services/nostr/workoutPublishingService';
import localWorkoutStorage from '../services/fitness/LocalWorkoutStorageService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UnifiedSigningService } from '../services/auth/UnifiedSigningService';
import type { NDKSigner } from '@nostr-dev-kit/ndk';
import { nostrProfileService } from '../services/nostr/NostrProfileService';
import type { NostrProfile } from '../services/nostr/NostrProfileService';

// UI Components
import { LoadingOverlay } from '../components/ui/LoadingStates';
import { Ionicons } from '@expo/vector-icons';
import { EnhancedSocialShareModal } from '../components/profile/shared/EnhancedSocialShareModal';

// Two-Tab Workout Components
import { WorkoutTabNavigator } from '../components/profile/WorkoutTabNavigator';
// Import type from the service file (not from the default export)
import type { LocalWorkout } from '../services/fitness/LocalWorkoutStorageService';

interface WorkoutHistoryScreenProps {
  route?: {
    params?: {
      userId?: string;
      pubkey?: string;
    };
  };
}

export const WorkoutHistoryScreen: React.FC<WorkoutHistoryScreenProps> = ({
  route,
}) => {
  const navigation = useNavigation<any>();
  const [pubkey, setPubkey] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [signer, setSigner] = useState<NDKSigner | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<NostrProfile | null>(null);

  // Services - localWorkoutStorage is already a singleton instance
  const publishingService = WorkoutPublishingService.getInstance();

  // Load user credentials on mount
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      console.log('[WorkoutHistory] Loading user data...');

      // Try to get from route params first
      let activePubkey = route?.params?.pubkey || '';
      let activeUserId = route?.params?.userId || '';

      // Fallback to AsyncStorage if not in params
      if (!activePubkey) {
        const storedNpub = await AsyncStorage.getItem('@runstr:npub');
        const storedHexPubkey = await AsyncStorage.getItem(
          '@runstr:hex_pubkey'
        );
        activePubkey = storedHexPubkey || storedNpub || '';
        console.log(
          '[WorkoutHistory] Loaded pubkey from storage:',
          activePubkey?.slice(0, 20) + '...'
        );
      }

      if (!activeUserId) {
        activeUserId = activePubkey; // Use pubkey as userId fallback
      }

      setPubkey(activePubkey);
      setUserId(activeUserId);

      // Load signer for posting
      const userSigner = await UnifiedSigningService.getInstance().getSigner();
      if (userSigner) {
        setSigner(userSigner);
        console.log('[WorkoutHistory] ✅ User signer loaded');
      } else {
        console.warn(
          '[WorkoutHistory] No signer available - posting will not work'
        );
      }

      // Load user profile for social cards
      if (activePubkey) {
        try {
          const profile = await nostrProfileService.getProfile(activePubkey);
          setUserProfile(profile);
          console.log('[WorkoutHistory] ✅ User profile loaded');
        } catch (profileError) {
          console.warn('[WorkoutHistory] Failed to load profile:', profileError);
        }
      }
    } catch (error) {
      console.error('[WorkoutHistory] ❌ Failed to load user data:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  /**
   * Handle posting a HealthKit workout to Nostr as kind 1301 competition entry
   */
  const handleCompeteHealthKit = async (workout: any) => {
    try {
      console.log(
        `[WorkoutHistory] Entering HealthKit workout ${workout.id} into competition...`
      );

      if (!signer) {
        CustomAlertManager.alert('Error', 'No signer available. Please log in again.');
        return;
      }

      // Convert HealthKit workout to PublishableWorkout format
      const publishableWorkout = {
        id: workout.id,
        userId: userId,
        source: 'healthkit' as const,
        type: workout.type || 'other',
        duration: workout.duration, // Already in seconds from HealthKit
        distance: workout.distance || 0,
        calories: workout.calories || 0,
        startTime: workout.startTime,
        endTime: workout.endTime,
        syncedAt: new Date().toISOString(),
        metadata: {
          sourceApp: 'Apple Health',
        },
      };

      // Publish to Nostr as kind 1301 competition entry
      const result = await publishingService.saveWorkoutToNostr(
        publishableWorkout,
        signer,
        userId
      );

      if (result.success && result.eventId) {
        console.log(
          `[WorkoutHistory] ✅ HealthKit workout entered as kind 1301: ${result.eventId}`
        );

        // Show reward earned notification if applicable
        if (result.rewardEarned && result.rewardAmount) {
          CustomAlertManager.alert(
            '🎉 Reward Earned!',
            `You earned ${result.rewardAmount} sats for today's workout!`
          );
        } else {
          CustomAlertManager.alert('Success', 'Workout entered into competition!');
        }
      } else {
        throw new Error(result.error || 'Failed to publish workout');
      }
    } catch (error) {
      console.error('[WorkoutHistory] ❌ Competition entry failed:', error);
      CustomAlertManager.alert(
        'Error',
        'Failed to enter workout into competition. Please try again.'
      );
    }
  };

  /**
   * Handle posting a HealthKit workout to social feeds as kind 1
   */
  const handleSocialShareHealthKit = async (workout: any) => {
    try {
      console.log(
        `[WorkoutHistory] Sharing HealthKit workout ${workout.id} to social feeds...`
      );

      if (!signer) {
        CustomAlertManager.alert('Error', 'No signer available. Please log in again.');
        return;
      }

      // Convert HealthKit workout to PublishableWorkout format
      const publishableWorkout = {
        id: workout.id,
        userId: userId,
        source: 'healthkit' as const,
        type: workout.type || 'other',
        duration: workout.duration, // Already in seconds from HealthKit
        distance: workout.distance || 0,
        calories: workout.calories || 0,
        startTime: workout.startTime,
        endTime: workout.endTime,
        syncedAt: new Date().toISOString(),
        metadata: {
          sourceApp: 'Apple Health',
        },
      };

      // Publish to Nostr as kind 1 social event
      const result = await publishingService.postWorkoutToSocial(
        publishableWorkout,
        signer,
        userId
      );

      if (result.success && result.eventId) {
        console.log(
          `[WorkoutHistory] ✅ HealthKit workout shared as kind 1: ${result.eventId}`
        );
        CustomAlertManager.alert('Success', 'Workout shared to social feeds!');
      } else {
        throw new Error(result.error || 'Failed to publish workout');
      }
    } catch (error) {
      console.error('[WorkoutHistory] ❌ Social share failed:', error);
      CustomAlertManager.alert('Error', 'Failed to share workout. Please try again.');
    }
  };

  /**
   * Handle posting a local workout to Nostr as kind 1 social event
   * Opens enhanced social share modal with image generation
   */
  const handlePostToSocial = (workout: LocalWorkout) => {
    console.log(
      `[WorkoutHistory] Opening social share modal for workout ${workout.id}...`
    );
    setSelectedWorkout(workout);
    setShowSocialModal(true);
  };

  /**
   * Handle posting a local workout to Nostr as kind 1301 event
   * Saves workout data for competitions
   */
  const handlePostToNostr = async (workout: LocalWorkout) => {
    try {
      console.log(
        `[WorkoutHistory] Posting workout ${workout.id} as kind 1301...`
      );

      if (!signer) {
        CustomAlertManager.alert('Error', 'No signer available. Please log in again.');
        return;
      }

      // Convert LocalWorkout to PublishableWorkout format
      const { splits, ...workoutData } = workout;

      const publishableWorkout = {
        ...workoutData,
        id: workout.id,
        userId: userId,
        source: 'manual' as const,
        type: workout.type,
        duration: workout.duration, // Keep in seconds for kind 1301
        distance: workout.distance,
        calories: workout.calories,
        startTime: workout.startTime,
        endTime: workout.endTime,
        syncedAt: workout.syncedAt || new Date().toISOString(),
      };

      // Publish to Nostr as kind 1301 workout event
      const result = await publishingService.saveWorkoutToNostr(
        publishableWorkout,
        signer,
        userId
      );

      if (result.success && result.eventId) {
        console.log(
          `[WorkoutHistory] ✅ Workout published as kind 1301: ${result.eventId}`
        );

        // Mark workout as synced - IT WILL DISAPPEAR FROM PRIVATE TAB
        await localWorkoutStorage.markAsSynced(workout.id, result.eventId);
        console.log(`[WorkoutHistory] ✅ Workout marked as synced`);

        // Success alert handled by child component (PrivateWorkoutsTab)
      } else {
        throw new Error(result.error || 'Failed to publish workout');
      }
    } catch (error) {
      console.error('[WorkoutHistory] ❌ Post to Nostr (1301) failed:', error);
      CustomAlertManager.alert(
        'Error',
        'Failed to post workout to Nostr. Please try again.'
      );
    }
  };

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleNavigateToAnalytics = () => {
    navigation.navigate('AdvancedAnalytics' as any);
  };

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingOverlay message="Loading..." visible={true} />
      </SafeAreaView>
    );
  }

  if (!pubkey) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={theme.colors.error}
          />
          <Text style={styles.errorTitle}>No User Found</Text>
          <Text style={styles.errorMessage}>
            Please log in to view your workouts
          </Text>
          <TouchableOpacity style={styles.errorButton} onPress={handleGoBack}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Workouts</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Three-Tab Workout Navigator */}
      <WorkoutTabNavigator
        userId={userId}
        pubkey={pubkey}
        onPostToNostr={handlePostToNostr}
        onPostToSocial={handlePostToSocial}
        onCompeteHealthKit={handleCompeteHealthKit}
        onSocialShareHealthKit={handleSocialShareHealthKit}
        onNavigateToAnalytics={handleNavigateToAnalytics}
      />

      {/* Enhanced Social Share Modal */}
      <EnhancedSocialShareModal
        visible={showSocialModal}
        workout={selectedWorkout}
        userId={userId}
        userAvatar={userProfile?.picture}
        userName={userProfile?.name || userProfile?.display_name}
        onClose={() => {
          setShowSocialModal(false);
          setSelectedWorkout(null);
        }}
        onSuccess={() => {
          setShowSocialModal(false);
          setSelectedWorkout(null);
          // Success alert handled by child component (PrivateWorkoutsTab)
        }}
      />
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
    padding: 16,
    backgroundColor: theme.colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  backButton: {
    padding: 8,
  },

  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    textAlign: 'center',
  },

  headerSpacer: {
    width: 40, // Match back button width
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },

  errorTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },

  errorMessage: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },

  errorButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.colors.accent,
    borderRadius: 8,
  },

  errorButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accentText,
  },
});
