/**
 * RUNSTR App Root Component
 * Simplified app using AuthContext for state management
 * iOS-inspired architecture with single source of truth
 */

// SENIOR DEVELOPER FIX: Initialize WebSocket polyfill early
import { initializeWebSocketPolyfill } from './utils/webSocketPolyfill';
import * as ExpoSplashScreen from 'expo-splash-screen';
import * as TaskManager from 'expo-task-manager';

// Background location task imported in index.js (before app initialization)
// Only import the functions we need here
import {
  BACKGROUND_LOCATION_TASK,
  stopBackgroundLocationTracking,
} from './services/activity/BackgroundLocationTask';

import React from 'react';
import {
  StatusBar,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  Platform,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';

// Error Boundary Component to catch runtime errors during initialization
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 AppErrorBoundary caught error:', error);
    console.error('🚨 Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaProvider>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
          <View style={errorStyles.container}>
            <Text style={errorStyles.title}>🚨 App Error</Text>
            <Text style={errorStyles.error}>
              {this.state.error?.message || 'Unknown error occurred'}
            </Text>
            <Text style={errorStyles.instruction}>Please restart the app</Text>
          </View>
        </SafeAreaProvider>
      );
    }

    return this.props.children;
  }
}

/**
 * Screen-level error boundary for catching errors in individual screens
 * Prevents white screen crashes by showing error UI and allowing navigation back
 */
