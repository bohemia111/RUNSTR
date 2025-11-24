/**
 * RoutePRComparison - Real-time comparison with personal record on a route
 * Shows if user is ahead or behind their best time
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

interface RoutePRComparisonProps {
  isAheadOfPR: boolean;
  timeDifference: number; // seconds (+) ahead, (-) behind
  percentComplete: number; // 0-100
  estimatedFinishTime: number; // seconds
  prFinishTime: number; // seconds
  isVisible: boolean;
}

export const RoutePRComparison: React.FC<RoutePRComparisonProps> = ({
  isAheadOfPR,
  timeDifference,
  percentComplete,
  estimatedFinishTime,
  prFinishTime,
  isVisible,
}) => {
  if (!isVisible) return null;

  const formatTimeDifference = (seconds: number): string => {
    const absSeconds = Math.abs(seconds);
    const minutes = Math.floor(absSeconds / 60);
    const secs = Math.floor(absSeconds % 60);

    if (minutes > 0) {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    return `0:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    return isAheadOfPR ? theme.colors.text : theme.colors.orangeBright;
  };

  const getStatusIcon = (): keyof typeof Ionicons.glyphMap => {
    return isAheadOfPR ? 'trending-up' : 'trending-down';
  };

  const getStatusText = () => {
    const timeDiff = formatTimeDifference(timeDifference);
    return isAheadOfPR ? `${timeDiff} ahead of PR` : `${timeDiff} behind PR`;
  };

  return (
    <View style={styles.container}>
      {/* Main Status */}
      <View style={[styles.statusCard, { borderColor: getStatusColor() }]}>
        <Ionicons name={getStatusIcon()} size={20} color={getStatusColor()} />
        <View style={styles.statusTextContainer}>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
          <Text style={styles.progressText}>
            {Math.round(percentComplete)}% complete
          </Text>
        </View>
      </View>

      {/* Time Estimates */}
      <View style={styles.timeEstimates}>
        <View style={styles.timeItem}>
          <Text style={styles.timeLabel}>Est. Finish</Text>
          <Text style={styles.timeValue}>
            {formatTime(estimatedFinishTime)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.timeItem}>
          <Text style={styles.timeLabel}>PR Time</Text>
          <Text style={styles.timeValue}>{formatTime(prFinishTime)}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${percentComplete}%`,
              backgroundColor: getStatusColor(),
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    gap: 12,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  timeEstimates: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timeItem: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  divider: {
    width: 1,
    backgroundColor: theme.colors.border,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
});
