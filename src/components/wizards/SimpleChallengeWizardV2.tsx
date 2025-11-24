/**
 * SimpleChallengeWizardV2 - Single-page challenge creation
 *
 * Matches SimpleEventWizardV2 structure exactly:
 * - All fields on one screen
 * - Two footer buttons: "Post to Social Feed" (left) + "Finished" (right)
 * - No payments/wagering
 * - Publishes kind 30102 with participant 'p' tags
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from 'react-native';
import { theme } from '../../styles/theme';
import { CustomAlert } from '../ui/CustomAlert';
import { ChallengeAnnouncementCardGenerator } from '../../services/nostr/challengeAnnouncementCardGenerator';
import { useUserStore } from '../../store/userStore';
import { DirectNostrProfileService } from '../../services/user/directNostrProfileService';
import UnifiedSigningService from '../../services/auth/UnifiedSigningService';
import { GlobalNDKService } from '../../services/nostr/GlobalNDKService';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { WorkoutCardRenderer } from '../cards/WorkoutCardRenderer';
import { ImageUploadService } from '../../services/media/ImageUploadService';
import { captureRef } from 'react-native-view-shot';
import nostrTeamService from '../../services/nostr/NostrTeamService';

// Challenge Preset Interface
interface ChallengePreset {
  id: string;
  name: string;
  distance: number; // km
  emoji: string;
}

// 3 Running Challenge Presets (matching event wizard)
const CHALLENGE_PRESETS: ChallengePreset[] = [
  {
    id: '5k',
    name: '5K Race',
    emoji: '',
    distance: 5,
  },
  {
    id: '10k',
    name: '10K Race',
    emoji: '',
    distance: 10,
  },
  {
    id: 'half-marathon',
    name: 'Half Marathon',
    emoji: '',
    distance: 21.1,
  },
];

// Form Data Interface (all fields in one place!)
interface ChallengeFormData {
  selectedPreset: ChallengePreset | null;
  challengeName: string;
  description: string;
  opponentPubkey: string; // Required
  opponentName: string; // For display and @ mentions
  challengeDate: Date | null;
  challengeTime: string;
  isRecurring: boolean;
  recurrenceDay:
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday'
    | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  teamId?: string; // Optional - will use default if not provided
  preSelectedOpponent?: {
    pubkey: string;
    name: string;
  };
}

export const SimpleChallengeWizardV2: React.FC<Props> = ({
  visible,
  onClose,
  teamId,
  preSelectedOpponent,
}) => {
  const { user } = useUserStore();

  // All form state in one object (no steps, no navigation!)
  const [formData, setFormData] = useState<ChallengeFormData>({
    selectedPreset: null,
    challengeName: '',
    description: '',
    opponentPubkey: preSelectedOpponent?.pubkey || '',
    opponentName: preSelectedOpponent?.name || '',
    challengeDate: null,
    challengeTime: '09:00',
    isRecurring: false,
    recurrenceDay: null,
  });

  const [isPublishingChallenge, setIsPublishingChallenge] = useState(false);
  const [isPublishingSocial, setIsPublishingSocial] = useState(false);
  const [generatedChallengeId, setGeneratedChallengeId] = useState<
    string | null
  >(null);

  // Track which actions have been completed
  const [publishedSuccessfully, setPublishedSuccessfully] = useState(false);
  const [postedSuccessfully, setPostedSuccessfully] = useState(false);

  // CustomAlert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<
    Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }>
  >([]);

  // Card renderer ref and state for image upload
  const cardRendererRef = useRef<View>(null);
  const [generatedSVG, setGeneratedSVG] = useState<string | null>(null);

  // Reset alert state when wizard opens
  useEffect(() => {
    if (visible) {
      setAlertVisible(false);
      setAlertTitle('');
      setAlertMessage('');
      setAlertButtons([]);

      // Pre-populate opponent if provided
      if (preSelectedOpponent) {
        setFormData((prev) => ({
          ...prev,
          opponentPubkey: preSelectedOpponent.pubkey,
          opponentName: preSelectedOpponent.name,
        }));
      }
    }
  }, [visible, preSelectedOpponent]);

  // Validation: Enable buttons only when required fields are filled
  const isFormValid = !!(
    formData.selectedPreset &&
    formData.challengeName.trim().length > 0 &&
    formData.opponentPubkey.trim().length > 0 &&
    formData.challengeDate &&
    (formData.isRecurring ? formData.recurrenceDay : true)
  );

  // Helper to update any field in formData
  const updateField = <K extends keyof ChallengeFormData>(
    field: K,
    value: ChallengeFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Select a preset (5K/10K/Half Marathon)
  const selectPreset = (preset: ChallengePreset) => {
    setFormData((prev) => ({
      ...prev,
      selectedPreset: preset,
      challengeName: `${preset.name} Challenge`, // Auto-fill challenge name
    }));
  };

  // Generate quick date options (Today, Tomorrow, This Weekend, Next Week)
  const getQuickDateOptions = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const thisWeekend = new Date(today);
    const currentDay = today.getDay();
    if (currentDay !== 0 && currentDay !== 6) {
      const daysUntilSaturday = 6 - currentDay;
      thisWeekend.setDate(today.getDate() + daysUntilSaturday);
    }

    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    return [
      { label: 'Today', date: today },
      { label: 'Tomorrow', date: tomorrow },
      {
        label:
          currentDay === 0 || currentDay === 6
            ? 'This Weekend (Today)'
            : 'This Weekend',
        date: thisWeekend,
      },
      { label: 'Next Week', date: nextWeek },
    ];
  };

  // Publish Challenge to Nostr (kind 30102 only)
  const handlePublishChallenge = async () => {
    if (!isFormValid || !formData.selectedPreset || !formData.challengeDate)
      return;

    try {
      setIsPublishingChallenge(true);
      console.log('🚀 Starting challenge publishing flow...');

      // Get current user
      let currentUser = user;
      if (!currentUser) {
        currentUser = await DirectNostrProfileService.getCurrentUserProfile();
        if (!currentUser) {
          setAlertTitle('Error');
          setAlertMessage('User not found. Please log in again.');
          setAlertButtons([{ text: 'OK', style: 'destructive' }]);
          setAlertVisible(true);
          return;
        }
      }

      // Get signer
      const signingService = UnifiedSigningService.getInstance();
      const signer = await signingService.getSigner();
      if (!signer) {
        setAlertTitle('Authentication Required');
        setAlertMessage(
          'Unable to sign challenge. Please ensure you are logged in.'
        );
        setAlertButtons([{ text: 'OK', style: 'destructive' }]);
        setAlertVisible(true);
        return;
      }

      // Combine challenge date and time
      const challengeDateTime = new Date(formData.challengeDate);
      const [hours, minutes] = formData.challengeTime.split(':').map(Number);
      challengeDateTime.setHours(hours, minutes, 0, 0);

      // Generate challenge ID
      const timestamp = Math.floor(Date.now() / 1000).toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      const sanitizedName = formData.challengeName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 10);
      const challengeId = `challenge_${sanitizedName}_${timestamp}_${random}`;

      // Store challenge ID for social posting
      setGeneratedChallengeId(challengeId);
      console.log(`📝 Generated challenge ID: ${challengeId}`);

      // Get creator pubkey
      const ndkUser = await signer.user();
      const creatorPubkey = ndkUser?.pubkey || '';
      if (!creatorPubkey) {
        throw new Error('No pubkey available from signer');
      }

      // Calculate duration (default 24 hours for now)
      const durationHours = 24;

      // Build kind 30102 event
      const ndk = await GlobalNDKService.getInstance();
      const event = new NDKEvent(ndk);
      event.kind = 30102;
      event.content =
        formData.description || `${formData.challengeName} - ${durationHours}h`;

      const tags: string[][] = [
        ['d', challengeId],
        ['name', formData.challengeName],
        ['activity', 'running'],
        ['distance', formData.selectedPreset.distance.toString()],
        ['metric', 'fastest_time'],
        ['duration', durationHours.toString()],
        ['start_date', challengeDateTime.toISOString()],
        ['event_date', challengeDateTime.toISOString()], // For consistency with events
        ['event_time', formData.challengeTime],
        ['max_participants', '2'],
        ['status', 'open'],
        ['p', creatorPubkey], // Creator (first p tag = challenger)
        ['p', formData.opponentPubkey], // Opponent (second p tag = challenged)
      ];

      // Add recurring tags if enabled
      if (formData.isRecurring && formData.recurrenceDay) {
        tags.push(['recurrence', 'weekly']);
        tags.push(['recurrence_day', formData.recurrenceDay]);
      }

      event.tags = tags;

      console.log('✍️ Signing kind 30102 challenge event...');
      await event.sign(signer);

      console.log('📡 Publishing challenge to Nostr...');
      const publishResult = await event.publish();
      const relayUrls = Array.from(publishResult);

      console.log(`✅ Published to ${relayUrls.length} relay(s):`);
      relayUrls.forEach((relay) => {
        console.log(`   ✅ ${relay.url || 'Unknown relay'}`);
      });

      if (relayUrls.length === 0) {
        throw new Error('No relays accepted the challenge');
      }

      setPublishedSuccessfully(true);

      // Show success alert
      setAlertTitle('Challenge Created!');
      setAlertMessage(
        `Your challenge to ${formData.opponentName} has been created on Nostr!`
      );
      setAlertButtons([{ text: 'OK', style: 'default' }]);
      setAlertVisible(true);

      console.log('🎉 Challenge published successfully!');
    } catch (error) {
      console.error('❌ Failed to publish challenge:', error);

      setAlertTitle('Error');
      setAlertMessage(
        `Failed to publish challenge: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      setAlertButtons([{ text: 'OK', style: 'destructive' }]);
      setAlertVisible(true);
    } finally {
      setIsPublishingChallenge(false);
      console.log('🏁 Challenge publishing flow completed');
    }
  };

  // Post to Social Feed (kind 1 announcement with SVG card + @ mention)
  const handlePostToSocial = async () => {
    console.log('📱 handlePostToSocial: Starting...');
    if (!isFormValid || !formData.selectedPreset || !formData.challengeDate) {
      console.log('⚠️ handlePostToSocial: Form validation failed');
      return;
    }

    try {
      console.log('📱 handlePostToSocial: Form valid, proceeding...');
      setIsPublishingSocial(true);

      // Get signer
      console.log('🔐 Getting signer...');
      const signingService = UnifiedSigningService.getInstance();
      const signer = await signingService.getSigner();
      if (!signer) {
        console.log('❌ No signer available');
        setAlertTitle('Authentication Required');
        setAlertMessage('Unable to sign post.');
        setAlertButtons([{ text: 'OK', style: 'destructive' }]);
        setAlertVisible(true);
        return;
      }
      console.log('✅ Signer obtained');

      // Get creator pubkey
      const ndkUser = await signer.user();
      const creatorPubkey = ndkUser?.pubkey || '';
      if (!creatorPubkey) {
        throw new Error('No pubkey available from signer');
      }

      // Get team info (use fallback if no teamId provided)
      const actualTeamId = teamId || 'general';
      console.log('🏆 Getting team info for teamId:', actualTeamId);
      const team = nostrTeamService.getTeamById(actualTeamId);
      console.log('🏆 Team info:', team ? team.name : 'NOT FOUND');

      // Generate challenge ID if not already generated
      let challengeId = generatedChallengeId;
      if (!challengeId) {
        const timestamp = Math.floor(Date.now() / 1000).toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        const sanitizedName = formData.challengeName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .substring(0, 10);
        challengeId = `challenge_${sanitizedName}_${timestamp}_${random}`;
        setGeneratedChallengeId(challengeId);
      }

      // Combine challenge date and time
      const challengeDateTime = new Date(formData.challengeDate);
      const [hours, minutes] = formData.challengeTime.split(':').map(Number);
      challengeDateTime.setHours(hours, minutes, 0, 0);

      // Generate SVG card using ChallengeAnnouncementCardGenerator
      console.log('🎨 Generating challenge announcement card...');
      const cardGenerator = ChallengeAnnouncementCardGenerator.getInstance();
      const cardData = await cardGenerator.generateAnnouncementCard({
        challengeId,
        challengeName: formData.challengeName,
        teamId: actualTeamId,
        teamName: team?.name || 'RUNSTR',
        challengeDate: challengeDateTime.toISOString(),
        challengeTime: formData.challengeTime,
        distance: formData.selectedPreset.distance,
        opponentName: formData.opponentName,
        isRecurring: formData.isRecurring,
        recurrenceDay: formData.recurrenceDay || undefined,
        description: formData.description || undefined,
      });
      console.log('✅ SVG card generated successfully');

      // Set SVG in state for WorkoutCardRenderer to render
      console.log('🖼️ Setting SVG in state for renderer...');
      setGeneratedSVG(cardData.svgContent);

      // Wait for WorkoutCardRenderer to paint the SVG
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.log('✅ Renderer should have painted SVG');

      // Capture the rendered card as PNG
      if (!cardRendererRef.current) {
        throw new Error('Card renderer ref not available');
      }
      console.log('📸 Capturing card as PNG...');
      const cardImageUri = await captureRef(cardRendererRef, {
        format: 'png',
        quality: 0.9,
      });
      console.log('✅ Card captured:', cardImageUri);

      // Upload image to nostr.build
      console.log('📤 Uploading card image to nostr.build with NIP-98 auth...');
      const imageUploadService = ImageUploadService.getInstance();
      const uploadResult = await imageUploadService.uploadImage(
        cardImageUri,
        `runstr-challenge-${challengeId}.png`,
        signer
      );

      console.log('📤 Upload result:', {
        success: uploadResult.success,
        hasUrl: !!uploadResult.url,
        hasDimensions: !!uploadResult.dimensions,
        error: uploadResult.error,
      });

      let imageUrl: string | undefined;
      let imageDimensions = cardData.dimensions;

      if (uploadResult.success && uploadResult.url) {
        imageUrl = uploadResult.url;
        imageDimensions = uploadResult.dimensions || cardData.dimensions;
        console.log(`✅ Image uploaded successfully to: ${imageUrl}`);
      } else {
        console.warn('⚠️ Image upload failed:', uploadResult.error);
      }

      // Create social post content with @ mention
      let challengeContent: string;

      if (imageUrl) {
        // Clean format: @ mention + image URL + deep link + hashtags
        challengeContent = `I just challenged @${formData.opponentName} to a ${formData.selectedPreset.name}!\n\n${imageUrl}\n\n${cardData.deepLink}\n\n#RUNSTR #Bitcoin #Fitness`;
      } else {
        // Fallback to text-only if image upload failed
        const formattedDate = formData.challengeDate.toLocaleDateString(
          'en-US',
          {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          }
        );

        const [h, m] = formData.challengeTime.split(':').map(Number);
        const period = h >= 12 ? 'PM' : 'AM';
        const displayHours = h % 12 || 12;
        const formattedTime = `${displayHours}:${m
          .toString()
          .padStart(2, '0')} ${period}`;

        challengeContent = `I just challenged @${formData.opponentName} to a ${
          formData.selectedPreset.name
        }!

${formattedDate} at ${formattedTime}
Running - ${formData.selectedPreset.distance} km
Team: ${team?.name || 'RUNSTR'}

#RUNSTR #Bitcoin #Fitness`;
      }

      // Create kind 1 event with NIP-94 imeta tags
      const ndk = await GlobalNDKService.getInstance();
      const nostrEvent = new NDKEvent(ndk);
      nostrEvent.kind = 1;
      nostrEvent.content = challengeContent;
      nostrEvent.pubkey = creatorPubkey;
      nostrEvent.created_at = Math.floor(Date.now() / 1000);

      // Build tags array
      const tags: string[][] = [
        ['t', 'RUNSTR'],
        ['t', 'Bitcoin'],
        ['t', 'Fitness'],
      ];

      // Add NIP-94 image metadata tag (imeta) if image was uploaded
      if (imageUrl) {
        const imetaTag = ['imeta', `url ${imageUrl}`];
        if (imageDimensions) {
          imetaTag.push(
            `dim ${imageDimensions.width}x${imageDimensions.height}`
          );
        }
        imetaTag.push('m image/png');
        tags.push(imetaTag);
      }

      nostrEvent.tags = tags;

      console.log('✍️ Signing Nostr event...');
      await nostrEvent.sign(signer);
      console.log('✅ Event signed');

      console.log('📡 Publishing to Nostr...');
      await nostrEvent.publish();
      console.log('✅ Social post published successfully with @ mention!');

      setPostedSuccessfully(true);

      // Show success alert
      console.log('🎉 About to show success alert for social posting...');
      setAlertTitle('Posted!');
      setAlertMessage(
        'Your challenge announcement has been shared to the social feed.'
      );
      setAlertButtons([{ text: 'OK', style: 'default' }]);
      setAlertVisible(true);
      console.log('✅ Alert state set for social post');
    } catch (error) {
      console.error('❌ Failed to post to social:', error);

      setAlertTitle('Error');
      setAlertMessage(
        `Failed to share announcement: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      setAlertButtons([{ text: 'OK', style: 'destructive' }]);
      setAlertVisible(true);
    } finally {
      setIsPublishingSocial(false);
      setGeneratedSVG(null);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Create Challenge</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Single-page scrollable form */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Distance Presets */}
          <Text style={styles.sectionTitle}>Choose Distance</Text>
          <View style={styles.presetsGrid}>
            {CHALLENGE_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.presetCard,
                  formData.selectedPreset?.id === preset.id &&
                    styles.presetCardSelected,
                ]}
                onPress={() => selectPreset(preset)}
                activeOpacity={0.7}
              >
                {preset.emoji && (
                  <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                )}
                <Text
                  style={[
                    styles.presetName,
                    formData.selectedPreset?.id === preset.id &&
                      styles.presetNameSelected,
                  ]}
                >
                  {preset.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Challenge Name */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Challenge Name</Text>
            <TextInput
              style={styles.textInput}
              value={formData.challengeName}
              onChangeText={(text) => updateField('challengeName', text)}
              placeholder="e.g., Saturday Morning 5K Challenge"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          {/* Opponent Selection */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Opponent</Text>
            <TextInput
              style={styles.textInput}
              value={formData.opponentName}
              onChangeText={(text) => updateField('opponentName', text)}
              placeholder="Opponent's username"
              placeholderTextColor={theme.colors.textMuted}
              editable={!preSelectedOpponent} // Lock if pre-selected
            />
            <Text style={styles.formHelper}>
              {preSelectedOpponent
                ? 'Pre-selected opponent'
                : 'Enter opponent username or select from team'}
            </Text>
          </View>

          {/* Challenge Description (Optional) */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>
              Challenge Description (Optional)
            </Text>
            <TextInput
              style={[
                styles.textInput,
                { height: 80, textAlignVertical: 'top' },
              ]}
              value={formData.description}
              onChangeText={(text) => updateField('description', text)}
              placeholder="Optional details about your challenge..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Quick Date Options */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Challenge Date</Text>
            <View style={styles.quickDateOptions}>
              {getQuickDateOptions().map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.quickDateOption,
                    formData.challengeDate?.toDateString() ===
                      option.date.toDateString() &&
                      styles.quickDateOptionSelected,
                  ]}
                  onPress={() => updateField('challengeDate', option.date)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.quickDateOptionText,
                      formData.challengeDate?.toDateString() ===
                        option.date.toDateString() &&
                        styles.quickDateOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.quickDateOptionDate}>
                    {option.date.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Start Time */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Start Time</Text>
            <TextInput
              style={styles.textInput}
              value={formData.challengeTime}
              onChangeText={(text) => updateField('challengeTime', text)}
              placeholder="09:00"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.formHelper}>
              24-hour format (e.g., 09:00, 14:30)
            </Text>
          </View>

          {/* Recurring Option */}
          <View style={styles.formGroup}>
            <View style={styles.recurringRow}>
              <Text style={styles.formLabel}>Repeat Weekly?</Text>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  formData.isRecurring && styles.toggleButtonActive,
                ]}
                onPress={() =>
                  updateField('isRecurring', !formData.isRecurring)
                }
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    formData.isRecurring && styles.toggleButtonTextActive,
                  ]}
                >
                  {formData.isRecurring ? 'Yes' : 'No'}
                </Text>
              </TouchableOpacity>
            </View>

            {formData.isRecurring && (
              <View style={styles.recurrenceDaysContainer}>
                {[
                  'monday',
                  'tuesday',
                  'wednesday',
                  'thursday',
                  'friday',
                  'saturday',
                  'sunday',
                ].map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      formData.recurrenceDay === day &&
                        styles.dayButtonSelected,
                    ]}
                    onPress={() =>
                      updateField(
                        'recurrenceDay',
                        day as ChallengeFormData['recurrenceDay']
                      )
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        formData.recurrenceDay === day &&
                          styles.dayButtonTextSelected,
                      ]}
                    >
                      {day.substring(0, 3).toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Fixed Bottom Action Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.socialButton,
              postedSuccessfully && styles.buttonSuccess,
              (!isFormValid || isPublishingSocial) && styles.buttonDisabled,
            ]}
            onPress={handlePostToSocial}
            disabled={!isFormValid || isPublishingSocial}
            activeOpacity={0.7}
          >
            {isPublishingSocial ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.orangeBright}
              />
            ) : postedSuccessfully ? (
              <>
                <Text style={styles.socialButtonText}>Posted ✓</Text>
              </>
            ) : (
              <>
                <Text style={styles.socialButtonText}>Post to</Text>
                <Text style={styles.socialButtonText}>Social Feed</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.publishButton,
              publishedSuccessfully && styles.buttonSuccess,
              (!isFormValid || isPublishingChallenge) && styles.buttonDisabled,
            ]}
            onPress={handlePublishChallenge}
            disabled={!isFormValid || isPublishingChallenge}
            activeOpacity={0.7}
          >
            {isPublishingChallenge ? (
              <ActivityIndicator size="small" color={theme.colors.accentText} />
            ) : (
              <Text style={styles.publishButtonText}>Finished</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Close Button - Appears after any success */}
        {(publishedSuccessfully || postedSuccessfully) && (
          <View style={styles.closeButtonContainer}>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.doneButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {/* Custom Alert Modal */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        onClose={() => setAlertVisible(false)}
      />

      {/* Hidden WorkoutCardRenderer for image capture */}
      {generatedSVG && (
        <View style={{ position: 'absolute', left: -9999, top: -9999 }}>
          <WorkoutCardRenderer
            ref={cardRendererRef}
            svgContent={generatedSVG}
            width={800}
            height={600}
          />
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: theme.colors.cardBackground,
  },

  closeButtonText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },

  title: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },

  headerSpacer: {
    width: 32,
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 12,
  },

  // Presets Grid
  presetsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },

  presetCard: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },

  presetCardSelected: {
    borderColor: theme.colors.orangeDeep,
    backgroundColor: theme.colors.cardBackground,
  },

  presetEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },

  presetName: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },

  presetNameSelected: {
    color: theme.colors.orangeBright,
  },

  // Form Groups
  formGroup: {
    marginBottom: 20,
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
  },

  // Quick Date Options
  quickDateOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  quickDateOption: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  quickDateOptionSelected: {
    borderColor: theme.colors.orangeDeep,
    backgroundColor: theme.colors.cardBackground,
  },

  quickDateOptionText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },

  quickDateOptionTextSelected: {
    color: theme.colors.orangeBright,
  },

  quickDateOptionDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },

  // Recurring
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  toggleButtonActive: {
    backgroundColor: theme.colors.orangeDeep,
    borderColor: theme.colors.orangeDeep,
  },

  toggleButtonText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },

  toggleButtonTextActive: {
    color: theme.colors.accentText,
  },

  recurrenceDaysContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },

  dayButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  dayButtonSelected: {
    backgroundColor: theme.colors.orangeDeep,
    borderColor: theme.colors.orangeDeep,
  },

  dayButtonText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },

  dayButtonTextSelected: {
    color: theme.colors.accentText,
  },

  // Footer Action Buttons
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 12,
  },

  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  socialButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.orangeDeep,
  },

  socialButtonText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.orangeBright,
  },

  publishButton: {
    backgroundColor: theme.colors.orangeDeep,
  },

  publishButtonText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.accentText,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  buttonSuccess: {
    backgroundColor: theme.colors.orangeBright,
    borderColor: theme.colors.orangeBright,
  },

  // Close Button Container
  closeButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },

  doneButton: {
    backgroundColor: theme.colors.cardBackground,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  doneButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
});
