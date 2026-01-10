/**
 * Season2SignupSection - Registration Closed notice
 * Registration for Season 2 is now closed
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

export const Season2SignupSection: React.FC = () => {
  return (
    <View style={styles.statusContainer}>
      <Ionicons name="lock-closed" size={24} color={theme.colors.textMuted} />
      <Text style={styles.statusText}>Registration Closed</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  statusContainer: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.large,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  statusText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
});

export default Season2SignupSection;
