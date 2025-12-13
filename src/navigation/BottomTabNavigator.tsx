/**
 * BottomTabNavigator - Main tab navigation for authenticated users
 * Teams tab for discovery and Profile tab for user data
 */

import React, { Suspense } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  InteractionManager,
  ActivityIndicator,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';
import { PerformanceLogger } from '../utils/PerformanceLogger';

// ✅ PERFORMANCE: Load Profile immediately, lazy load Activity only when needed
// FIX: Loading multiple lazy screens simultaneously was causing freeze on first launch
import { ProfileScreen } from '../screens/ProfileScreen';

// Removed TeamDiscoveryScreen - not used in current navigation

// Keep Activity lazy since it's not the initial tab
const ActivityTrackerScreen = React.lazy(() =>
  import('../screens/activity/ActivityTrackerScreen').then((m) => ({
    default: m.ActivityTrackerScreen,
  }))
);

// Lazy load Events (Satlantis) screen
const SatlantisDiscoveryScreen = React.lazy(() =>
  import('../screens/satlantis/SatlantisDiscoveryScreen').then((m) => ({
    default: m.SatlantisDiscoveryScreen,
  }))
);

// Loading fallback component
const LoadingFallback = () => (
  <View
    style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    }}
  >
    <ActivityIndicator size="large" color={theme.colors.accent} />
  </View>
);

// Data Hooks
import { useNavigationData } from '../contexts/NavigationDataContext';

// Navigation Handlers
import { createNavigationHandlers } from './navigationHandlers';

// Types
export type BottomTabParamList = {
  Teams: undefined;
  Exercise: undefined;
  Events: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

interface BottomTabNavigatorProps {
  onNavigateToTeamCreation?: () => void;
  onSignOut?: () => Promise<void>;
}

export const BottomTabNavigator: React.FC<BottomTabNavigatorProps> = ({
  onNavigateToTeamCreation,
  onSignOut,
}) => {
  // Fetch real data for navigation screens
  const {
    user,
    profileData,
    availableTeams,
    isLoading,
    isLoadingTeam,
    error,
    refresh,
    loadTeams,
    loadWallet,
    prefetchLeaguesInBackground,
  } = useNavigationData();

  // Create navigation handlers
  const handlers = createNavigationHandlers();

  // ✅ PERFORMANCE: Log total blocking time when app is interactive
  React.useEffect(() => {
    if (!isLoading && profileData) {
      console.log('\n🎯 APP IS INTERACTIVE - Performance Summary:');
      PerformanceLogger.summary();
      console.log('\n');
    }
  }, [isLoading, profileData]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: theme.colors.text,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'help-outline';

          if (route.name === 'Teams') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Exercise') {
            iconName = focused ? 'fitness' : 'fitness-outline';
          } else if (route.name === 'Events') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return (
            <Ionicons
              name={iconName}
              size={size || 24}
              color={color}
              style={styles.tabIcon}
            />
          );
        },
      })}
      initialRouteName="Profile"
    >
      {/* Exercise Tab - Tracking + Manual Entry */}
      <Tab.Screen
        name="Exercise"
        options={{
          title: 'Exercise',
          headerShown: false,
        }}
      >
        {() => (
          <Suspense fallback={<LoadingFallback />}>
            <ActivityTrackerScreen />
          </Suspense>
        )}
      </Tab.Screen>

      {/* Events Tab - Race Events from Satlantis */}
      <Tab.Screen
        name="Events"
        options={{
          title: 'Events',
          headerShown: false,
        }}
      >
        {({ navigation }) => (
          <Suspense fallback={<LoadingFallback />}>
            <SatlantisDiscoveryScreen navigation={navigation} />
          </Suspense>
        )}
      </Tab.Screen>

      {/* Profile Tab */}
      <Tab.Screen
        name="Profile"
        options={{
          title: 'Profile',
          headerShown: false,
        }}
      >
        {({ navigation }) =>
          profileData ? (
            <ProfileScreen
              data={profileData}
              isLoadingTeam={isLoadingTeam}
              isLoadingProfile={isLoading}
              onNavigateToTeam={() => navigation.navigate('Teams')}
              onNavigateToTeamDiscovery={() => navigation.navigate('Teams')}
              onViewCurrentTeam={() => {
                // Navigate to EnhancedTeamScreen with the user's current team
                if (profileData.currentTeam) {
                  // Ensure complete team object structure matching Teams discovery
                  const team = {
                    id: profileData.currentTeam.id,
                    name: profileData.currentTeam.name,
                    description: profileData.currentTeam.description || '',
                    memberCount: profileData.currentTeam.memberCount || 0,
                    prizePool: profileData.currentTeam.prizePool || 0,
                    isActive:
                      profileData.currentTeam.isActive !== undefined
                        ? profileData.currentTeam.isActive
                        : true,
                    // Include all team metadata fields
                    captainId: profileData.currentTeam.captainId, // Include if available
                    bannerImage: profileData.currentTeam.bannerImage, // Include banner for display
                    charityId: profileData.currentTeam.charityId, // Include charity for charity section display
                  };

                  // Get the current user's npub to pass to navigation
                  // This ensures consistent behavior with Teams tab navigation
                  const currentUserNpub = user?.npub;

                  console.log('Profile Navigation to Team:', {
                    teamId: team.id,
                    teamName: team.name,
                    userNpub: currentUserNpub?.slice(0, 20) + '...',
                    userIsCaptain: profileData.currentTeam.role === 'captain',
                  });

                  navigation.navigate('EnhancedTeamScreen', {
                    team,
                    userIsMember: true,
                    userIsCaptain: profileData.currentTeam.role === 'captain',
                    currentUserNpub, // Pass npub to ensure proper competition loading
                  });
                }
              }}
              onCaptainDashboard={() =>
                handlers.handleCaptainDashboard(navigation)
              }
              onTeamCreation={() => {
                if (onNavigateToTeamCreation) {
                  onNavigateToTeamCreation();
                }
              }}
              onEditProfile={handlers.handleEditProfile}
              onSend={handlers.handleWalletSend}
              onReceive={handlers.handleWalletReceive}
              onWalletHistory={handlers.handleWalletHistory}
              onSyncSourcePress={handlers.handleSyncSourcePress}
              onManageSubscription={handlers.handleManageSubscription}
              onHelp={() => handlers.handleHelp(navigation)}
              onContactSupport={() => handlers.handleContactSupport(navigation)}
              onPrivacyPolicy={() => handlers.handlePrivacyPolicy(navigation)}
              onSignOut={
                onSignOut || (() => handlers.handleSignOut(navigation))
              }
              onRefresh={refresh}
            />
          ) : (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>
                {error || 'Loading Profile...'}
              </Text>
              {error && (
                <TouchableOpacity onPress={refresh} style={styles.retryButton}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      </Tab.Screen>
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: theme.colors.background, // #000000
    borderTopWidth: 0, // Remove border to eliminate white line on Android
    paddingTop: 10,
    paddingBottom: 10,
    height: 85,
    elevation: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },

  tabBarLabel: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    marginTop: 4,
  },

  tabIcon: {
    marginBottom: 2,
  },

  tabContent: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  teamsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },

  createButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },

  createButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.background,
    lineHeight: 24,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  loadingText: {
    color: theme.colors.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },

  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.colors.border,
    borderRadius: 8,
  },

  retryText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
  },
});
