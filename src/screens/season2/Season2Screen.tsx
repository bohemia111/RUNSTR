/**
 * Season2Screen - RUNSTR Season 2 Competition Screen
 *
 * Main screen for Season 2 with:
 * - Info card (dates, prizes)
 * - 3 tabs (Running, Walking, Cycling)
 * - User leaderboard
 * - Charity rankings (collapsible)
 * - Signup section
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import {
  Season2InfoCard,
  Season2Leaderboard,
  CharityRankings,
  Season2ExplainerModal,
  Season2SignupSection,
} from '../../components/season2';
import { useSeason2Leaderboard, useSeason2Registration } from '../../hooks/useSeason2';
import type { Season2ActivityType } from '../../types/season2';

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onPress }) => (
  <TouchableOpacity
    style={[styles.tabButton, isActive && styles.tabButtonActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const TABS: { label: string; value: Season2ActivityType }[] = [
  { label: 'Running', value: 'running' },
  { label: 'Walking', value: 'walking' },
  { label: 'Cycling', value: 'cycling' },
];

export const Season2Screen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<Season2ActivityType>('running');
  const [showExplainer, setShowExplainer] = useState(false);

  const { leaderboard, isLoading, refresh } = useSeason2Leaderboard(activeTab);
  const { isRegistered } = useSeason2Registration();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  const handleTabChange = (tab: Season2ActivityType) => {
    setActiveTab(tab);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>RUNSTR SEASON II</Text>
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
        {/* Info Card */}
        <Season2InfoCard onPress={() => setShowExplainer(true)} />

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <TabButton
              key={tab.value}
              label={tab.label}
              isActive={activeTab === tab.value}
              onPress={() => handleTabChange(tab.value)}
            />
          ))}
        </View>

        {/* Leaderboard */}
        <Season2Leaderboard
          participants={leaderboard?.participants || []}
          isLoading={isLoading}
          emptyMessage={`No ${activeTab} workouts yet`}
        />

        {/* Charity Rankings */}
        <CharityRankings
          rankings={leaderboard?.charityRankings || []}
          isLoading={isLoading}
        />

        {/* Signup Section */}
        {!isRegistered && <Season2SignupSection />}

        {/* Registered Status */}
        {isRegistered && (
          <View style={styles.registeredInfo}>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={theme.colors.success}
            />
            <Text style={styles.registeredText}>
              You're competing in SEASON II
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Explainer Modal */}
      <Season2ExplainerModal
        visible={showExplainer}
        onClose={() => setShowExplainer(false)}
      />
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
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.large,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: theme.borderRadius.medium,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.orangeBright,
  },
  tabText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
  },
  tabTextActive: {
    color: theme.colors.background,
    fontWeight: theme.typography.weights.semiBold,
  },
  registeredInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  registeredText: {
    color: theme.colors.text,
    fontSize: 14,
  },
});

export default Season2Screen;
