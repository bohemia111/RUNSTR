/**
 * WeeklySummaryAccordion - Collapsible weekly breakdown by category
 * Shows diet/strength/cardio/wellness summaries in expandable sections
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import type { LocalWorkout } from '../../services/fitness/LocalWorkoutStorageService';

interface WeeklySummaryAccordionProps {
  workouts: LocalWorkout[];
}

interface SectionData {
  title: string;
  icon: string;
  color: string;
  stats: { label: string; value: string }[];
}

export const WeeklySummaryAccordion: React.FC<WeeklySummaryAccordionProps> = ({
  workouts,
}) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Calculate weekly stats for each category
  const weeklyStats = calculateWeeklyStats(workouts);

  const sections: SectionData[] = [
    {
      title: 'Diet Breakdown',
      icon: 'restaurant-outline',
      color: '#FF9D42', // Orange theme
      stats: [
        { label: 'Total Calories In', value: `${weeklyStats.diet.caloriesIn.toLocaleString()} cal` },
        { label: 'Total Calories Out', value: `${weeklyStats.caloriesOut.toLocaleString()} cal` },
        { label: 'Meals Logged', value: `${weeklyStats.diet.mealCount} meals` },
        { label: 'Avg Calories/Day', value: `${Math.round(weeklyStats.diet.caloriesIn / 7).toLocaleString()} cal` },
      ],
    },
    {
      title: 'Strength Breakdown',
      icon: 'barbell-outline',
      color: '#FF9D42', // Orange theme
      stats: [
        { label: 'Total Workouts', value: weeklyStats.strength.topExercise },
        { label: 'Total Volume', value: `${weeklyStats.strength.totalVolume.toLocaleString()} reps` },
        { label: 'Avg Volume/Session', value: `${weeklyStats.strength.avgVolume} reps` },
        { label: 'Avg Sets×Reps', value: weeklyStats.strength.avgVolume > 0 ? `${Math.round(weeklyStats.strength.avgVolume / 3)}×3` : 'N/A' },
      ],
    },
    {
      title: 'Cardio Breakdown',
      icon: 'walk-outline',
      color: '#FF9D42', // Orange theme
      stats: [
        { label: 'Total Distance', value: `${(weeklyStats.cardio.totalDistance / 1000).toFixed(1)} km` },
        { label: 'Total Time', value: formatDuration(weeklyStats.cardio.totalDuration) },
        { label: 'Avg Pace', value: weeklyStats.cardio.avgPace },
        { label: 'Most Frequent Activity', value: weeklyStats.cardio.topActivity },
      ],
    },
    {
      title: 'Wellness Breakdown',
      icon: 'flower-outline',
      color: '#FF9D42', // Orange theme
      stats: [
        { label: 'Meditation Sessions', value: `${weeklyStats.wellness.meditationCount} sessions` },
        { label: 'Total Minutes', value: `${Math.round(weeklyStats.wellness.totalMinutes)} min` },
        { label: 'Avg Session Length', value: `${weeklyStats.wellness.avgSessionLength} min` },
        { label: 'Consistency', value: `${weeklyStats.wellness.consistency}%` },
      ],
    },
  ];

  const toggleSection = (title: string) => {
    setExpandedSection(expandedSection === title ? null : title);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Weekly Summary</Text>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection(section.title)}
            activeOpacity={0.7}
          >
            <View style={styles.headerLeft}>
              <Ionicons name={section.icon as any} size={24} color={section.color} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <Ionicons
              name={expandedSection === section.title ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>

          {expandedSection === section.title && (
            <View style={styles.sectionContent}>
              {section.stats.map((stat, index) => (
                <View key={index} style={styles.statRow}>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <Text style={[styles.statValue, { color: section.color }]}>
                    {stat.value}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

// Helper Functions

function calculateWeeklyStats(workouts: LocalWorkout[]) {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const weekWorkouts = workouts.filter((w) => {
    const workoutDate = new Date(w.startTime);
    return workoutDate >= weekAgo && workoutDate <= now;
  });

  // Diet stats
  const dietWorkouts = weekWorkouts.filter((w) => w.type === 'diet');
  const caloriesIn = dietWorkouts.reduce((sum, w) => sum + (w.calories || 0), 0);
  const mealCount = dietWorkouts.length;

  // Calculate total calories out from ALL workout types (not just diet)
  const caloriesOut = weekWorkouts.reduce((sum, w) => {
    if (w.type === 'diet' || w.type === 'fasting') {
      return sum; // Diet doesn't burn calories, fasting is excluded
    }
    return sum + (w.calories || 0);
  }, 0);

  // Strength stats
  const strengthWorkouts = weekWorkouts.filter((w) => w.type === 'strength');
  const totalVolume = strengthWorkouts.reduce((sum, w) => {
    const reps = w.reps || 0;
    const sets = w.sets || 1;
    return sum + (reps * sets);
  }, 0);
  const avgVolume = strengthWorkouts.length > 0 ? Math.round(totalVolume / strengthWorkouts.length) : 0;

  // For exercise tracking, use notes if available, otherwise just count total sessions
  const topExercise = strengthWorkouts.length > 0
    ? `${strengthWorkouts.length} session${strengthWorkouts.length > 1 ? 's' : ''}`
    : 'N/A';

  // Cardio stats
  const cardioTypes = ['running', 'walking', 'cycling', 'hiking', 'swimming', 'rowing'];
  const cardioWorkouts = weekWorkouts.filter((w) => cardioTypes.includes(w.type));
  const totalDistance = cardioWorkouts.reduce((sum, w) => sum + (w.distance || 0), 0);
  const totalDuration = cardioWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);
  const avgPace = totalDistance > 0 && totalDuration > 0
    ? `${((totalDuration / 60) / (totalDistance / 1000)).toFixed(1)} min/km`
    : 'N/A';
  const cardioTypeCounts: Record<string, number> = {};
  cardioWorkouts.forEach((w) => {
    cardioTypeCounts[w.type] = (cardioTypeCounts[w.type] || 0) + 1;
  });
  const topActivity = Object.keys(cardioTypeCounts).length > 0
    ? Object.entries(cardioTypeCounts).sort(([, a], [, b]) => b - a)[0][0]
    : 'N/A';

  // Wellness stats
  const meditationWorkouts = weekWorkouts.filter((w) => w.type === 'meditation');
  const totalMinutes = meditationWorkouts.reduce((sum, w) => sum + ((w.duration || 0) / 60), 0);
  const avgSessionLength = meditationWorkouts.length > 0
    ? Math.round(totalMinutes / meditationWorkouts.length)
    : 0;

  // Calculate consistency (% of days with meditation)
  const uniqueDays = new Set(
    meditationWorkouts.map((w) => new Date(w.startTime).toLocaleDateString('en-CA'))
  );
  const consistency = Math.round((uniqueDays.size / 7) * 100);

  return {
    caloriesOut, // Total calories burned from all workouts (not just diet)
    diet: {
      caloriesIn,
      mealCount,
    },
    strength: {
      workoutCount: strengthWorkouts.length,
      totalVolume,
      avgVolume,
      topExercise,
    },
    cardio: {
      totalDistance,
      totalDuration,
      avgPace,
      topActivity,
    },
    wellness: {
      meditationCount: meditationWorkouts.length,
      totalMinutes,
      avgSessionLength,
      consistency,
    },
  };
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },

  heading: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 12,
  },

  section: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },

  sectionContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },

  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  statLabel: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },

  statValue: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semiBold,
  },
});
