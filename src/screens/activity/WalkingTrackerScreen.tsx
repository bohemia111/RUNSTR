/**
 * WalkingTrackerScreen - Walking activity tracker with step estimation
 * Displays distance, time, steps, and elevation
 * Now includes daily step counter with goal tracking
 */

import React, { useState, useEffect, useRef } from 'react';
import { Platform, ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AppStateManager } from '../../services/core/AppStateManager';
import { CustomAlert } from '../../components/ui/CustomAlert';
import { simpleLocationTrackingService } from '../../services/activity/SimpleLocationTrackingService';
import { activityMetricsService } from '../../services/activity/ActivityMetricsService';
import type { TrackingSession } from '../../services/activity/SimpleLocationTrackingService';
import { WorkoutSummaryModal } from '../../components/activity/WorkoutSummaryModal';
import LocalWorkoutStorageService from '../../services/fitness/LocalWorkoutStorageService';
import { RouteSelectionModal } from '../../components/routes/RouteSelectionModal';
import routeMatchingService from '../../services/routes/RouteMatchingService';
import type { SavedRoute } from '../../services/routes/RouteStorageService';
import { DailyStepGoalCard, type PostingState } from '../../components/activity/DailyStepGoalCard';
import { dailyStepCounterService } from '../../services/activity/DailyStepCounterService';
import { dailyStepGoalService } from '../../services/activity/DailyStepGoalService';
import type { DailyStepData } from '../../services/activity/DailyStepCounterService';
import type { StepGoalProgress } from '../../services/activity/DailyStepGoalService';
import { HoldToStartButton } from '../../components/activity/HoldToStartButton';
import { StepGoalPickerModal } from '../../components/activity/StepGoalPickerModal';
import { EnhancedSocialShareModal } from '../../components/profile/shared/EnhancedSocialShareModal';
import { nostrProfileService } from '../../services/nostr/NostrProfileService';
import type { NostrProfile } from '../../services/nostr/NostrProfileService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PublishableWorkout } from '../../services/nostr/workoutPublishingService';
import { theme } from '../../styles/theme';
import { appPermissionService } from '../../services/initialization/AppPermissionService';
import { PermissionRequestModal } from '../../components/permissions/PermissionRequestModal';

const STEP_UPDATE_INTERVAL = 5 * 60 * 1000; // Update every 5 minutes

