/**
 * SatlantisDiscoveryScreen - Main discovery feed for Satlantis sports events
 * Browse upcoming and live race events from Satlantis
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { useSatlantisEvents } from '../../hooks/useSatlantisEvents';
import { SatlantisEventCard } from '../../components/satlantis/SatlantisEventCard';
import { RunstrEventCreationModal } from '../../components/events/RunstrEventCreationModal';
import type { SatlantisEvent, SatlantisSportType } from '../../types/satlantis';

interface SatlantisDiscoveryScreenProps {
  navigation: any;
}

interface SportFilter {
  label: string;
  value: SatlantisSportType | 'all';
}

const SPORT_FILTERS: SportFilter[] = [
  { label: 'All', value: 'all' },
  { label: 'Running', value: 'running' },
  { label: 'Cycling', value: 'cycling' },
  { label: 'Walking', value: 'walking' },
];

export const SatlantisDiscoveryScreen: React.FC<SatlantisDiscoveryScreenProps> = ({
  navigation,
}) => {
  const [selectedSport, setSelectedSport] = useState<SatlantisSportType | 'all'>('all');
  const [showCreationModal, setShowCreationModal] = useState(false);

  const filter =
    selectedSport === 'all' ? undefined : { sportTypes: [selectedSport] };

  const { events, isLoading, error, refresh } = useSatlantisEvents(filter);

  const handleEventPress = useCallback(
    (event: SatlantisEvent) => {
      navigation.navigate('SatlantisEventDetail', {
        eventId: event.id,
        eventPubkey: event.pubkey,
      });
    },
    [navigation]
  );

  const handleEventCreated = useCallback(
    (eventId: string) => {
      console.log('[SatlantisDiscovery] Event created:', eventId);
      setShowCreationModal(false);
      // Refresh the list to show the new event
      setTimeout(() => refresh(), 1000);
    },
    [refresh]
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Events</Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => setShowCreationModal(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={24} color={theme.colors.background} />
      </TouchableOpacity>
    </View>
  );

  const renderFilters = () => (
    <View style={styles.filterContainer}>
      <FlatList
        horizontal
        data={SPORT_FILTERS}
        keyExtractor={(item) => item.value}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedSport === item.value && styles.filterChipActive,
            ]}
            onPress={() => setSelectedSport(item.value)}
          >
            <Text
              style={[
                styles.filterText,
                selectedSport === item.value && styles.filterTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.filterList}
      />
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="calendar-outline"
        size={48}
        color={theme.colors.textMuted}
      />
      <Text style={styles.emptyTitle}>No Events Found</Text>
      <Text style={styles.emptySubtitle}>
        {error || 'Check back later for upcoming race events'}
      </Text>
      <Text style={styles.emptyHint}>
        Pull down to refresh
      </Text>
    </View>
  );

  const renderItem = useCallback(
    ({ item }: { item: SatlantisEvent }) => (
      <SatlantisEventCard
        event={item}
        onPress={() => handleEventPress(item)}
        participantCount={item.participantCount}
      />
    ),
    [handleEventPress]
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      {renderFilters()}

      <FlatList
        data={events}
        keyExtractor={(item) => `${item.pubkey}_${item.id}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={!isLoading ? renderEmpty : null}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
      />

      {/* Event Creation Modal */}
      <RunstrEventCreationModal
        visible={showCreationModal}
        onClose={() => setShowCreationModal(false)}
        onEventCreated={handleEventCreated}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
    color: '#FFB366',
  },
  createButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFB366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.cardBackground,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: '#FFB366',
    borderColor: '#FFB366',
  },
  filterText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  filterTextActive: {
    color: theme.colors.background,
    fontWeight: theme.typography.weights.semiBold,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default SatlantisDiscoveryScreen;
