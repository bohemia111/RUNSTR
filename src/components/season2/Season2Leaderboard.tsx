/**
 * Season2Leaderboard - User leaderboard component
 * Shows participants ranked by total distance with charity attribution
 */

import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { theme } from '../../styles/theme';
import { ZappableUserRow } from '../ui/ZappableUserRow';
import type { Season2Participant } from '../../types/season2';

interface Season2LeaderboardProps {
  participants: Season2Participant[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export const Season2Leaderboard: React.FC<Season2LeaderboardProps> = ({
  participants,
  isLoading = false,
  emptyMessage = 'No participants yet',
}) => {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
        <Text style={styles.loadingText}>Loading leaderboard...</Text>
      </View>
    );
  }

  if (participants.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  const renderItem = ({
    item,
    index,
  }: {
    item: Season2Participant;
    index: number;
  }) => {
    const rank = index + 1;
    const formattedDistance = formatDistance(item.totalDistance);

    return (
      <View style={styles.row}>
        {/* Rank */}
        <View
          style={[
            styles.rankContainer,
            rank <= 3 && styles.topRank,
            rank === 1 && styles.firstPlace,
          ]}
        >
          <Text style={[styles.rankText, rank <= 3 && styles.topRankText]}>
            {rank}
          </Text>
        </View>

        {/* User info with stats below */}
        <View style={styles.userContainer}>
          <ZappableUserRow
            npub={item.npub || item.pubkey}
            fallbackName={item.name}
            showQuickZap={false}
            showChallengeButton={false}
          />
          {/* Stats row below the name */}
          <View style={styles.statsRow}>
            <Text style={styles.distanceText}>{formattedDistance}</Text>
            {item.charityName && (
              <Text style={styles.charityText}>• {item.charityName}</Text>
            )}
            {item.isLocalJoin && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>Pending</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>LEADERBOARD</Text>
      <FlatList
        data={participants}
        keyExtractor={(item) => item.pubkey}
        renderItem={renderItem}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
};

/**
 * Format distance in km for display
 */
function formatDistance(km: number): string {
  if (km >= 1000) {
    return `${(km / 1000).toFixed(1)}k km`;
  }
  if (km >= 100) {
    return `${km.toFixed(0)} km`;
  }
  return `${km.toFixed(1)} km`;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.large,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: theme.typography.weights.semiBold,
    letterSpacing: 1,
    marginBottom: 12,
  },
  loadingContainer: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.large,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginTop: 8,
  },
  emptyContainer: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.large,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rankContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  topRank: {
    backgroundColor: theme.colors.accent,
  },
  firstPlace: {
    backgroundColor: theme.colors.orangeBright,
  },
  rankText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: theme.typography.weights.semiBold,
  },
  topRankText: {
    color: theme.colors.background,
  },
  userContainer: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 44, // Align with name (avatar 36 + margin 8)
    marginTop: -4,
    paddingBottom: 4,
  },
  distanceText: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
  },
  charityText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  pendingBadge: {
    backgroundColor: theme.colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingText: {
    color: theme.colors.textMuted,
    fontSize: 10,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
});

export default Season2Leaderboard;
