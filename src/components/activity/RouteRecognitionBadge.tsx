/**
 * RouteRecognitionBadge - Shows when a saved route is detected during workout
 * Displays route name and match confidence to the user
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

interface RouteRecognitionBadgeProps {
  routeName: string;
  confidence: number; // 0-1 match confidence
  isVisible: boolean;
}

export const RouteRecognitionBadge: React.FC<RouteRecognitionBadgeProps> = ({
  routeName,
  confidence,
  isVisible,
}) => {
  if (!isVisible) return null;

  // Determine badge color based on confidence
  const getBadgeColor = () => {
    if (confidence >= 0.9) return theme.colors.text; // High confidence
    if (confidence >= 0.7) return theme.colors.orangeBright; // Medium confidence
    return theme.colors.textMuted; // Low confidence
  };

  const getConfidenceText = () => {
    if (confidence >= 0.9) return 'On Route';
    if (confidence >= 0.7) return 'Near Route';
    return 'Possible Match';
  };

  return (
    <View style={[styles.container, { borderColor: getBadgeColor() }]}>
      <Ionicons name="map" size={16} color={getBadgeColor()} />
      <View style={styles.textContainer}>
        <Text style={[styles.routeName, { color: getBadgeColor() }]}>
          {routeName}
        </Text>
        <Text style={styles.confidenceText}>{getConfidenceText()}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    gap: 8,
  },
  textContainer: {
    flex: 1,
  },
  routeName: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
  },
  confidenceText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
