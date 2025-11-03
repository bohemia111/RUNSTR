/**
 * ChallengeDetailScreen - Detailed view of a specific challenge
 * Matches HTML mockup pixel-perfectly for challenge detail view
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, ChallengeDetailData } from '../types';
import { theme } from '../styles/theme';

// UI Components
import { DetailHeader } from '../components/ui/DetailHeader';
import { TimeRemaining } from '../components/ui/TimeRemaining';
import { ActionButton } from '../components/ui/ActionButton';

// Challenge-specific Components
import { ChallengeHeader } from '../components/challenge/ChallengeHeader';
import { ChallengeVersus } from '../components/challenge/ChallengeVersus';
import { ChallengeStatus } from '../components/challenge/ChallengeStatus';
import { RulesSection } from '../components/challenge/RulesSection';

// Real Data Services
import { ChallengeService } from '../services/competition/ChallengeService';
import { NostrCompetitionLeaderboardService } from '../services/competition/nostrCompetitionLeaderboardService';
import type {
  CompetitionLeaderboard,
  CompetitionParticipant,
} from '../services/competition/nostrCompetitionLeaderboardService';

type ChallengeDetailRouteProp = RouteProp<
  RootStackParamList,
  'ChallengeDetail'
>;
type ChallengeDetailNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ChallengeDetail'
>;

interface ChallengeDetailScreenProps {
  route: ChallengeDetailRouteProp;
  navigation: ChallengeDetailNavigationProp;
}

export const ChallengeDetailScreen: React.FC<ChallengeDetailScreenProps> = ({
  route,
  navigation,
}) => {
  const { challengeId } = route.params;
  const [challengeData, setChallengeData] =
    useState<ChallengeDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [watchStatus, setWatchStatus] = useState<
    'not_watching' | 'watching' | 'participating'
  >('not_watching');
  const [leaderboard, setLeaderboard] = useState<CompetitionLeaderboard | null>(
    null
  );
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  // Load challenge data
  useEffect(() => {
    loadChallengeData();
  }, [challengeId]);

  const loadChallengeData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch kind 30102 challenge event from Nostr
      const challengeService = ChallengeService.getInstance();
      const challengeEvent = await challengeService.getChallengeEvent(challengeId);

      if (!challengeEvent) {
        throw new Error('Challenge not found');
      }

      // Parse challenge event tags
      const tags = new Map(challengeEvent.tags.map((t) => [t[0], t[1]]));
      const participants = challengeEvent.tags
        .filter((tag) => tag[0] === 'p')
        .map((tag) => tag[1])
        .filter(Boolean);

      if (participants.length === 0) {
        throw new Error('No participants found in challenge');
      }

      // Extract challenge metadata
      const challengeName = tags.get('name') || 'Running Challenge';
      const distance = parseFloat(tags.get('distance') || '5');
      const wager = parseInt(tags.get('wager') || '0');
      const startDate = tags.get('start_date') || new Date().toISOString();
      const endDate = tags.get('end_date') || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const startTime = Math.floor(new Date(startDate).getTime() / 1000);
      const endTime = Math.floor(new Date(endDate).getTime() / 1000);

      // Get challenge leaderboard with real workout data
      setIsLoadingLeaderboard(true);
      const challengeLeaderboard = await challengeService.getChallengeLeaderboard(challengeId);

      if (!challengeLeaderboard) {
        throw new Error('Failed to load challenge leaderboard');
      }

      try {

        setLeaderboard(challengeLeaderboard);

        // Convert leaderboard participants to competitor format
        const competitors = challengeLeaderboard.participants.map(
          (participant, index: number) => {
            // For fastest_time, currentProgress is the time in seconds (lower = better)
            const hasCompleted = participant.currentProgress > 0;
            const timeSeconds = participant.currentProgress;

            return {
              id: participant.pubkey,
              name: participant.name || `Runner ${index + 1}`,
              avatar: participant.name?.charAt(0).toUpperCase() || `R${index + 1}`,
              score: hasCompleted ? timeSeconds : 0,
              position: index + 1,
              distance: `${distance} km`,
              time: hasCompleted ? formatDuration(timeSeconds) : 'Not completed',
              workouts: participant.workoutCount || 0,
              isWinner: index === 0 && hasCompleted && challengeLeaderboard.participants.length > 1,
              status: hasCompleted ? 'completed' : 'pending' as const,
              progress: {
                value: hasCompleted ? distance : 0,
                percentage: hasCompleted ? 100 : 0,
                unit: 'km',
              },
            };
          }
        );

        // Calculate time remaining
        const timeRemainingSeconds = endTime - Math.floor(Date.now() / 1000);
        const formattedTimeRemaining = formatTimeRemaining(timeRemainingSeconds);
        const isExpired = timeRemainingSeconds <= 0;
        const hasWinner = competitors.some((c) => c.isWinner);
        const isCompleted = isExpired || hasWinner;

        // Get current user pubkey to check participation
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const userHexPubkey = await AsyncStorage.getItem('@runstr:hex_pubkey');
        const isParticipating = userHexPubkey ? participants.includes(userHexPubkey) : false;

        // Create challenge detail data with real leaderboard
        const challengeDetailData: ChallengeDetailData = {
          id: challengeId,
          name: challengeName,
          description: `1v1 ${distance}km running challenge. Fastest time wins!${wager > 0 ? ` Wager: ${wager} sats (social agreement)` : ''}`,
          prizePool: wager,
          competitors,
          progress: {
            isParticipating,
            isWatching: !isParticipating,
            status: isCompleted ? 'completed' : isExpired ? 'expired' : 'active',
            isCompleted,
            winner: competitors.find((c) => c.isWinner),
          },
          timer: {
            timeRemaining: formattedTimeRemaining,
            isExpired,
          },
          rules: [
            {
              id: '1',
              text: `Complete a ${distance}km run within 24 hours`,
            },
            {
              id: '2',
              text: 'Track your run using the Activity Tracker (publishes kind 1301 to Nostr)',
            },
            {
              id: '3',
              text: 'Fastest time wins - lower time is better',
            },
            {
              id: '4',
              text: wager > 0
                ? `Wager: ${wager} sats (social agreement - not enforced)`
                : 'No wager - run for glory!',
            },
          ],
          status: isCompleted ? 'completed' : isExpired ? 'expired' : 'active',
          formattedPrize: wager > 0 ? `${wager} sats` : 'No wager',
          formattedDeadline: new Date(endTime * 1000).toLocaleDateString(),
        };

        setChallengeData(challengeDetailData);
        setTimeRemaining(challengeDetailData.timer.timeRemaining);
      } catch (leaderboardError) {
        console.error('Failed to load challenge leaderboard:', leaderboardError);

        // Fall back to basic challenge data without leaderboard
        const timeRemainingSeconds = endTime - Math.floor(Date.now() / 1000);
        const formattedTimeRemaining = formatTimeRemaining(timeRemainingSeconds);
        const isExpired = timeRemainingSeconds <= 0;

        const challengeDetailData: ChallengeDetailData = {
          id: challengeId,
          name: challengeName,
          description: `1v1 ${distance}km running challenge. Fastest time wins!`,
          prizePool: wager,
          competitors: [],
          progress: {
            isParticipating: false,
            isWatching: false,
            status: isExpired ? 'expired' : 'active',
            isCompleted: isExpired,
          },
          timer: {
            timeRemaining: formattedTimeRemaining,
            isExpired,
          },
          rules: [
            {
              id: '1',
              text: `Complete a ${distance}km run within 24 hours`,
            },
            {
              id: '2',
              text: 'Track your run using the Activity Tracker',
            },
            {
              id: '3',
              text: 'Fastest time wins',
            },
          ],
          status: isExpired ? 'expired' : 'active',
          formattedPrize: wager > 0 ? `${wager} sats` : 'No wager',
          formattedDeadline: new Date(endTime * 1000).toLocaleDateString(),
        };
        setChallengeData(challengeDetailData);
        setTimeRemaining(formattedTimeRemaining);
      } finally {
        setIsLoadingLeaderboard(false);
      }
    } catch (err) {
      console.error('Failed to load challenge data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load challenge');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Helper function to format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return '0d 0h 0m';

    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${days}d ${hours}h ${minutes}m`;
  };

  // Timer countdown effect (for live updates)
  useEffect(() => {
    if (
      !challengeData ||
      challengeData.timer.isExpired ||
      challengeData.progress.isCompleted
    ) {
      return;
    }

    const timer = setInterval(() => {
      // TODO: Calculate actual time remaining from deadline
      setTimeRemaining(challengeData?.timer.timeRemaining || '');
    }, 1000);

    return () => clearInterval(timer);
  }, [challengeData]);

  // Handle back navigation
  const handleBack = () => {
    navigation.goBack();
  };

  // Handle share functionality
  const handleShare = async () => {
    if (!challengeData) return;

    try {
      const shareOptions = {
        message: `Check out the ${
          challengeData?.name || 'challenge'
        } challenge on RUNSTR! ${challengeData?.description || ''}`,
        title: `${challengeData?.name || 'Challenge'} - RUNSTR Challenge`,
        url: `runstr://challenges/${challengeId}`,
      };

      await Share.share(shareOptions);
    } catch (error) {
      console.error('Error sharing challenge:', error);
    }
  };

  // Handle "Start Run" action - navigates to Activity Tracker
  const handleStartRun = () => {
    if (!challengeData || challengeData.timer.isExpired) return;

    Alert.alert(
      'Start Your Run',
      `Open the Activity Tracker to record your ${challengeData.name.includes('km') ? challengeData.name.split(' ')[0] : 'distance'} run. Your time will be automatically recorded when you publish the workout.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Open Activity Tracker',
          onPress: () => {
            // Navigate to Activity tab
            // TODO: Add navigation to Activity tab when navigation ref is available
            console.log('Navigate to Activity Tracker');
            Alert.alert(
              'Activity Tracker',
              'The Activity tab will open when this feature is fully integrated. For now, manually navigate to the Activity tab to start your run.'
            );
          },
        },
      ]
    );
  };

  const getActionButtonTitle = () => {
    if (!challengeData) return '';

    if (challengeData.progress?.isCompleted) {
      return 'Challenge Completed';
    }

    if (challengeData.timer?.isExpired) {
      return 'Challenge Expired';
    }

    if (challengeData.progress?.isParticipating) {
      // Check if user has completed their run
      const userHasCompleted = challengeData.competitors.some(
        (c) => c.status === 'completed' && challengeData.progress?.isParticipating
      );
      return userHasCompleted ? 'Run Completed ✓' : 'Start Your Run';
    }

    return 'View Challenge';
  };

  const getActionButtonVariant = () => {
    if (!challengeData) return 'secondary';

    if (challengeData.progress?.isCompleted || challengeData.timer?.isExpired) {
      return 'secondary';
    }

    if (challengeData.progress?.isParticipating) {
      return 'primary';
    }

    return 'secondary';
  };

  const getActionButtonAction = () => {
    if (!challengeData) return () => {};

    if (challengeData.progress?.isParticipating && !challengeData.progress?.isCompleted && !challengeData.timer?.isExpired) {
      return handleStartRun;
    }

    // For non-participants or completed challenges, button is informational only
    return () => {};
  };

  const isActionButtonDisabled = () => {
    if (!challengeData) return true;

    // Disable if completed or expired
    if (challengeData.progress?.isCompleted || challengeData.timer?.isExpired) {
      return true;
    }

    // Disable if not participating (instant challenges - can't join after creation)
    if (!challengeData.progress?.isParticipating) {
      return true;
    }

    // Check if user already completed their run
    const userHasCompleted = challengeData.competitors.some(
      (c) => c.status === 'completed' && challengeData.progress?.isParticipating
    );

    return userHasCompleted;
  };

  const getAccessibilityLabel = () => {
    if (!challengeData) return 'Challenge';

    if (challengeData.progress?.isCompleted) {
      return 'Challenge completed';
    }

    if (challengeData.timer?.isExpired) {
      return 'Challenge expired';
    }

    if (challengeData.progress?.isParticipating) {
      return 'Start your run for this challenge';
    }

    return 'View challenge details';
  };

  const getAccessibilityHint = () => {
    if (!challengeData) return 'Loading challenge';

    if (challengeData.progress?.isCompleted) {
      return 'This challenge has been completed';
    }

    if (challengeData.timer?.isExpired) {
      return 'This challenge has expired';
    }

    if (challengeData.progress?.isParticipating) {
      return 'Tap to open Activity Tracker and start your run';
    }

    return 'Instant challenges cannot be joined after creation';
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Loading challenge details...</Text>
      </View>
    );
  }

  // Error state
  if (error || !challengeData) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>{error || 'Challenge not found'}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadChallengeData}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Status Bar */}

      {/* Header */}
      <DetailHeader
        title="Challenge Details"
        onBack={handleBack}
        onShare={handleShare}
      />

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Challenge Header Section */}
        <ChallengeHeader
          title={challengeData.name}
          endDate={challengeData.formattedDeadline}
          prizeAmount={challengeData.formattedPrize}
          description={challengeData.description}
        />

        {/* VS Section */}
        <ChallengeVersus
          competitors={challengeData.competitors}
          isCompleted={challengeData.progress?.isCompleted || false}
          winner={challengeData.progress?.winner}
        />

        {/* Current Status Section */}
        <ChallengeStatus
          progress={challengeData.progress}
          isCompleted={challengeData.progress?.isCompleted || false}
          winner={challengeData.progress?.winner}
        />

        {/* Timer Section */}
        <View style={styles.timerSection}>
          <TimeRemaining
            timeRemaining={timeRemaining}
            isExpired={challengeData.timer?.isExpired || false}
            isCompleted={challengeData.progress?.isCompleted || false}
          />
        </View>

        {/* Rules Section */}
        <RulesSection rules={challengeData.rules} />

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Action Button */}
      <View style={styles.actionSection}>
        <ActionButton
          title={getActionButtonTitle()}
          onPress={getActionButtonAction()}
          variant={getActionButtonVariant()}
          loading={isLoading}
          disabled={isActionButtonDisabled()}
          accessibilityLabel={getAccessibilityLabel()}
          accessibilityHint={getAccessibilityHint()}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  timerSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  actionSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40, // Extra bottom padding for safe area
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  bottomPadding: {
    height: 20, // Extra space before action button
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: theme.colors.text,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    color: theme.colors.background,
    fontWeight: theme.typography.weights.semiBold,
  },
});
