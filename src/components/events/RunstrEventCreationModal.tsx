/**
 * RunstrEventCreationModal - Single-page event creation wizard
 *
 * Compact modal for creating RUNSTR events with configurable
 * scoring, payouts, and join methods.
 */

import React, { useState } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { theme } from '../../styles/theme';
import { CustomAlert } from '../ui/CustomAlert';
import {
  useRunstrEventCreation,
  ACTIVITY_OPTIONS,
  SCORING_OPTIONS,
  DURATION_OPTIONS,
  JOIN_OPTIONS,
  PAYOUT_OPTIONS,
  DISTANCE_OPTIONS,
} from '../../hooks/useRunstrEventCreation';

interface RunstrEventCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onEventCreated?: (eventId: string) => void;
}

export const RunstrEventCreationModal: React.FC<
  RunstrEventCreationModalProps
> = ({ visible, onClose, onEventCreated }) => {
  const {
    form,
    updateField,
    resetForm,
    isValid,
    validPayoutSchemes,
    isSubmitting,
    submitError,
    submitEvent,
    showDistanceInput,
    showEntryFeeInput,
    showFixedPayoutInput,
  } = useRunstrEventCreation();

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    const result = await submitEvent();

    if (result.success) {
      setAlertTitle('Event Created!');
      setAlertMessage(
        'Your event has been published to Nostr. It will appear in the events feed shortly.'
      );
      setAlertVisible(true);
      onEventCreated?.(result.eventId || '');
    } else {
      setAlertTitle('Error');
      setAlertMessage(result.error || 'Failed to create event');
      setAlertVisible(true);
    }
  };

  const handleAlertDismiss = () => {
    setAlertVisible(false);
    if (alertTitle === 'Event Created!') {
      handleClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Create Event</Text>
          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Event Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Event Name</Text>
              <TextInput
                style={styles.textInput}
                value={form.title}
                onChangeText={(text) => updateField('title', text)}
                placeholder="e.g., New Year's 5K Challenge"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>

            {/* Activity Type */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Activity</Text>
              <View style={styles.buttonRow}>
                {ACTIVITY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.optionButton,
                      form.activityType === opt.value &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() => updateField('activityType', opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        form.activityType === opt.value &&
                          styles.optionButtonTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Scoring Type */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Scoring</Text>
              <View style={styles.buttonRow}>
                {SCORING_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.optionButton,
                      form.scoringType === opt.value &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() => updateField('scoringType', opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        form.scoringType === opt.value &&
                          styles.optionButtonTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Target Distance (for fastest_time) */}
            {showDistanceInput && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Distance</Text>
                <View style={styles.buttonRow}>
                  {DISTANCE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.optionButton,
                        form.targetDistance === opt.value &&
                          styles.optionButtonSelected,
                      ]}
                      onPress={() => updateField('targetDistance', opt.value)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.optionButtonText,
                          form.targetDistance === opt.value &&
                            styles.optionButtonTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Duration */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Duration</Text>
              <View style={styles.buttonRow}>
                {DURATION_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.optionButton,
                      form.duration === opt.value &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() => updateField('duration', opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        form.duration === opt.value &&
                          styles.optionButtonTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Join Method */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Join Method</Text>
              <View style={styles.buttonRow}>
                {JOIN_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.optionButton,
                      form.joinMethod === opt.value &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() => updateField('joinMethod', opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        form.joinMethod === opt.value &&
                          styles.optionButtonTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Entry Fee (for paid events) */}
            {showEntryFeeInput && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Entry Fee (sats)</Text>
                <TextInput
                  style={styles.textInput}
                  value={form.entryFee}
                  onChangeText={(text) => updateField('entryFee', text)}
                  placeholder="e.g., 2100"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                />
              </View>
            )}

            {/* Payout Scheme */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Payout</Text>
              <View style={styles.buttonRowWrap}>
                {PAYOUT_OPTIONS.filter((opt) =>
                  validPayoutSchemes.includes(opt.value)
                ).map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.optionButtonSmall,
                      form.payoutScheme === opt.value &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() => updateField('payoutScheme', opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionButtonTextSmall,
                        form.payoutScheme === opt.value &&
                          styles.optionButtonTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Prize Pool */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Prize Pool (sats)</Text>
              <TextInput
                style={styles.textInput}
                value={form.prizePool}
                onChangeText={(text) => updateField('prizePool', text)}
                placeholder="e.g., 21000"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
              />
              <Text style={styles.helper}>
                Auto-paid from your NWC wallet when event ends
              </Text>
            </View>

            {/* Fixed Payout Amount (for fixed_amount scheme) */}
            {showFixedPayoutInput && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Amount Per Person (sats)</Text>
                <TextInput
                  style={styles.textInput}
                  value={form.fixedPayout}
                  onChangeText={(text) => updateField('fixedPayout', text)}
                  placeholder="e.g., 1000"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                />
              </View>
            )}

            {/* Error display */}
            {submitError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            )}

            {/* Bottom padding for scroll */}
            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Footer with Create Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.createButton,
              (!isValid || isSubmitting) && styles.createButtonDisabled,
            ]}
            onPress={handleCreate}
            disabled={!isValid || isSubmitting}
            activeOpacity={0.7}
          >
            {isSubmitting ? (
              <ActivityIndicator color={theme.colors.background} />
            ) : (
              <Text style={styles.createButtonText}>Create Event</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Alert */}
        <CustomAlert
          visible={alertVisible}
          title={alertTitle}
          message={alertMessage}
          buttons={[{ text: 'OK', style: 'default', onPress: handleAlertDismiss }]}
          onClose={handleAlertDismiss}
        />
      </SafeAreaView>
    </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: theme.colors.text,
  },
  title: {
    fontSize: 18,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },
  headerSpacer: {
    width: 32,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  helper: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  optionButtonSmall: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  optionButtonSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  optionButtonTextSmall: {
    fontSize: 13,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  optionButtonTextSelected: {
    color: theme.colors.background,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  createButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.background,
  },
});

export default RunstrEventCreationModal;
