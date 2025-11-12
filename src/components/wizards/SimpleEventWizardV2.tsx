/**
 * SimpleEventWizardV2 - Single-page event creation (no steps!)
 *
 * Simplified flow: All options on one screen → Publish/Post buttons at bottom
 * No payments, no multi-step navigation, no AsyncStorage race conditions
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
import { NostrCompetitionService } from '../../services/nostr/NostrCompetitionService';
import { EventAnnouncementCardGenerator } from '../../services/nostr/eventAnnouncementCardGenerator';
import { NostrListService } from '../../services/nostr/NostrListService';
import { useUserStore } from '../../store/userStore';
import { DirectNostrProfileService } from '../../services/user/directNostrProfileService';
import UnifiedSigningService from '../../services/auth/UnifiedSigningService';
import { GlobalNDKService } from '../../services/nostr/GlobalNDKService';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { WorkoutCardRenderer } from '../cards/WorkoutCardRenderer';
import { ImageUploadService } from '../../services/media/ImageUploadService';
import { captureRef } from 'react-native-view-shot';
import type {
  NostrActivityType,
  NostrEventCompetitionType,
  EventScoringType,
} from '../../types/nostrCompetition';
import nostrTeamService from '../../services/nostr/NostrTeamService';
import unifiedCache from '../../services/cache/UnifiedNostrCache';
import { CacheKeys } from '../../constants/cacheTTL';

// Event Preset Interface
interface EventPreset {
  id: string;
  name: string;
  activityType: NostrActivityType;
  scoringType: EventScoringType;
  competitionType: NostrEventCompetitionType;
  targetValue: number;
  targetUnit: string;
  description: string;
  emoji: string;
}

// 3 Running Event Presets
const EVENT_PRESETS: EventPreset[] = [
  {
    id: '5k',
    name: '5K Race',
    emoji: '',
    activityType: 'Running',
    scoringType: 'fastest_time',
    competitionType: '5K Race',
    targetValue: 5,
    targetUnit: 'km',
    description: '5K Race',
  },
  {
    id: '10k',
    name: '10K Race',
    emoji: '',
    activityType: 'Running',
    scoringType: 'fastest_time',
    competitionType: '10K Race',
    targetValue: 10,
    targetUnit: 'km',
    description: '10K Race',
  },
  {
    id: 'half-marathon',
    name: 'Half Marathon',
    emoji: '',
    activityType: 'Running',
    scoringType: 'fastest_time',
    competitionType: 'Half Marathon',
    targetValue: 21.1,
    targetUnit: 'km',
    description: 'Half Marathon',
  },
];

// Form Data Interface (all fields in one place!)
interface EventFormData {
  selectedPreset: EventPreset | null;
  eventName: string;
  description: string;
  eventDate: Date | null;
  eventTime: string;
  isRecurring: boolean;
  recurrenceDay: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  teamId: string;
  captainPubkey: string;
}

export const SimpleEventWizardV2: React.FC<Props> = ({
  visible,
  onClose,
  teamId,
  captainPubkey,
}) => {
  const { user } = useUserStore();

  // All form state in one object (no steps, no navigation!)
  const [formData, setFormData] = useState<EventFormData>({
    selectedPreset: null,
    eventName: '',
    description: '',
    eventDate: null,
    eventTime: '09:00',
    isRecurring: false,
    recurrenceDay: null,
  });

  const [isPublishingEvent, setIsPublishingEvent] = useState(false);
  const [isPublishingSocial, setIsPublishingSocial] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [generatedEventId, setGeneratedEventId] = useState<string | null>(null);

  // Track which actions have been completed
  const [publishedSuccessfully, setPublishedSuccessfully] = useState(false);
  const [postedSuccessfully, setPostedSuccessfully] = useState(false);

  // CustomAlert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>>([]);

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
    }
  }, [visible]);

  // Validation: Enable buttons only when required fields are filled
  const isFormValid = !!(
    formData.selectedPreset &&
    formData.eventName.trim().length > 0 &&
    formData.eventDate &&
    (formData.isRecurring ? formData.recurrenceDay : true) // Require day if recurring
  );

  // Helper to update any field in formData
  const updateField = <K extends keyof EventFormData>(field: K, value: EventFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Select a preset (5K/10K/Half Marathon)
  const selectPreset = (preset: EventPreset) => {
    setFormData(prev => ({
      ...prev,
      selectedPreset: preset,
      eventName: preset.name, // Auto-fill event name
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
        label: currentDay === 0 || currentDay === 6 ? 'This Weekend (Today)' : 'This Weekend',
        date: thisWeekend,
      },
      { label: 'Next Week', date: nextWeek },
    ];
  };

  // Publish Event to Nostr (kind 30101 + kind 30000)
  const handlePublishEvent = async () => {
    if (!isFormValid || !formData.selectedPreset || !formData.eventDate) return;

    // Track success for each event type separately
    let participantListPublished = false;
    let eventDefinitionPublished = false;
    let participantListError: string | null = null;
    let eventDefinitionError: string | null = null;

    try {
      setIsPublishingEvent(true);
      console.log('🚀 Starting event publishing flow...');

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
        setAlertMessage('Unable to sign event. Please ensure you are logged in.');
        setAlertButtons([{ text: 'OK', style: 'destructive' }]);
        setAlertVisible(true);
        return;
      }

      // Combine event date and time
      const eventDateTime = new Date(formData.eventDate);
      const [hours, minutes] = formData.eventTime.split(':').map(Number);
      eventDateTime.setHours(hours, minutes, 0, 0);

      // Generate event ID
      const timestamp = Math.floor(Date.now() / 1000).toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      const sanitizedName = formData.eventName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 10);
      const eventId = `event_${sanitizedName}_${timestamp}_${random}`;

      // Store event ID for social posting
      setGeneratedEventId(eventId);
      console.log(`📝 Generated event ID: ${eventId}`);

      // Prepare event data
      const eventCreationData = {
        id: eventId,
        teamId,
        name: formData.eventName,
        description: formData.description,
        activityType: formData.selectedPreset.activityType,
        scoringType: formData.selectedPreset.scoringType,
        competitionType: formData.selectedPreset.competitionType,
        eventDate: eventDateTime.toISOString(),
        durationMinutes: 1440, // 24 hours default
        entryFeesSats: 0, // No payments for now
        maxParticipants: 999,
        requireApproval: true,
        targetValue: formData.selectedPreset.targetValue,
        targetUnit: formData.selectedPreset.targetUnit,
        scoringMode: 'individual' as const,
        recurrence: formData.isRecurring ? 'weekly' : undefined,
        recurrenceDay: formData.recurrenceDay || undefined,
        recurrenceStartDate: eventDateTime.toISOString(),
      };

      // ===== PUBLISH PARTICIPANT LIST (kind 30000) =====
      try {
        console.log('📋 [KIND 30000] Creating participant list...');
        const listService = NostrListService.getInstance();
        const participantListData = {
          name: `${formData.eventName} Participants`,
          description: `Participants for ${formData.eventName}`,
          members: [captainPubkey], // Start with captain only
          dTag: `event-${eventId}-participants`,
          listType: 'people' as const,
        };

        const listEventTemplate = listService.prepareListCreation(participantListData, captainPubkey);
        const ndk = await GlobalNDKService.getInstance();
        const listNdkEvent = new NDKEvent(ndk, listEventTemplate);

        console.log(`📋 [KIND 30000] Signing event with d-tag: ${participantListData.dTag}`);
        await listNdkEvent.sign(signer);

        console.log('📋 [KIND 30000] Publishing to relays...');
        const publishResult = await listNdkEvent.publish();

        // Log relay results
        const relayUrls = Array.from(publishResult);
        console.log(`📋 [KIND 30000] Published to ${relayUrls.length} relay(s):`);
        relayUrls.forEach(relay => {
          console.log(`   ✅ ${relay.url || 'Unknown relay'}`);
        });

        if (relayUrls.length === 0) {
          throw new Error('No relays accepted the participant list');
        }

        participantListPublished = true;
        console.log('✅ [KIND 30000] Participant list published successfully');
      } catch (error) {
        participantListError = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ [KIND 30000] Failed to publish participant list: ${participantListError}`);
        console.error('Full error:', error);
      }

      // ===== PUBLISH EVENT DEFINITION (kind 30101) =====
      try {
        console.log('🎯 [KIND 30101] Creating event definition...');
        const result = await NostrCompetitionService.createEvent(eventCreationData, signer);

        if (!result.success) {
          throw new Error(result.message || 'Failed to create event');
        }

        console.log(`✅ [KIND 30101] Event definition published successfully: ${result.competitionId}`);

        // Log relay information from result if available
        if (result.relayCount !== undefined) {
          console.log(`🎯 [KIND 30101] Published to ${result.relayCount} relay(s)`);
        }

        eventDefinitionPublished = true;
      } catch (error) {
        eventDefinitionError = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ [KIND 30101] Failed to publish event definition: ${eventDefinitionError}`);
        console.error('Full error:', error);
      }

      // ===== VALIDATE BOTH EVENTS PUBLISHED =====
      console.log('🔍 Validating publish results...');
      console.log(`   - Participant list (kind 30000): ${participantListPublished ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`   - Event definition (kind 30101): ${eventDefinitionPublished ? '✅ SUCCESS' : '❌ FAILED'}`);

      if (participantListPublished && eventDefinitionPublished) {
        // ✅ BOTH PUBLISHED SUCCESSFULLY
        console.log('🎉 Both events published successfully!');

        // Invalidate cache
        unifiedCache.invalidate(CacheKeys.TEAM_EVENTS(teamId));

        // ✅ AUTO-JOIN CAPTAIN TO LOCAL STORAGE
        // Captain is already in kind 30000 list, now add to local storage for instant UX
        try {
          console.log('👤 Auto-joining captain to event locally...');
          const { EventParticipationStore } = await import('../../services/event/EventParticipationStore');

          await EventParticipationStore.addParticipation({
            eventId: eventId,
            eventData: eventCreationData,
            entryFeePaid: 0, // Captain doesn't pay entry fee
            paymentMethod: undefined,
            paidAt: Date.now(),
            status: 'approved', // Captain is pre-approved
            localOnly: false, // Already published to kind 30000
          });

          console.log('✅ Captain auto-joined to event locally');
        } catch (autoJoinError) {
          console.error('⚠️ Failed to auto-join captain locally (non-critical):', autoJoinError);
          // Don't block event creation if this fails
        }

        setPublishSuccess(true);
        setPublishedSuccessfully(true);

        // Show success alert
        setAlertTitle('Event Published!');
        setAlertMessage('Your event has been created on Nostr. Members can now join!');
        setAlertButtons([{ text: 'OK', style: 'default' }]);
        setAlertVisible(true);
      } else if (!participantListPublished && !eventDefinitionPublished) {
        // ❌ BOTH FAILED
        console.error('❌ Both events failed to publish');
        setAlertTitle('Publishing Failed');
        setAlertMessage(
          `Failed to publish both events:\n\n` +
          `Participant list: ${participantListError}\n` +
          `Event definition: ${eventDefinitionError}`
        );
        setAlertButtons([{ text: 'OK', style: 'destructive' }]);
        setAlertVisible(true);
      } else if (!participantListPublished) {
        // ⚠️ PARTICIPANT LIST FAILED, EVENT SUCCEEDED
        console.warn('⚠️ Partial failure: Event published but participant list failed');
        setAlertTitle('Partial Failure');
        setAlertMessage(
          `Event was created, but participant list failed:\n\n${participantListError}\n\n` +
          `You may need to manually add participants.`
        );
        setAlertButtons([{ text: 'OK', style: 'destructive' }]);
        setAlertVisible(true);
      } else {
        // ⚠️ EVENT FAILED, PARTICIPANT LIST SUCCEEDED
        console.warn('⚠️ Partial failure: Participant list published but event failed');
        setAlertTitle('Partial Failure');
        setAlertMessage(
          `Participant list was created, but event failed:\n\n${eventDefinitionError}\n\n` +
          `Please try creating the event again.`
        );
        setAlertButtons([{ text: 'OK', style: 'destructive' }]);
        setAlertVisible(true);
      }
    } catch (error) {
      // Catch-all for unexpected errors (authentication, network, etc.)
      console.error('❌ Unexpected error during event publishing:', error);

      setAlertTitle('Error');
      setAlertMessage(`Failed to publish event: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setAlertButtons([{ text: 'OK', style: 'destructive' }]);
      setAlertVisible(true);
    } finally {
      setIsPublishingEvent(false);
      console.log('🏁 Event publishing flow completed');
    }
  };

  // Post to Social Feed (kind 1 announcement with SVG card)
  const handlePostToSocial = async () => {
    console.log('📱 handlePostToSocial: Starting...');
    if (!isFormValid || !formData.selectedPreset || !formData.eventDate) {
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

      // Get team info
      console.log('🏆 Getting team info for teamId:', teamId);
      const team = nostrTeamService.getTeamById(teamId);
      console.log('🏆 Team info:', team ? team.name : 'NOT FOUND');

      // Generate event ID if not already generated
      let eventId = generatedEventId;
      if (!eventId) {
        const timestamp = Math.floor(Date.now() / 1000).toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        const sanitizedName = formData.eventName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .substring(0, 10);
        eventId = `event_${sanitizedName}_${timestamp}_${random}`;
        setGeneratedEventId(eventId);
      }

      // Combine event date and time
      const eventDateTime = new Date(formData.eventDate);
      const [hours, minutes] = formData.eventTime.split(':').map(Number);
      eventDateTime.setHours(hours, minutes, 0, 0);

      // Generate SVG card using EventAnnouncementCardGenerator
      console.log('🎨 Generating event announcement card...');
      const cardGenerator = EventAnnouncementCardGenerator.getInstance();
      const cardData = await cardGenerator.generateAnnouncementCard({
        eventId,
        eventName: formData.eventName,
        teamId,
        teamName: team?.name || 'RUNSTR',
        eventDate: eventDateTime.toISOString(),
        eventTime: formData.eventTime,
        isRecurring: formData.isRecurring,
        recurrenceDay: formData.recurrenceDay || undefined,
        description: formData.description || undefined,
        targetValue: formData.selectedPreset.targetValue,
        targetUnit: formData.selectedPreset.targetUnit,
      });
      console.log('✅ SVG card generated successfully');

      // Set SVG in state for WorkoutCardRenderer to render
      console.log('🖼️ Setting SVG in state for renderer...');
      setGeneratedSVG(cardData.svgContent);

      // Wait for WorkoutCardRenderer to paint the SVG
      await new Promise(resolve => setTimeout(resolve, 100));
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
        `runstr-event-${eventId}.png`,
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
        // Continue without image - post will still have text content
      }

      // Create clean social post content (matches workout posting pattern)
      // If image uploaded successfully, just show image URL + hashtags (like workouts)
      // Otherwise, show text details
      let eventContent: string;

      if (imageUrl) {
        // Clean format: image URL + deep link + hashtags
        eventContent = `${imageUrl}\n\n${cardData.deepLink}\n\n#RUNSTR #Bitcoin #Fitness`;
      } else {
        // Fallback to text-only if image upload failed
        // Format date without emoji
        const formattedDate = formData.eventDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });

        // Format time
        const [h, m] = formData.eventTime.split(':').map(Number);
        const period = h >= 12 ? 'PM' : 'AM';
        const displayHours = h % 12 || 12;
        const formattedTime = `${displayHours}:${m.toString().padStart(2, '0')} ${period}`;

        // Build text content without emoji
        eventContent = `New Event: ${formData.eventName}

${formattedDate} at ${formattedTime}
${formData.selectedPreset.activityType} - ${formData.selectedPreset.targetValue} ${formData.selectedPreset.targetUnit}
Team: ${team?.name || 'RUNSTR'}

#RUNSTR #Bitcoin #Fitness`;
      }

      // Create kind 1 event with NIP-94 imeta tags
      const ndk = await GlobalNDKService.getInstance();
      const nostrEvent = new NDKEvent(ndk);
      nostrEvent.kind = 1;
      nostrEvent.content = eventContent;
      nostrEvent.pubkey = captainPubkey;
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
          imetaTag.push(`dim ${imageDimensions.width}x${imageDimensions.height}`);
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
      console.log('✅ Social post published successfully with image card!');

      setPostedSuccessfully(true);

      // Show custom styled success alert
      console.log('🎉 About to show success alert for social posting...');
      setAlertTitle('Posted!');
      setAlertMessage('Your event announcement has been shared to the social feed.');
      setAlertButtons([{ text: 'OK', style: 'default' }]);
      setAlertVisible(true);
      console.log('✅ Alert state set for social post');
    } catch (error) {
      console.error('❌ Failed to post to social:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');

      // Show custom styled error alert
      console.log('⚠️ Showing error alert for social posting...');
      setAlertTitle('Error');
      setAlertMessage(`Failed to share announcement: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setAlertButtons([{ text: 'OK', style: 'destructive' }]);
      setAlertVisible(true);
      console.log('✅ Error alert state set');
    } finally {
      setIsPublishingSocial(false);
      // Clear the generated SVG after posting
      setGeneratedSVG(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Create Event</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Single-page scrollable form */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Distance Presets */}
          <Text style={styles.sectionTitle}>Choose Distance</Text>
          <View style={styles.presetsGrid}>
            {EVENT_PRESETS.map(preset => (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.presetCard,
                  formData.selectedPreset?.id === preset.id && styles.presetCardSelected,
                ]}
                onPress={() => selectPreset(preset)}
                activeOpacity={0.7}
              >
                {preset.emoji && <Text style={styles.presetEmoji}>{preset.emoji}</Text>}
                <Text
                  style={[
                    styles.presetName,
                    formData.selectedPreset?.id === preset.id && styles.presetNameSelected,
                  ]}
                >
                  {preset.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Event Name */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Event Name</Text>
            <TextInput
              style={styles.textInput}
              value={formData.eventName}
              onChangeText={text => updateField('eventName', text)}
              placeholder="e.g., Saturday Morning 5K"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          {/* Event Description (Optional) */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Event Description (Optional)</Text>
            <TextInput
              style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
              value={formData.description}
              onChangeText={text => updateField('description', text)}
              placeholder="Optional details about your event..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Quick Date Options */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Event Date</Text>
            <View style={styles.quickDateOptions}>
              {getQuickDateOptions().map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.quickDateOption,
                    formData.eventDate?.toDateString() === option.date.toDateString() &&
                      styles.quickDateOptionSelected,
                  ]}
                  onPress={() => updateField('eventDate', option.date)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.quickDateOptionText,
                      formData.eventDate?.toDateString() === option.date.toDateString() &&
                        styles.quickDateOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.quickDateOptionDate}>{option.date.toLocaleDateString()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Start Time */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Start Time</Text>
            <TextInput
              style={styles.textInput}
              value={formData.eventTime}
              onChangeText={text => updateField('eventTime', text)}
              placeholder="09:00"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.formHelper}>24-hour format (e.g., 09:00, 14:30)</Text>
          </View>

          {/* Recurring Option */}
          <View style={styles.formGroup}>
            <View style={styles.recurringRow}>
              <Text style={styles.formLabel}>Repeat Weekly?</Text>
              <TouchableOpacity
                style={[styles.toggleButton, formData.isRecurring && styles.toggleButtonActive]}
                onPress={() => updateField('isRecurring', !formData.isRecurring)}
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
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      formData.recurrenceDay === day && styles.dayButtonSelected,
                    ]}
                    onPress={() =>
                      updateField(
                        'recurrenceDay',
                        day as EventFormData['recurrenceDay']
                      )
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        formData.recurrenceDay === day && styles.dayButtonTextSelected,
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
              <ActivityIndicator size="small" color={theme.colors.orangeBright} />
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
              (!isFormValid || isPublishingEvent) && styles.buttonDisabled,
            ]}
            onPress={handlePublishEvent}
            disabled={!isFormValid || isPublishingEvent}
            activeOpacity={0.7}
          >
            {isPublishingEvent ? (
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
    backgroundColor: theme.colors.cardBackgroundHighlight,
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

  presetDescription: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
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
    backgroundColor: theme.colors.cardBackgroundHighlight,
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
