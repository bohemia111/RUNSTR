/**
 * CyclingTrackerScreen - Cycling activity tracker with speed metrics
 * Displays distance, time, speed, and elevation
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
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
import { RouteSelectionModal } from '../../components/routes/RouteSelectionModal';
import routeStorageService from '../../services/routes/RouteStorageService';
import { theme } from '../../styles/theme';
import { appPermissionService } from '../../services/initialization/AppPermissionService';
import { PermissionRequestModal } from '../../components/permissions/PermissionRequestModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Weekly distance goal components
import {
  WeeklyDistanceGoalCard,
  type PostingState,
} from '../../components/activity/WeeklyDistanceGoalCard';
import { DistanceGoalPickerModal } from '../../components/activity/DistanceGoalPickerModal';
import { weeklyDistanceGoalService } from '../../services/activity/WeeklyDistanceGoalService';
import type { DistanceGoalProgress } from '../../services/activity/WeeklyDistanceGoalService';
import { EnhancedSocialShareModal } from '../../components/profile/shared/EnhancedSocialShareModal';
import { nostrProfileService } from '../../services/nostr/NostrProfileService';
import type { NostrProfile } from '../../services/nostr/NostrProfileService';
import type { PublishableWorkout } from '../../services/nostr/workoutPublishingService';
// Redesigned components
import { SpeedGauge } from '../../components/activity/SpeedGauge';
import { HeroMetric } from '../../components/activity/HeroMetric';
import {
  SecondaryMetricRow,
  type SecondaryMetric,
} from '../../components/activity/SecondaryMetricRow';
import { CountdownOverlay } from '../../components/activity/CountdownOverlay';
import { ControlBar } from '../../components/activity/ControlBar';
import { LastActivityCard } from '../../components/activity/LastActivityCard';

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
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [avgSpeed, setAvgSpeed] = useState(0);
  const [selectedRoute, setSelectedRoute] = useState<{ id: string; name: string } | null>(null);
  const [routeSelectionVisible, setRouteSelectionVisible] = useState(false);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [countdown, setCountdown] = useState<3 | 2 | 1 | 'GO' | null>(null);
  const [workoutData, setWorkoutData] = useState<{
    type: 'running' | 'walking' | 'cycling';
    distance: number;
    duration: number;
    calories: number;
    elevation?: number;
    speed?: number;
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
  // Weekly distance goal state
  const [weeklyDistance, setWeeklyDistance] = useState<number | null>(null);
  const [distanceGoal, setDistanceGoal] = useState<number>(50);
  const [distanceProgress, setDistanceProgress] =
    useState<DistanceGoalProgress | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(true);
  const [distancePostingState, setDistancePostingState] =
    useState<PostingState>('idle');
  const [goalPickerVisible, setGoalPickerVisible] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [userProfile, setUserProfile] = useState<NostrProfile | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [preparedWorkout, setPreparedWorkout] =
    useState<PublishableWorkout | null>(null);

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
          '[CyclingTrackerScreen] Failed to load user profile:',
          error
        );
      }
    };

    loadProfileAndId();
  }, []);

  // Load weekly distance data on mount
  useEffect(() => {
    const loadWeeklyDistance = async () => {
      try {
        setDistanceLoading(true);

        // Get goal
        const goal = await weeklyDistanceGoalService.getGoal('cycling');
        setDistanceGoal(goal);

        // Get weekly distance
        const distance =
          await weeklyDistanceGoalService.getWeeklyDistance('cycling');
        setWeeklyDistance(distance);

        // Calculate progress
        const progress = weeklyDistanceGoalService.calculateProgress(
          distance,
          goal
        );
        setDistanceProgress(progress);

        console.log(
          `[CyclingTrackerScreen] Weekly distance: ${distance.toFixed(
            2
          )}km, goal: ${goal}km`
        );

        setDistanceLoading(false);
      } catch (error) {
        console.error(
          '[CyclingTrackerScreen] Error loading weekly distance:',
          error
        );
        setDistanceLoading(false);
      }
    };

    loadWeeklyDistance();
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
        const session = simpleRunTracker.getCurrentSession();
        if (session) {
          const now = Date.now();
          const currentElapsed = Math.floor(
            (now - startTimeRef.current - totalPausedTimeRef.current) / 1000
          );

          const distance = session.distance || 0;
          const speed = activityMetricsService.calculateSpeed(
            distance,
            currentElapsed
          );

          setMetrics({
            distance: activityMetricsService.formatDistance(distance),
            duration: activityMetricsService.formatDuration(currentElapsed),
            speed: activityMetricsService.formatSpeed(speed),
            elevation: activityMetricsService.formatElevation(
              session.elevationGain || 0
            ),
          });
          setElapsedTime(currentElapsed);
          setCurrentSpeed(speed);

          console.log(
            `[CyclingTrackerScreen] ✅ Synced: ${(
              distance / 1000
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

  const handleHoldComplete = async () => {
    console.log('[CyclingTrackerScreen] Hold complete, starting countdown...');

    // Check permissions BEFORE countdown
    const permissionStatus = await appPermissionService.checkAllPermissions();

    if (!permissionStatus.location) {
      console.log('[CyclingTrackerScreen] Missing permissions, showing modal');
      setShowPermissionModal(true);
      return;
    }

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
            proceedWithTracking();
          }, 500); // Show "GO!" for 0.5 seconds
        }, 1000);
      }, 1000);
    }, 1000);
  };

  const proceedWithTracking = async () => {
    try {
      // Start tracking without re-checking permissions (already checked in handleHoldComplete)
      const started = await simpleRunTracker.startTracking(
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

    const session = simpleRunTracker.getCurrentSession();
    if (session) {
      const distance = session.distance || 0;
      // Calculate average speed based on total distance and time
      const calculatedAvgSpeed = activityMetricsService.calculateSpeed(
        distance,
        elapsedTime
      );

      // Get current speed from recent position data if available
      // For now we'll use avg speed as current (GPS updates will improve this)
      const instantSpeed = calculatedAvgSpeed;

      setCurrentSpeed(instantSpeed);
      setAvgSpeed(calculatedAvgSpeed);

      // Track max speed
      if (instantSpeed > maxSpeed) {
        setMaxSpeed(instantSpeed);
      }

      setMetrics({
        distance: activityMetricsService.formatDistance(distance),
        duration: activityMetricsService.formatDuration(elapsedTime),
        speed: activityMetricsService.formatSpeed(instantSpeed),
        elevation: activityMetricsService.formatElevation(
          session.elevationGain || 0
        ),
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

    const session = await simpleRunTracker.stopTracking();
    setIsTracking(false);
    setIsPaused(false);

    if (session && session.distance > 50) {
      // Minimum 50 meters for cycling
      showWorkoutSummary(session);
    } else {
      resetMetrics();
    }
  };

  const showWorkoutSummary = async (session: RunSession) => {
    const avgSpeed = activityMetricsService.calculateSpeed(
      session.distance,
      elapsedTime
    );
    const calories = activityMetricsService.estimateCalories(
      'cycling',
      session.distance,
      elapsedTime
    );

    // Save workout to local storage BEFORE showing modal
    try {
      const result = await LocalWorkoutStorageService.saveGPSWorkout({
        type: 'cycling',
        distance: session.distance,
        duration: elapsedTime,
        calories,
        elevation: session.elevationGain || 0,
        speed: avgSpeed,
        // Pass route info if selected
        routeId: selectedRoute?.id,
        routeLabel: selectedRoute?.name,
      });

      console.log(`✅ Cycling workout saved locally: ${result.workoutId}`);
      if (result.rewardSent) {
        console.log(`[CyclingTracker] ⚡ Reward sent: ${result.rewardAmount} sats!`);
      }

      // If a route was selected, add this workout to the route
      if (selectedRoute) {
        try {
          await routeStorageService.addWorkoutToRoute(
            selectedRoute.id,
            result.workoutId,
            elapsedTime,
            undefined // No pace for cycling
          );
          console.log(`[CyclingTracker] Workout added to route "${selectedRoute.name}"`);
        } catch (routeError) {
          console.error('[CyclingTracker] Failed to add workout to route:', routeError);
        }
      }

      setWorkoutData({
        type: 'cycling',
        distance: session.distance,
        duration: elapsedTime,
        calories,
        elevation: session.elevationGain || 0,
        speed: avgSpeed,
        localWorkoutId: result.workoutId,
        routeId: selectedRoute?.id,
        routeName: selectedRoute?.name,
        rewardSent: result.rewardSent,
        rewardAmount: result.rewardAmount,
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
        elevation: session.elevationGain || 0,
        speed: avgSpeed,
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
      speed: '0.0 km/h',
      elevation: '0 m',
    });
    setElapsedTime(0);
    setCurrentSpeed(0);
    setMaxSpeed(0);
    setAvgSpeed(0);
  };

  // Handle posting weekly distance to Nostr
  const handlePostWeeklyDistance = async () => {
    if (!weeklyDistance || weeklyDistance === 0) {
      console.warn('[CyclingTrackerScreen] Cannot post - no distance available');
      return;
    }

    if (distancePostingState === 'posted') {
      console.warn('[CyclingTrackerScreen] Weekly distance already posted');
      return;
    }

    try {
      setDistancePostingState('posting');
      console.log(
        `[CyclingTrackerScreen] Preparing to post ${weeklyDistance.toFixed(2)}km weekly distance`
      );

      const weekBounds = weeklyDistanceGoalService.getWeekBounds();
      const weekNumber = weeklyDistanceGoalService.getWeekNumber();

      // Create PublishableWorkout for social sharing
      const publishableWorkout: PublishableWorkout = {
        id: `weekly_cycling_${weekNumber}_${Date.now()}`,
        userId: userId || 'unknown',
        type: 'cycling',
        startTime: weekBounds.start.toISOString(),
        endTime: weekBounds.end.toISOString(),
        duration: 0, // Weekly summary - no specific duration
        distance: weeklyDistance * 1000, // Convert km to meters
        calories: Math.round(weeklyDistance * 30), // Rough estimate for cycling
        source: 'manual',
        syncedAt: new Date().toISOString(),
        sourceApp: 'RUNSTR',
        unitSystem: 'metric',
        canSyncToNostr: true,
        metadata: {
          title: `Week ${weekNumber} Cycling`,
          sourceApp: 'RUNSTR',
          notes: `Weekly cycling: ${weeklyDistance.toFixed(2)}km / ${distanceGoal}km goal (${distanceProgress?.percentage || 0}%)`,
          weeklyGoal: distanceGoal,
          weeklyProgress: distanceProgress?.percentage || 0,
        },
      };

      // Open social share modal
      setPreparedWorkout(publishableWorkout);
      setShowSocialModal(true);
      setDistancePostingState('idle');

      console.log(
        `[CyclingTrackerScreen] ✅ Opening social share modal for weekly distance`
      );
    } catch (error) {
      console.error(
        '[CyclingTrackerScreen] ❌ Failed to post weekly distance:',
        error
      );
      setDistancePostingState('idle');

      setAlertConfig({
        title: 'Failed to Post',
        message: 'Could not share weekly distance. Please try again.',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
    }
  };

  // Handle setting distance goal
  const handleSetGoal = () => {
    console.log('[CyclingTrackerScreen] Opening goal selection modal...');
    setGoalPickerVisible(true);
  };

  // Handle goal selected from picker
  const handleGoalSelected = async (newGoal: number) => {
    try {
      await weeklyDistanceGoalService.setGoal('cycling', newGoal);
      setDistanceGoal(newGoal);

      // Recalculate progress
      if (weeklyDistance !== null) {
        const progress = weeklyDistanceGoalService.calculateProgress(
          weeklyDistance,
          newGoal
        );
        setDistanceProgress(progress);
      }

      console.log(`[CyclingTrackerScreen] ✅ Goal updated to ${newGoal}km`);
    } catch (error) {
      console.error('[CyclingTrackerScreen] ❌ Failed to update goal:', error);
    }
  };

  useEffect(() => {
    if (isTracking && !isPaused) {
      updateMetrics();
    }
  }, [elapsedTime]);

  // Secondary metrics for active tracking
  const secondaryMetrics: SecondaryMetric[] = [
    {
      value: metrics.distance,
      label: 'Distance',
      icon: 'navigate-outline',
    },
    {
      value: metrics.duration,
      label: 'Duration',
      icon: 'time-outline',
    },
    {
      value: metrics.elevation,
      label: 'Elevation',
      icon: 'trending-up-outline',
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

          {/* Speed Gauge - Hero element for cycling */}
          <View style={styles.gaugeSection}>
            <SpeedGauge
              currentSpeed={currentSpeed}
              maxSpeed={maxSpeed}
              avgSpeed={avgSpeed}
              unit="km/h"
            />
          </View>

          {/* Distance & Duration as hero below gauge */}
          <View style={styles.heroMetricSection}>
            <HeroMetric
              primaryValue={metrics.distance.replace(' km', '')}
              primaryUnit="km"
              secondaryValue={metrics.duration}
            />
          </View>

          {/* Secondary Metrics Row */}
          <SecondaryMetricRow metrics={secondaryMetrics} />

          {/* Spacer to push controls to bottom */}
          <View style={{ flex: 1 }} />

          {/* Control Bar - Fixed at bottom */}
          <ControlBar
            state={controlBarState}
            startLabel="Start Ride"
            onHoldComplete={handleHoldComplete}
            onPause={pauseTracking}
            onResume={resumeTracking}
            onStop={stopTracking}
          />
        </View>
      ) : (
        /* ============ IDLE STATE ============ */
        <View style={styles.idleContainer}>
          {/* Weekly Distance Goal Card */}
          <WeeklyDistanceGoalCard
            activityType="cycling"
            distance={weeklyDistance}
            progress={distanceProgress}
            loading={distanceLoading}
            onPost={handlePostWeeklyDistance}
            onSetGoal={handleSetGoal}
            postingState={distancePostingState}
          />

          {/* Last Activity & Weekly Stats */}
          <LastActivityCard activityType="cycling" />

          {/* Route Selection */}
          <TouchableOpacity
            style={styles.routeSelector}
            onPress={() => setRouteSelectionVisible(true)}
          >
            <View style={styles.routeSelectorLeft}>
              <Ionicons
                name={selectedRoute ? 'map' : 'map-outline'}
                size={20}
                color={selectedRoute ? theme.colors.accent : theme.colors.textMuted}
              />
              <Text style={[
                styles.routeSelectorText,
                selectedRoute && { color: theme.colors.accent }
              ]}>
                {selectedRoute ? selectedRoute.name : 'Routes'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>

          {/* Spacer to push controls to bottom */}
          <View style={{ flex: 1 }} />

          {/* Control Bar - Fixed at bottom */}
          <ControlBar
            state={controlBarState}
            startLabel="Start Ride"
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
        activityType="cycling"
        onSelectRoute={(routeId, routeName) => {
          setSelectedRoute({ id: routeId, name: routeName });
          setRouteSelectionVisible(false);
        }}
        onClose={() => setRouteSelectionVisible(false)}
      />

      {/* Permission Request Modal - Only mount when needed to prevent auto-start bug */}
      {showPermissionModal && (
        <PermissionRequestModal
          visible={true}
          onComplete={() => {
            setShowPermissionModal(false);
            // Permissions granted - proceed directly with tracking (no re-check)
            proceedWithTracking();
          }}
        />
      )}

      {/* Distance Goal Picker Modal */}
      <DistanceGoalPickerModal
        visible={goalPickerVisible}
        activityType="cycling"
        currentGoal={distanceGoal}
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
          setDistancePostingState('posted');
          console.log(
            '[CyclingTrackerScreen] ✅ Weekly distance posted successfully'
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
  // Activity header in idle state
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  activityTitle: {
    fontSize: 24,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
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
  // Speed gauge section
  gaugeSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  // Hero metric section below gauge
  heroMetricSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  // Route selector in idle state
  routeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  routeSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeSelectorText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },
});
