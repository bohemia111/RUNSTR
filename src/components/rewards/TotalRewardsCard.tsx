/**
 * TotalRewardsCard - Unified hero display for all rewards
 *
 * Combines workout rewards and step rewards into a single minimalist card:
 * - Total sats earned (prominent)
 * - Workout count and streak
 * - Steps today with Compete button
 * - Info modal explaining the rewards system
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import type { LocalWorkout } from '../../services/fitness/LocalWorkoutStorageService';

interface TotalRewardsCardProps {
  workouts: LocalWorkout[];
  weeklyRewardsEarned?: number;
  stepRewardsEarned?: number;
  currentSteps: number;
  onCompete?: () => void;
  isPublishing?: boolean;
}

export const TotalRewardsCard: React.FC<TotalRewardsCardProps> = ({
  workouts,
  weeklyRewardsEarned = 0,
  stepRewardsEarned = 0,
  currentSteps,
  onCompete,
  isPublishing = false,
}) => {
  const [totalStreak, setTotalStreak] = useState(0);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    calculateTotalStreak();
  }, [workouts]);

  /**
   * Calculate total consecutive streak
   */
  const calculateTotalStreak = () => {
    if (workouts.length === 0) {
      setTotalStreak(0);
      return;
    }

    const workoutDates = new Set(
      workouts.map((w) => new Date(w.startTime).toLocaleDateString('en-CA'))
    );

    const today = new Date().toLocaleDateString('en-CA');
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');

    let streak = 0;
    let checkDate = today;

    if (workoutDates.has(today)) {
      streak = 1;
      checkDate = yesterday;
    } else if (workoutDates.has(yesterday)) {
      checkDate = yesterday;
    } else {
      setTotalStreak(0);
      return;
    }

    let currentDate = new Date(checkDate);
    while (workoutDates.has(currentDate.toLocaleDateString('en-CA'))) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }

    if (!workoutDates.has(today) && workoutDates.has(yesterday)) {
      streak--;
    }

    setTotalStreak(streak);
  };

  // Count workouts this week
  const getWorkoutsThisWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    return workouts.filter((w) => new Date(w.startTime) >= monday).length;
  };

  const workoutsThisWeek = getWorkoutsThisWeek();
  const totalSats = weeklyRewardsEarned + stepRewardsEarned;

  return (
    <View style={styles.container}>
      {/* Header + Sats in one row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>YOUR REWARDS</Text>
          <TouchableOpacity
            onPress={() => setShowInfoModal(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="information-circle-outline" size={16} color="#666" />
          </TouchableOpacity>
        </View>
        <View style={styles.satsDisplay}>
          <Text style={styles.satsValue}>{totalSats}</Text>
          <Text style={styles.satsLabel}>sats</Text>
        </View>
      </View>

      {/* Stats section */}
      <View style={styles.statsSection}>
        {/* Workout stats row */}
        <View style={styles.workoutStatsRow}>
          <Text style={styles.statText}>{workoutsThisWeek} workouts</Text>
          <Text style={styles.statDot}>•</Text>
          <Text style={styles.statText}>{totalStreak} day streak</Text>
        </View>

        {/* Steps row with Compete button */}
        <View style={styles.stepsRow}>
          <Text style={styles.stepsText}>
            {currentSteps.toLocaleString()} steps today
          </Text>

          {onCompete && (
            <View style={styles.actionButtons}>
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
                  <ActivityIndicator size="small" color="#FFB366" />
                ) : (
                  <Text style={styles.actionButtonText}>Compete</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Info Modal */}
      <Modal
        visible={showInfoModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowInfoModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowInfoModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>How Rewards Work</Text>
              <TouchableOpacity
                onPress={() => setShowInfoModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoSubtitle}>Workout Rewards</Text>
              <Text style={styles.infoText}>
                Earn 50 sats per daily workout.
              </Text>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoSection}>
              <Text style={styles.infoSubtitle}>Step Rewards</Text>
              <Text style={styles.infoText}>
                Earn 5 sats for every 1,000 steps. Milestones are tracked automatically throughout the day.
              </Text>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoSection}>
              <Text style={styles.infoSubtitle}>Compete</Text>
              <Text style={styles.infoText}>
                <Text style={styles.infoHighlight}>Compete</Text> pushes your steps into all eligible competitions for the day.
              </Text>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoSection}>
              <Text style={styles.infoSubtitle}>Receiving Rewards</Text>
              <Text style={styles.infoText}>
                Set your Lightning address below to receive sats directly to your wallet.
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 14,
    marginBottom: 10,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  headerTitle: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: '#FF9D42',
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
    color: '#FFB366',
  },

  satsLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: theme.typography.weights.medium,
  },

  statsSection: {
    gap: 10,
  },

  workoutStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  statText: {
    fontSize: 13,
    color: '#999',
    fontWeight: theme.typography.weights.medium,
  },

  statDot: {
    fontSize: 13,
    color: '#666',
  },

  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  stepsText: {
    fontSize: 13,
    color: '#999',
    fontWeight: theme.typography.weights.medium,
  },

  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },

  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#FF9D42',
    borderRadius: 6,
    minWidth: 70,
    alignItems: 'center',
  },

  actionButtonDisabled: {
    opacity: 0.6,
  },

  actionButtonText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: '#FFB366',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  modalContent: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: '#FFB366',
  },

  infoSection: {
    marginBottom: 4,
  },

  infoSubtitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 6,
  },

  infoText: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
  },

  infoHighlight: {
    color: '#FF9D42',
    fontWeight: theme.typography.weights.semiBold,
  },

  infoDivider: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginVertical: 14,
  },
});

export default TotalRewardsCard;
