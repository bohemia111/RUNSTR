/**
 * CorrelationInsightCard - Display single correlation insight
 * Shows relationship between two fitness metrics
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import type { CorrelationData } from '../../types/analytics';

interface CorrelationInsightCardProps {
  title: string;
  correlation: CorrelationData;
  icon?: keyof typeof Ionicons.glyphMap;
}

export const CorrelationInsightCard: React.FC<CorrelationInsightCardProps> = ({
  title,
  correlation,
  icon = 'link',
}) => {
  // Get color based on correlation strength and direction
  const getCorrelationColor = () => {
    if (correlation.strength === 'strong') return '#FFB366'; // Light orange for strong
    if (correlation.strength === 'moderate') return '#FF9D42';
    return theme.colors.textMuted;
  };

  const getStrengthLabel = () => {
    return `${
      correlation.strength.charAt(0).toUpperCase() +
      correlation.strength.slice(1)
    } ${correlation.direction} correlation`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name={icon} size={20} color="#FF9D42" />
        <Text style={styles.title}>{title}</Text>
      </View>

      <Text style={[styles.strengthLabel, { color: getCorrelationColor() }]}>
        {getStrengthLabel()}
        {correlation.coefficient !== 0 &&
          ` (${correlation.coefficient.toFixed(2)})`}
      </Text>

      <Text style={styles.insight}>{correlation.insight}</Text>
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
    marginBottom: 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },

  title: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semiBold,
    color: '#FFB366',
  },

  strengthLabel: {
    fontSize: 13,
    fontWeight: theme.typography.weights.medium,
    marginBottom: 6,
  },

  insight: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});
