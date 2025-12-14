/**
 * Nuclear1301Service - Proven 1301 Workout Event Discovery
 * Extracted from workoutMergeService.ts - uses GlobalNDKService for shared relay connections
 * 3-second timeout, nuclear approach with zero validation for maximum reliability
 */

import type { NostrWorkout } from '../../types/nostrWorkout';
import type { Split } from '../activity/SplitTrackingService';
import { GlobalNDKService } from '../nostr/GlobalNDKService';

export class Nuclear1301Service {
  private static instance: Nuclear1301Service;

  private constructor() {}

  static getInstance(): Nuclear1301Service {
    if (!Nuclear1301Service.instance) {
      Nuclear1301Service.instance = new Nuclear1301Service();
    }
    return Nuclear1301Service.instance;
  }

  /**
   * Get ALL 1301 events for user - NUCLEAR APPROACH (same as team discovery)
   * Uses proven 3-second timeout and NDK singleton pattern
   */
  async getUserWorkouts(pubkey: string): Promise<NostrWorkout[]> {
    try {
      if (!pubkey) {
        console.log(
          '⚠️ No pubkey provided - returning empty array (nuclear approach)'
        );
        return [];
      }

      console.log(
        '🚀🚀🚀 NUCLEAR WORKOUT APPROACH: Getting ALL 1301 events for user (no filtering)...'
      );
      console.log('🔍 Input pubkey analysis:', {
        pubkey: pubkey.slice(0, 12) + '...',
        length: pubkey.length,
        startsWithNpub: pubkey.startsWith('npub1'),
        isValidHex: /^[0-9a-fA-F]{64}$/.test(pubkey),
      });

      // NUCLEAR APPROACH: Use NDK (like successful team discovery)
      const { nip19 } = await import('nostr-tools');
      const NDK = await import('@nostr-dev-kit/ndk');

      let hexPubkey = pubkey;
      if (pubkey.startsWith('npub1')) {
        const decoded = nip19.decode(pubkey);
        hexPubkey = decoded.data as string;
        console.log(
          `🔧 Converted npub to hex: ${pubkey.slice(
            0,
            20
          )}... → ${hexPubkey.slice(0, 20)}...`
        );
      }

      console.log(
        `📊 NDK NUCLEAR QUERY: Getting ALL kind 1301 events for ${hexPubkey.slice(
          0,
          16
        )}...`
      );

      // Use GlobalNDKService for shared relay connections
      console.log('[NDK Workout] Getting GlobalNDK instance...');
      const ndk = await GlobalNDKService.getInstance();
      console.log(
        '[NDK Workout] Using GlobalNDK instance with shared relay connections'
      );

      const events: any[] = [];

      // NUCLEAR FILTER: Just kind 1301 + author - NO other restrictions (same as teams work)
      const nuclearFilter = {
        kinds: [1301],
        authors: [hexPubkey],
        limit: 500,
        // NO time filters (since/until) - nuclear approach
        // NO content filters - nuclear approach
        // NO tag validation - nuclear approach
      };

      console.log('🚀 NDK NUCLEAR FILTER:', nuclearFilter);

      // Use NDK subscription (like teams)
      const subscription = ndk.subscribe(nuclearFilter, {
        cacheUsage: NDK.NDKSubscriptionCacheUsage?.ONLY_RELAY,
      });

      subscription.on('event', (event: any) => {
        console.log(`📥 NDK NUCLEAR 1301 EVENT:`, {
          id: event.id?.slice(0, 8),
          kind: event.kind,
          created_at: new Date(event.created_at * 1000).toISOString(),
          pubkey: event.pubkey?.slice(0, 8),
          tags: event.tags?.length,
        });

        // ULTRA NUCLEAR: Accept ANY kind 1301 event - ZERO validation!
        if (event.kind === 1301) {
          events.push(event);
          console.log(
            `✅ NDK NUCLEAR ACCEPT: Event ${events.length} added - NO filtering!`
          );
        }
      });

      subscription.on('eose', () => {
        console.log(
          '📨 NDK EOSE received - continuing to wait for complete timeout...'
        );
      });

      // Wait for ALL events (nuclear approach - ultra-fast timeout proven by script)
      console.log(
        '⏰ NDK NUCLEAR TIMEOUT: Waiting 3 seconds for ALL 1301 events...'
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));

      subscription.stop();

      console.log(
        `🚀🚀🚀 NUCLEAR RESULT: Found ${events.length} raw 1301 events`
      );

      if (events.length === 0) {
        console.log('⚠️ NO 1301 EVENTS FOUND - This suggests:');
        console.log('   1. User has no 1301 events published to these relays');
        console.log('   2. Pubkey conversion issue');
        console.log('   3. Relay connectivity issue');
      }

      // ULTRA NUCLEAR PARSING: Create workouts from ALL 1301 events - ZERO validation!
      const workouts: NostrWorkout[] = [];

      for (const event of events) {
        try {
          // ULTRA NUCLEAR: Accept ANY tags, ANY content, ANY structure
          const tags = event.tags || [];
          let workoutType = 'unknown';
          let duration = 0;
          let distance = 0;
          let calories = 0;
          let sets = 0;
          let reps = 0;
          let weight = 0;
          let mealType: string | undefined;
          let mealSize: string | undefined;
          // Data source tracking (for filtering manual entries from competitions)
          let dataSource: 'gps' | 'manual' | 'healthkit' | 'RUNSTR' | undefined;
          // NEW: Elevation, pace, splits parsing
          let elevationGain = 0;
          let elevationLoss = 0;
          let pace = 0; // seconds per km
          const splits: Split[] = [];
          const splitPaces: Record<number, number> = {}; // Temporary storage for split paces

          // Parse tags with support for both runstr and other formats
          for (const tag of tags) {
            // Exercise/activity type - support multiple tag names
            if (tag[0] === 'exercise' && tag[1]) workoutType = tag[1];
            if (tag[0] === 'type' && tag[1]) workoutType = tag[1];
            if (tag[0] === 'activity' && tag[1]) workoutType = tag[1];

            // Duration - support both HH:MM:SS string and raw seconds
            if (tag[0] === 'duration' && tag[1]) {
              const timeStr = tag[1];
              // Check if it's HH:MM:SS format (runstr style)
              if (timeStr.includes(':')) {
                const parts = timeStr
                  .split(':')
                  .map((p: string) => parseInt(p) || 0);
                if (parts.length === 3) {
                  duration = parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS to seconds
                } else if (parts.length === 2) {
                  duration = parts[0] * 60 + parts[1]; // MM:SS to seconds
                }
              } else {
                // Raw seconds value
                duration = parseInt(timeStr) || 0;
              }
            }

            // Distance - support with or without unit (tag[2])
            if (tag[0] === 'distance' && tag[1]) {
              const distValue = parseFloat(tag[1]) || 0;
              const unit = tag[2] || 'km';
              // Convert to meters for internal storage
              if (unit === 'km') {
                distance = distValue * 1000;
              } else if (unit === 'mi' || unit === 'miles') {
                distance = distValue * 1609.344;
              } else if (unit === 'm') {
                distance = distValue;
              } else {
                // Assume km if no unit specified
                distance = distValue * 1000;
              }
            }

            // Calories
            if (tag[0] === 'calories' && tag[1])
              calories = parseInt(tag[1]) || 0;

            // Sets (for strength training)
            if (tag[0] === 'sets' && tag[1]) sets = parseInt(tag[1]) || 0;

            // Reps (for strength training)
            if (tag[0] === 'reps' && tag[1]) reps = parseInt(tag[1]) || 0;

            // Weight (for strength training, optional unit tag[2])
            if (tag[0] === 'weight' && tag[1]) {
              weight = parseFloat(tag[1]) || 0;
              // Note: Unit is in tag[2] but we'll default to lbs
            }

            // Meal type (for diet workouts)
            if (tag[0] === 'meal_type' && tag[1]) {
              mealType = tag[1];
            }

            // Meal size (for diet workouts)
            if (tag[0] === 'meal_size' && tag[1]) {
              mealSize = tag[1];
            }

            // NEW: Elevation gain parsing (supports meters and feet)
            if (tag[0] === 'elevation_gain' && tag[1]) {
              const value = parseFloat(tag[1]) || 0;
              const unit = tag[2] || 'm';
              // Convert feet to meters if needed
              elevationGain = unit === 'ft' ? value * 0.3048 : value;
            }

            // NEW: Elevation loss parsing
            if (tag[0] === 'elevation_loss' && tag[1]) {
              const value = parseFloat(tag[1]) || 0;
              const unit = tag[2] || 'm';
              elevationLoss = unit === 'ft' ? value * 0.3048 : value;
            }

            // NEW: Average pace parsing (formats: "05:24" MM:SS or raw seconds)
            if (tag[0] === 'avg_pace' && tag[1]) {
              const paceStr = tag[1];
              if (paceStr.includes(':')) {
                const parts = paceStr.split(':').map((p: string) => parseInt(p) || 0);
                if (parts.length === 2) {
                  pace = parts[0] * 60 + parts[1]; // MM:SS to seconds
                }
              } else {
                pace = parseInt(paceStr) || 0;
              }
            }

            // NEW: Split elapsed time parsing (format: ['split', '1', '00:05:12'])
            if (tag[0] === 'split' && tag[1] && tag[2]) {
              const splitNum = parseInt(tag[1]);
              const elapsedStr = tag[2];
              let elapsedTime = 0;
              if (elapsedStr.includes(':')) {
                const parts = elapsedStr.split(':').map((p: string) => parseInt(p) || 0);
                if (parts.length === 3) {
                  elapsedTime = parts[0] * 3600 + parts[1] * 60 + parts[2];
                } else if (parts.length === 2) {
                  elapsedTime = parts[0] * 60 + parts[1];
                }
              } else {
                elapsedTime = parseInt(elapsedStr) || 0;
              }
              // Store basic split data (pace will be merged later)
              const prevSplit = splits.find(s => s.number === splitNum - 1);
              const prevElapsed = prevSplit ? prevSplit.elapsedTime : 0;
              splits.push({
                number: splitNum,
                distanceKm: splitNum,
                elapsedTime,
                splitTime: elapsedTime - prevElapsed,
                pace: 0, // Will be set from split_pace or calculated
                timestamp: 0,
              });
            }

            // NEW: Split pace parsing (format: ['split_pace', '1', '312'])
            if (tag[0] === 'split_pace' && tag[1] && tag[2]) {
              const splitNum = parseInt(tag[1]);
              const splitPace = parseInt(tag[2]) || 0;
              splitPaces[splitNum] = splitPace;
            }

            // Source identification (to identify RUNSTR posts and manual entries)
            if (tag[0] === 'source' && tag[1]) {
              // Capture source value for filtering manual entries from competitions
              const sourceValue = tag[1].toLowerCase();
              if (sourceValue === 'manual') {
                dataSource = 'manual';
              } else if (sourceValue === 'gps') {
                dataSource = 'gps';
              } else if (sourceValue === 'healthkit') {
                dataSource = 'healthkit';
              } else if (sourceValue === 'runstr') {
                dataSource = 'RUNSTR';
                console.log('📱 Detected RUNSTR workout');
              }
            }
          }

          // Merge split paces into splits
          for (const split of splits) {
            if (splitPaces[split.number]) {
              split.pace = splitPaces[split.number];
            } else if (split.splitTime > 0) {
              // Calculate pace from splitTime if not provided
              split.pace = split.splitTime; // For 1km splits, splitTime = pace
            }
          }
          // Sort splits by number
          splits.sort((a, b) => a.number - b.number);

          // ULTRA NUCLEAR: Create workout even if ALL fields are missing/zero
          const workout: NostrWorkout = {
            id: event.id,
            userId: 'nostr_user', // Generic for tab display
            type: workoutType as any,
            startTime: new Date(event.created_at * 1000).toISOString(),
            endTime: new Date(
              (event.created_at + Math.max(duration, 60)) * 1000
            ).toISOString(), // duration is already in seconds
            duration: duration, // Duration in seconds
            distance: distance, // Distance in meters
            calories: calories,
            pace: pace > 0 ? pace : undefined, // NEW: Average pace (seconds per km)
            sets: sets > 0 ? sets : undefined, // Strength training
            reps: reps > 0 ? reps : undefined, // Strength training
            weight: weight > 0 ? weight : undefined, // Strength training
            mealType: mealType as any, // Diet tracking
            mealSize: mealSize as any, // Diet tracking
            // NEW: Elevation data
            elevationGain: elevationGain > 0 ? elevationGain : undefined,
            elevationLoss: elevationLoss > 0 ? elevationLoss : undefined,
            // NEW: Splits data
            splits: splits.length > 0 ? splits : undefined,
            // Data source for competition filtering (manual entries excluded from leaderboards)
            dataSource: dataSource,
            source: 'nostr',
            nostrEventId: event.id,
            nostrPubkey: event.pubkey,
            syncedAt: new Date().toISOString(),
          };

          workouts.push(workout);
          console.log(
            `✅ ULTRA NUCLEAR WORKOUT ${workouts.length}: ${
              workout.type
            } - ${new Date(workout.startTime).toDateString()} (dur:${
              workout.duration
            }, dist:${workout.distance})`
          );
        } catch (error) {
          console.warn(`⚠️ Error in ultra nuclear parsing ${event.id}:`, error);
          // ULTRA NUCLEAR: Even if parsing fails, create a basic workout
          const fallbackWorkout: NostrWorkout = {
            id: event.id,
            userId: 'nostr_user',
            type: 'raw_1301' as any,
            startTime: new Date(event.created_at * 1000).toISOString(),
            endTime: new Date((event.created_at + 60) * 1000).toISOString(),
            duration: 0,
            distance: 0,
            calories: 0,
            source: 'nostr',
            nostrEventId: event.id,
            nostrPubkey: event.pubkey,
            syncedAt: new Date().toISOString(),
          };
          workouts.push(fallbackWorkout);
          console.log(
            `🆘 FALLBACK WORKOUT ${workouts.length}: raw_1301 - ${new Date(
              fallbackWorkout.startTime
            ).toDateString()}`
          );
        }
      }

      console.log(
        `🎉 NUCLEAR SUCCESS: Created ${workouts.length} workout objects from ${events.length} raw events`
      );

      if (workouts.length > 0) {
        // Show date range
        const dates = workouts
          .map((w) => new Date(w.startTime).getTime())
          .sort();
        const oldest = new Date(dates[0]);
        const newest = new Date(dates[dates.length - 1]);
        console.log(
          `📅 Date range: ${oldest.toDateString()} → ${newest.toDateString()}`
        );
      }

      return workouts.sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
    } catch (error) {
      console.error('❌ Nuclear 1301 discovery failed:', error);
      return [];
    }
  }

  /**
   * Get LIMITED 1301 events for user - Optimized for prefetch
   * Fetches only specified number of most recent workouts
   */
  async getUserWorkoutsWithLimit(
    pubkey: string,
    limit: number = 20
  ): Promise<NostrWorkout[]> {
    try {
      if (!pubkey) {
        console.log('⚠️ No pubkey provided - returning empty array');
        return [];
      }

      console.log(
        `🚀 Fetching last ${limit} workouts for user (optimized for speed)...`
      );

      // Use NDK
      const { nip19 } = await import('nostr-tools');
      const NDK = await import('@nostr-dev-kit/ndk');

      let hexPubkey = pubkey;
      if (pubkey.startsWith('npub1')) {
        const decoded = nip19.decode(pubkey);
        hexPubkey = decoded.data as string;
      }

      // Use GlobalNDKService for shared relay connections
      const ndk = await GlobalNDKService.getInstance();

      const events: any[] = [];

      // OPTIMIZED FILTER: Limited to specified number of workouts
      const optimizedFilter = {
        kinds: [1301],
        authors: [hexPubkey],
        limit: limit, // Only fetch the specified number of workouts
      };

      console.log('⚡ OPTIMIZED FILTER:', optimizedFilter);

      // Use NDK subscription
      const subscription = ndk.subscribe(optimizedFilter, {
        cacheUsage: NDK.NDKSubscriptionCacheUsage?.ONLY_RELAY,
      });

      subscription.on('event', (event: any) => {
        if (event.kind === 1301) {
          events.push(event);
        }
      });

      // Shorter timeout for limited queries (2 seconds)
      await new Promise((resolve) => setTimeout(resolve, 2000));
      subscription.stop();

      console.log(`✅ Fetched ${events.length} events (limit was ${limit})`);

      // Convert to NostrWorkout format
      const workouts: NostrWorkout[] = [];
      for (const event of events) {
        try {
          // Parse workout data from event
          const tags = event.tags || [];
          const exerciseTag = tags.find((tag: any[]) => tag[0] === 'exercise');
          const distanceTag = tags.find((tag: any[]) => tag[0] === 'distance');
          const durationTag = tags.find((tag: any[]) => tag[0] === 'duration');
          const caloriesTag = tags.find((tag: any[]) => tag[0] === 'calories');
          const titleTag = tags.find((tag: any[]) => tag[0] === 'title');
          const setsTag = tags.find((tag: any[]) => tag[0] === 'sets');
          const repsTag = tags.find((tag: any[]) => tag[0] === 'reps');
          const weightTag = tags.find((tag: any[]) => tag[0] === 'weight');
          const mealTypeTag = tags.find((tag: any[]) => tag[0] === 'meal_type');
          const mealSizeTag = tags.find((tag: any[]) => tag[0] === 'meal_size');

          const workout: NostrWorkout = {
            id: event.id,
            userId: 'nostr_user',
            type: exerciseTag?.[1] || 'other',
            startTime: new Date(event.created_at * 1000).toISOString(),
            endTime: new Date((event.created_at + 60) * 1000).toISOString(),
            duration: durationTag ? parseInt(durationTag[1]) : 0,
            distance: distanceTag ? parseFloat(distanceTag[1]) : 0,
            calories: caloriesTag ? parseInt(caloriesTag[1]) : 0,
            sets: setsTag ? parseInt(setsTag[1]) : undefined, // Strength training
            reps: repsTag ? parseInt(repsTag[1]) : undefined, // Strength training
            weight: weightTag ? parseFloat(weightTag[1]) : undefined, // Strength training
            mealType: mealTypeTag?.[1] as any, // Diet tracking
            mealSize: mealSizeTag?.[1] as any, // Diet tracking
            source: 'nostr',
            nostrEventId: event.id,
            nostrPubkey: event.pubkey,
            syncedAt: new Date().toISOString(),
          };
          workouts.push(workout);
        } catch (error) {
          console.error('❌ Failed to parse workout:', error);
        }
      }

      // Sort by date (newest first) and return only the limit
      return workouts
        .sort(
          (a, b) =>
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        )
        .slice(0, limit);
    } catch (error) {
      console.error('❌ Limited workout fetch failed:', error);
      return [];
    }
  }
}

export default Nuclear1301Service.getInstance();
