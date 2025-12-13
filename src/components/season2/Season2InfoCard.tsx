/**
 * Season2InfoCard - Info card with dates and prize summary
 * Tappable to open explainer modal
 */

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { useSeason2Status } from '../../hooks/useSeason2';
import { formatSats } from '../../constants/season2';

interface Season2InfoCardProps {
  onPress: () => void;
}

export const Season2InfoCard: React.FC<Season2InfoCardProps> = ({ onPress }) => {
  const { dateRange, prizePoolLottery, prizePoolCharity, status } =
    useSeason2Status();

  const getStatusBadge = () => {
    switch (status) {
      case 'upcoming':
        return { label: 'UPCOMING', color: theme.colors.textMuted };
      case 'active':
        return { label: 'LIVE', color: theme.colors.success };
      case 'ended':
        return { label: 'ENDED', color: theme.colors.textDark };
    }
  };

  const badge = getStatusBadge();

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.topRow}>
        <View style={styles.dateSection}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color={theme.colors.textMuted}
          />
          <Text style={styles.dateText}>{dateRange}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: badge.color }]}>
          <Text style={styles.statusText}>{badge.label}</Text>
        </View>
      </View>

      <View style={styles.prizeRow}>
        <View style={styles.prizeItem}>
          <Text style={styles.prizeAmount}>
            {formatSats(prizePoolLottery)}
          </Text>
          <Text style={styles.prizeLabel}>Lottery</Text>
        </View>
        <View style={styles.prizeDivider} />
        <View style={styles.prizeItem}>
          <Text style={styles.prizeAmount}>
            {formatSats(prizePoolCharity)}
          </Text>
          <Text style={styles.prizeLabel}>Charity Prizes</Text>
        </View>
      </View>

      <View style={styles.infoHint}>
        <Text style={styles.infoHintText}>Tap for details</Text>
        <Ionicons
          name="information-circle-outline"
          size={16}
          color={theme.colors.textMuted}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.large,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    color: theme.colors.text,
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.small,
  },
  statusText: {
    color: theme.colors.background,
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
  },
  prizeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    marginBottom: 12,
  },
  prizeItem: {
    alignItems: 'center',
  },
  prizeAmount: {
    color: theme.colors.accent,
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
  },
  prizeLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  prizeDivider: {
    width: 1,
    height: 32,
    backgroundColor: theme.colors.border,
  },
  infoHint: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  infoHintText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
});

export default Season2InfoCard;
