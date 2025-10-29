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
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator } from 'react-native';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NavigationDataProvider } from './contexts/NavigationDataContext';
import { AppNavigator } from './navigation/AppNavigator';
import { BottomTabNavigator } from './navigation/BottomTabNavigator';
import { createStackNavigator } from '@react-navigation/stack';
import { TeamCreationWizard } from './components/wizards/TeamCreationWizard';
import { GlobalChallengeWizard } from './components/wizards/GlobalChallengeWizard';
import { EventDetailScreen } from './screens/EventDetailScreen';
import { EventCaptainDashboardScreen } from './screens/EventCaptainDashboardScreen';
import { LeagueDetailScreen } from './screens/LeagueDetailScreen';
import { ChallengeDetailScreen } from './screens/ChallengeDetailScreen';
// Use SimpleTeamScreen instead of EnhancedTeamScreen to avoid freeze issues
const SimpleTeamScreen = React.lazy(() => import('./screens/SimpleTeamScreen'));
import { CaptainDashboardScreen } from './screens/CaptainDashboardScreen';
import { HelpSupportScreen } from './screens/HelpSupportScreen';
import { ContactSupportScreen } from './screens/ContactSupportScreen';
import { PrivacyPolicyScreen } from './screens/PrivacyPolicyScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { SplashInitScreen } from './screens/SplashInitScreen';
import { CompetitionsListScreen } from './screens/CompetitionsListScreen';
import { WorkoutHistoryScreen } from './screens/WorkoutHistoryScreen';
import { MyTeamsScreen } from './screens/MyTeamsScreen';
import { ProfileEditScreen } from './screens/ProfileEditScreen';
import { SavedRoutesScreen } from './screens/routes/SavedRoutesScreen';
import { AdvancedAnalyticsScreen } from './screens/AdvancedAnalyticsScreen';
import { HealthProfileScreen } from './screens/HealthProfileScreen';
import { User } from './types';
import { useWalletStore } from './store/walletStore';
import { appInitializationService } from './services/initialization/AppInitializationService';
import { theme } from './styles/theme';
import unifiedCache from './services/cache/UnifiedNostrCache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { challengeCompletionService } from './services/challenge/ChallengeCompletionService';
import { appPermissionService } from './services/initialization/AppPermissionService';
import { PermissionRequestModal } from './components/permissions/PermissionRequestModal';
import garminAuthService from './services/fitness/garminAuthService';
import {
  CustomAlertProvider,
  CustomAlertManager,
} from './components/ui/CustomAlert';
import { ChallengePreviewModal } from './components/challenge/ChallengePreviewModal';
import { parseChallengeDeepLink, type ParsedChallengeData } from './utils/challengeDeepLink';
import { challengeRequestService } from './services/challenge/ChallengeRequestService';
import { parseEventDeepLink, type ParsedEventData } from './utils/eventDeepLink';

// Types for authenticated app navigation
type AuthenticatedStackParamList = {
  SplashInit: undefined;
  Auth: undefined;
  Main: undefined;
  MainTabs: undefined;
  Onboarding: { nsec?: string };
  TeamCreation: undefined;
  EnhancedTeamScreen: {
    team: any;
    userIsMember?: boolean;
    currentUserNpub?: string;
    userIsCaptain?: boolean;
  };
  EventDetail: { eventId: string; eventData?: any }; // Fixed: Added optional eventData parameter
  EventCaptainDashboard: { eventId: string; eventData: any };
  LeagueDetail: { leagueId: string; leagueData?: any };
  ChallengeDetail: { challengeId: string };
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
  ChallengeWizard: undefined;
  ChallengeLeaderboard: { challengeId: string };
  WorkoutHistory: { userId: string; pubkey: string };
  MyTeams: undefined;
  ProfileEdit: undefined;
  SavedRoutes: { activityType?: 'running' | 'cycling' | 'walking' };
  AdvancedAnalytics: undefined;
  HealthProfile: undefined;
};

const AuthenticatedStack = createStackNavigator<AuthenticatedStackParamList>();

