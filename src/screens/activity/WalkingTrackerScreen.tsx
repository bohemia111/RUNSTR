/**
 * WalkingTrackerScreen - Walking activity tracker with step estimation
 * Displays distance, time, steps, and elevation
 * Now includes daily step counter with goal tracking
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AppStateManager } from '../../services/core/AppStateManager';
import { CustomAlert } from '../../components/ui/CustomAlert';
import { simpleRunTracker } from '../../services/activity/SimpleRunTracker';
import { activityMetricsService } from '../../services/activity/ActivityMetricsService';
import type { RunSession } from '../../services/activity/SimpleRunTracker';
import { WorkoutSummaryModal } from '../../components/activity/WorkoutSummaryModal';
import LocalWorkoutStorageService from '../../services/fitness/LocalWorkoutStorageService';
import healthConnectService from '../../services/fitness/healthConnectService';
import { RouteSelectionModal } from '../../components/routes/RouteSelectionModal';
import routeStorageService from '../../services/routes/RouteStorageService';
import {
  DailyStepGoalCard,
  type PostingState,
} from '../../components/activity/DailyStepGoalCard';
import { dailyStepCounterService } from '../../services/activity/DailyStepCounterService';
import { nativeStepCounterService } from '../../services/activity/NativeStepCounterService';
import { dailyStepGoalService } from '../../services/activity/DailyStepGoalService';
import type { DailyStepData } from '../../services/activity/DailyStepCounterService';
import type { StepGoalProgress } from '../../services/activity/DailyStepGoalService';
import { HoldToStartButton } from '../../components/activity/HoldToStartButton';
import { StepGoalPickerModal } from '../../components/activity/StepGoalPickerModal';
import { EnhancedSocialShareModal } from '../../components/profile/shared/EnhancedSocialShareModal';
// New redesigned components
import { HeroMetric } from '../../components/activity/HeroMetric';
import {
  SecondaryMetricRow,
  type SecondaryMetric,
} from '../../components/activity/SecondaryMetricRow';
import { CountdownOverlay } from '../../components/activity/CountdownOverlay';
import { ControlBar } from '../../components/activity/ControlBar';
import { LastActivityCard } from '../../components/activity/LastActivityCard';
import { nostrProfileService } from '../../services/nostr/NostrProfileService';
import type { NostrProfile } from '../../services/nostr/NostrProfileService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PublishableWorkout } from '../../services/nostr/workoutPublishingService';
import { theme } from '../../styles/theme';

const STEP_UPDATE_INTERVAL = 60 * 1000; // Update every 1 minute (was 5 minutes)

export const WalkingTrackerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [metrics, setMetrics] = useState({
    distance: '0.00 km',
    duration: '0:00',
    steps: '0',
    elevation: '0 m',
    calories: '0',
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedRoute, setSelectedRoute] = useState<{ id: string; name: string } | null>(null);
  const [routeSelectionVisible, setRouteSelectionVisible] = useState(false);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [workoutData, setWorkoutData] = useState<{
    type: 'running' | 'walking' | 'cycling';
    distance: number;
    duration: number;
    calories: number;
    elevation?: number;
    steps?: number;
    localWorkoutId?: string; // For marking as synced later
    routeId?: string; // Route label ID if tagged
    routeName?: string; // Route label name for display
    rewardSent?: boolean; // True if Bitcoin reward was sent
    rewardAmount?: number; // Amount of sats rewarded
  } | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }>;
  }>({
    title: '',
    message: '',
    buttons: [],
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const metricsUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseStartTimeRef = useRef<number>(0); // When pause started
  const totalPausedTimeRef = useRef<number>(0); // Cumulative pause duration in ms
  const isPausedRef = useRef<boolean>(false); // Ref to avoid stale closure in timer
  const isTrackingRef = useRef<boolean>(false); // Track isTracking without re-subscribing

  // Daily step counter state
  const [dailySteps, setDailySteps] = useState<number | null>(null);
  const [stepGoal, setStepGoal] = useState<number>(10000);
  const [stepProgress, setStepProgress] = useState<StepGoalProgress | null>(
    null
  );
  const [stepCounterLoading, setStepCounterLoading] = useState(true);
  const [stepCounterError, setStepCounterError] = useState<string | null>(null);
  const [postingState, setPostingState] = useState<PostingState>('idle');
  const stepUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Live pedometer step tracking (real steps during active walking)
  const liveStepsRef = useRef<number>(0);
  const unsubscribeLiveStepsRef = useRef<(() => void) | null>(null);

  const [countdown, setCountdown] = useState<3 | 2 | 1 | 'GO' | null>(null);
  const [showBackgroundBanner, setShowBackgroundBanner] = useState(false);
  const [isBackgroundActive, setIsBackgroundActive] = useState(false);
  const [goalPickerVisible, setGoalPickerVisible] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [userProfile, setUserProfile] = useState<NostrProfile | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [preparedWorkout, setPreparedWorkout] =
    useState<PublishableWorkout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (metricsUpdateRef.current) clearInterval(metricsUpdateRef.current);
      if (stepUpdateIntervalRef.current)
        clearInterval(stepUpdateIntervalRef.current);
      if (unsubscribeLiveStepsRef.current)
        unsubscribeLiveStepsRef.current();
    };
  }, []);

  // Load user profile for social sharing
  useEffect(() => {
    const loadProfileAndId = async () => {
      try {
        const pubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');
        const npub = await AsyncStorage.getItem('@runstr:npub');
        const activeUserId = npub || pubkey || '';
        setUserId(activeUserId);

        if (pubkey) {
          const profile = await nostrProfileService.getProfile(pubkey);
          setUserProfile(profile);
        }
      } catch (error) {
        console.error(
          '[WalkingTrackerScreen] Failed to load user profile:',
          error
        );
      }
    };

    loadProfileAndId();
  }, []);

  // Daily step counter initialization (runs once on mount)
  useEffect(() => {
    const checkBackgroundTracking = async () => {
      try {
        setStepCounterLoading(true);
        setStepCounterError(null);

        // Check if step counting is available (HealthKit on iOS, Health Connect on Android)
        const available = await dailyStepCounterService.isAvailable();
        if (!available) {
          // Device doesn't support step counting - GPS-only mode
          setStepCounterLoading(false);
          setShowBackgroundBanner(false);
          if (Platform.OS === 'android') {
            console.log(
              '[WalkingTrackerScreen] Health Connect not available - using GPS-only mode'
            );
            setStepCounterError('Install Health Connect from Play Store for step counting');
          } else {
            console.log(
              '[WalkingTrackerScreen] Pedometer not available - using GPS-only mode'
            );
          }
          return;
        }

        // Check if permissions already granted (don't request yet)
        const permissionStatus =
          await dailyStepCounterService.checkPermissionStatus();

        if (permissionStatus === 'granted') {
          // Permissions already granted - enable background mode
          try {
            const stepData = await dailyStepCounterService.getTodaySteps();
            if (stepData) {
              setDailySteps(stepData.steps);
            }

            const goal = await dailyStepGoalService.getGoal();
            setStepGoal(goal);

            if (stepData) {
              const progress = dailyStepGoalService.calculateProgress(
                stepData.steps,
                goal
              );
              setStepProgress(progress);
            }

            setIsBackgroundActive(true);
            setShowBackgroundBanner(false);
            console.log(
              `[WalkingTrackerScreen] ✅ Background tracking active: ${
                stepData?.steps || 0
              } steps`
            );
          } catch (error) {
            console.error(
              '[WalkingTrackerScreen] Error fetching steps:',
              error
            );
            setIsBackgroundActive(false);
            setShowBackgroundBanner(true);
          }
        } else {
          // Permissions not granted - show optional banner
          setIsBackgroundActive(false);
          setShowBackgroundBanner(true);
          console.log(
            '[WalkingTrackerScreen] Background tracking available - showing banner'
          );
        }

        setStepCounterLoading(false);
      } catch (error) {
        console.error(
          '[WalkingTrackerScreen] Error checking background tracking:',
          error
        );
        setStepCounterLoading(false);
        setShowBackgroundBanner(false);
      }
    };

    checkBackgroundTracking();
  }, []); // Empty dependency - only run once on mount

  // Separate useEffect for step polling (starts when isBackgroundActive becomes true)
  useEffect(() => {
    if (!isBackgroundActive) return;

    const pollSteps = async () => {
      try {
        const stepData = await dailyStepCounterService.getTodaySteps();
        if (stepData) {
          setDailySteps(stepData.steps);
          const goal = await dailyStepGoalService.getGoal();
          const progress = dailyStepGoalService.calculateProgress(stepData.steps, goal);
          setStepProgress(progress);
        }
      } catch (error) {
        console.error('[WalkingTrackerScreen] Error polling steps:', error);
      }
    };

    // Poll immediately when background becomes active
    pollSteps();
    console.log('[WalkingTrackerScreen] Step polling started');

    // Then poll at regular intervals
    stepUpdateIntervalRef.current = setInterval(pollSteps, STEP_UPDATE_INTERVAL);

    return () => {
      if (stepUpdateIntervalRef.current) {
        clearInterval(stepUpdateIntervalRef.current);
        console.log('[WalkingTrackerScreen] Step polling stopped');
      }
    };
  }, [isBackgroundActive]);

  // Check if daily steps already posted today
  useEffect(() => {
    const checkIfPosted = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const alreadyPosted =
          await LocalWorkoutStorageService.hasDailyStepsForDate(today);

        if (alreadyPosted) {
          setPostingState('posted');
          console.log(
            '[WalkingTrackerScreen] Daily steps already posted today'
          );
        } else {
          setPostingState('idle');
        }
      } catch (error) {
        console.error(
          '[WalkingTrackerScreen] Error checking posted status:',
          error
        );
      }
    };

    checkIfPosted();
  }, [dailySteps]); // Re-check when daily steps update

  // AppState listener for background/foreground transitions
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isTrackingRef.current) {
        // App returned to foreground while tracking - sync immediately
        console.log(
          '[WalkingTrackerScreen] App returned to foreground, syncing metrics...'
        );

        // Force immediate sync of metrics
        const session = simpleRunTracker.getCurrentSession();
        if (session) {
          const now = Date.now();
          const currentElapsed = Math.floor(
            (now - startTimeRef.current - totalPausedTimeRef.current) / 1000
          );

          const distance = session.distance || 0;
          // Use real pedometer steps, fall back to GPS estimate if pedometer unavailable
          const steps = liveStepsRef.current > 0
            ? liveStepsRef.current
            : activityMetricsService.estimateSteps(distance);
          const calories = activityMetricsService.estimateCalories('walking', distance, currentElapsed);

          setMetrics({
            distance: activityMetricsService.formatDistance(distance),
            duration: activityMetricsService.formatDuration(currentElapsed),
            steps: activityMetricsService.formatSteps(steps),
            elevation: activityMetricsService.formatElevation(
              session.elevationGain || 0
            ),
            calories: calories.toString(),
          });
          setElapsedTime(currentElapsed);

          console.log(
            `[WalkingTrackerScreen] ✅ Synced: ${(
              distance / 1000
            ).toFixed(2)} km, ` +
              `${currentElapsed}s, ${steps} steps (live: ${liveStepsRef.current}), tracking continued in background`
          );
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    return () => {
      subscription.remove();
    };
  }, []); // Subscribe only once to avoid race conditions

  // Update the ref whenever isTracking changes
  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  const handleHoldComplete = async () => {
    // Start countdown
    console.log(
      '[WalkingTrackerScreen] Permissions granted, starting countdown...'
    );

    // Start countdown: 3 → 2 → 1 → GO!
    setCountdown(3);
    setTimeout(() => {
      setCountdown(2);
      setTimeout(() => {
        setCountdown(1);
        setTimeout(() => {
          setCountdown('GO');
          setTimeout(() => {
            setCountdown(null);
            // Start tracking after countdown completes
            startTracking();
          }, 500); // Show "GO!" for 0.5 seconds
        }, 1000);
      }, 1000);
    }, 1000);
  };

  const startTracking = async () => {
    console.log('[WalkingTrackerScreen] Starting GPS tracking...');

    try {
      // Simple permission and start flow
      const started = await simpleRunTracker.startTracking(
        'walking'
      );
      if (started) {
        initializeTracking();
      }
    } catch (error) {
      // Get detailed error message from service
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Show detailed error with helpful context
      setAlertConfig({
        title: 'Cannot Start Tracking',
        message: errorMessage,
        buttons: [
          { text: 'OK', style: 'default' },
          ...(Platform.OS === 'android'
            ? [
                {
                  text: 'Settings',
                  style: 'default' as const,
                  onPress: () => {
                    // Open Android app settings
                    const { Linking } = require('react-native');
                    Linking.openSettings();
                  },
                },
              ]
            : []),
        ],
      });
      setAlertVisible(true);
      console.error(
        '[WalkingTrackerScreen] Failed to start tracking:',
        errorMessage
      );
    }
  };

  const initializeTracking = async () => {
    setIsTracking(true);
    setIsPaused(false);
    isPausedRef.current = false;
    startTimeRef.current = Date.now();
    pauseStartTimeRef.current = 0;
    totalPausedTimeRef.current = 0;

    // Reset live step counter for new session
    liveStepsRef.current = 0;

    // Platform-specific live step tracking
    if (Platform.OS === 'android') {
      // Android: Use NativeStepCounterService (foreground service with step sensor)
      const started = await nativeStepCounterService.startTracking();
      console.log(`[WalkingTrackerScreen] Android native step counter started: ${started}`);
    } else {
      // iOS: Use Pedometer.watchStepCount() subscription
      unsubscribeLiveStepsRef.current = dailyStepCounterService.subscribeLiveSteps(
        (incrementalSteps: number) => {
          liveStepsRef.current = incrementalSteps;
          console.log(`[WalkingTrackerScreen] Live steps: ${incrementalSteps}`);
        }
      );
      console.log('[WalkingTrackerScreen] iOS pedometer subscription started');
    }

    timerRef.current = setInterval(() => {
      if (!isPausedRef.current) {
        const now = Date.now();
        const totalElapsed = Math.floor(
          (now - startTimeRef.current - totalPausedTimeRef.current) / 1000
        );
        setElapsedTime(totalElapsed);
      }
    }, 1000);

    metricsUpdateRef.current = setInterval(updateMetrics, 1000); // Update every second for consistent UX across activities
  };

  const updateMetrics = async () => {
    const session = simpleRunTracker.getCurrentSession();
    if (session) {
      const distance = session.distance || 0;

      // For Android, poll nativeStepCounterService for live steps
      if (Platform.OS === 'android') {
        try {
          const androidSteps = await nativeStepCounterService.getStepsSinceStart();
          // Only update if steps increased (avoid flickering with stale data)
          if (androidSteps > liveStepsRef.current) {
            console.log(`[WalkingTracker] Android steps: ${liveStepsRef.current} → ${androidSteps}`);
            liveStepsRef.current = androidSteps;
          }
        } catch (e) {
          // Silently continue with GPS estimate if native counter fails
        }
      }

      // Use real pedometer steps, fall back to GPS estimate if pedometer unavailable
      const steps = liveStepsRef.current > 0
        ? liveStepsRef.current
        : activityMetricsService.estimateSteps(distance);
      const calories = activityMetricsService.estimateCalories('walking', distance, elapsedTime);

      setMetrics({
        distance: activityMetricsService.formatDistance(distance),
        duration: activityMetricsService.formatDuration(elapsedTime),
        steps: activityMetricsService.formatSteps(steps),
        elevation: activityMetricsService.formatElevation(
          session.elevationGain || 0
        ),
        calories: calories.toString(),
      });
    }
  };

  const pauseTracking = async () => {
    if (!isPaused) {
      await simpleRunTracker.pauseTracking();
      setIsPaused(true);
      isPausedRef.current = true;
      pauseStartTimeRef.current = Date.now(); // Store when pause started
    }
  };

  const resumeTracking = async () => {
    if (isPaused) {
      const pauseDuration = Date.now() - pauseStartTimeRef.current; // Calculate how long we were paused
      totalPausedTimeRef.current += pauseDuration; // Add to cumulative total
      await simpleRunTracker.resumeTracking();
      setIsPaused(false);
      isPausedRef.current = false;
    }
  };

  const stopTracking = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (metricsUpdateRef.current) {
      clearInterval(metricsUpdateRef.current);
      metricsUpdateRef.current = null;
    }

    // Platform-specific step tracking cleanup
    if (Platform.OS === 'android') {
      // Stop Android native step counter
      await nativeStepCounterService.stopTracking();
      console.log('[WalkingTrackerScreen] Android native step counter stopped');
    } else if (unsubscribeLiveStepsRef.current) {
      // Unsubscribe from iOS pedometer
      unsubscribeLiveStepsRef.current();
      unsubscribeLiveStepsRef.current = null;
      console.log('[WalkingTrackerScreen] iOS pedometer subscription stopped');
    }

    const session = await simpleRunTracker.stopTracking();
    setIsTracking(false);
    setIsPaused(false);

    // Show summary for any tracked workout (steps > 0 or distance > 0)
    if (session && (liveStepsRef.current > 0 || session.distance > 0)) {
      showWorkoutSummary(session);
    } else {
      resetMetrics();
    }
  };

  const showWorkoutSummary = async (session: RunSession) => {
    // Use real pedometer steps, fall back to GPS estimate if pedometer unavailable
    const steps = liveStepsRef.current > 0
      ? liveStepsRef.current
      : activityMetricsService.estimateSteps(session.distance);
    console.log(`[WalkingTracker] Workout summary steps: ${steps} (live: ${liveStepsRef.current})`);
    const calories = activityMetricsService.estimateCalories(
      'walking',
      session.distance,
      elapsedTime
    );

    // Save workout to local storage BEFORE showing modal
    try {
      const result = await LocalWorkoutStorageService.saveGPSWorkout({
        type: 'walking',
        distance: session.distance,
        duration: elapsedTime,
        calories,
        elevation: session.elevationGain || 0,
        // Pass route info if selected
        routeId: selectedRoute?.id,
        routeLabel: selectedRoute?.name,
      });

      console.log(`✅ Walking workout saved locally: ${result.workoutId}`);
      if (result.rewardSent) {
        console.log(`[WalkingTracker] ⚡ Reward sent: ${result.rewardAmount} sats!`);
      }

      // If a route was selected, add this workout to the route
      if (selectedRoute) {
        try {
          await routeStorageService.addWorkoutToRoute(
            selectedRoute.id,
            result.workoutId,
            elapsedTime,
            undefined // No pace for walking
          );
          console.log(`[WalkingTracker] Workout added to route "${selectedRoute.name}"`);
        } catch (routeError) {
          console.error('[WalkingTracker] Failed to add workout to route:', routeError);
        }
      }

      // Refresh daily step count to include newly tracked steps
      // Clear both caches on Android to ensure fresh data
      if (Platform.OS === 'android') {
        healthConnectService.clearStepsCache();
      }
      dailyStepCounterService.clearCache();
      const updatedSteps = await dailyStepCounterService.getTodaySteps();
      if (updatedSteps) {
        setDailySteps(updatedSteps.steps);
        const progress = dailyStepGoalService.calculateProgress(updatedSteps.steps, stepGoal);
        setStepProgress(progress);
        console.log(`[WalkingTracker] ✅ Daily steps refreshed: ${updatedSteps.steps}`);
      }

      setWorkoutData({
        type: 'walking',
        distance: session.distance,
        duration: elapsedTime,
        calories,
        elevation: session.elevationGain || 0,
        steps,
        localWorkoutId: result.workoutId,
        routeId: selectedRoute?.id,
        routeName: selectedRoute?.name,
        rewardSent: result.rewardSent,
        rewardAmount: result.rewardAmount,
      });
      setSummaryModalVisible(true);
    } catch (error) {
      console.error('❌ Failed to save walking workout locally:', error);
      // Still show modal even if save failed
      setWorkoutData({
        type: 'walking',
        distance: session.distance,
        duration: elapsedTime,
        calories,
        elevation: session.elevationGain || 0,
        steps,
        routeId: selectedRoute?.id,
        routeName: selectedRoute?.name,
      });
      setSummaryModalVisible(true);
    }

    resetMetrics();
    setSelectedRoute(null); // Clear selected route after workout
  };

  const resetMetrics = () => {
    setMetrics({
      distance: '0.00 km',
      duration: '0:00',
      steps: '0',
      elevation: '0 m',
      calories: '0',
    });
    setElapsedTime(0);
  };

  const handleRequestPermission = async () => {
    console.log(
      '[WalkingTrackerScreen] User requested background tracking permission'
    );
    setStepCounterLoading(true);
    setStepCounterError(null);

    try {
      const granted = await dailyStepCounterService.requestPermissions();

      if (granted) {
        console.log(
          '[WalkingTrackerScreen] ✅ Permission granted - activating background tracking'
        );

        // Fetch step data
        const stepData = await dailyStepCounterService.getTodaySteps();
        if (stepData) {
          setDailySteps(stepData.steps);
          const goal = await dailyStepGoalService.getGoal();
          setStepGoal(goal);
          const progress = dailyStepGoalService.calculateProgress(
            stepData.steps,
            goal
          );
          setStepProgress(progress);
        }

        // Activate background mode
        setIsBackgroundActive(true);
        setShowBackgroundBanner(false);
        setStepCounterLoading(false);

        console.log(
          `[WalkingTrackerScreen] ✅ Background tracking activated: ${
            stepData?.steps || 0
          } steps`
        );
      } else {
        console.warn(
          '[WalkingTrackerScreen] ⚠️ Permission denied - GPS-only mode continues'
        );
        if (Platform.OS === 'android') {
          setStepCounterError('Grant Health Connect permissions for step counting');
        } else {
          setStepCounterError('Background tracking requires motion permissions');
        }
        setShowBackgroundBanner(true);
        setIsBackgroundActive(false);
        setStepCounterLoading(false);
      }
    } catch (error) {
      console.error(
        '[WalkingTrackerScreen] ❌ Error requesting permission:',
        error
      );
      setStepCounterError('Failed to enable background tracking');
      setShowBackgroundBanner(true);
      setIsBackgroundActive(false);
      setStepCounterLoading(false);
    }
  };

  const handleOpenSettings = () => {
    console.log('[WalkingTrackerScreen] User requested to open settings');
    dailyStepCounterService.openSettings();
  };

  const handlePostDailySteps = async () => {
    if (!dailySteps || dailySteps === 0) {
      console.warn('[WalkingTrackerScreen] Cannot post - no steps available');
      return;
    }

    if (postingState === 'posted') {
      console.warn('[WalkingTrackerScreen] Steps already posted today');
      return;
    }

    try {
      setPostingState('posting');
      console.log(
        `[WalkingTrackerScreen] Preparing to post ${dailySteps} daily steps`
      );

      // Calculate time from midnight to now
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);

      const duration = Math.floor((now.getTime() - midnight.getTime()) / 1000); // seconds

      // Estimate calories for walking steps (rough estimate: 0.04 cal per step)
      const calories = Math.round(dailySteps * 0.04);

      // Save to local storage
      const workoutId = await LocalWorkoutStorageService.saveDailyStepsWorkout({
        steps: dailySteps,
        startTime: midnight.toISOString(),
        endTime: now.toISOString(),
        duration,
        calories,
      });

      console.log(`[WalkingTrackerScreen] ✅ Daily steps saved: ${workoutId}`);

      // Create PublishableWorkout for social sharing with steps in metadata
      const publishableWorkout: PublishableWorkout = {
        id: workoutId,
        userId: userId || 'unknown',
        type: 'walking',
        startTime: midnight.toISOString(),
        endTime: now.toISOString(),
        duration,
        distance: 0, // No GPS distance tracking
        calories,
        source: 'manual', // Device pedometer data entered manually
        syncedAt: new Date().toISOString(),
        sourceApp: 'RUNSTR',
        unitSystem: 'metric',
        canSyncToNostr: true,
        metadata: {
          title: 'Daily Steps',
          sourceApp: 'RUNSTR',
          notes: `${dailySteps.toLocaleString()} steps tracked throughout the day`,
          steps: dailySteps, // Important: Steps must be in metadata for card generator
        },
      };

      // Open social share modal directly (bypass WorkoutSummaryModal)
      setPreparedWorkout(publishableWorkout);
      setShowSocialModal(true);

      // Reset posting state after opening modal
      setPostingState('idle');

      console.log(
        `[WalkingTrackerScreen] ✅ Opening social share modal for ${dailySteps} steps`
      );
    } catch (error) {
      console.error(
        '[WalkingTrackerScreen] ❌ Failed to post daily steps:',
        error
      );
      setPostingState('idle');

      // Show error alert
      setAlertConfig({
        title: 'Failed to Post Steps',
        message: 'Could not save daily steps. Please try again.',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
    }
  };

  const handleSetGoal = () => {
    console.log('[WalkingTrackerScreen] Opening goal selection modal...');
    setGoalPickerVisible(true);
  };

  const handleGoalSelected = async (newGoal: number) => {
    try {
      // Update goal
      await dailyStepGoalService.setGoal(newGoal);
      setStepGoal(newGoal);

      // Recalculate progress
      if (dailySteps !== null) {
        const progress = dailyStepGoalService.calculateProgress(
          dailySteps,
          newGoal
        );
        setStepProgress(progress);
      }

      console.log(`[WalkingTrackerScreen] ✅ Goal updated to ${newGoal} steps`);
    } catch (error) {
      console.error('[WalkingTrackerScreen] ❌ Failed to update goal:', error);
    }
  };

  useEffect(() => {
    if (isTracking && !isPaused) {
      updateMetrics();
    }
  }, [elapsedTime]);

  // Secondary metrics for active tracking (duration already shows in HeroMetric)
  const secondaryMetrics: SecondaryMetric[] = [
    {
      value: metrics.distance,
      label: 'Distance',
      icon: 'navigate-outline',
    },
    {
      value: metrics.elevation,
      label: 'Elevation',
      icon: 'trending-up-outline',
    },
    {
      value: `${metrics.calories} cal`,
      label: 'Calories',
      icon: 'flame-outline',
    },
  ];

  // Determine control bar state
  const controlBarState = isTracking ? (isPaused ? 'paused' : 'tracking') : 'idle';

  return (
    <View style={styles.screenContainer}>
      <View style={styles.contentContainer}>
        {/* Countdown Overlay */}
        <CountdownOverlay countdown={countdown} />

        {isTracking ? (
          /* ============ ACTIVE TRACKING STATE ============ */
          <View style={styles.activeContainer}>
          {/* Route Badge (if selected) */}
          {selectedRoute && (
            <View style={styles.routeBadge}>
              <Ionicons name="map" size={14} color={theme.colors.accent} />
              <Text style={styles.routeBadgeText}>{selectedRoute.name}</Text>
            </View>
          )}

          {/* Hero Metric - Steps (large, centered) */}
          <View style={styles.heroSection}>
            <HeroMetric
              primaryValue={metrics.steps}
              primaryUnit="steps"
              secondaryValue={activityMetricsService.formatDuration(elapsedTime)}
            />
          </View>

          {/* Secondary Metrics Row */}
          <SecondaryMetricRow metrics={secondaryMetrics} />

          {/* Spacer to push controls to bottom */}
          <View style={{ flex: 1 }} />

          {/* Control Bar - Fixed at bottom */}
          <ControlBar
            state={controlBarState}
            startLabel="Start Walk"
            onHoldComplete={handleHoldComplete}
            onPause={pauseTracking}
            onResume={resumeTracking}
            onStop={stopTracking}
          />
        </View>
      ) : (
        /* ============ IDLE STATE ============ */
        <View style={styles.idleContainer}>
          {/* Daily Step Goal Card (prominent in walking) */}
          <DailyStepGoalCard
            steps={dailySteps}
            progress={stepProgress}
            loading={stepCounterLoading}
            error={stepCounterError}
            onPostSteps={handlePostDailySteps}
            onSetGoal={handleSetGoal}
            postingState={postingState}
            showBackgroundBanner={showBackgroundBanner}
            onEnableBackground={handleRequestPermission}
            isBackgroundActive={isBackgroundActive}
          />

          {/* Last Activity & Weekly Stats */}
          <LastActivityCard activityType="walking" />

          {/* Route Selection */}
          <TouchableOpacity
            style={styles.routeSelector}
            onPress={() => setRouteSelectionVisible(true)}
          >
            <Ionicons
              name={selectedRoute ? 'map' : 'map-outline'}
              size={20}
              color={selectedRoute ? theme.colors.accent : theme.colors.text}
            />
            <Text style={[
              styles.routeSelectorText,
              selectedRoute && { color: theme.colors.accent }
            ]}>
              {selectedRoute ? selectedRoute.name : 'Routes'}
            </Text>
            <Ionicons
              name="chevron-down"
              size={18}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>

          {/* Spacer to push controls to bottom */}
          <View style={{ flex: 1 }} />

          {/* Control Bar - Fixed at bottom */}
          <ControlBar
            state={controlBarState}
            startLabel="Start Walk"
            onHoldComplete={handleHoldComplete}
            onPause={pauseTracking}
            onResume={resumeTracking}
            onStop={stopTracking}
          />
        </View>
      )}

      {/* Workout Summary Modal */}
      {workoutData && (
        <WorkoutSummaryModal
          visible={summaryModalVisible}
          onClose={() => {
            setSummaryModalVisible(false);
            setWorkoutData(null);
          }}
          workout={workoutData}
        />
      )}

      {/* Custom Alert Modal */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
      />

      {/* Route Selection Modal */}
      <RouteSelectionModal
        visible={routeSelectionVisible}
        activityType="walking"
        onSelectRoute={(routeId, routeName) => {
          setSelectedRoute({ id: routeId, name: routeName });
          setRouteSelectionVisible(false);
        }}
        onClose={() => setRouteSelectionVisible(false)}
      />

      {/* Step Goal Picker Modal */}
      <StepGoalPickerModal
        visible={goalPickerVisible}
        currentGoal={stepGoal}
        onSelectGoal={handleGoalSelected}
        onClose={() => setGoalPickerVisible(false)}
      />

      {/* Enhanced Social Share Modal */}
      <EnhancedSocialShareModal
        visible={showSocialModal}
        workout={preparedWorkout}
        userId={userId}
        userAvatar={userProfile?.picture}
        userName={userProfile?.name || userProfile?.display_name}
        onClose={() => {
          setShowSocialModal(false);
          setPreparedWorkout(null);
        }}
        onSuccess={() => {
          setShowSocialModal(false);
          setPreparedWorkout(null);
          setPostingState('posted');
          console.log(
            '[WalkingTrackerScreen] ✅ Daily steps posted successfully'
          );
        }}
      />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Screen container (replaces SafeAreaView since parent handles safe area)
  screenContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  // Content container with platform-specific top padding
  contentContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 16,
  },
  // Active tracking state container
  activeContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  // Idle state container
  idleContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 16,
  },
  // Route badge shown during tracking
  routeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: theme.colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  routeBadgeText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accent,
  },
  // Hero metric section
  heroSection: {
    flex: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  // Route selector in idle state
  routeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },
  routeSelectorText: {
    fontSize: 18,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    flex: 1,
    textAlign: 'center',
  },
});
