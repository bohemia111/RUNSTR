/**
 * CompactWallet - Streamlined wallet display for Profile screen
 * Shows NWC connection status and Bitcoin features
 * App works without wallet - connect wallet for Bitcoin features
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { theme } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { NWCStorageService } from '../../services/wallet/NWCStorageService';
import { NWCWalletService } from '../../services/wallet/NWCWalletService';
import { WalletConfigModal } from '../wallet/WalletConfigModal';

interface CompactWalletProps {
  onSendPress?: () => void;
  onReceivePress?: () => void;
  onHistoryPress?: () => void;
}

export const CompactWallet: React.FC<CompactWalletProps> = ({
  onSendPress,
  onReceivePress,
}) => {
  const [hasNWC, setHasNWC] = useState(false);
  const [balance, setBalance] = useState(0);
  const [showWalletConfig, setShowWalletConfig] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Initialize wallet on mount - DON'T auto-connect, just check if configured
  // This prevents app freeze from blocking NWCClient WebSocket
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setConnectionError(null);
      try {
        const nwcAvailable = await NWCStorageService.hasNWC();
        setHasNWC(nwcAvailable);
        // DON'T automatically fetch balance - let user tap refresh
        // This prevents the blocking NWCClient from freezing the app
        if (nwcAvailable) {
          setConnectionError('Tap refresh to connect');
        }
      } catch (error) {
        console.error('[CompactWallet] Init error:', error);
        setConnectionError('Error checking wallet');
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  // Refresh balance
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setConnectionError(null);
    try {
      const result = await NWCWalletService.getBalance();
      if (result.error) {
        setConnectionError(result.error);
      } else {
        setBalance(result.balance);
      }
    } catch (error) {
      console.error('[CompactWallet] Refresh error:', error);
      setConnectionError('Refresh failed');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Handle wallet config success - DON'T immediately fetch balance
  // This prevents blocking the UI if the wallet is slow to connect
  // User can tap refresh to test the connection
  const handleWalletConfigSuccess = useCallback(async () => {
    setConnectionError(null);
    setIsLoading(false);
    const nwcAvailable = await NWCStorageService.hasNWC();
    setHasNWC(nwcAvailable);
    // Show "Tap refresh to connect" state - don't block trying to connect
    if (nwcAvailable) {
      setBalance(0);
      setConnectionError('Tap refresh to connect');
    }
  }, []);

  // Handle wallet disconnect
  const handleDisconnectWallet = useCallback(() => {
    Alert.alert(
      'Disconnect Wallet',
      'Are you sure you want to disconnect your wallet? You can reconnect anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await NWCStorageService.clearNWC();
              NWCWalletService.forceReset();
              setHasNWC(false);
              setBalance(0);
              setConnectionError(null);
            } catch (error) {
              console.error('[CompactWallet] Disconnect error:', error);
              Alert.alert('Error', 'Failed to disconnect wallet');
            }
          },
        },
      ]
    );
  }, []);

  const formatBalance = (sats: number): string => {
    if (sats >= 1000000) {
      return `${(sats / 1000000).toFixed(2)}M`;
    } else if (sats >= 1000) {
      return `${(sats / 1000).toFixed(1)}K`;
    }
    return sats.toString();
  };

  return (
    <>
      <View style={styles.walletBox}>
        {!hasNWC ? (
          // No wallet configured - show connect prompt
          <View style={styles.noWalletContainer}>
            <View style={styles.noWalletIcon}>
              <Ionicons
                name="wallet-outline"
                size={32}
                color={theme.colors.textMuted}
              />
            </View>
            <Text style={styles.noWalletTitle}>
              Connect Wallet to Send Bitcoin
            </Text>
            <Text style={styles.noWalletDescription}>
              Connect your Lightning wallet (NWC) to send zaps, pay event fees,
              and make challenge wagers
            </Text>
            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => setShowWalletConfig(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={18} color="#000000" />
              <Text style={styles.connectButtonText}>Connect Wallet</Text>
            </TouchableOpacity>
            <Text style={styles.receiveNote}>
              Set your Lightning address in profile to receive Bitcoin
            </Text>
          </View>
        ) : (
          // Wallet configured - show balance and actions
          <>
            {/* Disconnect button */}
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={handleDisconnectWallet}
              activeOpacity={0.6}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="settings-outline"
                size={16}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>

            {/* Balance display */}
            <View style={styles.balanceContainer}>
              {connectionError ? (
                <TouchableOpacity onPress={handleRefresh} style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={18} color="#FF6B6B" />
                  <Text style={styles.errorText}>Tap to retry</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <Text style={styles.balanceAmount}>{formatBalance(balance)}</Text>
                  <Text style={styles.balanceUnit}>sats</Text>
                </>
              )}
              {isLoading || isRefreshing ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.textMuted}
                  style={styles.syncIndicator}
                />
              ) : !connectionError && (
                <TouchableOpacity
                  onPress={handleRefresh}
                  style={styles.refreshButton}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name="refresh"
                    size={16}
                    color={theme.colors.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Action buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onSendPress}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-up" size={16} color={theme.colors.text} />
                <Text style={styles.actionText}>Send</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={onReceivePress}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="arrow-down"
                  size={16}
                  color={theme.colors.text}
                />
                <Text style={styles.actionText}>Receive</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <WalletConfigModal
        visible={showWalletConfig}
        onClose={() => setShowWalletConfig(false)}
        onSuccess={handleWalletConfigSuccess}
        allowSkip={true}
      />
    </>
  );
};

const styles = StyleSheet.create({
  walletBox: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 12,
    padding: 10,
    minHeight: 80,
    position: 'relative',
  },

  disconnectButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    zIndex: 10,
  },

  noWalletContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },

  noWalletIcon: {
    marginBottom: 8,
  },

  noWalletTitle: {
    fontSize: 15,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },

  noWalletDescription: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },

  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF9D42',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },

  receiveNote: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  connectButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: '#000000',
  },

  balanceContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -32,
  },

  balanceAmount: {
    fontSize: 24,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },

  balanceUnit: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },

  syncIndicator: {
    marginLeft: 8,
  },

  refreshButton: {
    marginLeft: 8,
    padding: 4,
  },

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  errorText: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: theme.typography.weights.medium,
  },

  actions: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },

  actionButton: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.small,
    paddingVertical: 6,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },

  actionText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
});
