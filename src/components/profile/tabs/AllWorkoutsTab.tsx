/**
 * AllWorkoutsTab - Unified view of all workouts from all sources
 * Merges HealthKit, Garmin, Google Fit, and Nostr workouts
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, RefreshControl, Text, StyleSheet } from 'react-native';
import { theme } from '../../../styles/theme';
import { Card } from '../../ui/Card';
import { CustomAlert } from '../../ui/CustomAlert';
import { LoadingOverlay } from '../../ui/LoadingStates';
import { EnhancedWorkoutCard } from '../shared/EnhancedWorkoutCard';
import { EnhancedSocialShareModal } from '../shared/EnhancedSocialShareModal';
import {
  MonthlyWorkoutGroup,
  groupWorkoutsByMonth,
} from '../shared/MonthlyWorkoutGroup';
import { Nuclear1301Service } from '../../../services/fitness/Nuclear1301Service';
import { WorkoutPublishingService } from '../../../services/nostr/workoutPublishingService';
import { WorkoutStatusTracker } from '../../../services/fitness/WorkoutStatusTracker';
import { UnifiedSigningService } from '../../../services/auth/UnifiedSigningService';
import { nostrProfileService } from '../../../services/nostr/NostrProfileService';
import type { NDKSigner } from '@nostr-dev-kit/ndk';
import type { NostrWorkout } from '../../../types/nostrWorkout';
import type { Workout } from '../../../types/workout';
import type { NostrProfile } from '../../../services/nostr/NostrProfileService';

interface AllWorkoutsTabProps {
  userId: string;
  pubkey?: string;
  onRefresh?: () => void;
}

export const AllWorkoutsTab: React.FC<AllWorkoutsTabProps> = ({
  userId,
  pubkey,
  onRefresh,
}) => {
  const [workouts, setWorkouts] = useState<NostrWorkout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [signer, setSigner] = useState<NDKSigner | null>(null);
  const [userProfile, setUserProfile] = useState<NostrProfile | null>(null);

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message?: string;
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }>;
  }>({
    title: '',
    message: '',
    buttons: [],
  });

  const nuclear1301Service = Nuclear1301Service.getInstance();
  const publishingService = WorkoutPublishingService.getInstance();
  const statusTracker = WorkoutStatusTracker.getInstance();

  useEffect(() => {
    loadSigner();
    loadUserProfile();
    loadAllWorkouts();
  }, []);

  const loadUserProfile = async () => {
    if (!pubkey) return;

    try {
      const profile = await nostrProfileService.getProfile(pubkey);
      setUserProfile(profile);
      console.log('✅ User profile loaded for social cards:', profile?.name);
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  };

  const loadSigner = async () => {
    try {
      const userSigner = await UnifiedSigningService.getInstance().getSigner();
      setSigner(userSigner);
    } catch (error) {
      console.error('Failed to load signer:', error);
    }
  };

  const loadAllWorkouts = async () => {
    try {
      setIsLoading(true);
      console.log('⚡ Loading all workouts from Nostr...');

      if (!pubkey) {
        console.log('No pubkey available, skipping workout load');
        setWorkouts([]);
        return;
      }

      // Use the same approach as PublicWorkoutsTab - direct Nuclear1301Service
      const nostrWorkouts = await nuclear1301Service.getUserWorkouts(pubkey);
      console.log(
        `📊 Received ${nostrWorkouts?.length || 0} workouts from Nostr`
      );

      if (!nostrWorkouts || nostrWorkouts.length === 0) {
        setWorkouts([]);
        return;
      }

      // Filter and sort just like PublicWorkoutsTab
      const validWorkouts = nostrWorkouts
        .filter((w: NostrWorkout) => {
          const isValid = w.type && w.type !== 'other';
          return isValid;
        })
        .sort(
          (a: NostrWorkout, b: NostrWorkout) =>
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );

      setWorkouts(validWorkouts);
      console.log(`✅ Loaded ${validWorkouts.length} valid workouts`);
    } catch (error) {
      console.error('❌ Failed to load workouts:', error);
      setWorkouts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadAllWorkouts();
      onRefresh?.();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCompete = async (workout: Workout) => {
    if (!signer) {
      setAlertConfig({
        title: 'Authentication Required',
        message: 'Please log in with your Nostr key to enter competitions.',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
      return;
    }

    try {
      console.log('🏃 Creating competition entry (kind 1301)...');
      const result = await publishingService.saveWorkoutToNostr(
        workout,
        signer,
        userId
      );

      if (result.success) {
        await statusTracker.markAsCompeted(workout.id, result.eventId);
        setAlertConfig({
          title: 'Success',
          message: 'Workout entered into competition!',
          buttons: [{ text: 'OK', style: 'default' }],
        });
        setAlertVisible(true);
        await handleRefresh();
      } else {
        throw new Error(result.error || 'Failed to create competition entry');
      }
    } catch (error) {
      console.error('Failed to compete workout:', error);
      setAlertConfig({
        title: 'Error',
        message: 'Failed to enter competition. Please try again.',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
    }
  };

  const handleSocialShare = (workout: Workout) => {
    setSelectedWorkout(workout);
    setShareModalVisible(true);
  };

  const handleShareSuccess = () => {
    handleRefresh();
  };

  // Group workouts by month
  const monthlyGroups = groupWorkoutsByMonth(workouts);

  const renderWorkout = useCallback(
    (workout: Workout) => (
      <EnhancedWorkoutCard
        workout={workout}
        onCompete={handleCompete}
        onSocialShare={handleSocialShare}
        hideActions={workout.source?.toLowerCase() === 'nostr'}
      />
    ),
    [signer]
  );

  const renderMonthlyGroup = ({ item }: { item: any }) => (
    <MonthlyWorkoutGroup
      group={item}
      renderWorkout={renderWorkout}
      defaultExpanded={item === monthlyGroups[0]}
    />
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LoadingOverlay message="Loading all workouts..." visible={true} />
      </View>
    );
  }

  if (workouts.length === 0) {
    return (
      <View style={styles.container}>
        <Card style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No workouts found</Text>
          <Text style={styles.emptyStateText}>
            Connect your fitness apps or record a workout to get started. Use
            the sync button above to import from Apple Health, Garmin, or Google
            Fit.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={monthlyGroups}
        renderItem={renderMonthlyGroup}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.text}
          />
        }
      />

      <EnhancedSocialShareModal
        visible={shareModalVisible}
        workout={selectedWorkout}
        userId={userId}
        userAvatar={userProfile?.picture}
        userName={userProfile?.name || userProfile?.display_name}
        onClose={() => {
          setShareModalVisible(false);
          setSelectedWorkout(null);
        }}
        onSuccess={handleShareSuccess}
      />

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 16,
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    marginTop: 32,
  },
  emptyStateTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
