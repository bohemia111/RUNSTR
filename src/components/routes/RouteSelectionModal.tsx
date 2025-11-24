/**
 * RouteSelectionModal - Select a saved route to follow during workout
 * Shows list of saved routes with stats and allows selection
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import routeStorageService, {
  type SavedRoute,
} from '../../services/routes/RouteStorageService';
import type { WorkoutType } from '../../types/workout';

interface RouteSelectionModalProps {
  visible: boolean;
  activityType: WorkoutType;
  onSelectRoute: (route: SavedRoute) => void;
  onTrackFreely: () => void;
  onClose: () => void;
}

export const RouteSelectionModal: React.FC<RouteSelectionModalProps> = ({
  visible,
  activityType,
  onSelectRoute,
  onTrackFreely,
  onClose,
}) => {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadRoutes();
    }
  }, [visible, activityType]);

  const loadRoutes = async () => {
    try {
      setIsLoading(true);
      const activityRoutes = await routeStorageService.getRoutesByActivity(
        activityType
      );
      // Sort by most recently used
      setRoutes(activityRoutes);
    } catch (error) {
      console.error('Failed to load routes:', error);
      setRoutes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDistance = (meters: number): string => {
    const km = meters / 1000;
    return `${km.toFixed(2)} km`;
  };

  const formatTime = (seconds: number | undefined): string => {
    if (!seconds) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getActivityIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (activityType) {
      case 'running':
        return 'fitness';
      case 'walking':
        return 'walk';
      case 'cycling':
        return 'bicycle';
      default:
        return 'location';
    }
  };

  const renderRouteItem = ({ item: route }: { item: SavedRoute }) => (
    <TouchableOpacity
      style={styles.routeCard}
      onPress={() => {
        onSelectRoute(route);
      }}
    >
      <View style={styles.routeHeader}>
        <View style={styles.routeInfo}>
          <Text style={styles.routeName}>{route.name}</Text>
          <Text style={styles.routeMeta}>
            Last used {formatDate(route.lastUsed)}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={theme.colors.textMuted}
        />
      </View>

      <View style={styles.routeStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatDistance(route.distance)}</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatTime(route.bestTime)}</Text>
          <Text style={styles.statLabel}>Best Time</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{route.timesUsed}</Text>
          <Text style={styles.statLabel}>Times Used</Text>
        </View>
      </View>

      {route.bestTime && (
        <View style={styles.prBadge}>
          <Ionicons name="trophy" size={14} color={theme.colors.accent} />
          <Text style={styles.prText}>PR: {formatTime(route.bestTime)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="map-outline" size={64} color={theme.colors.textMuted} />
      <Text style={styles.emptyStateTitle}>No Routes Yet</Text>
      <Text style={styles.emptyStateText}>
        Complete your first {activityType} workout and save it as a route to
        race against your PR!
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons
                name={getActivityIcon()}
                size={24}
                color={theme.colors.text}
              />
              <Text style={styles.headerTitle}>Choose a Route</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Track Freely Option */}
          <TouchableOpacity
            style={styles.trackFreelyCard}
            onPress={onTrackFreely}
          >
            <View style={styles.trackFreelyContent}>
              <Ionicons name="compass" size={24} color={theme.colors.text} />
              <View style={styles.trackFreelyText}>
                <Text style={styles.trackFreelyTitle}>Track Freely</Text>
                <Text style={styles.trackFreelyDescription}>
                  Explore new paths or let the app auto-detect your route
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>

          {/* Routes List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.text} />
              <Text style={styles.loadingText}>Loading routes...</Text>
            </View>
          ) : routes.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Your Saved Routes</Text>
              <FlatList
                data={routes}
                renderItem={renderRouteItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                style={styles.routesList}
              />
            </>
          ) : (
            renderEmptyState()
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    flex: 1, // ✅ FIX: Enable proper flex children (FlatList needs this)
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  closeButton: {
    padding: 4,
  },
  trackFreelyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.accent + '20',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  trackFreelyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  trackFreelyText: {
    flex: 1,
  },
  trackFreelyTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 2,
  },
  trackFreelyDescription: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  routesList: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  routeCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  routeMeta: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  routeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: theme.colors.accent + '15',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  prText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    marginTop: 12,
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
