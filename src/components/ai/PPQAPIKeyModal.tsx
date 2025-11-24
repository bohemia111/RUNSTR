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
  const { setApiKey: saveApiKey, apiKeyConfigured } = useCoachRunstr();

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
    onClose();
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

          {/* Description */}
          <Text style={styles.description}>
            Get AI-powered workout insights with PPQ.AI. Pay anonymously with
            Bitcoin. Your data, your control.
          </Text>

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
            <Text style={styles.getReferralButtonText}>Get API Key</Text>
          </TouchableOpacity>

          {/* API Key Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>API Key</Text>
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

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color="#ff6b6b" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#FF9D42"
            />
            <Text style={styles.infoText}>
              PPQ.AI costs ~$0.001 per insight. Your API key is stored locally
              and never shared.
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
              <Text style={styles.saveButtonText}>Save API Key</Text>
            )}
          </TouchableOpacity>

          {/* Status */}
          {apiKeyConfigured && (
            <View style={styles.statusContainer}>
              <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
              <Text style={styles.statusText}>API Key Configured</Text>
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
    color: '#4ade80',
    marginLeft: 8,
    fontWeight: theme.typography.weights.medium,
  },
});
