/**
 * StreakRewardsCard - Compact display of weekly workout streaks
 *
 * Tracks unique workout DAYS per week (Mon-Sun)
 * Multiple workouts on same day = 1 day
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import type { LocalWorkout } from '../../services/fitness/LocalWorkoutStorageService';

interface StreakRewardsCardProps {
  workouts: LocalWorkout[];
}

export const StreakRewardsCard: React.FC<StreakRewardsCardProps> = ({
  workouts,
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
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString(
      'en-CA'
    );

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="flame" size={16} color="#FF9D42" />
          <Text style={styles.title}>Streaks</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Days this week display */}
        <Text style={styles.daysText}>
          {daysThisWeek} day{daysThisWeek !== 1 ? 's' : ''} this week
        </Text>

        {/* Compact progress dots */}
        <View style={styles.dotsRow}>
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <View
              key={day}
              style={[styles.dot, day <= daysThisWeek && styles.dotFilled]}
            />
          ))}
        </View>

        {/* Total streak if > 7 days */}
        {totalStreak > 7 && (
          <View style={styles.totalStreakRow}>
            <Ionicons name="trophy" size={12} color="#FFB366" />
            <Text style={styles.totalStreakText}>
              {totalStreak} day streak
            </Text>
          </View>
        )}
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  title: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },

  content: {
    gap: 8,
    alignItems: 'center',
  },

  daysText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },

  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },

  dotFilled: {
    backgroundColor: 'rgba(255, 123, 28, 0.3)',
    borderWidth: 1,
    borderColor: '#FF7B1C',
  },

  totalStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },

  totalStreakText: {
    fontSize: 11,
    color: '#FFB366',
    fontWeight: theme.typography.weights.medium,
  },
});
