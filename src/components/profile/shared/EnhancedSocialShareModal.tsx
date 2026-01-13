/**
 * EnhancedSocialShareModal - Modal for saving workout cards locally
 * Features: Template picker, card preview, camera capture, fullscreen preview
 * NOTE: Kind 1 Nostr posting has been removed. Cards are saved locally for screenshotting.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../../styles/theme';
import { WorkoutCardGenerator } from '../../../services/nostr/workoutCardGenerator';
import { WorkoutCardRenderer } from '../../cards/WorkoutCardRenderer';
import { PostingErrorBoundary } from '../../ui/PostingErrorBoundary';
import LocalWorkoutStorageService from '../../../services/fitness/LocalWorkoutStorageService';
import type { Workout } from '../../../types/workout';
import type { PublishableWorkout } from '../../../services/nostr/workoutPublishingService';
import { FullScreenCardModal } from './FullScreenCardModal';

interface EnhancedSocialShareModalProps {
  visible: boolean;
  workout: Workout | null;
  userId: string;
  userAvatar?: string;
  userName?: string;
  localWorkoutId?: string; // For saving card to local storage
  onClose: () => void;
  onSuccess?: () => void;
}

type Template = 'achievement' | 'progress' | 'minimal' | 'stats' | 'elegant' | 'custom_photo';

export const EnhancedSocialShareModal: React.FC<
  EnhancedSocialShareModalProps
> = ({
  visible,
  workout,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId: _userId, // Kept for interface compatibility, not used since Nostr posting removed
  userAvatar,
  userName,
  localWorkoutId,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template>('elegant');
  const [cardSvg, setCardSvg] = useState<string>('');
  const [cardDimensions, setCardDimensions] = useState({
    width: 800,
    height: 600,
  });
  const [customPhotoUri, setCustomPhotoUri] = useState<string | null>(null);
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false);
  // Delay SVG rendering on Android to let modal fully mount (prevents crashes on restricted launchers like Olauncher)
  const [svgReady, setSvgReady] = useState(Platform.OS !== 'android');
  const cardRef = useRef<View>(null);
  // Track mount status to prevent setState on unmounted component (crash prevention)
  const isMountedRef = useRef(true);

  const cardGenerator = WorkoutCardGenerator.getInstance();

  // Track mounted state for crash prevention
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Delay SVG rendering on Android to let modal fully mount (prevents crashes on Olauncher)
  useEffect(() => {
    if (Platform.OS === 'android' && visible) {
      setSvgReady(false);
      const timer = setTimeout(() => setSvgReady(true), 300);
      return () => clearTimeout(timer);
    } else if (!visible) {
      // Reset when modal closes
      setSvgReady(Platform.OS !== 'android');
    }
  }, [visible]);

  // Reset custom photo when modal closes
  useEffect(() => {
    if (!visible) {
      setCustomPhotoUri(null);
      setShowFullscreenPreview(false);
    }
  }, [visible]);

  // Generate card preview when workout or template changes
  useEffect(() => {
    if (workout && visible) {
      generateCardPreview();
    }
  }, [workout, selectedTemplate, visible]);

  const generateCardPreview = async () => {
    if (!workout) return;

    // Skip card generation for text-based template or custom photo
    if (selectedTemplate === 'achievement' || selectedTemplate === 'custom_photo') {
      console.log('📝 Text-based or custom photo template selected - skipping card generation');
      if (isMountedRef.current) setCardSvg(''); // Clear any existing card
      return;
    }

    try {
      console.log('🎨 Generating card preview...', {
        template: selectedTemplate,
        hasAvatar: !!userAvatar,
        hasName: !!userName,
        workoutType: workout.type,
        duration: workout.duration,
      });

      const cardData = await cardGenerator.generateWorkoutCard(
        workout as PublishableWorkout,
        {
          template: selectedTemplate,
          userAvatar,
          userName,
        }
      );

      if (!isMountedRef.current) return; // Prevent setState on unmounted component

      console.log('✅ Card preview generated:', {
        svgLength: cardData.svgContent.length,
        dimensions: cardData.dimensions,
      });

      setCardSvg(cardData.svgContent);
      setCardDimensions(cardData.dimensions);
    } catch (error) {
      console.error('❌ Failed to generate card preview:', error);
    }
  };

  /**
   * Take a photo using the camera
   */
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setCustomPhotoUri(result.assets[0].uri);
        setSelectedTemplate('custom_photo');
        console.log('📸 Photo captured:', result.assets[0].uri);
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  /**
   * Save the card selection to local storage and show fullscreen preview
   */
  const handleSave = async () => {
    if (!workout) return;

    if (isMountedRef.current) setLoading(true);

    try {
      // Save card selection to local storage if we have a workout ID
      if (localWorkoutId) {
        await LocalWorkoutStorageService.saveWorkoutCard(localWorkoutId, {
          templateId: selectedTemplate,
          customPhotoUri: selectedTemplate === 'custom_photo' ? customPhotoUri || undefined : undefined,
        });
        console.log('✅ Card saved for workout:', localWorkoutId);
      }

      // Show fullscreen preview
      setShowFullscreenPreview(true);
    } catch (error) {
      console.error('Failed to save card:', error);
      Alert.alert('Error', 'Failed to save card');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  /**
   * Handle fullscreen preview close - notify parent of success
   */
  const handleFullscreenClose = () => {
    setShowFullscreenPreview(false);
    onSuccess?.();
    onClose();
  };

  const templates = cardGenerator.getAvailableTemplates();

  const formatWorkoutSummary = (workout: Workout): string => {
    const type = workout.type.charAt(0).toUpperCase() + workout.type.slice(1);
    const duration = Math.round(workout.duration / 60);
    const distance = workout.distance
      ? ` • ${(workout.distance / 1000).toFixed(2)}km`
      : '';
    return `${type} • ${duration} min${distance}`;
  };

  const formatDurationForDisplay = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatTextPreview = (workout: Workout): string => {
    // Get specific exercise name (e.g., "unguided meditation")
    const meditationType = (workout as any).meditationType;
    const specificExercise = meditationType
      ? `${meditationType} meditation`
      : workout.type;

    // Get emoji
    const activityEmoji =
      workout.type === 'meditation'
        ? '🧘‍♂️'
        : workout.type === 'running'
        ? '🏃‍♂️'
        : '💪';

    // Format duration
    const duration = formatDurationForDisplay(workout.duration);

    // Get hashtag
    const activityHashtag =
      workout.type.charAt(0).toUpperCase() + workout.type.slice(1);

    return `Completed ${specificExercise} with RUNSTR! ${activityEmoji}\n\n⏱️ Duration: ${duration}\n\n#RUNSTR #${activityHashtag}`;
  };

  if (!workout) return null;

  // Calculate dynamic scale based on screen width to fit card in available space
  const MODAL_PADDING = 40; // 20px on each side
  const screenWidth = Dimensions.get('window').width;
  const availableWidth = screenWidth - MODAL_PADDING;
  const dynamicScale = Math.min(availableWidth / cardDimensions.width, 1); // Cap at 1 (never scale up)

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === 'android' ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <PostingErrorBoundary
        onClose={onClose}
        fallbackTitle="Share Error"
        fallbackMessage="There was an error preparing your post. Please try again."
      >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Share Workout</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Workout Summary */}
            <View style={styles.workoutPreview}>
              <Text style={styles.workoutSummary}>
                {formatWorkoutSummary(workout)}
              </Text>
              <Text style={styles.workoutDate}>
                {new Date(workout.startTime).toLocaleDateString()}
              </Text>
            </View>

            {/* Template Picker */}
            <Text style={styles.sectionTitle}>Choose Card Style</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.templatePicker}
            >
              {/* Camera Button */}
              <TouchableOpacity
                style={[
                  styles.templateButton,
                  styles.cameraButton,
                  selectedTemplate === 'custom_photo' && styles.templateButtonSelected,
                ]}
                onPress={takePhoto}
                disabled={loading}
              >
                <Ionicons name="camera" size={24} color={theme.colors.accent} />
                <Text style={styles.templateName}>Camera</Text>
                <Text style={styles.templateDescription}>
                  Take a photo
                </Text>
              </TouchableOpacity>

              {/* Template Buttons */}
              {templates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.templateButton,
                    selectedTemplate === template.id &&
                      styles.templateButtonSelected,
                  ]}
                  onPress={() => setSelectedTemplate(template.id as Template)}
                  disabled={loading}
                >
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateDescription}>
                    {template.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Card Preview */}
            <Text style={styles.sectionTitle}>Preview</Text>
            <View style={styles.cardPreviewContainer}>
              {selectedTemplate === 'custom_photo' && customPhotoUri ? (
                <View style={styles.customPhotoContainer}>
                  <Image
                    source={{ uri: customPhotoUri }}
                    style={styles.customPhotoPreview}
                    resizeMode="cover"
                  />
                  <Text style={styles.textPreviewNote}>
                    Your photo will be displayed in fullscreen
                  </Text>
                </View>
              ) : selectedTemplate === 'custom_photo' ? (
                <View style={styles.textPreviewContainer}>
                  <Ionicons name="camera-outline" size={48} color={theme.colors.textSecondary} />
                  <Text style={styles.textPreviewNote}>
                    Tap Camera above to take a photo
                  </Text>
                </View>
              ) : selectedTemplate === 'achievement' ? (
                <View style={styles.textPreviewContainer}>
                  <Text style={styles.textPreviewContent}>
                    {formatTextPreview(workout)}
                  </Text>
                  <Text style={styles.textPreviewNote}>
                    Plain text (no image)
                  </Text>
                </View>
              ) : cardSvg && svgReady ? (
                <View
                  style={[
                    styles.cardWrapper,
                    {
                      width: cardDimensions.width * dynamicScale,
                      height: cardDimensions.height * dynamicScale,
                      overflow: 'hidden',
                    },
                  ]}
                >
                  <View style={{ transform: [{ scale: dynamicScale }], transformOrigin: 'top left' }}>
                    <WorkoutCardRenderer
                      ref={cardRef}
                      svgContent={cardSvg}
                      width={cardDimensions.width}
                      height={cardDimensions.height}
                    />
                  </View>
                </View>
              ) : (
                <View
                  style={[
                    styles.cardPlaceholder,
                    {
                      width: cardDimensions.width * dynamicScale,
                      height: cardDimensions.height * dynamicScale,
                    },
                  ]}
                >
                  <ActivityIndicator size="large" color={theme.colors.accent} />
                  <Text style={styles.cardPlaceholderText}>
                    Generating card...
                  </Text>
                </View>
              )}
            </View>

            {/* Done Button */}
            <TouchableOpacity
              style={[
                styles.shareButton,
                loading && styles.shareButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.accentText}
                />
              ) : (
                <Text style={styles.shareButtonText}>Done</Text>
              )}
            </TouchableOpacity>

            {/* Info */}
            <Text style={styles.infoText}>
              {selectedTemplate === 'custom_photo'
                ? 'Screenshot your photo in fullscreen to share!'
                : selectedTemplate === 'achievement'
                ? 'Screenshot the text to share with friends'
                : 'Screenshot your card in fullscreen to share!'}
            </Text>
          </ScrollView>
        </View>
      </View>
      </PostingErrorBoundary>

      {/* Fullscreen Preview Modal */}
      <FullScreenCardModal
        visible={showFullscreenPreview}
        onClose={handleFullscreenClose}
        workout={workout as PublishableWorkout}
        templateId={selectedTemplate}
        customPhotoUri={customPhotoUri}
        userAvatar={userAvatar}
        userName={userName}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: theme.colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 24,
    color: theme.colors.textSecondary,
  },
  workoutPreview: {
    backgroundColor: theme.colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  workoutSummary: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  workoutDate: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  templatePicker: {
    marginBottom: 20,
  },
  templateButton: {
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 140,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cameraButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateButtonSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent + '10',
  },
  templateName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  templateDescription: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  cardPreviewContainer: {
    marginBottom: 6,
  },
  cardWrapper: {
    transformOrigin: 'top left',
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardPlaceholderText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  shareButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareButtonText: {
    color: theme.colors.accentText,
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  textPreviewContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 200,
    justifyContent: 'center',
  },
  textPreviewContent: {
    color: theme.colors.text,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  textPreviewNote: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  customPhotoContainer: {
    alignItems: 'center',
  },
  customPhotoPreview: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
  },
});
