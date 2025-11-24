/**
 * Wallet Deep Links Utility
 * Provides wallet-specific deep link URLs for Lightning invoice payments
 * Supports Cash App, Strike, and generic Lightning wallets
 */

import { Linking, Platform } from 'react-native';
import { CustomAlertManager } from '../components/ui/CustomAlert';

export interface WalletDeepLinkResult {
  success: boolean;
  error?: string;
}

/**
 * Open Lightning invoice in Cash App
 * Uses Cash App's universal link format for Lightning invoices
 *
 * @param invoice - BOLT11 Lightning invoice
 * @returns Promise with success status
 */
export async function openInCashApp(
  invoice: string
): Promise<WalletDeepLinkResult> {
  try {
    // Cash App uses universal links for Lightning invoices
    // Format: https://cash.app/launch/lightning/{invoice}
    const cleanInvoice = invoice.toLowerCase().replace(/^lightning:/, '');
    const uri = `https://cash.app/launch/lightning/${cleanInvoice}`;

    console.log('[WalletDeepLinks] Opening Cash App with invoice');

    const canOpen = await Linking.canOpenURL(uri);

    if (canOpen) {
      await Linking.openURL(uri);
      return { success: true };
    } else {
      // Cash App not installed
      CustomAlertManager.alert(
        'Cash App Not Installed',
        'Install Cash App from the App Store to pay with Cash App.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Install',
            onPress: () => {
              const appStoreUrl = Platform.select({
                ios: 'https://apps.apple.com/us/app/cash-app/id711923939',
                android:
                  'https://play.google.com/store/apps/details?id=com.squareup.cash',
              });
              if (appStoreUrl) {
                Linking.openURL(appStoreUrl);
              }
            },
          },
        ]
      );
      return { success: false, error: 'Cash App not installed' };
    }
  } catch (error) {
    console.error('[WalletDeepLinks] Cash App error:', error);
    CustomAlertManager.alert(
      'Error',
      'Failed to open Cash App. Please copy the invoice and paste it manually in Cash App.'
    );
    return { success: false, error: String(error) };
  }
}

/**
 * Open Lightning invoice in Strike
 * Uses Strike's custom URL scheme for Lightning payments
 *
 * @param invoice - BOLT11 Lightning invoice
 * @returns Promise with success status
 */
export async function openInStrike(
  invoice: string
): Promise<WalletDeepLinkResult> {
  try {
    // Strike uses custom URL scheme: strike://qr?lightning={invoice}
    const cleanInvoice = invoice.toLowerCase().replace(/^lightning:/, '');
    const uri = `strike://qr?lightning=${cleanInvoice}`;

    console.log('[WalletDeepLinks] Opening Strike with invoice');

    const canOpen = await Linking.canOpenURL(uri);

    if (canOpen) {
      await Linking.openURL(uri);
      return { success: true };
    } else {
      // Strike not installed
      CustomAlertManager.alert(
        'Strike Not Installed',
        'Install Strike from the App Store to pay with Strike.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Install',
            onPress: () => {
              const appStoreUrl = Platform.select({
                ios: 'https://apps.apple.com/us/app/strike-bitcoin-payments/id1488724463',
                android:
                  'https://play.google.com/store/apps/details?id=zapsolutions.strike',
              });
              if (appStoreUrl) {
                Linking.openURL(appStoreUrl);
              }
            },
          },
        ]
      );
      return { success: false, error: 'Strike not installed' };
    }
  } catch (error) {
    console.error('[WalletDeepLinks] Strike error:', error);
    CustomAlertManager.alert(
      'Error',
      'Failed to open Strike. Please copy the invoice and paste it manually in Strike.'
    );
    return { success: false, error: String(error) };
  }
}

/**
 * Open Lightning invoice in Zeus wallet
 * Uses Zeus custom URL scheme for direct wallet opening
 *
 * @param invoice - BOLT11 Lightning invoice
 * @returns Promise with success status
 */
export async function openInZeus(
  invoice: string
): Promise<WalletDeepLinkResult> {
  try {
    // Zeus uses custom URL scheme: zeus:lightning={invoice}
    const cleanInvoice = invoice.toLowerCase().replace(/^lightning:/, '');
    const uri = `zeus:lightning=${cleanInvoice}`;

    console.log('[WalletDeepLinks] Opening Zeus with invoice');

    const canOpen = await Linking.canOpenURL(uri);

    if (canOpen) {
      await Linking.openURL(uri);
      return { success: true };
    } else {
      // Zeus not installed
      CustomAlertManager.alert(
        'Zeus Not Installed',
        'Install Zeus from the App Store to pay with Zeus.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Install',
            onPress: () => {
              const appStoreUrl = Platform.select({
                ios: 'https://apps.apple.com/app/zeus-ln/id1456038895',
                android:
                  'https://play.google.com/store/apps/details?id=app.zeusln.zeus',
              });
              if (appStoreUrl) {
                Linking.openURL(appStoreUrl);
              }
            },
          },
        ]
      );
      return { success: false, error: 'Zeus not installed' };
    }
  } catch (error) {
    console.error('[WalletDeepLinks] Zeus error:', error);
    CustomAlertManager.alert(
      'Error',
      'Failed to open Zeus. Please copy the invoice and paste it manually in Zeus.'
    );
    return { success: false, error: String(error) };
  }
}

