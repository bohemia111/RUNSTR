/**
 * StepRewardsCard - Step milestone rewards display
 *
 * Shows:
 * - Today's step count
 * - Milestones reached progress bar
 * - Sats earned today from steps
 * - Steps until next milestone
 * - Compete button to publish steps as kind 1301 event
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

interface StepRewardsCardProps {
  /** Current step count from DailyStepCounterService */
  currentSteps: number;
  /** Milestones already rewarded today [1000, 2000, 3000...] */
  rewardedMilestones: number[];
  /** Total sats earned from steps today */
  todaySats: number;
  /** Total sats earned from steps this week */
  weeklySats: number;
  /** Whether step data is loading */
  isLoading?: boolean;
  /** Sats rewarded per milestone */
  satsPerMilestone?: number;
  /** Step increment per milestone */
  milestoneIncrement?: number;
  /** Callback when user taps Compete button to publish steps */
  onCompete?: () => void;
  /** Whether step publishing is in progress */
  isPublishing?: boolean;
  /** Callback when user taps Post button to open social share modal */
  onPost?: () => void;
  /** Whether social posting is in progress */
  isPosting?: boolean;
}

// Match app's orange theme
const ACCENT = '#FF9D42';
const ACCENT_BRIGHT = '#FFB366';
const ACCENT_LIGHT = 'rgba(255, 157, 66, 0.3)';

export const StepRewardsCard: React.FC<StepRewardsCardProps> = ({
  currentSteps,
  rewardedMilestones,
  todaySats,
  weeklySats,
  isLoading = false,
  satsPerMilestone = 5,
  milestoneIncrement = 1000,
  onCompete,
  isPublishing = false,
  onPost,
  isPosting = false,
}) => {
  // Calculate progress
  const totalMilestonesReached = Math.floor(currentSteps / milestoneIncrement);
  const milestonesRewarded = rewardedMilestones.length;

  // Next milestone info
  const nextMilestone = (totalMilestonesReached + 1) * milestoneIncrement;
  const stepsToNext = nextMilestone - currentSteps;

  // Progress bar percentage (based on typical 10k goal)
  const progressPercent = Math.min((currentSteps / 10000) * 100, 100);

  // Pending milestones to reward
  const pendingMilestones = totalMilestonesReached - milestonesRewarded;

  return (
    <View style={styles.container}>
      {/* Header + Sats in one row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="footsteps" size={16} color={ACCENT} />
          <Text style={styles.headerTitle}>STEP REWARDS</Text>
        </View>
        <View style={styles.satsDisplay}>
          {isLoading ? (
            <ActivityIndicator size="small" color={ACCENT} />
          ) : (
            <>
              <Text style={styles.satsValue}>{todaySats}</Text>
              <Text style={styles.satsLabel}>sats</Text>
            </>
          )}
        </View>
      </View>

      {/* Step count and milestones */}
      <View style={styles.mainSection}>
        {/* Step count */}
        <View style={styles.stepCountRow}>
          <Text style={styles.stepCount}>
            {currentSteps.toLocaleString()}
          </Text>
          <Text style={styles.stepLabel}>steps today</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progressPercent}%` },
              ]}
            />
          </View>
        </View>

        {/* Milestones info */}
        <View style={styles.milestonesRow}>
          <View style={styles.milestoneInfo}>
            <Text style={styles.milestoneValue}>
              {milestonesRewarded}
            </Text>
            <Text style={styles.milestoneLabel}>
              of {totalMilestonesReached > 0 ? totalMilestonesReached : '?'} milestones
            </Text>
          </View>

          {/* Show pending if any */}
          {pendingMilestones > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>
                +{pendingMilestones} pending
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Bottom stats row */}
      <View style={styles.bottomRow}>
        <View style={styles.statsSection}>
          <Text style={styles.statText}>
            {satsPerMilestone} sats per {(milestoneIncrement / 1000).toFixed(0)}k steps
          </Text>
          <View style={styles.weeklyRow}>
            <Ionicons name="calendar-outline" size={14} color="#999" />
            <Text style={styles.statText}>{weeklySats} sats this week</Text>
          </View>
        </View>

        {/* Action buttons - styled to match rewards screen */}
        {(onCompete || onPost) && (
          <View style={styles.actionButtonsStack}>
            {onCompete && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  isPublishing && styles.actionButtonDisabled,
                ]}
                onPress={onCompete}
                disabled={isPublishing}
                activeOpacity={0.7}
              >
                {isPublishing ? (
                  <ActivityIndicator size="small" color={ACCENT_BRIGHT} />
                ) : (
                  <Text style={styles.actionButtonText}>Compete</Text>
                )}
              </TouchableOpacity>
            )}
            {onPost && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  isPosting && styles.actionButtonDisabled,
                ]}
                onPress={onPost}
                disabled={isPosting}
                activeOpacity={0.7}
              >
                {isPosting ? (
                  <ActivityIndicator size="small" color={ACCENT_BRIGHT} />
                ) : (
                  <Text style={styles.actionButtonText}>Post</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Next milestone */}
        <View style={styles.nextMilestone}>
          <Text style={styles.nextLabel}>Next reward</Text>
          <Text style={styles.nextValue}>
            {stepsToNext.toLocaleString()} steps
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 12,
    marginBottom: 10,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  headerTitle: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: ACCENT,
    letterSpacing: 1,
  },

  satsDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },

  satsValue: {
    fontSize: 28,
    fontWeight: theme.typography.weights.extraBold,
    color: ACCENT_BRIGHT,
  },

  satsLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: theme.typography.weights.medium,
  },

  mainSection: {
    marginBottom: 8,
  },

  stepCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 6,
  },

  stepCount: {
    fontSize: 28,
    fontWeight: theme.typography.weights.extraBold,
    color: ACCENT_BRIGHT,
  },

  stepLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: theme.typography.weights.medium,
  },

  progressBarContainer: {
    marginBottom: 6,
  },

  progressBarBackground: {
    height: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 3,
    overflow: 'hidden',
  },

  progressBarFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 4,
  },

  milestonesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  milestoneInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },

  milestoneValue: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: ACCENT_BRIGHT,
  },

  milestoneLabel: {
    fontSize: 12,
    color: '#666',
  },

  pendingBadge: {
    backgroundColor: ACCENT_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ACCENT,
  },

  pendingText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semiBold,
    color: ACCENT,
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },

  statsSection: {
    gap: 4,
  },

  statText: {
    fontSize: 12,
    color: '#999',
    fontWeight: theme.typography.weights.medium,
  },

  weeklyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  nextMilestone: {
    alignItems: 'flex-end',
  },

  nextLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: theme.typography.weights.medium,
    marginBottom: 2,
  },

  nextValue: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: ACCENT_BRIGHT,
  },

  actionButtonsStack: {
    flexDirection: 'column',
    gap: 2,
    alignItems: 'center',
  },

  actionButton: {
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 6,
    width: 70,
    alignItems: 'center',
  },

  actionButtonDisabled: {
    // No visual change - just non-tappable
  },

  actionButtonText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: ACCENT_BRIGHT,
  },
});

export default StepRewardsCard;
