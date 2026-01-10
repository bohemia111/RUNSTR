/**
 * WorkoutLevelRing Component
 * Circular progress ring displaying user's workout level and XP
 * Tappable to show XP calculation explainer modal
 * Matches RUNSTR orange/gold theme with dark background
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import type { LevelStats } from '../../types/workoutLevel';
import { XP_CONSTANTS, STREAK_BONUSES } from '../../types/workoutLevel';
import WorkoutLevelService from '../../services/fitness/WorkoutLevelService';

// Generic workout interface compatible with both LocalWorkout and NostrWorkout
interface GenericWorkout {
  id: string;
  type: string;
  distance?: number;
  duration?: number;
  startTime: string;
}

interface WorkoutLevelRingProps {
  workouts: GenericWorkout[];
  pubkey: string;
}

export const WorkoutLevelRing: React.FC<WorkoutLevelRingProps> = ({
  workouts,
  pubkey,
}) => {
  const [stats, setStats] = useState<LevelStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showExplainer, setShowExplainer] = useState(false);

  const levelService = WorkoutLevelService;

  useEffect(() => {
    loadLevelStats();
  }, [workouts, pubkey]);

  const loadLevelStats = async () => {
    try {
      setIsLoading(true);
      const levelStats = await levelService.getLevelStats(pubkey, workouts);
      setStats(levelStats);
    } catch (error) {
      console.error('[WorkoutLevelRing] Failed to load level stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // SVG circle parameters
  const size = 120;
  const strokeWidth = 8;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate stroke dash offset for progress
  const progress = stats?.level.progress || 0;
  const strokeDashoffset = circumference * (1 - progress);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </View>
    );
  }

  if (!stats) {
    return null;
  }

  const currentStreak = stats.currentStreak || 0;
  const streakBonus = levelService.calculateStreakBonus(currentStreak);

  return (
    <View style={styles.container}>
      {/* Tappable ring to show XP explainer */}
      <TouchableOpacity
        style={styles.ringContainer}
        onPress={() => setShowExplainer(true)}
        activeOpacity={0.8}
      >
        {/* SVG Progress Ring */}
        <Svg width={size} height={size}>
          <Defs>
            {/* Orange gradient for progress ring */}
            <LinearGradient
              id="ringGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <Stop offset="0%" stopColor="#FF7B1C" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FF9D42" stopOpacity="1" />
            </LinearGradient>
          </Defs>

          {/* Background circle (gray) */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#1a1a1a"
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* Progress circle (orange gradient) */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="url(#ringGradient)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${center}, ${center}`}
          />
        </Svg>

        {/* Level number in center */}
        <View style={styles.centerContent}>
          <Text style={styles.levelNumber}>{stats.level.level}</Text>
          <Text style={styles.levelLabel}>LEVEL</Text>
        </View>

        {/* Tap hint */}
        <View style={styles.tapHint}>
          <Ionicons name="information-circle-outline" size={16} color="#666" />
        </View>
      </TouchableOpacity>

      {/* Stats below ring */}
      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.qualifyingWorkouts}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {levelService.formatXP(stats.level.currentXP)} /{' '}
              {levelService.formatXP(stats.level.xpForNextLevel)}
            </Text>
            <Text style={styles.statLabel}>XP Progress</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{currentStreak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
        </View>
      </View>

      {/* XP Explainer Modal */}
      <Modal
        visible={showExplainer}
        animationType="fade"
        transparent
        onRequestClose={() => setShowExplainer(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowExplainer(false)}
        >
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Ionicons name="flash" size={24} color="#FF9D42" />
              <Text style={styles.modalTitle}>How XP Works</Text>
              <TouchableOpacity
                onPress={() => setShowExplainer(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* XP Breakdown */}
            <View style={styles.xpBreakdown}>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>Every workout</Text>
                <Text style={styles.xpValue}>
                  +{XP_CONSTANTS.BASE_XP_PER_WORKOUT} XP
                </Text>
              </View>

              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>Per 10 minutes</Text>
                <Text style={styles.xpValue}>
                  +{XP_CONSTANTS.DURATION_XP_PER_10_MIN} XP
                </Text>
              </View>

              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>Per km (cardio)</Text>
                <Text style={styles.xpValue}>
                  +{XP_CONSTANTS.DISTANCE_XP_PER_KM} XP
                </Text>
              </View>

              <View style={styles.xpDivider} />

              <Text style={styles.streakTitle}>Streak Bonuses</Text>
              {STREAK_BONUSES.map((streak) => (
                <View key={streak.days} style={styles.xpRow}>
                  <Text style={styles.xpLabel}>{streak.days}+ day streak</Text>
                  <Text style={styles.xpValue}>+{streak.bonus} XP/workout</Text>
                </View>
              ))}
            </View>

            {/* Current Stats */}
            <View style={styles.currentStats}>
              <Text style={styles.currentStatsTitle}>Your Stats</Text>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>Current streak</Text>
                <Text style={styles.xpValueHighlight}>{currentStreak} days</Text>
              </View>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>Streak bonus</Text>
                <Text style={styles.xpValueHighlight}>
                  +{streakBonus} XP/workout
                </Text>
              </View>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>Total XP</Text>
                <Text style={styles.xpValueHighlight}>
                  {levelService.formatXP(stats.level.totalXP)} XP
                </Text>
              </View>
            </View>

            {/* Minimum threshold note */}
            <Text style={styles.thresholdNote}>
              Workouts must be 5+ minutes or 0.5+ km to qualify for XP.
            </Text>
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
    padding: 20,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
  },

  loadingContainer: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },

  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },

  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },

  levelNumber: {
    fontSize: 36,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFB366',
    lineHeight: 40,
  },

  levelLabel: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semiBold,
    color: '#FF9D42',
    letterSpacing: 1,
    marginTop: 2,
  },

  tapHint: {
    position: 'absolute',
    bottom: -4,
    right: '50%',
    marginRight: -60,
  },

  statsContainer: {
    marginTop: 8,
  },

  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },

  statItem: {
    flex: 1,
    alignItems: 'center',
  },

  statValue: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: '#FFB366',
    marginBottom: 4,
  },

  statLabel: {
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    color: '#CC7A33',
  },

  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#1a1a1a',
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
    marginBottom: 20,
  },

  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
    color: '#FFB366',
    marginLeft: 10,
  },

  xpBreakdown: {
    marginBottom: 16,
  },

  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },

  xpLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },

  xpValue: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: '#FF9D42',
  },

  xpValueHighlight: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: '#FFB366',
  },

  xpDivider: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginVertical: 12,
  },

  streakTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 4,
  },

  currentStats: {
    backgroundColor: '#1a1510',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2010',
  },

  currentStatsTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: '#FF9D42',
    marginBottom: 8,
  },

  thresholdNote: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
