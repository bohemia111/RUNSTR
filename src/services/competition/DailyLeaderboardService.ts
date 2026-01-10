/**
 * Daily Leaderboard Service - Supabase Implementation
 *
 * Queries daily leaderboards from Supabase instead of Nostr for:
 * - Better anti-cheat (server-validated workouts)
 * - Faster performance (~500ms vs 3-5s with Nostr)
 * - Universal visibility (all users who submitted)
 *
 * Compatible with existing LeaderboardEntry interface.
 */

import { UnifiedCacheService } from '../cache/UnifiedCacheService';

export interface LeaderboardEntry {
  rank: number;
  npub: string;
  name: string;
  score: number;
  formattedScore: string;
  workoutCount: number;
  lightningAddress?: string;
}

export interface DailyLeaderboards {
  date: string;
  leaderboard5k: LeaderboardEntry[];
  leaderboard10k: LeaderboardEntry[];
  leaderboardHalf: LeaderboardEntry[];
  leaderboardMarathon: LeaderboardEntry[];
  leaderboardSteps: LeaderboardEntry[];
}

interface SupabaseWorkoutRow {
  npub: string;
  time_5k_seconds: number | null;
  time_10k_seconds: number | null;
  time_half_seconds: number | null;
  time_marathon_seconds: number | null;
  step_count: number | null;
  profile_name: string | null;
  profile_picture: string | null;
  activity_type: string;
}

class DailyLeaderboardServiceClass {
  private static instance: DailyLeaderboardServiceClass;
  private cacheService: typeof UnifiedCacheService;

  private constructor() {
    this.cacheService = UnifiedCacheService;
  }

  static getInstance(): DailyLeaderboardServiceClass {
    if (!this.instance) {
      this.instance = new DailyLeaderboardServiceClass();
    }
    return this.instance;
  }

  /**
   * Get global daily leaderboards from Supabase
   * Returns 5K, 10K, Half Marathon, Marathon, and Steps leaderboards
   */
  async getGlobalDailyLeaderboards(
    forceRefresh: boolean = false
  ): Promise<DailyLeaderboards> {
    const todayDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const queryStartTime = Date.now();

    console.log(`📊 [DailyLeaderboard/Supabase] ========== QUERY START ==========`);
    console.log(`📊 [DailyLeaderboard/Supabase] Date: ${todayDate}`);
    console.log(`📊 [DailyLeaderboard/Supabase] Force Refresh: ${forceRefresh}`);

    // Check cache first (5-minute TTL) - unless forceRefresh is true
    const cacheKey = `supabase:daily:${todayDate}`;

    if (forceRefresh) {
      console.log(`📊 [DailyLeaderboard/Supabase] 🔄 FORCE REFRESH: Bypassing cache`);
      await this.cacheService.invalidate(cacheKey);
    } else {
      const cached = await this.cacheService.get<DailyLeaderboards>(cacheKey);
      if (cached) {
        console.log(`📊 [DailyLeaderboard/Supabase] ✅ CACHE HIT - Returning cached data`);
        return cached;
      }
      console.log(`📊 [DailyLeaderboard/Supabase] ❌ CACHE MISS - Querying Supabase`);
    }

    // Query Supabase for today's workouts
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[DailyLeaderboard/Supabase] Supabase not configured');
      return this.emptyLeaderboards(todayDate);
    }

    try {
      // Fetch today's workouts with leaderboard fields
      const url = `${supabaseUrl}/rest/v1/workout_submissions?` +
        `leaderboard_date=eq.${todayDate}&` +
        `select=npub,time_5k_seconds,time_10k_seconds,time_half_seconds,time_marathon_seconds,step_count,profile_name,profile_picture,activity_type`;

      const response = await fetch(url, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });

      if (!response.ok) {
        console.error(`[DailyLeaderboard/Supabase] Query failed: ${response.status}`);
        return this.emptyLeaderboards(todayDate);
      }

      const rows: SupabaseWorkoutRow[] = await response.json();
      console.log(`📊 [DailyLeaderboard/Supabase] Fetched ${rows.length} workouts`);

      // Build leaderboards
      const result: DailyLeaderboards = {
        date: todayDate,
        leaderboard5k: this.buildTimeLeaderboard(rows, 'time_5k_seconds', 'running'),
        leaderboard10k: this.buildTimeLeaderboard(rows, 'time_10k_seconds', 'running'),
        leaderboardHalf: this.buildTimeLeaderboard(rows, 'time_half_seconds', 'running'),
        leaderboardMarathon: this.buildTimeLeaderboard(rows, 'time_marathon_seconds', 'running'),
        leaderboardSteps: this.buildStepsLeaderboard(rows),
      };

