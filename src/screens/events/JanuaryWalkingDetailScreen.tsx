/**
 * JanuaryWalkingDetailScreen - January Walking Contest detail screen
 * Shows event info, leaderboard, and join functionality
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import {
  JANUARY_WALKING_CONFIG,
  getJanuaryWalkingStatus,
  getDaysRemaining,
  getDaysUntilStart,
} from '../../constants/januaryWalking';
import {
  JanuaryWalkingService,
  JanuaryWalkingParticipant,
} from '../../services/challenge/JanuaryWalkingService';
import { useJanuaryWalking } from '../../hooks/useJanuaryWalking';
import { Avatar } from '../../components/ui/Avatar';

interface JanuaryWalkingDetailScreenProps {
  navigation: any;
}

export const JanuaryWalkingDetailScreen: React.FC<JanuaryWalkingDetailScreenProps> = ({
  navigation,
}) => {
  // Use hook for baseline + refresh pattern
  const {
    leaderboard,
    isLoading,
    isBaselineOnly,
    baselineDate,
    refreshAll,
    currentUserPubkey,
  } = useJanuaryWalking();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const userPubkey = currentUserPubkey || null;

  // Check if user has joined (separate from leaderboard loading)
  useEffect(() => {
    const checkJoinStatus = async () => {
      if (currentUserPubkey) {
        const joined = await JanuaryWalkingService.hasJoined(currentUserPubkey);
        setHasJoined(joined);
      }
    };
    checkJoinStatus();
  }, [currentUserPubkey]);

  const handleJoinContest = async () => {
    if (!userPubkey || isJoining) return;

    setIsJoining(true);
    try {
      const success = await JanuaryWalkingService.join(userPubkey);
      if (success) {
        setHasJoined(true);
        // Refresh leaderboard to include user
        await refreshAll();
      }
    } catch (error) {
      console.error('[JanuaryWalkingDetail] Error joining contest:', error);
    } finally {
      setIsJoining(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setImmediate(() => setIsRefreshing(false));
    }
  }, [refreshAll]);

  const status = getJanuaryWalkingStatus();
  const daysRemaining = getDaysRemaining();
  const daysUntilStart = getDaysUntilStart();

  const formatDateRange = () => {
    const start = JANUARY_WALKING_CONFIG.startDate;
    const end = JANUARY_WALKING_CONFIG.endDate;
    const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  const getStatusText = () => {
    switch (status) {
      case 'active':
        return daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Ending today';
      case 'upcoming':
        return daysUntilStart > 0 ? `Starts in ${daysUntilStart} days` : 'Starting soon';
      case 'ended':
        return 'Contest ended';
    }
  };

  const isSeasonParticipant = userPubkey ? JanuaryWalkingService.isSeasonParticipant(userPubkey) : false;

  const renderParticipant = ({ item }: { item: JanuaryWalkingParticipant; index: number }) => {
    const isTop3 = item.rank <= 3;
    const isCurrentUser = userPubkey && item.pubkey === userPubkey;

    return (
      <View style={[styles.participantRow, isCurrentUser && styles.currentUserRow]}>
        <View style={[styles.rankContainer, isTop3 && styles.top3Rank]}>
          {isTop3 ? (
            <Ionicons name="trophy" size={16} color={theme.colors.accent} />
          ) : (
            <Text style={styles.rank}>{item.rank}</Text>
          )}
        </View>
        <Avatar
          imageUrl={item.picture}
          name={item.name}
          size={40}
          style={styles.avatar}
        />
        <View style={styles.participantInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.participantName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.isLocalJoin && (
              <Ionicons
                name="lock-closed"
                size={12}
                color={theme.colors.textMuted}
                style={styles.privateIcon}
              />
            )}
          </View>
          <Text style={styles.participantStats}>
            {item.workoutCount} {item.workoutCount === 1 ? 'walk' : 'walks'}
            {!item.isSeasonParticipant && ' (not eligible for prize)'}
          </Text>
        </View>
        <Text style={[styles.distanceValue, isTop3 && styles.top3Distance]}>
          {Math.round(item.totalDistanceKm || 0).toLocaleString()} steps
        </Text>
      </View>
    );
  };

  // Combine participants with current user entry if needed
  const displayParticipants = [...(leaderboard?.participants || [])];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>January Walking</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
          />
        }
      >
        {/* Banner Image */}
        <Image
          source={JANUARY_WALKING_CONFIG.bannerImage}
          style={styles.bannerImage}
          resizeMode="cover"
        />

        {/* Event Info */}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle}>{JANUARY_WALKING_CONFIG.eventName}</Text>
          <Text style={styles.statusText}>{getStatusText()}</Text>

          {/* Date */}
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={16} color={theme.colors.textMuted} />
            <Text style={styles.metaText}>{formatDateRange()}</Text>
          </View>

          {/* About Text */}
          <View style={styles.aboutSection}>
            <Text style={styles.aboutText}>
              {JANUARY_WALKING_CONFIG.aboutText}
            </Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{JANUARY_WALKING_CONFIG.prizeWinnerCount}</Text>
              <Text style={styles.statLabel}>winners</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{leaderboard?.totalParticipants || 0}</Text>
              <Text style={styles.statLabel}>participants</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{((leaderboard?.totalDistanceKm || 0) / 1000).toFixed(0)}k</Text>
              <Text style={styles.statLabel}>total steps</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {(JANUARY_WALKING_CONFIG.prizeAmountSats * JANUARY_WALKING_CONFIG.prizeWinnerCount / 1000).toFixed(0)}k
              </Text>
              <Text style={styles.statLabel}>sats total</Text>
            </View>
          </View>

          {/* Prize Info */}
          <View style={styles.prizeSection}>
            <Ionicons name="flash" size={20} color={theme.colors.accent} />
            <Text style={styles.prizeText}>
              Top {JANUARY_WALKING_CONFIG.prizeWinnerCount} win {JANUARY_WALKING_CONFIG.prizeAmountSats.toLocaleString()} sats each
            </Text>
          </View>

          {/* Join Button - Show if not joined and contest not ended */}
          {userPubkey && !hasJoined && status !== 'ended' && (
            <TouchableOpacity
              style={styles.joinButton}
              onPress={handleJoinContest}
              disabled={isJoining}
            >
              {isJoining ? (
                <ActivityIndicator size="small" color={theme.colors.text} />
              ) : (
                <>
                  <Ionicons name="walk" size={20} color={theme.colors.text} />
                  <Text style={styles.joinButtonText}>Join Contest</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Joined Badge - Show if already joined */}
          {hasJoined && (
            <View style={styles.joinedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent} />
              <Text style={styles.joinedBadgeText}>
                You're participating!
                {!isSeasonParticipant && ' (Private)'}
              </Text>
            </View>
          )}

          {/* Non-Season II warning */}
          {hasJoined && !isSeasonParticipant && (
            <View style={styles.warningSection}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMuted} />
              <Text style={styles.warningText}>
                You're not a Season II participant, so you're not eligible for the prize.
                Your position is only visible to you.
              </Text>
            </View>
          )}
        </View>

        {/* Leaderboard */}
        <View style={styles.leaderboardSection}>
          <View style={styles.leaderboardTitleRow}>
            <Text style={styles.sectionTitle}>Leaderboard</Text>
            {isBaselineOnly && (
              <Text style={styles.baselineDateText}>{baselineDate}</Text>
            )}
          </View>
          <Text style={styles.sectionSubtitle}>Walking steps only</Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.colors.accent} />
              <Text style={styles.loadingText}>Loading participants...</Text>
            </View>
          ) : displayParticipants.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="walk-outline" size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyText}>No walking data yet</Text>
              <Text style={styles.emptySubtext}>Start walking to appear on the leaderboard!</Text>
            </View>
          ) : (
            <>
              <FlatList
                data={displayParticipants}
                renderItem={renderParticipant}
                keyExtractor={(item) => item.pubkey}
                scrollEnabled={false}
              />

              {/* Show current user's position if not in top 25 */}
              {leaderboard?.currentUserEntry && leaderboard.currentUserRank && leaderboard.currentUserRank > 25 && (
                <View style={styles.currentUserSection}>
                  <Text style={styles.currentUserLabel}>Your Position</Text>
                  {renderParticipant({ item: leaderboard.currentUserEntry, index: leaderboard.currentUserRank - 1 })}
                </View>
              )}
            </>
          )}
        </View>

        {/* Note Section */}
        <View style={styles.noteSection}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMuted} />
          <Text style={styles.noteText}>
            Only Season II participants are shown on the public leaderboard and eligible for prizes.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  bannerImage: {
    width: '100%',
    height: 200,
    backgroundColor: theme.colors.border,
  },
  eventInfo: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.medium,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  metaText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginLeft: 8,
  },
  aboutSection: {
    backgroundColor: 'rgba(255, 157, 66, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  aboutText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  statBox: {
    width: '25%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: theme.typography.weights.bold,
    color: '#FF9D42',
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  prizeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.colors.accent}15`,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  prizeText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.medium,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    paddingVertical: 14,
    marginBottom: 12,
    gap: 8,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  joinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${theme.colors.accent}15`,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
    gap: 8,
  },
  joinedBadgeText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.accent,
  },
  warningSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 8,
    gap: 8,
    marginBottom: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  leaderboardSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  leaderboardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  baselineDateText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  currentUserRow: {
    backgroundColor: `${theme.colors.accent}10`,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  rankContainer: {
    width: 28,
    alignItems: 'center',
  },
  top3Rank: {
    // Trophy icon for top 3
  },
  rank: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textMuted,
  },
  avatar: {
    marginRight: 12,
  },
  participantInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  participantName: {
    fontSize: 15,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  privateIcon: {
    marginLeft: 4,
  },
  participantStats: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  distanceValue: {
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textMuted,
    marginLeft: 8,
  },
  top3Distance: {
    color: '#FF9D42',
  },
  currentUserSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  currentUserLabel: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
  noteSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: theme.colors.cardBackground,
    gap: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
});

export default JanuaryWalkingDetailScreen;
