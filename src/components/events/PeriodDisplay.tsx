/**
 * PeriodDisplay - Shows current active period for recurring events
 * Displays date range and reset information
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../styles/theme';
import type { NostrEventDefinition } from '../../types/nostrCompetition';
import {
  getCurrentPeriod,
  formatPeriodRange,
  getNextPeriodStart,
} from '../../utils/eventRecurrence';

interface PeriodDisplayProps {
  event: NostrEventDefinition;
  showNextReset?: boolean;
}

export const PeriodDisplay: React.FC<PeriodDisplayProps> = ({
  event,
  showNextReset = false,
}) => {
  if (!event.recurrence || event.recurrence === 'none') {
    return null;
  }

  const period = getCurrentPeriod(
    event.recurrence,
    event.recurrenceDay,
    event.recurrenceStartDate || event.eventDate,
    event.durationMinutes
  );

  if (!period) {
    return null;
  }

  const periodRangeText = formatPeriodRange(period);
  const nextReset = showNextReset
    ? getNextPeriodStart(
        event.recurrence,
        event.recurrenceDay,
        event.recurrenceStartDate || event.eventDate
      )
    : null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Current Period</Text>
      <Text style={styles.periodText}>{periodRangeText}</Text>
      {showNextReset && nextReset && (
        <Text style={styles.nextResetText}>
          Resets{' '}
          {nextReset.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.cardBackground,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.accent,
    padding: 12,
    borderRadius: 4,
  },

  label: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  periodText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },

  nextResetText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
});
