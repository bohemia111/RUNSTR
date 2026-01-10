import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

interface AboutPrizeSectionProps {
  description: string;
  prizePool: number;
  onCaptainDashboard: () => void;
  // onJoinTeam?: () => void; // REMOVED: Teams are bookmarks, join happens on discovery page
  isCaptain: boolean;
  // isMember: boolean; // REMOVED: No membership status needed for teams
  captainLoading?: boolean;
}

export const AboutPrizeSection: React.FC<AboutPrizeSectionProps> = ({
  description,
  prizePool,
  onCaptainDashboard,
  // onJoinTeam, // REMOVED: Teams are bookmarks, join happens on discovery page
  isCaptain,
  // isMember, // REMOVED: No membership status needed for teams
  captainLoading = false,
}) => {
  // Debug logging for captain button rendering
  console.log('🎖️ AboutPrizeSection: Render props debug:', {
    isCaptain,
    captainLoading,
    hasOnCaptainDashboard: !!onCaptainDashboard,
  });
  const formatPrizePool = (amount: number): string => {
    return amount.toLocaleString();
  };

  return (
    <View style={styles.topSection}>
      <View style={styles.aboutSection}>
        <Text style={styles.aboutTitle}>About</Text>
        <Text style={styles.aboutText}>{description}</Text>
      </View>
      <View style={styles.prizeSection}>
        <View style={styles.prizeAmount}>
          <Text style={styles.prizeNumber}>{formatPrizePool(prizePool)}</Text>
          <Text style={styles.prizeCurrency}>Prize pool</Text>
        </View>
        <View style={styles.buttonContainer}>
          {/* REMOVED: Join Team / Joined button - teams are bookmarks now, join happens on team discovery page */}

          {/* Captain Dashboard Button - Always show, validate on click */}
          <TouchableOpacity
            style={[styles.captainButton, captainLoading && styles.captainButtonDisabled]}
            onPress={() => {
              if (!captainLoading && onCaptainDashboard) {
                onCaptainDashboard();
              }
            }}
            disabled={captainLoading}
          >
            {captainLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <>
                <Ionicons name="shield-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.captainButtonText}>Captain</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topSection: {
    flexDirection: 'row',
    gap: 12,
    flexShrink: 0,
  },
  aboutSection: {
    flex: 1,
  },
  aboutTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  aboutText: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    lineHeight: 18,
  },
  prizeSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  prizeAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 4,
  },
  prizeNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
  },
  prizeCurrency: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  buttonContainer: {
    gap: 8,
    alignItems: 'flex-end',
    marginTop: 8,
  },
  captainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    minWidth: 100,
  },
  captainButtonDisabled: {
    opacity: 0.5,
  },
  captainButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
});
