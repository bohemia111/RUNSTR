/**
 * WelcomePermissionModal Component
 * Simple educational modal shown on first app launch
 * Introduces app features without requesting permissions
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

interface WelcomePermissionModalProps {
  visible: boolean;
  onComplete: () => void;
}

export const WelcomePermissionModal: React.FC<WelcomePermissionModalProps> = ({
  visible,
  onComplete,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onComplete}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Logo/Icon */}
          <View style={styles.iconContainer}>
            <Ionicons
              name="trophy"
              size={64}
              color={theme.colors.orangeBright}
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>WELCOME TO RUNSTR</Text>

          {/* Feature List */}
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons
                name="search"
                size={24}
                color={theme.colors.orangeBright}
                style={styles.featureIcon}
              />
              <Text style={styles.featureText}>
                Discover bitcoin powered teams and events
              </Text>
            </View>

            <View style={styles.featureItem}>
              <Ionicons
                name="fitness"
                size={24}
                color={theme.colors.orangeBright}
                style={styles.featureIcon}
              />
              <Text style={styles.featureText}>
                Track health and fitness activity
              </Text>
            </View>

            <View style={styles.featureItem}>
              <Ionicons
                name="person"
                size={24}
                color={theme.colors.orangeBright}
                style={styles.featureIcon}
              />
              <Text style={styles.featureText}>
                Review your fitness profile
              </Text>
            </View>
          </View>

          {/* Get Started Button */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onComplete}
            activeOpacity={0.7}
          >
            <Ionicons
              name="arrow-forward"
              size={20}
              color={theme.colors.background}
              style={styles.buttonIcon}
            />
            <Text style={styles.primaryButtonText}>GET STARTED</Text>
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
    padding: 24,
  },
  modalContainer: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconContainer: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 32,
  },
  featureList: {
    marginBottom: 32,
    gap: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    marginRight: 16,
  },
  featureText: {
    fontSize: 15,
    color: theme.colors.text,
    flex: 1,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: theme.colors.orangeBright,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  buttonIcon: {
    marginRight: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.background,
    letterSpacing: 1,
  },
});
