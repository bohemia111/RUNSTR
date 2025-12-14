/**
 * ManualEntryScreen - Universal manual workout entry
 * Adapts UI based on category (cardio, strength, diet, wellness)
 * Saves custom exercise names for reuse in dropdown menus
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../styles/theme';
import LocalWorkoutStorageService from '../../services/fitness/LocalWorkoutStorageService';
import { CustomAlert } from '../../components/ui/CustomAlert';
import { WorkoutPublishingService } from '../../services/nostr/workoutPublishingService';
import { UnifiedSigningService } from '../../services/auth/UnifiedSigningService';
import { EnhancedSocialShareModal } from '../../components/profile/shared/EnhancedSocialShareModal';
import { nostrProfileService } from '../../services/nostr/NostrProfileService';
import type { NDKSigner } from '@nostr-dev-kit/ndk';
import type { Workout, WorkoutType } from '../../types/workout';

export type ManualEntryCategory = 'cardio' | 'strength' | 'diet' | 'wellness';

interface ManualEntryScreenProps {
  category: ManualEntryCategory;
  prefillName?: string;
}

const CATEGORY_CONFIG: Record<
  ManualEntryCategory,
  {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
    workoutType: WorkoutType;
  }
> = {
  cardio: {
    icon: 'fitness',
    title: 'Custom Cardio',
    subtitle: 'Log indoor cardio, treadmill, rowing, etc.',
    workoutType: 'other',
  },
  strength: {
    icon: 'barbell',
    title: 'Custom Strength',
    subtitle: 'Log any strength exercise',
    workoutType: 'strength_training',
  },
  diet: {
    icon: 'restaurant',
    title: 'Custom Diet',
    subtitle: 'Log special diets, supplements, etc.',
    workoutType: 'diet',
  },
  wellness: {
    icon: 'heart',
    title: 'Custom Wellness',
    subtitle: 'Log yoga, stretching, recovery, etc.',
    workoutType: 'meditation',
  },
};

export const ManualEntryScreen: React.FC<ManualEntryScreenProps> = ({
  category,
  prefillName = '',
}) => {
  const navigation = useNavigation();
  const config = CATEGORY_CONFIG[category];

  // Form state
  const [exerciseName, setExerciseName] = useState(prefillName);
  const [saveExercise, setSaveExercise] = useState(!prefillName); // Default on for new exercises
  const [notes, setNotes] = useState('');

  // Category-specific fields
  const [duration, setDuration] = useState(''); // minutes
  const [distance, setDistance] = useState(''); // km
  const [calories, setCalories] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState(''); // lbs

  // Summary/posting state
  const [showSummary, setShowSummary] = useState(false);
  const [savedWorkout, setSavedWorkout] = useState<Workout | null>(null);
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

  // Load user data on mount
  useEffect(() => {
    const initializeData = async () => {
      try {
        const npub = await AsyncStorage.getItem('@runstr:npub');
        if (npub) {
          setUserId(npub);
          const nostrProfile = await nostrProfileService.getProfile(npub);
          if (nostrProfile) {
            setUserAvatar(nostrProfile.picture);
            setUserName(nostrProfile.display_name || nostrProfile.name);
          }
        }
        const userSigner = await UnifiedSigningService.getInstance().getSigner();
        if (userSigner) setSigner(userSigner);
      } catch (error) {
        console.warn('[ManualEntry] Failed to initialize:', error);
      }
    };
    initializeData();
  }, []);

  const validateForm = (): boolean => {
    if (!exerciseName.trim()) {
      setAlertConfig({
        title: 'Missing Name',
        message: 'Please enter an exercise name.',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
      return false;
    }

    // Category-specific validation
    if (category === 'cardio' || category === 'wellness') {
      if (!duration.trim()) {
        setAlertConfig({
          title: 'Missing Duration',
          message: 'Please enter the duration in minutes.',
          buttons: [{ text: 'OK', style: 'default' }],
        });
        setAlertVisible(true);
        return false;
      }
    }

    if (category === 'strength') {
      if (!sets.trim() || !reps.trim()) {
        setAlertConfig({
          title: 'Missing Data',
          message: 'Please enter sets and reps.',
          buttons: [{ text: 'OK', style: 'default' }],
        });
        setAlertVisible(true);
        return false;
      }
    }

    if (category === 'diet' && !notes.trim()) {
      setAlertConfig({
        title: 'Missing Description',
        message: 'Please describe what you ate or the diet type.',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      const durationSeconds = duration ? parseInt(duration, 10) * 60 : 0;
      const distanceKm = distance ? parseFloat(distance) : undefined;
      const caloriesNum = calories ? parseInt(calories, 10) : undefined;

      const workoutData: any = {
        type: config.workoutType,
        duration: durationSeconds,
        distance: distanceKm,
        calories: caloriesNum,
        notes: notes || exerciseName,
        exerciseType: exerciseName.toLowerCase().replace(/\s+/g, '_'),
      };

      // Add category-specific fields
      if (category === 'strength') {
        workoutData.sets = parseInt(sets, 10) || undefined;
        workoutData.reps = parseInt(reps, 10) || undefined;
        workoutData.weight = weight ? parseInt(weight, 10) : undefined;
      }

      if (category === 'cardio' && heartRate) {
        // Store heart rate in notes for now
        workoutData.notes = `${exerciseName}${heartRate ? ` | Avg HR: ${heartRate} bpm` : ''}${notes ? ` | ${notes}` : ''}`;
      }

      const workoutId = await LocalWorkoutStorageService.saveManualWorkout(workoutData);

      // Save exercise name for reuse (if toggle is on)
      if (saveExercise && !prefillName) {
        await LocalWorkoutStorageService.saveCustomExerciseName(
          category,
          exerciseName.trim()
        );
      }

      console.log(`[ManualEntry] Saved workout: ${workoutId}`);

      // Get saved workout for summary
      const allWorkouts = await LocalWorkoutStorageService.getAllWorkouts();
      const workout = allWorkouts.find((w) => w.id === workoutId);

      if (workout) {
        // Mark as manual entry for competition filtering
        (workout as any).isManualEntry = true;
        setSavedWorkout(workout as any);
        setShowSummary(true);
      }
    } catch (error) {
      console.error('[ManualEntry] Failed to save:', error);
      setAlertConfig({
        title: 'Error',
        message: 'Failed to save workout. Please try again.',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
    }
  };

  const handlePost = () => {
    setShowShareModal(true);
  };

  const handleCompete = async () => {
    if (!savedWorkout || !signer || !userId) {
      setAlertConfig({
        title: 'Authentication Required',
        message: 'Please log in with your Nostr key to post workouts.',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setAlertVisible(true);
      return;
    }

    setIsCompeting(true);

    try {
      const publishingService = WorkoutPublishingService.getInstance();
      const result = await publishingService.saveWorkoutToNostr(
        savedWorkout,
        signer,
        userId
      );

      if (result.success && result.eventId) {
        await LocalWorkoutStorageService.markAsSynced(
          savedWorkout.id,
          result.eventId
        );

        setShowSummary(false);
        setTimeout(() => {
          setAlertConfig({
            title: 'Success!',
            message: 'Your workout has been saved to Nostr!',
            buttons: [{ text: 'OK', style: 'default', onPress: handleDone }],
          });
          setAlertVisible(true);
        }, 300);
      } else {
        throw new Error(result.error || 'Failed to save to Nostr');
      }
    } catch (error) {
      console.error('[ManualEntry] Compete error:', error);
      setShowSummary(false);
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
    }
  };

  const handleDone = () => {
    setShowSummary(false);
    setShowShareModal(false);
    setSavedWorkout(null);
    navigation.goBack();
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={styles.iconContainer}>
        <Ionicons name={config.icon} size={64} color={theme.colors.text} />
      </View>

      <Text style={styles.title}>{config.title}</Text>
      <Text style={styles.subtitle}>{config.subtitle}</Text>

      {/* Exercise Name */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Exercise Name *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g., Treadmill, Cable Flyes, Keto Meal..."
          placeholderTextColor={theme.colors.textMuted}
          value={exerciseName}
          onChangeText={setExerciseName}
        />
      </View>

      {/* Save for Later Toggle */}
      {!prefillName && (
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Save this exercise for later</Text>
          <Switch
            value={saveExercise}
            onValueChange={setSaveExercise}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.orangeBright,
            }}
            thumbColor={theme.colors.text}
          />
        </View>
      )}

      {/* Category-specific fields */}
      {(category === 'cardio' || category === 'wellness') && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Duration (minutes) *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="30"
              placeholderTextColor={theme.colors.textMuted}
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
            />
          </View>

          {category === 'cardio' && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Distance (km)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="5.0"
                  placeholderTextColor={theme.colors.textMuted}
                  value={distance}
                  onChangeText={setDistance}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Avg Heart Rate (bpm)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="145"
                  placeholderTextColor={theme.colors.textMuted}
                  value={heartRate}
                  onChangeText={setHeartRate}
                  keyboardType="numeric"
                />
              </View>
            </>
          )}
        </>
      )}

      {category === 'strength' && (
        <>
          <View style={styles.rowSection}>
            <View style={[styles.section, styles.halfSection]}>
              <Text style={styles.sectionLabel}>Sets *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="3"
                placeholderTextColor={theme.colors.textMuted}
                value={sets}
                onChangeText={setSets}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.section, styles.halfSection]}>
              <Text style={styles.sectionLabel}>Reps *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="12"
                placeholderTextColor={theme.colors.textMuted}
                value={reps}
                onChangeText={setReps}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.rowSection}>
            <View style={[styles.section, styles.halfSection]}>
              <Text style={styles.sectionLabel}>Weight (lbs)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="135"
                placeholderTextColor={theme.colors.textMuted}
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.section, styles.halfSection]}>
              <Text style={styles.sectionLabel}>Duration (min)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="45"
                placeholderTextColor={theme.colors.textMuted}
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
              />
            </View>
          </View>
        </>
      )}

      {/* Calories (optional for all) */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Calories</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Enter estimated calories"
          placeholderTextColor={theme.colors.textMuted}
          value={calories}
          onChangeText={setCalories}
          keyboardType="numeric"
        />
      </View>

      {/* Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          {category === 'diet' ? 'Description *' : 'Notes'}
        </Text>
        <TextInput
          style={[styles.textInput, styles.notesInput]}
          placeholder={
            category === 'diet'
              ? 'Describe what you ate...'
              : 'Add any additional notes...'
          }
          placeholderTextColor={theme.colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Ionicons
          name="checkmark-circle"
          size={20}
          color={theme.colors.background}
        />
        <Text style={styles.saveButtonText}>Complete</Text>
      </TouchableOpacity>

      {/* Hint */}
      <View style={styles.hintBox}>
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={theme.colors.textMuted}
        />
        <Text style={styles.hintText}>
          Custom workouts are tagged as manual entries and won't appear in
          GPS-tracked competition leaderboards.
        </Text>
      </View>

      {/* Summary Modal */}
      <Modal visible={showSummary} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>Workout Logged</Text>

            <View style={styles.summaryStats}>
              <Ionicons name={config.icon} size={48} color={theme.colors.text} />
              <Text style={styles.summaryName}>{exerciseName}</Text>
              {duration && (
                <Text style={styles.summaryDetail}>
                  {formatDuration(parseInt(duration, 10))}
                </Text>
              )}
              {category === 'strength' && sets && reps && (
                <Text style={styles.summaryDetail}>
                  {sets} sets x {reps} reps
                  {weight ? ` @ ${weight} lbs` : ''}
                </Text>
              )}
            </View>

            <View style={styles.summaryButtons}>
              <TouchableOpacity style={styles.postButton} onPress={handlePost}>
                <Ionicons
                  name="chatbubble-outline"
                  size={20}
                  color={theme.colors.background}
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
                    />
                    <Text style={styles.competeButtonText}>Public</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>

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
                  message: 'Your workout has been shared to Nostr!',
                  buttons: [{ text: 'OK', style: 'default', onPress: handleDone }],
                });
                setAlertVisible(true);
              }}
            />
          )}
        </View>
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
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    color: theme.colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rowSection: {
    flexDirection: 'row',
    gap: 12,
  },
  halfSection: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  toggleLabel: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginBottom: 20,
  },
  saveButtonText: {
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
  summaryName: {
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginTop: 12,
  },
  summaryDetail: {
    fontSize: 16,
    color: theme.colors.textMuted,
    marginTop: 8,
  },
  summaryButtons: {
    gap: 12,
  },
  postButton: {
    flexDirection: 'row',
    backgroundColor: theme.colors.text,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
    gap: 8,
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
