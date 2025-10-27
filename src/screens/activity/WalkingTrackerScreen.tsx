/**
 * WalkingTrackerScreen - Walking activity tracker with step estimation
 * Displays distance, time, steps, and elevation
 * Now includes daily step counter with goal tracking
 */

import React, { useState, useEffect, useRef } from 'react';
import { Platform, AppState, AppStateStatus, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BaseTrackerComponent } from '../../components/activity/BaseTrackerComponent';
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

  // Daily step counter state
  const [dailySteps, setDailySteps] = useState<number | null>(null);
  const [stepGoal, setStepGoal] = useState<number>(10000);
  const [stepProgress, setStepProgress] = useState<StepGoalProgress | null>(null);
  const [stepCounterLoading, setStepCounterLoading] = useState(true);
  const [stepCounterError, setStepCounterError] = useState<string | null>(null);
  const [postingState, setPostingState] = useState<PostingState>('idle');
  const stepUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (metricsUpdateRef.current) clearInterval(metricsUpdateRef.current);
      if (stepUpdateIntervalRef.current) clearInterval(stepUpdateIntervalRef.current);
    };
  }, []);

  // Daily step counter initialization and polling
  useEffect(() => {
    const fetchDailySteps = async () => {
      try {
        setStepCounterLoading(true);
        setStepCounterError(null);

        // Check if pedometer is available
        const available = await dailyStepCounterService.isAvailable();
        if (!available) {
          setStepCounterError('Step counter not available on this device');
          setStepCounterLoading(false);
          return;
        }

        // Request permissions
        const permissionsGranted = await dailyStepCounterService.requestPermissions();
        if (!permissionsGranted) {
          setStepCounterError('Motion permissions not granted');
          setStepCounterLoading(false);
          return;
        }

        // Get today's steps
        const stepData = await dailyStepCounterService.getTodaySteps();
        if (stepData) {
          setDailySteps(stepData.steps);
        }

        // Get goal
        const goal = await dailyStepGoalService.getGoal();
        setStepGoal(goal);

        // Calculate progress
        if (stepData) {
          const progress = dailyStepGoalService.calculateProgress(stepData.steps, goal);
          setStepProgress(progress);
        }

        setStepCounterLoading(false);
        console.log(`[WalkingTrackerScreen] ✅ Daily steps loaded: ${stepData?.steps || 0}`);
      } catch (error) {
        console.error('[WalkingTrackerScreen] Error fetching daily steps:', error);
        setStepCounterError('Failed to load step count');
        setStepCounterLoading(false);
      }
    };

    // Initial fetch
    fetchDailySteps();

    // Set up polling (every 5 minutes)
    stepUpdateIntervalRef.current = setInterval(() => {
      fetchDailySteps();
    }, STEP_UPDATE_INTERVAL);

    return () => {
      if (stepUpdateIntervalRef.current) {
        clearInterval(stepUpdateIntervalRef.current);
      }
    };
  }, []);

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
      if (nextAppState === 'active' && isTracking) {
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
  }, [isTracking]); // Re-subscribe when tracking state changes

  const startTracking = async () => {
    console.log('[WalkingTrackerScreen] Starting tracking...');

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

      // Prepare workout data for modal
      setWorkoutData({
        type: 'walking',
        distance: 0, // No distance for daily steps
        duration,
        calories,
        steps: dailySteps,
        localWorkoutId: workoutId,
      });

      // Show workout summary modal
      setSummaryModalVisible(true);

      // Mark as posted
      setPostingState('posted');
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

  useEffect(() => {
    if (isTracking && !isPaused) {
      updateMetrics();
    }
  }, [elapsedTime]);

  return (
    <ScrollView style={{ flex: 1 }}>
      {/* Daily Step Counter */}
      {!isTracking && (
        <DailyStepGoalCard
          steps={dailySteps}
          progress={stepProgress}
          loading={stepCounterLoading}
          error={stepCounterError}
          onPostSteps={handlePostDailySteps}
          postingState={postingState}
        />
      )}

      {/* Walking Tracker */}
      <BaseTrackerComponent
        metrics={{
          primary: {
            label: 'Distance',
            value: metrics.distance,
            icon: 'navigate',
          },
          secondary: {
            label: 'Duration',
            value: metrics.duration,
            icon: 'time',
          },
          tertiary: { label: 'Steps', value: metrics.steps, icon: 'walk' },
          quaternary: {
            label: 'Elevation',
            value: metrics.elevation,
            icon: 'trending-up',
          },
        }}
        isTracking={isTracking}
        isPaused={isPaused}
        onStart={startTracking}
        onPause={pauseTracking}
        onResume={resumeTracking}
        onStop={stopTracking}
        startButtonText="Start Walk"
        onRoutesPress={() => setRouteSelectionVisible(true)}
        routesButtonText={selectedRoute ? selectedRoute.name : 'Routes'}
      />

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
    </ScrollView>
  );
};
