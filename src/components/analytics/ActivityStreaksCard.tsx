/**
 * ActivityStreaksCard - Display current and best streaks for each activity type
 * Shows only activity types the user has actually done
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import type { ActivityStreak } from '../../services/analytics/StreakAnalyticsService';
import { StreakAnalyticsService } from '../../services/analytics/StreakAnalyticsService';

interface ActivityStreaksCardProps {
  streaks: ActivityStreak[];
}

export const ActivityStreaksCard: React.FC<ActivityStreaksCardProps> = ({
  streaks,
}) => {
  // If no workouts, show empty state
  if (streaks.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons
          name="flame-outline"
          size={48}
          color={theme.colors.textMuted}
        />
        <Text style={styles.emptyText}>
          Start working out to build streaks!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {streaks.map((streak, index) => (
        <View key={streak.activityType}>
          {index > 0 && <View style={styles.divider} />}

          <View style={styles.streakRow}>
            {/* Activity Icon */}
            <View style={styles.iconContainer}>
              <Ionicons name={streak.icon as any} size={24} color="#FF9D42" />
            </View>

            {/* Activity Name */}
            <View style={styles.activityInfo}>
              <Text style={styles.activityName}>
                {StreakAnalyticsService.getActivityDisplayName(
                  streak.activityType
                )}
              </Text>
              <Text style={styles.totalWorkouts}>
                {streak.totalWorkouts} workout
                {streak.totalWorkouts !== 1 ? 's' : ''}
              </Text>
            </View>

            {/* Current Streak */}
            <View style={styles.streakColumn}>
              <View style={styles.streakBadge}>
                {streak.currentStreak > 0 && (
                  <Ionicons name="flame" size={16} color="#FF7B1C" />
                )}
                <Text
                  style={[
                    styles.streakValue,
                    streak.currentStreak === 0 && styles.streakValueInactive,
                  ]}
                >
                  {streak.currentStreak}
                </Text>
              </View>
              <Text style={styles.streakLabel}>Current</Text>
            </View>

            {/* Best Streak */}
            <View style={styles.streakColumn}>
              <View style={styles.streakBadge}>
                <Ionicons name="trophy-outline" size={16} color="#FFB366" />
                <Text style={styles.streakValue}>{streak.bestStreak}</Text>
              </View>
              <Text style={styles.streakLabel}>Best</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 16,
  },

  emptyCard: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 32,
    alignItems: 'center',
  },

  emptyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },

  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },

  divider: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginVertical: 4,
  },

  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  activityInfo: {
    flex: 1,
  },

  activityName: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 2,
  },

  totalWorkouts: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },

  streakColumn: {
    alignItems: 'center',
    marginLeft: 12,
    minWidth: 50,
  },

  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },

  streakValue: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: '#FF9D42',
  },

  streakValueInactive: {
    color: theme.colors.textMuted,
  },

  streakLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
