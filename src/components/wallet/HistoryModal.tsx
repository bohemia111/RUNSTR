/**
 * HistoryModal - Transaction history modal for Lightning wallet
 * Displays sent and received transactions in a modal interface
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { theme } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { NWCWalletService } from '../../services/wallet/NWCWalletService';

interface Transaction {
  id: string;
  type: 'incoming' | 'outgoing';
  invoice?: string;
  description?: string;
  preimage?: string;
  payment_hash: string;
  amount: number;
  fees_paid?: number;
  created_at: number;
  settled_at?: number;
  metadata?: any;
}

interface HistoryModalProps {
  visible: boolean;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  visible,
  onClose,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (visible) {
      loadTransactions();
    }
  }, [visible]);

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      const walletService = NWCWalletService;
      const result = await walletService.listTransactions({ limit: 50 });

      if (result.success && result.transactions) {
        // Convert NWC transaction format to UI format
        const formattedTransactions: Transaction[] = result.transactions.map(
          (tx) => ({
            id: tx.payment_hash,
            type: tx.type,
            invoice: tx.invoice,
            description: tx.description,
            preimage: tx.preimage,
            payment_hash: tx.payment_hash,
            amount: tx.amount,
            fees_paid: tx.fees_paid,
            created_at: tx.created_at,
            settled_at: tx.settled_at,
            metadata: tx.metadata,
          })
        );
        setTransactions(formattedTransactions);
      } else {
        console.error('Failed to load transactions:', result.error);
        setTransactions([]);
      }
    } catch (error) {
      console.error('Failed to load transaction history:', error);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTransactions();
    setIsRefreshing(false);
  };

  const formatTime = (timestamp: number): string => {
    // NWC timestamps are in seconds, convert to milliseconds
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getTransactionIcon = (type: 'incoming' | 'outgoing'): string => {
    return type === 'outgoing' ? 'arrow-up-circle' : 'arrow-down-circle';
  };

  const getTransactionColor = (type: 'incoming' | 'outgoing'): string => {
    return type === 'outgoing'
      ? theme.colors.textMuted // Muted orange for sent
      : theme.colors.orangeBright; // Bright orange for received
  };

  const getTransactionTitle = (type: 'incoming' | 'outgoing'): string => {
    return type === 'outgoing'
      ? 'Lightning Payment Sent'
      : 'Lightning Payment Received';
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionIcon}>
        <Ionicons
          name={getTransactionIcon(item.type) as any}
          size={32}
          color={getTransactionColor(item.type)}
        />
      </View>

      <View style={styles.transactionDetails}>
        <Text style={styles.transactionTitle}>
          {getTransactionTitle(item.type)}
        </Text>
        {item.description && (
          <Text style={styles.transactionMemo} numberOfLines={1}>
            {item.description}
          </Text>
        )}
        <Text style={styles.transactionTime}>
          {formatTime(item.created_at)}
        </Text>
      </View>

      <View style={styles.transactionAmount}>
        <Text
          style={[styles.amountText, { color: getTransactionColor(item.type) }]}
        >
          {item.type === 'outgoing' ? '-' : '+'}
          {item.amount}
        </Text>
        <Text style={styles.amountUnit}>sats</Text>
        {item.fees_paid && (
          <Text style={styles.feeText}>fee: {item.fees_paid}</Text>
        )}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="wallet-outline"
        size={48}
        color={theme.colors.textMuted}
      />
      <Text style={styles.emptyTitle}>No Transactions Yet</Text>
      <Text style={styles.emptyText}>
        Send or receive payments to see them here
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Transaction History</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={renderTransaction}
            ListEmptyComponent={renderEmpty}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.accent}
              />
            }
            contentContainerStyle={
              transactions.length === 0 ? styles.emptyList : styles.list
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pure black background
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a', // Dark border
    backgroundColor: '#000000',
  },

  title: {
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textBright, // White text
  },

  closeButton: {
    padding: 4,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  list: {
    padding: 16,
  },

  emptyList: {
    flex: 1,
    padding: 16,
  },

  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a', // Dark card background
    borderRadius: theme.borderRadius.medium,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1a1a1a', // Dark border
  },

  transactionIcon: {
    marginRight: 12,
  },

  transactionDetails: {
    flex: 1,
  },

  transactionTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textBright, // White text
    marginBottom: 2,
  },

  transactionMemo: {
    fontSize: 12,
    color: theme.colors.textMuted, // Muted orange text
    marginBottom: 2,
  },

  transactionTime: {
    fontSize: 11,
    color: theme.colors.textMuted, // Muted orange text
  },

  transactionAmount: {
    alignItems: 'flex-end',
  },

  amountText: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
  },

  amountUnit: {
    fontSize: 11,
    color: theme.colors.textMuted, // Muted orange text
    marginTop: 2,
  },

  feeText: {
    fontSize: 10,
    color: theme.colors.textMuted, // Muted orange text
    marginTop: 2,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textBright, // White text
    marginTop: 16,
    marginBottom: 8,
  },

  emptyText: {
    fontSize: 14,
    color: theme.colors.textMuted, // Muted orange text
    textAlign: 'center',
  },
});
