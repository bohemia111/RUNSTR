/**
 * Profile Helper for Notification Handlers
 * Uses UnifiedNostrCache as the single source of truth for profile data
 */

import UnifiedNostrCache from '../cache/UnifiedNostrCache';
import {
  nostrProfileService,
  type NostrProfile,
} from '../nostr/NostrProfileService';

/**
 * Get profile with UnifiedNostrCache
 * This ensures all notification handlers use the same cached profiles
 */
export async function getCachedProfile(
  pubkey: string
): Promise<NostrProfile | null> {
  const cacheKey = `profile:${pubkey}`;

  try {
    // Use UnifiedNostrCache as the single source of truth
    const profile = await UnifiedNostrCache.get(
      cacheKey,
      async () => {
        // Fetch using the existing NostrProfileService
        return await nostrProfileService.getProfile(pubkey);
      },
      {
        ttl: 30 * 60 * 1000, // 30 minutes (matching NostrProfileService TTL)
        persist: true, // Save to AsyncStorage for offline support
      }
    );

    return profile;
  } catch (error) {
    console.error(
      `[ProfileHelper] Failed to get profile for ${pubkey}:`,
      error
    );

    // Return a basic fallback profile
    return {
      name: pubkey.slice(0, 8),
      display_name: `User ${pubkey.slice(0, 8)}`,
      pubkey: pubkey,
      npub: `npub1${pubkey.slice(0, 8)}...`,
      lastUpdated: new Date(),
      source: 'fallback',
    };
  }
}

/**
 * Get multiple profiles efficiently with UnifiedNostrCache
 */
export async function getCachedProfiles(
  pubkeys: string[]
): Promise<Map<string, NostrProfile>> {
  const results = new Map<string, NostrProfile>();

  // Fetch all profiles in parallel
  const fetchPromises = pubkeys.map(async (pubkey) => {
    const profile = await getCachedProfile(pubkey);
    if (profile) {
      results.set(pubkey, profile);
    }
  });

  await Promise.allSettled(fetchPromises);

  return results;
}

/**
 * Invalidate cached profile (force refresh on next fetch)
 */
export async function invalidateCachedProfile(pubkey: string): Promise<void> {
  const cacheKey = `profile:${pubkey}`;
  await UnifiedNostrCache.invalidate(cacheKey);
}
