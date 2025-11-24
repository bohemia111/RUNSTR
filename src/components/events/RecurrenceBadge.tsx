/**
 * RecurrenceBadge - Visual indicator for recurring events
 * Displays recurrence frequency in a compact badge
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../styles/theme';
import type {
  RecurrenceFrequency,
  RecurrenceDay,
} from '../../types/nostrCompetition';
import { formatRecurrenceDisplay } from '../../utils/eventRecurrence';

interface RecurrenceBadgeProps {
  recurrence: RecurrenceFrequency;
  recurrenceDay?: RecurrenceDay;
  size?: 'small' | 'medium';
}

export const RecurrenceBadge: React.FC<RecurrenceBadgeProps> = ({
  recurrence,
  recurrenceDay,
  size = 'small',
}) => {
  if (recurrence === 'none' || !recurrence) {
    return null;
  }

  const displayText = formatRecurrenceDisplay(recurrence, recurrenceDay);

  return (
    <View style={[styles.badge, size === 'medium' && styles.badgeMedium]}>
      <Text
        style={[styles.badgeText, size === 'medium' && styles.badgeTextMedium]}
      >
        {displayText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },

  badgeMedium: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  badgeText: {
    color: theme.colors.background,
    fontSize: 10,
    fontWeight: theme.typography.weights.semiBold,
    textTransform: 'uppercase',
  },

  badgeTextMedium: {
    fontSize: 11,
  },
});
