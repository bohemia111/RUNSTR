/**
 * TeamSelectionModal - Modal for selecting competition team
 * Displays all followed teams with current selection highlighted
 * Includes "No Team" option to clear selection
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import type { LocalMembership } from '../../services/team/teamMembershipService';

interface TeamSelectionModalProps {
  visible: boolean;
  teams: LocalMembership[];
  currentTeamId: string | null;
  onSelect: (teamId: string | null) => void;
  onCancel: () => void;
}

export const TeamSelectionModal: React.FC<TeamSelectionModalProps> = ({
  visible,
  teams,
  currentTeamId,
  onSelect,
  onCancel,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Select Team</Text>
            <Text style={styles.subtitle}>
              Team shown in your social posts
            </Text>
          </View>

          {/* Team Options */}
          <ScrollView
            style={styles.teamList}
            showsVerticalScrollIndicator={false}
          >
            {/* No Team Option */}
            <TouchableOpacity
              style={[
                styles.teamButton,
                currentTeamId === null && styles.teamButtonActive,
              ]}
              onPress={() => onSelect(null)}
              activeOpacity={0.8}
            >
              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>No Team</Text>
              </View>
              {currentTeamId === null && (
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={theme.colors.accent}
                />
              )}
            </TouchableOpacity>

            {/* Team Options */}
            {teams.map((team) => (
              <TouchableOpacity
                key={team.teamId}
                style={[
                  styles.teamButton,
                  currentTeamId === team.teamId && styles.teamButtonActive,
                ]}
                onPress={() => onSelect(team.teamId)}
                activeOpacity={0.8}
              >
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>{team.teamName}</Text>
                </View>
                {currentTeamId === team.teamId && (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={theme.colors.accent}
                  />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.orangeDeep,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.orangeBright,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  teamList: {
    maxHeight: 360,
    marginBottom: 16,
  },
  teamButton: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamButtonActive: {
    backgroundColor: 'rgba(255, 140, 0, 0.1)',
    borderColor: theme.colors.accent,
    borderWidth: 2,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  teamDescription: {
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
});