class ScreenErrorBoundary extends React.Component<
  { children: React.ReactNode; navigation: any },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; navigation: any }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🔴 ScreenErrorBoundary caught error:', error);
    console.error('🔴 Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Screen Error</Text>
          <Text style={errorStyles.error}>
            {this.state.error?.message || 'Failed to load screen'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              this.setState({ hasError: false, error: undefined });
              this.props.navigation.goBack();
            }}
            style={{
              marginTop: 20,
              padding: 12,
              backgroundColor: '#1a1a1a',
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#FFFFFF' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator } from 'react-native';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NavigationDataProvider } from './contexts/NavigationDataContext';
import { AppNavigator } from './navigation/AppNavigator';
import { BottomTabNavigator } from './navigation/BottomTabNavigator';
import { createStackNavigator } from '@react-navigation/stack';
import { TeamCreationWizard } from './components/wizards/TeamCreationWizard';
import { EventDetailScreen } from './screens/EventDetailScreen';
import { LeagueDetailScreen } from './screens/LeagueDetailScreen';
// Use SimpleTeamScreen instead of EnhancedTeamScreen to avoid freeze issues
const SimpleTeamScreen = React.lazy(() => import('./screens/SimpleTeamScreen'));
import { CaptainDashboardScreen } from './screens/CaptainDashboardScreen';
import { HelpSupportScreen } from './screens/HelpSupportScreen';
import { ContactSupportScreen } from './screens/ContactSupportScreen';
import { PrivacyPolicyScreen } from './screens/PrivacyPolicyScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { CompetitionsListScreen } from './screens/CompetitionsListScreen';
import { WorkoutHistoryScreen } from './screens/WorkoutHistoryScreen';
import { MyTeamsScreen } from './screens/MyTeamsScreen';
import { ProfileEditScreen } from './screens/ProfileEditScreen';
import { SavedRoutesScreen } from './screens/routes/SavedRoutesScreen';
import { AdvancedAnalyticsScreen } from './screens/AdvancedAnalyticsScreen';
import { HealthProfileScreen } from './screens/HealthProfileScreen';
import { User } from './types';
import { useWalletStore } from './store/walletStore';
import { theme } from './styles/theme';
import unifiedCache from './services/cache/UnifiedNostrCache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  safeGetItem,
  safeSetItem,
  safeMultiGet,
  safeRemoveItem,
} from './utils/asyncStorageTimeout';
import { PerformanceLogger } from './utils/PerformanceLogger';
import { AppStateManager } from './services/core/AppStateManager';
import { appPermissionService } from './services/initialization/AppPermissionService';
import { PermissionRequestModal } from './components/permissions/PermissionRequestModal';
import { WelcomePermissionModal } from './components/onboarding/WelcomePermissionModal';
import garminAuthService from './services/fitness/garminAuthService';
import AppInitializationService from './services/core/AppInitializationService';
import {
  CustomAlertProvider,
  CustomAlertManager,
} from './components/ui/CustomAlert';
import {
  parseEventDeepLink,
  type ParsedEventData,
} from './utils/eventDeepLink';

// Types for authenticated app navigation
type AuthenticatedStackParamList = {
  Auth: undefined;
  Main: undefined;
  MainTabs: undefined;
  TeamCreation: undefined;
  EnhancedTeamScreen: {
    team: any;
    userIsMember?: boolean;
    currentUserNpub?: string;
    userIsCaptain?: boolean;
  };
  EventDetail: {
    eventId: string;
    eventData?: any;
    teamId?: string; // ✅ NEW: Team context for fallback
    captainPubkey?: string; // ✅ NEW: Captain context for fallback
  };
  LeagueDetail: { leagueId: string; leagueData?: any };
  CaptainDashboard: {
    teamId?: string;
    teamName?: string;
    teamCaptainId?: string;
    isCaptain?: boolean;
    userNpub?: string;
  };
  Settings: any;
  HelpSupport: undefined;
  ContactSupport: undefined;
  PrivacyPolicy: undefined;
  CompetitionsList: undefined;
  WorkoutHistory: { userId: string; pubkey: string };
  MyTeams: undefined;
  ProfileEdit: undefined;
  SavedRoutes: { activityType?: 'running' | 'cycling' | 'walking' };
  AdvancedAnalytics: undefined;
  HealthProfile: undefined;
};

const AuthenticatedStack = createStackNavigator<AuthenticatedStackParamList>();

// Main app content that uses the AuthContext
interface AppContentProps {
  onPermissionComplete?: () => void;
}

const AppContent: React.FC<AppContentProps> = ({ onPermissionComplete }) => {
  const {
    isInitializing,
    isAuthenticated,
    currentUser,
    connectionStatus,
    isConnected,
    initError,
    signOut,
  } = useAuth();

  // Initialize AppStateManager as early as possible
  React.useEffect(() => {
    console.log(
      '[App] 🎯 Initializing AppStateManager - Single source of truth'
    );
    AppStateManager.initialize();
  }, []);

  const [showWelcomeModal, setShowWelcomeModal] = React.useState(false);
  const [showPermissionModal, setShowPermissionModal] = React.useState(false);
  const [hasInitialized, setHasInitialized] = React.useState(false);

  // Event deep link state
  const [pendingEventNavigation, setPendingEventNavigation] =
    React.useState<ParsedEventData | null>(null);
  const navigationRef = React.useRef<any>(null);

  // Start background data initialization and check for first launch
  // Check for first launch when authenticated
  React.useEffect(() => {
    if (isAuthenticated && currentUser) {
      // Check first launch asynchronously (non-blocking)
      safeGetItem('@runstr:first_launch', 2000, null).then((firstLaunch) => {
        if (firstLaunch !== 'false') {
          console.log('👋 App: First launch detected - showing welcome modal');
          setShowWelcomeModal(true);
          // Mark as not first launch anymore
          safeSetItem('@runstr:first_launch', 'false', 2000);
        }
      });
    }
  }, [isAuthenticated, currentUser]);

  // Initialize AFTER modal closes to prevent freeze
  React.useEffect(() => {
    if (
      isAuthenticated &&
      currentUser &&
      !showPermissionModal &&
      !hasInitialized
    ) {
      console.log(
        '✅ App: Permission modal closed, scheduling initialization...'
      );

      // Now that animations are removed, both platforms can use the same delay
      const INIT_DELAY = 500;
      console.log(
        `⏱️ Using ${Platform.OS} initialization delay: ${INIT_DELAY}ms`
      );

      const timer = setTimeout(() => {
        console.log('🚀 App: Starting background initialization NOW...');
        setHasInitialized(true);

        // Add error boundary around initialization
        AppInitializationService.initializeInBackground()
          .then(() => {
            console.log('✅ App: Background initialization completed');
          })
          .catch((error) => {
            console.error('❌ Background initialization error:', error);
            // App can continue with cached data even if initialization fails
          });
      }, INIT_DELAY);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, currentUser, showPermissionModal, hasInitialized]);

  // Check permissions when user becomes authenticated (both iOS and Android)
  React.useEffect(() => {
    const checkPermissions = async () => {
      if (isAuthenticated) {
        console.log('[App] 🔐 Checking permissions...');
        const status = await appPermissionService.checkAllPermissions();

        if (!status.allGranted) {
          console.log('[App] ⚠️ Missing permissions, showing modal');
          setShowPermissionModal(true);
        } else {
          console.log('[App] ✅ All permissions granted');
        }
      }
    };
    checkPermissions();
  }, [isAuthenticated]);

  // Handle pending event navigation when navigation is ready
  React.useEffect(() => {
    if (
      pendingEventNavigation &&
      navigationRef.current &&
      isAuthenticated &&
      currentUser
    ) {
      console.log(
        '🎯 Navigating to event from deep link:',
        pendingEventNavigation.eventId
      );

      // Small delay to ensure navigation stack is ready
      setTimeout(() => {
        try {
          navigationRef.current?.navigate('EventDetail', {
            eventId: pendingEventNavigation.eventId,
          });
          setPendingEventNavigation(null);
        } catch (error) {
          console.error('❌ Failed to navigate to event:', error);
          CustomAlertManager.alert(
            'Navigation Error',
            'Failed to open event. Please try again.'
          );
          setPendingEventNavigation(null);
        }
      }, 500);
    }
  }, [pendingEventNavigation, isAuthenticated, currentUser]);

  // Handle deep links (Garmin OAuth and Challenge QR codes)
  React.useEffect(() => {
    const handleDeepLink = async ({ url }: { url: string }) => {
      console.log('🔗 Deep link received:', url);

      const { hostname, path, queryParams } = Linking.parse(url);
      console.log('📍 Parsed deep link:', { hostname, path, queryParams });

      // Handle Garmin OAuth callback: runstr://oauth/garmin?code=ABC123&state=xyz
      if (path === 'oauth/garmin' && queryParams?.code) {
        console.log('🔐 Garmin OAuth callback detected');
        console.log('   Code:', queryParams.code);
        console.log('   State:', queryParams.state || 'not provided');

        try {
          const result = await garminAuthService.handleOAuthCallback(
            queryParams.code as string,
            queryParams.state as string | undefined
          );

          if (result.success) {
            CustomAlertManager.alert(
              'Success',
              'Garmin connected! You can now sync your workouts.',
              [{ text: 'OK' }]
            );
          } else {
            CustomAlertManager.alert(
              'Connection Failed',
              result.error || 'Failed to connect Garmin. Please try again.'
            );
          }
        } catch (error) {
          console.error('❌ Failed to handle Garmin OAuth callback:', error);
          CustomAlertManager.alert(
            'Error',
            'Failed to connect Garmin. Please try again.'
          );
        }
        return;
      }

      // Handle Event deep link: runstr://event/{eventId}?team={teamId}&name={eventName}
      if (path?.startsWith('event/') || url.includes('runstr://event/')) {
        console.log('🎯 Event deep link detected');

        try {
          const parsedEvent = parseEventDeepLink(url);
          console.log('📦 Parsed event data:', parsedEvent);

          if (parsedEvent.isValid && parsedEvent.eventId) {
            console.log('✅ Valid event data - storing for navigation');
            // Store event data for navigation after app is ready
            setPendingEventNavigation(parsedEvent);
          } else {
            console.error('❌ Invalid event data:', parsedEvent.error);
            CustomAlertManager.alert(
              'Invalid Event',
              parsedEvent.error || 'This event link is invalid or expired.'
            );
          }
        } catch (error) {
          console.error('❌ Failed to parse event deep link:', error);
          CustomAlertManager.alert(
            'Error',
            'Failed to process event link. Please try again.'
          );
        }
        return;
      }
    };

    // Listen for deep links when app is already open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened via deep link (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🔗 App opened via deep link (cold start):', url);
        handleDeepLink({ url });
      }
    });

    return () => subscription.remove();
  }, []);

  // PERFORMANCE OPTIMIZATION: App state detection for smart resume
  const walletStore = useWalletStore();
  const appState = React.useRef(AppState.currentState);
  const backgroundTime = React.useRef<number>(0);

  // ⚠️ AppState management is now handled by AppStateManager
  // This prevents multiple conflicting listeners and race conditions
  // that were causing instant crashes on Android in v0.6.2-v0.6.5
  // AppStateManager is the SINGLE source of truth for app state

  // Authenticated app with bottom tabs and team creation modal
  const AuthenticatedNavigator: React.FC<{ user: User }> = ({ user }) => {
    // Initialize app data when user is authenticated
    React.useEffect(() => {
      const initializeData = async () => {
        try {
          // ✅ PERFORMANCE: Batch read multiple AsyncStorage keys with timeout
          const keys = [
            '@runstr:app_init_completed',
            '@runstr:hex_pubkey',
            '@runstr:npub',
          ];
          const results = await safeMultiGet(keys, 3000);

          const initCompleted = results.find(
            ([k]) => k === '@runstr:app_init_completed'
          )?.[1];
          const hexPubkey = results.find(
            ([k]) => k === '@runstr:hex_pubkey'
          )?.[1];
          const npub = results.find(([k]) => k === '@runstr:npub')?.[1];

          if (initCompleted === 'true') {
            console.log(
              '[App] ℹ️  App already initialized, skipping duplicate initialization'
            );
            return;
          }

          // CRITICAL FIX: Get actual hex pubkey from AsyncStorage, NOT synthetic user.id
          // user.id is 'nostr_hh6sr85uum' but we need actual hex for Nostr queries
          const pubkey = hexPubkey || npub;

          if (!pubkey) {
            console.warn(
              '[App] Cannot initialize app data: no pubkey available'
            );
            return;
          }

          console.log(
            '[App] 🚀 Authenticated user detected, cleanup starting...'
          );

          // Removed duplicate appInitializationService.initializeAppData(pubkey) call
          // The new AppInitializationService.initializeInBackground() already handles this

          // ✅ CLEANUP: Defer event snapshot cleanup to prevent UI blocking
          setTimeout(async () => {
            try {
              const { EventSnapshotStore } = await import(
                './services/event/EventSnapshotStore'
              );
              const removed = await EventSnapshotStore.cleanupExpired();
              if (removed > 0) {
                console.log(`🧹 Cleaned up ${removed} expired event snapshots`);
              }
            } catch (error) {
              console.warn(
                '⚠️ Event snapshot cleanup failed (non-critical):',
                error
              );
            }
          }, 1000); // Defer by 1 second to let UI settle

          // ❌ CASHU WALLET DISABLED: Removed in favor of NWC (v0.2.4+)
          // This initialization triggered Amber signing prompts for Cashu wallet encryption
          // NWC wallet services now handle all Lightning payments independently
          console.log(
            '[App] 💰 Cashu wallet initialization skipped (using NWC for Lightning payments)'
          );

          // ✅ NWC WALLET: Defer wallet initialization to prevent UI blocking
          setTimeout(async () => {
            try {
              console.log('[App] 💳 Initializing NWC wallet connection...');
              const { NWCWalletService } = await import(
                './services/wallet/NWCWalletService'
              );
              await NWCWalletService.initialize();
              console.log('[App] ✅ NWC wallet initialization attempted');
            } catch (nwcError) {
              console.error(
                '[App] ⚠️ NWC wallet initialization failed (non-critical):',
                nwcError
              );
              // Don't block app - NWC wallet is optional
            }
          }, 2000); // Defer by 2 seconds to prioritize UI rendering

          /*
          if (!walletStore.isInitialized && !walletStore.isInitializing) {
            await walletStore.initialize();
            console.log('[App] ✅ Wallet initialization complete');
          } else {
            console.log('[App] ℹ️  Wallet already initialized, skipping');
          }
          */

          // ❌ REMOVED: ChallengeCompletionService background monitoring
          // This was causing Android crashes due to background Nostr queries
          // Challenges now expire on-demand when users view them
          console.log(
            '[App] ⚠️  Background challenge monitoring DISABLED for Android stability'
          );

          // ✅ PERFORMANCE: Mark initialization as complete
          await safeSetItem('@runstr:app_init_completed', 'true', 2000);
          console.log('[App] ✅ App initialization complete - flag set');
        } catch (error) {
          console.error('[App] ❌ App data initialization error:', error);
          // Don't block app - initialization errors are non-critical
        }
      };

      initializeData();

      // Cleanup: No background services to stop
      return () => {
        console.log('[App] 🛑 Component unmounting (user logged out)');
      };
    }, [user.id]);

    return (
      <AuthenticatedStack.Navigator
        screenOptions={{
          headerShown: false,
          presentation: 'modal',
        }}
      >
        {/* Main bottom tabs */}
        <AuthenticatedStack.Screen
          name="MainTabs"
          options={{ headerShown: false }}
        >
          {({ navigation }) => (
            <BottomTabNavigator
              onNavigateToTeamCreation={() => {
                navigation.navigate('TeamCreation');
              }}
              onSignOut={signOut}
            />
          )}
        </AuthenticatedStack.Screen>

        {/* Team Creation Modal */}
        <AuthenticatedStack.Screen
          name="TeamCreation"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        >
          {({ navigation }) => (
            <TeamCreationWizard
              currentUser={user}
              onComplete={(teamData, teamId) => {
                console.log('Team creation complete:', teamData, teamId);
                navigation.goBack(); // Return to tabs
              }}
              onCancel={() => {
                navigation.goBack(); // Return to tabs
              }}
            />
          )}
        </AuthenticatedStack.Screen>

        {/* Enhanced Team Screen */}
        <AuthenticatedStack.Screen
          name="EnhancedTeamScreen"
          options={{
            headerShown: false,
          }}
        >
          {({ navigation, route }) => {
            console.log('[App.tsx] 🚀 EnhancedTeamScreen route rendering');
            const {
              team,
              userIsMember = false,
              currentUserNpub,
              userIsCaptain = false,
            } = route.params || {};
            console.log('[App.tsx] 📦 Route params:', {
              hasRouteParams: !!route.params,
              hasTeam: !!team,
              teamId: team?.id,
              teamName: team?.name,
              teamKeys: team ? Object.keys(team).length : 0,
              allTeamKeys: team ? Object.keys(team) : [],
              userIsMember,
              userIsCaptain,
              currentUserNpub: currentUserNpub?.slice(0, 20) + '...',
            });

            // Safety check: if no team data, show error
            if (!team || !team.id) {
              console.error('[App.tsx] ❌ No valid team data in route params');
              return (
                <View
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: theme.colors.background,
                  }}
                >
                  <Text style={{ color: theme.colors.text, marginBottom: 20 }}>
                    Team data not available
                  </Text>
                  <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{
                      padding: 12,
                      backgroundColor: theme.colors.cardBackground,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: theme.colors.text }}>Go Back</Text>
                  </TouchableOpacity>
                </View>
              );
            }

            console.log(
              '[App.tsx] ⏳ SUSPENSE FALLBACK RENDERING - Waiting for lazy component'
            );
            return (
              <ScreenErrorBoundary navigation={navigation}>
                <React.Suspense
                  fallback={
                    <View
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: theme.colors.background,
                      }}
                    >
                      <ActivityIndicator
                        size="large"
                        color={theme.colors.text}
                      />
                    </View>
                  }
                >
                  <SimpleTeamScreen
                    data={{
                      team: team,
                      leaderboard: [],
                      events: [],
                    }}
                    onBack={() => navigation.goBack()}
                    onCaptainDashboard={() => {
                      console.log('Captain dashboard from EnhancedTeamScreen');
                      console.log(
                        'Navigating to CaptainDashboard with team:',
                        team?.id
                      );
                      console.log(
                        'Team object has captainId field:',
                        'captainId' in (team || {})
                      );
                      console.log('Team captainId value:', team?.captainId);
                      console.log(
                        'Team captainId length:',
                        team?.captainId?.length
                      );
                      console.log(
                        'Team captainId format:',
                        team?.captainId?.startsWith('npub')
                          ? 'npub'
                          : team?.captainId?.length === 64
                          ? 'hex'
                          : 'other'
                      );
                      console.log(
                        'Passing userNpub:',
                        currentUserNpub?.slice(0, 20) + '...'
                      );

                      // Ensure we pass the captain ID in hex format
                      const teamCaptainIdToPass = team?.captainId || '';
                      console.log(
                        'Final teamCaptainId being passed:',
                        teamCaptainIdToPass?.slice(0, 20) + '...'
                      );

                      navigation.navigate('CaptainDashboard', {
                        teamId: team?.id,
                        teamName: team?.name,
                        teamCaptainId: teamCaptainIdToPass, // Pass the team's captain ID
                        isCaptain: true,
                        userNpub: currentUserNpub,
                      });
                    }}
                    onEventPress={(eventId, eventData) => {
                      console.log('📍 Navigation: Team → Event Detail');
                      console.log('  eventId:', eventId);
                      console.log(
                        '  eventData:',
                        eventData ? 'provided' : 'not provided'
                      );
                      console.log('  team context:', {
                        teamId: team?.id,
                        captainId: team?.captainId?.slice(0, 20) + '...',
                      });
                      // ✅ FIX: Pass team context explicitly to prevent missing teamId/captainPubkey crash
                      navigation.navigate('EventDetail', {
                        eventId,
                        eventData,
                        teamId: team?.id, // Explicit team context
                        captainPubkey: team?.captainId, // Explicit captain context
                      });
                    }}
                    onLeaguePress={(leagueId, leagueData) => {
                      console.log('📍 Navigation: Team → League Detail');
                      console.log('  leagueId:', leagueId);
                      navigation.navigate('LeagueDetail', {
                        leagueId,
                        leagueData,
                      });
                    }}
                    showJoinButton={!userIsMember}
                    userIsMemberProp={userIsMember}
                    currentUserNpub={currentUserNpub}
                    userIsCaptain={userIsCaptain}
                  />
                </React.Suspense>
              </ScreenErrorBoundary>
            );
          }}
        </AuthenticatedStack.Screen>

        {/* Event Detail Screen */}
        <AuthenticatedStack.Screen
          name="EventDetail"
          options={{
            headerShown: false,
          }}
        >
          {({ navigation, route }) => (
            <EventDetailScreen route={route} navigation={navigation} />
          )}
        </AuthenticatedStack.Screen>

        {/* League Detail Screen */}
        <AuthenticatedStack.Screen
          name="LeagueDetail"
          options={{
            headerShown: false,
          }}
        >
          {({ navigation, route }) => (
            <LeagueDetailScreen route={route} navigation={navigation} />
          )}
        </AuthenticatedStack.Screen>

        {/* Captain Dashboard Screen */}
        <AuthenticatedStack.Screen
          name="CaptainDashboard"
          options={{
            headerShown: false,
          }}
        >
          {({ navigation, route }) => {
            const { teamId, teamName, teamCaptainId, isCaptain, userNpub } =
              route.params || {};
            return (
              <CaptainDashboardScreen
                data={{
                  team: {
                    id: teamId || '',
                    name: teamName || 'Team',
                    memberCount: 0,
                    activeEvents: 0,
                    prizePool: 0,
                  },
                  members: [],
                  recentActivity: [],
                }}
                teamId={teamId || ''}
                captainId={teamCaptainId || user.npub || user.id}
                userNpub={userNpub}
                onNavigateToTeam={() => navigation.goBack()}
                onNavigateToProfile={() => navigation.goBack()}
                onSettingsPress={() => console.log('Settings')}
                onKickMember={(memberId) =>
                  console.log('Kick member:', memberId)
                }
                onViewAllActivity={() => console.log('View all activity')}
              />
            );
          }}
        </AuthenticatedStack.Screen>

        {/* Settings Screen */}
        <AuthenticatedStack.Screen
          name="Settings"
          options={{
            headerShown: false,
          }}
        >
          {({ navigation, route }) => (
            <SettingsScreen
              currentTeam={route.params?.currentTeam}
              onNavigateToTeamDiscovery={
                route.params?.onNavigateToTeamDiscovery
              }
              onViewCurrentTeam={route.params?.onViewCurrentTeam}
              onCaptainDashboard={route.params?.onCaptainDashboard}
              onHelp={() => navigation.navigate('HelpSupport')}
              onContactSupport={() => navigation.navigate('ContactSupport')}
              onPrivacyPolicy={() => navigation.navigate('PrivacyPolicy')}
              onSignOut={async () => {
                // Reset initialization state on logout
                await AppInitializationService.reset();
                // ✅ PERFORMANCE: Clear initialization flag for next login
                await safeRemoveItem('@runstr:app_init_completed', 2000);
                await signOut();
                // AuthContext state change will trigger App.tsx to show login screen
              }}
            />
          )}
        </AuthenticatedStack.Screen>

        {/* Help & Support Screen */}
        <AuthenticatedStack.Screen
          name="HelpSupport"
          options={{
            headerShown: false,
          }}
          component={HelpSupportScreen}
        />

        {/* Contact Support Screen */}
        <AuthenticatedStack.Screen
          name="ContactSupport"
          options={{
            headerShown: false,
          }}
          component={ContactSupportScreen}
        />

        {/* Privacy Policy Screen */}
        <AuthenticatedStack.Screen
          name="PrivacyPolicy"
          options={{
            headerShown: false,
          }}
          component={PrivacyPolicyScreen}
        />

        {/* Competitions List Screen */}
        <AuthenticatedStack.Screen
          name="CompetitionsList"
          options={{
            headerShown: false,
          }}
          component={CompetitionsListScreen}
        />

        {/* Workout History Screen */}
        <AuthenticatedStack.Screen
          name="WorkoutHistory"
          options={{
            headerShown: false,
          }}
          component={WorkoutHistoryScreen}
        />

        {/* My Teams Screen */}
        <AuthenticatedStack.Screen
          name="MyTeams"
          options={{
            headerShown: false,
          }}
          component={MyTeamsScreen}
        />

        {/* Profile Edit Screen */}
        <AuthenticatedStack.Screen
          name="ProfileEdit"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
          component={ProfileEditScreen}
        />

        {/* Saved Routes Screen - Manage GPS routes */}
        <AuthenticatedStack.Screen
          name="SavedRoutes"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
          component={SavedRoutesScreen}
        />

        {/* Advanced Analytics Screen - Workout analytics dashboard */}
        <AuthenticatedStack.Screen
          name="AdvancedAnalytics"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
          component={AdvancedAnalyticsScreen}
        />

        {/* Health Profile Screen - Health data for analytics */}
        <AuthenticatedStack.Screen
          name="HealthProfile"
          options={{
            headerShown: false,
          }}
          component={HealthProfileScreen}
        />
      </AuthenticatedStack.Navigator>
    );
  };

  // Show error screen if initialization failed
  if (initError && !isInitializing) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>🚨 Initialization Error</Text>
          <Text style={errorStyles.error}>{initError}</Text>
          <Text style={errorStyles.instruction}>Please restart the app</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  // Simplified navigation - show login or main app immediately
  // No splash screens, no onboarding screens

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <NavigationContainer ref={navigationRef}>
        {(() => {
          console.log(
            '🚀 AppContent: Navigation decision - isAuthenticated:',
            isAuthenticated,
            'currentUser:',
            !!currentUser,
            'isInitializing:',
            isInitializing
          );

          // Show login if not authenticated
          if (!isAuthenticated) {
            return <AppNavigator initialRoute="Login" isFirstTime={true} />;
          }

          // User is authenticated but profile still loading
          if (isAuthenticated && !currentUser) {
            return (
              <View style={errorStyles.container}>
                <ActivityIndicator size="large" color="#ffffff" />
                <Text style={errorStyles.instruction}>
                  Loading your profile...
                </Text>
              </View>
            );
          }

          // Show main app immediately after authentication
          if (isAuthenticated && currentUser) {
            return <AuthenticatedNavigator user={currentUser} />;
          }

          // Fallback to login
          return <AppNavigator initialRoute="Login" isFirstTime={true} />;
        })()}
      </NavigationContainer>

      {/* Welcome Permission Modal - Shows on first app launch */}
      <WelcomePermissionModal
        visible={showWelcomeModal}
        onComplete={() => setShowWelcomeModal(false)}
      />

      {/* Permission Request Modal - Shows when Android permissions are missing */}
      {showPermissionModal && (
        <PermissionRequestModal
          visible={showPermissionModal}
          onComplete={() => {
            setShowPermissionModal(false);
            // Notify parent that permissions are complete (enables NavigationDataContext init)
            if (onPermissionComplete) {
              onPermissionComplete();
            }
          }}
        />
      )}
    </SafeAreaProvider>
  );
};

