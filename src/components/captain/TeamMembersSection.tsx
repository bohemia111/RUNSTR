/**
 * TeamMembersSection Component - Displays current team members with removal controls
 * Integrates with TeamMemberCache for performance (cache-first pattern)
 * Used in Captain Dashboard for member management
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { MemberAvatar } from '../ui/MemberAvatar';
import { TeamMemberCache } from '../../services/team/TeamMemberCache';
import { useNostrProfiles } from '../../hooks/useCachedData';

interface TeamMembersSectionProps {
  teamId: string;
  captainPubkey: string;
  members: string[]; // Array of member pubkeys (from parent state)
  isLoading?: boolean;
  onRemoveMember: (memberPubkey: string) => void;
  onRefresh?: () => void;
  style?: any;
}

interface EnrichedMember {
  pubkey: string;
  name: string;
  picture?: string;
}

export const TeamMembersSection: React.FC<TeamMembersSectionProps> = ({
  teamId,
  captainPubkey,
  members,
  isLoading = false,
  onRemoveMember,
  onRefresh,
  style,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [enrichedMembers, setEnrichedMembers] = useState<EnrichedMember[]>([]);

  // Fetch profiles using hook (triggers re-renders when profiles arrive)
  const { profiles, loading: profilesLoading } = useNostrProfiles(members);

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
  };

  // Enrich members with profile data whenever members or profiles change
  useEffect(() => {
    if (members.length === 0) {
      setEnrichedMembers([]);
      return;
    }

    const enriched: EnrichedMember[] = members.map(pubkey => ({
      pubkey,
      name: profiles.get(pubkey)?.name || `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`,
      picture: profiles.get(pubkey)?.picture,
    }));

    setEnrichedMembers(enriched);
  }, [members, profiles]);

  /**
   * Check if member is the captain (prevent self-removal)
   */
  const isCaptain = (memberPubkey: string): boolean => {
    return memberPubkey === captainPubkey;
  };

  return (
    <View style={[styles.membersSection, style]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Team Members</Text>
        <View style={styles.memberCount}>
          <Text style={styles.memberCountText}>{members.length}</Text>
        </View>
      </View>

      {members.length > 0 ? (
        <ScrollView
          style={styles.membersList}
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing || isLoading}
              onRefresh={handleRefresh}
              tintColor={theme.colors.text}
            />
          }
        >
          {enrichedMembers.map((member, index) => {
            const isTeamCaptain = isCaptain(member.pubkey);

            return (
              <View
                key={`${member.pubkey}-${index}`}
                style={[
                  styles.memberCard,
                  index === enrichedMembers.length - 1 && styles.lastMemberCard,
                ]}
              >
                <View style={styles.memberInfo}>
                  <MemberAvatar
                    name={member.name}
                    imageUrl={member.picture}
                    size={36}
                  />
                  <View style={styles.memberDetails}>
                    <View style={styles.nameRow}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      {isTeamCaptain && (
                        <View style={styles.captainBadge}>
                          <Text style={styles.captainBadgeText}>CAPTAIN</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {!isTeamCaptain && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => onRemoveMember(member.pubkey)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={20}
                      color={theme.colors.error}
                    />
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {isLoading ? 'Loading team members...' : 'No team members yet'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Main section container
  membersSection: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },

  // Section header with title and count
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },

  memberCount: {
    backgroundColor: theme.colors.text,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },

  memberCountText: {
    color: theme.colors.background,
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
  },

  // Scrollable members list
  membersList: {
    maxHeight: 300, // Limit height to avoid taking too much space
  },

  // Individual member card
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  lastMemberCard: {
    borderBottomWidth: 0, // No border on last item
  },

  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },

  memberDetails: {
    flex: 1,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },

  memberName: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },

  // Captain badge
  captainBadge: {
    backgroundColor: theme.colors.text,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 3,
  },

  captainBadgeText: {
    color: theme.colors.background,
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Remove button
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
  },

  removeButtonText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.error,
  },

  // Empty state
  emptyState: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  emptyStateText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
});
