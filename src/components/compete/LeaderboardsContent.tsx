/**
 * LeaderboardsContent - Embeddable leaderboards for Compete screen toggle
 * Shows daily leaderboards for ALL users with workouts today (running + steps)
 *
 * ARCHITECTURE: Uses DailyLeaderboardService (Supabase-backed)
 * - Queries Supabase for today's workouts (~500ms vs 3-5s with Nostr)
 * - Running workouts for time leaderboards (5K/10K/Half/Marathon)
 * - Walking workouts for steps leaderboard
 * - Top 25 display with user position shown below if outside top 25
 * - Server-side anti-cheat validation
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { DailyLeaderboardCard } from '../team/DailyLeaderboardCard';
import { DailyLeaderboardService, LeaderboardEntry } from '../../services/competition/DailyLeaderboardService';

// ============================================================================
// Types
// ============================================================================

interface GlobalLeaderboards {
  leaderboard5k: LeaderboardEntry[];
  leaderboard10k: LeaderboardEntry[];
  leaderboardHalf: LeaderboardEntry[];
  leaderboardMarathon: LeaderboardEntry[];
  leaderboardSteps: LeaderboardEntry[];
}

interface LeaderboardsContentProps {
  /** Increment to trigger re-fetch after pull-to-refresh */
  refreshTrigger?: number;
}

// ============================================================================
// Component
// ============================================================================

export const LeaderboardsContent: React.FC<LeaderboardsContentProps> = ({
  refreshTrigger = 0,
}) => {
  const [globalLeaderboards, setGlobalLeaderboards] = useState<GlobalLeaderboards>({
    leaderboard5k: [],
    leaderboard10k: [],
    leaderboardHalf: [],
    leaderboardMarathon: [],
    leaderboardSteps: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load leaderboards from DailyLeaderboardService (Supabase-backed)
  // Queries Supabase for today's workouts - ~500ms vs 3-5s with Nostr
  useEffect(() => {
    const loadLeaderboards = async () => {
      const t0 = Date.now();
      console.log('[LeaderboardsContent] Loading global daily leaderboards (Supabase)...');

      try {
        // Use forceRefresh when refreshTrigger changes (pull-to-refresh)
        const forceRefresh = refreshTrigger > 0;
        const data = await DailyLeaderboardService.getGlobalDailyLeaderboards(forceRefresh);

        console.log(`[LeaderboardsContent] Loaded in ${Date.now() - t0}ms:`, {
          '5k': data.leaderboard5k.length,
          '10k': data.leaderboard10k.length,
          'half': data.leaderboardHalf.length,
          'marathon': data.leaderboardMarathon.length,
          'steps': data.leaderboardSteps.length,
        });

        setGlobalLeaderboards({
          leaderboard5k: data.leaderboard5k,
          leaderboard10k: data.leaderboard10k,
          leaderboardHalf: data.leaderboardHalf,
          leaderboardMarathon: data.leaderboardMarathon,
          leaderboardSteps: data.leaderboardSteps,
        });
      } catch (error) {
        console.error('[LeaderboardsContent] Failed to load leaderboards:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLeaderboards();
  }, [refreshTrigger]);

  // Calculate if there are any active leaderboards
  const hasAnyLeaderboards =
    globalLeaderboards.leaderboard5k.length > 0 ||
    globalLeaderboards.leaderboard10k.length > 0 ||
    globalLeaderboards.leaderboardHalf.length > 0 ||
    globalLeaderboards.leaderboardMarathon.length > 0 ||
    globalLeaderboards.leaderboardSteps.length > 0;

  // Loading state (only on initial load)
  if (isLoading && !hasAnyLeaderboards) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={styles.loadingText}>Loading leaderboards...</Text>
      </View>
    );
  }

  // Empty state - No running workouts today
  if (!hasAnyLeaderboards) {
    return (
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
        <Text style={styles.emptyHint}>Pull down to refresh</Text>
      </View>
    );
  }

  // Main content - Show GLOBAL leaderboards (not team-specific)
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerSection}>
        <Ionicons
          name="trophy"
          size={20}
          color={theme.colors.accent}
          style={styles.headerIcon}
        />
        <Text style={styles.headerTitle}>Daily Leaderboards</Text>
      </View>

      {/* Daily leaderboard cards */}
      <View style={styles.leaderboardsContainer}>
        {globalLeaderboards.leaderboard5k.length > 0 && (
          <DailyLeaderboardCard
            title="5K"
            distance="5km"
            participants={globalLeaderboards.leaderboard5k.length}
            entries={globalLeaderboards.leaderboard5k}
            onPress={() => console.log('Navigate to 5K leaderboard')}
          />
        )}

        {globalLeaderboards.leaderboard10k.length > 0 && (
          <DailyLeaderboardCard
            title="10K"
            distance="10km"
            participants={globalLeaderboards.leaderboard10k.length}
            entries={globalLeaderboards.leaderboard10k}
            onPress={() => console.log('Navigate to 10K leaderboard')}
          />
        )}

        {globalLeaderboards.leaderboardHalf.length > 0 && (
          <DailyLeaderboardCard
            title="Half Marathon"
            distance="21.1km"
            participants={globalLeaderboards.leaderboardHalf.length}
            entries={globalLeaderboards.leaderboardHalf}
            onPress={() => console.log('Navigate to Half Marathon leaderboard')}
          />
        )}

        {globalLeaderboards.leaderboardMarathon.length > 0 && (
          <DailyLeaderboardCard
            title="Marathon"
            distance="42.2km"
            participants={globalLeaderboards.leaderboardMarathon.length}
            entries={globalLeaderboards.leaderboardMarathon}
            onPress={() => console.log('Navigate to Marathon leaderboard')}
          />
        )}

        {globalLeaderboards.leaderboardSteps.length > 0 && (
          <DailyLeaderboardCard
            title="Daily Steps"
            distance="steps"
            participants={globalLeaderboards.leaderboardSteps.length}
            entries={globalLeaderboards.leaderboardSteps}
            onPress={() => console.log('Navigate to Steps leaderboard')}
            participantLabel="walker"
          />
        )}
      </View>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 48,
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
  emptyHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 16,
    fontStyle: 'italic',
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  leaderboardsContainer: {
    gap: 12,
  },
});

export default LeaderboardsContent;
