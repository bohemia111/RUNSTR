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
import CalorieEstimationService, { type MealSize } from '../../services/fitness/CalorieEstimationService';
import { nostrProfileService } from '../../services/nostr/NostrProfileService';
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

const LAST_MEAL_KEY = '@runstr:last_meal_timestamp';

export const DietTrackerScreen: React.FC = () => {
  const [selectedMealType, setSelectedMealType] =
    useState<MealType>('breakfast');
  const [selectedMealSize, setSelectedMealSize] = useState<MealSize>('medium');
  const [mealNotes, setMealNotes] = useState('');
  const [mealTime, setMealTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [lastMealTime, setLastMealTime] = useState<Date | null>(null);
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

  // Load last meal time, userId, and signer on mount
  useEffect(() => {
    const initializeData = async () => {
      try {
        await loadLastMealTime();

        const npub = await AsyncStorage.getItem('@runstr:npub');
        if (npub) {
          setUserId(npub);

          // Load user's Nostr profile (avatar and name)
          const nostrProfile = await nostrProfileService.getProfile(npub);
          if (nostrProfile) {
            setUserAvatar(nostrProfile.picture);
            setUserName(nostrProfile.display_name || nostrProfile.name);
            console.log('[DietTracker] ✅ User profile loaded for social cards');
          }
        }

        const userSigner = await UnifiedSigningService.getInstance().getSigner();
        if (userSigner) setSigner(userSigner);
      } catch (error) {
        console.warn('[DietTracker] Failed to initialize:', error);
      }
    };
    initializeData();
  }, []);

  // Calculate fasting duration in real-time
  useEffect(() => {
    if (!lastMealTime) return;

    const interval = setInterval(() => {
      const duration = Math.floor(
        (mealTime.getTime() - lastMealTime.getTime()) / 1000
      );
      setFastingDuration(Math.max(0, duration));
    }, 1000);

    return () => clearInterval(interval);
  }, [lastMealTime, mealTime]);

  const loadLastMealTime = async () => {
    try {
      const timestamp = await AsyncStorage.getItem(LAST_MEAL_KEY);
      if (timestamp) {
        setLastMealTime(new Date(parseInt(timestamp)));
      }
    } catch (error) {
      console.error('Failed to load last meal time:', error);
    }
  };

  const saveLastMealTime = async (time: Date) => {
    try {
      await AsyncStorage.setItem(LAST_MEAL_KEY, time.getTime().toString());
      setLastMealTime(time);
    } catch (error) {
      console.error('Failed to save last meal time:', error);
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

      // Update last meal time
      await saveLastMealTime(mealTime);

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

  const saveFast = async () => {
    if (!lastMealTime) {
      console.warn('No last meal recorded, cannot save fast');
      setAlertConfig({
        title: 'No Last Meal',
        message: 'You need to log a meal first before recording a fast.',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
      return;
    }

    try {
      const hours = Math.floor(fastingDuration / 3600);
      const minutes = Math.floor((fastingDuration % 3600) / 60);

      const workoutId = await LocalWorkoutStorageService.saveManualWorkout({
        type: 'fasting', // Proper type for fasting workouts
        duration: fastingDuration, // Store in seconds (consistent with other workouts)
        notes: mealNotes || `Completed ${hours}h ${minutes}m fast`,
        fastingDuration,
      });

      console.log(`✅ Fast logged: ${formatDuration(fastingDuration)}`);

      // Update last meal time to now (breaking the fast)
      await saveLastMealTime(mealTime);

      // Retrieve saved workout for summary modal
      const allWorkouts = await LocalWorkoutStorageService.getAllWorkouts();
      const workout = allWorkouts.find((w) => w.id === workoutId);

      if (workout) {
        setSavedWorkout(workout as any);
        setSummaryType('fast');
        setShowSummary(true);
      }

      // Reset form
      setMealNotes('');
      setMealTime(new Date());
    } catch (error) {
      console.error('❌ Failed to save fast:', error);
      setAlertConfig({
        title: 'Error',
        message: 'Failed to save fast. Please try again.',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
    }
  };

  const handlePost = async () => {
    try {
      if (!savedWorkout) return;
      setShowShareModal(true);
    } catch (error) {
      console.error('❌ Failed to prepare workout for sharing:', error);
      setAlertConfig({
        title: 'Error',
        message: 'Failed to prepare workout. Please try again.',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
    }
  };

  const handleCompete = async () => {
    try {
      if (!savedWorkout) return;

      if (!signer || !userId) {
        setAlertConfig({
          title: 'Authentication Required',
          message: 'Please log in with your Nostr key to post workouts.',
          buttons: [{ text: 'OK', style: 'default' }],
        });
        setAlertVisible(true);
        return;
      }

      setIsCompeting(true);

      // Publish as kind 1301 (competition data)
      const publishingService = WorkoutPublishingService.getInstance();
      const result = await publishingService.saveWorkoutToNostr(
        savedWorkout,
        signer,
        userId
      );

      if (result.success && result.eventId) {
        // Mark as synced in local storage
        await LocalWorkoutStorageService.markAsSynced(
          savedWorkout.id,
          result.eventId
        );

        setAlertConfig({
          title: 'Success!',
          message: `Your ${summaryType === 'meal' ? 'meal' : 'fast'} has been saved to Nostr!`,
          buttons: [{ text: 'OK', style: 'default', onPress: handleDone }],
        });
        setAlertVisible(true);
      } else {
        throw new Error(result.error || 'Failed to save to Nostr');
      }
    } catch (error) {
      console.error('❌ Failed to compete workout:', error);
      setAlertConfig({
        title: 'Error',
        message: 'Failed to enter competition. Please try again.',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
    } finally {
      setIsCompeting(false);
    }
  };

  const handleDone = () => {
    setShowSummary(false);
    setShowShareModal(false);
    setSavedWorkout(null);
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
  ): { hours: number; label: string; icon: keyof typeof Ionicons.glyphMap } | null => {
    const hours = seconds / 3600;

    // Fasting milestones (ordered from highest to lowest for correct detection)
    const milestones = [
      { hours: 72, label: '72h Extended Fast', icon: 'trophy' as const },
      { hours: 48, label: '48h Extended Fast', icon: 'medal' as const },
      { hours: 36, label: '36h Monk Fast', icon: 'ribbon' as const },
      { hours: 24, label: '24h OMAD', icon: 'star' as const },
      { hours: 20, label: '20h Warrior', icon: 'flash' as const },
      { hours: 18, label: '18h Extended', icon: 'trending-up' as const },
      { hours: 16, label: '16h Intermittent', icon: 'checkmark-circle' as const },
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
      <View style={styles.iconContainer}>
        <Ionicons name="restaurant" size={64} color={theme.colors.text} />
      </View>

      <Text style={styles.title}>Diet Tracker</Text>
      <Text style={styles.subtitle}>Log your meals and track fasting</Text>

      {/* Fasting Duration Display */}
      {lastMealTime && (
        <View style={styles.fastingCard}>
          <View style={styles.fastingHeader}>
            <Ionicons name="time" size={24} color={theme.colors.orangeBright} />
            <Text style={styles.fastingTitle}>Time Since Last Meal</Text>
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
            Last meal:{' '}
            {lastMealTime.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      )}

      {/* Meal Type Selector */}
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

      {/* Meal Size Selector */}
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

      {/* Time Selector */}
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

      {/* Meal Notes */}
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

      {/* Action Buttons */}
      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.saveMealButton} onPress={saveMeal}>
          <Ionicons
            name="restaurant"
            size={20}
            color={theme.colors.background}
          />
          <Text style={styles.saveMealButtonText}>Log Meal</Text>
        </TouchableOpacity>

        {lastMealTime && fastingDuration > 0 && (
          <TouchableOpacity style={styles.saveFastButton} onPress={saveFast}>
            <Ionicons name="timer" size={20} color={theme.colors.background} />
            <Text style={styles.saveFastButtonText}>Log as Fast</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.hintBox}>
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={theme.colors.textMuted}
        />
        <Text style={styles.hintText}>
          "Log Meal" records what you ate. "Log as Fast" records the time since
          your last meal.
        </Text>
      </View>

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
                    {MEAL_TYPES.find((m) => m.value === (savedWorkout as any).mealType)?.label}
                  </Text>
                  <Text style={styles.summaryTime}>
                    {new Date((savedWorkout as any).mealTime).toLocaleTimeString('en-US', {
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
                <Text style={styles.notesDisplayText}>{savedWorkout.notes}</Text>
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
                  <ActivityIndicator size="small" color={theme.colors.background} />
                ) : (
                  <>
                    <Ionicons
                      name="cloud-upload-outline"
                      size={20}
                      color={theme.colors.background}
                      style={styles.buttonIcon}
                    />
                    <Text style={styles.competeButtonText}>Enter Competition</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Social Share Modal */}
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
              message: `Your ${summaryType === 'meal' ? 'meal' : 'fast'} has been shared to Nostr with a beautiful card!`,
              buttons: [{ text: 'OK', style: 'default', onPress: handleDone }],
            });
            setAlertVisible(true);
          }}
        />
      )}

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
  saveFastButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.orangeBright,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  saveFastButtonText: {
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
    backgroundColor: theme.colors.accent,
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
