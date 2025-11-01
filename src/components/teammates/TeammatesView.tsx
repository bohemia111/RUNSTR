/**
 * TeammatesView Component - Shows all teammates from user's teams
 * Groups teammates by team name and allows viewing profiles
 */

import React, { useState, useEffect } from 'react';
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
import { ProfileCache } from '../../cache/ProfileCache';
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
}

export const TeammatesView: React.FC<TeammatesViewProps> = ({
  teams,
  userNpub,
  onRefresh,
}) => {
  const navigation = useNavigation<any>();
  const [teammates, setTeammates] = useState<TeammateData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [groupedTeammates, setGroupedTeammates] = useState<Record<string, TeammateData[]>>({});

  // Load teammates from all teams
  const loadTeammates = async () => {
    try {
      setIsLoading(true);
      const allTeammates: TeammateData[] = [];
      const memberCache = TeamMemberCache.getInstance();

      // For each team, fetch members
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

          // Batch fetch profiles
          if (memberPubkeys.length > 0) {
            const profiles = await ProfileCache.fetchProfiles(memberPubkeys);

            // Transform to teammate data
            for (const pubkey of memberPubkeys) {
              // Skip self
              if (pubkey === userNpub) continue;

              const profile = profiles.get(pubkey);
              allTeammates.push({
                pubkey,
                name: profile?.name || `${pubkey.slice(0, 8)}...`,
                picture: profile?.picture,
                teamName: team.name,
                teamId: team.id,
              });
            }
          }
        } catch (error) {
          console.error(`Error loading members for team ${team.name}:`, error);
        }
      }

      setTeammates(allTeammates);

      // Group by team name
      const grouped = allTeammates.reduce((acc, teammate) => {
        if (!acc[teammate.teamName]) {
          acc[teammate.teamName] = [];
        }
        acc[teammate.teamName].push(teammate);
        return acc;
      }, {} as Record<string, TeammateData[]>);

      setGroupedTeammates(grouped);
    } catch (error) {
      console.error('Failed to load teammates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load teammates when teams change
  useEffect(() => {
    if (teams.length > 0) {
      loadTeammates();
    }
  }, [teams]);

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

  if (isLoading && teammates.length === 0) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color={theme.colors.text} />
        <Text style={styles.loadingText}>Loading teammates...</Text>
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
            <TouchableOpacity
              key={`${teammate.teamId}-${teammate.pubkey}`}
              style={styles.teammateCard}
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
                <Text style={styles.teammatePubkey} numberOfLines={1}>
                  {teammate.pubkey.slice(0, 16)}...
                </Text>
              </View>
              <TouchableOpacity
                style={styles.zapButton}
                onPress={() => {
                  // TODO: Implement zap functionality
                  console.log('Zap teammate:', teammate.pubkey);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.zapIcon}>⚡</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
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
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  teammateInfo: {
    flex: 1,
    marginLeft: 12,
  },

  teammateName: {
    fontSize: 15,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: 2,
  },

  teammatePubkey: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },

  zapButton: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  zapIcon: {
    fontSize: 16,
  },
});