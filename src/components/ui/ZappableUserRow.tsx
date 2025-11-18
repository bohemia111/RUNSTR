/**
 * ZappableUserRow Component
 * Reusable component for displaying users with profile resolution and P2P zapping
 * Used across league rankings, team member lists, and competition displays
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { theme } from '../../styles/theme';
import { Avatar } from './Avatar';
import { NWCLightningButton } from '../lightning/NWCLightningButton';
import { CharityZapIconButton } from './CharityZapIconButton';
import { ExternalZapModal } from '../nutzap/ExternalZapModal';
import { CharitySelectionService } from '../../services/charity/CharitySelectionService';
import { useNostrProfile } from '../../hooks/useCachedData';

interface ZappableUserRowProps {
  npub: string;
  fallbackName?: string;
  additionalContent?: React.ReactNode;
  showQuickZap?: boolean;
  showChallengeButton?: boolean;
  zapAmount?: number;
  onZapSuccess?: () => void;
  style?: any;
  disabled?: boolean;
  hideActionsForCurrentUser?: boolean; // Hide challenge/zap for current user
}

export const ZappableUserRow: React.FC<ZappableUserRowProps> = ({
  npub,
  fallbackName,
  additionalContent,
  showQuickZap = true,
  showChallengeButton = true,
  zapAmount = 21,
  onZapSuccess,
  style,
  disabled = false,
  hideActionsForCurrentUser = false,
}) => {
  const { profile } = useNostrProfile(npub);
  const [charityModalVisible, setCharityModalVisible] = useState(false);
  const [selectedCharity, setSelectedCharity] = useState<{ name: string; address: string } | null>(null);

  // Resolve display name with fallback chain (treat empty strings as falsy)
  // Priority: profile name → profile display_name → fallbackName → Anonymous (if no profile) → truncated npub
  const displayName =
    profile?.name ||
    profile?.display_name ||
    (fallbackName && fallbackName.trim() !== '' ? fallbackName : null) ||
    (!profile ? 'Anonymous' : (npub?.startsWith('npub1') ? `${npub.slice(0, 12)}...` : 'Anonymous'));

  const avatarUrl = profile?.picture;

  const handleCharityZap = async () => {
    try {
      const charity = await CharitySelectionService.getSelectedCharity();
      setSelectedCharity({
        name: charity.name,
        address: charity.lightningAddress,
      });
      setCharityModalVisible(true);
    } catch (error) {
      console.error('[ZappableUserRow] Error loading charity:', error);
    }
  };

  return (
    <>
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

              {/* Charity & Zap buttons next to name */}
              {!hideActionsForCurrentUser && (
                <View style={styles.actionButtons}>
                  {showChallengeButton && (
                    <CharityZapIconButton
                      userPubkey={npub}
                      userName={displayName}
                      disabled={disabled}
                      onPress={handleCharityZap}
                    />
                  )}
                  {showQuickZap && (
                    <NWCLightningButton
                      recipientNpub={npub}
                      recipientName={displayName}
                      size="small"
                      disabled={disabled}
                      onZapSuccess={onZapSuccess}
                      style={styles.zapButton}
                    />
                  )}
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

      {/* Charity Zap Modal */}
      {selectedCharity && (
        <ExternalZapModal
          visible={charityModalVisible}
          onClose={() => setCharityModalVisible(false)}
          recipientNpub={selectedCharity.address}
          recipientName={selectedCharity.name}
          amount={21}
          memo={`Donation to ${selectedCharity.name}`}
          onSuccess={() => {
            setCharityModalVisible(false);
            console.log('Charity donation sent from ZappableUserRow!');
          }}
        />
      )}
    </>
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
