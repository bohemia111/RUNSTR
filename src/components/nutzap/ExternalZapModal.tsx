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
import {
  parseBolt11Invoice,
  validateInvoiceAmount,
  getInvoiceTimeRemaining,
} from '../../utils/bolt11Parser';
import {
  openInCashApp,
  openInZeus,
  openInPhoenix,
  openInWalletOfSatoshi,
  openInBreez,
} from '../../utils/walletDeepLinks';

interface ExternalZapModalProps {
  visible: boolean;
  recipientNpub: string;  // Can be npub OR Lightning address
  recipientName: string;
  amount: number;
  memo?: string;  // Optional - will default to "Donation to {recipientName}"
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  // Convert npub to hex for API calls (skip for Lightning addresses)
  const recipientHex = React.useMemo(() => {
    // If it's a Lightning address, don't try to convert it
    if (recipientNpub && recipientNpub.includes('@')) {
      console.log('[ExternalZapModal] Lightning address detected, skipping npub conversion');
      return recipientNpub;
    }

    // Try to convert npub to hex
    const normalized = npubToHex(recipientNpub);
    if (!normalized) {
      console.warn(
        '[ExternalZapModal] Invalid recipient pubkey:',
        recipientNpub.slice(0, 20)
      );
      return recipientNpub;
    }
    return normalized;
  }, [recipientNpub]);

  useEffect(() => {
    console.log('[ExternalZapModal] Modal state changed:', { visible, amount, recipientNpub });

    if (visible) {
      // Always generate invoice when modal opens, even if amount is 0 (show error)
      if (amount && amount > 0) {
        generateInvoice();
      } else {
        // Show error if amount is invalid
        setError('Invalid amount. Please select an amount and try again.');
        setIsLoading(false);
      }
    } else {
      // Reset state when modal closes
      setInvoice('');
      setError('');
      setIsLoading(false);
      setIsExpired(false);
      setTimeRemaining(null);
    }
  }, [visible, amount]);

