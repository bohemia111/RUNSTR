/**
 * Supabase Edge Function: get-workout-verification
 *
 * Generates unique per-workout verification codes for anti-cheat.
 * Called by the app BEFORE publishing a workout to Nostr.
 *
 * Security model:
 * - Code is unique per workout (tied to immutable workout data)
 * - Code is stored server-side with expiry
 * - Replay attacks blocked by 'used' flag
 * - Data modification detected by hash mismatch
 *
 * Flow:
 * 1. App sends { npub, workout_id, exercise, distance_m, duration_s, start_ts, version }
 * 2. Server builds canonical hash from workout data
 * 3. Server computes: code = HMAC-SHA256(SECRET, canonical_hash)
 * 4. Server stores record in workout_verification_codes table
 * 5. Returns code with 5-minute expiry
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Expiry time in seconds (5 minutes)
const CODE_EXPIRY_SECONDS = 300

interface WorkoutVerificationRequest {
  npub: string
  workout_id: string
  exercise: string
  distance_m: number
  duration_s: number
  start_ts: number
  version: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const request: WorkoutVerificationRequest = await req.json()

    // Validate required fields
    const { npub, workout_id, exercise, distance_m, duration_s, start_ts, version } = request

    if (!npub || !workout_id || !exercise || !version) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: npub, workout_id, exercise, version' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate npub format
    if (!npub.startsWith('npub1') || npub.length < 60) {
      return new Response(
        JSON.stringify({ error: 'Invalid npub format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate exercise type (lowercase)
    const validExercises = ['running', 'walking', 'cycling', 'hiking', 'strength', 'meditation', 'diet', 'other']
    if (!validExercises.includes(exercise.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: `Invalid exercise type: ${exercise}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate numeric fields (allow 0 for distance/duration but should be non-negative)
    const distanceMeters = Math.max(0, Math.round(distance_m || 0))
    const durationSeconds = Math.max(0, Math.round(duration_s || 0))
    const startTimestamp = Math.max(0, Math.round(start_ts || 0))

    // Get secret for this version
    const secretKey = `VERIFICATION_SECRET_${version.replace(/\./g, '_')}`
    const secret = Deno.env.get(secretKey)

    if (!secret) {
      console.log(`No verification secret found for version ${version} (key: ${secretKey})`)
      return new Response(
        JSON.stringify({ code: null, message: 'Version not supported for verification' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build canonical hash string from immutable workout fields
    // Format: npub:workout_id:exercise:distance_m:duration_s:start_ts
    const canonicalString = buildCanonicalString(
      npub,
      workout_id,
      exercise.toLowerCase(),
      distanceMeters,
      durationSeconds,
      startTimestamp
    )

    // Generate HMAC code from canonical hash
    const code = await generateHmacCode(secret, canonicalString)

    // Store in database with expiry
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const expiresAt = new Date(Date.now() + CODE_EXPIRY_SECONDS * 1000).toISOString()

    // Upsert to handle retry scenarios (same workout_id can request code again if not used)
    const { error: upsertError } = await supabase
      .from('workout_verification_codes')
      .upsert(
        {
          workout_id,
          npub,
          canonical_hash: canonicalString,
          verification_code: code,
          expires_at: expiresAt,
          used: false,
        },
        { onConflict: 'workout_id' }
      )

    if (upsertError) {
      console.error('Failed to store verification code:', upsertError)
      return new Response(
        JSON.stringify({ error: 'Failed to store verification code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Generated per-workout verification code for ${npub.slice(0, 12)}... workout ${workout_id.slice(0, 8)}...`)

    return new Response(
      JSON.stringify({
        code,
        expires_in: CODE_EXPIRY_SECONDS,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error generating workout verification code:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Build canonical string from workout data
 * This string is used as input to HMAC - any modification to workout data
 * will produce a different hash and fail verification
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
 * Generate HMAC-SHA256 verification code
 * Uses Web Crypto API (available in Deno)
 */
async function generateHmacCode(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()

  // Import secret as HMAC key
  const keyData = encoder.encode(secret)
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  // Sign the message
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))

  // Convert to hex string and truncate to 16 characters
  // 16 hex chars = 64 bits of entropy, sufficient for verification
  const hashArray = Array.from(new Uint8Array(signature))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return hashHex.substring(0, 16)
}
