/**
 * HolisticHealthScoreCard - Overall health score display
 * Shows 0-100 overall score with category breakdown
 * Includes trend indicator and personalized recommendations
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import type { HolisticHealthScore } from '../../types/analytics';

interface HolisticHealthScoreCardProps {
  healthScore?: HolisticHealthScore;
}

export const HolisticHealthScoreCard: React.FC<
  HolisticHealthScoreCardProps
> = ({ healthScore }) => {
  if (!healthScore) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons
          name="fitness-outline"
          size={32}
          color={theme.colors.textMuted}
        />
        <Text style={styles.emptyText}>
          Complete more workouts to see your holistic health score
        </Text>
      </View>
    );
  }

  const getTrendIcon = () => {
    if (healthScore.trend === 'improving') return 'trending-up';
    if (healthScore.trend === 'declining') return 'trending-down';
    return 'remove-outline';
  };

  const getTrendColor = () => {
    if (healthScore.trend === 'improving') return theme.colors.orangeBright;
    if (healthScore.trend === 'declining') return '#FF5722';
    return theme.colors.textMuted;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return theme.colors.orangeBright; // Excellent - Orange
    if (score >= 60) return '#FF9D42'; // Good - Orange
    if (score >= 40) return '#FFB366'; // Fair - Light Orange
    return '#FF5722'; // Needs Work - Red
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>Health Score</Text>
        <View style={styles.trendBadge}>
          <Ionicons
            name={getTrendIcon() as any}
            size={16}
            color={getTrendColor()}
          />
          <Text style={[styles.trendText, { color: getTrendColor() }]}>
            {healthScore.trend.charAt(0).toUpperCase() +
              healthScore.trend.slice(1)}
          </Text>
        </View>
      </View>

      {/* Overall Score Circle */}
      <View style={styles.scoreSection}>
        <View
          style={[
            styles.scoreCircle,
            { borderColor: getScoreColor(healthScore.overall) },
          ]}
        >
          <Text
            style={[
              styles.scoreValue,
              { color: getScoreColor(healthScore.overall) },
            ]}
          >
            {healthScore.overall}
          </Text>
          <Text style={styles.scoreLabel}>/ 100</Text>
        </View>
        <Text style={styles.category}>{healthScore.category}</Text>
      </View>

      {/* Category Breakdown */}
      <View style={styles.categories}>
        <CategoryBar
          label="Cardio"
          score={healthScore.cardio}
          color="#2196F3"
          icon="walk-outline"
        />
        <CategoryBar
          label="Strength"
          score={healthScore.strength}
          color="#FF5722"
          icon="barbell-outline"
        />
        <CategoryBar
          label="Wellness"
          score={healthScore.wellness}
          color="#9C27B0"
          icon="flower-outline"
        />
        <CategoryBar
          label="Nutrition"
          score={healthScore.nutrition}
          color={theme.colors.orangeBright}
          icon="restaurant-outline"
        />
      </View>

      {/* Balance Indicator */}
      <View style={styles.balanceSection}>
        <Ionicons
          name="analytics-outline"
          size={16}
          color={theme.colors.textMuted}
        />
        <Text style={styles.balanceLabel}>Balance Score</Text>
        <Text
          style={[
            styles.balanceValue,
            { color: getScoreColor(healthScore.balance) },
          ]}
        >
          {healthScore.balance}/100
        </Text>
      </View>

      {/* Recommendations */}
      {healthScore.recommendations.length > 0 && (
        <View style={styles.recommendations}>
          <Text style={styles.recommendationsTitle}>Top Recommendations</Text>
          {healthScore.recommendations.slice(0, 2).map((rec, index) => (
            <View key={index} style={styles.recommendationItem}>
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={theme.colors.orangeBright}
              />
              <Text style={styles.recommendationText}>{rec}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// Category Bar Component
interface CategoryBarProps {
  label: string;
  score: number;
  color: string;
  icon: string;
}

const CategoryBar: React.FC<CategoryBarProps> = ({
  label,
  score,
  color,
  icon,
}) => {
  return (
    <View style={styles.categoryRow}>
      <View style={styles.categoryLeft}>
        <Ionicons name={icon as any} size={16} color={color} />
        <Text style={styles.categoryLabel}>{label}</Text>
      </View>
      <View style={styles.categoryRight}>
        <View style={styles.barContainer}>
          <View
            style={[
              styles.barFill,
              { width: `${score}%`, backgroundColor: color },
            ]}
          />
        </View>
        <Text style={[styles.categoryScore, { color }]}>{score}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    marginBottom: 24,
  },

  emptyCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 32,
    marginBottom: 24,
    alignItems: 'center',
  },

  emptyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  heading: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },

  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
  },

  trendText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
  },

  scoreSection: {
    alignItems: 'center',
    marginBottom: 24,
  },

  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  scoreValue: {
    fontSize: 40,
    fontWeight: theme.typography.weights.bold,
  },

  scoreLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },

  category: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.orangeBright,
  },

  categories: {
    gap: 12,
    marginBottom: 16,
  },

  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 0.3,
  },

  categoryLabel: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
  },

  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 0.7,
  },

  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.card,
    borderRadius: 4,
    overflow: 'hidden',
  },

  barFill: {
    height: '100%',
    borderRadius: 4,
  },

  categoryScore: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    width: 30,
    textAlign: 'right',
  },

  balanceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginBottom: 16,
  },

  balanceLabel: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textMuted,
  },

  balanceValue: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
  },

  recommendations: {
    backgroundColor: 'rgba(255, 157, 66, 0.1)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 66, 0.2)',
  },

  recommendationsTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.orangeBright,
    marginBottom: 8,
  },

  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },

  recommendationText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.text,
    lineHeight: 18,
  },
});
