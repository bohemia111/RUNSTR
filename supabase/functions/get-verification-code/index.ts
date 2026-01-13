/**
 * Supabase Edge Function: get-verification-code
 *
 * Generates HMAC-based verification codes for workout anti-cheat.
 * Called by the app on login to get the user's verification code.
 *
 * Security model:
 * - Secret is stored in Supabase environment variables (per-version)
 * - Code is deterministic: same npub + version = same code
 * - Code cannot be forged without knowing the server secret
 * - Since RUNSTR is open source, all verification logic lives here
 *
 * Flow:
 * 1. App sends { npub, version }
 * 2. Server looks up secret for that version
 * 3. Server computes: code = HMAC-SHA256(SECRET, npub:version)
 * 4. Returns truncated 16-char code
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
    const { npub, version } = await req.json()

    // Validate inputs
    if (!npub || !version) {
      return new Response(
        JSON.stringify({ error: 'npub and version required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate npub format (bech32 encoded)
    if (!npub.startsWith('npub1') || npub.length < 60) {
      return new Response(
        JSON.stringify({ error: 'Invalid npub format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get secret for this version
    // Secret naming convention: VERIFICATION_SECRET_X_Y_Z for version X.Y.Z
    // Example: VERIFICATION_SECRET_1_5_0 for version 1.5.0
    const secretKey = `VERIFICATION_SECRET_${version.replace(/\./g, '_')}`
    const secret = Deno.env.get(secretKey)

    if (!secret) {
      // Version not supported or secret not configured
      // This is expected for old versions or during rollout
      console.log(`No verification secret found for version ${version} (key: ${secretKey})`)
      return new Response(
        JSON.stringify({ code: null, message: 'Version not supported for verification' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate HMAC-SHA256 code
    const code = await generateHmacCode(secret, npub, version)

    console.log(`Generated verification code for ${npub.slice(0, 12)}... version ${version}`)

    return new Response(
      JSON.stringify({ code }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error generating verification code:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Generate HMAC-SHA256 verification code
 * Uses Web Crypto API (available in Deno)
 */
async function generateHmacCode(secret: string, npub: string, version: string): Promise<string> {
  const encoder = new TextEncoder()
  const message = `${npub}:${version}`

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
