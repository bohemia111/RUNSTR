/**
 * BroadcastTokenService - Anonymous push notification token registration
 *
 * PRIVACY-FIRST DESIGN:
 * - Device tokens are stored WITHOUT npub association
 * - Cannot identify which user receives which notification
 * - Everyone receives the SAME community notifications
 * - Used for Daily Running Leaderboard updates
 *
 * WHAT IT DOES:
 * - Registers Expo push token to Supabase (broadcast_tokens table)
 * - Token stored with platform only - no user identity
 * - Enables server-side push notifications for community events
 *
 * NOTIFICATIONS SENT:
 * - "Daily Running: First 5K time today - 24:32!"
 * - "New Record! Fastest 10K today: 48:15!"
 * - "Daily Running: Someone ran a Half Marathon!"
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from '../../utils/supabase';

const TOKEN_REGISTERED_KEY = '@runstr:broadcast_token_registered';
const TOKEN_VALUE_KEY = '@runstr:broadcast_token_value';

export class BroadcastTokenService {
  /**
   * Register device token for broadcast notifications (anonymous - no npub)
   *
   * This enables server-side push notifications for community events like:
   * - Daily Running Leaderboard updates
   * - New records on time-based leaderboards
   *
   * Privacy: Token is stored WITHOUT any user identity association
   */
  static async registerToken(expoPushToken: string): Promise<void> {
    try {
      // Skip if Supabase not configured
      if (!isSupabaseConfigured() || !supabase) {
        console.log('[BroadcastToken] Supabase not configured, skipping registration');
        return;
      }

      // Check if already registered with same token
      const registeredToken = await AsyncStorage.getItem(TOKEN_VALUE_KEY);
      if (registeredToken === expoPushToken) {
        console.log('[BroadcastToken] Already registered with same token');
        return;
      }

      // Upsert token (no npub - anonymous)
      const { error } = await supabase
        .from('broadcast_tokens')
        .upsert(
          {
            token: expoPushToken,
            platform: Platform.OS,
            is_active: true,
          },
          { onConflict: 'token' }
        );

      if (error) {
        // If table doesn't exist yet, log and continue silently
        if (error.code === '42P01') {
          console.log('[BroadcastToken] Table not created yet, skipping');
          return;
        }
        throw error;
      }

      // Save token locally to prevent duplicate registrations
      await AsyncStorage.setItem(TOKEN_REGISTERED_KEY, 'true');
      await AsyncStorage.setItem(TOKEN_VALUE_KEY, expoPushToken);

      console.log('[BroadcastToken] ✅ Registered for community notifications');
    } catch (error) {
      // Silent failure - notifications are optional
      console.warn('[BroadcastToken] Registration failed (silent):', error);
    }
  }

  /**
   * Deactivate token (on logout or opt-out)
   * Keeps token in database but marks as inactive
   */
  static async deactivateToken(): Promise<void> {
    try {
      if (!isSupabaseConfigured() || !supabase) {
        return;
      }

      const token = await AsyncStorage.getItem(TOKEN_VALUE_KEY);
      if (!token) return;

      await supabase
        .from('broadcast_tokens')
        .update({ is_active: false })
        .eq('token', token);

      await AsyncStorage.removeItem(TOKEN_REGISTERED_KEY);
      await AsyncStorage.removeItem(TOKEN_VALUE_KEY);

      console.log('[BroadcastToken] Token deactivated');
    } catch (error) {
      console.warn('[BroadcastToken] Deactivation failed:', error);
    }
  }

  /**
   * Check if token is registered
   */
  static async isRegistered(): Promise<boolean> {
    try {
      const registered = await AsyncStorage.getItem(TOKEN_REGISTERED_KEY);
      return registered === 'true';
    } catch {
      return false;
    }
  }
}
