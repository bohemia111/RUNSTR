/**
 * SimplifiedChallengeWizard - Running-only challenge creation (3-step flow)
 * Step 1: Select Preset + Opponent → Step 2: Wager + Duration → Step 3: Review & Send
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { theme } from '../../styles/theme';
import { WizardStepContainer, WizardStep } from './WizardStepContainer';
import { CustomAlert } from '../ui/CustomAlert';
import { useUserStore } from '../../store/userStore';
import { DirectNostrProfileService } from '../../services/user/directNostrProfileService';
import UnifiedSigningService from '../../services/auth/UnifiedSigningService';
import type { RunningChallengeDistance } from '../../constants/runningChallengePresets';
import {
  RUNNING_CHALLENGE_PRESETS,
  CHALLENGE_DURATION_OPTIONS,
  getRunningChallengePreset,
} from '../../constants/runningChallengePresets';
import { ChallengeService } from '../../services/competition/ChallengeService';

interface ChallengeData {
  selectedPreset: RunningChallengeDistance | null;
  opponentNpub: string;
  opponentName: string;
  wagerAmount: number;
  duration: '24h' | '48h' | '1week';
  challengeName: string;
}

interface SimplifiedChallengeWizardProps {
  visible: boolean;
  onClose: () => void;
  onChallengeCreated: () => void;
  teamMembers?: Array<{ npub: string; name: string; avatar?: string }>; // Optional team members
}

export const SimplifiedChallengeWizard: React.FC<SimplifiedChallengeWizardProps> = ({
  visible,
  onClose,
  onChallengeCreated,
  teamMembers = [],
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const user = useUserStore((state) => state.user);

  const [challengeData, setChallengeData] = useState<ChallengeData>({
    selectedPreset: null,
    opponentNpub: '',
    opponentName: '',
    wagerAmount: 0,
    duration: '48h',
    challengeName: '',
  });

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<
    Array<{ text: string; onPress?: () => void }>
  >([]);

  // Reset wizard when opened
  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      setChallengeData({
        selectedPreset: null,
        opponentNpub: '',
        opponentName: '',
        wagerAmount: 0,
        duration: '48h',
        challengeName: '',
      });
    }
  }, [visible]);

  // Wizard steps configuration
  const steps: WizardStep[] = [
    {
      id: 'details',
      title: 'Challenge Details',
      isValid: !!challengeData.selectedPreset && challengeData.opponentNpub.length > 0,
    },
    {
      id: 'wager',
      title: 'Wager & Duration',
      isValid: true, // Always valid (wager is optional)
    },
    {
      id: 'review',
      title: 'Review & Send',
      isValid: true,
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    // Get user info
    let currentUser = user;
    if (!currentUser) {
      try {
        currentUser = await DirectNostrProfileService.getCurrentUserProfile();
        if (!currentUser) {
          setAlertTitle('Error');
          setAlertMessage('User not found. Please log in again.');
          setAlertButtons([{ text: 'OK' }]);
          setAlertVisible(true);
          return;
        }
      } catch (error) {
        setAlertTitle('Error');
        setAlertMessage('User not found. Please log in again.');
        setAlertButtons([{ text: 'OK' }]);
        setAlertVisible(true);
        return;
      }
    }

    setIsCreating(true);

    try {
      console.log('🎯 Creating running challenge with kind 30102');

      // Get signer
      const signingService = UnifiedSigningService.getInstance();
      const signer = await signingService.getSigner();

      if (!signer) {
        setAlertTitle('Authentication Required');
        setAlertMessage('Unable to sign challenge. Please ensure you are logged in.');
        setAlertButtons([{ text: 'OK' }]);
        setAlertVisible(true);
        setIsCreating(false);
        return;
      }

      console.log('✅ Signer ready for challenge creation');

      // Get preset
      const preset = getRunningChallengePreset(challengeData.selectedPreset!);
      if (!preset) {
        throw new Error('Invalid preset selected');
      }

      // Get duration in hours
      const durationOption = CHALLENGE_DURATION_OPTIONS.find(
        (opt) => opt.value === challengeData.duration
      );
      const durationHours = durationOption?.hours || 48;

      // Prepare challenge definition data
      const challengeData30102 = {
        name: preset.name,
        distance: preset.distance,
        duration: durationHours,
        wager: challengeData.wagerAmount,
        opponentPubkey: challengeData.opponentNpub,
      };

      console.log('🎯 Publishing kind 30102 challenge:', challengeData30102);

      // Publish challenge using ChallengeService
      const challengeService = ChallengeService.getInstance();
      const result = await challengeService.publishChallengeDefinition(
        challengeData30102,
        signer
      );

      if (result.success) {
        console.log('✅ Challenge published successfully:', result.challengeId);

        // Show success alert
        setAlertTitle('Challenge Published!');
        setAlertMessage(
          `Your ${preset.name} challenge has been published!\n\n${challengeData.opponentName || 'Your opponent'} will be able to see it in their Challenges tab.`
        );
        setAlertButtons([
          {
            text: 'Done',
            onPress: () => {
              setAlertVisible(false);
              onChallengeCreated();
              onClose();
            },
          },
        ]);
        setAlertVisible(true);
      } else {
        throw new Error('Failed to publish challenge');
      }
    } catch (error) {
      console.error('❌ Failed to create challenge:', error);
      setAlertTitle('Error');
      setAlertMessage(
        `Failed to create challenge: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      setAlertButtons([{ text: 'OK' }]);
      setAlertVisible(true);
    } finally {
      setIsCreating(false);
    }
  };

  const selectPreset = (presetId: RunningChallengeDistance) => {
    const preset = getRunningChallengePreset(presetId);
    setChallengeData((prev) => ({
      ...prev,
      selectedPreset: presetId,
      challengeName: preset?.name || '',
    }));
  };

  const selectOpponent = (npub: string, name: string) => {
    setChallengeData((prev) => ({
      ...prev,
      opponentNpub: npub,
      opponentName: name,
    }));
  };

  const updateSettings = (field: keyof ChallengeData, value: any) => {
    setChallengeData((prev) => ({ ...prev, [field]: value }));
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Challenge Details (Preset + Opponent)
        return (
          <ScrollView
            style={styles.stepContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stepDescription}>
              Choose your race distance and opponent
            </Text>

            {/* Race Distance Presets */}
            <Text style={styles.formLabel}>Race Distance</Text>
            <View style={styles.presetsGrid}>
              {RUNNING_CHALLENGE_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.presetCard,
                    challengeData.selectedPreset === preset.id &&
                      styles.presetCardSelected,
                  ]}
                  onPress={() => selectPreset(preset.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.presetName,
                      challengeData.selectedPreset === preset.id &&
                        styles.presetNameSelected,
                    ]}
                  >
                    {preset.name}
                  </Text>
                  <Text style={styles.presetDescription}>
                    {preset.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Opponent Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Challenge Opponent</Text>

              {teamMembers.length > 0 ? (
                <>
                  <Text style={styles.formHelper}>Select a team member:</Text>
                  <View style={styles.teamMembersList}>
                    {teamMembers.map((member) => (
                      <TouchableOpacity
                        key={member.npub}
                        style={[
                          styles.teamMemberCard,
                          challengeData.opponentNpub === member.npub &&
                            styles.teamMemberCardSelected,
                        ]}
                        onPress={() => selectOpponent(member.npub, member.name)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.teamMemberName,
                            challengeData.opponentNpub === member.npub &&
                              styles.teamMemberNameSelected,
                          ]}
                        >
                          {member.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.textInput}
                    value={challengeData.opponentNpub}
                    onChangeText={(text) => updateSettings('opponentNpub', text)}
                    placeholder="Enter opponent's npub or hex pubkey"
                    placeholderTextColor={theme.colors.textMuted}
                  />
                  <Text style={styles.formHelper}>
                    Enter the Nostr public key of the person you want to challenge
                  </Text>
                </>
              )}
            </View>
          </ScrollView>
        );

      case 1: // Wager & Duration
        return (
          <ScrollView
            style={styles.stepContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stepDescription}>
              Set the stakes and challenge duration
            </Text>

            {/* Wager Amount */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Wager Amount</Text>
              <View style={styles.wagerOptions}>
                {[
                  { label: 'Free', value: 0 },
                  { label: '1,000 sats', value: 1000 },
                  { label: '2,100 sats', value: 2100 },
                  { label: '5,000 sats', value: 5000 },
                  { label: '10,000 sats', value: 10000 },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.label}
                    style={[
                      styles.wagerOption,
                      challengeData.wagerAmount === option.value &&
                        styles.wagerOptionSelected,
                    ]}
                    onPress={() => updateSettings('wagerAmount', option.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.wagerOptionText,
                        challengeData.wagerAmount === option.value &&
                          styles.wagerOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {challengeData.wagerAmount > 0 && (
                <Text style={styles.formHelper}>
                  Honor system - winner receives zap from loser
                </Text>
              )}
            </View>

            {/* Duration */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Challenge Duration</Text>
              <View style={styles.durationOptions}>
                {CHALLENGE_DURATION_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.durationOption,
                      challengeData.duration === option.value &&
                        styles.durationOptionSelected,
                    ]}
                    onPress={() => updateSettings('duration', option.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.durationOptionText,
                        challengeData.duration === option.value &&
                          styles.durationOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formHelper}>
                Challenge starts when opponent accepts
              </Text>
            </View>
          </ScrollView>
        );

      case 2: // Review & Send
        const preset = challengeData.selectedPreset
          ? getRunningChallengePreset(challengeData.selectedPreset)
          : null;
        const durationLabel = CHALLENGE_DURATION_OPTIONS.find(
          (opt) => opt.value === challengeData.duration
        )?.label;

        return (
          <ScrollView
            style={styles.stepContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stepDescription}>
              Review your challenge details before sending
            </Text>

            <View style={styles.reviewCard}>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Challenge Type:</Text>
                <Text style={styles.reviewValue}>{preset?.name || 'N/A'}</Text>
              </View>

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Distance:</Text>
                <Text style={styles.reviewValue}>
                  {preset?.distance} {preset?.unit}
                </Text>
              </View>

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Opponent:</Text>
                <Text style={styles.reviewValue}>
                  {challengeData.opponentName || challengeData.opponentNpub.slice(0, 16) + '...'}
                </Text>
              </View>

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Wager:</Text>
                <Text style={[styles.reviewValue, styles.reviewWager]}>
                  {challengeData.wagerAmount === 0
                    ? 'Free'
                    : `${challengeData.wagerAmount.toLocaleString()} sats`}
                </Text>
              </View>

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Duration:</Text>
                <Text style={styles.reviewValue}>{durationLabel}</Text>
              </View>

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Scoring:</Text>
                <Text style={styles.reviewValue}>Fastest Time Wins</Text>
              </View>
            </View>

            <Text style={styles.reviewNote}>
              Your opponent will receive a notification to accept this challenge. The challenge
              begins when they accept.
            </Text>
          </ScrollView>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <WizardStepContainer
        visible={visible}
        currentStep={currentStep}
        steps={steps}
        wizardTitle="Create Challenge"
        onClose={onClose}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onComplete={handleComplete}
        canGoNext={steps[currentStep]?.isValid}
        canGoPrevious={currentStep > 0}
        isLastStep={currentStep === steps.length - 1}
        isProcessing={isCreating}
        processingText="Sending Challenge..."
      >
        {renderStepContent()}
      </WizardStepContainer>

      {/* Custom Alert Modal */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        onClose={() => setAlertVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  stepContent: {
    flex: 1,
  },

  stepDescription: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 24,
    lineHeight: 20,
  },

  // Preset grid styles
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },

  presetCard: {
    flexBasis: '47%',
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 16,
  },

  presetCardSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.background,
  },

  presetName: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 4,
  },

  presetNameSelected: {
    color: theme.colors.accent,
  },

  presetDescription: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },

  // Form styles
  formGroup: {
    marginBottom: 24,
  },

  formLabel: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: 8,
  },

  textInput: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: theme.colors.text,
  },

  formHelper: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },

  // Team members list
  teamMembersList: {
    gap: 8,
    marginTop: 8,
  },

  teamMemberCard: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
  },

  teamMemberCardSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.background,
  },

  teamMemberName: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },

  teamMemberNameSelected: {
    color: theme.colors.accent,
  },

  // Wager options
  wagerOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  wagerOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
  },

  wagerOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.background,
  },

  wagerOptionText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },

  wagerOptionTextSelected: {
    color: theme.colors.accent,
  },

  // Duration options
  durationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  durationOption: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    alignItems: 'center',
  },

  durationOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.background,
  },

  durationOptionText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },

  durationOptionTextSelected: {
    color: theme.colors.accent,
  },

  // Review styles
  reviewCard: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },

  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  reviewLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },

  reviewValue: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },

  reviewWager: {
    color: theme.colors.accent,
  },

  reviewNote: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
  },
});
