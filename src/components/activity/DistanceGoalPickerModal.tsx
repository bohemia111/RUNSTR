/**
 * DistanceGoalPickerModal - Modal for selecting weekly distance goal
 * Supports both running and cycling with different preset options
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

type ActivityType = 'running' | 'cycling';

interface DistanceGoalPickerModalProps {
  visible: boolean;
  activityType: ActivityType;
  currentGoal: number;
  onSelectGoal: (goal: number) => void;
  onClose: () => void;
}

const RUNNING_GOALS = [
  { label: '10 km/week', value: 10 },
  { label: '20 km/week', value: 20 },
  { label: '30 km/week', value: 30 },
  { label: '50 km/week', value: 50 },
  { label: '75 km/week', value: 75 },
  { label: '100 km/week', value: 100 },
];

const CYCLING_GOALS = [
  { label: '25 km/week', value: 25 },
  { label: '50 km/week', value: 50 },
  { label: '100 km/week', value: 100 },
  { label: '150 km/week', value: 150 },
  { label: '200 km/week', value: 200 },
  { label: '300 km/week', value: 300 },
];

export const DistanceGoalPickerModal: React.FC<DistanceGoalPickerModalProps> = ({
  visible,
  activityType,
  currentGoal,
  onSelectGoal,
  onClose,
}) => {
  const goals = activityType === 'running' ? RUNNING_GOALS : CYCLING_GOALS;
  const icon = activityType === 'running' ? 'walk' : 'bicycle';
  const title = activityType === 'running'
    ? 'Set Weekly Running Goal'
    : 'Set Weekly Cycling Goal';

  const handleSelectGoal = (goal: number) => {
    onSelectGoal(goal);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Ionicons
                name={icon}
                size={24}
                color={theme.colors.orangeBright}
              />
              <Text style={styles.title}>{title}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Goal Options */}
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {goals.map((option) => {
              const isSelected = option.value === currentGoal;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    isSelected && styles.optionButtonSelected,
                  ]}
                  onPress={() => handleSelectGoal(option.value)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionContent}>
                    <Ionicons
                      name="trophy"
                      size={20}
                      color={
                        isSelected
                          ? theme.colors.orangeBright
                          : theme.colors.textMuted
                      }
                    />
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={theme.colors.orangeBright}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    maxHeight: 400,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  optionButtonSelected: {
    backgroundColor: theme.colors.background,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  optionTextSelected: {
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.orangeBright,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textMuted,
  },
});
