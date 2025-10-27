/**
 * HoldToStartButton - Hold-down button with circular progress indicator
 * User must hold for 2 seconds to trigger start action
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../../styles/theme';

interface HoldToStartButtonProps {
  label: string;
  onHoldComplete: () => void;
  disabled?: boolean;
  holdDuration?: number; // milliseconds (default 2000)
}

export const HoldToStartButton: React.FC<HoldToStartButtonProps> = ({
  label,
  onHoldComplete,
  disabled = false,
  holdDuration = 2000,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: () => {
        // User started pressing
        startHoldAnimation();
      },
      onPanResponderRelease: () => {
        // User released before completing
        cancelHoldAnimation();
      },
      onPanResponderTerminate: () => {
        // Touch was interrupted
        cancelHoldAnimation();
      },
    })
  ).current;

  const startHoldAnimation = () => {
    // Start circular progress animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: holdDuration,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        // Hold completed successfully
        handleHoldComplete();
      }
    });
  };

  const cancelHoldAnimation = () => {
    // Stop and reset animation
    progressAnim.stopAnimation();
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();

    // Clear any pending timers
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handleHoldComplete = () => {
    // Haptic feedback when hold completes
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    // Reset animation
    progressAnim.setValue(0);

    // Trigger callback
    onHoldComplete();
  };

  // Calculate rotation for progress indicator (0 to 360 degrees)
  const rotation = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Calculate opacity for progress arc
  const opacity = progressAnim.interpolate({
    inputRange: [0, 0.1, 1],
    outputRange: [0, 1, 1],
  });

  return (
    <View
      style={[styles.container, disabled && styles.containerDisabled]}
      {...panResponder.panHandlers}
    >
      {/* Background circle */}
      <View style={styles.backgroundCircle} />

      {/* Progress indicator */}
      <Animated.View
        style={[
          styles.progressCircle,
          {
            opacity,
            transform: [{ rotate: rotation }],
          },
        ]}
      >
        <View style={styles.progressArc} />
      </Animated.View>

      {/* Label text */}
      <View style={styles.labelContainer}>
        <Text style={[styles.label, disabled && styles.labelDisabled]}>
          {label}
        </Text>
        <Text style={[styles.hint, disabled && styles.hintDisabled]}>
          Hold to start
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  containerDisabled: {
    opacity: 0.5,
  },
  backgroundCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: theme.colors.card,
    borderWidth: 3,
    borderColor: theme.colors.border,
  },
  progressCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: theme.colors.accent,
    borderRightColor: theme.colors.accent,
  },
  progressArc: {
    width: '100%',
    height: '100%',
  },
  labelContainer: {
    alignItems: 'center',
    zIndex: 1,
  },
  label: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  labelDisabled: {
    color: theme.colors.textMuted,
  },
  hint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  hintDisabled: {
    color: theme.colors.border,
  },
});
