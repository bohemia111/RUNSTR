/**
 * WorkoutTabNavigator - Simple tab switcher between Public, Local, and Apple workouts
 * Public: 1301 notes from Nostr (cache-first instant display)
 * Local: Local Activity Tracker workouts (zero loading time)
 * Apple: HealthKit workouts with post buttons
 */

import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { theme } from '../../styles/theme';
import { PublicWorkoutsTab } from './tabs/PublicWorkoutsTab';
import { PrivateWorkoutsTab } from './tabs/PrivateWorkoutsTab';
import { AppleHealthTab } from './tabs/AppleHealthTab';
import { HealthConnectTab } from './tabs/HealthConnectTab';
import { GarminHealthTab } from './tabs/GarminHealthTab';
import { ToggleButtons } from '../ui/ToggleButtons';
import type { LocalWorkout } from '../../services/fitness/LocalWorkoutStorageService';

// GARMIN: Removed 'garmin' from WorkoutTabType until security issues fixed
// PUBLIC TAB: Hidden from UI (local-first architecture), but code kept for potential future use
export type WorkoutTabType = 'public' | 'private' | 'apple' | 'healthconnect'; // | 'garmin';

// Export tab options builder for external use (e.g., rendering tabs in parent header)
export const getWorkoutTabOptions = () => [
  { key: 'private', label: 'Local' },
  ...(Platform.OS === 'ios' ? [{ key: 'apple', label: 'Apple Health' }] : []),
  ...(Platform.OS === 'android' ? [{ key: 'healthconnect', label: 'Health Connect' }] : []),
];

interface WorkoutTabNavigatorProps {
  userId: string;
  pubkey?: string;
  initialTab?: WorkoutTabType;
  // External tab control (when tabs are rendered in parent)
  activeTab?: WorkoutTabType;
  onActiveTabChange?: (tab: WorkoutTabType) => void;
  hideInternalTabBar?: boolean;
  onRefresh?: () => void;
  onPostToNostr?: (workout: LocalWorkout) => Promise<void>;
  onPostToSocial?: (workout: LocalWorkout) => Promise<void>;
  onCompeteHealthKit?: (workout: any) => Promise<void>;
  onSocialShareHealthKit?: (workout: any) => Promise<void>;
  onCompeteGarmin?: (workout: any) => Promise<void>;
  onSocialShareGarmin?: (workout: any) => Promise<void>;
  onCompeteHealthConnect?: (workout: any) => Promise<void>;
  onSocialShareHealthConnect?: (workout: any) => Promise<void>;
  onNavigateToAnalytics?: () => void;
}

export const WorkoutTabNavigator: React.FC<WorkoutTabNavigatorProps> = ({
  userId,
  pubkey,
  initialTab = 'private',
  activeTab: externalActiveTab,
  onActiveTabChange,
  hideInternalTabBar = false,
  onRefresh,
  onPostToNostr,
  onPostToSocial,
  onCompeteHealthKit,
  onSocialShareHealthKit,
  onCompeteGarmin,
  onSocialShareGarmin,
  onCompeteHealthConnect,
  onSocialShareHealthConnect,
  onNavigateToAnalytics,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<WorkoutTabType>(initialTab);

  // Use external tab state if provided, otherwise use internal state
  const activeTab = externalActiveTab ?? internalActiveTab;
  const setActiveTab = (tab: WorkoutTabType) => {
    if (onActiveTabChange) {
      onActiveTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };

  // Build tab options based on platform
  const tabOptions = getWorkoutTabOptions();

  return (
    <View style={styles.container}>
      {/* Tab Switcher - can be hidden when parent renders tabs */}
      {!hideInternalTabBar && (
        <View style={styles.tabBar}>
          <ToggleButtons
            options={tabOptions}
            activeKey={activeTab}
            onSelect={(key) => setActiveTab(key as WorkoutTabType)}
          />
        </View>
      )}

      {/* Tab Content - All tabs stay mounted to preserve state across switches */}
      <View style={styles.tabContent}>
        <View style={{ display: activeTab === 'public' ? 'flex' : 'none', flex: 1 }}>
          <PublicWorkoutsTab
            userId={userId}
            pubkey={pubkey}
            onRefresh={onRefresh}
          />
        </View>
        <View style={{ display: activeTab === 'private' ? 'flex' : 'none', flex: 1 }}>
          <PrivateWorkoutsTab
            userId={userId}
            pubkey={pubkey}
            onRefresh={onRefresh}
            onPostToNostr={onPostToNostr}
            onPostToSocial={onPostToSocial}
            onNavigateToAnalytics={onNavigateToAnalytics}
          />
        </View>
        <View style={{ display: activeTab === 'apple' ? 'flex' : 'none', flex: 1 }}>
          <AppleHealthTab
            userId={userId}
            onCompete={onCompeteHealthKit}
            onSocialShare={onSocialShareHealthKit}
          />
        </View>
        <View style={{ display: activeTab === 'healthconnect' ? 'flex' : 'none', flex: 1 }}>
          <HealthConnectTab
            userId={userId}
            onCompete={onCompeteHealthConnect}
            onSocialShare={onSocialShareHealthConnect}
          />
        </View>
        <View style={{ display: activeTab === 'garmin' ? 'flex' : 'none', flex: 1 }}>
          <GarminHealthTab
            userId={userId}
            onCompete={onCompeteGarmin}
            onSocialShare={onSocialShareGarmin}
          />
        </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabContent: {
    flex: 1,
  },
});
