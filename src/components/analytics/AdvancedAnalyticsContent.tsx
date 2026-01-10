/**
 * AdvancedAnalyticsContent - Embeddable analytics content for Stats screen toggle
 * All calculations happen on-device using local workout data
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { CustomAlertManager } from '../ui/CustomAlert';
import Nostr1301ImportService from '../../services/fitness/Nostr1301ImportService';
import { theme } from '../../styles/theme';
import { PrivacyNoticeModal } from '../ui/PrivacyNoticeModal';
import localWorkoutStorage from '../../services/fitness/LocalWorkoutStorageService';
import type { LocalWorkout } from '../../services/fitness/LocalWorkoutStorageService';
import type { AnalyticsSummary, HealthProfile } from '../../types/analytics';
import { CardioPerformanceAnalytics } from '../../services/analytics/CardioPerformanceAnalytics';
import { BodyCompositionAnalytics } from '../../services/analytics/BodyCompositionAnalytics';
import { LevelCard } from './LevelCard';
import { CoachRunstrCard } from './CoachRunstrCard';
import { GoalsHabitsCard } from './GoalsHabitsCard';
import { CollapsibleAchievementsCard } from './CollapsibleAchievementsCard';
import { CollapsibleSection } from './CollapsibleSection';
import { WorkoutLevelRing } from '../profile/WorkoutLevelRing';
import { PersonalRecordsService } from '../../services/analytics/PersonalRecordsService';
import type { AllPersonalRecords } from '../../services/analytics/PersonalRecordsService';

const PRIVACY_NOTICE_KEY = '@runstr:analytics_privacy_accepted';
const HEALTH_PROFILE_KEY = '@runstr:health_profile';

interface AdvancedAnalyticsContentProps {
  onPrivacyDeclined?: () => void;
}

export const AdvancedAnalyticsContent: React.FC<AdvancedAnalyticsContentProps> = ({
  onPrivacyDeclined,
}) => {
  const [loading, setLoading] = useState(true);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [workouts, setWorkouts] = useState<LocalWorkout[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
  const [personalRecords, setPersonalRecords] = useState<AllPersonalRecords | null>(null);
  const [pubkey, setPubkey] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    initializeAnalytics();
  }, []);

  const initializeAnalytics = async () => {
    try {
      const privacyAccepted = await AsyncStorage.getItem(PRIVACY_NOTICE_KEY);

      if (!privacyAccepted) {
        setShowPrivacyModal(true);
        setLoading(false);
        return;
      }

      await loadAnalytics();
    } catch (error) {
      console.error('Failed to initialize analytics:', error);
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      console.log('[AdvancedAnalyticsContent] Loading analytics...');

      // Load user pubkey for WorkoutLevelRing
      const hexPubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');
      const npub = await AsyncStorage.getItem('@runstr:npub');
      setPubkey(hexPubkey || npub || '');

      // Load health profile
      const profileData = await AsyncStorage.getItem(HEALTH_PROFILE_KEY);
      const profile: HealthProfile | null = profileData ? JSON.parse(profileData) : null;
      setHealthProfile(profile);

      // Get ALL local workouts
      const allWorkouts = await localWorkoutStorage.getAllWorkouts();
      console.log(`[AdvancedAnalyticsContent] Total workouts: ${allWorkouts.length}`);
      setWorkouts(allWorkouts);

      // Calculate analytics
      const cardioMetrics = profile
        ? CardioPerformanceAnalytics.calculateMetrics(allWorkouts, profile)
        : CardioPerformanceAnalytics.calculateMetrics(allWorkouts);

      const bodyComposition =
        profile && (profile.weight || profile.height)
          ? BodyCompositionAnalytics.calculateMetrics(profile, allWorkouts)
          : undefined;

      const prs = PersonalRecordsService.getAllPRs(allWorkouts);

      const summary: AnalyticsSummary = {
        cardio: cardioMetrics || undefined,
        bodyComposition: bodyComposition || undefined,
        lastUpdated: new Date().toISOString(),
      };

      setAnalytics(summary);
      setPersonalRecords(prs);
      setLoading(false);
    } catch (error) {
      console.error('[AdvancedAnalyticsContent] Failed to load analytics:', error);
      setLoading(false);
    }
  };

  const handlePrivacyAccept = async () => {
    try {
      await AsyncStorage.setItem(PRIVACY_NOTICE_KEY, 'true');
      setShowPrivacyModal(false);
      await loadAnalytics();
    } catch (error) {
      console.error('Failed to save privacy acceptance:', error);
    }
  };

  const handlePrivacyClose = () => {
    setShowPrivacyModal(false);
    onPrivacyDeclined?.();
  };

  /**
   * Handle importing public Nostr workout history (kind 1301 events)
   */
  const handleImportNostrHistory = async () => {
    try {
      setImporting(true);
      setImportProgress({ current: 0, total: 0 });

      const userKey = pubkey;
      if (!userKey) {
        console.error('[AdvancedAnalytics] No pubkey found - cannot import workouts');
        setImporting(false);
        setImportProgress(null);
        return;
      }

      console.log('[AdvancedAnalytics] Starting Nostr workout import...');

      const result = await Nostr1301ImportService.importUserHistory(
        userKey,
        (progress) => {
          setImportProgress({
            current: progress.imported,
            total: progress.total,
          });
        }
      );

      if (result.success) {
        console.log(`[AdvancedAnalytics] Import successful: ${result.totalImported} workouts`);
        CustomAlertManager.alert(
          'Import Complete',
          `Imported ${result.totalImported} workouts from Nostr`
        );
        // Reload analytics to include imported workouts
        await loadAnalytics();
      } else {
        console.error('[AdvancedAnalytics] Import failed:', result.error);
        CustomAlertManager.alert('Import Failed', result.error || 'Unknown error');
      }

      setImporting(false);
      setImportProgress(null);
    } catch (error) {
      console.error('[AdvancedAnalytics] Import error:', error);
      setImporting(false);
      setImportProgress(null);
      CustomAlertManager.alert('Import Error', 'Failed to import workouts');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9D42" />
        <Text style={styles.loadingText}>Calculating analytics...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Workout Level Ring - Main Feature at Top */}
        {pubkey && workouts.length > 0 && (
          <WorkoutLevelRing workouts={workouts} pubkey={pubkey} />
        )}

        {/* RUNSTR Rank (Web of Trust) - Collapsible */}
        <CollapsibleSection title="RUNSTR Rank" icon="shield-checkmark">
          <LevelCard />
        </CollapsibleSection>

        {/* Achievements (Personal Records) - Already Collapsible */}
        {personalRecords && (
          <CollapsibleAchievementsCard personalRecords={personalRecords} />
        )}

        {/* Goals & Habits - Collapsible */}
        <CollapsibleSection title="Goals & Habits" icon="flag-outline">
          <GoalsHabitsCard />
        </CollapsibleSection>

        {/* COACH RUNSTR - AI-Powered Insights - Collapsible */}
        <CollapsibleSection title="Coach RUNSTR" icon="sparkles-outline">
          <CoachRunstrCard workouts={workouts} />
        </CollapsibleSection>

        {/* Import Data - Collapsible */}
        <CollapsibleSection title="Import Data" icon="cloud-download-outline">
          <TouchableOpacity
            style={[styles.importButton, importing && styles.importButtonDisabled]}
            onPress={handleImportNostrHistory}
            activeOpacity={0.7}
            disabled={importing}
          >
            <Ionicons
              name={importing ? 'sync' : 'cloud-download-outline'}
              size={20}
              color={importing ? theme.colors.textMuted : '#FF9D42'}
            />
            <View style={styles.importTextContainer}>
              <Text style={[styles.importButtonText, importing && styles.importButtonTextDisabled]}>
                {importing
                  ? importProgress?.total === 0
                    ? 'Connecting to Nostr relays...'
                    : `Syncing: ${importProgress?.current || 0} / ${importProgress?.total || 0}`
                  : 'Import from Nostr'}
              </Text>
              <Text style={styles.importSubtext}>
                Fetch your workout history from Nostr relays
              </Text>
            </View>
          </TouchableOpacity>
        </CollapsibleSection>

        {/* Last Updated */}
        {analytics && (
          <Text style={styles.lastUpdated}>
            Last updated: {new Date(analytics.lastUpdated).toLocaleString()}
          </Text>
        )}
      </ScrollView>

      {/* Privacy Notice Modal */}
      <PrivacyNoticeModal
        visible={showPrivacyModal}
        onClose={handlePrivacyClose}
        onAccept={handlePrivacyAccept}
      />
    </>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 16,
    color: '#FF9D42',
    fontWeight: theme.typography.weights.medium,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 12,
    paddingBottom: 80,
  },
  lastUpdated: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 10,
    marginTop: 8,
    gap: 12,
  },
  importButtonDisabled: {
    opacity: 0.7,
  },
  importTextContainer: {
    flex: 1,
  },
  importButtonText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: theme.typography.weights.medium,
  },
  importButtonTextDisabled: {
    color: theme.colors.textMuted,
  },
  importSubtext: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});

export default AdvancedAnalyticsContent;
