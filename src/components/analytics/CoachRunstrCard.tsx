/**
 * CoachRunstrCard - AI-Powered Fitness Coach Insights
 *
 * Displays 6 prompt buttons (2 rows of 3) that generate personalized fitness insights
 * using PPQ.AI's Claude Haiku API. Users configure their own API key.
 *
 * Row 1: Weekly Summary, Trends, Tips (workout insights)
 * Row 2: BMI, VO2 Max, Fitness Age (body composition metrics)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../styles/theme';
import {
  useCoachRunstr,
  type PromptType,
  type CoachInsight,
} from '../../services/ai/useCoachRunstr';
import type { LocalWorkout } from '../../services/fitness/LocalWorkoutStorageService';
import { BodyCompositionAnalytics } from '../../services/analytics/BodyCompositionAnalytics';
import { RunstrContextGenerator } from '../../services/ai/RunstrContextGenerator';
import type { HealthProfile } from '../../types/analytics';

// Calculated metrics to display
interface CalculatedMetrics {
  bmi?: { value: number; category: string };
  vo2max?: { estimate: number; category: string; percentile: number };
  fitnessAge?: { age: number; chronologicalAge: number };
}

interface CoachRunstrCardProps {
  workouts: LocalWorkout[];
}

interface PromptButton {
  type: PromptType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  requiresHealthProfile?: boolean;
  requiresAge?: boolean;
}

// Row 1: Workout insights
const INSIGHT_PROMPTS: PromptButton[] = [
  { type: 'weekly', label: 'Weekly\nSummary', icon: 'calendar' },
  { type: 'trends', label: 'Trends', icon: 'trending-up' },
  { type: 'tips', label: 'Tips', icon: 'bulb' },
];

// Row 2: Body composition metrics
const METRIC_PROMPTS: PromptButton[] = [
  { type: 'bmi', label: 'BMI', icon: 'body', requiresHealthProfile: true },
  { type: 'vo2max', label: 'VO2 Max', icon: 'fitness', requiresHealthProfile: true },
  { type: 'fitness_age', label: 'Fitness\nAge', icon: 'ribbon', requiresHealthProfile: true, requiresAge: true },
];

// Health profile data structure
interface HealthProfileStatus {
  hasHeight: boolean;
  hasWeight: boolean;
  hasAge: boolean;
}

export const CoachRunstrCard: React.FC<CoachRunstrCardProps> = ({
  workouts,
}) => {
  const navigation = useNavigation();
  const [selectedPrompt, setSelectedPrompt] = useState<PromptType | null>(null);
  const [insight, setInsight] = useState<CoachInsight | null>(null);
  const [healthProfileStatus, setHealthProfileStatus] = useState<HealthProfileStatus>({
    hasHeight: false,
    hasWeight: false,
    hasAge: false,
  });
  const [showHealthProfilePrompt, setShowHealthProfilePrompt] = useState(false);
  const [missingDataMessage, setMissingDataMessage] = useState<string>('');
  const [calculatedMetrics, setCalculatedMetrics] = useState<CalculatedMetrics>({});

  // Use the CoachRunstr hook
  const {
    generateInsight,
    loading,
    error: hookError,
    apiKeyConfigured,
  } = useCoachRunstr();
  const [error, setError] = useState<string | null>(null);

  // Check health profile status and calculate metrics on mount
  useEffect(() => {
    const checkHealthProfileAndCalculate = async () => {
      try {
        const profileData = await AsyncStorage.getItem('@runstr:health_profile');
        if (profileData) {
          const profile = JSON.parse(profileData);
          setHealthProfileStatus({
            hasHeight: !!profile.height,
            hasWeight: !!profile.weight,
            hasAge: !!profile.age,
          });

          // Calculate metrics if we have the data
          if (profile.height && profile.weight) {
            const metrics: CalculatedMetrics = {};

            // Calculate BMI
            const bmiResult = BodyCompositionAnalytics.calculateBMI(profile.weight, profile.height);
            metrics.bmi = bmiResult;

            // Create health profile for VO2 Max calculation
            const healthProfile: HealthProfile = {
              height: profile.height,
              weight: profile.weight,
              age: profile.age,
              biologicalSex: profile.biologicalSex,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            // Calculate VO2 Max from workouts
            const vo2MaxData = BodyCompositionAnalytics.estimateVO2Max(workouts, healthProfile);
            if (vo2MaxData) {
              metrics.vo2max = {
                estimate: vo2MaxData.estimate,
                category: vo2MaxData.category,
                percentile: vo2MaxData.percentile,
              };

              // Calculate Fitness Age if we have age
              if (profile.age) {
                metrics.fitnessAge = {
                  age: vo2MaxData.fitnessAge,
                  chronologicalAge: profile.age,
                };
              }
            }

            setCalculatedMetrics(metrics);

            // Update the AI context with fresh data
            await RunstrContextGenerator.updateContext();
          }
        } else {
          setHealthProfileStatus({
            hasHeight: false,
            hasWeight: false,
            hasAge: false,
          });
        }
      } catch (err) {
        console.error('[CoachRunstrCard] Failed to check health profile:', err);
      }
    };

    checkHealthProfileAndCalculate();
  }, [workouts]);

  const handlePromptPress = async (type: PromptType) => {
    // Find the button config
    const allPrompts = [...INSIGHT_PROMPTS, ...METRIC_PROMPTS];
    const promptConfig = allPrompts.find(p => p.type === type);

    // Check if this prompt requires health profile data
    if (promptConfig?.requiresHealthProfile) {
      if (!healthProfileStatus.hasHeight || !healthProfileStatus.hasWeight) {
        setSelectedPrompt(type);
        setShowHealthProfilePrompt(true);
        setMissingDataMessage('Height and weight are required. Please configure your Health Profile.');
        setInsight(null);
        return;
      }

      if (promptConfig.requiresAge && !healthProfileStatus.hasAge) {
        setSelectedPrompt(type);
        setShowHealthProfilePrompt(true);
        setMissingDataMessage('Age is required for Fitness Age calculation. Please configure your Health Profile.');
        setInsight(null);
        return;
      }
    }

    setSelectedPrompt(type);
    setShowHealthProfilePrompt(false);
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

  const renderButtonRow = (prompts: PromptButton[]) => (
    <View style={styles.buttonsRow}>
      {prompts.map((prompt) => (
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

  const renderPromptButtons = () => (
    <View style={styles.buttonsContainer}>
      {renderButtonRow(INSIGHT_PROMPTS)}
      {renderButtonRow(METRIC_PROMPTS)}
    </View>
  );

  const renderInsightResult = () => {
    if (loading) {
      return (
        <View style={styles.resultContainer}>
          <ActivityIndicator size="small" color="#FF9D42" />
          <Text style={styles.loadingText}>Analyzing your data...</Text>
        </View>
      );
    }

    // Show health profile prompt if required data is missing
    if (showHealthProfilePrompt) {
      return (
        <View style={styles.resultContainer}>
          <Ionicons
            name="person-outline"
            size={32}
            color="#FF9D42"
            style={{ marginBottom: 12 }}
          />
          <Text style={styles.setupText}>{missingDataMessage}</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('HealthProfile' as never)}
          >
            <Ionicons
              name="body-outline"
              size={16}
              color="#000"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.settingsButtonText}>Go to Health Profile</Text>
          </TouchableOpacity>
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
      // Render metric header for BMI/VO2 Max/Fitness Age
      const renderMetricHeader = () => {
        if (selectedPrompt === 'bmi' && calculatedMetrics.bmi) {
          return (
            <View style={styles.metricHeader}>
              <Text style={styles.metricValue}>{calculatedMetrics.bmi.value}</Text>
              <Text style={styles.metricLabel}>BMI</Text>
              <Text style={styles.metricCategory}>{calculatedMetrics.bmi.category}</Text>
            </View>
          );
        }
        if (selectedPrompt === 'vo2max' && calculatedMetrics.vo2max) {
          return (
            <View style={styles.metricHeader}>
              <Text style={styles.metricValue}>{calculatedMetrics.vo2max.estimate}</Text>
              <Text style={styles.metricLabel}>VO2 Max (ml/kg/min)</Text>
              <Text style={styles.metricCategory}>{calculatedMetrics.vo2max.category} - {calculatedMetrics.vo2max.percentile}th percentile</Text>
            </View>
          );
        }
        if (selectedPrompt === 'fitness_age' && calculatedMetrics.fitnessAge) {
          const diff = calculatedMetrics.fitnessAge.chronologicalAge - calculatedMetrics.fitnessAge.age;
          const diffText = diff > 0 ? `${diff} years younger` : diff < 0 ? `${Math.abs(diff)} years older` : 'Same as actual';
          return (
            <View style={styles.metricHeader}>
              <Text style={styles.metricValue}>{calculatedMetrics.fitnessAge.age}</Text>
              <Text style={styles.metricLabel}>Fitness Age</Text>
              <Text style={styles.metricCategory}>{diffText} than your actual age ({calculatedMetrics.fitnessAge.chronologicalAge})</Text>
            </View>
          );
        }
        return null;
      };

      return (
        <View style={styles.resultContainer}>
          {renderMetricHeader()}
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
        <Ionicons name="sparkles" size={24} color="#FF9D42" />
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
    gap: 8,
    marginBottom: 16,
  },

  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
  },

  promptButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 10,
    paddingHorizontal: 6,
    minHeight: 52,
  },

  promptButtonActive: {
    backgroundColor: '#FF9D42',
    borderColor: '#FF9D42',
  },

  promptButtonText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    textAlign: 'center',
  },

  promptButtonTextActive: {
    color: '#000',
  },

  resultContainer: {
    minHeight: 80,
    justifyContent: 'center',
  },

  metricHeader: {
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },

  metricValue: {
    fontSize: 48,
    fontWeight: theme.typography.weights.bold,
    color: '#FF9D42',
  },

  metricLabel: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    marginTop: 4,
  },

  metricCategory: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: '#FFB366',
    marginTop: 4,
    textTransform: 'capitalize',
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
