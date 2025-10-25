/**
 * RunningTrackerScreen - Real-time running tracker
 * Displays distance, time, pace, and elevation with GPS tracking
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as TaskManager from 'expo-task-manager';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../styles/theme';
import { CustomAlert } from '../../components/ui/CustomAlert';
import { simpleRunTracker } from '../../services/activity/SimpleRunTracker';
import type { RunSession, GPSPoint } from '../../services/activity/SimpleRunTracker';
import { activityMetricsService } from '../../services/activity/ActivityMetricsService';
import type { FormattedMetrics } from '../../services/activity/ActivityMetricsService';
import { gpsHealthMonitor } from '../../services/activity/GPSHealthMonitor';

// Legacy import for type compatibility
import type { Split } from '../../services/activity/SimpleLocationTrackingService';
import {
  GPSStatusIndicator,
  type GPSSignalStrength,
} from '../../components/activity/GPSStatusIndicator';
import { BatteryWarning } from '../../components/activity/BatteryWarning';
import { WorkoutSummaryModal } from '../../components/activity/WorkoutSummaryModal';
import LocalWorkoutStorageService from '../../services/fitness/LocalWorkoutStorageService';
import { BACKGROUND_LOCATION_TASK } from '../../services/activity/BackgroundLocationTask';
import { PermissionRequestModal } from '../../components/permissions/PermissionRequestModal';
import { appPermissionService } from '../../services/initialization/AppPermissionService';
import routeMatchingService from '../../services/routes/RouteMatchingService';
import routeStorageService from '../../services/routes/RouteStorageService';
import type { RouteMatch, ProgressComparison } from '../../services/routes/RouteMatchingService';
import { RouteRecognitionBadge } from '../../components/activity/RouteRecognitionBadge';
import { RoutePRComparison } from '../../components/activity/RoutePRComparison';
import { RouteSelectionModal } from '../../components/routes/RouteSelectionModal';
import type { SavedRoute } from '../../services/routes/RouteStorageService';

// Constants
const TIMER_INTERVAL_MS = 1000; // Update timer every second
const METRICS_UPDATE_INTERVAL_MS = 1000; // Update metrics every second for running
const MIN_WORKOUT_DISTANCE_METERS = 10; // Minimum distance to show workout summary
const ZOMBIE_SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours
const ANDROID_BACKGROUND_WARNING_KEY =
  '@runstr:android_background_warning_shown';
const ROUTE_CHECK_INTERVAL_MS = 30000; // Check for route match every 30 seconds

interface MetricCardProps {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, icon }) => (
  <View style={styles.metricCard}>
    {icon && (
      <Ionicons
        name={icon}
        size={20}
        color={theme.colors.textMuted}
        style={styles.metricIcon}
      />
    )}
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

export const RunningTrackerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [metrics, setMetrics] = useState<FormattedMetrics>({
    distance: '0.00 km',
    duration: '0:00',
    pace: '--:--',
    elevation: '0 m',
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [gpsSignal, setGpsSignal] = useState<GPSSignalStrength>('none'); // Start with 'none' until tracking begins
  const [gpsAccuracy, setGpsAccuracy] = useState<number | undefined>();
  const [isBackgroundTracking, setIsBackgroundTracking] = useState(false);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [workoutData, setWorkoutData] = useState<{
    type: 'running' | 'walking' | 'cycling';
    distance: number;
    duration: number;
    calories: number;
    elevation?: number;
    pace?: number;
    speed?: number;
    steps?: number;
    splits?: Split[];
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

  // Route matching state
  const [matchedRoute, setMatchedRoute] = useState<RouteMatch | null>(null);
  const [prComparison, setPrComparison] = useState<ProgressComparison | null>(null);
  const [showRouteSelectionModal, setShowRouteSelectionModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<SavedRoute | null>(null);

  const metricsUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const routeCheckRef = useRef<NodeJS.Timeout | null>(null); // For route matching interval
  // NOTE: Timer refs removed - SimpleRunTracker handles all timing internally via hybrid timer

  useEffect(() => {
    return () => {
      // Cleanup timers on unmount (duration now GPS-timestamp-based from service)
      if (metricsUpdateRef.current) clearInterval(metricsUpdateRef.current);
      if (routeCheckRef.current) clearInterval(routeCheckRef.current);
    };
  }, []);

  // AppState listener for background/foreground transitions
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isTracking) {
        // App returned to foreground - SimpleRunTracker automatically syncs background data
        console.log('[RunningTrackerScreen] App returned to foreground, syncing...');

        const session = await simpleRunTracker.getCurrentSession();
        if (session && session.distance !== undefined && session.duration !== undefined) {
          const formattedDuration = formatElapsedTime(session.duration);

          const currentMetrics = {
            distance: session.distance,
            duration: session.duration,
            pace: activityMetricsService.calculatePace(
              session.distance,
              session.duration
            ),
            elevationGain: 0, // TODO: SimpleRunTracker doesn't track elevation yet
          };

          const formatted = activityMetricsService.getFormattedMetrics(
            currentMetrics,
            'running'
          );
          formatted.duration = formattedDuration;

          setMetrics(formatted);
          setElapsedTime(session.duration);

          // Update GPS signal from health monitor
          const lastPoint = session.gpsPoints?.[session.gpsPoints.length - 1];
          const gpsStatus = gpsHealthMonitor.assessSignalQuality(lastPoint?.accuracy);
          setGpsSignal(
            gpsStatus.quality === 'excellent' || gpsStatus.quality === 'good'
              ? 'strong'
              : gpsStatus.quality === 'poor'
              ? 'weak'
              : 'none'
          );

          console.log(
            `[RunningTrackerScreen] ✅ Synced: ${(session.distance / 1000).toFixed(2)} km, ` +
            `${session.duration}s`
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
    console.log('[RunningTrackerScreen] Starting tracking...');

    // First check if we have required permissions
    const permissionStatus = await appPermissionService.checkAllPermissions();

    if (!permissionStatus.location) {
      // Show permission request modal
      console.log('[RunningTrackerScreen] Missing permissions, showing modal');
      setShowPermissionModal(true);
      return;
    }

    // Permissions granted, proceed with tracking
    proceedWithTracking();
  };

  const proceedWithTracking = async () => {
    try {
      // Start tracking with SimpleRunTracker
      await simpleRunTracker.startTracking('running');
      initializeTracking();
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
        '[RunningTrackerScreen] Failed to start tracking:',
        errorMessage
      );
    }
  };

  const initializeTracking = () => {
    setIsTracking(true);
    setIsPaused(false);
    setGpsSignal('searching'); // Show GPS initializing when tracking starts
    gpsHealthMonitor.reset(); // Reset GPS health monitor for new session

    // Reset route matching state (unless we pre-selected a route)
    if (!selectedRoute) {
      setMatchedRoute(null);
      setPrComparison(null);
    } else {
      // If we have a pre-selected route, set it as matched immediately
      setMatchedRoute({
        routeId: selectedRoute.id,
        routeName: selectedRoute.name,
        confidence: 1.0, // 100% confidence since user selected it
        matchedPoints: 0,
        totalPoints: 0,
        matchPercentage: 0,
      });
    }

    // Start route checking timer
    routeCheckRef.current = setInterval(checkForRouteMatch, ROUTE_CHECK_INTERVAL_MS);
    // Check immediately as well
    setTimeout(checkForRouteMatch, 5000); // Check after 5 seconds to get initial GPS points

    // Start metrics update timer - SimpleRunTracker handles all timing internally
    metricsUpdateRef.current = setInterval(async () => {
      const session = await simpleRunTracker.getCurrentSession();

      if (session && session.distance !== undefined && session.duration !== undefined) {
        const formattedDuration = formatElapsedTime(session.duration);

        const currentMetrics = {
          distance: session.distance,
          duration: session.duration,
          pace: activityMetricsService.calculatePace(
            session.distance,
            session.duration
          ),
          elevationGain: 0, // TODO: SimpleRunTracker doesn't track elevation yet
        };

        const formatted = activityMetricsService.getFormattedMetrics(
          currentMetrics,
          'running'
        );
        formatted.duration = formattedDuration;

        setMetrics(formatted);
        setElapsedTime(session.duration);

        // Update GPS signal from health monitor
        const lastPoint = session.gpsPoints?.[session.gpsPoints.length - 1];
        const gpsStatus = gpsHealthMonitor.assessSignalQuality(lastPoint?.accuracy);
        setGpsSignal(
          gpsStatus.quality === 'excellent' || gpsStatus.quality === 'good'
            ? 'strong'
            : gpsStatus.quality === 'poor'
            ? 'weak'
            : 'none'
        );
        setGpsAccuracy(lastPoint?.accuracy);
        setIsBackgroundTracking(false);
      }
    }, METRICS_UPDATE_INTERVAL_MS);
  };

  const handlePermissionsGranted = () => {
    // Permissions were granted, close modal and start tracking
    setShowPermissionModal(false);
    proceedWithTracking();
  };

  const formatElapsedTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const checkForRouteMatch = async () => {
    const session = await simpleRunTracker.getCurrentSession();
    if (!session || !session.gpsPoints || session.gpsPoints.length < 10) {
      return; // Need at least 10 GPS points to attempt matching
    }

    try {
      // SimpleRunTracker already uses GPSPoint[] format
      const match = await routeMatchingService.findMatchingRoute(
        session.gpsPoints,
        'running'
      );

      if (match && match.confidence >= 0.7 && session.distance !== undefined && session.duration !== undefined) {
        setMatchedRoute(match);

        // Check PR comparison if we have a matched route
        const comparison = await routeMatchingService.compareWithPR(
          match.routeId,
          session.distance,
          session.duration
        );

        if (comparison) {
          setPrComparison(comparison);
        }
      } else {
        // Lost the route or confidence too low
        if (matchedRoute) {
          setMatchedRoute(null);
          setPrComparison(null);
        }
      }
    } catch (error) {
      console.error('Error checking for route match:', error);
    }
  };

  const pauseTracking = async () => {
    if (!isPaused) {
      await simpleRunTracker.pauseTracking();
      setIsPaused(true);
    }
  };

  const resumeTracking = async () => {
    if (isPaused) {
      await simpleRunTracker.resumeTracking();
      setIsPaused(false);
    }
  };

  const stopTracking = async () => {
    // Clear timers
    if (metricsUpdateRef.current) {
      clearInterval(metricsUpdateRef.current);
      metricsUpdateRef.current = null;
    }
    if (routeCheckRef.current) {
      clearInterval(routeCheckRef.current);
      routeCheckRef.current = null;
    }

    const session = await simpleRunTracker.stopTracking();
    setIsTracking(false);
    setIsPaused(false);

    // If we were on a matched route, update its stats
    if (matchedRoute && session && session.distance && session.duration) {
      try {
        const pace = activityMetricsService.calculatePace(
          session.distance,
          session.duration
        );

        if (pace !== undefined) {
          await routeStorageService.updateRouteStats(matchedRoute.routeId, {
            workoutId: `workout_${Date.now()}`,
            workoutTime: session.duration,
            workoutPace: pace,
          });

          console.log(`✅ Updated route stats for "${matchedRoute.routeName}"`);
        }
      } catch (error) {
        console.error('Failed to update route stats:', error);
      }
    }

    if (session && session.distance !== undefined && session.distance > MIN_WORKOUT_DISTANCE_METERS) {
      // Only show summary if moved at least 10 meters
      showWorkoutSummary(session as RunSession);
    } else {
      // Reset metrics
      setMetrics({
        distance: '0.00 km',
        duration: '0:00',
        pace: '--:--',
        elevation: '0 m',
      });
      setElapsedTime(0);
      setMatchedRoute(null);
      setPrComparison(null);
      setSelectedRoute(null); // Clear selected route
    }
  };

  const showWorkoutSummary = async (session: RunSession) => {
    const calories = activityMetricsService.estimateCalories(
      'running',
      session.distance,
      session.duration
    );
    const pace = activityMetricsService.calculatePace(
      session.distance,
      session.duration
    );

    // SimpleRunTracker already uses GPSPoint[] format (compatible with GPSCoordinate)
    const gpsCoordinates = session.gpsPoints.map(point => ({
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: point.altitude,
      timestamp: point.timestamp,
    }));

    // Save workout to local storage BEFORE showing modal
    // This ensures data persists even if user dismisses modal
    try {
      // Get start position for weather lookup
      const startPosition = session.gpsPoints[0];

      const workoutId = await LocalWorkoutStorageService.saveGPSWorkout({
        type: 'running',
        distance: session.distance,
        duration: session.duration,
        calories,
        elevation: 0, // TODO: SimpleRunTracker doesn't calculate elevation yet
        pace,
        splits: undefined, // TODO: SimpleRunTracker doesn't calculate splits yet
        // Pass GPS coordinates for weather lookup
        startLatitude: startPosition?.latitude,
        startLongitude: startPosition?.longitude,
      });

      console.log(`✅ GPS workout saved locally: ${workoutId}`);

      setWorkoutData({
        type: 'running',
        distance: session.distance,
        duration: session.duration,
        calories,
        elevation: 0, // TODO: Add elevation tracking to SimpleRunTracker
        pace,
        splits: undefined, // TODO: Add splits calculation to SimpleRunTracker
        localWorkoutId: workoutId, // Pass to modal for sync tracking
        gpsCoordinates, // Pass GPS data for route saving
      });
      setSummaryModalVisible(true);
    } catch (error) {
      console.error('❌ Failed to save workout locally:', error);
      // Still show modal even if save failed
      setWorkoutData({
        type: 'running',
        distance: session.distance,
        duration: session.duration,
        calories,
        elevation: 0,
        pace,
        splits: undefined,
        gpsCoordinates, // Pass GPS data even if local save failed
      });
      setSummaryModalVisible(true);
    }

    // Reset metrics after showing summary
    setMetrics({
      distance: '0.00 km',
      duration: '0:00',
      pace: '--:--',
      elevation: '0 m',
    });
    setElapsedTime(0);
  };

  return (
    <View style={styles.container}>
      {/* GPS Status Indicator */}
      {isTracking && (
        <View style={styles.gpsContainer}>
          <GPSStatusIndicator
            signalStrength={gpsSignal}
            accuracy={gpsAccuracy}
            isBackgroundTracking={isBackgroundTracking}
          />
        </View>
      )}

      {/* Battery Warning */}
      {isTracking && <BatteryWarning />}

      {/* Route Recognition Badge */}
      <RouteRecognitionBadge
        routeName={matchedRoute?.routeName || ''}
        confidence={matchedRoute?.confidence || 0}
        isVisible={isTracking && matchedRoute !== null}
      />

      {/* PR Comparison */}
      <RoutePRComparison
        isAheadOfPR={prComparison?.isAheadOfPR || false}
        timeDifference={prComparison?.timeDifference || 0}
        percentComplete={prComparison?.percentComplete || 0}
        estimatedFinishTime={prComparison?.estimatedFinishTime || 0}
        prFinishTime={prComparison?.prFinishTime || 0}
        isVisible={isTracking && prComparison !== null}
      />

      {/* Metrics Display */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricsRow}>
          <MetricCard
            label="Distance"
            value={metrics.distance}
            icon="navigate"
          />
          <MetricCard
            label="Duration"
            value={formatElapsedTime(elapsedTime)}
            icon="time"
          />
        </View>
        <View style={styles.metricsRow}>
          <MetricCard
            label="Pace"
            value={metrics.pace ?? '--:--'}
            icon="speedometer"
          />
          <MetricCard
            label="Elevation"
            value={metrics.elevation ?? '0 m'}
            icon="trending-up"
          />
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        {!isTracking ? (
          <>
            <TouchableOpacity
              style={styles.routesButton}
              onPress={() => setShowRouteSelectionModal(true)}
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
            <TouchableOpacity
              style={styles.startButton}
              onPress={startTracking}
            >
              <Text style={styles.startButtonText}>Start Run</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {!isPaused ? (
              <TouchableOpacity
                style={styles.pauseButton}
                onPress={pauseTracking}
              >
                <Ionicons name="pause" size={30} color={theme.colors.text} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.resumeButton}
                onPress={resumeTracking}
              >
                <Ionicons
                  name="play"
                  size={30}
                  color={theme.colors.background}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.stopButton} onPress={stopTracking}>
              <Ionicons name="stop" size={30} color={theme.colors.text} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Workout Summary Modal */}
      {workoutData && (
        <WorkoutSummaryModal
          visible={summaryModalVisible}
          onClose={() => {
            setSummaryModalVisible(false);
            setWorkoutData(null);
          }}
          workout={workoutData as any}
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

      {/* Permission Request Modal - Only mount when needed to prevent auto-start bug */}
      {showPermissionModal && (
        <PermissionRequestModal
          visible={true}
          onComplete={handlePermissionsGranted}
        />
      )}

      {/* Route Selection Modal */}
      <RouteSelectionModal
        visible={showRouteSelectionModal}
        activityType="running"
        onSelectRoute={(route) => {
          setSelectedRoute(route);
          setShowRouteSelectionModal(false);
          console.log(`✅ Selected route: ${route.name}`);
        }}
        onTrackFreely={() => {
          setSelectedRoute(null);
          setShowRouteSelectionModal(false);
          console.log('📍 Tracking freely - auto-detection enabled');
        }}
        onClose={() => setShowRouteSelectionModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 20,
  },
  gpsContainer: {
    marginBottom: 16,
  },
  metricsContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 20,
    paddingBottom: 20, // Ensure space for controls
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 8,
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
    paddingBottom: 40,
    gap: 20,
  },
  routesButton: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    paddingVertical: 16,
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
  startButton: {
    backgroundColor: theme.colors.text,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#000000',
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
    backgroundColor: theme.colors.orangeBright, // Orange for resume
    borderRadius: 35,
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    backgroundColor: theme.colors.card, // Dark gray for stop
    borderRadius: 35,
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  splitsContainer: {
    marginTop: 20,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.orangeDeep,
    maxHeight: 220, // Fits ~5 splits, scrollable for longer runs
    flexShrink: 1, // Allow shrinking if space is limited
  },
  splitsTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.orangeBright,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  splitsScrollContent: {
    gap: 4, // Reduced for compact layout
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 6, // Reduced for compact layout
    borderWidth: 1,
    borderColor: theme.colors.orangeDeep,
  },
  splitNumberContainer: {
    width: 40,
    marginRight: 12,
  },
  splitNumber: {
    fontSize: 14, // Reduced for compact layout
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.orangeBright,
  },
  splitTimeContainer: {
    flex: 1,
  },
  splitTime: {
    fontSize: 15, // Reduced for compact layout
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 2,
  },
  splitPace: {
    fontSize: 10, // Reduced for compact layout
    color: theme.colors.textMuted,
  },
  splitIconContainer: {
    marginLeft: 8,
  },
});
