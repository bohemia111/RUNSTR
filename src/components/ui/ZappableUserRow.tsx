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
import { TouchableOpacity } from 'react-native';
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
  const [selectedCharity, setSelectedCharity] = useState<{
    name: string;
    address: string;
  } | null>(null);
  const [charityName, setCharityName] = useState<string>('');

  // Load charity name on mount
  React.useEffect(() => {
    loadCharityName();
  }, []);

  const loadCharityName = async () => {
    try {
      const charity = await CharitySelectionService.getSelectedCharity();
      setCharityName(charity.displayName);
    } catch (error) {
      console.error('[ZappableUserRow] Error loading charity name:', error);
      setCharityName('OpenSats'); // Default fallback
    }
  };

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

              {/* Only Zap button next to name (charity moved below) */}
              {!hideActionsForCurrentUser && showQuickZap && (
                <View style={styles.actionButtons}>
                  <NWCLightningButton
                    recipientNpub={npub}
                    recipientName={displayName}
                    size="small"
                    disabled={disabled}
                    onZapSuccess={onZapSuccess}
                    style={styles.zapButton}
                  />
                </View>
              )}
            </View>

            {/* Charity button below name */}
            {!hideActionsForCurrentUser &&
              showChallengeButton &&
              charityName && (
                <TouchableOpacity
                  style={styles.charityButton}
                  onPress={handleCharityZap}
                  disabled={disabled}
                  activeOpacity={0.7}
                >
                  <Text style={styles.charityButtonText} numberOfLines={1}>
                    {charityName}
                  </Text>
                </TouchableOpacity>
              )}
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

  charityButton: {
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 140, 0, 0.1)', // Subtle orange background
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 0, 0.3)', // Subtle orange border
    alignSelf: 'flex-start', // Shrink to content width
    flexShrink: 0, // Prevent squishing
    minWidth: 80, // Ensure minimum readable width
    maxWidth: 150, // Adjusted for charity name only
  },

  charityButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.orangeBright || '#FF8C00',
  },
});
