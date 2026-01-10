/**
 * Supabase Edge Function: submit-workout
 *
 * Validates and stores workout submissions with anti-cheat protection.
 * Called by the app when user clicks "Compete" button.
 *
 * Anti-cheat validation includes:
 * - Pace limits (too fast = superhuman, too slow = not real activity)
 * - Distance limits (max per activity type)
 * - Duration limits (max per activity type)
 * - Zero distance with duration check (forgot to end workout?)
 * - Duplicate event ID detection
 * - Time-overlap detection (can't do 2 workouts simultaneously)
 *
 * Valid workouts → workout_submissions table
 * Invalid workouts → flagged_workouts table (for admin review)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Anti-cheat limits (ported from scripts/generate-season2-baseline.ts)
const VALIDATION_LIMITS: Record<string, {
  minPaceSecondsPerKm: number;
  maxPaceSecondsPerKm: number;
  maxDistanceKm: number;
  maxDurationSeconds: number;
}> = {
  running: {
    minPaceSecondsPerKm: 120,    // 2:00/km (world record territory)
    maxPaceSecondsPerKm: 1800,   // 30:00/km (too slow to be running)
    maxDistanceKm: 200,          // Ultra marathon limit
    maxDurationSeconds: 172800,  // 48 hours
  },
  walking: {
    minPaceSecondsPerKm: 180,    // 3:00/km (that's running, not walking)
    maxPaceSecondsPerKm: 3600,   // 60:00/km (too slow to count)
    maxDistanceKm: 100,          // Max single walk
    maxDurationSeconds: 86400,   // 24 hours
  },
  cycling: {
    minPaceSecondsPerKm: 30,     // 0:30/km (120 km/h - downhill only)
    maxPaceSecondsPerKm: 600,    // 10:00/km (6 km/h - too slow)
    maxDistanceKm: 500,          // Max single ride
    maxDurationSeconds: 172800,  // 48 hours
  },
}

interface WorkoutSubmission {
  event_id: string
  npub: string
  activity_type: string
  distance_meters: number | null
  duration_seconds: number
  calories: number | null
  created_at: string
  raw_event: Record<string, unknown>
  source?: 'app' | 'nostr_scan' | 'baseline_migration'
}

/**
 * Auto-classify "other" type workouts based on pace
 * Used for Apple Health / Health Connect imports that don't have proper activity type tags
 *
 * Pace thresholds:
 * - Running: < 8 min/km (480 sec/km) - faster than 7.5 km/h
 * - Walking: > 12 min/km (720 sec/km) - slower than 5 km/h
 * - Ambiguous (8-12 min/km): default to 'running' if distance >= 1km
 */
function classifyOtherWorkout(workout: WorkoutSubmission): string {
  // Only classify "other" type
  if (workout.activity_type !== 'other') {
    return workout.activity_type
  }

  const distanceKm = (workout.distance_meters || 0) / 1000
  const duration = workout.duration_seconds || 0

  // Can't classify without both distance and duration
  if (distanceKm <= 0 || duration <= 0) {
    return 'other'
  }

  const paceSecondsPerKm = duration / distanceKm

  // Pace thresholds
  const RUNNING_THRESHOLD = 480  // 8:00/km
  const WALKING_THRESHOLD = 720  // 12:00/km

  if (paceSecondsPerKm < RUNNING_THRESHOLD) {
    console.log(`🏃 Auto-classified as RUNNING: ${paceSecondsPerKm.toFixed(0)}s/km pace`)
    return 'running'
  }

  if (paceSecondsPerKm > WALKING_THRESHOLD) {
    console.log(`🚶 Auto-classified as WALKING: ${paceSecondsPerKm.toFixed(0)}s/km pace`)
    return 'walking'
  }

  // Ambiguous zone (8-12 min/km): default to running if significant distance
  if (distanceKm >= 1) {
    console.log(`🏃 Ambiguous pace (${paceSecondsPerKm.toFixed(0)}s/km) with ${distanceKm.toFixed(1)}km - defaulting to RUNNING`)
    return 'running'
  }

  return 'other'
}

interface ValidationResult {
  valid: boolean
  reason?: string
}

