/**
 * EventCreationWizard - Preset-based event creation (2-step flow)
 * Step 1: Select Preset → Step 2: Date + Prize Pool + Entry Fee
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../styles/theme';
import { WizardStepContainer, WizardStep } from './WizardStepContainer';
import { CustomAlert } from '../ui/CustomAlert';
import { NostrCompetitionService } from '../../services/nostr/NostrCompetitionService';
import { NostrListService } from '../../services/nostr/NostrListService';
import { useUserStore } from '../../store/userStore';
import { DirectNostrProfileService } from '../../services/user/directNostrProfileService';
import UnifiedSigningService from '../../services/auth/UnifiedSigningService';
import { GlobalNDKService } from '../../services/nostr/GlobalNDKService';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import type {
  NostrActivityType,
  NostrEventCompetitionType,
  EventScoringType,
  RecurrenceFrequency,
  RecurrenceDay,
} from '../../types/nostrCompetition';
import { getCharityById } from '../../constants/charities';
import nostrTeamService from '../../services/nostr/NostrTeamService';
import { ProfileService } from '../../services/user/profileService';
import unifiedCache from '../../services/cache/UnifiedNostrCache';
import { CacheKeys } from '../../constants/cacheTTL';
// Duration options removed - now auto-set to 24 hours
import { EventAnnouncementPreview } from '../events/EventAnnouncementPreview';
import type { EventAnnouncementData } from '../../services/nostr/eventAnnouncementCardGenerator';

// Event Preset Interface (Simplified for Running-only events)
interface EventPreset {
  id: string;
  name: string;
  activityType: NostrActivityType; // Always 'Running'
  scoringType: EventScoringType; // Always 'fastest_time'
  competitionType: NostrEventCompetitionType;
  targetValue: number;
  targetUnit: string;
  description: string;
}

// 3 Running Event Presets (Simplified from 11)
const EVENT_PRESETS: EventPreset[] = [
  {
    id: '5k',
    name: '5K Race',
    activityType: 'Running',
    scoringType: 'fastest_time',
    competitionType: '5K Race',
    targetValue: 5,
    targetUnit: 'km',
    description: '5 kilometers - fastest time wins',
  },
  {
    id: '10k',
    name: '10K Race',
    activityType: 'Running',
    scoringType: 'fastest_time',
    competitionType: '10K Race',
    targetValue: 10,
    targetUnit: 'km',
    description: '10 kilometers - fastest time wins',
  },
  {
    id: 'half-marathon',
    name: 'Half Marathon',
    activityType: 'Running',
    scoringType: 'fastest_time',
    competitionType: 'Half Marathon',
    targetValue: 21.1,
    targetUnit: 'km',
    description: '21.1 kilometers - fastest time wins',
  },
];

type ActivityType = NostrActivityType;
type CompetitionType = NostrEventCompetitionType;

interface EventData {
  selectedPreset: EventPreset | null;
  activityType: ActivityType; // Auto-set to 'Running'
  scoringType: EventScoringType; // Auto-set to 'fastest_time'
  competitionType: CompetitionType | null;
  eventDate: Date | null;
  eventTime: string; // NEW: Event start time (HH:MM format)
  entryFeesSats: number;
  eventName: string;
  description: string;
  location?: string; // NEW: Event location (e.g., "Central Park, NYC")
  targetValue?: number;
  targetUnit?: string;
  prizePoolSats: number | undefined;
  lightningAddress?: string;
  paymentDestination: 'captain' | 'charity';
  recurrence: RecurrenceFrequency;
  recurrenceDay?: RecurrenceDay;
  // Auto-set (hidden from user):
  durationMinutes: number; // Always 1440 (24 hours)
  maxParticipants: number; // Always 999 (unlimited)
  requireApproval: boolean; // Always true
  scoringMode: 'individual'; // Always 'individual'
}

interface EventCreationWizardProps {
  visible: boolean;
  teamId: string;
  captainPubkey: string;
  onClose: () => void;
  onEventCreated: (eventData: EventData) => void;
}

export const EventCreationWizard: React.FC<EventCreationWizardProps> = ({
  visible,
  teamId,
  captainPubkey,
  onClose,
  onEventCreated,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const user = useUserStore((state) => state.user);
  const navigation = useNavigation<any>(); // ✅ Add navigation for event detail screen redirect
  const [teamCharityId, setTeamCharityId] = useState<string | undefined>();
  const [captainLightningAddress, setCaptainLightningAddress] =
    useState<string>('');
  const [eventData, setEventData] = useState<EventData>({
    selectedPreset: null,
    activityType: 'Running', // Auto-set
    scoringType: 'fastest_time', // Auto-set
    competitionType: null,
    eventDate: null,
    eventTime: '09:00', // Default 9:00 AM
    entryFeesSats: 0,
    eventName: '',
    description: '',
    location: '', // NEW: Event location
    prizePoolSats: undefined,
    lightningAddress: '',
    paymentDestination: 'captain',
    recurrence: 'none',
    recurrenceDay: undefined,
    // Auto-set hidden fields:
    durationMinutes: 1440, // 24 hours
    maxParticipants: 999, // Unlimited
    requireApproval: true,
    scoringMode: 'individual',
  });

  // Alert state for CustomAlert
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<
    Array<{ text: string; onPress?: () => void }>
  >([]);

  // Announcement preview state
  const [showAnnouncementPreview, setShowAnnouncementPreview] = useState(false);
  const [createdEventData, setCreatedEventData] =
    useState<EventAnnouncementData | null>(null);

  // Reset wizard when opened and fetch team/captain data
  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      setEventData({
        selectedPreset: null,
        activityType: 'Running',
        scoringType: 'fastest_time',
        competitionType: null,
        eventDate: null,
        eventTime: '09:00',
        entryFeesSats: 0,
        eventName: '',
        description: '',
        location: '',
        prizePoolSats: undefined,
        lightningAddress: '',
        paymentDestination: 'captain',
        recurrence: 'none',
        recurrenceDay: undefined,
        durationMinutes: 1440,
        maxParticipants: 999,
        requireApproval: true,
        scoringMode: 'individual',
      });

      // Fetch team charity info
      const team = nostrTeamService.getTeamById(teamId);
      if (team?.charityId) {
        setTeamCharityId(team.charityId);
      }

      // Fetch captain's Lightning address from their profile
      ProfileService.getUserProfile(captainPubkey).then((profile) => {
        if (profile?.lud16) {
          setCaptainLightningAddress(profile.lud16);
          setEventData((prev) => ({
            ...prev,
            lightningAddress: profile.lud16,
          }));
        }
      });
    }
  }, [visible, teamId, captainPubkey]);

  // Wizard steps configuration (2 steps: details, payments)
  const steps: WizardStep[] = [
    {
      id: 'details',
      title: 'Event Details',
      isValid: !!eventData.selectedPreset && eventData.eventName.length > 0 && !!eventData.eventDate,
    },
    {
      id: 'payments',
      title: 'Payments & Settings',
      isValid: true, // Always valid (payments optional)
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
    // Try to get user from store or DirectNostrProfileService
    let currentUser = user;
    if (!currentUser) {
      console.log(
        '⚠️ User not in store, fetching from DirectNostrProfileService...'
      );
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
        console.error(
          'Failed to get user from DirectNostrProfileService:',
          error
        );
        setAlertTitle('Error');
        setAlertMessage('User not found. Please log in again.');
        setAlertButtons([{ text: 'OK' }]);
        setAlertVisible(true);
        return;
      }
    }

    setIsCreating(true);

    try {
      console.log('🎯 Creating preset event with Nostr Competition Service');

      // Check for existing active events before proceeding
      const activeCompetitions =
        await NostrCompetitionService.checkActiveCompetitions(teamId);

      if (activeCompetitions.activeEvents > 0) {
        setAlertTitle('Active Event Exists');
        setAlertMessage(
          `Your team already has an active event: "${activeCompetitions.activeEventDetails?.name}"\n\nIt is scheduled for ${activeCompetitions.activeEventDetails?.eventDate}.\n\nOnly one event can be active at a time.`
        );
        setAlertButtons([{ text: 'OK', onPress: () => setIsCreating(false) }]);
        setAlertVisible(true);
        return;
      }

      // Get signer using UnifiedSigningService (handles both nsec and Amber)
      const signingService = UnifiedSigningService.getInstance();
      const signer = await signingService.getSigner();

      if (!signer) {
        setAlertTitle('Authentication Required');
        setAlertMessage('Unable to sign event. Please ensure you are logged in.');
        setAlertButtons([{ text: 'OK' }]);
        setAlertVisible(true);
        setIsCreating(false);
        return;
      }

      console.log('✅ Signer ready for event creation');

      // Combine event date and time into single ISO string
      const eventDateTime = new Date(eventData.eventDate!);
      const [hours, minutes] = eventData.eventTime.split(':').map(Number);
      eventDateTime.setHours(hours, minutes, 0, 0);

      // Prepare event data for Nostr
      const eventCreationData = {
        teamId,
        name: eventData.eventName,
        description: eventData.description,
        location: eventData.location, // NEW: Event location
        activityType: eventData.activityType, // Auto-set to 'Running'
        scoringType: eventData.scoringType, // Auto-set to 'fastest_time'
        competitionType: eventData.competitionType!, // From preset
        eventDate: eventDateTime.toISOString(), // Combined date + time
        durationMinutes: eventData.durationMinutes, // Auto-set to 1440 (24 hours)
        entryFeesSats: eventData.entryFeesSats,
        maxParticipants: eventData.maxParticipants, // Auto-set to 999
        requireApproval: eventData.requireApproval, // Auto-set to true
        targetValue: eventData.targetValue,
        targetUnit: eventData.targetUnit,
        prizePoolSats: eventData.prizePoolSats,
        lightningAddress: eventData.lightningAddress,
        paymentDestination: eventData.paymentDestination,
        paymentRecipientName:
          eventData.paymentDestination === 'charity'
            ? getCharityById(teamCharityId)?.name
            : currentUser?.name || 'Team Captain',
        scoringMode: eventData.scoringMode, // Auto-set to 'individual'
        teamGoal: undefined, // Removed from wizard
        recurrence: eventData.recurrence,
        recurrenceDay: eventData.recurrenceDay,
        recurrenceStartDate: eventDateTime.toISOString(), // First occurrence with time
      };

      console.log('🎯 Creating event with participant list:', eventCreationData);

      // ✅ FIX: Validate critical fields before proceeding
      if (!teamId || teamId.trim() === '') {
        console.error('❌ CRITICAL: teamId is empty in wizard!', {
          teamIdFromProps: teamId,
          captainPubkey,
          eventDataSnapshot: eventData,
        });
        setAlertTitle('Configuration Error');
        setAlertMessage(
          'Cannot create event: Team ID is missing.\n\n' +
          'This usually means:\n' +
          '• Wizard was opened without team context\n' +
          '• Team data failed to load\n\n' +
          'Please close the wizard and try again from the team page.'
        );
        setAlertButtons([{ text: 'OK' }]);
        setAlertVisible(true);
        setIsCreating(false);
        return;
      }

      if (!captainPubkey || captainPubkey.trim() === '') {
        console.error('❌ CRITICAL: captainPubkey is empty in wizard!', {
          captainPubkey,
          teamId,
        });
        setAlertTitle('Authentication Error');
        setAlertMessage(
          'Cannot create event: Captain identity is missing.\n\n' +
          'Please ensure you are logged in and try again.'
        );
        setAlertButtons([{ text: 'OK' }]);
        setAlertVisible(true);
        setIsCreating(false);
        return;
      }

      // ✅ FIX: Check for invalid activity types (defensive check for potential bugs)
      const validActivityTypes = ['Running', 'Walking', 'Cycling', 'Hiking', 'Swimming', 'Rowing', 'Strength Training', 'Yoga', 'Meditation'];
      if (!eventData.activityType || !validActivityTypes.includes(eventData.activityType)) {
        console.error('❌ CRITICAL: activityType is invalid!', {
          activityType: eventData.activityType,
          preset: eventData.selectedPreset,
        });
        setAlertTitle('Preset Error');
        setAlertMessage(
          'Cannot create event: Activity type is invalid.\n\n' +
          'Please select an event preset from the first step.'
        );
        setAlertButtons([{ text: 'OK' }]);
        setAlertVisible(true);
        setIsCreating(false);
        return;
      }

      console.log('✅ Wizard validation passed:', {
        teamId,
        captainPubkey,
        activityType: eventData.activityType,
        eventName: eventData.eventName,
      });

      // STEP 1: Generate event ID first (needed for participant list d-tag)
      const timestamp = Math.floor(Date.now() / 1000).toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      const sanitizedName = eventData.eventName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 10);
      const eventId = `event_${sanitizedName}_${timestamp}_${random}`;

      console.log('📋 Generated event ID:', eventId);

      // STEP 2: Create participant list FIRST (with captain as first member)
      console.log('📋 Creating participant list (kind 30000) FIRST...');
      const listService = NostrListService.getInstance();

      const participantListData = {
        name: `${eventData.eventName} Participants`,
        description: `Participants for ${eventData.eventName}`,
        members: [captainPubkey], // Captain auto-joins their own event
        dTag: `event-${eventId}-participants`,
        listType: 'people' as const,
      };

      const listEventTemplate = listService.prepareListCreation(
        participantListData,
        captainPubkey
      );

      console.log('🔐 Signing participant list...');

      const ndk = await GlobalNDKService.getInstance();
      const listNdkEvent = new NDKEvent(ndk, listEventTemplate);
      await listNdkEvent.sign(signer);

      console.log('📤 Publishing participant list to Nostr...');
      await listNdkEvent.publish();

      console.log('✅ Participant list created successfully:', participantListData.dTag);

      // STEP 3: Now create the event (kind 30101) - only if list succeeded
      console.log('🎯 Creating event (kind 30101) now that list exists...');

      // Add the pre-generated eventId to the event data
      const eventCreationDataWithId = {
        ...eventCreationData,
        id: eventId, // ✅ FIX: Pass wizard's pre-generated eventId to prevent ID mismatch
      };

      const result = await NostrCompetitionService.createEvent(
        eventCreationDataWithId,
        signer
      );

      if (result.success) {
        console.log('✅ Event created successfully:', result.competitionId);

        // ✅ FIX: Invalidate team events cache so new event appears immediately
        console.log('🗑️ Invalidating team events cache for team:', teamId);
        unifiedCache.invalidate(CacheKeys.TEAM_EVENTS(teamId));

        // Prepare announcement data for preview modal
        const team = nostrTeamService.getTeamById(teamId);
        const announcementData: EventAnnouncementData = {
          eventId: result.competitionId!,
          eventName: eventData.eventName,
          teamId,
          teamName: team?.name || 'Your Team',
          activityType: eventData.activityType || 'Running', // ✅ FIX: Provide fallback
          eventDate: eventData.eventDate!.toISOString(),
          entryFee: eventData.entryFeesSats,
          prizePool: eventData.prizePoolSats,
          captainName: currentUser?.name,
          durationMinutes: eventData.durationMinutes,
        };

        // ✅ FIX: Debug log announcement data to verify all fields
        console.log('📢 Announcement data prepared:', {
          eventId: announcementData.eventId,
          eventName: announcementData.eventName,
          activityType: announcementData.activityType,
          teamName: announcementData.teamName,
          eventDate: announcementData.eventDate,
        });

        // ✅ FIX: Show simple success alert, then close wizard and call callback
        setAlertTitle('Success!');
        setAlertMessage(
          `Event "${eventData.eventName}" has been created and published to Nostr relays.\n\nParticipant list created successfully.`
        );
        setAlertButtons([
          {
            text: 'OK',
            onPress: () => {
              console.log('✅ Success alert dismissed, closing wizard and calling onEventCreated');
              setAlertVisible(false);
              // Call onEventCreated callback to trigger parent component's success modal
              onEventCreated(eventData);
              // Close wizard explicitly
              onClose();
            },
          },
        ]);
        setAlertVisible(true);
        console.log('📢 Success alert displayed for event:', eventData.eventName);
      } else {
        throw new Error(result.message || 'Failed to create event');
      }
    } catch (error) {
      console.error('❌ Failed to create event:', error);
      setAlertTitle('Error');
      setAlertMessage(
        `Failed to create event: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      setAlertButtons([{ text: 'OK' }]);
      setAlertVisible(true);
    } finally {
      setIsCreating(false);
    }
  };

  const selectPreset = (preset: EventPreset) => {
    setEventData((prev) => ({
      ...prev,
      selectedPreset: preset,
      activityType: preset.activityType,
      scoringType: preset.scoringType, // ← NEW: Set scoring type
      competitionType: preset.competitionType,
      targetValue: preset.targetValue,
      targetUnit: preset.targetUnit,
      eventName: preset.name,
      description: preset.description,
    }));
  };

  const updateSettings = (field: keyof EventData, value: any) => {
    setEventData((prev) => ({ ...prev, [field]: value }));
  };

  // Generate quick date options
  const getQuickDateOptions = () => {
    const today = new Date();

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const thisWeekend = new Date(today);
    const currentDay = today.getDay();
    if (currentDay === 0 || currentDay === 6) {
      // Today is weekend
    } else {
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Event Details (Preset + Name/Bio + Date/Time)
        return (
          <ScrollView
            style={styles.stepContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stepDescription}>
              Choose your race distance and set the date
            </Text>

            {/* Race Distance Presets */}
            <Text style={styles.formLabel}>Race Distance</Text>
            <View style={styles.presetsGrid}>
              {EVENT_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.presetCard,
                    eventData.selectedPreset?.id === preset.id &&
                      styles.presetCardSelected,
                  ]}
                  onPress={() => selectPreset(preset)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.presetName,
                      eventData.selectedPreset?.id === preset.id &&
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

            {/* Event Name */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Event Name</Text>
              <TextInput
                style={styles.textInput}
                value={eventData.eventName}
                onChangeText={(text) => updateSettings('eventName', text)}
                placeholder="Enter event name"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>

            {/* Event Bio (optional) */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Event Bio (Optional)</Text>
              <TextInput
                style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                value={eventData.description}
                onChangeText={(text) => updateSettings('description', text)}
                placeholder="Describe your event..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Location (optional) - NEW */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Location (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={eventData.location}
                onChangeText={(text) => updateSettings('location', text)}
                placeholder="e.g., Central Park, NYC"
                placeholderTextColor={theme.colors.textMuted}
              />
              <Text style={styles.formHelper}>
                Where will the event take place?
              </Text>
            </View>

            {/* Date Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Event Date</Text>
              <View style={styles.quickDateOptions}>
                {getQuickDateOptions().map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.quickDateOption,
                      eventData.eventDate?.toDateString() ===
                        option.date.toDateString() &&
                        styles.quickDateOptionSelected,
                    ]}
                    onPress={() =>
                      setEventData((prev) => ({ ...prev, eventDate: option.date }))
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.quickDateOptionText,
                        eventData.eventDate?.toDateString() ===
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

            {/* Time Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Start Time</Text>
              <TextInput
                style={styles.textInput}
                value={eventData.eventTime}
                onChangeText={(text) => updateSettings('eventTime', text)}
                placeholder="09:00"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numbers-and-punctuation"
              />
              <Text style={styles.formHelper}>
                24-hour format (e.g., 09:00, 14:30)
              </Text>
            </View>
          </ScrollView>
        );

      case 1: // Payments & Settings
        return (
          <ScrollView
            style={styles.stepContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stepDescription}>
              Configure entry fees, prizes, and recurring options
            </Text>

            {/* Entry Fee with Preset Buttons */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Entry Fee</Text>
              <View style={styles.entryFeeOptions}>
                {[
                  { label: 'Free', value: 0 },
                  { label: '1,000 sats', value: 1000 },
                  { label: '2,100 sats', value: 2100 },
                  { label: '5,000 sats', value: 5000 },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.label}
                    style={[
                      styles.entryFeeOption,
                      eventData.entryFeesSats === option.value &&
                        styles.entryFeeOptionSelected,
                    ]}
                    onPress={() =>
                      updateSettings('entryFeesSats', option.value)
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.entryFeeOptionText,
                        eventData.entryFeesSats === option.value &&
                          styles.entryFeeOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {eventData.entryFeesSats > 0 && (
                <Text style={styles.formHelper}>
                  Participants will pay {eventData.entryFeesSats} sats to join
                </Text>
              )}
            </View>

            {/* Prize Pool */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Prize Pool</Text>
              <View style={styles.prizePoolOptions}>
                {[
                  { label: 'None', value: 0 },
                  { label: '10k sats', value: 10000 },
                  { label: '21k sats', value: 21000 },
                  { label: '50k sats', value: 50000 },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.label}
                    style={[
                      styles.prizeOption,
                      eventData.prizePoolSats === option.value &&
                        styles.prizeOptionSelected,
                    ]}
                    onPress={() =>
                      updateSettings('prizePoolSats', option.value)
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.prizeOptionText,
                        eventData.prizePoolSats === option.value &&
                          styles.prizeOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Payment Destination (only if entry fee > 0) */}
            {eventData.entryFeesSats > 0 && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Entry Fees Go To:</Text>
                <View style={styles.destinationOptions}>
                  <TouchableOpacity
                    style={[
                      styles.destinationOption,
                      eventData.paymentDestination === 'captain' &&
                        styles.destinationOptionSelected,
                    ]}
                    onPress={() => {
                      updateSettings('paymentDestination', 'captain');
                      updateSettings(
                        'lightningAddress',
                        captainLightningAddress
                      );
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.destinationOptionText,
                        eventData.paymentDestination === 'captain' &&
                          styles.destinationOptionTextSelected,
                      ]}
                    >
                      Captain's Wallet
                    </Text>
                  </TouchableOpacity>

                  {teamCharityId && (
                    <TouchableOpacity
                      style={[
                        styles.destinationOption,
                        eventData.paymentDestination === 'charity' &&
                          styles.destinationOptionSelected,
                      ]}
                      onPress={() => {
                        const charity = getCharityById(teamCharityId);
                        if (charity) {
                          updateSettings('paymentDestination', 'charity');
                          updateSettings(
                            'lightningAddress',
                            charity.lightningAddress
                          );
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.destinationOptionText,
                          eventData.paymentDestination === 'charity' &&
                            styles.destinationOptionTextSelected,
                        ]}
                      >
                        Team Charity
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Recurring Event Options */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Recurring Event</Text>
              <View style={styles.recurrenceOptions}>
                {(['none', 'weekly', 'biweekly', 'monthly'] as const).map(
                  (freq) => (
                    <TouchableOpacity
                      key={freq}
                      style={[
                        styles.recurrenceOption,
                        eventData.recurrence === freq &&
                          styles.recurrenceOptionSelected,
                      ]}
                      onPress={() => updateSettings('recurrence', freq)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.recurrenceOptionText,
                          eventData.recurrence === freq &&
                            styles.recurrenceOptionTextSelected,
                        ]}
                      >
                        {freq === 'none' ? 'One-Time' : freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
              {eventData.recurrence !== 'none' && (
                <Text style={styles.formHelper}>
                  Event will automatically repeat {eventData.recurrence}
                </Text>
              )}
            </View>

            {/* Day Selection (only for weekly/biweekly) */}
            {(eventData.recurrence === 'weekly' ||
              eventData.recurrence === 'biweekly') && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Reset Day</Text>
                <View style={styles.dayOptions}>
                  {(
                    [
                      'monday',
                      'tuesday',
                      'wednesday',
                      'thursday',
                      'friday',
                      'saturday',
                      'sunday',
                    ] as const
                  ).map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayOption,
                        eventData.recurrenceDay === day &&
                          styles.dayOptionSelected,
                      ]}
                      onPress={() => updateSettings('recurrenceDay', day)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dayOptionText,
                          eventData.recurrenceDay === day &&
                            styles.dayOptionTextSelected,
                        ]}
                      >
                        {day.slice(0, 3).toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.formHelper}>
                  Leaderboard will reset every{' '}
                  {eventData.recurrence === 'biweekly' ? 'other ' : ''}
                  {eventData.recurrenceDay || 'selected day'} at midnight
                </Text>
              </View>
            )}
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
        wizardTitle="Create Event"
        onClose={onClose}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onComplete={handleComplete}
        canGoNext={steps[currentStep]?.isValid}
        canGoPrevious={currentStep > 0}
        isLastStep={currentStep === steps.length - 1}
        isProcessing={isCreating}
        processingText="Creating Event..."
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

      {/* Event Announcement Preview Modal */}
      {createdEventData && (
        <EventAnnouncementPreview
          visible={showAnnouncementPreview}
          eventData={createdEventData}
          onClose={() => {
            setShowAnnouncementPreview(false);
            const eventIdForNavigation = createdEventData.eventId;
            setCreatedEventData(null);
            // ✅ FIX: Close wizard after user dismisses announcement preview
            onClose();
            // ✅ FIX: Navigate to EventDetailScreen after wizard closes
            console.log('🚀 Navigating to EventDetail screen:', eventIdForNavigation);
            navigation.navigate('EventDetail', { eventId: eventIdForNavigation });
          }}
          onPublished={() => {
            console.log('✅ Event announcement published successfully');
          }}
        />
      )}
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
    marginBottom: 16,
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
    lineHeight: 16,
  },

  // Date selection styles
  quickDateOptions: {
    gap: 12,
  },

  quickDateOption: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  quickDateOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.background,
  },

  quickDateOptionText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },

  quickDateOptionTextSelected: {
    color: theme.colors.accent,
  },

  quickDateOptionDate: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },

  // Prize pool styles
  prizePoolOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  prizeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
  },

  prizeOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.background,
  },

  prizeOptionText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },

  prizeOptionTextSelected: {
    color: theme.colors.accent,
  },

  // Payment destination styles
  destinationOptions: {
    flexDirection: 'row',
    gap: 12,
  },

  destinationOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    alignItems: 'center',
  },

  destinationOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.background,
  },

  destinationOptionText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },

  destinationOptionTextSelected: {
    color: theme.colors.accent,
  },

  // Entry fee options styles (NEW)
  entryFeeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  entryFeeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
  },

  entryFeeOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.background,
  },

  entryFeeOptionText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },

  entryFeeOptionTextSelected: {
    color: theme.colors.accent,
  },

  // Recurrence options styles (NEW - simplified)
  recurrenceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  recurrenceOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
  },

  recurrenceOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.background,
  },

  recurrenceOptionText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },

  recurrenceOptionTextSelected: {
    color: theme.colors.accent,
  },

  // Day options styles (NEW)
  dayOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  dayOption: {
    width: 48,
    height: 48,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dayOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.background,
  },

  dayOptionText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },

  dayOptionTextSelected: {
    color: theme.colors.accent,
  },
});
