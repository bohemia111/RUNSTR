/**
 * StrengthTrackerScreen - Strength training tracker with set/rep counter and rest timer
 * Tracks exercises with configurable sets, reps, and rest periods
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../styles/theme';
import LocalWorkoutStorageService from '../../services/fitness/LocalWorkoutStorageService';
import { WorkoutPublishingService } from '../../services/nostr/workoutPublishingService';
import { UnifiedSigningService } from '../../services/auth/UnifiedSigningService';
import CalorieEstimationService from '../../services/fitness/CalorieEstimationService';
import { EnhancedSocialShareModal } from '../../components/profile/shared/EnhancedSocialShareModal';
import type { HealthProfile } from '../HealthProfileScreen';
import type { NDKSigner } from '@nostr-dev-kit/ndk';
import type { LocalWorkout } from '../../services/fitness/LocalWorkoutStorageService';
import type { Workout } from '../../types/workout';

type ExerciseType =
  | 'pushups'
  | 'pullups'
  | 'situps'
  | 'squats'
  | 'curls'
  | 'bench';
type WorkoutPhase = 'setup' | 'active' | 'rest' | 'summary';

const EXERCISE_OPTIONS: {
  value: ExerciseType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'pushups', label: 'Pushups', icon: 'fitness' },
  { value: 'pullups', label: 'Pullups', icon: 'barbell' },
  { value: 'situps', label: 'Situps', icon: 'body' },
  { value: 'squats', label: 'Squats', icon: 'walk' },
  { value: 'curls', label: 'Curls', icon: 'fitness' },
  { value: 'bench', label: 'Bench Press', icon: 'barbell' },
];

const REST_DURATIONS = [30, 60, 90, 120]; // seconds

export const StrengthTrackerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const publishingService = WorkoutPublishingService.getInstance();
  const [signer, setSigner] = useState<NDKSigner | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [userWeight, setUserWeight] = useState<number | undefined>(undefined);

  // Setup state
  const [selectedExercise, setSelectedExercise] =
    useState<ExerciseType>('pushups');
  const [totalSets, setTotalSets] = useState(3);
  const [targetReps, setTargetReps] = useState(20);
  const [restDuration, setRestDuration] = useState(60);
  const [exerciseWeight, setExerciseWeight] = useState(0); // Weight being lifted (e.g., for bench press)

  // Workout state
  const [phase, setPhase] = useState<WorkoutPhase>('setup');
  const [currentSet, setCurrentSet] = useState(1);
  const [repsCompleted, setRepsCompleted] = useState<number[]>([]);
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [workoutStartTime, setWorkoutStartTime] = useState(0);
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);
  const [savedWorkout, setSavedWorkout] = useState<Workout | null>(null);
  const [estimatedCalories, setEstimatedCalories] = useState<number>(0);

  // Modal state
  const [showRepsModal, setShowRepsModal] = useState(false);
  const [currentRepsInput, setCurrentRepsInput] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);

  // Timer refs
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load signer and health profile on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load signer
        const userSigner = await UnifiedSigningService.getInstance().getSigner();
        const userPubkey = await UnifiedSigningService.getHexPubkey();
        if (userSigner && userPubkey) {
          setSigner(userSigner);
          setUserId(userPubkey);
          console.log('[StrengthTracker] ✅ User signer loaded for posting');
        }

        // Load health profile for calorie estimation
        const profileData = await AsyncStorage.getItem('@runstr:health_profile');
        if (profileData) {
          const profile: HealthProfile = JSON.parse(profileData);
          if (profile.weight) {
            setUserWeight(profile.weight);
            console.log('[StrengthTracker] ✅ User weight loaded:', profile.weight);
          }
        }
      } catch (error) {
        console.warn('[StrengthTracker] Failed to load data:', error);
      }
    };
    loadData();

    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, []);

  // Rest timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (phase === 'rest' && restTimeRemaining > 0) {
      interval = setInterval(() => {
        setRestTimeRemaining((prev) => {
          if (prev <= 1) {
            setPhase('active');
            setCurrentSet((s) => s + 1);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phase, restTimeRemaining]);

  const startWorkout = () => {
    setPhase('active');
    setCurrentSet(1);
    setRepsCompleted([]);
    setWorkoutStartTime(Date.now());
  };

  const handleSetComplete = () => {
    setCurrentRepsInput(targetReps.toString());
    setShowRepsModal(true);
  };

  const confirmReps = async () => {
    const reps = parseInt(currentRepsInput) || 0;
    const newReps = [...repsCompleted, reps];
    setRepsCompleted(newReps);
    setShowRepsModal(false);
    setCurrentRepsInput('');

    // Check if workout is complete
    if (currentSet >= totalSets) {
      const duration = Math.floor((Date.now() - workoutStartTime) / 1000);
      setWorkoutDuration(duration);

      // AUTO-SAVE: Save workout to local storage immediately
      await saveWorkoutToLocal(newReps, duration);

      setPhase('summary');
    } else {
      // Start rest timer
      setRestTimeRemaining(restDuration);
      setPhase('rest');
    }
  };

  /**
   * Save workout to local storage
   * Returns the workout ID for later posting to Nostr
   */
  const saveWorkoutToLocal = async (
    completedReps: number[],
    duration: number
  ): Promise<string | null> => {
    try {
      const totalReps = completedReps.reduce((sum, r) => sum + r, 0);
      const exerciseLabel =
        EXERCISE_OPTIONS.find((e) => e.value === selectedExercise)?.label ||
        'Strength Training';

      const repsBreakdown = completedReps
        .map((r, i) => `Set ${i + 1}: ${r}`)
        .join(', ');

      // Estimate calories using CalorieEstimationService
      const calorieService = CalorieEstimationService.getInstance();
      const calories = calorieService.estimateStrengthCalories(
        totalReps,
        totalSets,
        duration,
        userWeight
      );

      setEstimatedCalories(calories);

      const workoutId = await LocalWorkoutStorageService.saveManualWorkout({
        type: 'strength_training',
        duration: duration, // Duration in seconds (LocalWorkout interface expects seconds)
        reps: totalReps,
        sets: totalSets,
        notes: `${exerciseLabel} - ${repsBreakdown}${exerciseWeight > 0 ? ` @ ${exerciseWeight} lbs` : ''}`,
        calories, // Add calorie estimation
        // Exercise-specific fields for better display and Nostr publishing
        exerciseType: selectedExercise,
        repsBreakdown: completedReps,
        restTime: restDuration,
        weight: exerciseWeight > 0 ? exerciseWeight : undefined, // Only include if weight was set
      });

      console.log(
        `✅ Strength workout auto-saved: ${selectedExercise} - ${totalReps} reps in ${totalSets} sets, ${calories} cal (ID: ${workoutId})`
      );

      setSavedWorkoutId(workoutId);

      // Retrieve the saved workout for modal display
      const allWorkouts = await LocalWorkoutStorageService.getAllWorkouts();
      const workout = allWorkouts.find((w) => w.id === workoutId);
      if (workout) {
        setSavedWorkout(workout as any);
      }

      return workoutId;
    } catch (error) {
      console.error('❌ Failed to save strength workout:', error);
      return null;
    }
  };

  /**
   * Post workout to Nostr as Kind 1301 (competition entry)
   */
  const handlePostNostr = async () => {
    if (!savedWorkoutId) {
      Alert.alert('Error', 'No workout to post. Please complete a workout first.');
      return;
    }

    if (!signer || !userId) {
      Alert.alert('Error', 'Authentication required. Please log in again.');
      return;
    }

    try {
      // Get the saved workout from local storage
      const workouts = await LocalWorkoutStorageService.getAllWorkouts();
      const workout = workouts.find((w) => w.id === savedWorkoutId);

      if (!workout) {
        Alert.alert('Error', 'Workout not found.');
        return;
      }

      console.log(`[StrengthTracker] Posting workout ${workout.id} as kind 1301...`);

      // Convert LocalWorkout to PublishableWorkout format
      const publishableWorkout = {
        ...workout,
        source: 'manual' as const,
      };

      // Publish to Nostr as kind 1301 workout event
      const result = await publishingService.saveWorkoutToNostr(
        publishableWorkout,
        signer,
        userId
      );

      if (result.success && result.eventId) {
        console.log(`[StrengthTracker] ✅ Workout published as kind 1301: ${result.eventId}`);

        // Mark workout as synced
        await LocalWorkoutStorageService.markAsSynced(workout.id, result.eventId);

        Alert.alert('Success', 'Workout saved to Nostr!', [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to profile after posting
              navigation.navigate('Profile' as any);
            },
          },
        ]);
      } else {
        throw new Error(result.error || 'Failed to publish workout');
      }
    } catch (error) {
      console.error('[StrengthTracker] ❌ Post to Nostr (1301) failed:', error);
      Alert.alert('Error', 'Failed to post workout. Please try again.');
    }
  };

  /**
   * Post workout to Nostr as Kind 1 (social post with card)
   */
  const handlePostSocial = () => {
    if (!savedWorkout) {
      Alert.alert('Error', 'No workout to post. Please complete a workout first.');
      return;
    }

    // Open social share modal with enhanced UI (beautiful cards)
    setShowShareModal(true);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Setup screen
  if (phase === 'setup') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.setupContainer}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="barbell" size={64} color={theme.colors.text} />
        </View>

        <Text style={styles.title}>Strength Training</Text>
        <Text style={styles.subtitle}>Configure your workout</Text>

        {/* Exercise Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Exercise</Text>
          <View style={styles.exerciseGrid}>
            {EXERCISE_OPTIONS.map((exercise) => (
              <TouchableOpacity
                key={exercise.value}
                style={[
                  styles.exerciseOption,
                  selectedExercise === exercise.value &&
                    styles.exerciseOptionActive,
                ]}
                onPress={() => setSelectedExercise(exercise.value)}
              >
                <Ionicons
                  name={exercise.icon}
                  size={24}
                  color={
                    selectedExercise === exercise.value
                      ? theme.colors.text
                      : theme.colors.textMuted
                  }
                />
                <Text
                  style={[
                    styles.exerciseLabel,
                    selectedExercise === exercise.value &&
                      styles.exerciseLabelActive,
                  ]}
                >
                  {exercise.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sets Input */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Number of Sets</Text>
          <View style={styles.numberInput}>
            <TouchableOpacity
              style={styles.numberButton}
              onPress={() => setTotalSets(Math.max(1, totalSets - 1))}
            >
              <Ionicons name="remove" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.numberValue}>{totalSets}</Text>
            <TouchableOpacity
              style={styles.numberButton}
              onPress={() => setTotalSets(Math.min(10, totalSets + 1))}
            >
              <Ionicons name="add" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Target Reps Input */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Target Reps per Set</Text>
          <View style={styles.numberInput}>
            <TouchableOpacity
              style={styles.numberButton}
              onPress={() => setTargetReps(Math.max(1, targetReps - 5))}
            >
              <Ionicons name="remove" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.numberValue}>{targetReps}</Text>
            <TouchableOpacity
              style={styles.numberButton}
              onPress={() => setTargetReps(targetReps + 5)}
            >
              <Ionicons name="add" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Exercise Weight Input (optional) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Weight (Optional)</Text>
          <View style={styles.numberInput}>
            <TouchableOpacity
              style={styles.numberButton}
              onPress={() => setExerciseWeight(Math.max(0, exerciseWeight - 5))}
            >
              <Ionicons name="remove" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.numberValue}>{exerciseWeight}</Text>
              <Text style={styles.weightUnit}>lbs</Text>
            </View>
            <TouchableOpacity
              style={styles.numberButton}
              onPress={() => setExerciseWeight(exerciseWeight + 5)}
            >
              <Ionicons name="add" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Rest Duration */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Rest Between Sets</Text>
          <View style={styles.restOptions}>
            {REST_DURATIONS.map((duration) => (
              <TouchableOpacity
                key={duration}
                style={[
                  styles.restOption,
                  restDuration === duration && styles.restOptionActive,
                ]}
                onPress={() => setRestDuration(duration)}
              >
                <Text
                  style={[
                    styles.restOptionText,
                    restDuration === duration && styles.restOptionTextActive,
                  ]}
                >
                  {duration}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.startButton} onPress={startWorkout}>
          <Text style={styles.startButtonText}>Start Workout</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Active set screen
  if (phase === 'active') {
    return (
      <View style={styles.container}>
        <View style={styles.activeContainer}>
          <Text style={styles.exerciseName}>
            {EXERCISE_OPTIONS.find((e) => e.value === selectedExercise)?.label}
          </Text>

          <View style={styles.setIndicator}>
            <Text style={styles.setNumber}>Set {currentSet}</Text>
            <Text style={styles.setTotal}>of {totalSets}</Text>
          </View>

          <View style={styles.targetContainer}>
            <Text style={styles.targetLabel}>Target</Text>
            <Text style={styles.targetValue}>{targetReps} reps</Text>
          </View>

          {repsCompleted.length > 0 && (
            <View style={styles.previousSets}>
              <Text style={styles.previousLabel}>Previous Sets:</Text>
              {repsCompleted.map((reps, index) => (
                <Text key={index} style={styles.previousReps}>
                  Set {index + 1}: {reps} reps
                </Text>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.completeButton}
            onPress={handleSetComplete}
          >
            <Text style={styles.completeButtonText}>Set Complete</Text>
          </TouchableOpacity>
        </View>

        {/* Reps Input Modal */}
        <Modal visible={showRepsModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.repsModalContainer}>
              <Text style={styles.repsModalTitle}>How many reps?</Text>
              <TextInput
                style={styles.repsInput}
                value={currentRepsInput}
                onChangeText={setCurrentRepsInput}
                keyboardType="number-pad"
                autoFocus
                selectTextOnFocus
              />
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={confirmReps}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Rest timer screen
  if (phase === 'rest') {
    const progress = (restTimeRemaining / restDuration) * 100;

    return (
      <View style={styles.container}>
        <View style={styles.restContainer}>
          <Text style={styles.restLabel}>Rest Time</Text>

          <View style={styles.restTimerCircle}>
            <Text style={styles.restTimerText}>{restTimeRemaining}</Text>
            <Text style={styles.restTimerUnit}>seconds</Text>
          </View>

          <Text style={styles.nextSetLabel}>
            Next: Set {currentSet + 1} of {totalSets}
          </Text>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => {
              setPhase('active');
              setCurrentSet((s) => s + 1);
            }}
          >
            <Text style={styles.skipButtonText}>Skip Rest</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Summary screen
  if (phase === 'summary') {
    const totalReps = repsCompleted.reduce((sum, r) => sum + r, 0);

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.summaryContainer}
      >
        <View style={styles.summaryIconContainer}>
          <Ionicons
            name="checkmark-circle"
            size={64}
            color={theme.colors.orangeBright}
          />
        </View>

        <Text style={styles.summaryTitle}>Workout Complete!</Text>

        <View style={styles.summaryStatsCard}>
          <Text style={styles.summaryExercise}>
            {EXERCISE_OPTIONS.find((e) => e.value === selectedExercise)?.label}
          </Text>

          <View style={styles.summaryMainStats}>
            <View style={styles.summaryStatItem}>
              <Text style={styles.summaryStatValue}>{totalReps}</Text>
              <Text style={styles.summaryStatLabel}>Total Reps</Text>
            </View>
            <View style={styles.summaryStatItem}>
              <Text style={styles.summaryStatValue}>{totalSets}</Text>
              <Text style={styles.summaryStatLabel}>Sets</Text>
            </View>
            <View style={styles.summaryStatItem}>
              <Text style={styles.summaryStatValue}>
                {formatTime(workoutDuration)}
              </Text>
              <Text style={styles.summaryStatLabel}>Duration</Text>
            </View>
          </View>

          {/* Calorie Estimate */}
          {estimatedCalories > 0 && (
            <View style={styles.calorieSection}>
              <Ionicons
                name="flame"
                size={20}
                color={theme.colors.orangeBright}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.calorieText}>
                {estimatedCalories} calories burned
              </Text>
            </View>
          )}

          <View style={styles.breakdownSection}>
            <Text style={styles.breakdownTitle}>Breakdown</Text>
            {repsCompleted.map((reps, index) => (
              <View key={index} style={styles.breakdownRow}>
                <Text style={styles.breakdownSet}>Set {index + 1}</Text>
                <Text style={styles.breakdownReps}>{reps} reps</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Posting Buttons */}
        <TouchableOpacity
          style={styles.postButton}
          onPress={handlePostSocial}
        >
          <Ionicons
            name="chatbubble-outline"
            size={20}
            color={theme.colors.background}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.postButtonText}>Post</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.competeButton}
          onPress={handlePostNostr}
        >
          <Ionicons
            name="cloud-upload-outline"
            size={20}
            color={theme.colors.background}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.competeButtonText}>Save to Nostr</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.discardButton}
          onPress={async () => {
            // Delete the saved workout from local storage
            if (savedWorkoutId) {
              await LocalWorkoutStorageService.deleteWorkout(savedWorkoutId);
            }
            setPhase('setup');
            setRepsCompleted([]);
            setCurrentSet(1);
            setSavedWorkoutId(null);
          }}
        >
          <Text style={styles.discardButtonText}>Discard</Text>
        </TouchableOpacity>

        {/* Social Share Modal */}
        {savedWorkout && (
          <EnhancedSocialShareModal
            visible={showShareModal}
            workout={savedWorkout}
            userId={userId}
            onClose={() => setShowShareModal(false)}
            onSuccess={() => {
              Alert.alert('Success', 'Your workout has been shared to Nostr with a beautiful card!', [
                {
                  text: 'OK',
                  onPress: () => {
                    setShowShareModal(false);
                    // Navigate back to profile after posting
                    navigation.navigate('Profile' as any);
                  },
                },
              ]);
            }}
          />
        )}
      </ScrollView>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  setupContainer: {
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
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 12,
  },
  exerciseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  exerciseOption: {
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
  exerciseOptionActive: {
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.border,
  },
  exerciseLabel: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    marginLeft: 8,
  },
  exerciseLabelActive: {
    color: theme.colors.text,
    fontWeight: theme.typography.weights.semiBold,
  },
  numberInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  numberButton: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  numberValue: {
    fontSize: 32,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    minWidth: 60,
    textAlign: 'center',
  },
  weightUnit: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  restOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  restOption: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  restOptionActive: {
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.border,
  },
  restOptionText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },
  restOptionTextActive: {
    color: theme.colors.text,
    fontWeight: theme.typography.weights.semiBold,
  },
  startButton: {
    backgroundColor: theme.colors.text,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  startButtonText: {
    color: theme.colors.background,
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
  },
  activeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  exerciseName: {
    fontSize: 24,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 40,
  },
  setIndicator: {
    alignItems: 'center',
    marginBottom: 40,
  },
  setNumber: {
    fontSize: 48,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  setTotal: {
    fontSize: 18,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  targetContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  targetLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  targetValue: {
    fontSize: 32,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.orangeBright,
    marginTop: 4,
  },
  previousSets: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  previousLabel: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
  previousReps: {
    fontSize: 14,
    color: theme.colors.text,
    marginTop: 4,
  },
  completeButton: {
    backgroundColor: theme.colors.text,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
  completeButtonText: {
    color: theme.colors.background,
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  repsModalContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 300,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  repsModalTitle: {
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  repsInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 32,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 24,
  },
  confirmButton: {
    backgroundColor: theme.colors.text,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  restContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  restLabel: {
    fontSize: 18,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textMuted,
    marginBottom: 40,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  restTimerCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: theme.colors.card,
    borderWidth: 4,
    borderColor: theme.colors.orangeBright,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  restTimerText: {
    fontSize: 64,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  restTimerUnit: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  nextSetLabel: {
    fontSize: 16,
    color: theme.colors.textMuted,
    marginBottom: 40,
  },
  skipButton: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  skipButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: theme.typography.weights.medium,
  },
  summaryContainer: {
    flexGrow: 1,
    padding: 20,
  },
  summaryIconContainer: {
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 28,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 32,
  },
  summaryStatsCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryExercise: {
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  summaryMainStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  summaryStatItem: {
    alignItems: 'center',
  },
  summaryStatValue: {
    fontSize: 28,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  summaryStatLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  calorieSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 157, 66, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 66, 0.3)',
  },
  calorieText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  breakdownSection: {
    marginTop: 8,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  breakdownSet: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  breakdownReps: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  postButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  postButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  competeButton: {
    backgroundColor: theme.colors.text,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  competeButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },
  discardButton: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  discardButtonText: {
    color: theme.colors.textMuted,
    fontSize: 16,
    fontWeight: theme.typography.weights.medium,
  },
});
