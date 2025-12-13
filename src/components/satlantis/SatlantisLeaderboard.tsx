/**
 * SatlantisLeaderboard - Event leaderboard with zap capability
 * Any user can zap any participant (not just organizer)
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '../../styles/theme';
import { ZappableUserRow } from '../ui/ZappableUserRow';
import type {
  SatlantisLeaderboardEntry,
  SatlantisEventStatus,
} from '../../types/satlantis';

interface SatlantisLeaderboardProps {
  entries: SatlantisLeaderboardEntry[];
  isLoading: boolean;
  eventStatus: SatlantisEventStatus;
  currentUserNpub?: string;
}

export const SatlantisLeaderboard: React.FC<SatlantisLeaderboardProps> = ({
  entries,
  isLoading,
  eventStatus,
  currentUserNpub,
}) => {
  // Upcoming events - show placeholder
  if (eventStatus === 'upcoming') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Leaderboard</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Leaderboard will appear when the event starts
          </Text>
        </View>
      </View>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Leaderboard</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Loading results...</Text>
        </View>
      </View>
    );
  }

  // No entries - prompt users to join
  if (entries.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Leaderboard</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No participants yet</Text>
          <Text style={styles.emptySubtext}>
            Join the event to appear on the leaderboard!
          </Text>
        </View>
      </View>
    );
  }

  // Leaderboard with entries
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Leaderboard {eventStatus === 'live' ? '(Live)' : '(Final)'}
      </Text>

      {entries.map((entry) => (
        <View key={entry.npub} style={styles.entryRow}>
          {/* Rank */}
          <View style={styles.rankSection}>
            <Text style={[styles.rankText, entry.rank <= 3 && styles.topRank]}>
              {entry.rank}
            </Text>
          </View>

          {/* User with zap button */}
          <View style={styles.userSection}>
            <ZappableUserRow
              npub={entry.npub}
              showQuickZap={entry.npub !== currentUserNpub}
              showChallengeButton={false}
              hideActionsForCurrentUser={entry.npub === currentUserNpub}
              additionalContent={
                <View style={styles.scoreSection}>
                  <Text style={styles.scoreText}>{entry.formattedScore}</Text>
                </View>
              }
              style={styles.userRow}
            />
          </View>
        </View>
      ))}

      {entries.length > 0 && eventStatus === 'live' && (
        <Text style={styles.refreshHint}>
          Updates automatically as workouts are posted
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginTop: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    marginLeft: 8,
    color: theme.colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  emptySubtext: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: 8,
  },
  rankSection: {
    width: 32,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textMuted,
  },
  topRank: {
    color: theme.colors.accent,
  },
  userSection: {
    flex: 1,
  },
  userRow: {
    paddingVertical: 0,
  },
  scoreSection: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accent,
  },
  refreshHint: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});

export default SatlantisLeaderboard;
