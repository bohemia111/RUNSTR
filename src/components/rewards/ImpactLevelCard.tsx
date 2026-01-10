/**
 * ImpactLevelCard Component
 * Hero display for Impact Level system - shows donation-based level with progress ring
 *
 * Features:
 * - Big circular level display with XP progress ring
 * - Level title (e.g., "Champion")
 * - 7-dot weekly donation streak indicator
 * - XP progress to next level
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { ImpactLevelService } from '../../services/impact/ImpactLevelService';
import type { ImpactStats } from '../../types/impactLevel';
import { DONATION_STREAK_MULTIPLIERS, IMPACT_XP_CONSTANTS } from '../../types/impactLevel';

interface ImpactLevelCardProps {
  pubkey: string;
}

export const ImpactLevelCard: React.FC<ImpactLevelCardProps> = ({ pubkey }) => {
  const [stats, setStats] = useState<ImpactStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showExplainer, setShowExplainer] = useState(false);

  useEffect(() => {
    loadImpactStats();
  }, [pubkey]);

  const loadImpactStats = async () => {
    try {
      setIsLoading(true);
      const impactStats = await ImpactLevelService.getImpactStats(pubkey);
      setStats(impactStats);
    } catch (error) {
      console.error('[ImpactLevelCard] Failed to load impact stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // SVG circle parameters - compact size
  const size = 90;
  const strokeWidth = 8;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate stroke dash offset for progress
  const progress = stats?.level.progress || 0;
  const strokeDashoffset = circumference * (1 - progress);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="heart-outline" size={32} color="#666" />
          <Text style={styles.emptyText}>Start donating to build your Impact Level!</Text>
        </View>
      </View>
    );
  }

  const currentMultiplier = ImpactLevelService.getStreakMultiplier(stats.currentStreak);

  return (
    <View style={styles.container}>
      {/* Header row with title and tap hint */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="trophy" size={16} color="#FF9D42" />
          <Text style={styles.headerTitle}>IMPACT LEVEL</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowExplainer(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="information-circle-outline" size={18} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Main content: Ring on left, stats on right */}
      <View style={styles.mainContent}>
        {/* Tappable ring */}
        <TouchableOpacity
          style={styles.ringContainer}
          onPress={() => setShowExplainer(true)}
          activeOpacity={0.8}
        >
          <Svg width={size} height={size}>
            <Defs>
              <LinearGradient
                id="impactRingGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <Stop offset="0%" stopColor="#FF7B1C" stopOpacity="1" />
                <Stop offset="100%" stopColor="#FF9D42" stopOpacity="1" />
              </LinearGradient>
            </Defs>

            {/* Background circle */}
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke="#1a1a1a"
              strokeWidth={strokeWidth}
              fill="none"
            />

            {/* Progress circle */}
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke="url(#impactRingGradient)"
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${center}, ${center}`}
            />
          </Svg>

          {/* Level content in center */}
          <View style={styles.centerContent}>
            <Text style={styles.levelNumber}>{stats.level.level}</Text>
          </View>
        </TouchableOpacity>

        {/* Right side: Title + XP bar */}
        <View style={styles.statsSection}>
          <Text style={styles.levelTitle}>{stats.level.title}</Text>

          {/* XP Progress bar */}
          <View style={styles.xpProgressSection}>
            <View style={styles.xpProgressBar}>
              <View
                style={[
                  styles.xpProgressFill,
                  { width: `${Math.min(progress * 100, 100)}%` }
                ]}
              />
            </View>
            <Text style={styles.xpText}>
              {ImpactLevelService.formatXP(stats.level.currentXP)} / {ImpactLevelService.formatXP(stats.level.xpForNextLevel)} XP
            </Text>
          </View>
        </View>
      </View>

      {/* XP Explainer Modal */}
      <Modal
        visible={showExplainer}
        animationType="fade"
        transparent
        onRequestClose={() => setShowExplainer(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowExplainer(false)}
        >
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Ionicons name="heart" size={24} color="#FF9D42" />
              <Text style={styles.modalTitle}>How Impact XP Works</Text>
              <TouchableOpacity
                onPress={() => setShowExplainer(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* XP Breakdown */}
            <View style={styles.xpBreakdown}>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>Per sat donated</Text>
                <Text style={styles.xpValue}>
                  +{IMPACT_XP_CONSTANTS.XP_PER_SAT} XP
                </Text>
              </View>

              <View style={styles.xpDivider} />

              <Text style={styles.streakTitle}>Streak Multipliers</Text>
              <Text style={styles.streakSubtitle}>
                Donate daily to earn more XP!
              </Text>

              {DONATION_STREAK_MULTIPLIERS.slice().reverse().map((streak) => (
                <View key={streak.days} style={styles.xpRow}>
                  <Text style={styles.xpLabel}>
                    {streak.days === 1 ? 'First donation' : `${streak.days}+ day streak`}
                  </Text>
                  <Text style={styles.xpValue}>{streak.multiplier}x XP</Text>
                </View>
              ))}
            </View>

            {/* Current Stats */}
            <View style={styles.currentStats}>
              <Text style={styles.currentStatsTitle}>Your Impact</Text>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>Current streak</Text>
                <Text style={styles.xpValueHighlight}>{stats.currentStreak} days</Text>
              </View>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>Current multiplier</Text>
                <Text style={styles.xpValueHighlight}>{currentMultiplier}x XP</Text>
              </View>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>Total donated</Text>
                <Text style={styles.xpValueHighlight}>
                  {stats.totalSatsDonated.toLocaleString()} sats
                </Text>
              </View>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>Total XP</Text>
                <Text style={styles.xpValueHighlight}>
                  {ImpactLevelService.formatXP(stats.level.totalXP)} XP
                </Text>
              </View>
            </View>

            <Text style={styles.tipNote}>
              Tip: Donate a small amount every day to maximize your XP with streak bonuses!
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 14,
    marginBottom: 10,
  },

  loadingContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyState: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },

  emptyText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  headerTitle: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: '#FF9D42',
    letterSpacing: 1,
  },

  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 14,
  },

  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },

  levelNumber: {
    fontSize: 28,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFB366',
    lineHeight: 32,
  },

  statsSection: {
    flex: 1,
    gap: 6,
  },

  levelTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: '#FF9D42',
  },

  xpProgressSection: {
    gap: 4,
  },

  xpProgressBar: {
    width: '100%',
    height: 5,
    backgroundColor: '#1a1a1a',
    borderRadius: 3,
    overflow: 'hidden',
  },

  xpProgressFill: {
    height: '100%',
    backgroundColor: '#FF7B1C',
    borderRadius: 3,
  },

  xpText: {
    fontSize: 11,
    color: '#999',
    fontWeight: theme.typography.weights.medium,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  modalContent: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: '#FFB366',
    marginLeft: 10,
  },

  xpBreakdown: {
    marginBottom: 16,
  },

  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },

  xpLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },

  xpValue: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: '#FF9D42',
  },

  xpValueHighlight: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: '#FFB366',
  },

  xpDivider: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginVertical: 12,
  },

  streakTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 2,
  },

  streakSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },

  currentStats: {
    backgroundColor: '#1a1510',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2010',
  },

  currentStatsTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semiBold,
    color: '#FF9D42',
    marginBottom: 8,
  },

  tipNote: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
