/**
 * HeroMetric - Large centered metric display for cardio tracking screens
 * Shows primary metric (distance/steps/speed) prominently with optional secondary value
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../styles/theme';

interface HeroMetricProps {
  primaryValue: string; // "5.24" or "1,847"
  primaryUnit: string; // "km" or "steps"
  secondaryValue?: string; // "28:45" (duration)
  secondaryLabel?: string; // "Duration" (optional label under secondary)
}

export const HeroMetric: React.FC<HeroMetricProps> = ({
  primaryValue,
  primaryUnit,
  secondaryValue,
  secondaryLabel,
}) => {
  return (
    <View style={styles.container}>
      {/* Primary Metric (huge) */}
      <View style={styles.primaryContainer}>
        <Text style={styles.primaryValue}>{primaryValue}</Text>
        <Text style={styles.primaryUnit}>{primaryUnit}</Text>
      </View>

      {/* Secondary Metric (large) */}
      {secondaryValue && (
        <View style={styles.secondaryContainer}>
          <Text style={styles.secondaryValue}>{secondaryValue}</Text>
          {secondaryLabel && (
            <Text style={styles.secondaryLabel}>{secondaryLabel}</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  primaryContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryValue: {
    fontSize: 72,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    lineHeight: 80,
    letterSpacing: -2,
  },
  primaryUnit: {
    fontSize: 24,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    marginTop: -4,
  },
  secondaryContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryValue: {
    fontSize: 36,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    letterSpacing: -1,
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
