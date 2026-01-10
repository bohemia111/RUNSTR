/**
 * WorkoutSummaryModal - Post-workout summary with compete/share options
 * Shows workout stats and provides buttons for competition entry and social sharing
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import workoutPublishingService from '../../services/nostr/workoutPublishingService';
import type { PublishableWorkout } from '../../services/nostr/workoutPublishingService';
import type { Split } from '../../services/activity/SplitTrackingService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EnhancedSocialShareModal } from '../profile/shared/EnhancedSocialShareModal';
import TTSAnnouncementService from '../../services/activity/TTSAnnouncementService';
import LocalWorkoutStorageService from '../../services/fitness/LocalWorkoutStorageService';
import { activityMetricsService } from '../../services/activity/ActivityMetricsService';
import { UnifiedSigningService } from '../../services/auth/UnifiedSigningService';
import WorkoutStatusTracker from '../../services/fitness/WorkoutStatusTracker';
import { CustomAlert } from '../ui/CustomAlert';
import { PostingErrorBoundary } from '../ui/PostingErrorBoundary';
import routeStorageService from '../../services/routes/RouteStorageService';
import { nostrProfileService } from '../../services/nostr/NostrProfileService';
import type { NostrProfile } from '../../services/nostr/NostrProfileService';
import { LocalTeamMembershipService } from '../../services/team/LocalTeamMembershipService';
import { RewardNotificationManager } from '../../services/rewards/RewardNotificationManager';

interface WorkoutSummaryProps {
  visible: boolean;
  onClose: () => void;
  workout: {
    type: 'running' | 'walking' | 'cycling';
    distance: number; // in meters
    duration: number; // in seconds
    calories: number;
    elevation?: number; // in meters
    pace?: number; // minutes per km
    speed?: number; // km/h for cycling
    steps?: number; // for walking
    splits?: Split[]; // kilometer splits for running
    localWorkoutId?: string; // For marking as synced after posting
    routeId?: string; // Route label ID if workout was tagged
    routeName?: string; // Route label name for display
    rewardSent?: boolean; // True if Bitcoin reward was sent on save
    rewardAmount?: number; // Amount of sats rewarded
  };
}

export const WorkoutSummaryModal: React.FC<WorkoutSummaryProps> = ({
  visible,
  onClose,
  workout,
}) => {
  const [isPosting, setIsPosting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [posted, setPosted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userProfile, setUserProfile] = useState<NostrProfile | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [preparedWorkout, setPreparedWorkout] =
    useState<PublishableWorkout | null>(null);

  // Route achievement state
  const [routeAchievements, setRouteAchievements] = useState<{
    isNewPR: boolean;
    previousBestTime?: number;
    timesCompleted?: number;
    routeName?: string;
    milestone?: 'first' | 'tenth' | 'hundredth';
  }>({
    isNewPR: false,
  });

  // Handle close with pending reward toast
  const handleClose = () => {
    onClose();
    // Show any pending reward toast now that modal is closing
    RewardNotificationManager.showPendingRewardToast();
  };

  const [alertState, setAlertState] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({
    visible: false,
    title: '',
    message: '',
  });

  // Load user profile and ID for social cards
  useEffect(() => {
    const loadProfileAndId = async () => {
      try {
        const pubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');
        const npub = await AsyncStorage.getItem('@runstr:npub');
        const activeUserId = npub || pubkey || '';
        setUserId(activeUserId);

        if (pubkey) {
          const profile = await nostrProfileService.getProfile(pubkey);
          setUserProfile(profile);
        }
      } catch (error) {
        console.error('Failed to load user profile:', error);
      }
    };

    if (visible) {
      loadProfileAndId();
    }
  }, [visible]);

  // Check for route achievements when modal opens
  useEffect(() => {
    const checkRouteAchievements = async () => {
      // Check if workout was tagged with a route (passed from tracker screen)
      if (!workout.routeId || !workout.duration) return;

      try {
        // Get route to check achievements
        const route = await routeStorageService.getRouteById(workout.routeId);

        if (route) {
          const achievements: typeof routeAchievements = {
            isNewPR: false,
            routeName: route.name,
            timesCompleted: route.timesUsed,
          };

          // Check if this is a new PR (route stats already updated in tracker screen)
          if (route.bestTime && workout.duration <= route.bestTime) {
            // This workout might be the new best
            if (route.bestWorkoutId === workout.localWorkoutId) {
              achievements.isNewPR = true;
              // Find previous best from other workouts if possible
            }
          }

          // First completion is always a PR
          if (route.timesUsed === 1) {
            achievements.milestone = 'first';
            achievements.isNewPR = true;
          }

          // Check for milestones
          if (route.timesUsed === 10) {
            achievements.milestone = 'tenth';
          } else if (route.timesUsed === 100) {
            achievements.milestone = 'hundredth';
          }

          setRouteAchievements(achievements);
        }
      } catch (error) {
        console.error('Failed to check route achievements:', error);
      }
    };

    if (visible && workout) {
      checkRouteAchievements();
    }
  }, [visible, workout]);

  // TTS Announcement when modal opens
  useEffect(() => {
    if (visible && workout) {
      // Announce summary after a brief delay to let modal animation complete
      const timer = setTimeout(async () => {
        setIsSpeaking(true);
        await TTSAnnouncementService.announceSummary(workout);
        setIsSpeaking(false);
      }, 500);

      return () => {
        clearTimeout(timer);
        // Stop speech when modal closes
        TTSAnnouncementService.stopSpeaking();
        setIsSpeaking(false);
      };
    }
  }, [visible, workout]);

  // Check existing posting status when modal opens (prevents duplicate posts)
  useEffect(() => {
    const checkExistingStatus = async () => {
      if (visible && workout.localWorkoutId) {
        const status = await WorkoutStatusTracker.getStatus(workout.localWorkoutId);
        setSaved(status.competedInNostr);
        setPosted(status.postedToNostr);
      }
    };
    checkExistingStatus();
  }, [visible, workout.localWorkoutId]);

  const formatDistance = (meters: number): string => {
    const km = meters / 1000;
    return `${km.toFixed(2)} km`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSpeed = (speed?: number): string => {
    if (!speed) return '0.0 km/h';
    return `${speed.toFixed(1)} km/h`;
  };

  const formatSplitTime = (seconds: number): string => {
    // Guard against NaN/invalid values
    if (!isFinite(seconds) || seconds < 0) {
      return '--:--';
    }

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAverageSplitPace = (): number | null => {
    if (!workout.splits || workout.splits.length === 0) return null;
    const totalPace = workout.splits.reduce(
      (sum, split) => sum + split.pace,
      0
    );
    return totalPace / workout.splits.length;
  };

  const getSplitComparison = (
    split: Split
  ): 'faster' | 'slower' | 'average' => {
    const avgPace = getAverageSplitPace();
    if (!avgPace) return 'average';

    const diff = split.pace - avgPace;
    const threshold = 5; // 5 seconds per km difference

    if (diff < -threshold) return 'faster';
    if (diff > threshold) return 'slower';
    return 'average';
  };

  const createPublishableWorkout =
    async (): Promise<PublishableWorkout | null> => {
      const npub = await AsyncStorage.getItem('@runstr:npub');
      const workoutId = `workout_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // ✅ Get competition team for leaderboard participation
      const competitionTeam =
        await LocalTeamMembershipService.getCompetitionTeam();

      return {
        id: workoutId,
        userId: npub || 'unknown',
        type: workout.type,
        startTime: new Date(Date.now() - workout.duration * 1000).toISOString(),
        endTime: new Date().toISOString(),
        duration: workout.duration,
        distance: workout.distance,
        calories: workout.calories,
        source: 'manual',
        syncedAt: new Date().toISOString(),
        sourceApp: 'RUNSTR',
        elevationGain: workout.elevation,
        unitSystem: 'metric',
        canSyncToNostr: true,
        metadata: {
          title: `${
            workout.type.charAt(0).toUpperCase() + workout.type.slice(1)
          } Workout`,
          sourceApp: 'RUNSTR',
          notes: `Tracked ${formatDistance(workout.distance)} ${workout.type}`,
        },
        pace: workout.pace,
        splits: workout.splits, // ✅ Pass splits through for leaderboard qualification
        competitionTeam, // ✅ Include team for kind 1301 tagging
      };
    };

  const handleShowSocialModal = async () => {
    // Prepare workout for social sharing
    const publishableWorkout = await createPublishableWorkout();
    if (publishableWorkout) {
      setPreparedWorkout(publishableWorkout);
      setShowSocialModal(true);
    }
  };

  const handleSaveForCompetition = async () => {
    setIsSaving(true);
    try {
      // Get signer (works for both nsec and Amber)
      const signer = await UnifiedSigningService.getInstance().getSigner();
      const npub = await AsyncStorage.getItem('@runstr:npub');

      if (!signer) {
        setAlertState({
          visible: true,
          title: 'Error',
          message: 'No authentication found. Please login first.',
        });
        return;
      }

      const publishableWorkout = await createPublishableWorkout();
      if (!publishableWorkout) return;

      // Save as kind 1301 workout event (works with both nsec and Amber)
      const result = await workoutPublishingService.saveWorkoutToNostr(
        publishableWorkout,
        signer,
        npub || 'unknown'
      );

      if (result.success) {
        setSaved(true);

        // Mark as competed in persistent status tracker (prevents duplicate posts)
        const workoutId = workout.localWorkoutId || publishableWorkout.id;
        try {
          await WorkoutStatusTracker.markAsCompeted(workoutId, result.eventId);
          console.log(`✅ Marked workout ${workoutId} as competed in status tracker`);
        } catch (statusError) {
          console.warn('⚠️ Failed to update workout status tracker:', statusError);
        }

        // Mark as synced in local storage if this was a local workout
        if (workout.localWorkoutId && result.eventId) {
          try {
            await LocalWorkoutStorageService.markAsSynced(
              workout.localWorkoutId,
              result.eventId
            );
            console.log(
              `✅ Marked local workout ${workout.localWorkoutId} as synced`
            );
          } catch (syncError) {
            console.warn('⚠️ Failed to mark workout as synced:', syncError);
            // Non-critical - workout is still on Nostr
          }
        }

        // Note: Supabase submission is now handled inside workoutPublishingService.saveWorkoutToNostr()
        // This ensures tags (splits, steps) are passed for daily leaderboard calculations

        // 🎁 Show success message
        // Note: If user earned a daily reward, the global RewardNotificationProvider
        // will show the reward modal with donation split info (triggered by DailyRewardService)
        setAlertState({
          visible: true,
          title: 'Saved to Nostr!',
          message: result.rewardEarned
            ? 'Your workout has been saved! Check your reward notification.'
            : 'Your workout has been saved to Nostr!',
        });
      } else {
        setAlertState({
          visible: true,
          title: 'Error',
          message: `Failed to save: ${result.error}`,
        });
      }
    } catch (error) {
      console.error('Error saving workout:', error);
      setAlertState({
        visible: true,
        title: 'Error',
        message: 'Failed to save workout',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getActivityIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (workout.type) {
      case 'running':
        return 'fitness';
      case 'walking':
        return 'walk';
      case 'cycling':
        return 'bicycle';
      default:
        return 'fitness';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <PostingErrorBoundary
        onClose={handleClose}
        fallbackTitle="Workout Error"
        fallbackMessage="There was an error displaying your workout. Your workout is still saved locally."
      >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
          {/* Header */}
          <View style={styles.header}>
            <Ionicons
              name={getActivityIcon()}
              size={40}
              color={theme.colors.text}
            />
            <View style={styles.titleContainer}>
              <Text style={styles.title}>
                {workout.type.charAt(0).toUpperCase() + workout.type.slice(1)}{' '}
                Complete!
              </Text>
              {isSpeaking && (
                <View style={styles.speakingIndicator}>
                  <Ionicons
                    name="volume-medium"
                    size={16}
                    color={theme.colors.accent}
                  />
                  <Text style={styles.speakingText}>Speaking...</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={24} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Reward Earned Banner */}
          {workout.rewardSent && workout.rewardAmount && workout.rewardAmount > 0 && (
            <View style={styles.rewardBanner}>
              <Ionicons name="flash" size={24} color="#f7931a" />
              <View style={styles.rewardTextContainer}>
                <Text style={styles.rewardTitle}>Reward Earned!</Text>
                <Text style={styles.rewardAmount}>+{workout.rewardAmount} sats</Text>
              </View>
            </View>
          )}

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            {/* Only show distance if > 0 (hide for step-only tracking) */}
            {workout.distance > 0 && (
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {formatDistance(workout.distance)}
                </Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
            )}
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {formatDuration(workout.duration)}
              </Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
            {workout.type === 'running' && (
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {activityMetricsService.formatPace(workout.pace)}
                </Text>
                <Text style={styles.statLabel}>Pace</Text>
              </View>
            )}
            {workout.type === 'cycling' && (
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {formatSpeed(workout.speed)}
                </Text>
                <Text style={styles.statLabel}>Speed</Text>
              </View>
            )}
            {workout.type === 'walking' && workout.steps && (
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {workout.steps.toLocaleString()}
                </Text>
                <Text style={styles.statLabel}>Steps</Text>
              </View>
            )}
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{workout.calories}</Text>
              <Text style={styles.statLabel}>Calories</Text>
            </View>
            {workout.elevation !== undefined && workout.elevation > 0 && (
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {workout.elevation.toFixed(0)}m
                </Text>
                <Text style={styles.statLabel}>Elevation</Text>
              </View>
            )}
          </View>

          {/* Route Achievements */}
          {routeAchievements.routeName && (
            <View style={styles.achievementsSection}>
              <View style={styles.achievementHeader}>
                <Ionicons name="map" size={20} color={theme.colors.accent} />
                <Text style={styles.achievementTitle}>
                  {routeAchievements.routeName}
                </Text>
              </View>

              {routeAchievements.isNewPR && (
                <View style={styles.achievementBadge}>
                  <Ionicons
                    name="trophy"
                    size={24}
                    color={theme.colors.orangeBright}
                  />
                  <View style={styles.achievementText}>
                    <Text style={styles.achievementLabel}>
                      NEW PERSONAL RECORD!
                    </Text>
                    {routeAchievements.previousBestTime && (
                      <Text style={styles.achievementValue}>
                        Beat previous best by{' '}
                        {Math.floor(
                          (routeAchievements.previousBestTime -
                            workout.duration) /
                            60
                        )}
                        :
                        {String(
                          Math.floor(
                            (routeAchievements.previousBestTime -
                              workout.duration) %
                              60
                          )
                        ).padStart(2, '0')}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {routeAchievements.milestone === 'first' && (
                <View style={styles.achievementBadge}>
                  <Ionicons name="flag" size={24} color={theme.colors.text} />
                  <View style={styles.achievementText}>
                    <Text style={styles.achievementLabel}>
                      FIRST COMPLETION!
                    </Text>
                    <Text style={styles.achievementValue}>
                      You've established your baseline time
                    </Text>
                  </View>
                </View>
              )}

              {routeAchievements.milestone === 'tenth' && (
                <View style={styles.achievementBadge}>
                  <Ionicons name="medal" size={24} color={theme.colors.text} />
                  <View style={styles.achievementText}>
                    <Text style={styles.achievementLabel}>
                      10TH COMPLETION!
                    </Text>
                    <Text style={styles.achievementValue}>
                      Route veteran - keep crushing it!
                    </Text>
                  </View>
                </View>
              )}

              {routeAchievements.milestone === 'hundredth' && (
                <View style={styles.achievementBadge}>
                  <Ionicons
                    name="ribbon"
                    size={24}
                    color={theme.colors.orangeBright}
                  />
                  <View style={styles.achievementText}>
                    <Text style={styles.achievementLabel}>
                      100TH COMPLETION!
                    </Text>
                    <Text style={styles.achievementValue}>
                      Route legend status achieved!
                    </Text>
                  </View>
                </View>
              )}

              <Text style={styles.achievementStats}>
                Completed {routeAchievements.timesCompleted} time
                {routeAchievements.timesCompleted !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {/* Splits Section */}
          {workout.type === 'running' &&
            workout.splits &&
            workout.splits.length > 0 && (
              <View style={styles.splitsSection}>
                <Text style={styles.splitsHeader}>Kilometer Splits</Text>
                <ScrollView
                  style={styles.splitsScrollView}
                  showsVerticalScrollIndicator={false}
                >
                  {workout.splits.map((split) => {
                    const comparison = getSplitComparison(split);
                    return (
                      <View key={split.number} style={styles.splitRow}>
                        <View style={styles.splitLeft}>
                          <Text style={styles.splitNumber}>
                            {split.number}K
                          </Text>
                        </View>
                        <View style={styles.splitMiddle}>
                          <Text style={styles.splitTime}>
                            {formatSplitTime(split.splitTime)}
                          </Text>
                          <Text style={styles.splitPaceText}>
                            {activityMetricsService.formatPace(split.pace)}
                          </Text>
                        </View>
                        <View style={styles.splitRight}>
                          {comparison === 'faster' && (
                            <Ionicons
                              name="trending-up"
                              size={16}
                              color={theme.colors.text}
                            />
                          )}
                          {comparison === 'slower' && (
                            <Ionicons
                              name="trending-down"
                              size={16}
                              color={theme.colors.textMuted}
                            />
                          )}
                          {comparison === 'average' && (
                            <Ionicons
                              name="remove"
                              size={16}
                              color={theme.colors.textMuted}
                            />
                          )}
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
                <Text style={styles.splitsFooter}>
                  Average Pace:{' '}
                  {activityMetricsService.formatPace(
                    getAverageSplitPace() || 0
                  )}
                </Text>
              </View>
            )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.postButton,
                posted && styles.disabledButton,
              ]}
              onPress={handleShowSocialModal}
              disabled={isPosting || posted}
            >
              {isPosting ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.background}
                />
              ) : (
                <>
                  <Ionicons
                    name={posted ? 'checkmark-circle' : 'chatbubble-outline'}
                    size={20}
                    color={theme.colors.accentText}
                  />
                  <Text style={styles.postButtonText}>
                    {posted ? 'Shared' : 'Post'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.saveButton,
                saved && styles.disabledButton,
              ]}
              onPress={handleSaveForCompetition}
              disabled={isSaving || saved}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={theme.colors.text} />
              ) : (
                <>
                  <Ionicons
                    name={saved ? 'checkmark-circle' : 'cloud-upload-outline'}
                    size={20}
                    color={theme.colors.accentText}
                  />
                  <Text style={styles.saveButtonText}>
                    {saved ? 'Competing' : 'Compete'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

          </View>

          {/* Info Text */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Post:</Text> Share with your
              followers on social media
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Compete:</Text> Enter this workout
              into active competitions and leaderboards
            </Text>
          </View>

          {/* Dismiss Button */}
          <TouchableOpacity style={styles.dismissButton} onPress={handleClose}>
            <Text style={styles.dismissButtonText}>Dismiss</Text>
          </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
      </PostingErrorBoundary>

      <EnhancedSocialShareModal
        visible={showSocialModal}
        workout={preparedWorkout}
        userId={userId}
        userAvatar={userProfile?.picture}
        userName={userProfile?.name || userProfile?.display_name}
        onClose={() => {
          setShowSocialModal(false);
          setPreparedWorkout(null);
        }}
        onSuccess={async () => {
          setPosted(true);
          setShowSocialModal(false);

          // Mark as posted in persistent status tracker (prevents duplicate posts)
          if (preparedWorkout?.id || workout.localWorkoutId) {
            try {
              const workoutId = workout.localWorkoutId || preparedWorkout?.id || '';
              await WorkoutStatusTracker.markAsPosted(workoutId);
              console.log(`✅ Marked workout ${workoutId} as posted in status tracker`);
            } catch (statusError) {
              console.warn('⚠️ Failed to update workout status tracker:', statusError);
            }
          }

          setPreparedWorkout(null);
        }}
      />

      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={[{ text: 'OK', style: 'default' }]}
        onClose={() => setAlertState({ ...alertState, visible: false })}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.large,
    width: '90%',
    maxWidth: 400,
    maxHeight: Dimensions.get('window').height * 0.85,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  closeButton: {
    position: 'absolute',
    right: -8,
    top: -8,
    padding: 8,
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginTop: 12,
  },
  speakingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  speakingText: {
    fontSize: 12,
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.medium,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.medium,
    padding: 12,
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statValue: {
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  actionButtons: {
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: theme.borderRadius.medium,
    gap: 8,
  },
  postButton: {
    backgroundColor: theme.colors.accent, // #FF7B1C
  },
  saveButton: {
    backgroundColor: theme.colors.accent, // #FF7B1C
  },
  disabledButton: {
    opacity: 0.5,
  },
  postButtonText: {
    color: theme.colors.accentText,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  saveButtonText: {
    color: theme.colors.accentText,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  infoContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.small,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  infoBold: {
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  dismissButton: {
    alignItems: 'center',
    padding: 12,
  },
  dismissButtonText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
  },
  splitsSection: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.medium,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  splitsHeader: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  splitsScrollView: {
    maxHeight: 160,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  splitLeft: {
    width: 40,
    marginRight: 12,
  },
  splitNumber: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  splitMiddle: {
    flex: 1,
  },
  splitTime: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 2,
  },
  splitPaceText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  splitRight: {
    marginLeft: 8,
    width: 24,
    alignItems: 'center',
  },
  splitsFooter: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  achievementsSection: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.medium,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    flex: 1,
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.small,
    padding: 12,
    marginBottom: 8,
  },
  achievementText: {
    flex: 1,
  },
  achievementLabel: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  achievementValue: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  achievementStats: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  rewardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(247, 147, 26, 0.15)',
    borderRadius: theme.borderRadius.medium,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f7931a',
    gap: 12,
  },
  rewardTextContainer: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: '#f7931a',
  },
  rewardAmount: {
    fontSize: 14,
    color: theme.colors.text,
    marginTop: 2,
  },
});
