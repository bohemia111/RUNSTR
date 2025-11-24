/**
 * WorkoutTabNavigator - Simple tab switcher between Public, Local, and Apple workouts
 * Public: 1301 notes from Nostr (cache-first instant display)
 * Local: Local Activity Tracker workouts (zero loading time)
 * Apple: HealthKit workouts with post buttons
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { theme } from '../../styles/theme';
import { PublicWorkoutsTab } from './tabs/PublicWorkoutsTab';
import { PrivateWorkoutsTab } from './tabs/PrivateWorkoutsTab';
import { AppleHealthTab } from './tabs/AppleHealthTab';
import { GarminHealthTab } from './tabs/GarminHealthTab';
import type { LocalWorkout } from '../../services/fitness/LocalWorkoutStorageService';

// GARMIN: Removed 'garmin' from WorkoutTabType until security issues fixed
// PUBLIC TAB: Hidden from UI (local-first architecture), but code kept for potential future use
export type WorkoutTabType = 'public' | 'private' | 'apple'; // | 'garmin';

interface WorkoutTabNavigatorProps {
  userId: string;
  pubkey?: string;
  initialTab?: WorkoutTabType;
  onRefresh?: () => void;
  onPostToNostr?: (workout: LocalWorkout) => Promise<void>;
  onPostToSocial?: (workout: LocalWorkout) => Promise<void>;
  onCompeteHealthKit?: (workout: any) => Promise<void>;
  onSocialShareHealthKit?: (workout: any) => Promise<void>;
  onCompeteGarmin?: (workout: any) => Promise<void>;
  onSocialShareGarmin?: (workout: any) => Promise<void>;
  onNavigateToAnalytics?: () => void;
}

export const WorkoutTabNavigator: React.FC<WorkoutTabNavigatorProps> = ({
  userId,
  pubkey,
  initialTab = 'private',
  onRefresh,
  onPostToNostr,
  onPostToSocial,
  onCompeteHealthKit,
  onSocialShareHealthKit,
  onCompeteGarmin,
  onSocialShareGarmin,
  onNavigateToAnalytics,
}) => {
  const [activeTab, setActiveTab] = useState<WorkoutTabType>(initialTab);

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'private' && styles.tabActive]}
          onPress={() => setActiveTab('private')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'private' && styles.tabTextActive,
            ]}
          >
            Local
          </Text>
          {activeTab === 'private' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>

        {/* PUBLIC TAB: Hidden (local-first architecture - Nostr is cloud backup, not primary view) */}
        {/* <TouchableOpacity
          style={[styles.tab, activeTab === 'public' && styles.tabActive]}
          onPress={() => setActiveTab('public')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'public' && styles.tabTextActive,
            ]}
          >
            Public
          </Text>
          {activeTab === 'public' && <View style={styles.tabIndicator} />}
        </TouchableOpacity> */}

        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'apple' && styles.tabActive]}
            onPress={() => setActiveTab('apple')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'apple' && styles.tabTextActive,
              ]}
            >
              Apple
            </Text>
            {activeTab === 'apple' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        )}

        {/* GARMIN: Hidden until CRITICAL security issues fixed (client_secret in bundle, deep link validation) */}
        {/* <TouchableOpacity
          style={[styles.tab, activeTab === 'garmin' && styles.tabActive]}
          onPress={() => setActiveTab('garmin')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'garmin' && styles.tabTextActive,
            ]}
          >
            Garmin
          </Text>
          {activeTab === 'garmin' && <View style={styles.tabIndicator} />}
        </TouchableOpacity> */}
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {/* Only mount the active tab to prevent unnecessary component initialization */}
        {activeTab === 'public' && (
          <PublicWorkoutsTab
            userId={userId}
            pubkey={pubkey}
            onRefresh={onRefresh}
          />
        )}
        {activeTab === 'private' && (
          <PrivateWorkoutsTab
            userId={userId}
            pubkey={pubkey}
            onRefresh={onRefresh}
            onPostToNostr={onPostToNostr}
            onPostToSocial={onPostToSocial}
            onNavigateToAnalytics={onNavigateToAnalytics}
          />
        )}
        {activeTab === 'apple' && (
          <AppleHealthTab
            userId={userId}
            onCompete={onCompeteHealthKit}
            onSocialShare={onSocialShareHealthKit}
          />
        )}
        {activeTab === 'garmin' && (
          <GarminHealthTab
            userId={userId}
            onCompete={onCompeteGarmin}
            onSocialShare={onSocialShareGarmin}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  tabActive: {
    // Active tab styling handled by indicator
  },

  tabText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },

  tabTextActive: {
    color: theme.colors.text,
    fontWeight: theme.typography.weights.semiBold,
  },

  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: theme.colors.accent,
  },

  tabContent: {
    flex: 1,
  },
});
