/**
 * SelectActivityStep - First step in challenge creation
 * User selects the activity type (running, cycling, pushups, etc.)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../../../styles/theme';
import type { ActivityType } from '../../../types/challenge';

interface SelectActivityStepProps {
  selectedActivity?: ActivityType;
  onSelectActivity: (activity: ActivityType) => void;
}

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'running', label: 'Running' },
  { value: 'walking', label: 'Walking' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'pushups', label: 'Pushups' },
  { value: 'pullups', label: 'Pullups' },
  { value: 'situps', label: 'Situps' },
];

export const SelectActivityStep: React.FC<SelectActivityStepProps> = ({
  selectedActivity,
  onSelectActivity,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.optionsGrid}>
        {ACTIVITY_TYPES.map((activity) => (
          <TouchableOpacity
            key={activity.value}
            style={[
              styles.activityOption,
              selectedActivity === activity.value &&
                styles.activityOptionSelected,
            ]}
            onPress={() => onSelectActivity(activity.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.activityLabel,
                selectedActivity === activity.value &&
                  styles.activityLabelSelected,
              ]}
            >
              {activity.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  activityOption: {
    width: '48%',
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.border,
  },
  activityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  activityLabelSelected: {
    color: theme.colors.text,
  },
});
