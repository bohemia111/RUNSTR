/**
 * ExternalZapModal Component
 * Generates and displays Lightning invoice for P2P zaps
 * Allows users to pay from external wallets (Cash App, Strike, etc.)
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { getInvoiceFromLightningAddress } from '../../utils/lnurl';
import LightningZapService from '../../services/nutzap/LightningZapService';
import { npubToHex } from '../../utils/ndkConversion';

interface ExternalZapModalProps {
  visible: boolean;
  recipientNpub: string;
  recipientName: string;
  amount: number;
  memo: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ExternalZapModal: React.FC<ExternalZapModalProps> = ({
  visible,
  recipientNpub,
  recipientName,
  amount,
  memo,
  onClose,
  onSuccess,
}) => {
  const [invoice, setInvoice] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Convert npub to hex for API calls
  const recipientHex = React.useMemo(() => {
    const normalized = npubToHex(recipientNpub);
    if (!normalized) {
      console.warn('[ExternalZapModal] Invalid recipient pubkey:', recipientNpub.slice(0, 20));
      return recipientNpub;
    }
    return normalized;
  }, [recipientNpub]);

  useEffect(() => {
    if (visible && amount > 0) {
      generateInvoice();
    }
  }, [visible, amount]);

  const generateInvoice = async () => {
    setIsLoading(true);
    setError('');

    try {
      // First, attempt to send a Lightning zap to get the Lightning address
      console.log('[ExternalZapModal] Attempting to get Lightning info for:', recipientHex);

      // No need to try sendLightningZap, just fetch the Lightning address directly

      // Extract the Lightning address from the error or profile lookup
      let lightningAddress: string | null = null;

      // Try to get the Lightning address from the user's Nostr profile
      try {
        const { GlobalNDKService } = require('../../services/nostr/GlobalNDKService');
        const ndk = await GlobalNDKService.getInstance();
        const user = ndk.getUser({ pubkey: recipientHex });
        await user.fetchProfile();
        lightningAddress = user.profile?.lud16 || user.profile?.lud06 || null;
      } catch (profileError) {
        console.error('[ExternalZapModal] Error fetching profile:', profileError);
      }

      if (!lightningAddress) {
        throw new Error('Recipient does not have a Lightning address');
      }

      console.log('[ExternalZapModal] Lightning address found:', lightningAddress);

      // Get invoice from Lightning address (NIP-57 zap request will be handled internally)
      console.log('[ExternalZapModal] Requesting invoice for', amount, 'sats');
      const invoiceResult = await getInvoiceFromLightningAddress(
        lightningAddress,
        amount,
        memo
      );

      if (invoiceResult && invoiceResult.invoice) {
        setInvoice(invoiceResult.invoice);
        console.log('[ExternalZapModal] Invoice generated successfully');
      } else {
        throw new Error('Failed to generate invoice');
      }
    } catch (err) {
      console.error('[ExternalZapModal] Error generating invoice:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate invoice');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyInvoice = async () => {
    if (invoice) {
      await Clipboard.setStringAsync(invoice);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenInWallet = () => {
    const uri = `lightning:${invoice}`;
    Linking.canOpenURL(uri).then((supported) => {
      if (supported) {
        Linking.openURL(uri);
      } else {
        Alert.alert(
          'No Lightning Wallet Found',
          'Please copy the invoice and paste it in your Lightning wallet app'
        );
      }
    });
  };

  const handlePaymentConfirmed = () => {
    Alert.alert(
      '⚡ Zap Sent!',
      `Successfully sent ${amount} sats to ${recipientName}`,
      [
        {
          text: 'OK',
          onPress: () => {
            onSuccess?.();
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Ionicons name="qr-code" size={24} color={theme.colors.text} />
              <Text style={styles.title}>Pay with External Wallet</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Recipient Info */}
            <View style={styles.recipientSection}>
              <Text style={styles.recipientLabel}>Zapping:</Text>
              <Text style={styles.recipientName}>{recipientName}</Text>
              <Text style={styles.amount}>{amount} sats</Text>
              {memo && <Text style={styles.memo}>{memo}</Text>}
            </View>

            {/* QR Code or Loading/Error */}
            <View style={styles.qrSection}>
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.colors.text} />
                  <Text style={styles.loadingText}>Generating invoice...</Text>
                </View>
              ) : error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={generateInvoice}
                  >
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : invoice ? (
                <>
                  <View style={styles.qrCodeContainer}>
                    <QRCode
                      value={invoice}
                      size={250}
                      backgroundColor="white"
                      color="black"
                    />
                  </View>

                  <Text style={styles.instructions}>
                    Scan this QR code with any Lightning wallet
                  </Text>

                  {/* Action Buttons */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={handleCopyInvoice}
                    >
                      <Ionicons
                        name={copied ? 'checkmark' : 'copy'}
                        size={20}
                        color={theme.colors.text}
                      />
                      <Text style={styles.copyButtonText}>
                        {copied ? 'Copied!' : 'Copy Invoice'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.openWalletButton}
                      onPress={handleOpenInWallet}
                    >
                      <Ionicons
                        name="open-outline"
                        size={20}
                        color={theme.colors.background}
                      />
                      <Text style={styles.openWalletButtonText}>
                        Open in Wallet
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Supported Wallets */}
                  <View style={styles.supportedWallets}>
                    <Text style={styles.supportedWalletsTitle}>Works with:</Text>
                    <Text style={styles.supportedWalletsList}>
                      Cash App • Strike • Alby • Phoenix • Breez • BlueWallet • Zeus
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          </ScrollView>

          {/* Footer - Payment Confirmation */}
          {invoice && !isLoading && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handlePaymentConfirmed}
              >
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.background} />
                <Text style={styles.confirmButtonText}>I've Paid</Text>
              </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  modal: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.large,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  title: {
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },

  closeButton: {
    padding: 4,
  },

  scrollContent: {
    flex: 1,
  },

  recipientSection: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  recipientLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },

  recipientName: {
    fontSize: 18,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: 8,
  },

  amount: {
    fontSize: 28,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.accent,
  },

  memo: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  qrSection: {
    padding: 20,
    alignItems: 'center',
  },

  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textMuted,
  },

  errorContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },

  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.error,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  retryButton: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  retryButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },

  qrCodeContainer: {
    padding: 20,
    backgroundColor: 'white',
    borderRadius: theme.borderRadius.medium,
    marginBottom: 20,
  },

  instructions: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },

  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },

  copyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  copyButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },

  openWalletButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.accent,
  },

  openWalletButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.background,
  },

  supportedWallets: {
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },

  supportedWalletsTitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },

  supportedWalletsList: {
    fontSize: 12,
    color: theme.colors.text,
    textAlign: 'center',
  },

  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },

  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.success,
  },

  confirmButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.background,
  },
});