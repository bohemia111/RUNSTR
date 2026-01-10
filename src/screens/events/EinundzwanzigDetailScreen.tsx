/**
 * EinundzwanzigDetailScreen - Einundzwanzig Fitness Challenge detail screen
 *
 * Shows event info, charity selection, and team-based leaderboard
 * where charities are ranked by total participant distance.
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../styles/theme';
import {
  EINUNDZWANZIG_CONFIG,
  getEinundzwanzigStatus,
  getDaysRemaining,
  getDaysUntilStart,
} from '../../constants/einundzwanzig';
import {
  EinundzwanzigService,
  EinundzwanzigLeaderboard,
  CharityTeam,
} from '../../services/challenge/EinundzwanzigService';
import { CHARITIES, getCharityById } from '../../constants/charities';
import { Avatar } from '../../components/ui/Avatar';

interface EinundzwanzigDetailScreenProps {
  navigation: any;
}

export const EinundzwanzigDetailScreen: React.FC<EinundzwanzigDetailScreenProps> = ({
  navigation,
}) => {
  const [leaderboard, setLeaderboard] = useState<EinundzwanzigLeaderboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [userCharity, setUserCharity] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [userPubkey, setUserPubkey] = useState<string | null>(null);
  const [showCharityPicker, setShowCharityPicker] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      const pubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');
      setUserPubkey(pubkey);

      if (pubkey) {
        const joined = await EinundzwanzigService.hasJoined(pubkey);
        setHasJoined(joined);

        if (joined) {
          const charity = await EinundzwanzigService.getUserCharity(pubkey);
          setUserCharity(charity);
        }
      }

      const data = await EinundzwanzigService.getLeaderboard();
      setLeaderboard(data);
    } catch (error) {
      console.error('[EinundzwanzigDetail] Error loading data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleJoinWithCharity = async (charityId: string) => {
    if (!userPubkey || isJoining) return;

    setIsJoining(true);
    setShowCharityPicker(false);

    try {
      const success = await EinundzwanzigService.joinChallenge(userPubkey, charityId);
      if (success) {
        setHasJoined(true);
        setUserCharity(charityId);
        await loadData();
      }
    } catch (error) {
      console.error('[EinundzwanzigDetail] Error joining challenge:', error);
    } finally {
      setIsJoining(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData();
  }, [loadData]);

  const handleOpenWebsite = () => {
    Linking.openURL(EINUNDZWANZIG_CONFIG.website);
  };

  const toggleTeamExpanded = (charityId: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(charityId)) {
        next.delete(charityId);
      } else {
        next.add(charityId);
      }
      return next;
    });
  };

  const status = getEinundzwanzigStatus();
  const daysRemaining = getDaysRemaining();
  const daysUntilStart = getDaysUntilStart();

  const formatDateRange = () => {
    const start = EINUNDZWANZIG_CONFIG.startDate;
    const end = EINUNDZWANZIG_CONFIG.endDate;
    const options: Intl.DateTimeFormatOptions = {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  const getStatusText = () => {
    switch (status) {
      case 'active':
        return daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Ending today';
      case 'upcoming':
        return daysUntilStart > 0 ? `Starts in ${daysUntilStart} days` : 'Starting soon';
      case 'ended':
        return 'Challenge ended';
    }
  };

  const userCharityName = userCharity ? getCharityById(userCharity)?.name : null;

  const renderCharityTeam = ({ item, index }: { item: CharityTeam; index: number }) => {
    const isExpanded = expandedTeams.has(item.charityId);
    const charity = getCharityById(item.charityId);

    return (
      <View style={styles.teamCard}>
        <TouchableOpacity
          style={styles.teamHeader}
          onPress={() => toggleTeamExpanded(item.charityId)}
          activeOpacity={0.7}
        >
          <Text style={styles.teamRank}>{index + 1}</Text>
          {charity?.image ? (
            <Image source={charity.image} style={styles.charityImage} />
          ) : (
            <View style={styles.charityImagePlaceholder}>
              <Ionicons name="heart" size={20} color={theme.colors.textMuted} />
            </View>
          )}
          <View style={styles.teamInfo}>
            <Text style={styles.teamName}>{item.charityName}</Text>
            <Text style={styles.teamStats}>
              {item.participantCount} participant{item.participantCount !== 1 ? 's' : ''} •{' '}
              {item.totalDistanceKm.toFixed(1)} km
            </Text>
          </View>
          <View style={styles.teamSats}>
            <Text style={styles.satsValue}>
              {item.estimatedSats.toLocaleString()}
            </Text>
            <Text style={styles.satsLabel}>sats</Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.colors.textMuted}
          />
        </TouchableOpacity>

        {isExpanded && item.participants.length > 0 && (
          <View style={styles.participantsList}>
            {item.participants.map((p, pIndex) => (
              <View key={p.pubkey} style={styles.participantRow}>
                <Text style={styles.participantRank}>{pIndex + 1}</Text>
                <Avatar
                  imageUrl={p.picture}
                  name={p.name}
                  size={32}
                  style={styles.participantAvatar}
                />
                <Text style={styles.participantName} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.participantDistance}>
                  {p.totalDistanceKm.toFixed(1)} km
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderCharityOption = (charity: typeof CHARITIES[0]) => (
    <TouchableOpacity
      key={charity.id}
      style={styles.charityOption}
      onPress={() => handleJoinWithCharity(charity.id)}
    >
      {charity.image ? (
        <Image source={charity.image} style={styles.charityOptionImage} />
      ) : (
        <View style={styles.charityOptionImagePlaceholder}>
          <Ionicons name="heart" size={24} color={theme.colors.textMuted} />
        </View>
      )}
      <View style={styles.charityOptionInfo}>
        <Text style={styles.charityOptionName}>{charity.name}</Text>
        <Text style={styles.charityOptionDescription} numberOfLines={2}>
          {charity.description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Einundzwanzig</Text>
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
          source={EINUNDZWANZIG_CONFIG.bannerImage}
          style={styles.bannerImage}
          resizeMode="contain"
        />

        {/* Event Info */}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle}>{EINUNDZWANZIG_CONFIG.eventName}</Text>
          <Text style={styles.statusText}>{getStatusText()}</Text>

          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={16} color={theme.colors.textMuted} />
            <Text style={styles.metaText}>{formatDateRange()}</Text>
          </View>

          {/* Description */}
          <View style={styles.descriptionSection}>
            <Text style={styles.descriptionText}>{EINUNDZWANZIG_CONFIG.description}</Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {(leaderboard?.totalDistanceKm || 0).toFixed(0)}
              </Text>
              <Text style={styles.statLabel}>total km</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {(leaderboard?.totalEstimatedSats || 0).toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>sats earned</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{leaderboard?.totalParticipants || 0}</Text>
              <Text style={styles.statLabel}>participants</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{leaderboard?.charityTeams.length || 0}</Text>
              <Text style={styles.statLabel}>charities</Text>
            </View>
          </View>

          {/* Sats Per Km Info */}
          <View style={styles.prizeSection}>
            <Ionicons name="flash" size={20} color={theme.colors.accent} />
            <Text style={styles.prizeText}>
              Every kilometer = {EINUNDZWANZIG_CONFIG.satsPerKm.toLocaleString()} sats donated
              to your chosen charity
            </Text>
          </View>

          {/* Join Button - Show if not joined and challenge not ended */}
          {userPubkey && !hasJoined && status !== 'ended' && (
            <TouchableOpacity
              style={styles.joinButton}
              onPress={() => setShowCharityPicker(true)}
              disabled={isJoining}
            >
              {isJoining ? (
                <ActivityIndicator size="small" color={theme.colors.text} />
              ) : (
                <>
                  <Ionicons name="heart" size={20} color={theme.colors.text} />
                  <Text style={styles.joinButtonText}>Join & Pick Your Charity</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Joined Badge */}
          {hasJoined && (
            <View style={styles.joinedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent} />
              <Text style={styles.joinedBadgeText}>
                You're supporting {userCharityName || 'a charity'}!
              </Text>
            </View>
          )}

          {/* Website Button */}
          <TouchableOpacity style={styles.websiteButton} onPress={handleOpenWebsite}>
            <Ionicons name="globe-outline" size={20} color={theme.colors.text} />
            <Text style={styles.websiteButtonText}>Visit Einundzwanzig</Text>
          </TouchableOpacity>
        </View>

        {/* Charity Leaderboard */}
        <View style={styles.leaderboardSection}>
          <Text style={styles.sectionTitle}>Charity Leaderboard</Text>
          <Text style={styles.sectionSubtitle}>
            Charities ranked by total distance from participants
          </Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.colors.accent} />
              <Text style={styles.loadingText}>Loading leaderboard...</Text>
            </View>
          ) : leaderboard?.charityTeams.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyText}>No charities yet</Text>
              <Text style={styles.emptySubtext}>
                Be the first to join and support your favorite charity!
              </Text>
            </View>
          ) : (
            <FlatList
              data={leaderboard?.charityTeams || []}
              renderItem={renderCharityTeam}
              keyExtractor={(item) => item.charityId}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Info Note */}
        <View style={styles.noteSection}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMuted} />
          <Text style={styles.noteText}>
            Running and walking workouts during the event period count toward your charity's
            total. Tap a charity to see individual participants.
          </Text>
        </View>
      </ScrollView>

      {/* Charity Picker Modal */}
      <Modal
        visible={showCharityPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCharityPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Your Charity</Text>
              <TouchableOpacity onPress={() => setShowCharityPicker(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Your distance will contribute to this charity's total
            </Text>
            <ScrollView style={styles.charityList}>
              {CHARITIES.map(renderCharityOption)}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  descriptionSection: {
    backgroundColor: 'rgba(255, 157, 66, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  descriptionText: {
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
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
    gap: 8,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.background,
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
  websiteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    gap: 8,
  },
  websiteButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
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
  teamCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  teamRank: {
    width: 28,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.accent,
  },
  charityImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  charityImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  teamStats: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  teamSats: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  satsValue: {
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
    color: '#FF9D42',
  },
  satsLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  participantsList: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  participantRank: {
    width: 24,
    fontSize: 13,
    color: theme.colors.textMuted,
    marginLeft: 4,
  },
  participantAvatar: {
    marginRight: 10,
  },
  participantName: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
  },
  participantDistance: {
    fontSize: 14,
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.medium,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  charityList: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  charityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  charityOptionImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  charityOptionImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  charityOptionInfo: {
    flex: 1,
  },
  charityOptionName: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  charityOptionDescription: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});

export default EinundzwanzigDetailScreen;
