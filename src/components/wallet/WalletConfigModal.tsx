/**
 * WalletConfigModal - Optional NWC wallet configuration
 * Allows users to connect their Nostr Wallet Connect wallet
 * App works without wallet (tracking, free events)
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { NWCStorageService } from '../../services/wallet/NWCStorageService';
import { CustomAlert } from '../ui/CustomAlert';

interface WalletConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  allowSkip?: boolean;
}

export const WalletConfigModal: React.FC<WalletConfigModalProps> = ({
  visible,
  onClose,
  onSuccess,
  allowSkip = true,
}) => {
  const [nwcString, setNwcString] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  // Alert state for CustomAlert
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<
    Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }>
  >([]);

  // Reset validation state when modal closes
  useEffect(() => {
    if (!visible) {
      setIsValidating(false);
      setNwcString('');
    }
  }, [visible]);

  const handleSave = async () => {
    if (!nwcString.trim()) {
      setAlertTitle('Empty Input');
      setAlertMessage('Please paste your NWC connection string');
      setAlertButtons([{ text: 'OK', style: 'default' }]);
      setAlertVisible(true);
      return;
    }

    setIsValidating(true);

    try {
      const result = await NWCStorageService.saveNWCString(nwcString.trim());

      if (result.success) {
        setAlertTitle('Wallet Connected');
        setAlertMessage('You can now send and receive Bitcoin!');
        setAlertButtons([
          {
            text: 'OK',
            style: 'default',
            onPress: () => {
              setNwcString('');
              onSuccess?.();
              onClose();
            },
          },
        ]);
        setAlertVisible(true);
      } else {
        setAlertTitle('Connection Failed');
        setAlertMessage(
          result.error || 'Please check your NWC string and try again.'
        );
        setAlertButtons([{ text: 'OK', style: 'default' }]);
        setAlertVisible(true);
      }
    } catch (error) {
      console.error('[WalletConfig] Save error:', error);
      setAlertTitle('Error');
      setAlertMessage('Failed to save wallet configuration');
      setAlertButtons([{ text: 'OK', style: 'default' }]);
      setAlertVisible(true);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSkip = () => {
    setAlertTitle('Skip Wallet Setup?');
    setAlertMessage(
      'You can still use the app to track workouts and join free events. Bitcoin features will be disabled.'
    );
    setAlertButtons([
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Skip',
        style: 'destructive',
        onPress: onClose,
      },
    ]);
    setAlertVisible(true);
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    if (isValidating) {
      setAlertTitle('Cancel Validation?');
      setAlertMessage(
        'Connection test is in progress. Are you sure you want to cancel?'
      );
      setAlertButtons([
        { text: 'Continue Testing', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => {
            setIsValidating(false);
            onClose();
          },
        },
      ]);
      setAlertVisible(true);
    } else {
      onClose();
    }
  };

  const handleHelp = () => {
    setAlertTitle('What is NWC?');
    setAlertMessage(
      'Nostr Wallet Connect lets you connect your Lightning wallet to RUNSTR. You can get an NWC connection string from:\n\n• Alby (getalby.com)\n• Mutiny Wallet\n• Other NWC-compatible wallets'
    );
    setAlertButtons([
      {
        text: 'Open Alby',
        onPress: () => Linking.openURL('https://getalby.com'),
      },
      { text: 'OK', style: 'default' },
    ]);
    setAlertVisible(true);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoid}
          >
            <View style={styles.modal}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text style={styles.title}>Connect Wallet</Text>
                </View>
                <View style={styles.headerRight}>
                  <TouchableOpacity
                    onPress={handleHelp}
                    style={styles.helpButton}
                  >
                    <Ionicons
                      name="help-circle-outline"
                      size={24}
                      color={theme.colors.text}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCancel}
                    style={styles.closeButton}
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={theme.colors.text}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={styles.scrollContent}
              >
                {/* Subtitle */}
                <Text style={styles.subtitle}>
                  Connect your Lightning wallet to send Bitcoin payments
                </Text>

                {/* Input Field */}
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>NWC Connection String</Text>
                  <TextInput
                    value={nwcString}
                    onChangeText={setNwcString}
                    placeholder="nostr+walletconnect://..."
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.input}
                    multiline
                    numberOfLines={3}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isValidating}
                    returnKeyType="done"
                    blurOnSubmit={true}
                    onSubmitEditing={Keyboard.dismiss}
                    textAlignVertical="top"
                  />
                  <Text style={styles.inputHint}>
                    Paste your NWC connection string from Alby or another wallet
                  </Text>
                </View>

                {/* Action Buttons */}
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={isValidating || !nwcString.trim()}
                  style={[
                    styles.connectButton,
                    (!nwcString.trim() || isValidating) &&
                      styles.connectButtonDisabled,
                  ]}
                >
                  {isValidating ? (
                    <ActivityIndicator color="#000000" />
                  ) : (
                    <>
                      <Ionicons name="wallet" size={20} color="#000000" />
                      <Text style={styles.connectButtonText}>
                        Connect Wallet
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {allowSkip && (
                  <TouchableOpacity
                    onPress={handleSkip}
                    style={styles.skipButton}
                  >
                    <Text style={styles.skipButtonText}>Skip for Now</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>

      {/* CustomAlert for themed alerts */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        onClose={() => setAlertVisible(false)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    width: '100%',
  },
  modal: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#FF9D42',
    paddingTop: 24,
    paddingHorizontal: 24,
    maxHeight: '90%',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  helpButton: {
    padding: 4,
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textMuted,
    marginBottom: 20,
    lineHeight: 22,
  },
  explanationBox: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: '#FF9D42',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
    marginBottom: 8,
  },
  explanationNote: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#FF9D42',
    marginBottom: 0,
  },
  benefitsList: {
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  benefitText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: theme.colors.text,
    fontFamily: 'monospace',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 8,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF9D42',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  connectButtonDisabled: {
    opacity: 0.5,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
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
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.cardBackground,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
});
