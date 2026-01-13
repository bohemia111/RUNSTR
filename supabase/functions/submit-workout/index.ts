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
  // New fields for daily leaderboard
  profile_name?: string
  profile_picture?: string
}

// =============================================
// DAILY LEADERBOARD: Split Parsing & Time Calculation
// =============================================

/**
 * Parse split data from kind 1301 event tags
 * Tags format: ["split", "5", "00:32:10"] where 5 = km marker, time in HH:MM:SS
 * Returns map of km -> elapsed seconds
 */
function parseSplitsFromTags(rawEvent: Record<string, unknown>): Record<number, number> {
  const splits: Record<number, number> = {}
  const tags = rawEvent.tags as string[][] | undefined

  if (!tags || !Array.isArray(tags)) {
    return splits
  }

  for (const tag of tags) {
    if (tag[0] === 'split' && tag.length >= 3) {
      const km = parseInt(tag[1])
      const timeStr = tag[2]

      if (!isNaN(km) && timeStr && km > 0) {
        const seconds = parseTimeToSeconds(timeStr)
        if (seconds > 0) {
          splits[km] = seconds
        }
      }
    }
  }

  return splits
}

/**
 * Parse time string (HH:MM:SS or MM:SS) to seconds
 */
function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number)

  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1]
  }

  return 0
}

/**
 * Parse step count from kind 1301 event tags
 * Tag format: ["steps", "12345"]
 */
function parseStepCount(rawEvent: Record<string, unknown>): number | null {
  const tags = rawEvent.tags as string[][] | undefined

  if (!tags || !Array.isArray(tags)) {
    return null
  }

  for (const tag of tags) {
    if (tag[0] === 'steps' && tag[1]) {
      const steps = parseInt(tag[1])
      return !isNaN(steps) && steps > 0 ? steps : null
    }
  }

  return null
}

/**
 * Calculate time at target distance using splits or interpolation
 * Same logic as client-side SimpleLeaderboardService.extractTargetDistanceTime()
 *
 * @param splits - Map of km -> elapsed seconds
 * @param totalDistanceKm - Total workout distance
 * @param totalDurationSeconds - Total workout duration
 * @param targetKm - Target distance (5, 10, 21.1, 42.2)
 * @returns Time in seconds to reach target distance, or null if not reachable
 */
function calculateTargetTime(
  splits: Record<number, number>,
  totalDistanceKm: number,
  totalDurationSeconds: number,
  targetKm: number
): number | null {
  // Must have run at least the target distance
  if (totalDistanceKm < targetKm) {
    return null
  }

  // 1. Check for exact split at target distance
  const exactSplit = splits[targetKm]
  if (exactSplit !== undefined && exactSplit > 0) {
    return exactSplit
  }

  // 2. Try interpolation from closest split
  const sortedKms = Object.keys(splits).map(Number).sort((a, b) => a - b)

  // Find closest split <= target distance
  let closestKm = 0
  let closestTime = 0

  for (const km of sortedKms) {
    if (km <= targetKm && km > closestKm) {
      closestKm = km
      closestTime = splits[km]
    }
  }

  // Interpolate from closest split
  if (closestKm > 0 && closestTime > 0) {
    const remainingDistance = targetKm - closestKm
    const avgPacePerKm = closestTime / closestKm
    const estimatedTime = closestTime + remainingDistance * avgPacePerKm
    // Cap at total duration
    return Math.round(Math.min(estimatedTime, totalDurationSeconds))
  }

  // 3. Fallback: Calculate from average pace
  if (totalDistanceKm > 0 && totalDurationSeconds > 0) {
    const avgPacePerKm = totalDurationSeconds / totalDistanceKm
    return Math.round(avgPacePerKm * targetKm)
  }

  return null
}

/**
 * Calculate all target times for a workout
 */
