/**
 * ZappableUserRow Component
 * Reusable component for displaying users with profile resolution and direct user zapping
 * Used across league rankings, team member lists, and competition displays
 *
 * Updated: Lightning button now zaps user directly (RUNSTR Community Rewards)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../styles/theme';
import { Avatar } from './Avatar';
import { NWCLightningButton } from '../lightning/NWCLightningButton';
import { useNostrProfile } from '../../hooks/useCachedData';

interface ZappableUserRowProps {
  npub: string;
  fallbackName?: string;
  additionalContent?: React.ReactNode;
  showQuickZap?: boolean;
  zapAmount?: number;
  onZapSuccess?: () => void;
  style?: any;
  disabled?: boolean;
  hideActionsForCurrentUser?: boolean; // Hide zap for current user
  recipientLightningAddress?: string; // User's lightning address from workout event or profile
}

export const ZappableUserRow: React.FC<ZappableUserRowProps> = ({
  npub,
  fallbackName,
  additionalContent,
  showQuickZap = true,
  zapAmount = 21,
  onZapSuccess,
  style,
  disabled = false,
  hideActionsForCurrentUser = false,
  recipientLightningAddress,
}) => {
  const { profile } = useNostrProfile(npub);

  // Resolve display name with fallback chain (treat empty strings as falsy)
  // Priority: profile name → profile display_name → fallbackName → Anonymous (if no profile) → truncated npub
  const displayName =
    profile?.name ||
    profile?.display_name ||
    (fallbackName && fallbackName.trim() !== '' ? fallbackName : null) ||
    (!profile
      ? 'Anonymous'
      : npub?.startsWith('npub1')
      ? `${npub.slice(0, 12)}...`
      : 'Anonymous');

  const avatarUrl = profile?.picture;

  // Get user's lightning address: prop (from workout event) → profile lud16 → undefined
  const userLightningAddress = recipientLightningAddress || profile?.lud16;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.userSection}>
        {/* Avatar with profile picture or fallback */}
        <Avatar
          name={displayName}
          size={36}
          imageUrl={avatarUrl}
          style={styles.avatar}
        />

        {/* User name with action buttons */}
        <View style={styles.contentSection}>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {displayName}
            </Text>

            {/* Lightning button zaps user directly (RUNSTR Community Rewards) */}
            {!hideActionsForCurrentUser && showQuickZap && userLightningAddress && (
              <View style={styles.actionButtons}>
                <NWCLightningButton
                  recipientNpub={npub}
                  recipientName={displayName}
                  recipientLightningAddress={userLightningAddress}
                  size="small"
                  disabled={disabled}
                  onZapSuccess={onZapSuccess}
                  style={styles.zapButton}
                />
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Additional content (stats, etc) on the right */}
      {additionalContent && (
        <View style={styles.additionalContent}>{additionalContent}</View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 52,
  },

  userSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    marginRight: 8,
  },

  contentSection: {
    flex: 1,
    justifyContent: 'center',
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  userName: {
    fontSize: 15,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },

  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  additionalContent: {
    marginTop: 2,
    flex: 0,
    minWidth: 90,
    paddingRight: 12,
  },

  zapButton: {
    // Gap handled by actionButtons
  },
});
