/**
 * CompetitionsListScreen - My Events - Shows daily leaderboards from all teams user has joined
 * Accessible from Profile → "MY EVENTS" button
 * Uses the EXACT same query pattern as SimpleTeamScreen (which works correctly)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Text,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

// Components
import { DailyLeaderboardCard } from '../components/team/DailyLeaderboardCard';

// Services and contexts
import SimpleLeaderboardService from '../services/competition/SimpleLeaderboardService';
import { useNavigationData } from '../contexts/NavigationDataContext';

interface TeamLeaderboards {
  teamId: string;
  teamName: string;
  leaderboard5k: any[];
  leaderboard10k: any[];
  leaderboardHalf: any[];
  leaderboardMarathon: any[];
}

export const CompetitionsListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [teamLeaderboards, setTeamLeaderboards] = useState<TeamLeaderboards[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Get user's teams from navigation data (same as EventsScreen)
  const { profileData } = useNavigationData();
  const userTeams = profileData?.teams || [];

  // Load leaderboards for all user's teams (same pattern as SimpleTeamScreen)
  const loadAllLeaderboards = async () => {
    try {
      setIsLoading(true);
      console.log(`[CompetitionsListScreen] 📊 Loading leaderboards for ${userTeams.length} teams`);

      const allTeamLeaderboards: TeamLeaderboards[] = [];

      for (const team of userTeams) {
        try {
          console.log(`[CompetitionsListScreen] 🔍 Fetching leaderboards for team: ${team.name} (${team.id})`);

          // Use the EXACT same service method that works on SimpleTeamScreen
          const dailyLeaderboards = await SimpleLeaderboardService.getTeamDailyLeaderboards(team.id);

          allTeamLeaderboards.push({
            teamId: team.id,
            teamName: team.name,
            leaderboard5k: dailyLeaderboards.leaderboard5k,
            leaderboard10k: dailyLeaderboards.leaderboard10k,
            leaderboardHalf: dailyLeaderboards.leaderboardHalf,
            leaderboardMarathon: dailyLeaderboards.leaderboardMarathon,
          });

          console.log(
            `[CompetitionsListScreen] ✅ ${team.name} leaderboards loaded:`,
            {
              '5k': dailyLeaderboards.leaderboard5k.length,
              '10k': dailyLeaderboards.leaderboard10k.length,
              'half': dailyLeaderboards.leaderboardHalf.length,
              'marathon': dailyLeaderboards.leaderboardMarathon.length,
            }
          );
        } catch (error) {
          console.error(`[CompetitionsListScreen] ❌ Error loading leaderboards for ${team.name}:`, error);
        }
      }

      setTeamLeaderboards(allTeamLeaderboards);
    } catch (error) {
      console.error('[CompetitionsListScreen] ❌ Error loading leaderboards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load leaderboards on mount and when user's teams change
  useEffect(() => {
    if (userTeams.length > 0) {
      loadAllLeaderboards();
    } else {
      setIsLoading(false);
    }
  }, [userTeams.length]);

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllLeaderboards();
    setRefreshing(false);
  };

  // Calculate if there are any active leaderboards
  const hasAnyLeaderboards = teamLeaderboards.some(
    (team) =>
      team.leaderboard5k.length > 0 ||
      team.leaderboard10k.length > 0 ||
      team.leaderboardHalf.length > 0 ||
      team.leaderboardMarathon.length > 0
  );

  // Loading state
  if (isLoading && teamLeaderboards.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Events</Text>
            <View style={styles.headerSpacer} />
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Loading your events...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state - No teams joined
  if (userTeams.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Events</Text>
            <View style={styles.headerSpacer} />
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons
            name="people-outline"
            size={64}
            color={theme.colors.accent}
          />
          <Text style={styles.emptyTitle}>Join a Team</Text>
          <Text style={styles.emptyText}>
            Join a team to participate in competitions and see leaderboards
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state - No workouts today
  if (!hasAnyLeaderboards) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Events</Text>
            <View style={styles.headerSpacer} />
          </View>
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.accent}
            />
          }
        >
          <View style={styles.emptyContainer}>
            <Ionicons
              name="fitness-outline"
              size={64}
              color={theme.colors.accent}
            />
            <Text style={styles.emptyTitle}>No Workouts Today</Text>
            <Text style={styles.emptyText}>
              Be the first to complete a workout and appear on the leaderboard!
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main content - Show leaderboards grouped by team
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Events</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {teamLeaderboards.map((team) => {
          // Check if team has any leaderboards
          const hasLeaderboards =
            team.leaderboard5k.length > 0 ||
            team.leaderboard10k.length > 0 ||
            team.leaderboardHalf.length > 0 ||
            team.leaderboardMarathon.length > 0;

          if (!hasLeaderboards) return null;

          return (
            <View key={team.teamId} style={styles.teamSection}>
              {/* Team name header */}
              <View style={styles.teamHeader}>
                <Ionicons
                  name="people"
                  size={20}
                  color={theme.colors.accent}
                  style={styles.teamIcon}
                />
                <Text style={styles.teamName}>{team.teamName}</Text>
              </View>

              {/* Daily leaderboard cards */}
              <View style={styles.leaderboardsContainer}>
                {team.leaderboard5k.length > 0 && (
                  <DailyLeaderboardCard
                    title={`${team.teamName} 5K`}
                    distance="5km"
                    participants={team.leaderboard5k.length}
                    entries={team.leaderboard5k}
                    onPress={() => {
                      console.log('Navigate to 5K leaderboard');
                    }}
                  />
                )}

                {team.leaderboard10k.length > 0 && (
                  <DailyLeaderboardCard
                    title={`${team.teamName} 10K`}
                    distance="10km"
                    participants={team.leaderboard10k.length}
                    entries={team.leaderboard10k}
                    onPress={() => {
                      console.log('Navigate to 10K leaderboard');
                    }}
                  />
                )}

                {team.leaderboardHalf.length > 0 && (
                  <DailyLeaderboardCard
                    title={`${team.teamName} Half Marathon`}
                    distance="21.1km"
                    participants={team.leaderboardHalf.length}
                    entries={team.leaderboardHalf}
                    onPress={() => {
                      console.log('Navigate to Half Marathon leaderboard');
                    }}
                  />
                )}

                {team.leaderboardMarathon.length > 0 && (
                  <DailyLeaderboardCard
                    title={`${team.teamName} Marathon`}
                    distance="42.2km"
                    participants={team.leaderboardMarathon.length}
                    entries={team.leaderboardMarathon}
                    onPress={() => {
                      console.log('Navigate to Marathon leaderboard');
                    }}
                  />
                )}
              </View>
            </View>
          );
        })}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 8,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  title: {
    fontSize: 28,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    flex: 1,
    textAlign: 'center',
  },

  headerSpacer: {
    width: 40, // Match back button width for centered title
  },

  scrollContent: {
    paddingBottom: 20,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: theme.colors.text,
    fontSize: 16,
    marginTop: 12,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accent,
    marginTop: 16,
    marginBottom: 8,
  },

  emptyText: {
    fontSize: 15,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },

  teamSection: {
    marginTop: 20,
  },

  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },

  teamIcon: {
    marginRight: 8,
  },

  teamName: {
    fontSize: 18,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },

  leaderboardsContainer: {
    paddingHorizontal: 20,
  },
});