/**
 * Open Lightning invoice in Phoenix wallet
 * Uses Phoenix custom URL scheme for direct wallet opening
 *
 * @param invoice - BOLT11 Lightning invoice
 * @returns Promise with success status
 */
export async function openInPhoenix(
  invoice: string
): Promise<WalletDeepLinkResult> {
  try {
    // Phoenix uses custom URL scheme: phoenix://pay?invoice={invoice}
    const cleanInvoice = invoice.toLowerCase().replace(/^lightning:/, '');
    const uri = `phoenix://pay?invoice=${cleanInvoice}`;

    console.log('[WalletDeepLinks] Opening Phoenix with invoice');

    const canOpen = await Linking.canOpenURL(uri);

    if (canOpen) {
      await Linking.openURL(uri);
      return { success: true };
    } else {
      // Phoenix not installed
      CustomAlertManager.alert(
        'Phoenix Not Installed',
        'Install Phoenix from the App Store to pay with Phoenix.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Install',
            onPress: () => {
              const appStoreUrl = Platform.select({
                ios: 'https://apps.apple.com/app/phoenix-wallet/id1544097028',
                android:
                  'https://play.google.com/store/apps/details?id=fr.acinq.phoenix.mainnet',
              });
              if (appStoreUrl) {
                Linking.openURL(appStoreUrl);
              }
            },
          },
        ]
      );
      return { success: false, error: 'Phoenix not installed' };
    }
  } catch (error) {
    console.error('[WalletDeepLinks] Phoenix error:', error);
    CustomAlertManager.alert(
      'Error',
      'Failed to open Phoenix. Please copy the invoice and paste it manually in Phoenix.'
    );
    return { success: false, error: String(error) };
  }
}

/**
 * Open Lightning invoice in Wallet of Satoshi
 * Uses Wallet of Satoshi custom URL scheme for direct wallet opening
 *
 * @param invoice - BOLT11 Lightning invoice
 * @returns Promise with success status
 */
export async function openInWalletOfSatoshi(
  invoice: string
): Promise<WalletDeepLinkResult> {
  try {
    // Wallet of Satoshi uses custom URL scheme: walletofsatoshi:lightning={invoice}
    const cleanInvoice = invoice.toLowerCase().replace(/^lightning:/, '');
    const uri = `walletofsatoshi:lightning=${cleanInvoice}`;

    console.log('[WalletDeepLinks] Opening Wallet of Satoshi with invoice');

    const canOpen = await Linking.canOpenURL(uri);

    if (canOpen) {
      await Linking.openURL(uri);
      return { success: true };
    } else {
      // Wallet of Satoshi not installed
      CustomAlertManager.alert(
        'Wallet of Satoshi Not Installed',
        'Install Wallet of Satoshi from the App Store to pay with WOS.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Install',
            onPress: () => {
              const appStoreUrl = Platform.select({
                ios: 'https://apps.apple.com/app/wallet-of-satoshi/id1438599608',
                android:
                  'https://play.google.com/store/apps/details?id=com.livingroomofsatoshi.wallet',
              });
              if (appStoreUrl) {
                Linking.openURL(appStoreUrl);
              }
            },
          },
        ]
      );
      return { success: false, error: 'Wallet of Satoshi not installed' };
    }
  } catch (error) {
    console.error('[WalletDeepLinks] Wallet of Satoshi error:', error);
    CustomAlertManager.alert(
      'Error',
      'Failed to open Wallet of Satoshi. Please copy the invoice and paste it manually.'
    );
    return { success: false, error: String(error) };
  }
}

/**
 * Open Lightning invoice in Breez wallet
 * Uses Breez custom URL scheme for direct wallet opening
 *
 * @param invoice - BOLT11 Lightning invoice
 * @returns Promise with success status
 */
