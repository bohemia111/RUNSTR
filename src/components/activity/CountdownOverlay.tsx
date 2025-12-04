/**
 * CountdownOverlay - Full-screen countdown display (3-2-1-GO!)
 * Used before starting any cardio activity
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { theme } from '../../styles/theme';

type CountdownValue = 3 | 2 | 1 | 'GO' | null;

interface CountdownOverlayProps {
  countdown: CountdownValue;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  countdown,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (countdown !== null) {
      // Reset and animate
      scaleAnim.setValue(0.5);
      opacityAnim.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [countdown]);

  if (countdown === null) {
    return null;
  }

  const isGo = countdown === 'GO';

  return (
    <View style={styles.overlay}>
      <Animated.View
        style={[
          styles.countdownContainer,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <Text style={[styles.countdownText, isGo && styles.goText]}>
          {countdown}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  countdownContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 160,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    textAlign: 'center',
  },
  goText: {
    fontSize: 100,
    color: theme.colors.orangeBright, // Orange for GO
  },
});
