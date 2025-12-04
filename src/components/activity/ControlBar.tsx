/**
 * ControlBar - Fixed bottom control buttons for cardio tracking
 * Shows HoldToStart in idle, Pause/Stop during tracking, Resume/Stop when paused
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { HoldToStartButton } from './HoldToStartButton';

type ControlBarState = 'idle' | 'tracking' | 'paused';

interface ControlBarProps {
  state: ControlBarState;
  startLabel: string; // "Start Run", "Start Walk", "Start Ride"
  onHoldComplete: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  state,
  startLabel,
  onHoldComplete,
  onPause,
  onResume,
  onStop,
  disabled = false,
}) => {
  if (state === 'idle') {
    return (
      <View style={styles.container}>
        <HoldToStartButton
          label={startLabel}
          onHoldComplete={onHoldComplete}
          disabled={disabled}
          holdDuration={2000}
        />
      </View>
    );
  }

  // Tracking or Paused state
  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        {state === 'tracking' ? (
          <TouchableOpacity style={styles.pauseButton} onPress={onPause}>
            <Ionicons name="pause" size={32} color={theme.colors.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.resumeButton} onPress={onResume}>
            <Ionicons name="play" size={32} color={theme.colors.background} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.stopButton} onPress={onStop}>
          <Ionicons name="stop" size={32} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  pauseButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  resumeButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.text,
  },
});
