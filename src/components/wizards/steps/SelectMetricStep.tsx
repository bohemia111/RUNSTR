/**
 * SelectMetricStep - Second step in challenge creation
 * User selects the metric to compete on (distance, duration, reps, etc.)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../../../styles/theme';
import {
  ACTIVITY_METRICS,
  type ActivityType,
  type MetricType,
} from '../../../types/challenge';

interface SelectMetricStepProps {
  activityType: ActivityType;
  selectedMetric?: MetricType;
  onSelectMetric: (metric: MetricType) => void;
}

export const SelectMetricStep: React.FC<SelectMetricStepProps> = ({
  activityType,
  selectedMetric,
  onSelectMetric,
}) => {
  const metricOptions = ACTIVITY_METRICS[activityType] || [];

  return (
    <View style={styles.container}>
      <View style={styles.metricOptions}>
        {metricOptions.map((metric) => (
          <TouchableOpacity
            key={metric.value}
            style={[
              styles.metricOption,
              selectedMetric === metric.value && styles.metricOptionSelected,
            ]}
            onPress={() => onSelectMetric(metric.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.metricLabel,
                selectedMetric === metric.value && styles.metricLabelSelected,
              ]}
            >
              {metric.label}
            </Text>
            <Text style={styles.metricUnit}>{metric.unit}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  metricOptions: {
    gap: 12,
  },
  metricOption: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.border,
  },
  metricLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  metricLabelSelected: {
    color: theme.colors.text,
  },
  metricUnit: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
});
