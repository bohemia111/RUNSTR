/**
 * AutoCompetePreferencesService - Auto-compete user preferences
 * Handles saving/loading auto-compete setting with AsyncStorage persistence
 *
 * When enabled, workouts are automatically published to Nostr (kind 1301)
 * when the workout summary modal opens.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@runstr:auto_compete_enabled';

export class AutoCompetePreferencesService {
  private static cachedValue: boolean | null = null;

  /**
   * Check if auto-compete is enabled
   */
  static async isAutoCompeteEnabled(): Promise<boolean> {
    // Return cached value if available
    if (this.cachedValue !== null) {
      return this.cachedValue;
    }

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);

      if (stored === null) {
        // Default to false (user must opt-in)
        this.cachedValue = false;
        return false;
      }

      this.cachedValue = stored === 'true';
      return this.cachedValue;
    } catch (error) {
      console.error('[AutoCompete] Error loading preference:', error);
      return false;
    }
  }

  /**
   * Set auto-compete enabled/disabled
   */
  static async setAutoCompeteEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(enabled));
      this.cachedValue = enabled;
      console.log(`[AutoCompete] Setting updated: ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('[AutoCompete] Error saving preference:', error);
      throw error;
    }
  }

  /**
   * Clear cached value (useful for testing or user logout)
   */
  static clearCache(): void {
    this.cachedValue = null;
  }
}
