/**
 * Challenge Deep Link Utilities
 * Generate and parse deep links for QR code sharing
 * Format: runstr://challenge?type=pushups&duration=7&wager=500&creator=npub1...&name=Alice&id=abc123
 */

import type { SimpleChallengeType } from '../constants/simpleChallengePresets';
import { getChallengePreset } from '../constants/simpleChallengePresets';

export interface ChallengeDeepLinkData {
  type: SimpleChallengeType;
  duration: 1 | 7 | 30;
  wager: number;
  creatorPubkey: string; // Hex pubkey
  creatorName: string;
  challengeId: string;
}

export interface ParsedChallengeData extends ChallengeDeepLinkData {
  isValid: boolean;
  error?: string;
}

/**
 * Generate deep link URL for challenge sharing
 */
export function generateChallengeDeepLink(
  challenge: ChallengeDeepLinkData
): string {
  const params = new URLSearchParams({
    type: challenge.type,
    duration: challenge.duration.toString(),
    wager: challenge.wager.toString(),
    creator: challenge.creatorPubkey,
    name: encodeURIComponent(challenge.creatorName),
    id: challenge.challengeId,
  });

  return `runstr://challenge?${params.toString()}`;
}

/**
 * Parse deep link URL into challenge data
 */
export function parseChallengeDeepLink(url: string): ParsedChallengeData {
  try {
    // Extract query params from URL
    const urlObj = new URL(url.replace('runstr://', 'https://'));
    const params = urlObj.searchParams;

    // Validate required params
    const type = params.get('type') as SimpleChallengeType;
    const duration = parseInt(params.get('duration') || '0');
    const wager = parseInt(params.get('wager') || '0');
    const creatorPubkey = params.get('creator') || '';
    const creatorName = decodeURIComponent(params.get('name') || '');
    const challengeId = params.get('id') || '';

    // Validate challenge type
    if (!type || !getChallengePreset(type)) {
      return {
        type: 'pushups',
        duration: 7,
        wager: 0,
        creatorPubkey: '',
        creatorName: '',
        challengeId: '',
        isValid: false,
        error: `Invalid challenge type: ${type}`,
      };
    }

    // Validate duration
    if (![1, 7, 30].includes(duration)) {
      return {
        type,
        duration: 7,
        wager: 0,
        creatorPubkey: '',
        creatorName: '',
        challengeId: '',
        isValid: false,
        error: `Invalid duration: ${duration}`,
      };
    }

    // Validate creator pubkey
    if (!creatorPubkey || creatorPubkey.length < 32) {
      return {
        type,
        duration: duration as 1 | 7 | 30,
        wager: 0,
        creatorPubkey: '',
        creatorName: '',
        challengeId: '',
        isValid: false,
        error: 'Missing or invalid creator pubkey',
      };
    }

    // Validate challenge ID
    if (!challengeId) {
      return {
        type,
        duration: duration as 1 | 7 | 30,
        wager,
        creatorPubkey,
        creatorName,
        challengeId: '',
        isValid: false,
        error: 'Missing challenge ID',
      };
    }

    return {
      type,
      duration: duration as 1 | 7 | 30,
      wager,
      creatorPubkey,
      creatorName: creatorName || 'Unknown',
      challengeId,
      isValid: true,
    };
  } catch (error) {
    console.error('Failed to parse challenge deep link:', error);
    return {
      type: 'pushups',
      duration: 7,
      wager: 0,
      creatorPubkey: '',
      creatorName: '',
      challengeId: '',
      isValid: false,
      error: `Failed to parse URL: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}

/**
 * Validate if URL is a challenge deep link
 */
export function isChallengeDeepLink(url: string): boolean {
  return url.startsWith('runstr://challenge');
}

/**
 * Generate challenge description for display
 */
export function getChallengeDescription(
  challenge: ChallengeDeepLinkData
): string {
  const preset = getChallengePreset(challenge.type);
  const durationText =
    challenge.duration === 1 ? '1 day' : `${challenge.duration} days`;
  const wagerText = challenge.wager > 0 ? ` - ${challenge.wager} sats` : '';

  return `${
    preset?.name || challenge.type
  } challenge for ${durationText}${wagerText}`;
}

/**
 * Generate unique challenge ID for QR-initiated challenges
 * Format: originalId-accepterPubkeyPrefix
 */
export function generateQRChallengeId(
  originalChallengeId: string,
  accepterPubkey: string
): string {
  // Use first 8 chars of accepter pubkey to ensure uniqueness
  const accepterPrefix = accepterPubkey.slice(0, 8);
  return `${originalChallengeId}-${accepterPrefix}`;
}
