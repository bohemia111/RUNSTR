/**
 * ActivePledgeCard - Displays current pledge progress in RewardsScreen
 *
 * Shows:
 * - Event name
 * - Progress bar with workout count
 * - Recipient name (captain or charity)
 * - Remaining workouts and sats
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { theme } from '../../styles/theme';
import type { Pledge } from '../../types/pledge';

interface ActivePledgeCardProps {
  pledge: Pledge;
  satsPerWorkout?: number;
}

export const ActivePledgeCard: React.FC<ActivePledgeCardProps> = ({
  pledge,
  satsPerWorkout = 50,
}) => {
  const remaining = pledge.totalWorkouts - pledge.completedWorkouts;
  const remainingSats = remaining * satsPerWorkout;
  const progressPercent = Math.round(
    (pledge.completedWorkouts / pledge.totalWorkouts) * 100
  );

  // Determine icon based on destination type
  const destinationIcon =
    pledge.destinationType === 'charity' ? 'heart' : 'person';

  return (
    <Card style={styles.card}>
      {/* Header Row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons
            name="flag"
            size={18}
            color={theme.colors.orangeBright}
            style={styles.headerIcon}
          />
          <Text style={styles.eventName} numberOfLines={1}>
            {pledge.eventName}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${progressPercent}%` }]}
          />
        </View>
        <Text style={styles.progressText}>
          {pledge.completedWorkouts}/{pledge.totalWorkouts} workouts
        </Text>
      </View>

      {/* Destination Info */}
      <View style={styles.destinationRow}>
        <Ionicons
          name={destinationIcon}
          size={16}
          color={theme.colors.textMuted}
          style={styles.destinationIcon}
        />
        <Text style={styles.destinationLabel}>Rewards going to:</Text>
        <Text style={styles.destinationName} numberOfLines={1}>
          {pledge.destinationName}
        </Text>
      </View>

      {/* Remaining Info */}
      <View style={styles.remainingRow}>
        <Ionicons
          name="flash"
          size={16}
          color={theme.colors.orangeBright}
          style={styles.remainingIcon}
        />
        <Text style={styles.remainingText}>
          {remaining} workout{remaining !== 1 ? 's' : ''} remaining (
          {remainingSats.toLocaleString()} sats)
        </Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.orangeDeep,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    marginRight: 8,
  },
  eventName: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    flex: 1,
  },

  // Progress
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.orangeBright,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    textAlign: 'center',
  },

  // Destination
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  destinationIcon: {
    marginRight: 6,
  },
  destinationLabel: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginRight: 4,
  },
  destinationName: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    flex: 1,
  },

  // Remaining
  remainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 157, 66, 0.1)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  remainingIcon: {
    marginRight: 8,
  },
  remainingText: {
    fontSize: 13,
    color: theme.colors.text,
  },
});

export default ActivePledgeCard;
