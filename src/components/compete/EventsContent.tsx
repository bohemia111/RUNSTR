/**
 * EventsContent - Embeddable events feed for Compete screen toggle
 * Shows hardcoded event cards (no Nostr fetch)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { RunningBitcoinEventCard } from '../events/RunningBitcoinEventCard';
import { EinundzwanzigEventCard } from '../events/EinundzwanzigEventCard';
import { JanuaryWalkingEventCard } from '../events/JanuaryWalkingEventCard';
import { Season2EventCard } from '../events/Season2EventCard';
import { LeaderboardEventCard } from '../events/LeaderboardEventCard';
import { getRunningBitcoinStatus } from '../../constants/runningBitcoin';
import { getEinundzwanzigStatus } from '../../constants/einundzwanzig';
import { getJanuaryWalkingStatus } from '../../constants/januaryWalking';
import type { SatlantisEvent } from '../../types/satlantis';

interface EventsContentProps {
  onEventPress: (event: SatlantisEvent) => void;
  onCreateEvent?: () => void;
  onRunningBitcoinPress?: () => void;
  onEinundzwanzigPress?: () => void;
  onJanuaryWalkingPress?: () => void;
  onSeason2Press?: () => void;
  onLeaderboardPress?: () => void;
}

export const EventsContent: React.FC<EventsContentProps> = ({
  onCreateEvent,
  onRunningBitcoinPress,
  onEinundzwanzigPress,
  onJanuaryWalkingPress,
  onSeason2Press,
  onLeaderboardPress,
}) => {
  return (
    <View style={styles.container}>
      {/* Create Event Banner */}
      {onCreateEvent && (
        <TouchableOpacity
          style={styles.createEventBanner}
          onPress={onCreateEvent}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={20} color={theme.colors.text} />
          <Text style={styles.createEventText}>Create Event</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      )}

      {/* Season II Card - RUNSTR Season II */}
      <View style={styles.featuredEvent}>
        <Season2EventCard onPress={onSeason2Press} />
      </View>

      {/* January Walking Contest - show when upcoming or active */}
      {getJanuaryWalkingStatus() !== 'ended' && (
        <View style={styles.featuredEvent}>
          <JanuaryWalkingEventCard onPress={onJanuaryWalkingPress} />
        </View>
      )}

      {/* Leaderboard Card - Daily Leaderboards */}
      <View style={styles.featuredEvent}>
        <LeaderboardEventCard onPress={onLeaderboardPress} />
      </View>

      {/* Featured Event: Running Bitcoin Challenge - show when upcoming or active */}
      {getRunningBitcoinStatus() !== 'ended' && (
        <View style={styles.featuredEvent}>
          <RunningBitcoinEventCard onPress={onRunningBitcoinPress} />
        </View>
      )}

      {/* Featured Event: Einundzwanzig Fitness Challenge - show when upcoming or active */}
      {getEinundzwanzigStatus() !== 'ended' && (
        <View style={styles.featuredEvent}>
          <EinundzwanzigEventCard onPress={onEinundzwanzigPress} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  featuredEvent: {
    marginBottom: 16,
  },
  createEventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackground,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
    gap: 12,
  },
  createEventText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: theme.typography.weights.medium,
  },
});

export default EventsContent;
