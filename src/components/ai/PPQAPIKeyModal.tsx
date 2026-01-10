/**
 * PPQAPIKeyModal - Configure PPQ.AI API Key for Coach RUNSTR
 *
 * Allows users to input their PPQ.AI API key and provides link to sign up
 * with referral code for Bitcoin-powered AI insights.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { useCoachRunstr } from '../../services/ai/useCoachRunstr';

interface PPQAPIKeyModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PPQ_REFERRAL_URL = 'https://ppq.ai/invite/637cf3fc';

export const PPQAPIKeyModal: React.FC<PPQAPIKeyModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCustomKeySection, setShowCustomKeySection] = useState(false);
  const { setApiKey: saveApiKey, resetToDefaultKey, isUsingDefaultKey } = useCoachRunstr();

  const handleGetApiKey = async () => {
    try {
      const supported = await Linking.canOpenURL(PPQ_REFERRAL_URL);
      if (supported) {
        await Linking.openURL(PPQ_REFERRAL_URL);
      } else {
        setError('Cannot open browser. Please visit ppq.ai manually.');
      }
    } catch (err) {
      console.error('Failed to open PPQ.AI referral link:', err);
      setError('Failed to open browser.');
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await saveApiKey(apiKey.trim());
      setApiKey('');
      onSuccess();
    } catch (err) {
      console.error('Failed to save API key:', err);
      setError('Failed to save API key. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setApiKey('');
    setError(null);
    setShowCustomKeySection(false);
    onClose();
  };

  const handleResetToDefault = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await resetToDefaultKey();
      setApiKey('');
      setShowCustomKeySection(false);
      onSuccess();
    } catch (err) {
      console.error('Failed to reset to default key:', err);
      setError('Failed to reset. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="fitness" size={24} color="#FF9D42" />
            </View>
            <Text style={styles.title}>Coach RUNSTR AI</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Default Key Active Status */}
          {isUsingDefaultKey && (
            <View style={styles.defaultActiveBox}>
              <Ionicons name="checkmark-circle" size={20} color="#FF9D42" />
              <Text style={styles.defaultActiveText}>
                RUNSTR Premium is active. AI features are ready to use!
              </Text>
            </View>
          )}

          {/* Custom Key Active Status */}
          {!isUsingDefaultKey && (
            <View style={styles.customActiveBox}>
              <Ionicons name="key" size={20} color="#FF9D42" />
              <Text style={styles.customActiveText}>
                Using your custom PPQ.AI key
              </Text>
            </View>
          )}

          {/* Reset to Default Button (only if using custom key) */}
          {!isUsingDefaultKey && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleResetToDefault}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={theme.colors.text} />
              ) : (
                <>
                  <Ionicons name="refresh" size={18} color={theme.colors.text} />
                  <Text style={styles.resetButtonText}>Reset to RUNSTR Premium</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Toggle Custom Key Section */}
          <TouchableOpacity
            style={styles.toggleCustomSection}
            onPress={() => setShowCustomKeySection(!showCustomKeySection)}
          >
            <Text style={styles.toggleCustomText}>
              {showCustomKeySection ? 'Hide custom key options' : 'Use your own PPQ.AI key (optional)'}
            </Text>
            <Ionicons
              name={showCustomKeySection ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>

          {/* Custom Key Section (expandable) */}
          {showCustomKeySection && (
            <>
              {/* Get API Key Button */}
              <TouchableOpacity
                style={styles.getReferralButton}
                onPress={handleGetApiKey}
                disabled={isSaving}
              >
                <Ionicons
                  name="open-outline"
                  size={20}
                  color="#000"
                  style={styles.buttonIcon}
                />
                <Text style={styles.getReferralButtonText}>Get Your Own API Key</Text>
              </TouchableOpacity>

              {/* API Key Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Your API Key</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Paste your PPQ.AI API key here"
                  placeholderTextColor={theme.colors.textMuted}
                  value={apiKey}
                  onChangeText={setApiKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  editable={!isSaving}
                />
              </View>

              {/* Info Box */}
              <View style={styles.infoBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#FF9D42"
                />
                <Text style={styles.infoText}>
                  Using your own key? Costs ~$0.001 per insight. Your key is stored
                  locally and never shared.
                </Text>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!apiKey.trim() || isSaving) && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={!apiKey.trim() || isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Custom Key</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color="#ff6b6b" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
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

  modalContainer: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  headerIcon: {
    marginRight: 8,
  },

  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
    color: '#FFB366',
  },

  closeButton: {
    padding: 4,
  },

  description: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },

  getReferralButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9D42',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 24,
  },

  buttonIcon: {
    marginRight: 8,
  },

  getReferralButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: '#000',
  },

  inputContainer: {
    marginBottom: 16,
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: 8,
  },

  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: theme.colors.text,
    fontFamily: 'monospace',
  },

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },

  errorText: {
    fontSize: 13,
    color: '#ff6b6b',
    marginLeft: 8,
    flex: 1,
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1a1510',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },

  infoText: {
    fontSize: 13,
    color: '#CC7A33',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },

  saveButton: {
    backgroundColor: '#FF9D42',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },

  saveButtonDisabled: {
    backgroundColor: '#3a3a3a',
    opacity: 0.5,
  },

  saveButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: '#000',
  },

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },

  statusText: {
    fontSize: 14,
    color: theme.colors.accent,
    marginLeft: 8,
    fontWeight: theme.typography.weights.medium,
  },

  defaultActiveBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1510',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3a2a10',
  },

  defaultActiveText: {
    fontSize: 14,
    color: '#FF9D42',
    marginLeft: 10,
    flex: 1,
    fontWeight: theme.typography.weights.medium,
  },

  customActiveBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1510',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3a2a10',
  },

  customActiveText: {
    fontSize: 14,
    color: '#FF9D42',
    marginLeft: 10,
    flex: 1,
    fontWeight: theme.typography.weights.medium,
  },

  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },

  resetButtonText: {
    fontSize: 14,
    color: theme.colors.text,
    marginLeft: 8,
    fontWeight: theme.typography.weights.medium,
  },

  toggleCustomSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },

  toggleCustomText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginRight: 6,
  },
});
