/**
 * GlobalChallengeWizard - Simplified 1-day running challenge creation
 * Flow: User Search → Distance → Wager/Time → Instant Creation
 * Creates kind 30102 challenges with both participants instantly (no acceptance needed)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { theme } from '../../styles/theme';
import {
  userDiscoveryService,
  type DiscoveredNostrUser,
} from '../../services/user/UserDiscoveryService';
import { getUserNostrIdentifiers } from '../../utils/nostr';
import { challengeService } from '../../services/competition/ChallengeService';
import {
  RUNNING_CHALLENGE_PRESETS,
  type RunningChallengeDistance,
} from '../../constants/runningChallengePresets';

// Step components
import { UserSearchStep } from './steps/UserSearchStep';

type ChallengeStep = 'user_search' | 'distance' | 'wager_time' | 'success';

interface GlobalChallengeWizardProps {
  onComplete?: () => void;
  onCancel: () => void;
  preselectedOpponent?: DiscoveredNostrUser;
}

interface WizardProgressProps {
  currentStep: ChallengeStep;
}

const WizardProgress: React.FC<WizardProgressProps> = ({ currentStep }) => {
  const steps: ChallengeStep[] = ['user_search', 'distance', 'wager_time'];
  const currentIndex = steps.indexOf(currentStep);

  return (
    <View style={styles.progressContainer}>
      {steps.map((step, index) => (
        <View
          key={step}
          style={[
            styles.progressDot,
            index === currentIndex && styles.progressDotActive,
            index < currentIndex && styles.progressDotCompleted,
          ]}
        />
      ))}
    </View>
  );
};

export const GlobalChallengeWizard: React.FC<GlobalChallengeWizardProps> = ({
  onComplete,
  onCancel,
  preselectedOpponent,
}) => {
  const [currentStep, setCurrentStep] = useState<ChallengeStep>(
    preselectedOpponent ? 'distance' : 'user_search'
  );
  const [selectedUser, setSelectedUser] = useState<DiscoveredNostrUser | undefined>(
    preselectedOpponent
  );
  const [selectedDistance, setSelectedDistance] = useState<RunningChallengeDistance | null>(
    null
  );
  const [wager, setWager] = useState('');
  const [challengeTime, setChallengeTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step validation
  const validateCurrentStep = useCallback((): boolean => {
    switch (currentStep) {
      case 'user_search':
        return !!selectedUser;
      case 'distance':
        return !!selectedDistance;
      case 'wager_time':
        return true; // Wager and time are optional
      default:
        return false;
    }
  }, [currentStep, selectedUser, selectedDistance]);

  // Navigation handlers
  const handleNext = useCallback(async () => {
    if (!validateCurrentStep()) {
      return;
    }

    switch (currentStep) {
      case 'user_search':
        setCurrentStep('distance');
        break;
      case 'distance':
        setCurrentStep('wager_time');
        break;
      case 'wager_time':
        await handleCreateChallenge();
        break;
    }
  }, [currentStep, validateCurrentStep]);

  const handleBack = useCallback(() => {
    switch (currentStep) {
      case 'distance':
        if (!preselectedOpponent) {
          setCurrentStep('user_search');
        }
        break;
      case 'wager_time':
        setCurrentStep('distance');
        break;
    }
  }, [currentStep, preselectedOpponent]);

  const handleCreateChallenge = useCallback(async () => {
    if (!selectedUser || !selectedDistance) {
      Alert.alert('Error', 'Please select an opponent and distance');
      return;
    }

    try {
      setIsSubmitting(true);

      // Get user identifiers
      const userIdentifiers = await getUserNostrIdentifiers();
      if (!userIdentifiers?.hexPubkey || !userIdentifiers?.nsec) {
        throw new Error('User not authenticated');
      }

      // Get challenge preset
      const preset = RUNNING_CHALLENGE_PRESETS.find((p) => p.id === selectedDistance);
      if (!preset) {
        throw new Error('Invalid distance selection');
      }

      // Get signer from nsec
      const { NDKPrivateKeySigner } = await import('@nostr-dev-kit/ndk');
      const signer = new NDKPrivateKeySigner(userIdentifiers.nsec);

      // Create challenge via ChallengeService
      const result = await challengeService.publishChallengeDefinition(
        {
          name: `${preset.name} Challenge`,
          distance: preset.distance,
          duration: 24, // Always 24 hours (1 day)
          wager: parseInt(wager) || 0,
          opponentPubkey: selectedUser.pubkey,
        },
        signer
      );

      if (!result.success) {
        throw new Error('Failed to create challenge');
      }

      // Add to recent challengers
      await userDiscoveryService.addRecentChallenger(selectedUser.pubkey);

      // Show success
      setCurrentStep('success');

      console.log(`Challenge created: ${result.challengeId}`);
    } catch (error) {
      console.error('Failed to create challenge:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred';

      Alert.alert('Challenge Creation Failed', errorMessage, [
        {
          text: 'Try Again',
          onPress: () => setIsSubmitting(false),
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            setIsSubmitting(false);
            onCancel();
          },
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedUser, selectedDistance, wager, challengeTime, onCancel]);

  const canGoBack =
    currentStep !== 'user_search' &&
    currentStep !== 'success' &&
    !(currentStep === 'distance' && preselectedOpponent);
  const isValid = validateCurrentStep();
  const showActionButton = currentStep !== 'success';

  return (
    <SafeAreaView style={styles.container}>
      {currentStep !== 'success' && (
        <>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={[styles.headerButton, !canGoBack && styles.headerButtonDisabled]}
              onPress={handleBack}
              disabled={!canGoBack}
            >
              <Text
                style={[
                  styles.headerButtonText,
                  !canGoBack && styles.headerButtonTextDisabled,
                ]}
              >
                ←
              </Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>New Challenge</Text>

            <TouchableOpacity style={styles.headerButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Progress Indicator */}
          <WizardProgress currentStep={currentStep} />
        </>
      )}

      {/* Step Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {currentStep === 'user_search' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Find Opponent</Text>
            <Text style={styles.stepSubtitle}>Search any Nostr user globally</Text>
            <UserSearchStep
              selectedUser={selectedUser}
              onSelectUser={setSelectedUser}
            />
          </View>
        )}

        {currentStep === 'distance' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Choose Distance</Text>
            <Text style={styles.stepSubtitle}>
              1-day challenge, fastest time wins
            </Text>

            <View style={styles.distanceGrid}>
              {RUNNING_CHALLENGE_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.distanceCard,
                    selectedDistance === preset.id && styles.distanceCardSelected,
                  ]}
                  onPress={() => setSelectedDistance(preset.id)}
                >
                  <Text style={styles.distanceName}>{preset.name}</Text>
                  <Text style={styles.distanceValue}>
                    {preset.distance} {preset.unit}
                  </Text>
                  <Text style={styles.distanceDescription}>
                    {preset.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {currentStep === 'wager_time' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Wager & Time</Text>
            <Text style={styles.stepSubtitle}>
              Optional: Set wager amount and challenge time
            </Text>

            {selectedUser && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Challenging</Text>
                <Text style={styles.summaryValue}>
                  {selectedUser.displayName || selectedUser.name || 'Unknown'}
                </Text>

                <Text style={[styles.summaryLabel, { marginTop: 12 }]}>
                  Distance
                </Text>
                <Text style={styles.summaryValue}>
                  {
                    RUNNING_CHALLENGE_PRESETS.find((p) => p.id === selectedDistance)
                      ?.name
                  }
                </Text>
              </View>
            )}

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>
                Wager Amount (sats) <Text style={styles.optional}>Optional</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 2100"
                placeholderTextColor={theme.colors.textMuted}
                value={wager}
                onChangeText={setWager}
                keyboardType="numeric"
              />
              <Text style={styles.inputHint}>
                Social agreement only - not enforced by app
              </Text>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>
                Challenge Time <Text style={styles.optional}>Optional</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 08:00"
                placeholderTextColor={theme.colors.textMuted}
                value={challengeTime}
                onChangeText={setChallengeTime}
              />
              <Text style={styles.inputHint}>
                Suggested time for the run (24-hour format)
              </Text>
            </View>
          </View>
        )}

        {currentStep === 'success' && (
          <View style={styles.successContainer}>
            <Text style={styles.successTitle}>Challenge Created! ⚡</Text>
            <Text style={styles.successMessage}>
              Your challenge has been sent to{' '}
              {selectedUser?.displayName || selectedUser?.name || 'your opponent'}.
            </Text>
            <Text style={styles.successMessage}>
              They've been added to the challenge automatically. Both of you have 24
              hours to complete the run!
            </Text>

            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => {
                onComplete?.();
                onCancel();
              }}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Action Button */}
      {showActionButton && (
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[
              styles.nextButton,
              (!isValid || isSubmitting) && styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={theme.colors.accentText} />
            ) : (
              <Text
                style={[
                  styles.nextButtonText,
                  (!isValid || isSubmitting) && styles.nextButtonTextDisabled,
                ]}
              >
                {currentStep === 'wager_time' ? 'Create Challenge' : 'Next'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerButton: {
    padding: 4,
  },
  headerButtonDisabled: {
    opacity: 0.3,
  },
  headerButtonText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  headerButtonTextDisabled: {
    color: theme.colors.textMuted,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  cancelButtonText: {
    fontSize: 16,
    color: theme.colors.textMuted,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.buttonBorder,
  },
  progressDotActive: {
    backgroundColor: theme.colors.text,
    width: 24,
    borderRadius: 4,
  },
  progressDotCompleted: {
    backgroundColor: theme.colors.textMuted,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  stepSubtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  distanceGrid: {
    gap: 12,
  },
  distanceCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  distanceCardSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.cardPressed,
  },
  distanceName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  distanceValue: {
    fontSize: 14,
    color: theme.colors.accent,
    fontWeight: '600',
    marginBottom: 8,
  },
  distanceDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 24,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '600',
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  optional: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '400',
  },
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.colors.text,
  },
  inputHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 8,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  doneButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginTop: 32,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.accentText,
  },
  actionSection: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 20,
  },
  nextButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: theme.colors.buttonBorder,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.accentText,
  },
  nextButtonTextDisabled: {
    color: theme.colors.accentText,
  },
});