function calculateAllTargetTimes(
  splits: Record<number, number>,
  totalDistanceKm: number,
  totalDurationSeconds: number
): {
  time_5k_seconds: number | null
  time_10k_seconds: number | null
  time_half_seconds: number | null
  time_marathon_seconds: number | null
} {
  return {
    time_5k_seconds: calculateTargetTime(splits, totalDistanceKm, totalDurationSeconds, 5),
    time_10k_seconds: calculateTargetTime(splits, totalDistanceKm, totalDurationSeconds, 10),
    time_half_seconds: calculateTargetTime(splits, totalDistanceKm, totalDurationSeconds, 21.1),
    time_marathon_seconds: calculateTargetTime(splits, totalDistanceKm, totalDurationSeconds, 42.2),
  }
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

// =============================================
// VERIFICATION CODE VALIDATION
// =============================================

type VerificationStatus = 'verified' | 'unverified' | 'invalid' | 'legacy' | 'expired' | 'replay' | 'tampered'

/**
 * Extract verification data from kind 1301 event tags
 */
function extractVerificationData(rawEvent: Record<string, unknown>): {
  verificationCode: string | null
  clientVersion: string | null
} {
  const tags = rawEvent.tags as string[][] | undefined

  if (!tags || !Array.isArray(tags)) {
    return { verificationCode: null, clientVersion: null }
  }

  // Find ["v", "code"] tag
  const vTag = tags.find(t => t[0] === 'v')
  const verificationCode = vTag?.[1] || null

  // Find ["client", "RUNSTR", "version"] tag
  const clientTag = tags.find(t => t[0] === 'client' && t[1] === 'RUNSTR')
  const clientVersion = clientTag?.[2] || null

  return { verificationCode, clientVersion }
}

/**
 * Extract workout data needed for per-workout verification
 */
function extractWorkoutDataForVerification(rawEvent: Record<string, unknown>): {
  workoutId: string | null
  exercise: string | null
  distanceMeters: number
  durationSeconds: number
  startTimestamp: number
} {
  const tags = rawEvent.tags as string[][] | undefined

  if (!tags || !Array.isArray(tags)) {
    return { workoutId: null, exercise: null, distanceMeters: 0, durationSeconds: 0, startTimestamp: 0 }
  }

  // Find ["d", "workout_id"] tag
  const dTag = tags.find(t => t[0] === 'd')
  const workoutId = dTag?.[1] || null

  // Find ["exercise", "type"] tag
  const exerciseTag = tags.find(t => t[0] === 'exercise')
  const exercise = exerciseTag?.[1]?.toLowerCase() || null

  // Find ["distance", "value", "unit"] tag and convert to meters
  const distanceTag = tags.find(t => t[0] === 'distance')
  let distanceMeters = 0
  if (distanceTag && distanceTag[1]) {
    const value = parseFloat(distanceTag[1])
    const unit = distanceTag[2]?.toLowerCase() || 'km'
    if (!isNaN(value)) {
      distanceMeters = unit === 'mi' ? Math.round(value * 1609.34) : Math.round(value * 1000)
    }
  }

  // Find ["duration", "HH:MM:SS"] tag
  const durationTag = tags.find(t => t[0] === 'duration')
  const durationSeconds = durationTag?.[1] ? parseTimeToSeconds(durationTag[1]) : 0

  // Find ["workout_start_time", "timestamp"] tag
  const startTag = tags.find(t => t[0] === 'workout_start_time')
  const startTimestamp = startTag?.[1] ? parseInt(startTag[1]) : 0

  return { workoutId, exercise, distanceMeters, durationSeconds, startTimestamp }
}

/**
 * Build canonical string for verification (must match get-workout-verification)
 */
function buildCanonicalString(
  npub: string,
  workoutId: string,
  exercise: string,
  distanceMeters: number,
  durationSeconds: number,
  startTimestamp: number
): string {
  return `${npub}:${workoutId}:${exercise}:${distanceMeters}:${durationSeconds}:${startTimestamp}`
}

/**
 * Generate HMAC-SHA256 verification code (same as get-verification-code function)
 */
async function generateHmacCode(secret: string, npub: string, version: string): Promise<string> {
  const encoder = new TextEncoder()
  const message = `${npub}:${version}`

  const keyData = encoder.encode(secret)
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))

  const hashArray = Array.from(new Uint8Array(signature))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return hashHex.substring(0, 16)
}

/**
 * Validate per-workout verification code against stored record
 */
