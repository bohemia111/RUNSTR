/**
 * SelectDurationStep - Third step in challenge creation
 * User selects how long the challenge will last
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../../../styles/theme';
import type { DurationOption } from '../../../types/challenge';

interface SelectDurationStepProps {
  selectedDuration?: DurationOption;
  onSelectDuration: (duration: DurationOption) => void;
}

const DURATION_OPTIONS: { value: DurationOption; label: string }[] = [
  { value: 3, label: '3 Days' },
  { value: 7, label: '7 Days' },
  { value: 14, label: '14 Days' },
  { value: 30, label: '30 Days' },
];

export const SelectDurationStep: React.FC<SelectDurationStepProps> = ({
  selectedDuration,
  onSelectDuration,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.durationOptions}>
        {DURATION_OPTIONS.map((duration) => (
          <TouchableOpacity
            key={duration.value}
            style={[
              styles.durationOption,
              selectedDuration === duration.value &&
                styles.durationOptionSelected,
            ]}
            onPress={() => onSelectDuration(duration.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.durationLabel,
                selectedDuration === duration.value &&
                  styles.durationLabelSelected,
              ]}
            >
              {duration.label}
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
  durationOptions: {
    gap: 12,
  },
  durationOption: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  durationOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.border,
  },
  durationLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  durationLabelSelected: {
    color: theme.colors.text,
  },
});
