/**
 * CalorieBalanceCard - Today's calorie balance
 * Shows today's intake, burn, and net balance
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../styles/theme';
import type { DailyCalorieBalance } from '../../services/analytics/CaloricAnalyticsService';

interface CalorieBalanceCardProps {
  dailyBalance: DailyCalorieBalance;
}

export const CalorieBalanceCard: React.FC<CalorieBalanceCardProps> = ({
  dailyBalance,
}) => {
  const maxCalories = Math.max(
    dailyBalance.caloriesIn,
    dailyBalance.caloriesOut,
    1000
  ); // Min 1000 for scale

  const todayInPercentage = (dailyBalance.caloriesIn / maxCalories) * 100;
  const todayOutPercentage = (dailyBalance.caloriesOut / maxCalories) * 100;

  const isTodaySurplus = dailyBalance.netBalance > 0;
  const balanceColor = '#FF9D42'; // Always orange theme

  return (
    <View style={styles.container}>
      {/* Today's Balance */}
      <Text style={styles.sectionTitle}>Today</Text>

      <View style={styles.row}>
        <Text style={styles.label}>In:</Text>
        <View style={styles.barContainer}>
          <View
            style={[
              styles.barFill,
              styles.barIn,
              { width: `${todayInPercentage}%` },
            ]}
          />
        </View>
        <Text style={styles.value}>{dailyBalance.caloriesIn} kcal</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Out:</Text>
        <View style={styles.barContainer}>
          <View
            style={[
              styles.barFill,
              styles.barOut,
              { width: `${todayOutPercentage}%` },
            ]}
          />
        </View>
        <Text style={styles.value}>{dailyBalance.caloriesOut} kcal</Text>
      </View>

      <View style={styles.netRow}>
        <Text style={styles.netLabel}>Net:</Text>
        <Text style={[styles.netValue, { color: balanceColor }]}>
          {isTodaySurplus ? '+' : ''}
          {dailyBalance.netBalance.toLocaleString()} kcal
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

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: '#FFB366',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  daysWithData: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  label: {
    width: 40,
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
  },

  barContainer: {
    flex: 1,
    height: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },

  barFill: {
    height: '100%',
    borderRadius: 4,
  },

  barIn: {
    backgroundColor: '#FF9D42', // Orange for calories in
  },

  barOut: {
    backgroundColor: '#FF7B1C', // Darker orange for calories out (NO GREEN)
  },

  value: {
    width: 90,
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    textAlign: 'right',
  },

  netRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  netLabel: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginRight: 12,
  },

  netValue: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
  },

  divider: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginVertical: 16,
  },
});
