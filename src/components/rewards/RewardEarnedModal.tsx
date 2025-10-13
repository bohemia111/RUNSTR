/**
 * RewardEarnedModal - Display when user earns daily workout reward
 * Simple black and orange theme
 * Shows amount earned (50 sats)
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

interface RewardEarnedModalProps {
  visible: boolean;
  amount: number;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

export const RewardEarnedModal: React.FC<RewardEarnedModalProps> = ({
  visible,
  amount,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Lightning bolt icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="flash" size={64} color="#FF9D42" />
          </View>

          {/* Amount text */}
          <Text style={styles.amountText}>
            You earned {amount} sats! ⚡
          </Text>

          {/* Close button */}
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Nice!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#0a0a0a',
    borderWidth: 3,
    borderColor: '#FF9D42',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: width - 80,
    maxWidth: 340,
    // Add subtle shadow
    shadowColor: '#FF9D42',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 20,
    // Animated pulse effect could be added here
  },
  amountText: {
    fontSize: 22,
    fontWeight: theme.typography.weights.bold,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 30,
  },
  closeButton: {
    backgroundColor: '#FF9D42',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 140,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: '#000000',
  },
});
