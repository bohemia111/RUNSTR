/**
 * SavedRoutesScreen - Browse and manage saved GPS routes
 * Shows list of saved routes with filtering by activity type
 * Allows viewing route details, renaming, and deleting routes
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import routeStorageService, { SavedRoute } from '../../services/routes/RouteStorageService';
import type { WorkoutType } from '../../types/workout';

type ActivityFilter = 'all' | WorkoutType;

export const SavedRoutesScreen: React.FC = () => {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [filteredRoutes, setFilteredRoutes] = useState<SavedRoute[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadRoutes();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [routes, activeFilter, searchQuery]);

  const loadRoutes = async () => {
    try {
      setIsLoading(true);
      const allRoutes = await routeStorageService.getAllRoutes();
      setRoutes(allRoutes);
      console.log(`📍 Loaded ${allRoutes.length} saved routes`);
    } catch (error) {
      console.error('❌ Failed to load routes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...routes];

    // Filter by activity type
    if (activeFilter !== 'all') {
      filtered = filtered.filter(r => r.activityType === activeFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query) ||
        r.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    setFilteredRoutes(filtered);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadRoutes();
    setIsRefreshing(false);
  };

  const handleDeleteRoute = (route: SavedRoute) => {
    Alert.alert(
      'Delete Route',
      `Are you sure you want to delete "${route.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await routeStorageService.deleteRoute(route.id);
              await loadRoutes();
              console.log(`✅ Deleted route: ${route.name}`);
            } catch (error) {
              console.error('Failed to delete route:', error);
              Alert.alert('Error', 'Failed to delete route');
            }
          },
        },
      ]
    );
  };

  const handleRenameRoute = (route: SavedRoute) => {
    Alert.prompt(
      'Rename Route',
      `Enter new name for "${route.name}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (newName) => {
            if (!newName || !newName.trim()) return;
            try {
              await routeStorageService.renameRoute(route.id, newName.trim());
              await loadRoutes();
              console.log(`✅ Renamed route to: ${newName}`);
            } catch (error) {
              console.error('Failed to rename route:', error);
              Alert.alert('Error', 'Failed to rename route');
            }
          },
        },
      ],
      'plain-text',
      route.name
    );
  };

  const formatDistance = (meters: number): string => {
    const km = meters / 1000;
    return `${km.toFixed(2)} km`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getActivityIcon = (type: WorkoutType): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'running': return 'fitness';
      case 'walking': return 'walk';
      case 'cycling': return 'bicycle';
      case 'hiking': return 'trail-sign';
      default: return 'location';
    }
  };

  const getActivityColor = (type: WorkoutType): string => {
    switch (type) {
      case 'running': return '#FF6B6B';
      case 'walking': return '#4ECDC4';
      case 'cycling': return '#45B7D1';
      case 'hiking': return '#96CEB4';
      default: return theme.colors.accent;
    }
  };

  const renderRouteCard = useCallback(({ item: route }: { item: SavedRoute }) => {
    const activityColor = getActivityColor(route.activityType);

    return (
      <View style={styles.routeCard}>
        {/* Header */}
        <View style={styles.routeHeader}>
          <View style={styles.routeHeaderLeft}>
            <View style={[styles.activityIconContainer, { backgroundColor: activityColor + '20' }]}>
              <Ionicons
                name={getActivityIcon(route.activityType)}
                size={24}
                color={activityColor}
              />
            </View>
            <View style={styles.routeInfo}>
              <Text style={styles.routeName}>{route.name}</Text>
              <Text style={styles.routeMeta}>
                Last used {formatDate(route.lastUsed || route.createdAt)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => {
              Alert.alert(
                route.name,
                'Choose an action',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Rename', onPress: () => handleRenameRoute(route) },
                  { text: 'Delete', style: 'destructive', onPress: () => handleDeleteRoute(route) },
                ]
              );
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.routeStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDistance(route.distance)}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{route.elevationGain.toFixed(0)}m</Text>
            <Text style={styles.statLabel}>Elevation</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{route.timesUsed}</Text>
            <Text style={styles.statLabel}>Times Used</Text>
          </View>
        </View>

        {/* Best Performance */}
        {route.bestTime && (
          <View style={styles.bestPerformance}>
            <Ionicons name="trophy" size={14} color={theme.colors.accent} />
            <Text style={styles.bestPerformanceText}>
              Best: {formatTime(route.bestTime)}
              {route.bestPace && ` • ${route.bestPace.toFixed(2)} min/km`}
            </Text>
          </View>
        )}

        {/* Tags */}
        {route.tags && route.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {route.tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }, []);

  const renderFilters = () => {
    const filters: { label: string; value: ActivityFilter }[] = [
      { label: 'All', value: 'all' },
      { label: 'Running', value: 'running' },
      { label: 'Cycling', value: 'cycling' },
      { label: 'Walking', value: 'walking' },
      { label: 'Hiking', value: 'hiking' },
    ];

    return (
      <View style={styles.filtersContainer}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.filterButton,
              activeFilter === filter.value && styles.filterButtonActive,
            ]}
            onPress={() => setActiveFilter(filter.value)}
          >
            <Text
              style={[
                styles.filterButtonText,
                activeFilter === filter.value && styles.filterButtonTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderHeader = () => (
    <>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search routes..."
          placeholderTextColor={theme.colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Activity Filters */}
      {renderFilters()}

      {/* Stats Summary */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryText}>
          {filteredRoutes.length} route{filteredRoutes.length !== 1 ? 's' : ''}
          {activeFilter !== 'all' && ` • ${activeFilter}`}
        </Text>
      </View>
    </>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="map-outline" size={64} color={theme.colors.textMuted} />
      <Text style={styles.emptyStateTitle}>No Routes Yet</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery
          ? 'No routes match your search'
          : activeFilter !== 'all'
          ? `No ${activeFilter} routes saved yet`
          : 'Save your first route by completing a GPS-tracked workout'}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading routes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredRoutes}
        renderItem={renderRouteCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader()}
        ListEmptyComponent={renderEmptyState()}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.text}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  filterButtonText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
  },
  filterButtonTextActive: {
    color: theme.colors.accentText,
  },
  summaryContainer: {
    marginBottom: 16,
  },
  summaryText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  routeHeaderLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
  },
  activityIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  routeName: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    marginBottom: 4,
  },
  routeMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  menuButton: {
    padding: 4,
  },
  routeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    marginBottom: 4,
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  bestPerformance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.accent + '15',
    borderRadius: 8,
  },
  bestPerformanceText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  tag: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tagText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
