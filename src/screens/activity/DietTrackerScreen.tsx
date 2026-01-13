/**
 * DietTrackerScreen - Meal logger and fasting tracker
 * Logs meals with timestamps and calculates fasting duration from last meal
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../styles/theme';
import LocalWorkoutStorageService from '../../services/fitness/LocalWorkoutStorageService';
import { EnhancedSocialShareModal } from '../../components/profile/shared/EnhancedSocialShareModal';
import { WorkoutPublishingService } from '../../services/nostr/workoutPublishingService';
import { UnifiedSigningService } from '../../services/auth/UnifiedSigningService';
import { CustomAlert } from '../../components/ui/CustomAlert';
import CalorieEstimationService, {
  type MealSize,
} from '../../services/fitness/CalorieEstimationService';
import { nostrProfileService } from '../../services/nostr/NostrProfileService';
import { RewardNotificationManager } from '../../services/rewards/RewardNotificationManager';
import type { NDKSigner } from '@nostr-dev-kit/ndk';
import type { Workout } from '../../types/workout';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_TYPES: {
  value: MealType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'breakfast', label: 'Breakfast', icon: 'sunny' },
  { value: 'lunch', label: 'Lunch', icon: 'partly-sunny' },
  { value: 'dinner', label: 'Dinner', icon: 'moon' },
  { value: 'snack', label: 'Snack', icon: 'nutrition' },
];

const ACTIVE_FAST_START_KEY = '@runstr:active_fast_start';
const IS_FASTING_KEY = '@runstr:is_fasting';

interface DietTrackerScreenProps {
  initialMealType?: MealType;
  startFasting?: boolean;
}

export const DietTrackerScreen: React.FC<DietTrackerScreenProps> = ({
  initialMealType,
  startFasting: shouldStartFasting,
}) => {
  const [selectedMealType, setSelectedMealType] =
    useState<MealType>(initialMealType || 'breakfast');
  const [selectedMealSize, setSelectedMealSize] = useState<MealSize>('medium');
  const [mealNotes, setMealNotes] = useState('');
  const [mealTime, setMealTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Intentional fasting state
  const [isFasting, setIsFasting] = useState<boolean>(false);
  const [fastStartTime, setFastStartTime] = useState<Date | null>(null);
  const [fastingDuration, setFastingDuration] = useState<number>(0); // seconds

  // Summary modal state
  const [showSummary, setShowSummary] = useState(false);
  const [summaryType, setSummaryType] = useState<'meal' | 'fast'>('meal');
  const [savedWorkout, setSavedWorkout] = useState<Workout | null>(null);

  // Posting state
  const [showShareModal, setShowShareModal] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [signer, setSigner] = useState<NDKSigner | null>(null);
  const [isCompeting, setIsCompeting] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | undefined>(undefined);
  const [userName, setUserName] = useState<string | undefined>(undefined);

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message?: string;
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

  // Load fasting state, userId, and signer on mount
  useEffect(() => {
    const initializeData = async () => {
      try {
        await loadFastingState();

        const npub = await AsyncStorage.getItem('@runstr:npub');
        if (npub) {
          setUserId(npub);

          // Load user's Nostr profile (avatar and name)
          const nostrProfile = await nostrProfileService.getProfile(npub);
          if (nostrProfile) {
            setUserAvatar(nostrProfile.picture);
            setUserName(nostrProfile.display_name || nostrProfile.name);
            console.log(
              '[DietTracker] ✅ User profile loaded for social cards'
            );
          }
        }

        const userSigner =
          await UnifiedSigningService.getInstance().getSigner();
        if (userSigner) setSigner(userSigner);
      } catch (error) {
        console.warn('[DietTracker] Failed to initialize:', error);
      }
    };
    initializeData();
  }, []);

  // Handle initial meal type change from parent
  useEffect(() => {
    if (initialMealType) {
      setSelectedMealType(initialMealType);
    }
  }, [initialMealType]);

  // Note: Removed auto-start behavior - user must click "Start Fasting" button
  // shouldStartFasting prop now only indicates fasting UI mode should be shown

  // Calculate fasting duration in real-time (only when actively fasting)
  useEffect(() => {
    if (!isFasting || !fastStartTime) return;

    const interval = setInterval(() => {
      const duration = Math.floor(
        (Date.now() - fastStartTime.getTime()) / 1000
      );
      setFastingDuration(Math.max(0, duration));
    }, 1000);

    return () => clearInterval(interval);
  }, [isFasting, fastStartTime]);

  const loadFastingState = async () => {
    try {
      const [fastingFlag, startTimeStr] = await Promise.all([
        AsyncStorage.getItem(IS_FASTING_KEY),
        AsyncStorage.getItem(ACTIVE_FAST_START_KEY),
      ]);

      if (fastingFlag === 'true' && startTimeStr) {
        const startTime = new Date(parseInt(startTimeStr));
        const currentDuration = Math.floor((Date.now() - startTime.getTime()) / 1000);
        setIsFasting(true);
        setFastStartTime(startTime);
        setFastingDuration(Math.max(0, currentDuration)); // Set immediately to avoid 0 flash
        console.log('[DietTracker] ✅ Restored active fast from storage');
      }
    } catch (error) {
      console.error('[DietTracker] Failed to load fasting state:', error);
    }
  };

  const startFastingMode = async () => {
    try {
      const startTime = new Date();
      await Promise.all([
        AsyncStorage.setItem(IS_FASTING_KEY, 'true'),
        AsyncStorage.setItem(
          ACTIVE_FAST_START_KEY,
          startTime.getTime().toString()
        ),
      ]);
      setIsFasting(true);
      setFastStartTime(startTime);
      setFastingDuration(0);
      console.log('[DietTracker] ✅ Started fasting mode');
    } catch (error) {
      console.error('[DietTracker] Failed to start fasting:', error);
      setAlertConfig({
        title: 'Error',
        message: 'Failed to start fasting. Please try again.',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
    }
  };

  const stopFastingMode = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(IS_FASTING_KEY),
        AsyncStorage.removeItem(ACTIVE_FAST_START_KEY),
      ]);
      setIsFasting(false);
      setFastStartTime(null);
      setFastingDuration(0);
      console.log('[DietTracker] ✅ Stopped fasting mode');
    } catch (error) {
      console.error('[DietTracker] Failed to stop fasting:', error);
    }
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setMealTime(selectedDate);
    }
  };

  const saveMeal = async () => {
    try {
      const mealTypeLabel =
        MEAL_TYPES.find((m) => m.value === selectedMealType)?.label || 'Meal';
      const timeString = mealTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

      // Estimate calories using CalorieEstimationService
      const estimatedCalories = CalorieEstimationService.estimateMealCalories(
        selectedMealSize,
        selectedMealType
      );

      const workoutId = await LocalWorkoutStorageService.saveManualWorkout({
        type: 'diet', // Proper type for diet/meal workouts
        duration: 0, // Meals don't have duration
        notes: mealNotes || `${mealTypeLabel} at ${timeString}`,
        mealType: selectedMealType,
        mealTime: mealTime.toISOString(),
        mealSize: selectedMealSize,
        calories: estimatedCalories,
      });

      console.log(`✅ Meal logged: ${selectedMealType} at ${timeString}`);

      // Retrieve saved workout for summary modal
      const allWorkouts = await LocalWorkoutStorageService.getAllWorkouts();
      const workout = allWorkouts.find((w) => w.id === workoutId);

      if (workout) {
        setSavedWorkout(workout as any);
        setSummaryType('meal');
        setShowSummary(true);
      }

      // Reset form
      setMealNotes('');
      setMealTime(new Date());
    } catch (error) {
      console.error('❌ Failed to save meal:', error);
      setAlertConfig({
        title: 'Error',
        message: 'Failed to save meal. Please try again.',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
    }
  };

  const breakFastAndLogMeal = async () => {
    if (!isFasting || !fastStartTime) {
      console.warn('[DietTracker] Not currently fasting, cannot break fast');
      return;
    }

    try {
      const hours = Math.floor(fastingDuration / 3600);
      const minutes = Math.floor((fastingDuration % 3600) / 60);

      // First, save the fasting period
      const fastWorkoutId = await LocalWorkoutStorageService.saveManualWorkout({
        type: 'fasting',
        duration: fastingDuration,
        notes: `Completed ${hours}h ${minutes}m fast`,
        fastingDuration,
      });

      console.log(`✅ Fast logged: ${formatDuration(fastingDuration)}`);

      // Then, save the meal that breaks the fast
      const mealTypeLabel =
        MEAL_TYPES.find((m) => m.value === selectedMealType)?.label || 'Meal';
      const timeString = mealTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const estimatedCalories = CalorieEstimationService.estimateMealCalories(
        selectedMealSize,
        selectedMealType
      );

      await LocalWorkoutStorageService.saveManualWorkout({
        type: 'diet',
        duration: 0,
        notes: mealNotes || `${mealTypeLabel} at ${timeString} (broke fast)`,
        mealType: selectedMealType,
        mealTime: mealTime.toISOString(),
        mealSize: selectedMealSize,
        calories: estimatedCalories,
      });

      console.log(`✅ Meal logged: ${selectedMealType} at ${timeString}`);

      // Stop fasting mode
      await stopFastingMode();

      // Retrieve the fast workout for summary modal
      const allWorkouts = await LocalWorkoutStorageService.getAllWorkouts();
      const fastWorkout = allWorkouts.find((w) => w.id === fastWorkoutId);

      if (fastWorkout) {
        setSavedWorkout(fastWorkout as any);
        setSummaryType('fast');
        setShowSummary(true);
      }

      // Reset form
      setMealNotes('');
      setMealTime(new Date());
    } catch (error) {
      console.error('❌ Failed to break fast and log meal:', error);
      setAlertConfig({
        title: 'Error',
        message: 'Failed to break fast. Please try again.',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
    }
  };

  const handlePost = async () => {
    console.log('🔍 [DietTracker] handlePost() CALLED - Entry point reached');
    console.log('🔍 [DietTracker] savedWorkout exists:', !!savedWorkout);

    try {
      // If savedWorkout not in state, try retrieving from storage (like MeditationTracker)
      if (!savedWorkout) {
        console.log(
          '[DietTracker] Workout not in state, retrieving from storage...'
        );
        const allWorkouts = await LocalWorkoutStorageService.getAllWorkouts();
        const latestWorkout = allWorkouts[0]; // Most recent workout

        if (latestWorkout) {
          console.log(
            '[DietTracker] Retrieved latest workout from storage:',
            latestWorkout.id
          );
          setSavedWorkout(latestWorkout as any);
          console.log(
            '🔍 [DietTracker] About to set showShareModal = true (from storage)'
          );
          setShowShareModal(true);
        } else {
          throw new Error('No workout found to share');
        }
      } else {
        console.log('[DietTracker] Using savedWorkout from state');
        console.log(
          '🔍 [DietTracker] About to set showShareModal = true (from state)'
        );
        setShowShareModal(true);
      }
    } catch (error) {
      console.error('❌ Failed to prepare workout for sharing:', error);
      setAlertConfig({
        title: 'Error',
        message:
          'No workout data available. Please try logging your meal/fast again.',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
    }
  };

  const handleCompete = async () => {
    try {
      console.log('🔍 [DietTracker] handleCompete() started');

      if (!savedWorkout) {
        console.log('❌ [DietTracker] No savedWorkout found');
        return;
      }
      console.log('✅ [DietTracker] savedWorkout exists:', {
        id: savedWorkout.id,
        type: savedWorkout.type,
        calories: savedWorkout.calories,
        hasNotes: !!savedWorkout.notes,
      });

      if (!signer || !userId) {
        console.log(
          '❌ [DietTracker] Authentication missing - signer:',
          !!signer,
          'userId:',
          !!userId
        );
        setAlertConfig({
          title: 'Authentication Required',
          message: 'Please log in to post workouts.',
          buttons: [{ text: 'OK', style: 'default' }],
        });
        setAlertVisible(true);
        return;
      }
      console.log('✅ [DietTracker] Authentication OK - userId:', userId);

      setIsCompeting(true);
      console.log('🔄 [DietTracker] Starting kind 1301 publishing...');

      // Publish as kind 1301 (competition data)
      const publishingService = WorkoutPublishingService.getInstance();
      console.log('📤 [DietTracker] Calling saveWorkoutToNostr...');
      const result = await publishingService.saveWorkoutToNostr(
        savedWorkout,
        signer,
        userId
      );
      console.log('📥 [DietTracker] Publishing result:', result);

      if (result.success && result.eventId) {
        console.log(
          '✅ [DietTracker] Publishing successful! Event ID:',
          result.eventId
        );

        // Mark as synced in local storage
        console.log(
          '💾 [DietTracker] Marking workout as synced in local storage...'
        );
        await LocalWorkoutStorageService.markAsSynced(
          savedWorkout.id,
          result.eventId
        );
        console.log('✅ [DietTracker] Marked as synced');

        // Close summary modal FIRST to prevent alert appearing behind it
        setShowSummary(false);

        // Show alert after modal closes
        setTimeout(() => {
          setAlertConfig({
            title: 'Success!',
            message: `Your ${
              summaryType === 'meal' ? 'meal' : 'fast'
            } has been saved!`,
            buttons: [{ text: 'OK', style: 'default', onPress: handleDone }],
          });
          setAlertVisible(true);
        }, 300);
      } else {
        console.error('❌ [DietTracker] Publishing failed:', result.error);
        throw new Error(result.error || 'Failed to save workout');
      }
    } catch (error) {
      console.error('❌ [DietTracker] handleCompete error:', error);
      console.error('❌ [DietTracker] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Close summary modal FIRST to prevent alert appearing behind it
      setShowSummary(false);

      // Show error alert after modal closes
      setTimeout(() => {
        setAlertConfig({
          title: 'Error',
          message: 'Failed to publish. Please try again.',
          buttons: [{ text: 'OK', style: 'default' }],
        });
        setAlertVisible(true);
      }, 300);
    } finally {
      setIsCompeting(false);
      console.log('🏁 [DietTracker] handleCompete() finished');
    }
  };

  const handleDone = () => {
    setShowSummary(false);
    setShowShareModal(false);
    setSavedWorkout(null);

    // Show pending reward toast now that modal is closing
    RewardNotificationManager.showPendingRewardToast();
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  /**
   * Get fasting milestone badge for current duration
   * Returns milestone info if user has reached a notable fasting duration
   */
  const getFastingMilestone = (
    seconds: number
  ): {
    hours: number;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  } | null => {
    const hours = seconds / 3600;

    // Fasting milestones (ordered from highest to lowest for correct detection)
    const milestones = [
      { hours: 72, label: '72h Extended Fast', icon: 'trophy' as const },
      { hours: 48, label: '48h Extended Fast', icon: 'medal' as const },
      { hours: 36, label: '36h Monk Fast', icon: 'ribbon' as const },
      { hours: 24, label: '24h OMAD', icon: 'star' as const },
      { hours: 20, label: '20h Warrior', icon: 'flash' as const },
      { hours: 18, label: '18h Extended', icon: 'trending-up' as const },
      {
        hours: 16,
        label: '16h Intermittent',
        icon: 'checkmark-circle' as const,
      },
      { hours: 12, label: '12h Circadian', icon: 'moon' as const },
    ];

    // Find the highest milestone reached
    for (const milestone of milestones) {
      if (hours >= milestone.hours) {
        return milestone;
      }
    }

    return null;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Dynamic icon and title based on mode */}
      <View style={styles.iconContainer}>
        <Ionicons
          name={shouldStartFasting || isFasting ? 'timer-outline' : (MEAL_TYPES.find(m => m.value === selectedMealType)?.icon || 'restaurant')}
          size={64}
          color={theme.colors.text}
        />
      </View>

      <Text style={styles.title}>
        {shouldStartFasting || isFasting
          ? 'Fasting'
          : initialMealType
            ? MEAL_TYPES.find(m => m.value === initialMealType)?.label || 'Diet Tracker'
            : 'Diet Tracker'}
      </Text>
      <Text style={styles.subtitle}>
        {isFasting
          ? 'Currently Fasting'
          : shouldStartFasting
            ? 'Ready to begin your fast'
            : initialMealType
              ? 'Log your meal'
              : 'Log your meals and track fasting'}
      </Text>

      {/* Active Fasting Display */}
      {isFasting && fastStartTime && (
        <View style={styles.fastingCard}>
          <View style={styles.fastingHeader}>
            <Ionicons name="time" size={24} color={theme.colors.orangeBright} />
            <Text style={styles.fastingTitle}>Fasting in Progress</Text>
          </View>
          <Text style={styles.fastingDuration}>
            {formatDuration(fastingDuration)}
          </Text>

          {/* Fasting Milestone Badge */}
          {(() => {
            const milestone = getFastingMilestone(fastingDuration);
            if (milestone) {
              return (
                <View style={styles.milestoneBadge}>
                  <Ionicons
                    name={milestone.icon}
                    size={18}
                    color={theme.colors.orangeBright}
                  />
                  <Text style={styles.milestoneText}>{milestone.label}</Text>
                </View>
              );
            }
            return null;
          })()}

          <Text style={styles.fastingSubtitle}>
            Started:{' '}
            {fastStartTime.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      )}

      {/* Pre-Fasting Display - show when user selected Fast but hasn't started yet */}
      {shouldStartFasting && !isFasting && (
        <View style={styles.fastingCard}>
          <View style={styles.fastingHeader}>
            <Ionicons name="timer-outline" size={24} color={theme.colors.textMuted} />
            <Text style={styles.fastingTitle}>Ready to Fast</Text>
          </View>
          <Text style={styles.fastingDuration}>00:00:00</Text>
          <Text style={styles.fastingSubtitle}>
            Tap the button below to begin tracking your fast
          </Text>
          <TouchableOpacity
            style={[styles.startFastingButton, { marginTop: 16 }]}
            onPress={startFastingMode}
          >
            <Ionicons
              name="play"
              size={20}
              color={theme.colors.background}
            />
            <Text style={styles.startFastingButtonText}>Start Fasting</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Meal Type Selector - only show if not pre-selected from menu and not in fasting mode */}
      {!initialMealType && !shouldStartFasting && !isFasting && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Meal Type</Text>
          <View style={styles.mealTypeGrid}>
            {MEAL_TYPES.map((mealType) => (
              <TouchableOpacity
                key={mealType.value}
                style={[
                  styles.mealTypeOption,
                  selectedMealType === mealType.value &&
                    styles.mealTypeOptionActive,
                ]}
                onPress={() => setSelectedMealType(mealType.value)}
              >
                <Ionicons
                  name={mealType.icon}
                  size={24}
                  color={
                    selectedMealType === mealType.value
                      ? theme.colors.text
                      : theme.colors.textMuted
                  }
                />
                <Text
                  style={[
                    styles.mealTypeLabel,
                    selectedMealType === mealType.value &&
                      styles.mealTypeLabelActive,
                  ]}
                >
                  {mealType.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Meal Size Selector - hide when in fasting mode */}
      {!isFasting && !shouldStartFasting && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Meal Size (Optional)</Text>
          <View style={styles.mealSizeGrid}>
            {(['small', 'medium', 'large', 'xl'] as MealSize[]).map((size) => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.mealSizeOption,
                  selectedMealSize === size && styles.mealSizeOptionActive,
                ]}
                onPress={() => setSelectedMealSize(size)}
              >
                <Text
                  style={[
                    styles.mealSizeLabel,
                    selectedMealSize === size && styles.mealSizeLabelActive,
                  ]}
                >
                  {size.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Time Selector - hide when in fasting mode */}
      {!isFasting && !shouldStartFasting && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Time</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Ionicons name="time-outline" size={20} color={theme.colors.text} />
            <Text style={styles.timeButtonText}>
              {mealTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </TouchableOpacity>

          {showTimePicker && (
            <DateTimePicker
              value={mealTime}
              mode="time"
              is24Hour={false}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
              accentColor={theme.colors.orangeBright}
              themeVariant="dark"
            />
          )}
        </View>
      )}

      {/* Meal Notes - hide when in fasting mode */}
      {!isFasting && !shouldStartFasting && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>What did you eat? (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="E.g., Oatmeal with berries"
            placeholderTextColor={theme.colors.textMuted}
            value={mealNotes}
            onChangeText={setMealNotes}
            multiline
            numberOfLines={3}
          />
        </View>
      )}

      {/* Action Buttons - hide when in pre-fasting mode (button is in the card above) */}
      {!shouldStartFasting && (
        <View style={styles.buttonGroup}>
          {!isFasting ? (
            <>
              <TouchableOpacity style={styles.saveMealButton} onPress={saveMeal}>
                <Ionicons
                  name="restaurant"
                  size={20}
                  color={theme.colors.background}
                />
                <Text style={styles.saveMealButtonText}>Log Meal</Text>
              </TouchableOpacity>

              {/* Only show fasting button if no meal type was pre-selected */}
              {!initialMealType && (
                <TouchableOpacity
                  style={styles.startFastingButton}
                  onPress={startFastingMode}
                >
                  <Ionicons
                    name="timer-outline"
                    size={20}
                    color={theme.colors.background}
                  />
                  <Text style={styles.startFastingButtonText}>Start Fasting</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity
              style={styles.breakFastButton}
              onPress={breakFastAndLogMeal}
            >
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.colors.background}
              />
              <Text style={styles.breakFastButtonText}>
                Break Fast + Log Meal
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* End Fast button when actively fasting (shown even when shouldStartFasting) */}
      {isFasting && shouldStartFasting && (
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.breakFastButton}
            onPress={breakFastAndLogMeal}
          >
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={theme.colors.background}
            />
            <Text style={styles.breakFastButtonText}>
              End Fast
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Hint box - hide in fasting mode */}
      {!shouldStartFasting && (
        <View style={styles.hintBox}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={theme.colors.textMuted}
          />
          <Text style={styles.hintText}>
            {isFasting
              ? 'Click "Break Fast + Log Meal" to end your fast and record what you eat.'
              : initialMealType
                ? `Tap "Log Meal" to save your ${selectedMealType}.`
                : '"Log Meal" saves your food. "Start Fasting" begins tracking a fasting period.'}
          </Text>
        </View>
      )}

      {/* Summary Modal */}
      <Modal visible={showSummary} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>
              {summaryType === 'meal' ? 'Meal Logged' : 'Fast Completed'}
            </Text>

            <View style={styles.summaryStats}>
              <Ionicons
                name={summaryType === 'meal' ? 'restaurant' : 'timer'}
                size={48}
                color={theme.colors.text}
              />
              {summaryType === 'meal' && savedWorkout && (
                <>
                  <Text style={styles.summaryType}>
                    {
                      MEAL_TYPES.find(
                        (m) => m.value === (savedWorkout as any).mealType
                      )?.label
                    }
                  </Text>
                  <Text style={styles.summaryTime}>
                    {new Date(
                      (savedWorkout as any).mealTime
                    ).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </>
              )}
              {summaryType === 'fast' && savedWorkout && (
                <>
                  <Text style={styles.summaryFastDuration}>
                    {formatDuration(savedWorkout.duration)}
                  </Text>
                  <Text style={styles.summaryType}>Fasting Period</Text>
                </>
              )}
            </View>

            {savedWorkout?.notes && (
              <View style={styles.notesDisplay}>
                <Text style={styles.notesDisplayLabel}>Notes:</Text>
                <Text style={styles.notesDisplayText}>
                  {savedWorkout.notes}
                </Text>
              </View>
            )}

            <View style={styles.summaryButtons}>
              <TouchableOpacity style={styles.postButton} onPress={handlePost}>
                <Ionicons
                  name="chatbubble-outline"
                  size={20}
                  color={theme.colors.background}
                  style={styles.buttonIcon}
                />
                <Text style={styles.postButtonText}>Post</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.competeButton}
                onPress={handleCompete}
                disabled={isCompeting}
              >
                {isCompeting ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.background}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="cloud-upload-outline"
                      size={20}
                      color={theme.colors.background}
                      style={styles.buttonIcon}
                    />
                    <Text style={styles.competeButtonText}>Compete</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Social Share Modal - Rendered INSIDE summary Modal for proper z-index */}
        {savedWorkout && (
          <EnhancedSocialShareModal
            visible={showShareModal}
            workout={savedWorkout}
            userId={userId}
            userAvatar={userAvatar}
            userName={userName}
            onClose={() => setShowShareModal(false)}
            onSuccess={() => {
              setAlertConfig({
                title: 'Success!',
                message: `Your ${
                  summaryType === 'meal' ? 'meal' : 'fast'
                } has been shared with a beautiful card!`,
                buttons: [
                  { text: 'OK', style: 'default', onPress: handleDone },
                ],
              });
              setAlertVisible(true);
            }}
          />
        )}
      </Modal>

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    flexGrow: 1,
    padding: 20,
  },
  iconContainer: {
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
  },
  fastingCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 2,
    borderColor: theme.colors.orangeDeep,
  },
  fastingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  fastingTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fastingDuration: {
    fontSize: 36,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.orangeBright,
    marginBottom: 12,
  },
  milestoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 157, 66, 0.15)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 66, 0.4)',
    gap: 6,
  },
  milestoneText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.orangeBright,
  },
  fastingSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 12,
  },
  mealTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mealTypeOption: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  mealTypeOptionActive: {
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.border,
  },
  mealTypeLabel: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    marginLeft: 8,
  },
  mealTypeLabelActive: {
    color: theme.colors.text,
    fontWeight: theme.typography.weights.semiBold,
  },
  mealSizeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  mealSizeOption: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealSizeOptionActive: {
    borderColor: theme.colors.orangeBright,
    backgroundColor: 'rgba(255, 157, 66, 0.1)',
  },
  mealSizeLabel: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },
  mealSizeLabelActive: {
    color: theme.colors.orangeBright,
    fontWeight: theme.typography.weights.bold,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  timeButtonText: {
    fontSize: 18,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  notesInput: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 12,
    color: theme.colors.text,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonGroup: {
    gap: 12,
    marginBottom: 20,
  },
  saveMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  saveMealButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  startFastingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  startFastingButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  breakFastButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  breakFastButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  hintBox: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  hintText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    padding: 20,
  },
  summaryContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  summaryStats: {
    alignItems: 'center',
    marginBottom: 24,
  },
  summaryType: {
    fontSize: 16,
    color: theme.colors.textMuted,
    marginTop: 12,
  },
  summaryTime: {
    fontSize: 32,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginTop: 8,
  },
  summaryFastDuration: {
    fontSize: 48,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.orangeBright,
    marginTop: 16,
  },
  notesDisplay: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  notesDisplayLabel: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  notesDisplayText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  summaryButtons: {
    gap: 12,
  },
  buttonIcon: {
    marginRight: 8,
  },
  postButton: {
    flexDirection: 'row',
    backgroundColor: theme.colors.text,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  competeButton: {
    flexDirection: 'row',
    backgroundColor: theme.colors.text,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  competeButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  doneButton: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  doneButtonText: {
    color: theme.colors.textMuted,
    fontSize: 16,
    fontWeight: theme.typography.weights.medium,
  },
});
