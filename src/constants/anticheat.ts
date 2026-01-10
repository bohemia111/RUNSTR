/**
 * Anti-Cheating Verification Service Constants
 *
 * Users can request verification of suspected cheaters for 5,000 sats.
 * Requests are published as kind 21301 Nostr events.
 * Dakota manually investigates and responds via Nostr DM.
 */

// Custom Nostr event kind for cheating verification requests
export const ANTICHEAT_REQUEST_KIND = 21301;

// Price in satoshis for verification service
export const ANTICHEAT_PRICE_SATS = 5000;

// Payment URL - user is redirected here after submitting request
export const ANTICHEAT_PAYMENT_URL = 'https://runstr.club/pages/anti-cheat.html';

// RUNSTR admin pubkey (hex) - receives and processes requests
// npub1vygzr642y6f8gxcjx6auaf2vd25lyzarpjkwx9kr4y752zy6058s8jvy4e
export const RUNSTR_ADMIN_PUBKEY =
  '611021eaaa2692741b1236bbcea54c6aa9f20ba30cace316c3a93d45089a7d0f';
