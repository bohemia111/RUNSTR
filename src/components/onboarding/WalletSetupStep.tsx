/**
 * WalletSetupStep Component
 * NWC wallet configuration step during onboarding
 * Shows benefits and opens the WalletConfigModal
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../styles/theme';
import { WalletConfigModal } from '../wallet/WalletConfigModal';

interface WalletSetupStepProps {
  onContinue: () => void;
  onSkip: () => void;
}

export const WalletSetupStep: React.FC<WalletSetupStepProps> = ({
  onContinue,
  onSkip,
}) => {
  const insets = useSafeAreaInsets();
  const [showModal, setShowModal] = useState(false);
  const [hasConnected, setHasConnected] = useState(false);

  const handleSetupWallet = () => {
    setShowModal(true);
  };

  const handleModalSuccess = () => {
    setHasConnected(true);
    setShowModal(false);
    // Auto-continue after successful connection
    setTimeout(() => {
      onContinue();
    }, 500);
  };

  const handleModalClose = () => {
    setShowModal(false);
    // If they closed without connecting, stay on this screen
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }
        ]}
      >
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="flash" size={50} color={theme.colors.orangeBright} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Connect Your Lightning Wallet</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          Join the Bitcoin economy of fitness
        </Text>

        {/* Benefits Section */}
        <View style={styles.benefitsContainer}>
          <Text style={styles.sectionTitle}>With Lightning, you can:</Text>

          <View style={styles.benefitItem}>
            <View style={styles.benefitIcon}>
              <Ionicons name="trophy" size={24} color={theme.colors.orangeBright} />
            </View>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitTitle}>Win Bitcoin Rewards</Text>
              <Text style={styles.benefitText}>Compete in challenges and earn sats</Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={styles.benefitIcon}>
              <Ionicons name="flash-outline" size={24} color={theme.colors.orangeBright} />
            </View>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitTitle}>Send Instant Zaps</Text>
              <Text style={styles.benefitText}>Tip teammates for motivation</Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={styles.benefitIcon}>
              <Ionicons name="ticket" size={24} color={theme.colors.orangeBright} />
            </View>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitTitle}>Pay Entry Fees</Text>
              <Text style={styles.benefitText}>Join premium competitions</Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={styles.benefitIcon}>
              <Ionicons name="heart" size={24} color={theme.colors.orangeBright} />
            </View>
            <View style={styles.benefitContent}>
              <Text style={styles.benefitTitle}>Support Charities</Text>
              <Text style={styles.benefitText}>Donate to your team's cause</Text>
            </View>
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.howItWorksContainer}>
          <Text style={styles.sectionTitle}>How it works:</Text>
          <Text style={styles.howItWorksText}>
            1. Get a Lightning wallet (Alby, Cash App, Strike)
          </Text>
          <Text style={styles.howItWorksText}>
            2. Generate an NWC connection string
          </Text>
          <Text style={styles.howItWorksText}>
            3. Paste it in RUNSTR to connect
          </Text>
          <Text style={styles.howItWorksText}>
            4. Start earning and sending Bitcoin!
          </Text>
        </View>

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark" size={20} color={theme.colors.orangeBright} />
          <Text style={styles.securityText}>
            Your wallet remains in your control. RUNSTR never has access to your private keys.
          </Text>
        </View>

        {hasConnected && (
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
            <Text style={styles.successText}>Wallet connected successfully!</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer Buttons */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={styles.setupButton}
          onPress={handleSetupWallet}
          activeOpacity={0.8}
        >
          <Ionicons name="wallet" size={20} color="#000000" />
          <Text style={styles.setupButtonText}>Connect Wallet</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={onSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipButtonText}>I'll do this later</Text>
        </TouchableOpacity>
      </View>

      {/* Wallet Config Modal */}
      <WalletConfigModal
        visible={showModal}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        allowSkip={true}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 30,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${theme.colors.orangeBright}15`,
    borderWidth: 2,
    borderColor: theme.colors.orangeBright,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.orangeBright,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  benefitsContainer: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  benefitText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  howItWorksContainer: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  howItWorksText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 24,
    marginBottom: 8,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${theme.colors.orangeBright}10`,
    borderWidth: 1,
    borderColor: `${theme.colors.orangeBright}30`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 18,
    marginLeft: 10,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${theme.colors.success}10`,
    borderWidth: 1,
    borderColor: theme.colors.success,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.success,
    marginLeft: 8,
  },
  footer: {
    paddingHorizontal: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.orangeBright,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  setupButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: theme.colors.textMuted,
  },
});