// Main app content that uses the AuthContext
const AppContent: React.FC = () => {
  const {
    isInitializing,
    isAuthenticated,
    currentUser,
    connectionStatus,
    isConnected,
    initError,
    signOut,
  } = useAuth();

  const [onboardingCompleted, setOnboardingCompleted] = React.useState<
    boolean | null
  >(null);
  const [prefetchCompleted, setPrefetchCompleted] = React.useState(false);
  const [showPermissionModal, setShowPermissionModal] = React.useState(false);

  // Challenge deep link state
  const [showChallengePreview, setShowChallengePreview] = React.useState(false);
  const [challengeData, setChallengeData] = React.useState<ParsedChallengeData | null>(null);

  // Event deep link state
  const [pendingEventNavigation, setPendingEventNavigation] = React.useState<ParsedEventData | null>(null);
  const navigationRef = React.useRef<any>(null);

  // ✅ PERFORMANCE: Use cache-first strategy - show app immediately if ANY cache exists
  React.useEffect(() => {
    const checkPrefetch = async () => {
      if (isAuthenticated) {
        // ✅ FIX: Check AsyncStorage synchronously for cached keys instead of waiting for hydration
        // This prevents race conditions where cache hydration hasn't finished yet
        const keys = await AsyncStorage.getAllKeys();
        const hasCachedData = keys.some((key) =>
          key.startsWith('@runstr:unified_cache:')
        );

        console.log(
          '📊 App: Cache-first check - found',
          keys.filter((k) => k.startsWith('@runstr:unified_cache:')).length,
          'cached entries'
        );

        // Show app immediately if we have ANY cached data
        // First-time users (no cache) will see SplashInit
        // Returning users (has cache) see app immediately, refresh happens in background
        setPrefetchCompleted(hasCachedData);

        if (hasCachedData) {
          console.log(
            '✅ App: Cached data found - skipping SplashInit for instant load'
          );
        } else {
          console.log(
            '⚡ App: No cached data - showing SplashInit for first-time initialization'
          );
        }
      } else {
        setPrefetchCompleted(false);
      }
    };
    checkPrefetch();
  }, [isAuthenticated]);

  // Check onboarding completion status when user becomes authenticated
  React.useEffect(() => {
    const checkOnboarding = async () => {
      if (isAuthenticated && currentUser) {
        const AsyncStorage = (
          await import('@react-native-async-storage/async-storage')
        ).default;

        // Check if onboarding was already completed
        const completed = await AsyncStorage.getItem(
          '@runstr:onboarding_completed'
        );

        // Check if this is a new signup (from "Start" button)
        const isNewSignup = await AsyncStorage.getItem('@runstr:is_new_signup');

        // Only show onboarding if:
        // 1. This is a new signup (Start button was clicked)
        // 2. AND onboarding hasn't been completed yet
        const needsOnboarding = isNewSignup === 'true' && completed !== 'true';

        setOnboardingCompleted(!needsOnboarding);
        console.log(
          '🎯 App: Onboarding check - isNewSignup:',
          isNewSignup === 'true',
          'completed:',
          completed === 'true',
          'needsOnboarding:',
          needsOnboarding
        );
      } else {
        setOnboardingCompleted(null);
      }
    };
    checkOnboarding();
  }, [isAuthenticated, currentUser]);

  // Check permissions when user becomes authenticated (Android only)
  React.useEffect(() => {
    const checkPermissions = async () => {
      if (isAuthenticated && Platform.OS === 'android') {
        console.log('[App] 🔐 Checking Android permissions...');
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
    if (pendingEventNavigation && navigationRef.current && isAuthenticated && currentUser) {
      console.log('🎯 Navigating to event from deep link:', pendingEventNavigation.eventId);

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

      // Handle Challenge QR deep link: runstr://challenge?type=pushups&duration=7&wager=500&...
      if (path === 'challenge' || url.includes('challenge?')) {
        console.log('🏆 Challenge deep link detected');

        try {
          const parsedChallenge = parseChallengeDeepLink(url);
          console.log('📦 Parsed challenge data:', parsedChallenge);

          if (parsedChallenge.isValid) {
            setChallengeData(parsedChallenge);
            setShowChallengePreview(true);
          } else {
            console.error('❌ Invalid challenge data:', parsedChallenge.error);
            CustomAlertManager.alert(
              'Invalid Challenge',
              parsedChallenge.error || 'This challenge link is invalid or expired.'
            );
          }
        } catch (error) {
          console.error('❌ Failed to parse challenge deep link:', error);
          CustomAlertManager.alert(
            'Error',
            'Failed to process challenge link. Please try again.'
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

  // Challenge deep link handlers
  const handleAcceptChallenge = React.useCallback(async (challenge: ParsedChallengeData) => {
    try {
      console.log('🏆 Accepting challenge:', challenge);

      // Get unified signer (supports both Amber and nsec)
      const { UnifiedSigningService } = await import('./services/auth/UnifiedSigningService');
      const signingService = UnifiedSigningService.getInstance();
      const signer = await signingService.getSigner();

      if (!signer) {
        throw new Error('User not authenticated');
      }

      // Accept the challenge using the challengeRequestService
      // This method already exists and handles QR challenges
      const result = await challengeRequestService.acceptQRChallenge(
        {
          challenge_id: challenge.challengeId,
          creator_pubkey: challenge.creatorPubkey,
          type: challenge.type,
          activity: challenge.type, // Map SimpleChallengeType to ActivityType
          metric: challenge.type === 'pushups' ? 'reps' :
                 challenge.type === 'distance' ? 'distance' :
                 challenge.type === 'carnivore' ? 'days' : 'duration',
          duration: challenge.duration,
          wager: challenge.wager,
        },
        signer
      );

      if (result.success) {
        console.log('✅ Challenge accepted successfully');
        setShowChallengePreview(false);
        setChallengeData(null);

        CustomAlertManager.alert(
          'Challenge Accepted!',
          `You've accepted the challenge from ${challenge.creatorName}. Good luck!`,
          [{ text: 'OK' }]
        );

        // TODO: Navigate to challenge leaderboard
        // navigation.navigate('ChallengeDetail', { challengeId: challenge.challengeId });
      } else {
        throw new Error(result.error || 'Failed to accept challenge');
      }
    } catch (error) {
      console.error('❌ Failed to accept challenge:', error);
      CustomAlertManager.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to accept challenge. Please try again.'
      );
    }
  }, []);

  const handleDeclineChallenge = React.useCallback(() => {
    console.log('❌ Declining challenge');
    setShowChallengePreview(false);
    setChallengeData(null);
  }, []);

  const handleCloseChallengePreview = React.useCallback(() => {
    console.log('🔒 Closing challenge preview');
    setShowChallengePreview(false);
    setChallengeData(null);
  }, []);

  // PERFORMANCE OPTIMIZATION: App state detection for smart resume
  const walletStore = useWalletStore();
  const appState = React.useRef(AppState.currentState);
  const backgroundTime = React.useRef<number>(0);

  React.useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        const previousState = appState.current;

        // App going to background
        if (
          previousState === 'active' &&
          nextAppState.match(/inactive|background/)
        ) {
          backgroundTime.current = Date.now();
          console.log('[AppState] App going to background');
        }

        // App returning to foreground
        if (
          previousState.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          const timeInBackground = Date.now() - backgroundTime.current;
          const secondsInBackground = Math.round(timeInBackground / 1000);

          console.log(
            `[AppState] App returning to foreground (${secondsInBackground}s in background)`
          );

          // ❌ CASHU WALLET REFRESH DISABLED: Removed in favor of NWC (v0.2.4+)
          // Smart refresh strategy previously triggered Cashu wallet sync on app resume
          // NWC wallet services now handle all Lightning payments independently
          console.log('[AppState] Cashu wallet refresh skipped (using NWC for Lightning payments)');
          /*
          if (isAuthenticated && walletStore.isInitialized) {
            if (timeInBackground < 60 * 1000) {
              // < 1 minute: No refresh needed
              console.log('[AppState] Quick return - no refresh needed');
            } else if (timeInBackground < 5 * 60 * 1000) {
              // 1-5 minutes: Quick resume with background sync
              console.log('[AppState] Medium return - using quick resume');
              walletStore.initialize(undefined, true); // Quick resume mode
            } else {
              // > 5 minutes: Full refresh
              console.log('[AppState] Long return - triggering full refresh');
              walletStore.refreshBalance();
            }
          }
          */
        }

        appState.current = nextAppState;
      }
    );

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, walletStore.isInitialized]);

  // Authenticated app with bottom tabs and team creation modal
  const AuthenticatedNavigator: React.FC<{ user: User }> = ({ user }) => {
    // Initialize app data when user is authenticated
    React.useEffect(() => {
      const initializeData = async () => {
        try {
          // CRITICAL FIX: Get actual hex pubkey from AsyncStorage, NOT synthetic user.id
          // user.id is 'nostr_hh6sr85uum' but we need actual hex for Nostr queries
          const hexPubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');
          const npub = await AsyncStorage.getItem('@runstr:npub');
          const pubkey = hexPubkey || npub;

          if (!pubkey) {
            console.warn(
              '[App] Cannot initialize app data: no pubkey available'
            );
            return;
          }

          console.log(
            '[App] 🚀 Triggering app data initialization for authenticated user...'
          );

          // Non-blocking background initialization
          await appInitializationService.initializeAppData(pubkey);

          // ✅ CLEANUP: Remove expired event snapshots on app start
          try {
            const { EventSnapshotStore } = await import(
              './services/event/EventSnapshotStore'
            );
            const removed = await EventSnapshotStore.cleanupExpired();
            if (removed > 0) {
              console.log(`🧹 Cleaned up ${removed} expired event snapshots`);
            }
          } catch (error) {
            console.warn('⚠️ Event snapshot cleanup failed (non-critical):', error);
          }

          // ❌ CASHU WALLET DISABLED: Removed in favor of NWC (v0.2.4+)
          // This initialization triggered Amber signing prompts for Cashu wallet encryption
          // NWC wallet services now handle all Lightning payments independently
          console.log('[App] 💰 Cashu wallet initialization skipped (using NWC for Lightning payments)');
          /*
          if (!walletStore.isInitialized && !walletStore.isInitializing) {
            await walletStore.initialize();
            console.log('[App] ✅ Wallet initialization complete');
          } else {
            console.log('[App] ℹ️  Wallet already initialized, skipping');
          }
          */

          // ✅ CHALLENGE COMPLETION: Start monitoring active challenges
          console.log('[App] 🏁 Starting challenge completion monitoring...');
          challengeCompletionService.startMonitoring();
          console.log('[App] ✅ Challenge completion monitoring active');
        } catch (error) {
          console.error('[App] ❌ App data initialization error:', error);
          // Don't block app - initialization errors are non-critical
        }
      };

      initializeData();

      // Cleanup: Stop monitoring when component unmounts (user logs out)
      return () => {
        console.log('[App] 🛑 Stopping challenge completion monitoring...');
        challengeCompletionService.stopMonitoring();
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

        {/* Onboarding Screen */}
        <AuthenticatedStack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />

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
                    <ActivityIndicator size="large" color={theme.colors.text} />
                  </View>
                }
              >
                <SimpleTeamScreen
                  data={{
                    team: team,
                    leaderboard: [],
                    events: [],
                    challenges: [],
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
                  onAddChallenge={() => console.log('Add challenge')}
                  onEventPress={(eventId, eventData) => {
                    console.log('📍 Navigation: Team → Event Detail');
                    console.log('  eventId:', eventId);
                    console.log(
                      '  eventData:',
                      eventData ? 'provided' : 'not provided'
                    );
                    navigation.navigate('EventDetail', { eventId, eventData });
                  }}
                  onLeaguePress={(leagueId, leagueData) => {
                    console.log('📍 Navigation: Team → League Detail');
                    console.log('  leagueId:', leagueId);
                    navigation.navigate('LeagueDetail', {
                      leagueId,
                      leagueData,
                    });
                  }}
                  onChallengePress={(challengeId) => {
                    console.log('📍 Navigation: Team → Challenge Detail');
                    console.log('  challengeId:', challengeId);
                    navigation.navigate('ChallengeDetail', { challengeId });
                  }}
                  showJoinButton={!userIsMember}
                  userIsMemberProp={userIsMember}
                  currentUserNpub={currentUserNpub}
                  userIsCaptain={userIsCaptain}
                />
              </React.Suspense>
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

        {/* Event Captain Dashboard Screen */}
        <AuthenticatedStack.Screen
          name="EventCaptainDashboard"
          options={{
            headerShown: false,
          }}
        >
          {({ navigation, route }) => (
            <EventCaptainDashboardScreen
              route={route}
              navigation={navigation}
            />
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

        {/* Challenge Detail Screen */}
        <AuthenticatedStack.Screen
          name="ChallengeDetail"
          options={{
            headerShown: false,
          }}
        >
          {({ navigation, route }) => (
            <ChallengeDetailScreen route={route} navigation={navigation} />
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
                    activeChallenges: 0,
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
                await appInitializationService.reset();
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

        {/* Challenge Wizard Screen */}
        <AuthenticatedStack.Screen
          name="ChallengeWizard"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        >
          {({ navigation }) => (
            <GlobalChallengeWizard
              onComplete={() => {
                console.log('Challenge created successfully');
                navigation.goBack();
              }}
              onCancel={() => navigation.goBack()}
            />
          )}
        </AuthenticatedStack.Screen>

        {/* Challenge Leaderboard Screen (placeholder) */}
        <AuthenticatedStack.Screen
          name="ChallengeLeaderboard"
          options={{
            headerShown: false,
          }}
        >
          {({ navigation, route }) => (
            <View
              style={{
                flex: 1,
                backgroundColor: '#000',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: theme.colors.textBright,
                  fontSize: 18,
                  marginBottom: 20,
                }}
              >
                Challenge Leaderboard
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>
                Challenge ID: {route.params?.challengeId}
              </Text>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 14,
                  marginTop: 10,
                }}
              >
                Coming Soon
              </Text>
              <TouchableOpacity
                style={{
                  marginTop: 30,
                  padding: 12,
                  backgroundColor: theme.colors.orangeDeep,
                  borderRadius: 8,
                }}
                onPress={() => navigation.goBack()}
              >
                <Text style={{ color: '#000' }}>Go Back</Text>
              </TouchableOpacity>
            </View>
          )}
        </AuthenticatedStack.Screen>
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

  // Simplified navigation - no more SplashInit screen
  // Show login immediately if not authenticated

  // Refresh onboarding status when app gains focus
  const handleNavigationStateChange = React.useCallback(async () => {
    if (isAuthenticated && currentUser) {
      const AsyncStorage = (
        await import('@react-native-async-storage/async-storage')
      ).default;
      const completed = await AsyncStorage.getItem(
        '@runstr:onboarding_completed'
      );
      const isNewSignup = await AsyncStorage.getItem('@runstr:is_new_signup');

      // Onboarding is complete if either:
      // 1. The completed flag is set, OR
      // 2. This is NOT a new signup (returning user)
      const needsOnboarding = isNewSignup === 'true' && completed !== 'true';

      if (!needsOnboarding && onboardingCompleted === false) {
        console.log('🎯 App: Onboarding completed, refreshing to main app');
        setOnboardingCompleted(true);
      }
    }
  }, [isAuthenticated, currentUser, onboardingCompleted]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <NavigationContainer
        ref={navigationRef}
        onStateChange={handleNavigationStateChange}
      >
        {(() => {
          console.log(
            '🚀 AppContent: Navigation decision - isAuthenticated:',
            isAuthenticated,
            'currentUser:',
            !!currentUser,
            'prefetchCompleted:',
            prefetchCompleted,
            'isInitializing:',
            isInitializing
          );

          // Show login immediately if not authenticated
          if (!isAuthenticated) {
            return <AppNavigator initialRoute="Login" isFirstTime={true} />;
          }

          // ✅ PERFORMANCE: Only show SplashInit for first-time users (no cache at all)
          // Returning users see app immediately with cached data, refresh happens in background
          if (isAuthenticated && !prefetchCompleted) {
            console.log(
              '🚀 App: First-time user - showing SplashInit for initial data load'
            );
            return (
              <SplashInitScreen
                onComplete={() => {
                  console.log('✅ App: Initial data loaded, showing app');
                  setPrefetchCompleted(true);
                }}
              />
            );
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

          // Authenticated with loaded profile - check onboarding before showing main app
          if (isAuthenticated && currentUser) {
            // If onboarding status is still being checked, show loading
            if (onboardingCompleted === null) {
              return (
                <View style={errorStyles.container}>
                  <ActivityIndicator size="large" color="#ffffff" />
                  <Text style={errorStyles.instruction}>
                    Setting up your account...
                  </Text>
                </View>
              );
            }

            // If onboarding not completed, show onboarding flow
            if (onboardingCompleted === false) {
              console.log('🎯 App: Showing onboarding for new user');
              return (
                <AuthenticatedStack.Navigator
                  screenOptions={{ headerShown: false }}
                >
                  <AuthenticatedStack.Screen
                    name="Onboarding"
                    component={OnboardingScreen}
                  />
                </AuthenticatedStack.Navigator>
              );
            }

            // Onboarding completed - show main app
            return <AuthenticatedNavigator user={currentUser} />;
          }

          // Fallback to login
          return <AppNavigator initialRoute="Login" isFirstTime={true} />;
        })()}
      </NavigationContainer>

      {/* Permission Request Modal - Shows when Android permissions are missing */}
      {showPermissionModal && (
        <PermissionRequestModal
          visible={showPermissionModal}
          onComplete={() => setShowPermissionModal(false)}
        />
      )}

      {/* Challenge Preview Modal - Shows when QR code challenge is scanned */}
      <ChallengePreviewModal
        visible={showChallengePreview}
        challengeData={challengeData}
        onAccept={handleAcceptChallenge}
        onDecline={handleDeclineChallenge}
        onClose={handleCloseChallengePreview}
      />
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

                await AsyncStorage.removeItem('@runstr:active_session_state');
                await AsyncStorage.removeItem(
                  '@runstr:background_distance_state'
                );
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
