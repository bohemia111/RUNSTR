/**
 * Season2EventCard - Event card for RUNSTR Season II
 *
 * Displays Season II competition as an event card with trophy icon placeholder,
 * status badge, and metadata. Clicking navigates to the Season II tab.
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

// RUNSTR logo image for Season II card (orange ostrich on black)
const RUNSTR_LOGO = require('../../../assets/images/icon.png');
import { theme } from '../../styles/theme';
import {
  getSeason2Status,
  getSeason2DateRange,
  SEASON_2_CONFIG,
  formatSats,
} from '../../constants/season2';

interface Season2EventCardProps {
  onPress?: () => void;
}

export const Season2EventCard: React.FC<Season2EventCardProps> = ({
  onPress,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const status = getSeason2Status();
  const dateRange = getSeason2DateRange();

  const getStatusStyles = () => {
    switch (status) {
      case 'active':
        return { backgroundColor: theme.colors.accent };
      case 'upcoming':
        return { backgroundColor: theme.colors.accent };
      case 'ended':
        return { backgroundColor: theme.colors.textMuted };
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'active':
        return 'LIVE';
      case 'upcoming':
        return 'UPCOMING';
      case 'ended':
        return 'ENDED';
    }
  };

  const totalPrizePool = SEASON_2_CONFIG.prizePoolBonus + SEASON_2_CONFIG.prizePoolCharity;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Event Banner Image */}
      <View style={styles.imageContainer}>
        {!imageLoaded && (
          <View style={[styles.imagePlaceholder, styles.imagePlaceholderAbsolute]}>
            <Ionicons name="trophy" size={32} color={theme.colors.textMuted} />
          </View>
        )}
        <Image
          source={RUNSTR_LOGO}
          style={[styles.image, !imageLoaded && styles.imageHidden]}
          resizeMode="contain"
          onLoad={() => setImageLoaded(true)}
        />
      </View>

      {/* Status Badge */}
      <View style={[styles.statusBadge, getStatusStyles()]}>
        <Text style={styles.statusText}>{getStatusText()}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          RUNSTR Season II Competition
        </Text>

        {/* Date Row */}
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>{dateRange}</Text>
        </View>

        {/* Prize Row */}
        <View style={styles.metaRow}>
          <Ionicons name="flash-outline" size={14} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>
            {formatSats(totalPrizePool)} Prize Pool
          </Text>
        </View>

        {/* Tags Row */}
        <View style={styles.tagsRow}>
          {/* Activity Types */}
          <View style={styles.tag}>
            <Ionicons name="walk-outline" size={12} color={theme.colors.accent} />
            <Text style={styles.tagText}>Running</Text>
          </View>

          <View style={styles.tag}>
            <Ionicons name="walk-outline" size={12} color={theme.colors.accent} />
            <Text style={styles.tagText}>Walking</Text>
          </View>

          <View style={styles.tag}>
            <Ionicons name="bicycle-outline" size={12} color={theme.colors.accent} />
            <Text style={styles.tagText}>Cycling</Text>
          </View>

          {/* BTC Prizes */}
          <View style={styles.tag}>
            <Ionicons name="trophy" size={12} color={theme.colors.accent} />
            <Text style={styles.tagText}>BTC Prizes</Text>
          </View>

          {/* Charity */}
          <View style={styles.tag}>
            <Ionicons name="heart" size={12} color={theme.colors.accent} />
            <Text style={styles.tagText}>Charity</Text>
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
  image: {
    width: '100%',
    height: 150,
    backgroundColor: '#000000',
  },
  imageHidden: {
    opacity: 0,
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
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
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

export default Season2EventCard;
