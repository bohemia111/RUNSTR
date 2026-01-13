/**
 * Supabase Edge Function: broadcast-running-update
 *
 * Broadcasts push notifications when something happens on the Daily Running Leaderboard.
 * Privacy-first: All devices receive the SAME notification - no user tracking.
 *
 * Notification Types:
 * - "Daily Running: First 5K time today - 24:32!"
 * - "New Record! Fastest 10K today: 48:15!"
 * - "Daily Running: Someone ran a Half Marathon!"
 *
 * Called by pg_cron every 5 minutes during active hours (6 AM - 10 PM).
 *
 * Architecture:
 * 1. Query today's running workouts with time data
 * 2. Compare against daily_leaderboard_cache
 * 3. Detect new entries or records
 * 4. Broadcast to all active tokens via Expo Push API
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Format seconds to mm:ss or h:mm:ss
 */
function formatTime(seconds: number): string {
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get today's date in YYYY-MM-DD format (UTC)
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// =============================================
// MAIN HANDLER
// =============================================

serve(async (req) => {
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = getTodayDate();
    console.log(`[broadcast-running-update] Checking for updates on ${today}`);

    // 1. Get today's running workouts with time data
    const { data: workouts, error: workoutsError } = await supabase
      .from('workout_submissions')
      .select('time_5k_seconds, time_10k_seconds, time_half_seconds, time_marathon_seconds')
      .eq('activity_type', 'running')
      .gte('created_at', `${today}T00:00:00Z`);

    if (workoutsError) {
      console.error('[broadcast-running-update] Workouts query error:', workoutsError);
      return new Response(JSON.stringify({ error: workoutsError.message }), { status: 500 });
    }

    if (!workouts || workouts.length === 0) {
      console.log('[broadcast-running-update] No running workouts today');
      return new Response(JSON.stringify({ message: 'No running workouts today' }), { status: 200 });
    }

    console.log(`[broadcast-running-update] Found ${workouts.length} running workouts today`);

    // 2. Define categories to check
    const categories = [
      { key: '5k', field: 'time_5k_seconds', label: '5K' },
      { key: '10k', field: 'time_10k_seconds', label: '10K' },
      { key: 'half', field: 'time_half_seconds', label: 'Half Marathon' },
      { key: 'marathon', field: 'time_marathon_seconds', label: 'Marathon' },
    ];

    const notifications: string[] = [];

    // 3. Check each category for changes
    for (const cat of categories) {
      // Get valid times for this category
      const times = workouts
        .map((w: Record<string, number | null>) => w[cat.field])
        .filter((t: number | null): t is number => t !== null && t > 0);

      if (times.length === 0) continue;

      const bestTime = Math.min(...times);
      const entryCount = times.length;

      // Get cached data for this category
      const { data: cached } = await supabase
        .from('daily_leaderboard_cache')
        .select('*')
        .eq('date', today)
        .eq('category', cat.key)
        .single();

      let shouldNotify = false;
      let message = '';

      if (!cached) {
        // First entry of the day!
        shouldNotify = true;
        message = `Daily Running: First ${cat.label} time today - ${formatTime(bestTime)}!`;
      } else if (bestTime < (cached.best_time_seconds || Infinity)) {
        // New record!
        shouldNotify = true;
        message = `New Record! Fastest ${cat.label} today: ${formatTime(bestTime)}!`;
      } else if (entryCount > (cached.entry_count || 0)) {
        // New entry (not a record)
        shouldNotify = true;
        message = `Daily Running: New ${cat.label} entry posted!`;
      }

      if (shouldNotify) {
        notifications.push(message);

        // Update cache
        const { error: upsertError } = await supabase
          .from('daily_leaderboard_cache')
          .upsert({
            date: today,
            category: cat.key,
            best_time_seconds: bestTime,
            entry_count: entryCount,
            last_notified_at: new Date().toISOString(),
          }, { onConflict: 'date,category' });

        if (upsertError) {
          console.error(`[broadcast-running-update] Cache upsert error for ${cat.key}:`, upsertError);
        }
      }
    }

    // 4. If no changes detected, exit early
    if (notifications.length === 0) {
      console.log('[broadcast-running-update] No changes to notify');
      return new Response(JSON.stringify({ message: 'No changes to notify' }), { status: 200 });
    }

    console.log(`[broadcast-running-update] ${notifications.length} notifications to send:`, notifications);

    // 5. Get all active device tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('broadcast_tokens')
      .select('token')
      .eq('is_active', true);

    if (tokensError) {
      console.error('[broadcast-running-update] Tokens query error:', tokensError);
      return new Response(JSON.stringify({ error: tokensError.message }), { status: 500 });
    }

    if (!tokens || tokens.length === 0) {
      console.log('[broadcast-running-update] No active tokens to notify');
      return new Response(JSON.stringify({ sent: 0, notifications }), { status: 200 });
    }

    console.log(`[broadcast-running-update] Sending to ${tokens.length} devices`);

    // 6. Build push messages (same message to all - broadcast)
    const messages = tokens.map((t: { token: string }) => ({
      to: t.token,
      sound: 'default',
      title: 'RUNSTR',
      body: notifications[0], // Send most important notification
      data: { type: 'daily_running_update' },
    }));

    // 7. Send to Expo Push API (batch in chunks of 100)
    const chunks: typeof messages[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    let sent = 0;
    let failed = 0;

    for (const chunk of chunks) {
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk),
        });

        if (response.ok) {
          sent += chunk.length;
          const result = await response.json();
          console.log(`[broadcast-running-update] Batch sent:`, result);
        } else {
          failed += chunk.length;
          const errorText = await response.text();
          console.error(`[broadcast-running-update] Expo API error:`, errorText);
        }
      } catch (err) {
        failed += chunk.length;
        console.error(`[broadcast-running-update] Batch send error:`, err);
      }
    }

    console.log(`[broadcast-running-update] Complete: ${sent} sent, ${failed} failed`);

    return new Response(JSON.stringify({
      sent,
      failed,
      notifications,
      totalTokens: tokens.length,
    }), { status: 200 });

  } catch (error) {
    console.error('[broadcast-running-update] Unexpected error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500 });
  }
});
