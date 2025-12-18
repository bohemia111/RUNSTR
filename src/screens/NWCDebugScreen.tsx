/**
 * NWC Debug Screen - Test NWC connection in React Native
 * Shows real-time connection status and debugging information
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NWCWalletService } from '../services/wallet/NWCWalletService';
import { NWCStorageService } from '../services/wallet/NWCStorageService';
import { styles } from '../styles/AppStyles';

export function NWCDebugScreen() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initial check
    checkNWCStatus();
  }, []);

  const addLog = (message: string, isError = false) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    const prefix = isError ? '❌' : '✅';
    setLogs((prev) => [...prev, `${timestamp} ${prefix} ${message}`]);
    console.log(`[NWCDebug] ${message}`);
  };

  const checkNWCStatus = async () => {
    addLog('Checking NWC status...');

    try {
      // Check if NWC is configured
      const hasNWC = await NWCStorageService.hasNWC();
      addLog(`NWC configured: ${hasNWC}`);

      if (hasNWC) {
        const nwcString = await NWCStorageService.getNWCString();
        if (nwcString) {
          // Parse and log relay URL
          const url = new URL(nwcString);
          const relay = url.searchParams.get('relay');
          addLog(`Relay: ${relay}`);
        }
      }

      // Check connection status
      const status = await NWCStorageService.getStatus();
      addLog(
        `Connection status: ${status.connected ? 'Connected' : 'Disconnected'}`
      );
      setIsConnected(status.connected);

      if (status.lastBalance) {
        setBalance(status.lastBalance);
        addLog(`Cached balance: ${status.lastBalance} sats`);
      }
    } catch (error: any) {
      addLog(`Status check failed: ${error.message}`, true);
    }
  };

  const testWebSocket = () => {
    addLog('Testing WebSocket availability...');

    try {
      // Check if WebSocket exists
      if (typeof WebSocket !== 'undefined') {
        addLog(`WebSocket available: YES`);
        addLog(`WebSocket type: ${typeof WebSocket}`);

        // Try to create a test WebSocket
        const testWs = new WebSocket('wss://relay.getalby.com/v1');

        testWs.onopen = () => {
          addLog('Test WebSocket connected to Alby relay!');
          testWs.close();
        };

        testWs.onerror = (event: any) => {
          addLog(
            `Test WebSocket error: ${event.message || 'Unknown error'}`,
            true
          );
        };

        testWs.onclose = () => {
          addLog('Test WebSocket closed');
        };
      } else {
        addLog('WebSocket NOT available!', true);
      }
    } catch (error: any) {
      addLog(`WebSocket test failed: ${error.message}`, true);
    }
  };

  const testSDKImport = async () => {
    addLog('Testing SDK import...');

    try {
      const { NWCClient } = await import('@getalby/sdk');
      addLog(`NWCClient imported: ${!!NWCClient}`);

      // Check if we can create a client
      const testClient = new NWCClient({
        nostrWalletConnectUrl: 'nostr+walletconnect://test',
        websocketImplementation: WebSocket,
      });

      addLog(`Test client created: ${!!testClient}`);
      addLog(`Client has relay property: ${!!(testClient as any).relay}`);
    } catch (error: any) {
      addLog(`SDK import failed: ${error.message}`, true);
    }
  };

  const testNWCConnection = async () => {
    setIsLoading(true);
    setLogs([]); // Clear logs
    addLog('Starting NWC connection test...');

    try {
      // Step 1: Check if configured
      const hasNWC = await NWCWalletService.isAvailable();
      if (!hasNWC) {
        addLog('No NWC wallet configured', true);
        Alert.alert('Not Configured', 'Please connect an NWC wallet first');
        setIsLoading(false);
        return;
      }

      addLog('NWC wallet is configured');

      // Step 2: Initialize connection
      addLog('Initializing NWC connection...');
      await NWCWalletService.initialize();
      addLog('NWC initialized successfully');

      // Step 3: Get wallet info
      addLog('Getting wallet info...');
      const walletInfo = await NWCWalletService.getWalletInfo();

      if (walletInfo.connected) {
        addLog('Wallet connected!');
        addLog(`Capabilities: ${walletInfo.capabilities?.length || 0} methods`);
        setIsConnected(true);
      } else {
        addLog(`Wallet not connected: ${walletInfo.error}`, true);
        setIsConnected(false);
      }

      // Step 4: Get balance
      addLog('Getting wallet balance...');
      const balanceResult = await NWCWalletService.getBalance();

      if (balanceResult.balance > 0 || !balanceResult.error) {
        addLog(`Balance: ${balanceResult.balance} sats`);
        setBalance(balanceResult.balance);
      } else {
        addLog(`Balance error: ${balanceResult.error}`, true);
      }
    } catch (error: any) {
      addLog(`Connection test failed: ${error.message}`, true);
    } finally {
      setIsLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('Logs cleared');
  };

  return (
    <View style={[styles.container, { paddingTop: 60 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>NWC Debug Console</Text>
      </View>

      {/* Status Display */}
      <View style={[styles.card, { marginHorizontal: 20, marginTop: 10 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.label}>Connection Status:</Text>
          <Text
            style={[
              styles.text,
              { color: isConnected ? '#00ff00' : '#ff0000' },
            ]}
          >
            {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>

        {balance !== null && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 10,
            }}
          >
            <Text style={styles.label}>Balance:</Text>
            <Text style={styles.text}>{balance.toLocaleString()} sats</Text>
          </View>
        )}
      </View>

      {/* Test Buttons */}
      <View style={{ padding: 20 }}>
        <TouchableOpacity
          style={[styles.button, { marginBottom: 10 }]}
          onPress={testWebSocket}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Test WebSocket</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { marginBottom: 10 }]}
          onPress={testSDKImport}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Test SDK Import</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            { marginBottom: 10, backgroundColor: theme.colors.accent },
          ]}
          onPress={testNWCConnection}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Test NWC Connection</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#666' }]}
          onPress={clearLogs}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Clear Logs</Text>
        </TouchableOpacity>
      </View>

      {/* Logs Display */}
      <ScrollView
        style={[
          styles.card,
          { flex: 1, marginHorizontal: 20, marginBottom: 20, padding: 15 },
        ]}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <Text style={[styles.label, { marginBottom: 10 }]}>
          Console Output:
        </Text>
        {logs.map((log, i) => (
          <Text
            key={i}
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              color: log.includes('❌') ? '#ff6666' : '#00ff00',
              marginBottom: 4,
            }}
          >
            {log}
          </Text>
        ))}
        {logs.length === 0 && (
          <Text style={{ color: '#666', fontStyle: 'italic' }}>
            Press a button to start testing...
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
