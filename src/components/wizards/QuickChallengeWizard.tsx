/**
 * QuickChallengeWizard - Streamlined challenge creation with preselected opponent
 * Used when tapping challenge icon next to usernames
 * 5-step flow: Activity → Metric → Duration → Wager → Review & Send
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
} from 'react-native';
import { theme } from '../../styles/theme';
import { challengeRequestService } from '../../services/challenge/ChallengeRequestService';
import { getUserNostrIdentifiers } from '../../utils/nostr';
import UnifiedSigningService from '../../services/auth/UnifiedSigningService';
import type {
  ActivityType,
  MetricType,
  DurationOption,
} from '../../types/challenge';
import type { DiscoveredNostrUser } from '../../services/user/UserDiscoveryService';

// Step components
import { SelectActivityStep } from './steps/SelectActivityStep';
import { SelectMetricStep } from './steps/SelectMetricStep';
import { SelectDurationStep } from './steps/SelectDurationStep';
import { SelectWagerStep } from './steps/SelectWagerStep';
import { ChallengeReviewStep } from './steps/ChallengeReviewStep';

type QuickChallengeStep =
  | 'select_activity'
  | 'select_metric'
  | 'select_duration'
  | 'select_wager'
  | 'review';

export interface QuickChallengeWizardProps {
  opponent:
    | DiscoveredNostrUser
    | {
        pubkey: string;
        name: string;
        displayName?: string;
        picture?: string;
        npub?: string;
      };
  onComplete: () => void;
  onCancel: () => void;
}

interface WizardProgressProps {
  currentStep: QuickChallengeStep;
}

const WizardProgress: React.FC<WizardProgressProps> = ({ currentStep }) => {
  const steps: QuickChallengeStep[] = [
    'select_activity',
    'select_metric',
    'select_duration',
    'select_wager',
    'review',
  ];
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

export const QuickChallengeWizard: React.FC<QuickChallengeWizardProps> = ({
  opponent,
  onComplete,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] =
    useState<QuickChallengeStep>('select_activity');
  const [activityType, setActivityType] = useState<ActivityType | undefined>();
  const [metric, setMetric] = useState<MetricType | undefined>();
  const [duration, setDuration] = useState<DurationOption | undefined>();
  const [wagerAmount, setWagerAmount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lightningAddress, setLightningAddress] = useState('');

  // Normalize opponent data to DiscoveredNostrUser format
  const normalizedOpponent: DiscoveredNostrUser = {
    pubkey: opponent.pubkey,
    npub: opponent.npub || opponent.pubkey,
    name: opponent.name,
    displayName: opponent.displayName,
    picture: opponent.picture,
    activityStatus: 'active' as const,
  };

  // Step validation
  const validateCurrentStep = useCallback((): boolean => {
    switch (currentStep) {
      case 'select_activity':
        return !!activityType;
      case 'select_metric':
        return !!metric;
      case 'select_duration':
        return !!duration;
      case 'select_wager':
        return wagerAmount !== undefined;
      case 'review':
        // Require Lightning address for paid challenges
        return wagerAmount === 0 || !!lightningAddress?.trim();
      default:
        return false;
    }
  }, [currentStep, activityType, metric, duration, wagerAmount, lightningAddress]);

  // Navigation handlers
  const handleNext = useCallback(async () => {
    if (!validateCurrentStep()) {
      return;
    }

    switch (currentStep) {
      case 'select_activity':
        setCurrentStep('select_metric');
        break;
      case 'select_metric':
        setCurrentStep('select_duration');
        break;
      case 'select_duration':
        setCurrentStep('select_wager');
        break;
      case 'select_wager':
        setCurrentStep('review');
        break;
      case 'review':
        await handleSendChallenge();
        break;
    }
  }, [currentStep, validateCurrentStep, handleSendChallenge]);

  const handleBack = useCallback(() => {
    switch (currentStep) {
      case 'select_metric':
        setCurrentStep('select_activity');
        break;
      case 'select_duration':
        setCurrentStep('select_metric');
        break;
      case 'select_wager':
        setCurrentStep('select_duration');
        break;
      case 'review':
        setCurrentStep('select_wager');
        break;
    }
  }, [currentStep]);

  /**
   * Send challenge request with Lightning address
   */
  const handleSendChallenge = useCallback(async () => {
    if (
      !activityType ||
      !metric ||
      duration === undefined ||
      wagerAmount === undefined
    ) {
      Alert.alert('Error', 'Please complete all required fields');
      return;
    }

    try {
      setIsSubmitting(true);

      // Get user identifiers
      const userIdentifiers = await getUserNostrIdentifiers();
      if (!userIdentifiers?.hexPubkey) {
        throw new Error('User not authenticated');
      }

      // Get signer from UnifiedSigningService (works for both nsec and Amber)
      const signer = await UnifiedSigningService.getInstance().getSigner();
      if (!signer) {
        throw new Error(
          'Cannot access signing capability. Please ensure you are logged in.'
        );
      }

      // Create challenge request with actual Nostr publishing
      const result = await challengeRequestService.createChallengeRequest(
        {
          challengedPubkey: opponent.pubkey,
          activityType: activityType,
          metric: metric,
          duration: duration,
          wagerAmount: wagerAmount,
          creatorLightningAddress: lightningAddress || undefined,
        },
        signer
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to send challenge');
      }

      console.log(`✅ Challenge sent successfully: ${result.challengeId}`);

      // Show success and close
      Alert.alert(
        'Challenge Sent!',
        `Your challenge has been sent to ${opponent.name || 'your opponent'}`,
        [
          {
            text: 'OK',
            onPress: () => {
              onComplete();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Failed to send challenge:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred';

      Alert.alert('Challenge Failed', errorMessage, [
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
  }, [opponent, activityType, metric, duration, wagerAmount, lightningAddress, onComplete, onCancel]);

  const handleEditConfiguration = () => {
    setCurrentStep('select_activity');
  };

  const canGoBack = currentStep !== 'select_activity';
  const isValid = validateCurrentStep();

  // Get opponent display name
  const opponentName = opponent.displayName || opponent.name || 'Opponent';

  return (
    <SafeAreaView style={styles.container}>
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
            ←
          </Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          Challenge {opponentName}
        </Text>

        <TouchableOpacity style={styles.headerButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Indicator */}
      <WizardProgress currentStep={currentStep} />

      {/* Step Content */}
      <View style={styles.content}>
        {currentStep === 'select_activity' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Select Activity</Text>
            <Text style={styles.stepSubtitle}>
              Choose the activity type for your challenge
            </Text>
            <SelectActivityStep
              selectedActivity={activityType}
              onSelectActivity={setActivityType}
            />
          </View>
        )}

        {currentStep === 'select_metric' && activityType && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Select Metric</Text>
            <Text style={styles.stepSubtitle}>
              Choose what to compete on
            </Text>
            <SelectMetricStep
              activityType={activityType}
              selectedMetric={metric}
              onSelectMetric={setMetric}
            />
          </View>
        )}

        {currentStep === 'select_duration' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Select Duration</Text>
            <Text style={styles.stepSubtitle}>
              How long should the challenge last?
            </Text>
            <SelectDurationStep
              selectedDuration={duration}
              onSelectDuration={setDuration}
            />
          </View>
        )}

        {currentStep === 'select_wager' && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Select Wager</Text>
            <Text style={styles.stepSubtitle}>
              Choose the wager amount in sats
            </Text>
            <SelectWagerStep
              wagerAmount={wagerAmount}
              onSelectWager={setWagerAmount}
            />
          </View>
        )}

        {currentStep === 'review' && activityType && metric && duration !== undefined && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Review Challenge</Text>
            <Text style={styles.stepSubtitle}>
              Confirm details before sending
            </Text>
            <ChallengeReviewStep
              opponent={normalizedOpponent}
              configuration={{
                activityType,
                metric,
                duration,
                wagerAmount,
              }}
              lightningAddress={lightningAddress}
              onLightningAddressChange={setLightningAddress}
              onEditConfiguration={handleEditConfiguration}
            />
          </View>
        )}
      </View>

      {/* Action Button */}
      {currentStep !== 'payment' && (
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
                {currentStep === 'review' ? 'Send Challenge' : 'Next'}
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
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
  actionSection: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
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
