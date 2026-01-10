/**
 * AntiCheatRequestService - Publish cheating verification requests to Nostr
 *
 * Creates kind 21301 events for anti-cheating verification requests.
 * Dakota manually investigates and responds via Nostr DM or email.
 */

import { GlobalNDKService } from '../nostr/GlobalNDKService';
import { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { getAuthenticationData } from '../../utils/nostrAuth';
import {
  ANTICHEAT_REQUEST_KIND,
  ANTICHEAT_PRICE_SATS,
  RUNSTR_ADMIN_PUBKEY,
} from '../../constants/anticheat';

export type ContactMethod = 'nostr_dm' | 'email';

export interface AntiCheatRequest {
  // Required
  suspectIdentifier: string; // npub, hex pubkey, or display name

  // Optional context
  reason?: string;
  competition?: string; // e.g., "Season 2 Walking"

  // Contact preference
  contactMethod: ContactMethod;
  email?: string; // Required if contactMethod is 'email'
}

export interface AntiCheatRequestResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

/**
 * Convert npub to hex pubkey, or return as-is if already hex or name
 */
function resolvePublicKey(identifier: string): { pubkey?: string; name?: string } {
  // Check if it's an npub
  if (identifier.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(identifier);
      if (decoded.type === 'npub') {
        return { pubkey: decoded.data as string };
      }
    } catch {
      // Not a valid npub, treat as name
      return { name: identifier };
    }
  }

  // Check if it's a valid hex pubkey (64 hex chars)
  if (/^[a-f0-9]{64}$/i.test(identifier)) {
    return { pubkey: identifier.toLowerCase() };
  }

  // Otherwise treat as display name
  return { name: identifier };
}

/**
 * Publish an anti-cheating verification request to Nostr
 */
export async function publishAntiCheatRequest(
  request: AntiCheatRequest
): Promise<AntiCheatRequestResult> {
  try {
    // Get user's private key from SecureStore
    const authData = await getAuthenticationData();
    if (!authData?.nsec) {
      return { success: false, error: 'Not logged in - no nsec found' };
    }

    // Decode nsec to hex
    let privateKeyHex: string;
    try {
      const decoded = nip19.decode(authData.nsec);
      if (decoded.type !== 'nsec') {
        return { success: false, error: 'Invalid nsec format' };
      }
      // Convert Uint8Array to hex string
      const bytes = decoded.data as Uint8Array;
      privateKeyHex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      return { success: false, error: 'Failed to decode nsec' };
    }

    // Get NDK instance
    const ndk = await GlobalNDKService.getInstance();

    // Create signer
    const signer = new NDKPrivateKeySigner(privateKeyHex);
    await signer.user(); // Ensure signer is initialized

    // Resolve suspect identifier
    const { pubkey: suspectPubkey, name: suspectName } = resolvePublicKey(
      request.suspectIdentifier
    );

    // Build tags
    const tags: string[][] = [
      ['p', RUNSTR_ADMIN_PUBKEY], // Tag admin for easy querying
      ['client', 'RUNSTR', '1.0'],
      ['contact_method', request.contactMethod],
    ];

    // Add suspect identifier
    if (suspectPubkey) {
      tags.push(['suspect_pubkey', suspectPubkey]);
    }
    if (suspectName || (!suspectPubkey && request.suspectIdentifier)) {
      tags.push(['suspect_name', suspectName || request.suspectIdentifier]);
    }

    // Add optional fields
    if (request.competition) {
      tags.push(['competition', request.competition]);
    }
    if (request.contactMethod === 'email' && request.email) {
      tags.push(['email', request.email]);
    }
    if (request.reason) {
      tags.push(['reason', request.reason]);
    }

    // Build content (human-readable summary)
    const contentParts: string[] = [];
    contentParts.push(`Anti-cheat verification request`);
    contentParts.push(`Suspect: ${request.suspectIdentifier}`);
    if (request.competition) {
      contentParts.push(`Competition: ${request.competition}`);
    }
    if (request.reason) {
      contentParts.push(`Reason: ${request.reason}`);
    }
    contentParts.push(`Contact via: ${request.contactMethod === 'email' ? request.email : 'Nostr DM'}`);

    // Create NDK event
    const ndkEvent = new NDKEvent(ndk);
    ndkEvent.kind = ANTICHEAT_REQUEST_KIND;
    ndkEvent.content = contentParts.join('\n');
    ndkEvent.tags = tags;
    ndkEvent.created_at = Math.floor(Date.now() / 1000);

    // Sign and publish
    await ndkEvent.sign(signer);
    await ndkEvent.publish();

    console.log(`[AntiCheat] Request published: ${ndkEvent.id}`);

    return {
      success: true,
      eventId: ndkEvent.id,
    };
  } catch (error) {
    console.error('[AntiCheat] Failed to publish request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get the price display string
 */
export function getAntiCheatPriceDisplay(): string {
  return `${ANTICHEAT_PRICE_SATS.toLocaleString()} sats`;
}
