/**
 * CyclingTrackerScreen - Cycling activity tracker with speed metrics
 * Displays distance, time, speed, and elevation
 */

import React, { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AppStateManager } from '../../services/core/AppStateManager';
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
import { theme } from '../../styles/theme';
import { appPermissionService } from '../../services/initialization/AppPermissionService';
import { PermissionRequestModal } from '../../components/permissions/PermissionRequestModal';

export const CyclingTrackerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [metrics, setMetrics] = useState({
    distance: '0.00 km',
    duration: '0:00',
    speed: '0.0 km/h',
    elevation: '0 m',
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [selectedRoute, setSelectedRoute] = useState<SavedRoute | null>(null);
  const [routeSelectionVisible, setRouteSelectionVisible] = useState(false);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [workoutData, setWorkoutData] = useState<{
    type: 'running' | 'walking' | 'cycling';
    distance: number;
    duration: number;
    calories: number;
    elevation?: number;
    speed?: number;
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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (metricsUpdateRef.current) clearInterval(metricsUpdateRef.current);
    };
  }, []);

  // AppState listener for background/foreground transitions - using AppStateManager
  useEffect(() => {
    const appStateManager = AppStateManager;
    const unsubscribe = appStateManager.onStateChange((isActive) => {
      if (!isActive) {
        // App going to background - clear timers to prevent crashes
        console.log(
          '[CyclingTrackerScreen] App backgrounding, clearing timers...'
        );
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (metricsUpdateRef.current) {
          clearInterval(metricsUpdateRef.current);
          metricsUpdateRef.current = null;
        }
      } else if (isActive && isTrackingRef.current) {
        // App returned to foreground while tracking - restart timers and sync
        console.log(
          '[CyclingTrackerScreen] App returned to foreground, restarting timers and syncing...'
        );

        // Restart timers
        if (!timerRef.current) {
          timerRef.current = setInterval(() => {
            if (!isPausedRef.current) {
              const now = Date.now();
              const totalElapsed = Math.floor(
                (now - startTimeRef.current - totalPausedTimeRef.current) / 1000
              );
              setElapsedTime(totalElapsed);
            }
          }, 1000);
        }
        if (!metricsUpdateRef.current) {
          metricsUpdateRef.current = setInterval(updateMetrics, 1000);
        }

        // Force immediate sync of metrics
        const session = simpleLocationTrackingService.getCurrentSession();
        if (session) {
          const now = Date.now();
          const currentElapsed = Math.floor(
            (now - startTimeRef.current - totalPausedTimeRef.current) / 1000
          );

          const speed = activityMetricsService.calculateSpeed(
            session.distance,
            currentElapsed
          );

          setMetrics({
            distance: activityMetricsService.formatDistance(session.distance),
            duration: activityMetricsService.formatDuration(currentElapsed),
            speed: activityMetricsService.formatSpeed(speed),
            elevation: activityMetricsService.formatElevation(
              session.elevationGain
            ),
          });
          setElapsedTime(currentElapsed);
          setCurrentSpeed(speed);

          console.log(
            `[CyclingTrackerScreen] ✅ Synced: ${(
              session.distance / 1000
            ).toFixed(2)} km, ` +
              `${currentElapsed}s, ${speed.toFixed(
                1
              )} km/h, tracking continued in background`
          );
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []); // Subscribe only once to avoid race conditions

  // Update the ref whenever isTracking changes
  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  const startTracking = async () => {
    console.log('[CyclingTrackerScreen] Starting tracking...');

    // Check permissions first
    const permissionStatus = await appPermissionService.checkAllPermissions();

    if (!permissionStatus.location) {
      console.log(
        '[CyclingTrackerScreen] Missing location permission, showing modal'
      );
      setShowPermissionModal(true);
      return;
    }

    try {
      // Simple permission and start flow
      const started = await simpleLocationTrackingService.startTracking(
        'cycling'
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
        '[CyclingTrackerScreen] Failed to start tracking:',
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
      console.log(
        `[CyclingTrackerScreen] Started route matching for: ${selectedRoute.name}`
      );
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

    metricsUpdateRef.current = setInterval(updateMetrics, 1000); // Update every second for speed
  };

  const updateMetrics = () => {
    // CRITICAL: Don't update UI if app is backgrounded
    const appStateManager = AppStateManager;
    if (!appStateManager.isActive()) {
      return;
    }

    const session = simpleLocationTrackingService.getCurrentSession();
    if (session) {
      // Calculate current speed based on distance and time
      let speed = activityMetricsService.calculateSpeed(
        session.distance,
        elapsedTime
      );

      setCurrentSpeed(speed);
      setMetrics({
        distance: activityMetricsService.formatDistance(session.distance),
        duration: activityMetricsService.formatDuration(elapsedTime),
        speed: activityMetricsService.formatSpeed(speed),
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

    if (session && session.distance > 50) {
      // Minimum 50 meters for cycling
      showWorkoutSummary(session);
    } else {
      resetMetrics();
    }
  };

  const showWorkoutSummary = async (session: TrackingSession) => {
    const avgSpeed = activityMetricsService.calculateSpeed(
      session.distance,
      elapsedTime
    );
    const calories = activityMetricsService.estimateCalories(
      'cycling',
      session.distance,
      elapsedTime
    );

    // Convert LocationPoint[] to GPSCoordinate[] for route saving
    const gpsCoordinates = session.positions.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: point.altitude,
      timestamp: point.timestamp,
    }));

    // Save workout to local storage BEFORE showing modal
    try {
      const workoutId = await LocalWorkoutStorageService.saveGPSWorkout({
        type: 'cycling',
        distance: session.distance,
        duration: elapsedTime,
        calories,
        elevation: session.elevationGain,
        speed: avgSpeed,
      });

      console.log(`✅ Cycling workout saved locally: ${workoutId}`);

      setWorkoutData({
        type: 'cycling',
        distance: session.distance,
        duration: elapsedTime,
        calories,
        elevation: session.elevationGain,
        speed: avgSpeed,
        localWorkoutId: workoutId,
        gpsCoordinates, // Pass GPS data for route saving
      });
      setSummaryModalVisible(true);
    } catch (error) {
      console.error('❌ Failed to save cycling workout locally:', error);
      // Still show modal even if save failed
      setWorkoutData({
        type: 'cycling',
        distance: session.distance,
        duration: elapsedTime,
        calories,
        elevation: session.elevationGain,
        speed: avgSpeed,
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
      speed: '0.0 km/h',
      elevation: '0 m',
    });
    setElapsedTime(0);
    setCurrentSpeed(0);
  };

  useEffect(() => {
    if (isTracking && !isPaused) {
      updateMetrics();
    }
  }, [elapsedTime]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top', 'bottom']}
    >
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
          tertiary: {
            label: 'Speed',
            value: metrics.speed,
            icon: 'speedometer',
          },
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
        startButtonText="Start Ride"
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
        activityType="cycling"
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

      {/* Permission Request Modal */}
      <PermissionRequestModal
        visible={showPermissionModal}
        onComplete={() => {
          setShowPermissionModal(false);
          // Try starting tracking again after permissions are granted
          startTracking();
        }}
      />
    </SafeAreaView>
  );
};
