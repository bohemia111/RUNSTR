/**
 * RunningBitcoinDetailScreen - Running Bitcoin Challenge detail screen
 * Shows event info, leaderboard, and donate button
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
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { theme } from '../../styles/theme';
import {
  RUNNING_BITCOIN_CONFIG,
  getRunningBitcoinStatus,
  getDaysRemaining,
} from '../../constants/runningBitcoin';
import {
  RunningBitcoinService,
  type RunningBitcoinParticipant,
} from '../../services/challenge/RunningBitcoinService';
import { Avatar } from '../../components/ui/Avatar';
import { useRunningBitcoin } from '../../hooks/useRunningBitcoin';
import { RewardLightningAddressService } from '../../services/rewards/RewardLightningAddressService';

// Storage key for tracking share completion
const SHARE_COMPLETION_KEY = '@runstr:running_bitcoin_shared';

interface RunningBitcoinDetailScreenProps {
  navigation: any;
}

export const RunningBitcoinDetailScreen: React.FC<RunningBitcoinDetailScreenProps> = ({
  navigation,
}) => {
  // Use the hook for state management and fast refresh
  const {
    leaderboard,
    isLoading,
    refreshAll,
    currentUserPubkey,
    hasJoined,
    joinChallenge,
  } = useRunningBitcoin();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [hasSharedCompletion, setHasSharedCompletion] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [hasLightningAddress, setHasLightningAddress] = useState(false);

  // Get current user's participant data
  const currentUserParticipant = leaderboard?.participants.find(
    p => p.pubkey === currentUserPubkey
  );
  const isFinisher = currentUserParticipant?.isFinisher ?? false;

  // Check if user has shared completion and has Lightning address
  useEffect(() => {
    const checkStatus = async () => {
      if (!currentUserPubkey) return;

      // Check if already shared
      try {
        const sharedUsers = await AsyncStorage.getItem(SHARE_COMPLETION_KEY);
        const parsed = sharedUsers ? JSON.parse(sharedUsers) : [];
        setHasSharedCompletion(parsed.includes(currentUserPubkey));
      } catch (error) {
        console.error('[RunningBitcoinDetail] Error checking share status:', error);
      }

      // Check if has Lightning address
      const hasLn = await RewardLightningAddressService.hasRewardLightningAddress();
      setHasLightningAddress(hasLn);
    };
    checkStatus();
  }, [currentUserPubkey]);

  const handleJoinChallenge = async () => {
    if (!currentUserPubkey || isJoining) return;

    setIsJoining(true);
    try {
      await joinChallenge();
    } catch (error) {
      console.error('[RunningBitcoinDetail] Error joining challenge:', error);
    } finally {
      setIsJoining(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshAll();
    // Use setImmediate to bypass iOS timer blocking
    setImmediate(() => setIsRefreshing(false));
  }, [refreshAll]);

  const handleDonate = () => {
    Linking.openURL(RUNNING_BITCOIN_CONFIG.donateUrl);
  };

  const handleShareCompletion = async () => {
    if (!currentUserPubkey || isSharing || hasSharedCompletion) return;

    // Check if user has Lightning address for reward
    if (!hasLightningAddress) {
      Alert.alert(
        'Lightning Address Required',
        'Please set up your Lightning address in Settings to receive your 1,000 sats reward!',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Settings',
            onPress: () => navigation.navigate('Settings'),
          },
        ]
      );
      return;
    }

    setIsSharing(true);

    try {
      // Step 1: Post completion to Nostr
      console.log('[RunningBitcoinDetail] Sharing completion...');

      // For now, we'll call the service to handle posting and payment
      const result = await RunningBitcoinService.shareCompletionAndClaimReward(currentUserPubkey);

      if (result.success) {
        // Mark as shared locally
        const sharedUsers = await AsyncStorage.getItem(SHARE_COMPLETION_KEY);
        const parsed = sharedUsers ? JSON.parse(sharedUsers) : [];
        parsed.push(currentUserPubkey);
        await AsyncStorage.setItem(SHARE_COMPLETION_KEY, JSON.stringify(parsed));
        setHasSharedCompletion(true);

        Toast.show({
          type: 'success',
          text1: 'Shared! 🎉',
          text2: result.rewardPaid
            ? 'Your completion is posted and 1,000 sats are on the way!'
            : 'Your completion is posted to Nostr!',
          position: 'bottom',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Share Failed',
          text2: result.error || 'Please try again',
          position: 'bottom',
        });
      }
    } catch (error) {
      console.error('[RunningBitcoinDetail] Share error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to share completion',
        position: 'bottom',
      });
    } finally {
      setIsSharing(false);
    }
  };

  const status = getRunningBitcoinStatus();
  const daysRemaining = getDaysRemaining();

  const formatDateRange = () => {
    const start = RUNNING_BITCOIN_CONFIG.startDate;
    const end = RUNNING_BITCOIN_CONFIG.endDate;
    const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  const getStatusText = () => {
    switch (status) {
      case 'active':
        return daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Ending today';
      case 'upcoming':
        return 'Coming soon';
      case 'ended':
        return 'Challenge ended';
    }
  };

  // Show all participants from baseline (demo baseline may have finishers with distance=0)
  const activeParticipants = leaderboard?.participants || [];
  const finisherCount = leaderboard?.finishers.length || 0;

  const renderParticipant = ({ item, index }: { item: RunningBitcoinParticipant; index: number }) => {
    const progressPercent = Math.min(100, (item.totalDistanceKm / RUNNING_BITCOIN_CONFIG.goalDistanceKm) * 100);

    return (
      <View style={styles.participantRow}>
        <Text style={styles.rank}>{index + 1}</Text>
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
            {item.isFinisher && (
              <View style={styles.finisherBadge}>
                <Ionicons
                  name={item.finisherRank && item.finisherRank <= 21 ? 'trophy' : 'checkmark-circle'}
                  size={16}
                  color={theme.colors.accent}
                />
              </View>
            )}
          </View>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.participantStats}>
            {item.totalDistanceKm.toFixed(1)} / {RUNNING_BITCOIN_CONFIG.goalDistanceKm} km • {item.workoutCount} workouts
          </Text>
          {item.isLocalJoin && (
            <View style={styles.privateIndicator}>
              <Ionicons
                name="lock-closed"
                size={12}
                color={theme.colors.textMuted}
              />
              <Text style={styles.privateText}>Competing privately</Text>
            </View>
          )}
        </View>
        <Text style={styles.distanceValue}>
          {item.totalDistanceKm.toFixed(1)} km
        </Text>
      </View>
    );
  };

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
        <Text style={styles.headerTitle}>Running Bitcoin</Text>
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
          source={RUNNING_BITCOIN_CONFIG.bannerImage}
          style={styles.bannerImage}
          resizeMode="contain"
        />

        {/* Event Info */}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle}>{RUNNING_BITCOIN_CONFIG.eventName}</Text>
          <Text style={styles.statusText}>{getStatusText()}</Text>

          {/* Date */}
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={16} color={theme.colors.textMuted} />
            <Text style={styles.metaText}>{formatDateRange()}</Text>
          </View>

          {/* Memorial Text */}
          <View style={styles.memorialSection}>
            <Text style={styles.memorialText}>
              "Running Bitcoin" - Hal Finney's tweet on January 10, 2009, marked the first Bitcoin
              transaction after Satoshi. This challenge honors his legacy and supports ALS research.
            </Text>
          </View>

          {/* Goal Stats - Simplified: just goal and finishers */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{RUNNING_BITCOIN_CONFIG.goalDistanceKm}</Text>
              <Text style={styles.statLabel}>km goal</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{finisherCount}</Text>
              <Text style={styles.statLabel}>finishers</Text>
            </View>
          </View>

          {/* Prize Info */}
          <View style={styles.prizeSection}>
            <Ionicons name="flash" size={20} color={theme.colors.accent} />
            <Text style={styles.prizeText}>
              All users who complete the challenge will earn {RUNNING_BITCOIN_CONFIG.finisherRewardSats.toLocaleString()} sats
            </Text>
          </View>

          {/* Join Button - Show if not joined and challenge not ended */}
          {currentUserPubkey && !hasJoined && status !== 'ended' && (
            <TouchableOpacity
              style={styles.joinButton}
              onPress={handleJoinChallenge}
              disabled={isJoining}
            >
              {isJoining ? (
                <ActivityIndicator size="small" color={theme.colors.text} />
              ) : (
                <>
                  <Ionicons name="fitness" size={20} color={theme.colors.text} />
                  <Text style={styles.joinButtonText}>Join Challenge</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Joined Badge - Show if already joined */}
          {hasJoined && (
            <View style={styles.joinedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent} />
              <Text style={styles.joinedBadgeText}>You're participating!</Text>
            </View>
          )}

          {/* Share Completion Button - Show for finishers who haven't shared yet */}
          {isFinisher && !hasSharedCompletion && (
            <TouchableOpacity
              style={styles.shareCompletionButton}
              onPress={handleShareCompletion}
              disabled={isSharing}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name="trophy" size={20} color="#000" />
                  <Text style={styles.shareCompletionButtonText}>
                    Share & Claim 1,000 Sats
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Already Shared Badge */}
          {isFinisher && hasSharedCompletion && (
            <View style={styles.sharedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
              <Text style={styles.sharedBadgeText}>Reward Claimed!</Text>
            </View>
          )}

          {/* Donate Button */}
          <TouchableOpacity style={styles.donateButton} onPress={handleDonate}>
            <Ionicons name="heart" size={20} color="#000" />
            <Text style={styles.donateButtonText}>Donate to ALS Network</Text>
          </TouchableOpacity>
        </View>

        {/* Leaderboard */}
        <View style={styles.leaderboardSection}>
          <Text style={styles.sectionTitle}>Leaderboard</Text>
          <Text style={styles.sectionSubtitle}>Running + Walking combined</Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.colors.accent} />
              <Text style={styles.loadingText}>Loading participants...</Text>
            </View>
          ) : activeParticipants.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="fitness-outline" size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyText}>No workouts logged yet</Text>
              <Text style={styles.emptySubtext}>Start running or walking to appear on the leaderboard!</Text>
            </View>
          ) : (
            <FlatList
              data={activeParticipants}
              renderItem={renderParticipant}
              keyExtractor={(item) => item.pubkey}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Eligible Activities Note */}
        <View style={styles.noteSection}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMuted} />
          <Text style={styles.noteText}>
            Running and walking workouts from Season II participants count toward this challenge.
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
  headerButton: {
    padding: 4,
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
  memorialSection: {
    backgroundColor: 'rgba(255, 157, 66, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  memorialText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  statBox: {
    width: '50%',
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
  shareCompletionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700', // Gold for celebration
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
    gap: 8,
  },
  shareCompletionButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: '#000',
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)', // Green tint
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
    gap: 8,
  },
  sharedBadgeText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.medium,
    color: '#4CAF50', // Green
  },
  donateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9D42',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  donateButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: '#000',
  },
  leaderboardSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 4,
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
  rank: {
    width: 28,
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
  finisherBadge: {
    marginLeft: 4,
  },
  finisherBadgeText: {
    fontSize: 14,
  },
  progressContainer: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    marginTop: 6,
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF9D42',
    borderRadius: 2,
  },
  participantStats: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  distanceValue: {
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
    color: '#FF9D42',
    marginLeft: 8,
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
  privateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  privateText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
});

export default RunningBitcoinDetailScreen;
