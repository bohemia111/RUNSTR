/**
 * TrackingDebugPanel - Debugging panel for Android background tracking
 * Shows battery optimization status, GPS signal, and tracking state
 * Android-only component for troubleshooting background tracking issues
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { BatteryOptimizationService } from '../../services/activity/BatteryOptimizationService';

interface TrackingDebugPanelProps {
  gpsSignal: 'strong' | 'medium' | 'weak' | 'none' | 'searching';
  isTracking: boolean;
  isBackgroundTracking: boolean;
  lastGPSUpdate?: number;
}

export const TrackingDebugPanel: React.FC<TrackingDebugPanelProps> = ({
  gpsSignal,
  isTracking,
  isBackgroundTracking,
  lastGPSUpdate,
}) => {
  const [batteryOptimized, setBatteryOptimized] = useState<boolean | null>(null);
  const [timeSinceLastUpdate, setTimeSinceLastUpdate] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Only render on Android
  if (Platform.OS !== 'android') {
    return null;
  }

  useEffect(() => {
    // Check battery optimization status
    const checkBatteryStatus = async () => {
      const batteryService = BatteryOptimizationService.getInstance();
      const status = await batteryService.checkBatteryOptimizationStatus();
      setBatteryOptimized(!status.exempted); // true if optimized (bad), false if exempted (good)
    };

    checkBatteryStatus();
  }, []);

  useEffect(() => {
    // Update time since last GPS update
    if (!lastGPSUpdate) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - lastGPSUpdate) / 1000);
      setTimeSinceLastUpdate(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [lastGPSUpdate]);

  const getSignalIcon = (): 'checkmark-circle' | 'warning' | 'close-circle' => {
    if (gpsSignal === 'strong' || gpsSignal === 'medium') return 'checkmark-circle';
    if (gpsSignal === 'weak' || gpsSignal === 'searching') return 'warning';
    return 'close-circle';
  };

  const getSignalColor = (): string => {
    if (gpsSignal === 'strong' || gpsSignal === 'medium') return '#10B981';
    if (gpsSignal === 'weak' || gpsSignal === 'searching') return '#F59E0B';
    return '#EF4444';
  };

  const getBatteryIcon = (): 'checkmark-circle' | 'warning' => {
    return batteryOptimized ? 'warning' : 'checkmark-circle';
  };

  const getBatteryColor = (): string => {
    return batteryOptimized ? '#F59E0B' : '#10B981';
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.headerText}>Debug Info</Text>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.textMuted}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.content}>
          {/* GPS Signal Status */}
          <View style={styles.statusRow}>
            <Ionicons
              name={getSignalIcon()}
              size={20}
              color={getSignalColor()}
            />
            <Text style={styles.statusLabel}>GPS Signal:</Text>
            <Text style={styles.statusValue}>{gpsSignal}</Text>
          </View>

          {/* Battery Optimization Status */}
          {batteryOptimized !== null && (
            <View style={styles.statusRow}>
              <Ionicons
                name={getBatteryIcon()}
                size={20}
                color={getBatteryColor()}
              />
              <Text style={styles.statusLabel}>Battery:</Text>
              <Text style={styles.statusValue}>
                {batteryOptimized ? 'Optimized (Bad)' : 'Unrestricted (Good)'}
              </Text>
            </View>
          )}

          {/* Tracking Status */}
          <View style={styles.statusRow}>
            <Ionicons
              name={isTracking ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={isTracking ? '#10B981' : theme.colors.textMuted}
            />
            <Text style={styles.statusLabel}>Tracking:</Text>
            <Text style={styles.statusValue}>
              {isTracking ? 'Active' : 'Stopped'}
            </Text>
          </View>

          {/* Background Tracking Status */}
          {isTracking && (
            <View style={styles.statusRow}>
              <Ionicons
                name={isBackgroundTracking ? 'moon' : 'sunny'}
                size={20}
                color={isBackgroundTracking ? '#8B5CF6' : '#F59E0B'}
              />
              <Text style={styles.statusLabel}>Mode:</Text>
              <Text style={styles.statusValue}>
                {isBackgroundTracking ? 'Background' : 'Foreground'}
              </Text>
            </View>
          )}

          {/* Time Since Last GPS Update */}
          {isTracking && lastGPSUpdate && (
            <View style={styles.statusRow}>
              <Ionicons
                name="time"
                size={20}
                color={timeSinceLastUpdate > 10 ? '#EF4444' : theme.colors.textMuted}
              />
              <Text style={styles.statusLabel}>Last Update:</Text>
              <Text style={[
                styles.statusValue,
                timeSinceLastUpdate > 10 && styles.statusValueWarning
              ]}>
                {timeSinceLastUpdate}s ago
              </Text>
            </View>
          )}

          {/* Warning Messages */}
          {batteryOptimized && (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={16} color="#F59E0B" />
              <Text style={styles.warningText}>
                Battery optimization enabled. Tracking may stop when using other apps.
                Check Settings → Apps → RUNSTR → Battery.
              </Text>
            </View>
          )}

          {timeSinceLastUpdate > 10 && isTracking && (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={16} color="#EF4444" />
              <Text style={styles.warningText}>
                GPS not updating! Check if app is being throttled by Android.
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
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  headerText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textMuted,
  },
  content: {
    padding: 12,
    paddingTop: 0,
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusLabel: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },
  statusValue: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.semiBold,
  },
  statusValueWarning: {
    color: '#EF4444',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.background,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginTop: 4,
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },
});
