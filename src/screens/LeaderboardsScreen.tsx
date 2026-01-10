/**
 * LeaderboardsScreen - Dedicated screen for daily leaderboards
 *
 * Shows daily running leaderboards with back navigation to the events page.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { LeaderboardsContent } from '../components/compete';

interface LeaderboardsScreenProps {
  navigation?: any;
}

export const LeaderboardsScreen: React.FC<LeaderboardsScreenProps> = ({ navigation: propNavigation }) => {
  const hookNavigation = useNavigation<any>();
  const navigation = propNavigation || hookNavigation;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Refresh handler - triggers re-fetch in LeaderboardsContent
  // LeaderboardsContent uses SimpleLeaderboardService.getGlobalDailyLeaderboards(forceRefresh=true)
  const handleRefresh = useCallback(async () => {
    const t0 = Date.now();
    console.log('[LeaderboardsScreen] Pull-to-refresh started');
    setIsRefreshing(true);

    // Increment trigger to tell LeaderboardsContent to re-fetch with forceRefresh
    setRefreshTrigger(prev => prev + 1);

    // Use setImmediate to bypass iOS timer blocking
    setImmediate(() => {
      setIsRefreshing(false);
      console.log(`[LeaderboardsScreen] Refresh complete: ${Date.now() - t0}ms`);
    });
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leaderboards</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.orangeBright}
          />
        }
      >
        <LeaderboardsContent refreshTrigger={refreshTrigger} />
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
    fontSize: 18,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
});

export default LeaderboardsScreen;
