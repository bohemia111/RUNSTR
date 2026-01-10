/**
 * DailyLeaderboardCard - Preview card for daily leaderboards on team page
 * Orange/black theme matching RUNSTR design system
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import type { LeaderboardEntry } from '../../services/competition/SimpleLeaderboardService';
import { ZappableUserRow } from '../ui/ZappableUserRow';

interface DailyLeaderboardCardProps {
  title: string; // "5K Today"
  distance: string; // "5km"
  participants: number; // 7
  entries: LeaderboardEntry[]; // Top 25 + user position if outside top 25
  onPress: () => void;
  onShare?: () => void; // Callback to open share modal
  currentUserPubkey?: string; // For highlighting user's row
  maxDisplay?: number; // Max entries to display (default 25)
  participantLabel?: string; // "runner" or "walker" - defaults to "runner"
}

export const DailyLeaderboardCard: React.FC<DailyLeaderboardCardProps> = ({
  title,
  distance,
  participants,
  entries,
  onPress,
  onShare,
  currentUserPubkey: _currentUserPubkey, // Reserved for future use
  maxDisplay = 25,
  participantLabel = 'runner',
}) => {
  const handleShare = (e: any) => {
    e.stopPropagation(); // Prevent triggering onPress
    onShare?.();
  };

  // Split entries into top N and user position (if outside top N)
  const topEntries = entries.slice(0, maxDisplay);
  const userEntryOutsideTopN = entries.length > maxDisplay ? entries[entries.length - 1] : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="trophy" size={20} color={theme.colors.accent} />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.distance}>{distance}</Text>
        </View>
        {onShare && (
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Ionicons name="share-outline" size={20} color={theme.colors.accent} />
          </TouchableOpacity>
        )}
        <Ionicons
          name="chevron-forward"
          size={20}
          color={theme.colors.textMuted}
        />
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="people" size={16} color={theme.colors.textMuted} />
          <Text style={styles.statText}>
            {participants} {participants === 1 ? participantLabel : `${participantLabel}s`}
          </Text>
        </View>
      </View>

      {/* Top Runners List */}
      {topEntries.map((entry, index) => (
        <View key={entry.npub + index} style={styles.runnerRow}>
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>{entry.rank}</Text>
          </View>
          <View style={styles.userRowContainer}>
            <ZappableUserRow
              npub={entry.npub}
              fallbackName={entry.name}
              showQuickZap={true}
              zapAmount={21}
              recipientLightningAddress={entry.lightningAddress}
            />
          </View>
          <Text style={styles.runnerTime}>{entry.formattedScore}</Text>
        </View>
      ))}

      {/* User position section (if outside top N) */}
      {userEntryOutsideTopN && (
        <>
          {/* Separator */}
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>Your position</Text>
            <View style={styles.separatorLine} />
          </View>

          {/* User's entry with optional lock icon */}
          <View style={[styles.runnerRow, styles.userPositionRow]}>
            {/* Lock icon for private participation */}
            {(userEntryOutsideTopN as any).isPrivate && (
              <Ionicons
                name="lock-closed"
                size={12}
                color={theme.colors.textMuted}
                style={styles.lockIcon}
              />
            )}
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{userEntryOutsideTopN.rank}</Text>
            </View>
            <View style={styles.userRowContainer}>
              <ZappableUserRow
                npub={userEntryOutsideTopN.npub}
                fallbackName={userEntryOutsideTopN.name}
                showQuickZap={false}
                hideActionsForCurrentUser={true}
              />
            </View>
            <Text style={styles.runnerTime}>{userEntryOutsideTopN.formattedScore}</Text>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0a0a0a', // Dark card background
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 140, 0, 0.1)', // Orange tint
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  shareButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FF8C00', // Orange theme
    marginBottom: 2,
  },
  distance: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginLeft: 6,
  },
  runnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 140, 0, 0.05)', // Subtle orange background
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF8C00', // Orange - consistent with app theme
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000', // Black text on orange
  },
  userRowContainer: {
    flex: 1,
    marginRight: 10,
  },
  runnerTime: {
    fontSize: 14,
    color: '#FF8C00', // Orange
    fontWeight: '600',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 8,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1a1a1a',
  },
  separatorText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginHorizontal: 8,
    textTransform: 'uppercase',
  },
  userPositionRow: {
    borderWidth: 1,
    borderColor: '#FF8C00',
    backgroundColor: 'rgba(255, 140, 0, 0.1)',
  },
  lockIcon: {
    marginRight: 6,
  },
});
