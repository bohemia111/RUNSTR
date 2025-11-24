/**
 * CoachRunstrCard - AI-Powered Fitness Coach Insights
 *
 * Displays 3 prompt buttons that generate personalized fitness insights
 * using PPQ.AI's Claude Haiku API. Users configure their own API key.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../styles/theme';
import {
  useCoachRunstr,
  type PromptType,
  type CoachInsight,
} from '../../services/ai/useCoachRunstr';
import type { LocalWorkout } from '../../services/fitness/LocalWorkoutStorageService';

interface CoachRunstrCardProps {
  workouts: LocalWorkout[];
}

interface PromptButton {
  type: PromptType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const PROMPTS: PromptButton[] = [
  { type: 'weekly', label: 'Weekly Summary', icon: 'calendar' },
  { type: 'trends', label: 'Trends', icon: 'trending-up' },
  { type: 'tips', label: 'Tips', icon: 'bulb' },
];

export const CoachRunstrCard: React.FC<CoachRunstrCardProps> = ({
  workouts,
}) => {
  const navigation = useNavigation();
  const [selectedPrompt, setSelectedPrompt] = useState<PromptType | null>(null);
  const [insight, setInsight] = useState<CoachInsight | null>(null);

  // Use the CoachRunstr hook
  const {
    generateInsight,
    loading,
    error: hookError,
    apiKeyConfigured,
  } = useCoachRunstr();
  const [error, setError] = useState<string | null>(null);

  const handlePromptPress = async (type: PromptType) => {
    setSelectedPrompt(type);
    setError(null);

    try {
      const result = await generateInsight(type, workouts);
      setInsight(result);
    } catch (err) {
      console.error('[CoachRunstrCard] Failed to generate insight:', err);
      setError(
        hookError || 'Failed to generate insight. Make sure the model is ready.'
      );
      setInsight(null);
    }
  };

  const renderPromptButtons = () => (
    <View style={styles.buttonsContainer}>
      {PROMPTS.map((prompt) => (
        <TouchableOpacity
          key={prompt.type}
          style={[
            styles.promptButton,
            selectedPrompt === prompt.type && styles.promptButtonActive,
          ]}
          onPress={() => handlePromptPress(prompt.type)}
          disabled={loading}
        >
          <Ionicons
            name={prompt.icon}
            size={16}
            color={selectedPrompt === prompt.type ? '#000' : theme.colors.text}
          />
          <Text
            style={[
              styles.promptButtonText,
              selectedPrompt === prompt.type && styles.promptButtonTextActive,
            ]}
          >
            {prompt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderInsightResult = () => {
    if (loading) {
      return (
        <View style={styles.resultContainer}>
          <ActivityIndicator size="small" color="#FF9D42" />
          <Text style={styles.loadingText}>Analyzing your workouts...</Text>
        </View>
      );
    }

    if (error) {
      const isApiKeyError =
        error.includes('API key') ||
        error.includes('401') ||
        error.includes('403');
      return (
        <View style={styles.resultContainer}>
          <Text style={styles.errorText}>{error}</Text>
          {isApiKeyError && (
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => navigation.navigate('Settings' as never)}
            >
              <Text style={styles.settingsButtonText}>Go to Settings</Text>
            </TouchableOpacity>
          )}
          {!isApiKeyError && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() =>
                selectedPrompt && handlePromptPress(selectedPrompt)
              }
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    if (insight) {
      return (
        <View style={styles.resultContainer}>
          {insight.bullets.map((bullet, index) => (
            <View key={index} style={styles.bulletRow}>
              <Text style={styles.bulletPoint}>•</Text>
              <Text style={styles.bulletText}>{bullet}</Text>
            </View>
          ))}
        </View>
      );
    }

    // Show setup guidance if API key not configured
    if (!apiKeyConfigured) {
      return (
        <View style={styles.resultContainer}>
          <Ionicons
            name="key-outline"
            size={32}
            color="#FF9D42"
            style={{ marginBottom: 12 }}
          />
          <Text style={styles.setupText}>
            Configure your PPQ.AI API key in Settings to unlock AI-powered
            workout insights
          </Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings' as never)}
          >
            <Ionicons
              name="settings-outline"
              size={16}
              color="#000"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.settingsButtonText}>Go to Settings</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.resultContainer}>
        <Text style={styles.placeholderText}>
          Tap a button above to get AI-powered insights from your workout
          history
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="fitness" size={24} color="#FF9D42" />
        <Text style={styles.title}>COACH RUNSTR</Text>
      </View>

      <Text style={styles.description}>
        AI-powered insights from your workout history
      </Text>

      {renderPromptButtons()}
      {renderInsightResult()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 14,
    marginBottom: 16,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },

  title: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: '#FFB366',
    letterSpacing: 0.5,
  },

  description: {
    fontSize: 13,
    color: '#CC7A33',
    marginBottom: 12,
  },

  buttonsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },

  promptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },

  promptButtonActive: {
    backgroundColor: '#FF9D42',
    borderColor: '#FF9D42',
  },

  promptButtonText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },

  promptButtonTextActive: {
    color: '#000',
  },

  resultContainer: {
    minHeight: 80,
    justifyContent: 'center',
  },

  loadingText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },

  loadingHintText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
    paddingHorizontal: 16,
  },

  errorText: {
    fontSize: 13,
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 12,
  },

  errorHintText: {
    fontSize: 12,
    color: '#FF9D42',
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
    paddingHorizontal: 16,
  },

  retryButton: {
    alignSelf: 'center',
    backgroundColor: '#FF9D42',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },

  retryButtonText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: '#000',
  },

  setupText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
    lineHeight: 20,
  },

  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FF9D42',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },

  settingsButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: '#000',
  },

  placeholderText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },

  bulletPoint: {
    fontSize: 16,
    color: '#FF9D42',
    marginRight: 8,
    marginTop: -2,
  },

  bulletText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});
