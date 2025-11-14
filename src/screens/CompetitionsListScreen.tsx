/**
 * CompetitionsListScreen
 * Displays all user's competitions (teams, leagues, events, challenges) in a tabbed view
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  FlatList,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { NostrCompetitionDiscoveryService } from '../services/competition/NostrCompetitionDiscoveryService';
import { getUserNostrIdentifiers } from '../utils/nostr';
import type { UserCompetition } from '../types/challenge';
import { theme } from '../styles/theme';
import { GlobalChallengeWizard } from '../components/wizards/GlobalChallengeWizard';
import { EventParticipationStore } from '../services/event/EventParticipationStore';

type RootStackParamList = {
  ChallengeLeaderboard: { challengeId: string };
  EnhancedTeamScreen: {
    team: any;
    userIsMember?: boolean;
    currentUserNpub?: string;
    userIsCaptain?: boolean;
  };
  LeagueLeaderboard: { leagueId: string };
  EventDetail: { eventId: string; eventData?: any };
  ChallengeWizard: undefined;
  // Add other screens as needed
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TabType = 'events' | 'challenges';

export const CompetitionsListScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [activeTab, setActiveTab] = useState<TabType>('events');
  const [competitions, setCompetitions] = useState<UserCompetition[]>([]);
  const [filteredCompetitions, setFilteredCompetitions] = useState<
    UserCompetition[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showChallengeWizard, setShowChallengeWizard] = useState(false);

  useEffect(() => {
    loadCompetitions();
  }, []);

  useEffect(() => {
    filterCompetitions();
  }, [activeTab, competitions]);

  const loadCompetitions = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const userIdentifiers = await getUserNostrIdentifiers();
      if (!userIdentifiers?.hexPubkey) {
        console.log('No user authenticated');
        return;
      }

      // Load local event participations FIRST (instant UX)
      const localEvents = await EventParticipationStore.getParticipations();

      // Convert to UserCompetition format
      // ✅ Store eventData for later retrieval (avoid defaults in buildEventDataFromCompetition)
      const localCompetitions: UserCompetition[] = localEvents.map((event) => ({
        id: event.eventId,
        name: event.eventData.name,
        type: 'event' as const,
        status: event.status === 'approved' ? ('active' as const) : ('upcoming' as const),
        participantCount: 1, // At least the user
        yourRole: 'member' as const,
        startsAt: new Date(event.eventData.eventDate).getTime() / 1000,
        prizePool: event.entryFeePaid,
        eventData: event.eventData, // ✅ Include full event data
      }));

      // Show local events immediately for fast UX
      if (localCompetitions.length > 0) {
        setCompetitions(localCompetitions);
      }

      // Load from Nostr in background
      const discoveryService = NostrCompetitionDiscoveryService.getInstance();
      if (isRefresh) {
        discoveryService.clearCache(userIdentifiers.hexPubkey);
      }

      const userCompetitions = await discoveryService.getUserCompetitions(
        userIdentifiers.hexPubkey
      );

      // Merge local + Nostr (dedupe by ID)
      const merged = [...localCompetitions];
      userCompetitions.forEach((comp) => {
        if (!merged.some((m) => m.id === comp.id)) {
          merged.push(comp);
        }
      });

      setCompetitions(merged);
    } catch (error) {
      console.error('Error loading competitions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterCompetitions = () => {
    // Map tab to competition type (remove 's' from plural)
    const type: UserCompetition['type'] =
      activeTab === 'events' ? 'event' : 'challenge';
    setFilteredCompetitions(competitions.filter((c) => c.type === type));
  };

  /**
   * Build event data from competition for instant display
   * ✅ FIX: Use stored eventData if available (from local participations)
   */
  const buildEventDataFromCompetition = (comp: UserCompetition) => {
    if (comp.type !== 'event') return null;

    // ✅ If we have full event data stored, use it directly
    if (comp.eventData) {
      return comp.eventData;
    }

    // Fallback to partial data (for events from Nostr without local participation)
    // ✅ FIX: Use undefined instead of empty strings so EventDetailScreen can fetch fresh data
    return {
      id: comp.id,
      name: comp.name,
      activityType: 'Any',
      eventDate: comp.startsAt
        ? new Date(comp.startsAt * 1000).toISOString()
        : new Date().toISOString(),
      metric: 'total_distance',
      teamId: undefined,  // ✅ Let EventDetailScreen fetch fresh
      captainPubkey: undefined,  // ✅ Let EventDetailScreen fetch fresh
      pubkey: undefined,  // ✅ Will be fetched from Nostr event
      description: undefined,
      entryFeesSats: comp.prizePool,
    };
  };

  const handleCompetitionPress = (competition: UserCompetition) => {
    // Navigate based on competition type
    switch (competition.type) {
      case 'team':
        // Need to fetch team data for navigation
        navigation.navigate('EnhancedTeamScreen', {
          team: { id: competition.id, name: competition.name },
        });
        break;
      case 'league':
        navigation.navigate('LeagueLeaderboard', { leagueId: competition.id });
        break;
      case 'event':
        // ✅ FIX: Pass eventData for instant display
        navigation.navigate('EventDetail', {
          eventId: competition.id,
          eventData: buildEventDataFromCompetition(competition),
        });
        break;
      case 'challenge':
        navigation.navigate('ChallengeLeaderboard', {
          challengeId: competition.id,
        });
        break;
    }
  };

  const handleCreateChallenge = () => {
    navigation.navigate('ChallengeWizard');
  };

  const renderTab = (tab: TabType, label: string) => (
    <TouchableOpacity
      key={tab}
      style={[styles.tab, activeTab === tab && styles.activeTab]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderCompetitionItem = ({ item }: { item: UserCompetition }) => {
    const getStatusColor = () => {
      switch (item.status) {
        case 'active':
          return '#FF9D42';
        case 'upcoming':
          return '#ffa500';
        case 'completed':
          return '#666';
        default:
          return '#999';
      }
    };

    const getTypeIcon = () => {
      switch (item.type) {
        case 'team':
          return 'people';
        case 'league':
          return 'trophy';
        case 'event':
          return 'calendar';
        case 'challenge':
          return 'flash';
        default:
          return 'help';
      }
    };

    return (
      <TouchableOpacity
        style={styles.competitionItem}
        onPress={() => handleCompetitionPress(item)}
      >
        <View style={styles.competitionIcon}>
          <Ionicons name={getTypeIcon() as any} size={24} color="#FF9D42" />
        </View>

        <View style={styles.competitionInfo}>
          <Text style={styles.competitionName}>{item.name}</Text>
          <View style={styles.competitionMeta}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor() + '20' },
              ]}
            >
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
            {item.wager && (
              <Text style={styles.wager}>
                <Ionicons name="flash" size={12} color="#FF9D42" /> {item.wager}{' '}
                sats
              </Text>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color="#666" />
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="trophy-outline" size={64} color="#333" />
      <Text style={styles.emptyTitle}>No {activeTab} yet</Text>
      <Text style={styles.emptySubtext}>
        {activeTab === 'challenges'
          ? 'Create a challenge to get started!'
          : 'Join a team or event to see them here'}
      </Text>
      {activeTab === 'challenges' && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateChallenge}
        >
          <Text style={styles.createButtonText}>Create Challenge</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FF9D42" />
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
        <TouchableOpacity
          style={styles.challengeButton}
          onPress={() => setShowChallengeWizard(true)}
        >
          <Ionicons name="shield-outline" size={20} color={theme.colors.text} />
          <Text style={styles.challengeButtonText}>CHALLENGE</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {renderTab('events', 'Events')}
        {renderTab('challenges', 'Challenges')}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9D42" />
          <Text style={styles.loadingText}>Loading competitions...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCompetitions}
          keyExtractor={(item) => item.id}
          renderItem={renderCompetitionItem}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadCompetitions(true)}
              tintColor="#fff"
              colors={['#fff']}
            />
          }
          contentContainerStyle={
            filteredCompetitions.length === 0
              ? styles.emptyListContainer
              : styles.listContent
          }
        />
      )}

      {/* Challenge Wizard Modal */}
      {showChallengeWizard && (
        <GlobalChallengeWizard
          onCancel={() => setShowChallengeWizard(false)}
          onComplete={() => {
            // Refresh competitions after challenge is created
            setShowChallengeWizard(false);
            loadCompetitions(true);
          }}
        />
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    padding: 4,
  },
  headerSpacer: {
    flex: 1,
  },
  challengeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  challengeButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textBright,
  },
  tabContainer: {
    flexDirection: 'row',
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.orangeDeep,
  },
  tabText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  activeTabText: {
    color: theme.colors.textBright,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textDark,
  },
  listContent: {
    padding: 16,
  },
  competitionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  competitionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  competitionInfo: {
    flex: 1,
  },
  competitionName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textBright,
    marginBottom: 4,
  },
  competitionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: theme.colors.orangeBright + '20',
    borderWidth: 1,
    borderColor: theme.colors.orangeBright,
  },
  pendingBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: theme.colors.orangeBright,
  },
  participantCount: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  wager: {
    fontSize: 12,
    color: theme.colors.textBright,
  },
  emptyListContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: theme.colors.orangeDeep, // Deep orange button
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.accentText, // Black text on orange
  },
});
