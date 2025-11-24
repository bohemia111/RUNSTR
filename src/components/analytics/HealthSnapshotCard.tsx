/**
 * HealthSnapshotCard - 3-column display of BMI, VO2 Max, and Fitness Age
 * Privacy-preserving health metrics calculated locally
 * Tap card to navigate to HealthProfileScreen for input
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import type { BodyCompositionMetrics, VO2MaxData } from '../../types/analytics';

interface HealthSnapshotCardProps {
  bodyComposition?: BodyCompositionMetrics;
  vo2MaxData?: VO2MaxData;
}

export const HealthSnapshotCard: React.FC<HealthSnapshotCardProps> = ({
  bodyComposition,
  vo2MaxData,
}) => {
  const navigation = useNavigation();

  const handlePress = () => {
    // @ts-ignore - Navigation type not defined for HealthProfile
    navigation.navigate('HealthProfile');
  };

  // If no data, show prompt
  if (!bodyComposition && !vo2MaxData) {
    return (
      <TouchableOpacity
        style={styles.emptyCard}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Ionicons
          name="person-outline"
          size={32}
          color={theme.colors.orangeBright}
          style={{ marginBottom: 8 }}
        />
        <Text style={styles.emptyText}>
          Tap to add weight & height for BMI and fitness age estimates
        </Text>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={theme.colors.textMuted}
          style={{ marginTop: 4 }}
        />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* BMI Column */}
      <View style={styles.column}>
        <Text style={styles.label}>BMI</Text>
        {bodyComposition ? (
          <>
            <Text style={styles.value}>{bodyComposition.currentBMI}</Text>
            <Text style={styles.category}>
              {bodyComposition.bmiCategory.charAt(0).toUpperCase() +
                bodyComposition.bmiCategory.slice(1)}
            </Text>
          </>
        ) : (
          <Text style={styles.noData}>-</Text>
        )}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* VO2 Max Column */}
      <View style={styles.column}>
        <Text style={styles.label}>VO₂ Max</Text>
        {vo2MaxData ? (
          <>
            <Text style={styles.value}>{vo2MaxData.estimate}</Text>
            <Text style={styles.category}>
              {vo2MaxData.category.charAt(0).toUpperCase() +
                vo2MaxData.category.slice(1)}
            </Text>
          </>
        ) : (
          <Text style={styles.noData}>-</Text>
        )}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Fitness Age Column */}
      <View style={styles.column}>
        <Text style={styles.label}>Fitness Age</Text>
        {vo2MaxData ? (
          <>
            <Text style={styles.value}>{vo2MaxData.fitnessAge}</Text>
            <Text style={styles.category}>years</Text>
          </>
        ) : (
          <Text style={styles.noData}>-</Text>
        )}
      </View>

      {/* Edit Indicator */}
      <View style={styles.editIndicator}>
        <Ionicons
          name="create-outline"
          size={16}
          color={theme.colors.textMuted}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 20,
    marginBottom: 16,
  },

  column: {
    flex: 1,
    alignItems: 'center',
  },

  divider: {
    width: 1,
    backgroundColor: '#1a1a1a',
    marginHorizontal: 12,
  },

  label: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semiBold,
    color: '#CC7A33',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  value: {
    fontSize: 28,
    fontWeight: theme.typography.weights.bold,
    color: '#FF9D42',
    marginBottom: 4,
  },

  category: {
    fontSize: 13,
    fontWeight: theme.typography.weights.medium,
    color: '#FFB366',
  },

  noData: {
    fontSize: 28,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textMuted,
    marginTop: 8,
  },

  emptyCard: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },

  emptyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  editIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
});
