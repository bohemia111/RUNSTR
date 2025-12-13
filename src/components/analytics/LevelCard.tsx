/**
 * LevelCard - 3-column display of Level, Total XP, and XP to Next Level
 * Matches HealthSnapshotCard styling exactly
 * Uses distance-based XP calculation from WorkoutLevelService
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../styles/theme';
import { WorkoutLevelService } from '../../services/fitness/WorkoutLevelService';
import type { LevelStats } from '../../types/workoutLevel';

interface LocalWorkout {
  id: string;
  type: string;
  distance?: number;
  duration?: number;
  startTime: string;
}

interface LevelCardProps {
  workouts: LocalWorkout[];
}

export const LevelCard: React.FC<LevelCardProps> = ({ workouts }) => {
  const [stats, setStats] = useState<LevelStats | null>(null);

  useEffect(() => {
    const levelService = WorkoutLevelService.getInstance();
    const calculated = levelService.calculateLevelStats(workouts);
    setStats(calculated);
  }, [workouts]);

  if (!stats) {
    return (
      <View style={styles.container}>
        <View style={styles.columnsContainer}>
          <View style={styles.column}>
            <Text style={styles.label}>Level</Text>
            <Text style={styles.value}>-</Text>
            <Text style={styles.category}>-</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.column}>
            <Text style={styles.label}>Total</Text>
            <Text style={styles.value}>-</Text>
            <Text style={styles.category}>XP</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.column}>
            <Text style={styles.label}>Next At</Text>
            <Text style={styles.value}>-</Text>
            <Text style={styles.category}>XP</Text>
          </View>
        </View>
      </View>
    );
  }

  const { level } = stats;
  const levelService = WorkoutLevelService.getInstance();
  const progressPercent = Math.round(level.progress * 100);

  return (
    <View style={styles.container}>
      {/* 3-column layout matching HealthSnapshotCard */}
      <View style={styles.columnsContainer}>
        {/* Level Column */}
        <View style={styles.column}>
          <Text style={styles.label}>Level</Text>
          <Text style={styles.value}>{level.level}</Text>
          <Text style={styles.category}>{level.title}</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Total XP Column */}
        <View style={styles.column}>
          <Text style={styles.label}>Total</Text>
          <Text style={styles.value}>{levelService.formatXP(level.totalXP)}</Text>
          <Text style={styles.category}>XP</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Next Level XP Column */}
        <View style={styles.column}>
          <Text style={styles.label}>Next At</Text>
          <Text style={styles.value}>
            {levelService.formatXP(level.xpForNextLevel)}
          </Text>
          <Text style={styles.category}>XP</Text>
        </View>
      </View>

      {/* Progress bar section */}
      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${progressPercent}%` }]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressText}>
            {levelService.formatXP(level.currentXP)} /{' '}
            {levelService.formatXP(level.xpForNextLevel)} XP
          </Text>
          <Text style={styles.progressPercent}>{progressPercent}%</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0a0a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 10,
    marginBottom: 12,
  },

  columnsContainer: {
    flexDirection: 'row',
  },

  column: {
    flex: 1,
    alignItems: 'center',
  },

  divider: {
    width: 1,
    backgroundColor: '#1a1a1a',
    marginHorizontal: 8,
  },

  label: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semiBold,
    color: '#CC7A33',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  value: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: '#FF9D42',
    marginBottom: 2,
  },

  category: {
    fontSize: 10,
    fontWeight: theme.typography.weights.medium,
    color: '#FFB366',
  },

  progressSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },

  progressTrack: {
    height: 4,
    backgroundColor: '#1a1a1a',
    borderRadius: 2,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#FF7B1C',
    borderRadius: 2,
  },

  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },

  progressText: {
    fontSize: 10,
    color: '#CC7A33',
  },

  progressPercent: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semiBold,
    color: '#CC7A33',
  },
});
