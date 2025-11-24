/**
 * DailyStepGoalCard - Displays daily step count with progress ring
 * Shows current steps, goal, and visual progress indicator
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import type { StepGoalProgress } from '../../services/activity/DailyStepGoalService';

export type PostingState = 'idle' | 'posting' | 'posted';

interface DailyStepGoalCardProps {
  steps: number | null;
  progress: StepGoalProgress | null;
  loading?: boolean;
  error?: string | null;
  onPostSteps?: () => void;
  onSetGoal?: () => void;
  postingState?: PostingState;
  onRequestPermission?: () => void;
  onOpenSettings?: () => void;
  showBackgroundBanner?: boolean;
  onEnableBackground?: () => void;
  isBackgroundActive?: boolean;
}

export const DailyStepGoalCard: React.FC<DailyStepGoalCardProps> = ({
  steps,
  progress,
  loading = false,
  error = null,
  onPostSteps,
  onSetGoal,
  postingState = 'idle',
  onRequestPermission,
  onOpenSettings,
  showBackgroundBanner = false,
  onEnableBackground,
  isBackgroundActive = false,
}) => {
  // Format step count with commas
  const formatSteps = (count: number): string => {
    return count.toLocaleString();
  };

  // Loading state - show minimal loading indicator
  if (loading && steps === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Today's Steps</Text>
        <ActivityIndicator
          size="large"
          color={theme.colors.accent}
          style={{ marginVertical: 20 }}
        />
        <Text style={styles.loadingText}>Loading step count...</Text>
      </View>
    );
  }

  // Default to 0 steps if no data (don't block UI)
  const displaySteps = steps ?? 0;
  const displayProgress = progress ?? {
    steps: 0,
    goalSteps: 10000,
    percentage: 0,
    remaining: 10000,
    achieved: false,
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's Steps</Text>

      {/* 3-Column Layout: Progress Badge + Text + Buttons */}
      <View style={styles.horizontalContent}>
        {/* Left: Progress Badge */}
        <View style={styles.progressBadge}>
          <Text style={styles.percentage}>{displayProgress.percentage}%</Text>
        </View>

        {/* Middle: Text Content */}
        <View style={styles.textContent}>
          <View style={styles.stepCountRow}>
            {displayProgress.achieved && (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={theme.colors.accent}
                style={styles.checkmarkInline}
              />
            )}
            <Text style={styles.stepCount}>{formatSteps(displaySteps)}</Text>
            <Text style={styles.stepLabel}> steps</Text>
          </View>
          <Text style={styles.goalText}>
            Goal: {formatSteps(displayProgress.goalSteps)}
          </Text>
          {!displayProgress.achieved && (
            <Text style={styles.remainingText}>
              {formatSteps(displayProgress.remaining)} left
            </Text>
          )}
          {displayProgress.achieved && (
            <View style={styles.achievedBadge}>
              <Ionicons name="trophy" size={12} color={theme.colors.accent} />
              <Text style={styles.achievedText}>Goal achieved!</Text>
            </View>
          )}
        </View>

        {/* Right: Button Column */}
        <View style={styles.buttonColumn}>
          {onSetGoal && (
            <TouchableOpacity
              style={styles.goalButton}
              onPress={onSetGoal}
              activeOpacity={0.7}
            >
              <Ionicons
                name="trophy-outline"
                size={14}
                color={theme.colors.accent}
              />
              <Text style={styles.goalButtonText}>Set Goal</Text>
            </TouchableOpacity>
          )}
          {onPostSteps && (
            <TouchableOpacity
              style={[
                styles.compactPostButton,
                postingState === 'posted' && styles.postButtonDisabled,
              ]}
              onPress={onPostSteps}
              disabled={postingState === 'posting' || postingState === 'posted'}
              activeOpacity={0.7}
            >
              {postingState === 'posting' ? (
                <ActivityIndicator size="small" color={theme.colors.text} />
              ) : (
                <>
                  <Ionicons
                    name={
                      postingState === 'posted'
                        ? 'checkmark-circle'
                        : 'chatbubble-outline'
                    }
                    size={14}
                    color={
                      postingState === 'posted'
                        ? theme.colors.textMuted
                        : theme.colors.text
                    }
                  />
                  <Text
                    style={[
                      styles.goalButtonText,
                      postingState === 'posted' &&
                        styles.postButtonTextDisabled,
                    ]}
                  >
                    {postingState === 'posted' ? 'Posted' : 'Post'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Background Active Badge */}
      {isBackgroundActive && (
        <View style={styles.backgroundActiveBadge}>
          <Ionicons
            name="refresh-circle"
            size={16}
            color={theme.colors.accent}
          />
          <Text style={styles.backgroundActiveText}>Auto-counting enabled</Text>
        </View>
      )}

      {/* Background Tracking Banner */}
      {showBackgroundBanner && !isBackgroundActive && onEnableBackground && (
        <View style={styles.backgroundBanner}>
          <View style={styles.bannerContent}>
            <Ionicons name="walk" size={20} color={theme.colors.textMuted} />
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>Enable Background Tracking</Text>
              <Text style={styles.bannerSubtext}>
                Automatically count steps throughout the day
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.enableButton}
            onPress={onEnableBackground}
            activeOpacity={0.7}
          >
            <Text style={styles.enableButtonText}>Enable</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Error hint (non-blocking) */}
      {error && !isBackgroundActive && (
        <Text style={styles.errorHint}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 8,
    marginHorizontal: 12,
    marginVertical: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 2,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  errorHint: {
    marginTop: 8,
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  backgroundActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    marginTop: 8,
  },
  backgroundActiveText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.accent,
  },
  backgroundBanner: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 2,
  },
  bannerSubtext: {
    fontSize: 11,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },
  enableButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  enableButtonText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.background,
  },
  noDataText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  horizontalContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBadge: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textContent: {
    flex: 1,
    justifyContent: 'center',
  },
  stepCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  checkmarkInline: {
    marginRight: 4,
  },
  stepCount: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  stepLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  percentage: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  goalText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },
  remainingText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  buttonColumn: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 6,
    width: '40%',
  },
  goalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  goalButtonText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  compactPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  achievedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    marginTop: 4,
  },
  achievedText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accent,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginTop: 4,
    gap: 6,
  },
  postButtonDisabled: {
    backgroundColor: theme.colors.border,
    opacity: 0.6,
  },
  postButtonText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  postButtonTextDisabled: {
    color: theme.colors.textMuted,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.background,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  settingsButtonText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },
});
