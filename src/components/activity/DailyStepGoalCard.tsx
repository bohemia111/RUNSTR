/**
 * DailyStepGoalCard - Displays daily step count with progress ring
 * Shows current steps, goal, and visual progress indicator
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
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
  postingState?: PostingState;
}

export const DailyStepGoalCard: React.FC<DailyStepGoalCardProps> = ({
  steps,
  progress,
  loading = false,
  error = null,
  onPostSteps,
  postingState = 'idle',
}) => {
  // Format step count with commas
  const formatSteps = (count: number): string => {
    return count.toLocaleString();
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={styles.loadingText}>Loading step count...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <Ionicons name="warning" size={32} color={theme.colors.textMuted} />
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorHint}>
          Make sure motion permissions are enabled
        </Text>
      </View>
    );
  }

  // No data state
  if (steps === null || progress === null) {
    return (
      <View style={styles.container}>
        <Ionicons name="footsteps" size={32} color={theme.colors.textMuted} />
        <Text style={styles.noDataText}>No step data available</Text>
      </View>
    );
  }

  // Calculate progress ring dimensions
  const ringSize = 120;
  const strokeWidth = 10;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progressOffset = circumference - (progress.percentage / 100) * circumference;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's Steps</Text>

      {/* Progress Ring */}
      <View style={styles.progressRingContainer}>
        {/* Background ring */}
        <View style={[styles.ring, { width: ringSize, height: ringSize }]}>
          <View
            style={[
              styles.ringBackground,
              {
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
                borderWidth: strokeWidth,
              },
            ]}
          />

          {/* Progress ring (simulated with border) */}
          <View
            style={[
              styles.ringProgress,
              {
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
                borderWidth: strokeWidth,
                transform: [{ rotate: `-90deg` }],
              },
            ]}
          >
            {/* This is a simplified progress ring */}
            {/* For a true circular progress, consider using react-native-svg */}
          </View>

          {/* Center content */}
          <View style={styles.ringCenter}>
            {progress.achieved && (
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} style={styles.checkmark} />
            )}
            <Text style={styles.stepCount}>{formatSteps(steps)}</Text>
            <Text style={styles.stepLabel}>steps</Text>
            <Text style={styles.percentage}>{progress.percentage}%</Text>
          </View>
        </View>
      </View>

      {/* Goal information */}
      <View style={styles.goalInfo}>
        <Text style={styles.goalText}>
          Goal: {formatSteps(progress.goalSteps)} steps
        </Text>
        {!progress.achieved && (
          <Text style={styles.remainingText}>
            {formatSteps(progress.remaining)} remaining
          </Text>
        )}
        {progress.achieved && (
          <View style={styles.achievedBadge}>
            <Ionicons name="trophy" size={16} color={theme.colors.accent} />
            <Text style={styles.achievedText}>Goal achieved!</Text>
          </View>
        )}
      </View>

      {/* Post Daily Steps Button */}
      {onPostSteps && (
        <TouchableOpacity
          style={[
            styles.postButton,
            postingState === 'posted' && styles.postButtonDisabled,
          ]}
          onPress={onPostSteps}
          disabled={postingState === 'posting' || postingState === 'posted'}
        >
          {postingState === 'posting' ? (
            <ActivityIndicator size="small" color={theme.colors.text} />
          ) : (
            <>
              <Ionicons
                name={postingState === 'posted' ? 'checkmark-circle' : 'cloud-upload'}
                size={20}
                color={postingState === 'posted' ? theme.colors.textMuted : theme.colors.text}
              />
              <Text
                style={[
                  styles.postButtonText,
                  postingState === 'posted' && styles.postButtonTextDisabled,
                ]}
              >
                {postingState === 'posted' ? 'Posted Today' : 'Post Daily Steps'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    marginVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 20,
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
    marginTop: 4,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  noDataText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  progressRingContainer: {
    marginVertical: 20,
  },
  ring: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringBackground: {
    position: 'absolute',
    borderColor: theme.colors.border,
  },
  ringProgress: {
    position: 'absolute',
    borderColor: theme.colors.accent,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    marginBottom: 4,
  },
  stepCount: {
    fontSize: 28,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  stepLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  percentage: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accent,
    marginTop: 4,
  },
  goalInfo: {
    alignItems: 'center',
    marginTop: 8,
  },
  goalText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: 4,
  },
  remainingText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  achievedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    marginTop: 8,
  },
  achievedText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accent,
  },
  postButton: {
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
  postButtonDisabled: {
    backgroundColor: theme.colors.border,
    opacity: 0.6,
  },
  postButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  postButtonTextDisabled: {
    color: theme.colors.textMuted,
  },
});