function validateWorkout(workout: WorkoutSubmission): ValidationResult {
  const limits = VALIDATION_LIMITS[workout.activity_type]

  // Unknown activity type - allow but skip validation
  if (!limits) {
    return { valid: true }
  }

  const distanceKm = (workout.distance_meters || 0) / 1000
  const duration = workout.duration_seconds || 0

  // 1. Zero distance with significant duration (forgot to end workout?)
  if (distanceKm === 0 && duration > 1800) {
    return {
      valid: false,
      reason: `Zero distance with ${Math.round(duration / 60)} min duration - possible forgot to end workout`
    }
  }

  // 2. Distance without duration (manual entry without time?)
  if (distanceKm > 0 && duration === 0) {
    return {
      valid: false,
      reason: `${distanceKm.toFixed(2)} km with 0 duration - invalid submission`
    }
  }

  // 3. Max distance check
  if (distanceKm > limits.maxDistanceKm) {
    return {
      valid: false,
      reason: `Distance ${distanceKm.toFixed(1)} km exceeds max ${limits.maxDistanceKm} km for ${workout.activity_type}`
    }
  }

  // 4. Max duration check
  if (duration > limits.maxDurationSeconds) {
    const hours = Math.round(duration / 3600)
    const maxHours = limits.maxDurationSeconds / 3600
    return {
      valid: false,
      reason: `Duration ${hours} hours exceeds max ${maxHours} hours for ${workout.activity_type}`
    }
  }

  // 5. Pace validation (only if both distance and duration exist)
  if (distanceKm > 0 && duration > 0) {
    const paceSecondsPerKm = duration / distanceKm

    // Too fast (superhuman speed)
    if (paceSecondsPerKm < limits.minPaceSecondsPerKm) {
      const paceMin = Math.floor(paceSecondsPerKm / 60)
      const paceSec = Math.round(paceSecondsPerKm % 60)
      const minPaceMin = Math.floor(limits.minPaceSecondsPerKm / 60)
      const minPaceSec = limits.minPaceSecondsPerKm % 60
      return {
        valid: false,
        reason: `Pace ${paceMin}:${String(paceSec).padStart(2, '0')}/km too fast - minimum allowed is ${minPaceMin}:${String(minPaceSec).padStart(2, '0')}/km for ${workout.activity_type}`
      }
    }

    // Too slow
    if (paceSecondsPerKm > limits.maxPaceSecondsPerKm) {
      const paceMin = Math.floor(paceSecondsPerKm / 60)
      const paceSec = Math.round(paceSecondsPerKm % 60)
      return {
        valid: false,
        reason: `Pace ${paceMin}:${String(paceSec).padStart(2, '0')}/km too slow for ${workout.activity_type}`
      }
    }
  }

  return { valid: true }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const workout: WorkoutSubmission = await req.json()

    // Validate required fields
    if (!workout.event_id || !workout.npub) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: event_id, npub' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check for duplicate event_id (deduplication)
    const { data: existing } = await supabase
      .from('workout_submissions')
      .select('id')
      .eq('event_id', workout.event_id)
      .single()

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, message: 'Already submitted', duplicate: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Also check flagged_workouts to avoid reprocessing rejected submissions
    const { data: existingFlagged } = await supabase
      .from('flagged_workouts')
      .select('id')
      .eq('event_id', workout.event_id)
      .single()

    if (existingFlagged) {
      return new Response(
        JSON.stringify({ success: false, message: 'Previously flagged submission', duplicate: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check for time-overlap duplicate
    // If new workout's time range overlaps with any existing workout, it's physically impossible
    // to have done both - so one must be a duplicate (catches app double-publish bugs)
    if (workout.created_at && workout.duration_seconds && workout.npub) {
      const newStart = new Date(workout.created_at).getTime()
      const newEnd = newStart + (workout.duration_seconds * 1000)

      // Query workouts from same user within a reasonable window
      // (new workout start minus max possible duration, to new workout end)
      const maxDuration = 48 * 60 * 60 * 1000 // 48 hours in ms
      const windowStart = new Date(newStart - maxDuration).toISOString()
      const windowEnd = new Date(newEnd).toISOString()

      const { data: nearbyWorkouts } = await supabase
        .from('workout_submissions')
        .select('id, event_id, created_at, duration_seconds')
        .eq('npub', workout.npub)
        .gte('created_at', windowStart)
        .lte('created_at', windowEnd)

      if (nearbyWorkouts && nearbyWorkouts.length > 0) {
        for (const existing of nearbyWorkouts) {
          const existStart = new Date(existing.created_at).getTime()
          const existEnd = existStart + ((existing.duration_seconds || 0) * 1000)

          // Check for overlap: new_start < exist_end AND new_end > exist_start
          if (newStart < existEnd && newEnd > existStart) {
            console.log(`🔄 Time-overlap duplicate: ${workout.event_id} overlaps with ${existing.event_id}`)
            return new Response(
              JSON.stringify({ success: true, message: 'Workout time overlaps with existing workout', duplicate: true }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
      }
    }

    // Auto-classify "other" type workouts (from Apple Health / Health Connect)
    const classifiedActivityType = classifyOtherWorkout(workout)
    const workoutWithClassification = {
      ...workout,
      activity_type: classifiedActivityType,
    }

    // Validate workout against anti-cheat rules
    const validation = validateWorkout(workoutWithClassification)

    if (validation.valid) {
      // Insert valid workout with classified activity type
      // Source defaults to 'app' but can be overridden (e.g., 'nostr_scan' for transition scripts)
      const { error } = await supabase.from('workout_submissions').insert({
        event_id: workout.event_id,
        npub: workout.npub,
        activity_type: classifiedActivityType, // Use classified type, not original
        distance_meters: workout.distance_meters,
        duration_seconds: workout.duration_seconds,
        calories: workout.calories,
        created_at: workout.created_at,
        raw_event: workout.raw_event,
        verified: true,
        source: workout.source || 'app',
      })

      if (error) {
        console.error('Insert error:', error)
        throw error
      }

      const typeInfo = workout.activity_type !== classifiedActivityType
        ? `${workout.activity_type} → ${classifiedActivityType}`
        : classifiedActivityType
      console.log(`✅ Workout accepted: ${workout.event_id} (${typeInfo}, ${(workout.distance_meters || 0) / 1000}km)`)

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Insert into flagged_workouts for admin review
      const { error: flagError } = await supabase.from('flagged_workouts').insert({
        event_id: workout.event_id,
        npub: workout.npub,
        activity_type: workout.activity_type,
        distance_meters: workout.distance_meters,
        duration_seconds: workout.duration_seconds,
        created_at: workout.created_at,
        reason: validation.reason,
        raw_event: workout.raw_event,
      })

      if (flagError) {
        console.error('Flag insert error:', flagError)
      }

      console.log(`🚫 Workout flagged: ${workout.event_id} - ${validation.reason}`)

      return new Response(
        JSON.stringify({ success: false, reason: validation.reason, flagged: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
