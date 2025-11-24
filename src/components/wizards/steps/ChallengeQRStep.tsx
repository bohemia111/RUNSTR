/**
 * ChallengeQRStep - Display QR code for challenge sharing
 * Final step for QR-based challenges
 * Shows QR code, deep link, and sharing options
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { theme } from '../../../styles/theme';
import type { ChallengeDeepLinkData } from '../../../utils/challengeDeepLink';
import {
  generateChallengeDeepLink,
  getChallengeDescription,
} from '../../../utils/challengeDeepLink';
import { getChallengeName } from '../../../constants/simpleChallengePresets';
import { challengeNostrService } from '../../../services/challenge/ChallengeNostrService';
import { UnifiedSigningService } from '../../../services/auth/UnifiedSigningService';

interface ChallengeQRStepProps {
  challengeData: ChallengeDeepLinkData;
  onDone: () => void;
}

export const ChallengeQRStep: React.FC<ChallengeQRStepProps> = ({
  challengeData,
  onDone,
}) => {
  const [isCopying, setIsCopying] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const deepLink = generateChallengeDeepLink(challengeData);
  const durationText =
    challengeData.duration === 1 ? '1 Day' : `${challengeData.duration} Days`;

  const handleCopyLink = async () => {
    try {
      setIsCopying(true);
      await Clipboard.setStringAsync(deepLink);
      Alert.alert('Copied!', 'Challenge link copied to clipboard');
    } catch (error) {
      console.error('Failed to copy link:', error);
      Alert.alert('Error', 'Failed to copy link');
    } finally {
      setIsCopying(false);
    }
  };

  const handleShare = async () => {
    try {
      const shareMessage = `Challenge me! ${getChallengeDescription(
        challengeData
      )}\n\nScan QR or click: ${deepLink}`;

      await Share.share({
        message: shareMessage,
        url: Platform.OS === 'ios' ? deepLink : undefined,
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  const handlePostToNostr = async () => {
    try {
      setIsPosting(true);

      // Get unified signer (supports both Amber and nsec)
      const signingService = UnifiedSigningService.getInstance();
      const signer = await signingService.getSigner();

      if (!signer) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Get user's name for the post
      const AsyncStorage = (
        await import('@react-native-async-storage/async-storage')
      ).default;
      const userName =
        (await AsyncStorage.getItem('@runstr:user_name')) || 'RUNSTR User';

      // Post challenge to Nostr
      const result = await challengeNostrService.postChallenge(
        {
          type: challengeData.type,
          duration: challengeData.duration,
          wager: challengeData.wager,
          creatorName: userName,
          deepLink,
        },
        signer
        // TODO: Add qrImageUri option to capture and upload QR code image
      );

      if (result.success) {
        Alert.alert(
          'Posted!',
          'Your challenge has been posted to Nostr. Anyone can scan or click the link to accept!'
        );
      } else {
        throw new Error(result.error || 'Failed to post challenge');
      }
    } catch (error) {
      console.error('Failed to post challenge to Nostr:', error);
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to post challenge. Please try again.'
      );
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* QR Code */}
      <View style={styles.qrContainer}>
        <QRCode value={deepLink} size={200} backgroundColor="white" />
      </View>

      {/* Challenge Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.challengeType}>
          {getChallengeName(challengeData.type)}
        </Text>
        <View style={styles.detailsRow}>
          <Text style={styles.detailText}>{durationText}</Text>
          {challengeData.wager > 0 && (
            <>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.wagerText}>
                {challengeData.wager.toLocaleString()} sats
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Instructions */}
      <Text style={styles.instructions}>
        Share this QR code with anyone. Each person who scans creates a separate
        1v1 challenge with you.
      </Text>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.postButton}
          onPress={handlePostToNostr}
          disabled={isPosting}
          activeOpacity={0.7}
        >
          {isPosting ? (
            <ActivityIndicator size="small" color={theme.colors.accentText} />
          ) : (
            <Text style={styles.postButtonText}>Post to Nostr</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.copyButton}
          onPress={handleCopyLink}
          disabled={isCopying}
          activeOpacity={0.7}
        >
          <Text style={styles.copyButtonText}>
            {isCopying ? 'Copying...' : 'Copy Link'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Done Button */}
      <TouchableOpacity style={styles.doneButton} onPress={onDone}>
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  qrContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  challengeType: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  separator: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  wagerText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.accent,
  },
  instructions: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  postButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  postButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.accentText,
  },
  shareButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.accent,
  },
  copyButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.buttonBorder,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  doneButton: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