      // Log counts
      console.log(
        `📊 [DailyLeaderboard/Supabase] 🏆 Results: ` +
        `5K=${result.leaderboard5k.length}, ` +
        `10K=${result.leaderboard10k.length}, ` +
        `Half=${result.leaderboardHalf.length}, ` +
        `Marathon=${result.leaderboardMarathon.length}, ` +
        `Steps=${result.leaderboardSteps.length}`
      );

      // Cache for 5 minutes (300 seconds)
      await this.cacheService.setWithCustomTTL(cacheKey, result, 300);
      const totalDuration = Date.now() - queryStartTime;
      console.log(`📊 [DailyLeaderboard/Supabase] 💾 Cached with 5min TTL (${totalDuration}ms)`);

      return result;
    } catch (error) {
      console.error('[DailyLeaderboard/Supabase] Error:', error);
      return this.emptyLeaderboards(todayDate);
    }
  }

  /**
   * Build time-based leaderboard (5K, 10K, Half, Marathon)
   * Keeps only best time per user, sorts by fastest time
   */
  private buildTimeLeaderboard(
    rows: SupabaseWorkoutRow[],
    timeField: 'time_5k_seconds' | 'time_10k_seconds' | 'time_half_seconds' | 'time_marathon_seconds',
    activityType: string
  ): LeaderboardEntry[] {
    // Filter to rows with time data and matching activity type
    const eligible = rows.filter(
      (r) => r[timeField] !== null && r.activity_type === activityType
    );

    // Deduplicate by user - keep only best (fastest) time
    const bestByUser = new Map<string, SupabaseWorkoutRow>();
    for (const row of eligible) {
      const existing = bestByUser.get(row.npub);
      const timeValue = row[timeField] as number;
      if (!existing || timeValue < (existing[timeField] as number)) {
        bestByUser.set(row.npub, row);
      }
    }

    // Sort by time (ascending = fastest first) and build entries
    const sorted = Array.from(bestByUser.values()).sort(
      (a, b) => (a[timeField] as number) - (b[timeField] as number)
    );

    return sorted.map((row, index) => ({
      rank: index + 1,
      npub: row.npub,
      name: row.profile_name || 'Anonymous Athlete',
      score: row[timeField] as number,
      formattedScore: this.formatTime(row[timeField] as number),
      workoutCount: 1, // Each row is one workout
    }));
  }

  /**
   * Build steps leaderboard (walking workouts)
   * Keeps only best step count per user, sorts by most steps
   */
  private buildStepsLeaderboard(rows: SupabaseWorkoutRow[]): LeaderboardEntry[] {
    // Filter to walking workouts with step count
    const eligible = rows.filter(
      (r) => r.step_count !== null && r.step_count > 0 && r.activity_type === 'walking'
    );

    // Deduplicate by user - keep highest step count
    const bestByUser = new Map<string, SupabaseWorkoutRow>();
    for (const row of eligible) {
      const existing = bestByUser.get(row.npub);
      if (!existing || (row.step_count || 0) > (existing.step_count || 0)) {
        bestByUser.set(row.npub, row);
      }
    }

    // Sort by steps (descending = most steps first)
    const sorted = Array.from(bestByUser.values()).sort(
      (a, b) => (b.step_count || 0) - (a.step_count || 0)
    );

    return sorted.map((row, index) => ({
      rank: index + 1,
      npub: row.npub,
      name: row.profile_name || 'Anonymous Athlete',
      score: row.step_count || 0,
      formattedScore: `${(row.step_count || 0).toLocaleString()} steps`,
      workoutCount: 1,
    }));
  }

  /**
   * Format seconds to MM:SS or HH:MM:SS
   */
  private formatTime(seconds: number): string {
    if (seconds < 3600) {
      // Less than 1 hour: MM:SS
      const min = Math.floor(seconds / 60);
      const sec = Math.round(seconds % 60);
      return `${min}:${sec.toString().padStart(2, '0')}`;
    } else {
      // 1 hour or more: HH:MM:SS
      const hours = Math.floor(seconds / 3600);
      const min = Math.floor((seconds % 3600) / 60);
      const sec = Math.round(seconds % 60);
      return `${hours}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Return empty leaderboards structure
   */
  private emptyLeaderboards(date: string): DailyLeaderboards {
    return {
      date,
      leaderboard5k: [],
      leaderboard10k: [],
      leaderboardHalf: [],
      leaderboardMarathon: [],
      leaderboardSteps: [],
    };
  }
}

// Export singleton instance
export const DailyLeaderboardService = DailyLeaderboardServiceClass.getInstance();
