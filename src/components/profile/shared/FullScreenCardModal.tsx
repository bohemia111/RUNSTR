/**
 * FullScreenCardModal - Full screen workout card display for screenshotting
 * Renders workout cards at full screen for easy social media sharing
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkoutCardRenderer } from '../../cards/WorkoutCardRenderer';
import { WorkoutCardGenerator } from '../../../services/nostr/workoutCardGenerator';
import { theme } from '../../../styles/theme';
import type { PublishableWorkout } from '../../../services/nostr/workoutPublishingService';

interface FullScreenCardModalProps {
  visible: boolean;
  onClose: () => void;
  workout: PublishableWorkout | null;
  templateId: string;
  customPhotoUri?: string | null;
  userAvatar?: string;
  userName?: string;
}

export const FullScreenCardModal: React.FC<FullScreenCardModalProps> = ({
  visible,
  onClose,
  workout,
  templateId,
  customPhotoUri,
  userAvatar,
  userName,
}) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const [cardData, setCardData] = useState<{
    svgContent: string;
    dimensions: { width: number; height: number };
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const cardGenerator = WorkoutCardGenerator.getInstance();

  useEffect(() => {
    if (visible && workout && templateId !== 'custom_photo' && templateId !== 'achievement') {
      generateCard();
    }
  }, [visible, templateId, workout]);

  const generateCard = async () => {
    if (!workout) return;

    setIsGenerating(true);
    try {
      const data = await cardGenerator.generateWorkoutCard(workout, {
        template: templateId as 'progress' | 'minimal' | 'stats' | 'elegant',
        userAvatar,
        userName,
      });
      setCardData(data);
    } catch (error) {
      console.error('Failed to generate fullscreen card:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Calculate scale to fit card on screen
  const getCardScale = () => {
    if (!cardData) return 1;
    const padding = 40;
    const maxWidth = screenWidth - padding;
    const maxHeight = screenHeight - 200; // Leave room for hint and close button
    const widthScale = maxWidth / cardData.dimensions.width;
    const heightScale = maxHeight / cardData.dimensions.height;
    return Math.min(widthScale, heightScale, 1);
  };

  const renderContent = () => {
    // Custom photo
    if (templateId === 'custom_photo' && customPhotoUri) {
      return (
        <Image
          source={{ uri: customPhotoUri }}
          style={styles.customPhoto}
          resizeMode="contain"
        />
      );
    }

    // Text-based achievement template
    if (templateId === 'achievement' && workout) {
      const type = workout.type.charAt(0).toUpperCase() + workout.type.slice(1);
      const duration = Math.floor(workout.duration / 60);
      const minutes = duration;
      const seconds = Math.floor(workout.duration % 60);
      const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      return (
        <View style={styles.textCardContainer}>
          <Text style={styles.textCardEmoji}>
            {workout.type === 'running' ? '🏃‍♂️' : workout.type === 'cycling' ? '🚴' : '🚶'}
          </Text>
          <Text style={styles.textCardTitle}>
            Completed {type} with RUNSTR!
          </Text>
          <Text style={styles.textCardDuration}>⏱️ {durationStr}</Text>
          {workout.distance && (
            <Text style={styles.textCardDistance}>
              📍 {(workout.distance / 1000).toFixed(2)} km
            </Text>
          )}
          <Text style={styles.textCardHashtags}>
            #RUNSTR #{type}
          </Text>
        </View>
      );
    }

    // SVG card templates
    if (cardData) {
      const scale = getCardScale();
      return (
        <View
          style={[
            styles.cardWrapper,
            {
              width: cardData.dimensions.width * scale,
              height: cardData.dimensions.height * scale,
            },
          ]}
        >
          <View style={{ transform: [{ scale }], transformOrigin: 'top left' }}>
            <WorkoutCardRenderer
              svgContent={cardData.svgContent}
              width={cardData.dimensions.width}
              height={cardData.dimensions.height}
            />
          </View>
        </View>
      );
    }

    // Loading state
    if (isGenerating) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Generating card...</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Hint at top */}
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>Screenshot to share!</Text>
        </View>

        {/* Card Display */}
        <View style={styles.cardContainer}>
          {renderContent()}
        </View>

        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close-circle" size={48} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintContainer: {
    position: 'absolute',
    top: 60,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.colors.accent,
    borderRadius: 20,
    zIndex: 10,
  },
  hintText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardWrapper: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  customPhoto: {
    width: '100%',
    height: '80%',
  },
  textCardContainer: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '90%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: theme.colors.accent,
  },
  textCardEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  textCardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  textCardDuration: {
    fontSize: 20,
    color: '#fff',
    marginBottom: 8,
  },
  textCardDistance: {
    fontSize: 20,
    color: '#fff',
    marginBottom: 16,
  },
  textCardHashtags: {
    fontSize: 16,
    color: theme.colors.accent,
    marginTop: 16,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  closeButton: {
    position: 'absolute',
    bottom: 50,
  },
});