async function validatePerWorkoutCode(
  supabase: ReturnType<typeof createClient>,
  npub: string,
  rawEvent: Record<string, unknown>
): Promise<{ status: VerificationStatus; code: string | null } | null> {
  const { verificationCode } = extractVerificationData(rawEvent)
  const workoutData = extractWorkoutDataForVerification(rawEvent)

  // No workout_id means can't do per-workout validation
  if (!workoutData.workoutId) {
    return null
  }

  // Look up stored verification record
  const { data: stored, error } = await supabase
    .from('workout_verification_codes')
    .select('*')
    .eq('workout_id', workoutData.workoutId)
    .single()

  if (error || !stored) {
    // No stored record - per-workout verification was not used
    // Fall back to legacy validation
    return null
  }

  // Check if code already used (replay attack)
  if (stored.used) {
    console.warn(`Replay attempt: workout ${workoutData.workoutId} code already used`)
    return { status: 'replay', code: verificationCode }
  }

  // Check expiry
  if (new Date() > new Date(stored.expires_at)) {
    console.warn(`Expired verification code for workout ${workoutData.workoutId}`)
    return { status: 'expired', code: verificationCode }
  }

  // Validate code matches stored code
  if (verificationCode !== stored.verification_code) {
    console.warn(`Code mismatch for workout ${workoutData.workoutId}`)
    return { status: 'invalid', code: verificationCode }
  }

  // Recompute canonical hash from submitted data
  const computedHash = buildCanonicalString(
    npub,
    workoutData.workoutId,
    workoutData.exercise || '',
    workoutData.distanceMeters,
    workoutData.durationSeconds,
    workoutData.startTimestamp
  )

  // Validate hash matches (detect data tampering)
  if (computedHash !== stored.canonical_hash) {
    console.warn(`Hash mismatch for workout ${workoutData.workoutId}:`)
    console.warn(`  Stored: ${stored.canonical_hash}`)
    console.warn(`  Computed: ${computedHash}`)
    return { status: 'tampered', code: verificationCode }
  }

  // Mark code as used to prevent replay
  const { error: updateError } = await supabase
    .from('workout_verification_codes')
    .update({ used: true })
    .eq('workout_id', workoutData.workoutId)

  if (updateError) {
    console.error(`Failed to mark verification code as used: ${updateError.message}`)
    // Continue anyway - better to accept than reject due to update failure
  }

  console.log(`Per-workout verification passed for workout ${workoutData.workoutId}`)
  return { status: 'verified', code: verificationCode }
}

/**
 * Validate verification code against server-side computed code
 * First tries per-workout validation, then falls back to legacy per-user validation
 */
async function validateVerificationCode(
  npub: string,
  rawEvent: Record<string, unknown>,
  supabase?: ReturnType<typeof createClient>
): Promise<{ status: VerificationStatus; code: string | null }> {
  const { verificationCode, clientVersion } = extractVerificationData(rawEvent)

  // Try per-workout validation first (if supabase client provided)
  if (supabase) {
    const perWorkoutResult = await validatePerWorkoutCode(supabase, npub, rawEvent)
    if (perWorkoutResult) {
      return perWorkoutResult
    }
  }

  // Fall back to legacy per-user validation
  // No verification code provided - could be old app version or non-RUNSTR client
  if (!verificationCode) {
    return { status: 'unverified', code: null }
  }

  // No client version - can't validate
  if (!clientVersion) {
    return { status: 'unverified', code: verificationCode }
  }

  // Get secret for this version
  const secretKey = `VERIFICATION_SECRET_${clientVersion.replace(/\./g, '_')}`
  const secret = Deno.env.get(secretKey)

  if (!secret) {
    // Unknown version - treat as unverified (not invalid)
    // This handles versions before verification was implemented
    console.log(`No verification secret for version ${clientVersion}`)
    return { status: 'unverified', code: verificationCode }
  }

  // Recompute expected code (legacy: per-user)
  const expectedCode = await generateHmacCode(secret, npub, clientVersion)

  // Compare codes
  if (verificationCode === expectedCode) {
    // Legacy verification passed - but this is now considered weaker
    // Mark as 'legacy' instead of 'verified' for per-user codes
    return { status: 'legacy', code: verificationCode }
  }

  // Code provided but doesn't match - likely forged
  console.warn(`Verification code mismatch for ${npub.slice(0, 12)}... version ${clientVersion}`)
  return { status: 'invalid', code: verificationCode }
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

      // Parse daily leaderboard data from raw_event
      const distanceKm = (workout.distance_meters || 0) / 1000
      const durationSeconds = workout.duration_seconds || 0
      const splits = parseSplitsFromTags(workout.raw_event)
      const targetTimes = calculateAllTargetTimes(splits, distanceKm, durationSeconds)
      const stepCount = parseStepCount(workout.raw_event)

      // Validate verification code for anti-cheat (per-workout first, then legacy)
      const verificationResult = await validateVerificationCode(workout.npub, workout.raw_event, supabase)
      console.log(`Verification status: ${verificationResult.status} for ${workout.npub.slice(0, 12)}...`)

      // Calculate leaderboard_date from created_at
      const leaderboardDate = workout.created_at
        ? new Date(workout.created_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]

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
        // Daily leaderboard fields
        splits_json: Object.keys(splits).length > 0 ? splits : null,
        time_5k_seconds: targetTimes.time_5k_seconds,
        time_10k_seconds: targetTimes.time_10k_seconds,
        time_half_seconds: targetTimes.time_half_seconds,
        time_marathon_seconds: targetTimes.time_marathon_seconds,
        step_count: stepCount,
        leaderboard_date: leaderboardDate,
        profile_name: workout.profile_name || null,
        profile_picture: workout.profile_picture || null,
        // Verification fields for anti-cheat leaderboard filtering
        verification_code: verificationResult.code,
        verification_status: verificationResult.status,
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
