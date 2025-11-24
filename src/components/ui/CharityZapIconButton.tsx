/**
 * CharityZapIconButton - Compact charity zap icon for user lists
 * Appears next to usernames throughout the app for quick charity donations
 * Replaces the old ChallengeIconButton (shield icon) with heart icon
 * Taps donate to the current user's selected charity
 */

import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

export interface CharityZapIconButtonProps {
  userPubkey: string;
  userName: string;
  disabled?: boolean;
  onPress: () => void;
}

export const CharityZapIconButton: React.FC<CharityZapIconButtonProps> = ({
  userPubkey,
  userName,
  disabled = false,
  onPress,
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handlePressIn = () => {
    if (!disabled) {
      setIsPressed(true);
    }
  };

  const handlePressOut = () => {
    setIsPressed(false);
  };

  const handlePress = () => {
    if (!disabled) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isPressed && styles.containerPressed,
        disabled && styles.containerDisabled,
      ]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityLabel={`Support charity for ${userName}`}
      accessibilityHint="Opens charity donation modal"
      accessibilityRole="button"
    >
      <Ionicons
        name="heart-outline"
        size={14}
        color={
          disabled
            ? theme.colors.textMuted
            : isPressed
            ? '#FF9D42' // Orange heart when pressed
            : theme.colors.textMuted
        }
        style={{ opacity: disabled ? 0.3 : isPressed ? 1 : 0.6 }}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: theme.borderRadius.small,
    padding: 4,
  },
  containerPressed: {
    backgroundColor: 'transparent',
  },
  containerDisabled: {
    backgroundColor: 'transparent',
  },
});