// Prevent splash screen from auto-hiding immediately
ExpoSplashScreen.preventAutoHideAsync();

// Main App component with AuthProvider wrapper and Error Boundary
export default function App() {
  const [appIsReady, setAppIsReady] = React.useState(false);

  React.useEffect(() => {
    async function prepare() {
      try {
        // SENIOR DEVELOPER FIX: Initialize WebSocket polyfill immediately with error handling
        try {
          initializeWebSocketPolyfill();
        } catch (error) {
          console.error('🚨 WebSocket polyfill initialization failed:', error);
          // App can continue without polyfill in most cases
        }

        // Enable WebSocket debugging in development mode for NWC troubleshooting
        if (__DEV__) {
          try {
            const { enableWebSocketDebugging } = await import(
              './utils/webSocketDebugger'
            );
            enableWebSocketDebugging();
            console.log(
              '[App] 🔍 WebSocket debugger enabled for NWC troubleshooting'
            );
          } catch (debugError) {
            console.warn(
              '[App] Failed to enable WebSocket debugger:',
              debugError
            );
            // Non-critical - app continues without debugger
          }
        }

        // 🔧 iOS FIX: Verify background location task is defined for distance tracking
        try {
          const isTaskDefined = await TaskManager.isTaskDefined(
            BACKGROUND_LOCATION_TASK
          );
          const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(
            BACKGROUND_LOCATION_TASK
          );

          console.log(
            `📍 Background task status - Defined: ${isTaskDefined}, Registered: ${isTaskRegistered}`
          );

          if (!isTaskDefined) {
            console.error(
              '❌ Background location task NOT defined - distance tracking will fail'
            );
            console.error(
              '   This should not happen - check BackgroundLocationTask import'
            );
          } else {
            console.log(
              '✅ Background location task defined and ready for distance tracking'
            );

            // 🔧 ZOMBIE SESSION CLEANUP: Stop any registered background tasks from previous sessions
            // This prevents the activity tracker from appearing to auto-start when navigating to Activity tab
            if (isTaskRegistered) {
              console.log(
                '⚠️  Background task registered from previous session - cleaning up zombie session'
              );
              try {
                await stopBackgroundLocationTracking();

                // ✅ FIX: Also reset the service's internal state
                // This ensures isTracking=false even if service singleton persists
                const { simpleLocationTrackingService } = await import(
                  './services/activity/SimpleLocationTrackingService'
                );
                await simpleLocationTrackingService.stopTracking();

                await safeRemoveItem('@runstr:active_session_state', 2000);
                await safeRemoveItem('@runstr:background_distance_state', 2000);
                console.log('✅ Zombie session cleaned up successfully');
              } catch (cleanupError) {
                console.warn(
                  '⚠️  Failed to cleanup zombie session:',
                  cleanupError
                );
                // Don't block app startup if cleanup fails
              }
            }
          }
        } catch (error) {
          console.error('❌ Failed to check background task status:', error);
          // Don't block app initialization - tracking will fall back to foreground only
        }

        // Give app a moment to ensure black background is set
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Pre-load any critical resources here if needed
        console.log('🚀 App initialization complete');
      } catch (e) {
        console.warn('App initialization warning:', e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = React.useCallback(async () => {
    if (appIsReady) {
      // Hide the splash screen once the app is ready and layout is complete
      await ExpoSplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null; // Keep showing the native splash screen
  }

  return (
    <AppErrorBoundary>
      <CustomAlertProvider>
        <AuthProvider>
          <NavigationDataProvider>
            <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
              <AppContent />
            </View>
          </NavigationDataProvider>
        </AuthProvider>
      </CustomAlertProvider>
    </AppErrorBoundary>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    color: '#ff4444',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  error: {
    color: theme.colors.text,
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  instruction: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
  },
});
