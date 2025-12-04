/**
 * Enhanced Workout History Screen - Two-Tab Workout View
 * Public Tab: 1301 notes from Nostr (cache-first instant display)
 * Private Tab: Local Activity Tracker workouts (zero loading time)
 * Simple architecture with no merge complexity
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { theme } from '../styles/theme';
import { WorkoutPublishingService } from '../services/nostr/workoutPublishingService';
import localWorkoutStorage from '../services/fitness/LocalWorkoutStorageService';
import { UnifiedSigningService } from '../services/auth/UnifiedSigningService';
import type { NDKSigner } from '@nostr-dev-kit/ndk';
import FEATURE_FLAGS from '../constants/featureFlags';
import { nostrProfileService } from '../services/nostr/NostrProfileService';
import type { NostrProfile } from '../services/nostr/NostrProfileService';

// UI Components
import { LoadingOverlay } from '../components/ui/LoadingStates';
import { BottomNavigation } from '../components/ui/BottomNavigation';
import { EnhancedSocialShareModal } from '../components/profile/shared/EnhancedSocialShareModal';

// Screens
import { AdvancedAnalyticsScreen } from './AdvancedAnalyticsScreen';

// Two-Tab Workout Components
import { WorkoutTabNavigator } from '../components/profile/WorkoutTabNavigator';
import type { LocalWorkout } from '../services/fitness/LocalWorkoutStorageService';
import type { Workout } from '../types/workout';

interface EnhancedWorkoutHistoryScreenProps {
  userId: string;
  pubkey: string;
  onNavigateBack: () => void;
  onNavigateToTeam: () => void;
}

export const EnhancedWorkoutHistoryScreen: React.FC<
  EnhancedWorkoutHistoryScreenProps
> = ({ userId, pubkey, onNavigateBack, onNavigateToTeam }) => {
  const [signer, setSigner] = useState<NDKSigner | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<NostrProfile | null>(null);

  // Services - localWorkoutStorage is already a singleton instance
  const publishingService = WorkoutPublishingService.getInstance();

  // Load user credentials on mount
  useEffect(() => {
    loadUserCredentials();
  }, [userId]);

  const loadUserCredentials = async () => {
    try {
      console.log('[EnhancedWorkoutHistory] Loading user credentials...');
      const userSigner = await UnifiedSigningService.getInstance().getSigner();
      if (userSigner) {
        setSigner(userSigner);
        console.log('[EnhancedWorkoutHistory] ✅ User signer loaded');
      } else {
        console.warn('[EnhancedWorkoutHistory] No signer available');
      }
    } catch (error) {
      console.error(
        '[EnhancedWorkoutHistory] ❌ Failed to load credentials:',
        error
      );
    } finally {
      setIsInitializing(false);
    }
  };

  // Load user profile in background (non-blocking, for social cards only)
  useEffect(() => {
    if (pubkey) {
      console.log('[EnhancedWorkoutHistory] Loading profile in background...');
      nostrProfileService
        .getProfile(pubkey)
        .then((profile) => {
          setUserProfile(profile);
          console.log('[EnhancedWorkoutHistory] ✅ User profile loaded');
        })
        .catch((profileError) => {
          console.warn(
            '[EnhancedWorkoutHistory] Failed to load profile:',
            profileError
          );
        });
    }
  }, [pubkey]);

  /**
   * Handle posting a local workout to Nostr as kind 1 social event
   * Opens the EnhancedSocialShareModal for template selection
   */
  const handlePostToSocial = async (workout: LocalWorkout) => {
    console.log(
      `[EnhancedWorkoutHistory] Opening social share modal for workout ${workout.id}...`
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
        `[EnhancedWorkoutHistory] Posting workout ${workout.id} as kind 1301...`
      );

      if (!signer) {
        Alert.alert('Error', 'No signer available. Please log in again.');
        return;
      }

      // Convert LocalWorkout to PublishableWorkout format
      const publishableWorkout = {
        ...workout,
        userId: userId,
        source: 'manual' as const,
        type: workout.type,
        duration: workout.duration, // Keep in seconds for kind 1301
        distance: workout.distance,
        calories: workout.calories,
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
          `[EnhancedWorkoutHistory] ✅ Workout published as kind 1301: ${result.eventId}`
        );

        // Mark workout as synced - IT WILL DISAPPEAR FROM PRIVATE TAB
        await localWorkoutStorage.markAsSynced(workout.id, result.eventId);
        console.log(`[EnhancedWorkoutHistory] ✅ Workout marked as synced`);

        Alert.alert(
          'Success',
          'Workout posted as kind 1301 event!\nIt will now appear in your Public tab and competitions.'
        );
      } else {
        throw new Error(result.error || 'Failed to publish workout');
      }
    } catch (error) {
      console.error(
        '[EnhancedWorkoutHistory] ❌ Post to Nostr (1301) failed:',
        error
      );
      Alert.alert(
        'Error',
        'Failed to post workout to Nostr. Please try again.'
      );
    }
  };

  /**
   * Handle posting a Health Connect workout to social (kind 1)
   * Opens the EnhancedSocialShareModal for template selection
   */
  const handleSocialShareHealthConnect = async (workout: Workout) => {
    console.log(
      `[EnhancedWorkoutHistory] Opening social share modal for Health Connect workout ${workout.id}...`
    );
    setSelectedWorkout(workout);
    setShowSocialModal(true);
  };

  /**
   * Handle posting a Health Connect workout to Nostr (kind 1301)
   * Converts Workout to LocalWorkout and reuses existing handler
   */
  const handleCompeteHealthConnect = async (workout: Workout) => {
    // Convert Workout to LocalWorkout format
    const localWorkout: LocalWorkout = {
      id: workout.id,
      type: workout.type,
      duration: workout.duration,
      distance: workout.distance || 0,
      calories: workout.calories || 0,
      startTime: workout.startTime,
      endTime: workout.endTime,
      source: 'health_connect',
      createdAt: workout.startTime,
      syncedToNostr: false,
    };

    // Reuse existing handler
    await handlePostToNostr(localWorkout);
  };

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingOverlay message="Loading..." visible={true} />
      </SafeAreaView>
    );
  }

  // Show Advanced Analytics screen if active
  if (showAnalytics) {
    return (
      <AdvancedAnalyticsScreen onNavigateBack={() => setShowAnalytics(false)} />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onNavigateBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workouts</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Two-Tab Workout Navigator */}
      <WorkoutTabNavigator
        userId={userId}
        pubkey={pubkey}
        onPostToNostr={handlePostToNostr}
        onPostToSocial={handlePostToSocial}
        onCompeteHealthConnect={handleCompeteHealthConnect}
        onSocialShareHealthConnect={handleSocialShareHealthConnect}
        onNavigateToAnalytics={() => setShowAnalytics(true)}
      />

      {/* Bottom Navigation */}
      <BottomNavigation
        activeScreen="profile"
        onNavigateToTeam={onNavigateToTeam}
        onNavigateToProfile={() => {}} // Already on profile section
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

  backButtonText: {
    fontSize: 24,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
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
});