export async function openInBreez(
  invoice: string
): Promise<WalletDeepLinkResult> {
  try {
    // Breez uses custom URL scheme: breez:lightning:{invoice}
    const cleanInvoice = invoice.toLowerCase().replace(/^lightning:/, '');
    const uri = `breez:lightning:${cleanInvoice}`;

    console.log('[WalletDeepLinks] Opening Breez with invoice');

    const canOpen = await Linking.canOpenURL(uri);

    if (canOpen) {
      await Linking.openURL(uri);
      return { success: true };
    } else {
      // Breez not installed
      CustomAlertManager.alert(
        'Breez Not Installed',
        'Install Breez from the App Store to pay with Breez.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Install',
            onPress: () => {
              const appStoreUrl = Platform.select({
                ios: 'https://apps.apple.com/app/breez/id1463506703',
                android:
                  'https://play.google.com/store/apps/details?id=com.breez.client',
              });
              if (appStoreUrl) {
                Linking.openURL(appStoreUrl);
              }
            },
          },
        ]
      );
      return { success: false, error: 'Breez not installed' };
    }
  } catch (error) {
    console.error('[WalletDeepLinks] Breez error:', error);
    CustomAlertManager.alert(
      'Error',
      'Failed to open Breez. Please copy the invoice and paste it manually in Breez.'
    );
    return { success: false, error: String(error) };
  }
}

/**
 * Open Lightning invoice in generic Lightning wallet
 * Uses standard lightning: URI scheme (works with Alby, BlueWallet, Zeus, Phoenix, Breez, etc.)
 *
 * @param invoice - BOLT11 Lightning invoice
 * @returns Promise with success status
 */
export async function openInGenericWallet(
  invoice: string
): Promise<WalletDeepLinkResult> {
  try {
    // Standard Lightning URI: lightning:{invoice}
    const cleanInvoice = invoice.toLowerCase().replace(/^lightning:/, '');
    const uri = `lightning:${cleanInvoice}`;

    console.log('[WalletDeepLinks] Opening generic Lightning wallet');

    const canOpen = await Linking.canOpenURL(uri);

    if (canOpen) {
      await Linking.openURL(uri);
      return { success: true };
    } else {
      // No Lightning wallet installed
      CustomAlertManager.alert(
        'No Lightning Wallet Found',
        'Install a Lightning wallet like Alby, BlueWallet, Zeus, Phoenix, or Breez to pay.\n\nOr copy the invoice and paste it in your wallet manually.',
        [{ text: 'OK' }]
      );
      return { success: false, error: 'No Lightning wallet installed' };
    }
  } catch (error) {
    console.error('[WalletDeepLinks] Generic wallet error:', error);
    CustomAlertManager.alert(
      'Error',
      'Failed to open Lightning wallet. Please copy the invoice and paste it manually in your wallet.'
    );
    return { success: false, error: String(error) };
  }
}

/**
 * Auto-detect and open best available Lightning wallet
 * Tries wallets in order: Cash App → Strike → Generic Lightning wallets
 *
 * @param invoice - BOLT11 Lightning invoice
 * @returns Promise with success status
 */
export async function openInBestAvailableWallet(
  invoice: string
): Promise<WalletDeepLinkResult> {
  console.log('[WalletDeepLinks] Auto-detecting best wallet...');

  try {
    const cleanInvoice = invoice.toLowerCase().replace(/^lightning:/, '');

    // Try Cash App first (most popular)
    const cashAppUri = `https://cash.app/launch/lightning/${cleanInvoice}`;
    if (await Linking.canOpenURL(cashAppUri)) {
      console.log('[WalletDeepLinks] Cash App detected, opening...');
      await Linking.openURL(cashAppUri);
      return { success: true };
    }

    // Try Strike second
    const strikeUri = `strike://qr?lightning=${cleanInvoice}`;
    if (await Linking.canOpenURL(strikeUri)) {
      console.log('[WalletDeepLinks] Strike detected, opening...');
      await Linking.openURL(strikeUri);
      return { success: true };
    }

    // Fall back to generic Lightning URI (Alby, BlueWallet, Zeus, etc.)
    const lightningUri = `lightning:${cleanInvoice}`;
    if (await Linking.canOpenURL(lightningUri)) {
      console.log(
        '[WalletDeepLinks] Generic Lightning wallet detected, opening...'
      );
      await Linking.openURL(lightningUri);
      return { success: true };
    }

    // No wallet found
    CustomAlertManager.alert(
      'No Lightning Wallet Found',
      'Install Cash App, Strike, or a Lightning wallet (Alby, BlueWallet, Zeus) to pay.\n\nOr copy the invoice below and paste it in your wallet manually.',
      [{ text: 'OK' }]
    );

    return { success: false, error: 'No Lightning wallet installed' };
  } catch (error) {
    console.error('[WalletDeepLinks] Auto-detect error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * List of supported wallet names for UI display
 */
export const SUPPORTED_WALLETS = [
  'Cash App',
  'Strike',
  'Alby',
  'Phoenix',
  'Breez',
  'BlueWallet',
  'Zeus',
] as const;

export type SupportedWallet = (typeof SUPPORTED_WALLETS)[number];
