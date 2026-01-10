/**
 * LeaderboardEventCard - Event card for Daily Leaderboards
 *
 * Displays the leaderboards section as an event card with banner image,
 * status badge, and metadata. Clicking navigates to the Leaderboards tab.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

// RUNSTR logo image for Leaderboard card (orange ostrich on black)
const RUNSTR_LOGO = require('../../../assets/images/icon.png');

interface LeaderboardEventCardProps {
  onPress?: () => void;
}

export const LeaderboardEventCard: React.FC<LeaderboardEventCardProps> = ({
  onPress,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Event Banner Image */}
      <View style={styles.imageContainer}>
        {!imageLoaded && (
          <View style={[styles.imagePlaceholder, styles.imagePlaceholderAbsolute]}>
            <Ionicons name="podium" size={32} color={theme.colors.textMuted} />
          </View>
        )}
        <Image
          source={RUNSTR_LOGO}
          style={[styles.image, !imageLoaded && styles.imageHidden]}
          resizeMode="contain"
          onLoad={() => setImageLoaded(true)}
        />
      </View>

      {/* Status Badge - Always LIVE */}
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>LIVE</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          Daily Leaderboards
        </Text>

        {/* Description Row */}
        <View style={styles.metaRow}>
          <Ionicons name="stats-chart-outline" size={14} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>See top performers today</Text>
        </View>

        {/* Update Row */}
        <View style={styles.metaRow}>
          <Ionicons name="refresh-outline" size={14} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>Updates in real-time</Text>
        </View>

        {/* Tags Row */}
        <View style={styles.tagsRow}>
          {/* Metrics */}
          <View style={styles.tag}>
            <Ionicons name="trending-up-outline" size={12} color={theme.colors.accent} />
            <Text style={styles.tagText}>Distance</Text>
          </View>

          <View style={styles.tag}>
            <Ionicons name="speedometer-outline" size={12} color={theme.colors.accent} />
            <Text style={styles.tagText}>Pace</Text>
          </View>

          <View style={styles.tag}>
            <Ionicons name="calendar-outline" size={12} color={theme.colors.accent} />
            <Text style={styles.tagText}>Consistency</Text>
          </View>

          {/* Activity Types */}
          <View style={styles.tag}>
            <Ionicons name="walk-outline" size={12} color={theme.colors.accent} />
            <Text style={styles.tagText}>All Activities</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: 150,
    position: 'relative',
  },
  imagePlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  image: {
    width: '100%',
    height: 150,
    backgroundColor: '#000000',
  },
  imageHidden: {
    opacity: 0,
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textMuted,
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
  },
  statusText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.background,
  },
  content: {
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginLeft: 6,
    flex: 1,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.colors.accent}20`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  tagText: {
    fontSize: 12,
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.medium,
  },
});

export default LeaderboardEventCard;
