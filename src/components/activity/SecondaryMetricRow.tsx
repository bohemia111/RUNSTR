/**
 * SecondaryMetricRow - Row of 2-3 smaller metrics below the hero metric
 * Used for pace/elevation, distance/elevation, etc.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

export interface SecondaryMetric {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface SecondaryMetricRowProps {
  metrics: SecondaryMetric[]; // 2 or 3 items
}

export const SecondaryMetricRow: React.FC<SecondaryMetricRowProps> = ({
  metrics,
}) => {
  return (
    <View style={styles.container}>
      {metrics.map((metric, index) => (
        <View
          key={metric.label}
          style={[
            styles.metricCard,
            index < metrics.length - 1 && styles.metricCardWithMargin,
          ]}
        >
          <Ionicons
            name={metric.icon}
            size={18}
            color={theme.colors.textMuted}
            style={styles.icon}
          />
          <Text style={styles.value}>{metric.value}</Text>
          <Text style={styles.label}>{metric.label}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  metricCardWithMargin: {
    marginRight: 12,
  },
  icon: {
    marginBottom: 6,
  },
  value: {
    fontSize: 22,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
