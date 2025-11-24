/**
 * ChallengePreviewModal - Preview challenge from QR code/deep link
 * Shows challenge details with Accept/Decline options
 * Auto-accept flow: Creates challenge immediately when accepted
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { theme } from '../../styles/theme';
import type { ParsedChallengeData } from '../../utils/challengeDeepLink';
import { getChallengeDescription } from '../../utils/challengeDeepLink';
import { getChallengeName } from '../../constants/simpleChallengePresets';

export interface ChallengePreviewModalProps {
  visible: boolean;
  challengeData: ParsedChallengeData | null;
  onAccept: (challengeData: ParsedChallengeData) => Promise<void>;
  onDecline: () => void;
  onClose: () => void;
}

export const ChallengePreviewModal: React.FC<ChallengePreviewModalProps> = ({
  visible,
  challengeData,
  onAccept,
  onDecline,
  onClose,
}) => {
  const [isAccepting, setIsAccepting] = useState(false);

  if (!challengeData || !challengeData.isValid) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Invalid Challenge</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.errorText}>
              {challengeData?.error ||
                'This challenge link is invalid or expired.'}
            </Text>

            <TouchableOpacity style={styles.closeOnlyButton} onPress={onClose}>
              <Text style={styles.closeOnlyButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  const handleAccept = async () => {
    try {
      setIsAccepting(true);
      await onAccept(challengeData);
      // Success handled by parent component
    } catch (error) {
      console.error('Failed to accept challenge:', error);
      Alert.alert(
        'Accept Failed',
        error instanceof Error ? error.message : 'An error occurred'
      );
    } finally {
      setIsAccepting(false);
    }
  };

  const challengerInitial = challengeData.creatorName.charAt(0).toUpperCase();
  const durationText =
    challengeData.duration === 1 ? '1 Day' : `${challengeData.duration} Days`;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Challenge Request</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={isAccepting}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Challenger Info */}
          <View style={styles.challengerSection}>
            <View style={styles.challengerAvatar}>
              <Text style={styles.challengerInitial}>{challengerInitial}</Text>
            </View>
            <Text style={styles.challengerName}>
              {challengeData.creatorName}
            </Text>
            <Text style={styles.challengerSubtitle}>challenged you!</Text>
          </View>

          {/* Challenge Details Card */}
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type:</Text>
              <Text style={styles.detailText}>
                {getChallengeName(challengeData.type)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Duration:</Text>
              <Text style={styles.detailText}>{durationText}</Text>
            </View>

            {challengeData.wager > 0 && (
              <View style={styles.wagerRow}>
                <Text style={styles.detailLabel}>Wager:</Text>
                <View>
                  <Text style={styles.wagerAmount}>
                    {challengeData.wager.toLocaleString()} sats
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Description */}
          <Text style={styles.description}>
            {getChallengeDescription(challengeData)}
          </Text>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.declineButton,
                isAccepting && styles.buttonDisabled,
              ]}
              onPress={onDecline}
              disabled={isAccepting}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.acceptButton,
                isAccepting && styles.buttonDisabled,
              ]}
              onPress={handleAccept}
              disabled={isAccepting}
            >
              {isAccepting ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.accentText}
                />
              ) : (
                <Text style={styles.acceptButtonText}>Accept</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.large,
    width: '100%',
    maxWidth: 400,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 20,
    color: theme.colors.textMuted,
  },
  challengerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  challengerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.syncBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  challengerInitial: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.text,
  },
  challengerName: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  challengerSubtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  detailsCard: {
    backgroundColor: theme.colors.prizeBackground,
    borderRadius: theme.borderRadius.medium,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  detailText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  wagerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  wagerAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.accent,
  },
  description: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.buttonBorder,
    borderRadius: theme.borderRadius.medium,
    paddingVertical: 14,
    alignItems: 'center',
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.medium,
    paddingVertical: 14,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.accentText,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  closeOnlyButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.medium,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeOnlyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.accentText,
  },
});
