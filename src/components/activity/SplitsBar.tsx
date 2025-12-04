/**
 * SplitsBar - Horizontal scrolling display of kilometer splits
 * Shows pace for each completed kilometer during a run
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../../styles/theme';

interface Split {
  km: number;
  time: string; // "5:12" format
}

interface SplitsBarProps {
  splits: Split[];
  isVisible: boolean;
}

export const SplitsBar: React.FC<SplitsBarProps> = ({ splits, isVisible }) => {
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to the latest split when a new one is added
  useEffect(() => {
    if (splits.length > 0 && scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [splits.length]);

  if (!isVisible || splits.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>SPLITS</Text>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {splits.map((split, index) => {
          const isLatest = index === splits.length - 1;
          return (
            <View
              key={`split-${split.km}`}
              style={[styles.splitItem, isLatest && styles.latestSplit]}
            >
              <Text style={[styles.kmLabel, isLatest && styles.latestText]}>
                {split.km}
              </Text>
              <Text style={[styles.timeValue, isLatest && styles.latestText]}>
                {split.time}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  label: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  scrollContent: {
    paddingRight: 16,
  },
  splitItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 60,
  },
  latestSplit: {
    backgroundColor: theme.colors.text,
    borderColor: theme.colors.text,
  },
  kmLabel: {
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  latestText: {
    color: theme.colors.background,
  },
});
