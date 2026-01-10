/**
 * Running Bitcoin Challenge Configuration
 *
 * A featured event honoring Hal Finney (Bitcoin pioneer and ALS patient).
 * Participants work toward a 21km goal (running + walking).
 * All users who complete the challenge earn 1,000 sats (auto-paid on share).
 *
 * Production dates: January 10-31, 2026
 */

// Demo mode flag - set to true for testing with December 2025 data
export const RUNNING_BITCOIN_DEMO_MODE = false;

// Demo dates (Dec 2025 - Jan 2026 for testing during development)
const DEMO_START = new Date('2025-12-01T00:00:00Z');
const DEMO_END = new Date('2026-01-31T23:59:59Z');

// Production dates (January 10-31, 2026)
const PROD_START = new Date('2026-01-10T00:00:00Z');
const PROD_END = new Date('2026-01-31T23:59:59Z');

export interface RunningBitcoinConfig {
  eventId: string;
  eventName: string;
  startDate: Date;
  endDate: Date;
  goalDistanceKm: number;
  finisherRewardSats: number;
  charityId: string;
  charityLightningAddress: string;
  donateUrl: string;
  eligibleActivityTypes: string[];
  bannerImage: number;
  avatarImage: number;
  completionImage: number; // Image for share completion posts
}

export const RUNNING_BITCOIN_CONFIG: RunningBitcoinConfig = {
  eventId: 'running-bitcoin-2026',
  eventName: 'Running Bitcoin Challenge',
  // Use demo dates when demo mode is enabled, production dates otherwise
  startDate: RUNNING_BITCOIN_DEMO_MODE ? DEMO_START : PROD_START,
  endDate: RUNNING_BITCOIN_DEMO_MODE ? DEMO_END : PROD_END,
  goalDistanceKm: 21,
  finisherRewardSats: 1000,
  charityId: 'als-foundation',
  charityLightningAddress: 'RunningBTC@primal.net',
  donateUrl: 'https://secure.alsnetwork.org/site/TR?fr_id=1510&pg=entry',
  eligibleActivityTypes: ['running', 'walking'],
  bannerImage: require('../../assets/images/running-bitcoin/banner.png'),
  avatarImage: require('../../assets/images/running-bitcoin/avatar.jpg'),
  completionImage: require('../../assets/images/running-bitcoin/completion.jpg'),
};

/**
 * Check if the Running Bitcoin Challenge is currently active
 */
export function isRunningBitcoinActive(): boolean {
  const now = new Date();
  return now >= RUNNING_BITCOIN_CONFIG.startDate && now <= RUNNING_BITCOIN_CONFIG.endDate;
}

/**
 * Get the current status of the Running Bitcoin Challenge
 */
export function getRunningBitcoinStatus(): 'upcoming' | 'active' | 'ended' {
  const now = new Date();

  if (now < RUNNING_BITCOIN_CONFIG.startDate) {
    return 'upcoming';
  }

  if (now > RUNNING_BITCOIN_CONFIG.endDate) {
    return 'ended';
  }

  return 'active';
}

/**
 * Get Unix timestamp for start date (for Nostr queries)
 */
export function getRunningBitcoinStartTimestamp(): number {
  return Math.floor(RUNNING_BITCOIN_CONFIG.startDate.getTime() / 1000);
}

/**
 * Get Unix timestamp for end date (for Nostr queries)
 */
export function getRunningBitcoinEndTimestamp(): number {
  return Math.floor(RUNNING_BITCOIN_CONFIG.endDate.getTime() / 1000);
}

/**
 * Check if an activity type is eligible for the challenge
 */
export function isEligibleActivityType(activityType: string): boolean {
  return RUNNING_BITCOIN_CONFIG.eligibleActivityTypes.includes(
    activityType.toLowerCase()
  );
}

/**
 * Get days remaining until challenge ends
 */
export function getDaysRemaining(): number {
  const now = new Date();
  const end = RUNNING_BITCOIN_CONFIG.endDate;

  if (now >= end) {
    return 0;
  }

  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get days since challenge started
 */
export function getDaysSinceStart(): number {
  const now = new Date();
  const start = RUNNING_BITCOIN_CONFIG.startDate;

  if (now < start) {
    return 0;
  }

  const diffMs = now.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
