/**
 * SatlantisLeaderboard - Event leaderboard with zap capability
 * Any user can zap any participant (not just organizer)
 *
 * Privacy model:
 * - Season II participants (public): visible to all users
 * - Non-Season II participants (private): visible only to themselves, marked with 🔒 icon
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { ZappableUserRow } from '../ui/ZappableUserRow';
import type {
  SatlantisLeaderboardEntry,
  SatlantisEventStatus,
} from '../../types/satlantis';

const MAX_DISPLAY = 25;

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
  // Calculate top 25 + user position if outside top 25
  const { topEntries, userEntryOutsideTop, userRank } = useMemo(() => {
    const top = entries.slice(0, MAX_DISPLAY);

    if (!currentUserNpub) {
      return { topEntries: top, userEntryOutsideTop: null, userRank: -1 };
    }

    // Find user's rank in full list
    const userIndex = entries.findIndex(e => e.npub === currentUserNpub);
    const userRankValue = userIndex >= 0 ? userIndex + 1 : -1;

    // If user is in top 25 or not found, just return top 25
    if (userIndex < 0 || userIndex < MAX_DISPLAY) {
      return { topEntries: top, userEntryOutsideTop: null, userRank: userRankValue };
    }

    // User is outside top 25, include their entry
    return {
      topEntries: top,
      userEntryOutsideTop: entries[userIndex],
      userRank: userRankValue,
    };
  }, [entries, currentUserNpub]);
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

      {/* Top 25 entries */}
      {topEntries.map((entry) => (
        <View key={entry.npub} style={[styles.entryRow, entry.isPrivate && styles.privateEntry]}>
          {/* Rank */}
          <View style={styles.rankSection}>
            {entry.isPrivate && (
              <Ionicons
                name="lock-closed"
                size={12}
                color={theme.colors.textMuted}
                style={styles.lockIcon}
              />
            )}
            <Text style={[styles.rankText, entry.rank <= 3 && styles.topRank]}>
              {entry.rank}
            </Text>
          </View>

          {/* User with zap button */}
          <View style={styles.userSection}>
            <ZappableUserRow
              npub={entry.npub}
              showQuickZap={entry.npub !== currentUserNpub}
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

      {/* User position section (if outside top 25) */}
      {userEntryOutsideTop && userRank > 0 && (
        <>
          {/* Separator */}
          <View style={styles.userPositionSeparator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>Your position</Text>
            <View style={styles.separatorLine} />
          </View>

          {/* User's entry */}
          <View style={[styles.entryRow, styles.userPositionRow, userEntryOutsideTop.isPrivate && styles.privateEntry]}>
            <View style={styles.rankSection}>
              {userEntryOutsideTop.isPrivate && (
                <Ionicons
                  name="lock-closed"
                  size={12}
                  color={theme.colors.textMuted}
                  style={styles.lockIcon}
                />
              )}
              <Text style={styles.rankText}>{userRank}</Text>
            </View>
            <View style={styles.userSection}>
              <ZappableUserRow
                npub={userEntryOutsideTop.npub}
                showQuickZap={false}
                hideActionsForCurrentUser={true}
                additionalContent={
                  <View style={styles.scoreSection}>
                    <Text style={styles.scoreText}>{userEntryOutsideTop.formattedScore}</Text>
                  </View>
                }
                style={styles.userRow}
              />
            </View>
          </View>
        </>
      )}

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
  privateEntry: {
    opacity: 0.85,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  rankSection: {
    width: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  lockIcon: {
    marginRight: 2,
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
  userPositionSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  separatorText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginHorizontal: 8,
    textTransform: 'uppercase',
  },
  userPositionRow: {
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 140, 0, 0.1)',
    paddingHorizontal: 8,
  },
});

export default SatlantisLeaderboard;
