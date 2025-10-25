/**
 * EnhancedSocialShareModal - Modal for sharing workouts with rich image cards
 * Features: Template picker, card preview, image generation, nostr.build upload
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { theme } from '../../../styles/theme';
import { WorkoutPublishingService } from '../../../services/nostr/workoutPublishingService';
import { WorkoutStatusTracker } from '../../../services/fitness/WorkoutStatusTracker';
import { WorkoutCardGenerator } from '../../../services/nostr/workoutCardGenerator';
import { WorkoutCardRenderer } from '../../cards/WorkoutCardRenderer';
import { UnifiedSigningService } from '../../../services/auth/UnifiedSigningService';
import { getNsecFromStorage } from '../../../utils/nostr';
import type { NDKSigner } from '@nostr-dev-kit/ndk';
import type { Workout } from '../../../types/workout';
import type { PublishableWorkout } from '../../../services/nostr/workoutPublishingService';

interface EnhancedSocialShareModalProps {
  visible: boolean;
  workout: Workout | null;
  userId: string;
  userAvatar?: string;
  userName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

type Template = 'achievement' | 'progress' | 'minimal' | 'stats' | 'elegant';

export const EnhancedSocialShareModal: React.FC<
  EnhancedSocialShareModalProps
> = ({
  visible,
  workout,
  userId,
  userAvatar,
  userName,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<Template>('elegant');
  const [cardSvg, setCardSvg] = useState<string>('');
  const [cardDimensions, setCardDimensions] = useState({
    width: 800,
    height: 600,
  });
  const [signer, setSigner] = useState<NDKSigner | null>(null);
  const cardRef = useRef<View>(null);

  const publishingService = WorkoutPublishingService.getInstance();
  const statusTracker = WorkoutStatusTracker.getInstance();
  const cardGenerator = WorkoutCardGenerator.getInstance();

  // Load signer when modal becomes visible
  useEffect(() => {
    if (visible) {
      loadSigner();
    }
  }, [visible]);

  const loadSigner = async () => {
    try {
      const userSigner = await UnifiedSigningService.getInstance().getSigner();
      setSigner(userSigner);
      console.log('✅ Signer loaded for social share (supports both nsec and Amber)');
    } catch (error) {
      console.error('Failed to load signer:', error);
      // Signer will be null - we'll fall back to nsec in handleShare
    }
  };

  // Generate card preview when workout or template changes
  useEffect(() => {
    if (workout && visible) {
      generateCardPreview();
    }
  }, [workout, selectedTemplate, visible]);

  const generateCardPreview = async () => {
    if (!workout) return;

    // Skip card generation for text-based template
    if (selectedTemplate === 'achievement') {
      console.log('📝 Text-based template selected - skipping card generation');
      setCardSvg(''); // Clear any existing card
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

  const handleShare = async () => {
    if (!workout) return;

    setLoading(true);

    try {
      // Try to get signer (Amber on Android) or fall back to nsec (iOS or no Amber)
      let signerOrNsec: NDKSigner | string | null = signer;

      if (!signerOrNsec) {
        // Fall back to nsec (required for iOS since Amber not supported)
        const nsec = await getNsecFromStorage(userId);
        if (!nsec) {
          Alert.alert(
            'Authentication Required',
            'Please log in with your Nostr key to share workouts.'
          );
          setLoading(false);
          return;
        }
        signerOrNsec = nsec;
        console.log('📝 Using nsec for social post (iOS or Amber not available)');
      } else {
        console.log('📝 Using Amber signer for social post (Android)');
      }

      // Capture card as image (skip for text-based template)
      let cardImageUri: string | undefined;

      if (selectedTemplate !== 'achievement') {
        console.log('📸 Capturing workout card as image...', {
          hasCardRef: !!cardRef.current,
          hasSvg: !!cardSvg,
          svgLength: cardSvg?.length,
        });

        if (cardRef.current && cardSvg) {
          try {
            cardImageUri = await captureRef(cardRef.current, {
              format: 'png',
              quality: 0.9,
            });
            console.log('✅ Card captured successfully:', {
              uri: cardImageUri,
              uriLength: cardImageUri?.length,
            });
          } catch (captureError) {
            console.error(
              '❌ Card capture failed, posting without image:',
              captureError
            );
          }
        } else {
          console.warn('⚠️ Cannot capture card:', {
            hasCardRef: !!cardRef.current,
            hasSvg: !!cardSvg,
          });
        }
      } else {
        console.log('📝 Text-based template - skipping image capture');
      }

      // Post to Nostr as kind 1 social event with image
      // Supports both Amber signer (Android) and nsec (iOS)
      const result = await publishingService.postWorkoutToSocial(
        workout as PublishableWorkout,
        signerOrNsec,
        userId,
        {
          includeCard: true,
          cardTemplate: selectedTemplate as 'achievement' | 'progress' | 'minimal' | 'stats',
          includeStats: true,
          includeMotivation: true,
          userAvatar,
          userName,
          cardImageUri,
        }
      );

      if (result.success) {
        // Mark as posted
        await statusTracker.markAsPosted(workout.id, result.eventId);

        // Close modal and let parent handle success messaging
        onSuccess?.();
        onClose();
      } else {
        throw new Error(result.error || 'Failed to share workout');
      }
    } catch (error) {
      console.error('Failed to share to Nostr:', error);
      Alert.alert('Error', 'Failed to share workout. Please try again.');
    } finally {
      setLoading(false);
    }
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
      workout.type === 'meditation' ? '🧘‍♂️' : workout.type === 'running' ? '🏃‍♂️' : '💪';

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
      animationType="slide"
      onRequestClose={onClose}
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
              {templates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.templateButton,
                    selectedTemplate === template.id &&
                      styles.templateButtonSelected,
                  ]}
                  onPress={() => setSelectedTemplate(template.id)}
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
              {selectedTemplate === 'achievement' ? (
                <View style={styles.textPreviewContainer}>
                  <Text style={styles.textPreviewContent}>
                    {formatTextPreview(workout)}
                  </Text>
                  <Text style={styles.textPreviewNote}>
                    Plain text post (no image)
                  </Text>
                </View>
              ) : cardSvg ? (
                <View
                  style={[
                    styles.cardWrapper,
                    {
                      width: cardDimensions.width,
                      height: cardDimensions.height,
                      transform: [{ scale: dynamicScale }],
                    },
                  ]}
                >
                  <WorkoutCardRenderer
                    ref={cardRef}
                    svgContent={cardSvg}
                    width={cardDimensions.width}
                    height={cardDimensions.height}
                  />
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
                  <ActivityIndicator
                    size="large"
                    color={theme.colors.accent}
                  />
                  <Text style={styles.cardPlaceholderText}>
                    Generating card...
                  </Text>
                </View>
              )}
            </View>

            {/* Share Button */}
            <TouchableOpacity
              style={[
                styles.shareButton,
                loading && styles.shareButtonDisabled,
              ]}
              onPress={handleShare}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.accentText}
                />
              ) : (
                <Text style={styles.shareButtonText}>⚡ Share to Nostr</Text>
              )}
            </TouchableOpacity>

            {/* Info */}
            <Text style={styles.infoText}>
              {selectedTemplate === 'achievement'
                ? 'Your workout will be shared as a text post'
                : 'Your card will be uploaded to nostr.build and shared as a beautiful image post'}
            </Text>
          </ScrollView>
        </View>
      </View>
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
    marginBottom: 20,
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
});
