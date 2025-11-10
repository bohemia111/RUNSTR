/**
 * TeammatesView Component - Shows all teammates from user's teams
 * Groups teammates by team name and allows viewing profiles
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../styles/theme';
import { MemberAvatar } from '../ui/MemberAvatar';
import { TeamMemberCache } from '../../services/team/TeamMemberCache';
import { useNostrProfiles } from '../../hooks/useCachedData';
import { NWCLightningButton } from '../lightning/NWCLightningButton';
import { ChallengeIconButton } from '../ui/ChallengeIconButton';
import { SimpleChallengeWizardV2 } from '../wizards/SimpleChallengeWizardV2';
import type { Team } from '../../types';

interface TeammateData {
  pubkey: string;
  name: string;
  picture?: string;
  teamName: string;
  teamId: string;
}

interface TeammatesViewProps {
  teams: Team[];
  userNpub: string;
  onRefresh?: () => Promise<void>;
  isLoadingTeams?: boolean;
}

export const TeammatesView: React.FC<TeammatesViewProps> = ({
  teams,
  userNpub,
  onRefresh,
  isLoadingTeams = false,
}) => {
  const navigation = useNavigation<any>();
  const [teammates, setTeammates] = useState<TeammateData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [groupedTeammates, setGroupedTeammates] = useState<Record<string, TeammateData[]>>({});
  const [activeWizard, setActiveWizard] = useState<string | null>(null);
  const [allMemberPubkeys, setAllMemberPubkeys] = useState<string[]>([]);

  // Fetch profiles for all members using hook
  const { profiles, loading: profilesLoading } = useNostrProfiles(allMemberPubkeys);

  // Load teammate pubkeys from all teams (profiles fetched by hook)
  const loadTeammates = useCallback(async () => {
    try {
      setIsLoading(true);
      const allPubkeys: string[] = [];
      const rawTeammates: TeammateData[] = [];

      // Handle empty teams case gracefully
      if (teams.length === 0) {
        setTeammates([]);
        setGroupedTeammates({});
        setAllMemberPubkeys([]);
        setIsLoading(false);
        return;
      }

      const memberCache = TeamMemberCache.getInstance();

      // For each team, fetch member pubkeys
      for (const team of teams) {
        if (!team.id || !team.captainId) {
          console.warn(`Skipping team ${team.name} - missing ID or captain`);
          continue;
        }

        try {
          // Get members from kind 30000 list
          const memberPubkeys = await memberCache.getTeamMembers(
            team.id,
            team.captainId
          );

          console.log(`Found ${memberPubkeys.length} members in team ${team.name}`);

          // Collect teammate data WITHOUT profiles (profiles will be fetched by hook)
          for (const pubkey of memberPubkeys) {
            // Skip self
            if (pubkey === userNpub) continue;

            allPubkeys.push(pubkey);
            rawTeammates.push({
              pubkey,
              name: `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`, // Placeholder
              picture: undefined,
              teamName: team.name,
              teamId: team.id,
            });
          }
        } catch (error) {
          console.error(`Error loading members for team ${team.name}:`, error);
        }
      }

      // Store raw teammate data and pubkeys (hook will fetch profiles)
      setTeammates(rawTeammates);
      setAllMemberPubkeys([...new Set(allPubkeys)]); // Deduplicate pubkeys
    } catch (error) {
      console.error('Failed to load teammates:', error);
    } finally {
      setIsLoading(false);
    }
  }, [teams, userNpub]);

  // Load teammates when teams change
  useEffect(() => {
    loadTeammates();
  }, [loadTeammates]);

  // Enrich teammates with profile data when profiles arrive
  useEffect(() => {
    if (teammates.length === 0) {
      setGroupedTeammates({});
      return;
    }

    // Enrich each teammate with profile data
    const enriched = teammates.map(teammate => ({
      ...teammate,
      name: profiles.get(teammate.pubkey)?.name || teammate.name,
      picture: profiles.get(teammate.pubkey)?.picture,
    }));

    // Group by team name
    const grouped = enriched.reduce((acc, teammate) => {
      if (!acc[teammate.teamName]) {
        acc[teammate.teamName] = [];
      }
      acc[teammate.teamName].push(teammate);
      return acc;
    }, {} as Record<string, TeammateData[]>);

    setGroupedTeammates(grouped);
  }, [teammates, profiles]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (onRefresh) {
      await onRefresh();
    }
    await loadTeammates();
    setIsRefreshing(false);
  };

  const handleTeammatePress = (teammate: TeammateData) => {
    // Navigate to user profile
    navigation.navigate('UserProfile', {
      npub: teammate.pubkey,
      userName: teammate.name,
    });
  };

  // Show loading if actively fetching teammates or if parent is loading teams
  if ((isLoading && teammates.length === 0) || (isLoadingTeams && teams.length === 0)) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color={theme.colors.text} />
        <Text style={styles.loadingText}>
          {isLoadingTeams ? 'Loading teams...' : 'Loading teammates...'}
        </Text>
      </View>
    );
  }

  if (!isLoading && teammates.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateTitle}>No Teammates Yet</Text>
        <Text style={styles.emptyStateDescription}>
          Join teams to see your teammates here
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.text}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {Object.entries(groupedTeammates).map(([teamName, members]) => (
        <View key={teamName} style={styles.teamSection}>
          <View style={styles.teamHeader}>
            <Text style={styles.teamName}>{teamName}</Text>
            <Text style={styles.memberCount}>
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </Text>
          </View>

          {members.map((teammate) => (
            <View
              key={`${teammate.teamId}-${teammate.pubkey}`}
              style={styles.teammateCard}
            >
              <TouchableOpacity
                style={styles.teammateContent}
                onPress={() => handleTeammatePress(teammate)}
                activeOpacity={0.7}
              >
                <MemberAvatar
                  name={teammate.name}
                  imageUrl={teammate.picture}
                  size={40}
                />
                <View style={styles.teammateInfo}>
                  <Text style={styles.teammateName} numberOfLines={1}>
                    {teammate.name}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Action buttons - hide for current user */}
              {teammate.pubkey !== userNpub && (
                <View style={styles.actionButtons}>
                  <NWCLightningButton
                    recipientNpub={teammate.pubkey}
                    recipientName={teammate.name}
                    size="small"
                    onZapSuccess={() => console.log('Zapped teammate:', teammate.name)}
                  />
                  <ChallengeIconButton
                    userPubkey={teammate.pubkey}
                    userName={teammate.name}
                    onPress={() => setActiveWizard(teammate.pubkey)}
                  />
                </View>
              )}
            </View>
          ))}
        </View>
      ))}

      {/* Challenge Wizard Modal - render for all teammates */}
      {teammates.map((teammate) => (
        <SimpleChallengeWizardV2
          key={`wizard-${teammate.pubkey}`}
          visible={activeWizard === teammate.pubkey}
          onClose={() => setActiveWizard(null)}
          preSelectedOpponent={{
            pubkey: teammate.pubkey,
            name: teammate.name,
          }}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingBottom: 32,
  },

  loadingState: {
    alignItems: 'center',
    paddingVertical: 60,
  },

  loadingText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 16,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },

  emptyStateTitle: {
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 12,
  },

  emptyStateDescription: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  teamSection: {
    marginBottom: 24,
  },

  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  teamName: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },

  memberCount: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },

  teammateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  teammateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  teammateInfo: {
    flex: 1,
    marginLeft: 12,
  },

  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginLeft: 12,
  },

  teammateName: {
    fontSize: 15,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
});