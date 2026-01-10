/**
 * PersonalImpactSection Component
 * Displays user's personal donation breakdown
 *
 * Features:
 * - Total sats donated
 * - Number of donations
 * - Charities supported
 * - Breakdown by charity
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { ImpactLevelService } from '../../services/impact/ImpactLevelService';
import type { ImpactStats } from '../../types/impactLevel';

interface CharityBreakdown {
  charityId: string;
  charityName: string;
  total: number;
  count: number;
}

interface PersonalImpactSectionProps {
  pubkey: string;
  defaultExpanded?: boolean;
}

export const PersonalImpactSection: React.FC<PersonalImpactSectionProps> = ({
  pubkey,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [stats, setStats] = useState<ImpactStats | null>(null);
  const [charityBreakdown, setCharityBreakdown] = useState<CharityBreakdown[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [pubkey]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [impactStats, breakdown] = await Promise.all([
        ImpactLevelService.getImpactStats(pubkey),
        ImpactLevelService.getCharityBreakdown(pubkey),
      ]);
      setStats(impactStats);
      setCharityBreakdown(breakdown);
    } catch (error) {
      console.error('[PersonalImpactSection] Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header - tap to expand/collapse */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="heart" size={18} color="#FF9D42" />
          <Text style={styles.headerTitle}>YOUR IMPACT</Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.textMuted}
        />
      </TouchableOpacity>

      {/* Expanded Content */}
      {isExpanded && (
        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.accent} />
            </View>
          ) : stats && stats.totalDonations > 0 ? (
            <>
              {/* Summary Stats */}
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {stats.totalSatsDonated.toLocaleString()}
                  </Text>
                  <Text style={styles.summaryLabel}>sats donated</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{stats.totalDonations}</Text>
                  <Text style={styles.summaryLabel}>donations</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{stats.charitiesSupported}</Text>
                  <Text style={styles.summaryLabel}>charities</Text>
                </View>
              </View>

              {/* Charity Breakdown */}
              {charityBreakdown.length > 0 && (
                <View style={styles.breakdownSection}>
                  <Text style={styles.breakdownTitle}>Charity Breakdown</Text>
                  {charityBreakdown.map((charity, index) => (
                    <View key={charity.charityId} style={styles.charityRow}>
                      <View style={styles.charityInfo}>
                        <View style={styles.rankBadge}>
                          <Text style={styles.rankText}>{index + 1}</Text>
                        </View>
                        <View style={styles.charityDetails}>
                          <Text style={styles.charityName} numberOfLines={1}>
                            {charity.charityName}
                          </Text>
                          <Text style={styles.donationCount}>
                            {charity.count} donation{charity.count !== 1 ? 's' : ''}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.charityAmount}>
                        {charity.total.toLocaleString()} sats
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={24} color="#444" />
              <Text style={styles.emptyText}>
                No donations yet. Set a donation percentage to start giving!
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    overflow: 'hidden',
    marginBottom: 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  headerTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
    color: '#FF9D42',
    letterSpacing: 1,
  },

  content: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },

  loadingContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
  },

  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },

  summaryValue: {
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
    color: '#FFB366',
    marginBottom: 4,
  },

  summaryLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: theme.typography.weights.medium,
  },

  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#1a1a1a',
  },

  breakdownSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },

  breakdownTitle: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semiBold,
    color: '#666',
    marginBottom: 12,
  },

  charityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },

  charityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1a1510',
    borderWidth: 1,
    borderColor: '#2a2010',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  rankText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: '#FF9D42',
  },

  charityDetails: {
    flex: 1,
  },

  charityName: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: 2,
  },

  donationCount: {
    fontSize: 11,
    color: '#666',
  },

  charityAmount: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: '#FFB366',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },

  emptyText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
});