  // Countdown timer effect - updates every second
  useEffect(() => {
    if (!invoice || !visible) {
      setTimeRemaining(null);
      return;
    }

    // Initial time calculation
    const remaining = getInvoiceTimeRemaining(invoice);
    setTimeRemaining(remaining);

    if (remaining !== null && remaining <= 0) {
      setIsExpired(true);
      return;
    }

    // Update countdown every second
    const interval = setInterval(() => {
      const newRemaining = getInvoiceTimeRemaining(invoice);
      setTimeRemaining(newRemaining);

      if (newRemaining !== null && newRemaining <= 0) {
        setIsExpired(true);
        clearInterval(interval);

        // Auto-regenerate invoice after 2 seconds
        setTimeout(() => {
          console.log('[ExternalZapModal] Invoice expired, regenerating...');
          generateInvoice();
        }, 2000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [invoice, visible]);

  const generateInvoice = async () => {
    console.log('[ExternalZapModal] Starting invoice generation...', {
      recipientNpub,
      recipientName,
      amount,
      memo
    });

    setIsLoading(true);
    setError('');
    setIsExpired(false);
    setInvoice('');
    setTimeRemaining(null);

    try {
      let lightningAddress: string | null = null;

      // Check if recipientNpub is actually a Lightning address (contains '@')
      if (recipientNpub && recipientNpub.includes('@')) {
        // It's already a Lightning address (e.g., charity@getalby.com)
        console.log(
          '[ExternalZapModal] ✅ Direct Lightning address provided:',
          recipientNpub
        );
        lightningAddress = recipientNpub;
      } else {
        // It's an npub, need to fetch Lightning address from Nostr profile
        console.log(
          '[ExternalZapModal] Attempting to get Lightning info for npub:',
          recipientHex
        );

        // Try to get the Lightning address from the user's Nostr profile
        try {
          const {
            GlobalNDKService,
          } = require('../../services/nostr/GlobalNDKService');
          const ndk = await GlobalNDKService.getInstance();
          const user = ndk.getUser({ pubkey: recipientHex });
          await user.fetchProfile();
          lightningAddress = user.profile?.lud16 || user.profile?.lud06 || null;
          console.log('[ExternalZapModal] Profile Lightning address:', lightningAddress);
        } catch (profileError) {
          console.error(
            '[ExternalZapModal] Error fetching profile:',
            profileError
          );
        }
      }

      if (!lightningAddress) {
        const errorMsg = 'Recipient does not have a Lightning address';
        console.error('[ExternalZapModal] ❌', errorMsg);
        throw new Error(errorMsg);
      }

      console.log(
        '[ExternalZapModal] ⚡ Lightning address found:',
        lightningAddress
      );

      // Get invoice from Lightning address (NIP-57 zap request will be handled internally)
      console.log('[ExternalZapModal] 🔄 Requesting invoice for', amount, 'sats');
      console.log('[ExternalZapModal] Memo:', memo || `Donation to ${recipientName}`);

      const invoiceResult = await getInvoiceFromLightningAddress(
        lightningAddress,
        amount,
        memo || `Donation to ${recipientName}`  // Default memo if not provided
      );

      console.log('[ExternalZapModal] Invoice result:', {
        hasInvoice: !!invoiceResult?.invoice,
        invoiceLength: invoiceResult?.invoice?.length,
        successMessage: invoiceResult?.successMessage
      });

      if (invoiceResult && invoiceResult.invoice) {
        // Validate invoice amount matches requested amount
        console.log('[ExternalZapModal] Validating invoice amount...');
        const amountValid = validateInvoiceAmount(
          invoiceResult.invoice,
          amount
        );

        if (!amountValid) {
          const errorMsg = `Invoice amount mismatch! Expected ${amount} sats. Please try again.`;
          console.error('[ExternalZapModal] ❌', errorMsg);
          throw new Error(errorMsg);
        }

        setInvoice(invoiceResult.invoice);
        console.log(
          '[ExternalZapModal] ✅ Invoice generated and validated successfully!',
          'Invoice starts with:', invoiceResult.invoice.substring(0, 20) + '...'
        );
      } else {
        const errorMsg = 'Failed to generate invoice - no invoice returned';
        console.error('[ExternalZapModal] ❌', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (err) {
      console.error('[ExternalZapModal] ❌ Error generating invoice:', err);

      // Provide more specific error messages
      let errorMessage = 'Failed to generate invoice';
      if (err instanceof Error) {
        if (err.message.includes('timeout') || err.message.includes('Timeout')) {
          errorMessage = 'Request timed out. The Lightning service may be temporarily unavailable. Please try again.';
        } else if (err.message.includes('network') || err.message.includes('Network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (err.message.includes('Lightning address')) {
          errorMessage = err.message;
        } else {
          errorMessage = err.message || 'Failed to generate invoice';
        }
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
      console.log('[ExternalZapModal] Invoice generation complete');
    }
  };

  const handleCopyInvoice = async () => {
    if (invoice) {
      await Clipboard.setStringAsync(invoice);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenInCashApp = async () => {
    await openInCashApp(invoice);
  };

  const handleOpenInZeus = async () => {
    await openInZeus(invoice);
  };

  const handleOpenInPhoenix = async () => {
    await openInPhoenix(invoice);
  };

  const handleOpenInWalletOfSatoshi = async () => {
    await openInWalletOfSatoshi(invoice);
  };

  const handleOpenInBreez = async () => {
    await openInBreez(invoice);
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

            {/* QR Code or Loading/Error - Always show something */}
            <View style={styles.qrSection}>
              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons
                    name="alert-circle"
                    size={48}
                    color={theme.colors.error}
                  />
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
                  {/* Expiration Timer */}
                  {timeRemaining !== null && (
                    <View style={styles.timerContainer}>
                      {isExpired ? (
                        <View style={styles.expiredBanner}>
                          <Ionicons
                            name="time-outline"
                            size={16}
                            color={theme.colors.error}
                          />
                          <Text style={styles.expiredText}>
                            Invoice Expired - Regenerating...
                          </Text>
                        </View>
                      ) : timeRemaining < 300 ? (
                        <View
                          style={[
                            styles.timerBanner,
                            timeRemaining < 60 && styles.timerBannerUrgent,
                          ]}
                        >
                          <Ionicons
                            name="time-outline"
                            size={16}
                            color={
                              timeRemaining < 60
                                ? theme.colors.error
                                : theme.colors.orangeBright
                            }
                          />
                          <Text
                            style={[
                              styles.timerText,
                              timeRemaining < 60 && styles.timerTextUrgent,
                            ]}
                          >
                            Expires in {Math.floor(timeRemaining / 60)}:
                            {String(timeRemaining % 60).padStart(2, '0')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  )}

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

                  {/* Copy Invoice Button */}
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

                  {/* Wallet Selection Buttons */}
                  <View style={styles.walletButtonsSection}>
                    <Text style={styles.walletSectionTitle}>
                      Select Wallet
                    </Text>

                    {/* Cash App */}
                    <TouchableOpacity
                      style={styles.walletButtonFullWidth}
                      onPress={handleOpenInCashApp}
                    >
                      <View style={styles.walletIconCircleInline}>
                        <Ionicons
                          name="logo-usd"
                          size={24}
                          color={theme.colors.accent}
                        />
                      </View>
                      <Text style={styles.walletButtonText} numberOfLines={1}>
                        Cash App
                      </Text>
                    </TouchableOpacity>

                    {/* Zeus */}
                    <TouchableOpacity
                      style={styles.walletButtonFullWidth}
                      onPress={handleOpenInZeus}
                    >
                      <View style={styles.walletIconCircleInline}>
                        <Ionicons
                          name="flash-outline"
                          size={24}
                          color={theme.colors.accent}
                        />
                      </View>
                      <Text style={styles.walletButtonText} numberOfLines={1}>
                        Zeus
                      </Text>
                    </TouchableOpacity>

                    {/* Phoenix */}
                    <TouchableOpacity
                      style={styles.walletButtonFullWidth}
                      onPress={handleOpenInPhoenix}
                    >
                      <View style={styles.walletIconCircleInline}>
                        <Ionicons
                          name="rocket-outline"
                          size={24}
                          color={theme.colors.accent}
                        />
                      </View>
                      <Text style={styles.walletButtonText} numberOfLines={1}>
                        Phoenix
                      </Text>
                    </TouchableOpacity>

                    {/* Wallet of Satoshi */}
                    <TouchableOpacity
                      style={styles.walletButtonFullWidth}
                      onPress={handleOpenInWalletOfSatoshi}
                    >
                      <View style={styles.walletIconCircleInline}>
                        <Ionicons
                          name="wallet-outline"
                          size={24}
                          color={theme.colors.accent}
                        />
                      </View>
                      <Text style={styles.walletButtonText} numberOfLines={1}>
                        Wallet of Satoshi
                      </Text>
                    </TouchableOpacity>

                    {/* Breez */}
                    <TouchableOpacity
                      style={styles.walletButtonFullWidth}
                      onPress={handleOpenInBreez}
                    >
                      <View style={styles.walletIconCircleInline}>
                        <Ionicons
                          name="wind-outline"
                          size={24}
                          color={theme.colors.accent}
                        />
                      </View>
                      <Text style={styles.walletButtonText} numberOfLines={1}>
                        Breez
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                // Default loading state - shown while generating invoice or if state is empty
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.colors.text} />
                  <Text style={styles.loadingText}>
                    {isLoading ? 'Generating invoice...' : 'Preparing payment...'}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer - Payment Confirmation */}
          {invoice && !isLoading && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handlePaymentConfirmed}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={theme.colors.background}
                />
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
    height: '85%',  // Fixed height to establish flex context for ScrollView
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 20,
  },

  copyButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
  },

  walletButtonsSection: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },

  walletSectionTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },

  walletRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
  },

  walletButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 6,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 100,
  },

  walletButtonFullWidth: {
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 24,
    borderRadius: theme.borderRadius.medium,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 16,
    minHeight: 80,
    marginBottom: 12,
  },

  walletIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 157, 66, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  walletIconCircleInline: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 157, 66, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  walletButtonText: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semiBold,
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

  timerContainer: {
    width: '100%',
    marginBottom: 16,
  },

  timerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 157, 66, 0.1)',
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.orangeBright,
  },

  timerBannerUrgent: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: theme.colors.error,
  },

  timerText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.orangeBright,
  },

  timerTextUrgent: {
    color: theme.colors.error,
  },

  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },

  expiredText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.error,
  },
});
