/**
 * CalorieTrendChart - 7-day calorie trend visualization
 * Simple bar chart showing daily balance
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../styles/theme';
import type { DailyCalorieBalance } from '../../services/analytics/CaloricAnalyticsService';

interface CalorieTrendChartProps {
  last7Days: DailyCalorieBalance[];
  weeklyAverage: { in: number; out: number; net: number };
}

export const CalorieTrendChart: React.FC<CalorieTrendChartProps> = ({
  last7Days,
  weeklyAverage,
}) => {
  // Find max absolute value for scaling
  const maxAbsValue = Math.max(
    ...last7Days.map((d) => Math.abs(d.netBalance)),
    1000 // Min scale
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weekly Trend</Text>

      {/* Chart */}
      <View style={styles.chart}>
        {last7Days.map((day, index) => {
          const dayLabel = new Date(day.date)
            .toLocaleDateString('en-US', { weekday: 'short' })
            .charAt(0);
          const heightPercent = Math.min(
            (Math.abs(day.netBalance) / maxAbsValue) * 100,
            100
          );
          const isSurplus = day.netBalance >= 0;

          return (
            <View key={day.date} style={styles.bar}>
              <View style={styles.barWrapper}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${heightPercent}%`,
                      backgroundColor: isSurplus ? '#FF9D42' : '#FF7B1C',
                    },
                  ]}
                />
              </View>
              <Text style={styles.dayLabel}>{dayLabel}</Text>
            </View>
          );
        })}
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Avg Daily:</Text>
        <Text
          style={[
            styles.summaryValue,
            { color: weeklyAverage.net >= 0 ? '#FF9D42' : '#FF7B1C' },
          ]}
        >
          {weeklyAverage.net >= 0 ? '+' : ''}
          {weeklyAverage.net} kcal
        </Text>
        <Text style={styles.summarySubtext}>
          ({weeklyAverage.net >= 0 ? 'Surplus' : 'Deficit'})
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 20,
    marginBottom: 16,
  },

  title: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: '#FFB366',
    marginBottom: 16,
  },

  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    marginBottom: 16,
    gap: 8,
  },

  bar: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },

  barWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  barFill: {
    width: '80%',
    borderRadius: 4,
    minHeight: 4,
  },

  dayLabel: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },

  summaryLabel: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginRight: 8,
  },

  summaryValue: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
  },

  summarySubtext: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginLeft: 8,
  },
});
