/**
 * PRComparisonBar - Progress bar showing comparison to personal record
 * Displays time difference and completion percentage with color coding
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

interface PRComparisonBarProps {
  isAhead: boolean; // true = ahead of PR, false = behind
  timeDifference: number; // seconds (positive = behind, negative = ahead)
  percentComplete: number; // 0-100
  isVisible: boolean;
}

export const PRComparisonBar: React.FC<PRComparisonBarProps> = ({
  isAhead,
  timeDifference,
  percentComplete,
  isVisible,
}) => {
  if (!isVisible) {
    return null;
  }

  // Format time difference as +/-M:SS
  const formatTimeDiff = (seconds: number): string => {
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    const sign = seconds <= 0 ? '-' : '+';
    return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const statusText = isAhead ? 'ahead of PR' : 'behind PR';
  const statusColor = isAhead ? '#22c55e' : '#ef4444'; // green or red

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons
          name={isAhead ? 'trending-up' : 'trending-down'}
          size={16}
          color={statusColor}
        />
        <Text style={[styles.timeDiff, { color: statusColor }]}>
          {formatTimeDiff(timeDifference)}
        </Text>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(100, Math.max(0, percentComplete))}%`,
                backgroundColor: statusColor,
              },
            ]}
          />
        </View>
        <Text style={styles.percentText}>{Math.round(percentComplete)}%</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeDiff: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    marginLeft: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    marginLeft: 6,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  percentText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textMuted,
    width: 36,
    textAlign: 'right',
  },
});
