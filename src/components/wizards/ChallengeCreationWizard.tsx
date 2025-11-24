/**
 * ChallengeCreationWizard - Simplified 3-step challenge creation
 * Step 1: Choose challenge type + duration + wager
 * Step 2: Choose Direct (pick opponent) OR QR (share with anyone)
 * Step 3a: If Direct - Select opponent
 * Step 3b: If QR - Show QR code with sharing options
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
  ScrollView,
  TextInput,
} from 'react-native';
import { theme } from '../../styles/theme';
import type { SimpleChallengeType } from '../../constants/simpleChallengePresets';
import {
  SIMPLE_CHALLENGE_TYPES,
  DURATION_OPTIONS,
  getChallengeName,
} from '../../constants/simpleChallengePresets';
import {
  ChallengeTargetStep,
  type ChallengeTarget,
} from './steps/ChallengeTargetStep';
import { ChooseOpponentStep } from './steps/ChooseOpponentStep';
import { ChallengeQRStep } from './steps/ChallengeQRStep';
import type { TeammateInfo, ChallengeCreationData } from '../../types';
import { useChallengeCreation } from '../../hooks/useChallengeCreation';
import type { ChallengeDeepLinkData } from '../../utils/challengeDeepLink';

type WizardStep = 'type_config' | 'target' | 'opponent' | 'qr' | 'success';

export interface ChallengeCreationWizardProps {
  onComplete?: (challengeData: ChallengeCreationData) => void;
  onCancel: () => void;
  teammates?: TeammateInfo[];
  currentUser?: any;
  teamId?: string;
}

interface ChallengeFormData {
  type?: SimpleChallengeType;
  duration: 1 | 7 | 30;
  wager: number;
  target?: ChallengeTarget;
  opponentId?: string;
  opponentInfo?: TeammateInfo;
  challengeId?: string;
}

export const ChallengeCreationWizard: React.FC<
  ChallengeCreationWizardProps
> = ({
  onComplete,
  onCancel,
  teammates: providedTeammates,
  currentUser,
  teamId,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('type_config');
  const [formData, setFormData] = useState<ChallengeFormData>({
    duration: 7,
    wager: 0,
  });

  // Use challenge creation hook
  const {
    teammates: hookTeammates,
    isLoading,
    error,
    createChallenge,
    clearError,
  } = useChallengeCreation({
    currentUser,
    teamId,
    onComplete,
  });

  const teammates = providedTeammates || hookTeammates;

  // Step validation
  const canProceed = useCallback((): boolean => {
    switch (currentStep) {
      case 'type_config':
        return !!formData.type;
      case 'target':
        return !!formData.target;
      case 'opponent':
        return !!formData.opponentId;
      case 'qr':
      case 'success':
        return true;
      default:
        return false;
    }
  }, [currentStep, formData]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (!canProceed()) {
      return;
    }

    switch (currentStep) {
      case 'type_config':
        setCurrentStep('target');
        break;
      case 'target':
        if (formData.target === 'direct') {
          setCurrentStep('opponent');
        } else {
          // QR flow - generate challenge ID and show QR
          const challengeId = `challenge-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          setFormData((prev) => ({ ...prev, challengeId }));
          setCurrentStep('qr');
        }
        break;
      case 'opponent':
        handleCreateDirectChallenge();
        break;
    }
  }, [currentStep, formData, canProceed]);

  const handleBack = useCallback(() => {
    clearError();
    switch (currentStep) {
      case 'target':
        setCurrentStep('type_config');
        break;
      case 'opponent':
      case 'qr':
        setCurrentStep('target');
        break;
    }
  }, [currentStep, clearError]);

  const handleCreateDirectChallenge = async () => {
    if (!formData.type || !formData.opponentId) {
      Alert.alert('Error', 'Please select challenge type and opponent');
      return;
    }

    try {
      const challengeData: ChallengeCreationData = {
        type: formData.type,
        duration: formData.duration,
        wager: formData.wager,
        opponentId: formData.opponentId,
        opponentInfo: formData.opponentInfo,
      };

      await createChallenge(challengeData);
      setCurrentStep('success');
    } catch (error) {
      console.error('Failed to create challenge:', error);
      Alert.alert(
        'Challenge Creation Failed',
        error instanceof Error ? error.message : 'An error occurred'
      );
    }
  };

  const updateFormData = useCallback((updates: Partial<ChallengeFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Prepare QR challenge data
  const getQRChallengeData = (): ChallengeDeepLinkData | null => {
    if (!formData.type || !formData.challengeId || !currentUser) {
      return null;
    }

    return {
      type: formData.type,
      duration: formData.duration,
      wager: formData.wager,
      creatorPubkey: currentUser.id || currentUser.npub || '',
      creatorName: currentUser.name || 'Unknown',
      challengeId: formData.challengeId,
    };
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'type_config':
        return (
          <ScrollView
            style={styles.stepContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stepTitle}>Create Challenge</Text>
            <Text style={styles.stepSubtitle}>
              Choose challenge type and settings
            </Text>

            {/* Challenge Type Selection */}
            <Text style={styles.sectionLabel}>Challenge Type</Text>
            <View style={styles.typeGrid}>
              {SIMPLE_CHALLENGE_TYPES.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.typeCard,
                    formData.type === preset.id && styles.typeCardSelected,
                  ]}
                  onPress={() => updateFormData({ type: preset.id })}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.typeName,
                      formData.type === preset.id && styles.typeNameSelected,
                    ]}
                  >
                    {preset.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Duration Selection */}
            <Text style={styles.sectionLabel}>Duration</Text>
            <View style={styles.durationOptions}>
              {DURATION_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.durationOption,
                    formData.duration === option.value &&
                      styles.durationOptionSelected,
                  ]}
                  onPress={() => updateFormData({ duration: option.value })}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.durationOptionText,
                      formData.duration === option.value &&
                        styles.durationOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Wager Input */}
            <Text style={styles.sectionLabel}>Wager (optional)</Text>
            <TextInput
              style={styles.wagerInput}
              value={formData.wager.toString()}
              onChangeText={(text) =>
                updateFormData({ wager: parseInt(text) || 0 })
              }
              placeholder="0 sats"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
            />
            {formData.wager > 0 && (
              <Text style={styles.wagerHelper}>
                Loser pays {formData.wager} sats to winner (trust-based)
              </Text>
            )}
          </ScrollView>
        );

      case 'target':
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>How to Send Challenge?</Text>
            <Text style={styles.stepSubtitle}>
              Challenge specific person or share with QR code
            </Text>
            <ChallengeTargetStep
              selectedTarget={formData.target}
              onSelectTarget={(target) => updateFormData({ target })}
            />
          </View>
        );

      case 'opponent':
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Choose Opponent</Text>
            <Text style={styles.stepSubtitle}>
              Select teammate to challenge
            </Text>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.text} />
                <Text style={styles.loadingText}>Loading teammates...</Text>
              </View>
            ) : (
              <ChooseOpponentStep
                teammates={teammates}
                selectedOpponentId={formData.opponentId}
                onSelectOpponent={(teammate) => {
                  updateFormData({
                    opponentId: teammate.id,
                    opponentInfo: teammate,
                  });
                }}
              />
            )}
          </View>
        );

      case 'qr':
        const qrData = getQRChallengeData();
        if (!qrData) {
          return (
            <Text style={styles.errorText}>
              Failed to generate QR code data
            </Text>
          );
        }
        return (
          <ChallengeQRStep
            challengeData={qrData}
            onDone={() => {
              // Close wizard
              if (onComplete) {
                onComplete({} as any);
              }
              onCancel();
            }}
          />
        );

      case 'success':
        return (
          <View style={styles.successContainer}>
            <Text style={styles.successTitle}>Challenge Created!</Text>
            <Text style={styles.successMessage}>
              Your challenge has been sent successfully
            </Text>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => {
                if (onComplete) {
                  onComplete({} as any);
                }
                onCancel();
              }}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  const canGoBack =
    currentStep !== 'type_config' &&
    currentStep !== 'success' &&
    currentStep !== 'qr';
  const showNextButton = currentStep !== 'qr' && currentStep !== 'success';

  return (
    <SafeAreaView style={styles.container}>
      {currentStep !== 'success' && currentStep !== 'qr' && (
        <>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={[
                styles.headerButton,
                !canGoBack && styles.headerButtonDisabled,
              ]}
              onPress={handleBack}
              disabled={!canGoBack}
            >
              <Text
                style={[
                  styles.headerButtonText,
                  !canGoBack && styles.headerButtonTextDisabled,
                ]}
              >
                Back
              </Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>New Challenge</Text>

            <TouchableOpacity style={styles.headerButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Progress Dots */}
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressDot,
                currentStep === 'type_config' && styles.progressDotActive,
              ]}
            />
            <View
              style={[
                styles.progressDot,
                currentStep === 'target' && styles.progressDotActive,
              ]}
            />
            <View
              style={[
                styles.progressDot,
                (currentStep === 'opponent' || currentStep === 'qr') &&
                  styles.progressDotActive,
              ]}
            />
          </View>
        </>
      )}

      {/* Step Content */}
      <View style={styles.content}>{renderStepContent()}</View>

      {/* Next Button */}
      {showNextButton && (
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[
              styles.nextButton,
              (!canProceed() || isLoading) && styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={!canProceed() || isLoading}
          >
            {isLoading && currentStep === 'opponent' ? (
              <ActivityIndicator size="small" color={theme.colors.accentText} />
            ) : (
              <Text
                style={[
                  styles.nextButtonText,
                  (!canProceed() || isLoading) && styles.nextButtonTextDisabled,
                ]}
              >
                {currentStep === 'opponent' ? 'Create Challenge' : 'Next'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
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
    minWidth: 60,
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
    textAlign: 'right',
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
    backgroundColor: theme.colors.accent,
    width: 24,
  },
  content: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 20,
    marginBottom: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  typeCard: {
    flexBasis: '47%',
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 16,
  },
  typeCardSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.background,
  },
  typeName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  typeNameSelected: {
    color: theme.colors.accent,
  },
  durationOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  durationOption: {
    flex: 1,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  durationOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.background,
  },
  durationOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  durationOptionTextSelected: {
    color: theme.colors.accent,
  },
  wagerInput: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
  },
  wagerHelper: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
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
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.accentText,
  },
  nextButtonTextDisabled: {
    color: theme.colors.textMuted,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  doneButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.accentText,
  },
  errorContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.prizeBackground,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.error,
    textAlign: 'center',
  },
});