export const WalkingTrackerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [metrics, setMetrics] = useState({
    distance: '0.00 km',
    duration: '0:00',
    steps: '0',
    elevation: '0 m',
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedRoute, setSelectedRoute] = useState<SavedRoute | null>(null);
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
    gpsCoordinates?: Array<{
      latitude: number;
      longitude: number;
      altitude?: number;
      timestamp?: number;
    }>; // For route saving
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
  const [stepProgress, setStepProgress] = useState<StepGoalProgress | null>(null);
  const [stepCounterLoading, setStepCounterLoading] = useState(true);
  const [stepCounterError, setStepCounterError] = useState<string | null>(null);
  const [postingState, setPostingState] = useState<PostingState>('idle');
  const stepUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [countdown, setCountdown] = useState<3 | 2 | 1 | 'GO' | null>(null);
  const [showBackgroundBanner, setShowBackgroundBanner] = useState(false);
  const [isBackgroundActive, setIsBackgroundActive] = useState(false);
  const [goalPickerVisible, setGoalPickerVisible] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [userProfile, setUserProfile] = useState<NostrProfile | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [preparedWorkout, setPreparedWorkout] = useState<PublishableWorkout | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (metricsUpdateRef.current) clearInterval(metricsUpdateRef.current);
      if (stepUpdateIntervalRef.current) clearInterval(stepUpdateIntervalRef.current);
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
        console.error('[WalkingTrackerScreen] Failed to load user profile:', error);
      }
    };

    loadProfileAndId();
  }, []);

  // Daily step counter initialization (optional, non-blocking)
  useEffect(() => {
    const checkBackgroundTracking = async () => {
      try {
        setStepCounterLoading(true);
        setStepCounterError(null);

        // Check if pedometer is available
        const available = await dailyStepCounterService.isAvailable();
        if (!available) {
          // Device doesn't support pedometer - GPS-only mode
          setStepCounterLoading(false);
          setShowBackgroundBanner(false);
          console.log('[WalkingTrackerScreen] Pedometer not available - using GPS-only mode');
          return;
        }

        // Check if permissions already granted (don't request yet)
        const permissionStatus = await dailyStepCounterService.checkPermissionStatus();

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
              const progress = dailyStepGoalService.calculateProgress(stepData.steps, goal);
              setStepProgress(progress);
            }

            setIsBackgroundActive(true);
            setShowBackgroundBanner(false);
            console.log(`[WalkingTrackerScreen] ✅ Background tracking active: ${stepData?.steps || 0} steps`);
          } catch (error) {
            console.error('[WalkingTrackerScreen] Error fetching steps:', error);
            setIsBackgroundActive(false);
            setShowBackgroundBanner(true);
          }
        } else {
          // Permissions not granted - show optional banner
          setIsBackgroundActive(false);
          setShowBackgroundBanner(true);
          console.log('[WalkingTrackerScreen] Background tracking available - showing banner');
        }

        setStepCounterLoading(false);
      } catch (error) {
        console.error('[WalkingTrackerScreen] Error checking background tracking:', error);
        setStepCounterLoading(false);
        setShowBackgroundBanner(false);
      }
    };

    checkBackgroundTracking();

    // Set up polling only if background active
    const setupPolling = async () => {
      if (isBackgroundActive) {
        stepUpdateIntervalRef.current = setInterval(async () => {
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
        }, STEP_UPDATE_INTERVAL);
      }
    };

    setupPolling();

    return () => {
      if (stepUpdateIntervalRef.current) {
        clearInterval(stepUpdateIntervalRef.current);
      }
    };
  }, [isBackgroundActive]);

  // Check if daily steps already posted today
  useEffect(() => {
    const checkIfPosted = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const alreadyPosted = await LocalWorkoutStorageService.hasDailyStepsForDate(today);

        if (alreadyPosted) {
          setPostingState('posted');
          console.log('[WalkingTrackerScreen] Daily steps already posted today');
        } else {
          setPostingState('idle');
        }
      } catch (error) {
        console.error('[WalkingTrackerScreen] Error checking posted status:', error);
      }
    };

    checkIfPosted();
  }, [dailySteps]); // Re-check when daily steps update

  // AppState listener for background/foreground transitions
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isTrackingRef.current) {
        // App returned to foreground while tracking - sync immediately
        console.log('[WalkingTrackerScreen] App returned to foreground, syncing metrics...');

        // Force immediate sync of metrics
        const session = simpleLocationTrackingService.getCurrentSession();
        if (session) {
          const now = Date.now();
          const currentElapsed = Math.floor(
            (now - startTimeRef.current - totalPausedTimeRef.current) / 1000
          );

          const steps = activityMetricsService.estimateSteps(session.distance);

          setMetrics({
            distance: activityMetricsService.formatDistance(session.distance),
            duration: activityMetricsService.formatDuration(currentElapsed),
            steps: activityMetricsService.formatSteps(steps),
            elevation: activityMetricsService.formatElevation(session.elevationGain),
          });
          setElapsedTime(currentElapsed);

          console.log(
            `[WalkingTrackerScreen] ✅ Synced: ${(session.distance / 1000).toFixed(2)} km, ` +
            `${currentElapsed}s, ${steps} steps, tracking continued in background`
          );
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []); // Subscribe only once to avoid race conditions

  // Update the ref whenever isTracking changes
  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  const handleHoldComplete = async () => {
    console.log('[WalkingTrackerScreen] Hold complete, checking permissions...');

    // ✅ Check permissions BEFORE starting countdown
    const permissionStatus = await appPermissionService.checkAllPermissions();

    if (!permissionStatus.location) {
      console.log('[WalkingTrackerScreen] Missing permissions, showing modal');
      setShowPermissionModal(true);
      return;
    }

    // Permissions granted, start countdown
    console.log('[WalkingTrackerScreen] Permissions granted, starting countdown...');

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
      const started = await simpleLocationTrackingService.startTracking(
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

  const initializeTracking = () => {
    setIsTracking(true);
    setIsPaused(false);
    isPausedRef.current = false;
    startTimeRef.current = Date.now();
    pauseStartTimeRef.current = 0;
    totalPausedTimeRef.current = 0;

    // Initialize route matching if a route is selected
    if (selectedRoute) {
      routeMatchingService.startMatching(selectedRoute);
      console.log(`[WalkingTrackerScreen] Started route matching for: ${selectedRoute.name}`);
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

  const updateMetrics = () => {
    const session = simpleLocationTrackingService.getCurrentSession();
    if (session) {
      const steps = activityMetricsService.estimateSteps(session.distance);

      setMetrics({
        distance: activityMetricsService.formatDistance(session.distance),
        duration: activityMetricsService.formatDuration(elapsedTime),
        steps: activityMetricsService.formatSteps(steps),
        elevation: activityMetricsService.formatElevation(
          session.elevationGain
        ),
      });
    }
  };

  const pauseTracking = async () => {
    if (!isPaused) {
      await simpleLocationTrackingService.pauseTracking();
      setIsPaused(true);
      isPausedRef.current = true;
      pauseStartTimeRef.current = Date.now(); // Store when pause started
    }
  };

  const resumeTracking = async () => {
    if (isPaused) {
      const pauseDuration = Date.now() - pauseStartTimeRef.current; // Calculate how long we were paused
      totalPausedTimeRef.current += pauseDuration; // Add to cumulative total
      await simpleLocationTrackingService.resumeTracking();
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

    // Stop route matching if active
    if (selectedRoute) {
      routeMatchingService.stopMatching();
    }

    const session = await simpleLocationTrackingService.stopTracking();
    setIsTracking(false);
    setIsPaused(false);

    if (session && session.distance > 10) {
      showWorkoutSummary(session);
    } else {
      resetMetrics();
    }
  };

  const showWorkoutSummary = async (session: TrackingSession) => {
    const steps = activityMetricsService.estimateSteps(session.distance);
    const calories = activityMetricsService.estimateCalories(
      'walking',
      session.distance,
      elapsedTime
    );

    // Convert LocationPoint[] to GPSCoordinate[] for route saving
    const gpsCoordinates = session.positions.map(point => ({
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: point.altitude,
      timestamp: point.timestamp,
    }));

    // Save workout to local storage BEFORE showing modal
    try {
      const workoutId = await LocalWorkoutStorageService.saveGPSWorkout({
        type: 'walking',
        distance: session.distance,
        duration: elapsedTime,
        calories,
        elevation: session.elevationGain,
      });

      console.log(`✅ Walking workout saved locally: ${workoutId}`);

      setWorkoutData({
        type: 'walking',
        distance: session.distance,
        duration: elapsedTime,
        calories,
        elevation: session.elevationGain,
        steps,
        localWorkoutId: workoutId,
        gpsCoordinates, // Pass GPS data for route saving
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
        elevation: session.elevationGain,
        steps,
        gpsCoordinates, // Pass GPS data even if local save failed
      });
      setSummaryModalVisible(true);
    }

    resetMetrics();
  };

  const resetMetrics = () => {
    setMetrics({
      distance: '0.00 km',
      duration: '0:00',
      steps: '0',
      elevation: '0 m',
    });
    setElapsedTime(0);
  };

  const handleRequestPermission = async () => {
    console.log('[WalkingTrackerScreen] User requested background tracking permission');
    setStepCounterLoading(true);
    setStepCounterError(null);

    try {
      const granted = await dailyStepCounterService.requestPermissions();

      if (granted) {
        console.log('[WalkingTrackerScreen] ✅ Permission granted - activating background tracking');

        // Fetch step data
        const stepData = await dailyStepCounterService.getTodaySteps();
        if (stepData) {
          setDailySteps(stepData.steps);
          const goal = await dailyStepGoalService.getGoal();
          setStepGoal(goal);
          const progress = dailyStepGoalService.calculateProgress(stepData.steps, goal);
          setStepProgress(progress);
        }

        // Activate background mode
        setIsBackgroundActive(true);
        setShowBackgroundBanner(false);
        setStepCounterLoading(false);

        console.log(`[WalkingTrackerScreen] ✅ Background tracking activated: ${stepData?.steps || 0} steps`);
      } else {
        console.warn('[WalkingTrackerScreen] ⚠️ Permission denied - GPS-only mode continues');
        setStepCounterError('Background tracking requires motion permissions');
        setShowBackgroundBanner(true);
        setIsBackgroundActive(false);
        setStepCounterLoading(false);
      }
    } catch (error) {
      console.error('[WalkingTrackerScreen] ❌ Error requesting permission:', error);
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
      console.log(`[WalkingTrackerScreen] Preparing to post ${dailySteps} daily steps`);

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

      console.log(`[WalkingTrackerScreen] ✅ Opening social share modal for ${dailySteps} steps`);
    } catch (error) {
      console.error('[WalkingTrackerScreen] ❌ Failed to post daily steps:', error);
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
        const progress = dailyStepGoalService.calculateProgress(dailySteps, newGoal);
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

  return (
    <View style={{ flex: 1 }}>
      {/* Daily Step Counter */}
      {!isTracking && !countdown && (
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
      )}

      {/* Walking Tracker */}
      <View style={styles.container}>
        {/* Metrics Display */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Ionicons name="navigate" size={20} color={theme.colors.textMuted} style={styles.metricIcon} />
              <Text style={styles.metricValue}>{metrics.distance}</Text>
              <Text style={styles.metricLabel}>Distance</Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="time" size={20} color={theme.colors.textMuted} style={styles.metricIcon} />
              <Text style={styles.metricValue}>{metrics.duration}</Text>
              <Text style={styles.metricLabel}>Duration</Text>
            </View>
          </View>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Ionicons name="walk" size={20} color={theme.colors.textMuted} style={styles.metricIcon} />
              <Text style={styles.metricValue}>{metrics.steps}</Text>
              <Text style={styles.metricLabel}>Steps</Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="trending-up" size={20} color={theme.colors.textMuted} style={styles.metricIcon} />
              <Text style={styles.metricValue}>{metrics.elevation}</Text>
              <Text style={styles.metricLabel}>Elevation</Text>
            </View>
          </View>
        </View>

        {/* Control Buttons */}
        <View style={styles.controlsContainer}>
          {!isTracking && !countdown ? (
            <>
              <TouchableOpacity
                style={styles.routesButton}
                onPress={() => setRouteSelectionVisible(true)}
              >
                <Ionicons
                  name={selectedRoute ? "map" : "map-outline"}
                  size={20}
                  color={selectedRoute ? theme.colors.accent : theme.colors.text}
                />
                <Text style={[
                  styles.routesButtonText,
                  selectedRoute && { color: theme.colors.accent }
                ]}>
                  {selectedRoute ? selectedRoute.name : 'Routes'}
                </Text>
              </TouchableOpacity>
              <HoldToStartButton
                label="Start Walk"
                onHoldComplete={handleHoldComplete}
                disabled={false}
                holdDuration={2000}
              />
            </>
          ) : !isTracking && countdown ? (
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          ) : (
            <>
              {!isPaused ? (
                <TouchableOpacity style={styles.pauseButton} onPress={pauseTracking}>
                  <Ionicons name="pause" size={30} color={theme.colors.text} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.resumeButton} onPress={resumeTracking}>
                  <Ionicons name="play" size={30} color={theme.colors.background} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.stopButton} onPress={stopTracking}>
                <Ionicons name="stop" size={30} color={theme.colors.text} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

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
        onSelectRoute={(route) => {
          setSelectedRoute(route);
          setRouteSelectionVisible(false);
        }}
        onTrackFreely={() => {
          setSelectedRoute(null);
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
          console.log('[WalkingTrackerScreen] ✅ Daily steps posted successfully');
        }}
      />

      {/* Permission Request Modal */}
      {showPermissionModal && (
        <PermissionRequestModal
          visible={showPermissionModal}
          onComplete={() => {
            setShowPermissionModal(false);
            // Re-check permissions after modal closes
            handleHoldComplete();
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 16,
  },
  metricsContainer: {
    justifyContent: 'flex-start',
    paddingTop: 12,
    paddingBottom: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  metricIcon: {
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 24,
    gap: 20,
  },
  routesButton: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  routesButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 0.5,
  },
  pauseButton: {
    backgroundColor: theme.colors.card,
    borderRadius: 35,
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  resumeButton: {
    backgroundColor: theme.colors.orangeBright,
    borderRadius: 35,
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    backgroundColor: theme.colors.card,
    borderRadius: 35,
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  countdownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 40,
  },
  countdownText: {
    fontSize: 120,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.accent,
    textAlign: 'center',
  },
});
