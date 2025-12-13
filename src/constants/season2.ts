/**
 * RUNSTR Season 2 Configuration Constants
 *
 * Two-month distance-based competition: January 1 - March 1, 2026
 * Prize pool: 500k sats lottery + 500k sats charity prizes
 */

import type { Season2Config, Season2Status } from '../types/season2';

// ============================================================================
// TEST MODE - Set to false before production release!
// ============================================================================
export const SEASON_2_TEST_MODE = false;

// RUNSTR admin pubkey (hex)
// npub1vygzr642y6f8gxcjx6auaf2vd25lyzarpjkwx9kr4y752zy6058s8jvy4e
const RUNSTR_ADMIN_PUBKEY =
  '611021eaaa2692741b1236bbcea54c6aa9f20ba30cace316c3a93d45089a7d0f';

export const SEASON_2_CONFIG: Season2Config = {
  startDate: '2026-01-01T00:00:00Z',
  endDate: '2026-03-01T23:59:59Z',
  entryFeeSats: 24000,
  prizePoolLottery: 500000, // 500k sats random draw
  prizePoolCharity: 500000, // 500k sats split 3 ways (~166k per category)
  adminPubkey: RUNSTR_ADMIN_PUBKEY,
  participantListDTag: 'runstr-season-2-participants',
  paymentUrl: 'https://www.runstr.club/pages/season2.html',
};

// AsyncStorage key for local joins
export const SEASON_2_LOCAL_JOINS_KEY = '@runstr:season2_local_joins';

// Cache TTLs
export const SEASON_2_CACHE_TTL = {
  PARTICIPANTS: 5 * 60, // 5 minutes
  LEADERBOARD: 5 * 60, // 5 minutes
  CHARITY_RANKINGS: 5 * 60, // 5 minutes
};

/**
 * Get current season status based on date
 * In test mode: always returns 'active'
 */
export const getSeason2Status = (): Season2Status => {
  if (SEASON_2_TEST_MODE) {
    return 'active';
  }

  const now = Date.now();
  const startTime = new Date(SEASON_2_CONFIG.startDate).getTime();
  const endTime = new Date(SEASON_2_CONFIG.endDate).getTime();

  if (now < startTime) return 'upcoming';
  if (now > endTime) return 'ended';
  return 'active';
};

/**
 * Check if season is currently active
 */
export const isSeason2Active = (): boolean => {
  return getSeason2Status() === 'active';
};

/**
 * Get formatted date range for display
 * Uses UTC methods to avoid timezone issues
 */
export const getSeason2DateRange = (): string => {
  const start = new Date(SEASON_2_CONFIG.startDate);
  const end = new Date(SEASON_2_CONFIG.endDate);

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const formatDate = (d: Date) => {
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  };

  return `${formatDate(start)} - ${formatDate(end)}`;
};

/**
 * Get timestamp range for Nostr queries
 * In test mode: uses last 30 days
 * In production: uses Season 2 date range
 */
export const getSeason2Timestamps = (): { since: number; until: number } => {
  if (SEASON_2_TEST_MODE) {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
    console.log('[Season2] TEST MODE: Using last 30 days for workout queries');
    return { since: thirtyDaysAgo, until: now };
  }

  return {
    since: Math.floor(new Date(SEASON_2_CONFIG.startDate).getTime() / 1000),
    until: Math.floor(new Date(SEASON_2_CONFIG.endDate).getTime() / 1000),
  };
};

/**
 * Format prize amounts for display
 */
export const formatSats = (sats: number): string => {
  if (sats >= 1000000) {
    return `${(sats / 1000000).toFixed(1)}M sats`;
  }
  if (sats >= 1000) {
    return `${(sats / 1000).toFixed(0)}k sats`;
  }
  return `${sats} sats`;
};
