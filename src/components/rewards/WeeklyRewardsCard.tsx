/**
 * WeeklyRewardsCard - Hero display for weekly rewards earned
 *
 * Shows:
 * - Sats earned this week (prominent)
 * - 7-dot workout streak indicator
 * - Total streak count with flame icon
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import type { LocalWorkout } from '../../services/fitness/LocalWorkoutStorageService';

interface WeeklyRewardsCardProps {
  workouts: LocalWorkout[];
  weeklyRewardsEarned?: number;
}

export const WeeklyRewardsCard: React.FC<WeeklyRewardsCardProps> = ({
  workouts,
  weeklyRewardsEarned = 0,
}) => {
  const [daysThisWeek, setDaysThisWeek] = useState(0);
  const [totalStreak, setTotalStreak] = useState(0);

  useEffect(() => {
    calculateWeeklyDays();
    calculateTotalStreak();
  }, [workouts]);

  /**
   * Calculate unique workout days in current week (Mon-Sun)
   */
  const calculateWeeklyDays = () => {
    if (workouts.length === 0) {
      setDaysThisWeek(0);
      return;
    }

    // Get start of current week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    // Get unique workout dates this week
    const thisWeekDates = new Set<string>();
    workouts.forEach((w) => {
      const workoutDate = new Date(w.startTime);
      if (workoutDate >= monday) {
        thisWeekDates.add(workoutDate.toLocaleDateString('en-CA'));
      }
    });

    setDaysThisWeek(Math.min(thisWeekDates.size, 7));
  };

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

  return (
    <View style={styles.container}>
      {/* Header + Sats in one row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="flash" size={16} color="#FF9D42" />
          <Text style={styles.headerTitle}>WORKOUT REWARDS</Text>
        </View>
        <View style={styles.satsDisplay}>
          <Text style={styles.satsValue}>{weeklyRewardsEarned}</Text>
          <Text style={styles.satsLabel}>sats</Text>
        </View>
      </View>

      {/* Stats + Dots in compact layout */}
      <View style={styles.bottomRow}>
        <View style={styles.statsSection}>
          <Text style={styles.statText}>{workoutsThisWeek} workouts</Text>
          <View style={styles.streakRow}>
            <Ionicons name="flame" size={14} color="#FF7B1C" />
            <Text style={styles.statText}>{totalStreak} day streak</Text>
          </View>
        </View>
        <View style={styles.dotsSection}>
          <View style={styles.dotsRow}>
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <View
                key={day}
                style={[styles.dot, day <= daysThisWeek && styles.dotFilled]}
              />
            ))}
          </View>
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
    padding: 14,
    marginBottom: 10,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
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

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
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

  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  dotsSection: {
    alignItems: 'flex-end',
  },

  dotsRow: {
    flexDirection: 'row',
    gap: 4,
  },

  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1a1a1a',
  },

  dotFilled: {
    backgroundColor: 'rgba(255, 123, 28, 0.3)',
    borderWidth: 1.5,
    borderColor: '#FF7B1C',
  },
});
