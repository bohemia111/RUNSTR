/**
 * January Walking Contest Configuration
 *
 * A walking-only challenge for January 2026.
 * Top 3 participants with the longest walking distance win 1k sats each.
 * Only Season II participants are eligible for the reward.
 *
 * Production dates: January 1-31, 2026
 */

export interface JanuaryWalkingConfig {
  eventId: string;
  eventName: string;
  startDate: Date;
  endDate: Date;
  eligibleActivityTypes: string[];
  prizeAmountSats: number;
  prizeWinnerCount: number;
  aboutText: string;
  bannerImage: number;
}

export const JANUARY_WALKING_CONFIG: JanuaryWalkingConfig = {
  eventId: 'january-walking-2026',
  eventName: 'January Walking Contest',
  // Full month of January 2026
  startDate: new Date('2026-01-01T00:00:00Z'),
  endDate: new Date('2026-01-31T23:59:59Z'),
  eligibleActivityTypes: ['walking'],
  prizeAmountSats: 1000,
  prizeWinnerCount: 3,
  aboutText:
    'Top 3 with the longest walking distance in January will win. (Only Season Participants are eligible for the reward)',
  bannerImage: require('../../assets/images/january-walking/banner.png'),
};

// AsyncStorage key for tracking local joins
export const JANUARY_WALKING_JOINED_KEY = '@runstr:january_walking_joined';

/**
 * Check if the January Walking Contest is currently active
 */
export function isJanuaryWalkingActive(): boolean {
  const now = new Date();
  return (
    now >= JANUARY_WALKING_CONFIG.startDate &&
    now <= JANUARY_WALKING_CONFIG.endDate
  );
}

/**
 * Get the current status of the January Walking Contest
 */
export function getJanuaryWalkingStatus(): 'upcoming' | 'active' | 'ended' {
  const now = new Date();

  if (now < JANUARY_WALKING_CONFIG.startDate) {
    return 'upcoming';
  }

  if (now > JANUARY_WALKING_CONFIG.endDate) {
    return 'ended';
  }

  return 'active';
}

/**
 * Get Unix timestamp for start date (for Nostr queries)
 */
export function getJanuaryWalkingStartTimestamp(): number {
  return Math.floor(JANUARY_WALKING_CONFIG.startDate.getTime() / 1000);
}

/**
 * Get Unix timestamp for end date (for Nostr queries)
 */
export function getJanuaryWalkingEndTimestamp(): number {
  return Math.floor(JANUARY_WALKING_CONFIG.endDate.getTime() / 1000);
}

/**
 * Get days remaining until contest ends
 */
export function getDaysRemaining(): number {
  const now = new Date();
  const end = JANUARY_WALKING_CONFIG.endDate;

  if (now >= end) {
    return 0;
  }

  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get days until contest starts
 */
export function getDaysUntilStart(): number {
  const now = new Date();
  const start = JANUARY_WALKING_CONFIG.startDate;

  if (now >= start) {
    return 0;
  }

  const diffMs = start.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
