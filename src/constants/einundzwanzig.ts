/**
 * Einundzwanzig Fitness Challenge Configuration
 *
 * A team-based charity fundraiser for the Einundzwanzig community
 * (German-speaking Bitcoin community). Participants select a charity
 * and their running/walking distance contributes to that charity's total.
 *
 * Einundzwanzig donates sats proportional to total distance.
 *
 * Production dates: January 21 - February 21, 2025
 */

export interface EinundzwanzigConfig {
  eventId: string;
  eventName: string;
  startDate: Date;
  endDate: Date;
  eligibleActivityTypes: string[];
  satsPerKm: number;
  description: string;
  website: string;
  bannerImage: number;
}

export const EINUNDZWANZIG_CONFIG: EinundzwanzigConfig = {
  eventId: 'einundzwanzig-2026',
  eventName: 'Einundzwanzig Fitness Challenge',
  // Production dates: January 21 - February 21, 2026 (1 month)
  startDate: new Date('2026-01-21T00:00:00Z'),
  endDate: new Date('2026-02-21T23:59:59Z'),
  eligibleActivityTypes: ['running', 'walking'],
  satsPerKm: 1000, // 1 km = 1,000 sats donated
  description:
    'Run or walk for charity! Every kilometer you cover earns 1,000 sats for your selected charity. Join the Einundzwanzig community in supporting Bitcoin circular economies worldwide.',
  website: 'https://einundzwanzig.space',
  bannerImage: require('../../assets/images/einundzwanzig/banner.png'),
};

/**
 * Check if the Einundzwanzig Challenge is currently active
 */
export function isEinundzwanzigActive(): boolean {
  const now = new Date();
  return (
    now >= EINUNDZWANZIG_CONFIG.startDate &&
    now <= EINUNDZWANZIG_CONFIG.endDate
  );
}

/**
 * Get the current status of the Einundzwanzig Challenge
 */
export function getEinundzwanzigStatus(): 'upcoming' | 'active' | 'ended' {
  const now = new Date();

  if (now < EINUNDZWANZIG_CONFIG.startDate) {
    return 'upcoming';
  }

  if (now > EINUNDZWANZIG_CONFIG.endDate) {
    return 'ended';
  }

  return 'active';
}

/**
 * Get Unix timestamp for start date (for Nostr queries)
 */
export function getEinundzwanzigStartTimestamp(): number {
  return Math.floor(EINUNDZWANZIG_CONFIG.startDate.getTime() / 1000);
}

/**
 * Get Unix timestamp for end date (for Nostr queries)
 */
export function getEinundzwanzigEndTimestamp(): number {
  return Math.floor(EINUNDZWANZIG_CONFIG.endDate.getTime() / 1000);
}

/**
 * Check if an activity type is eligible for the challenge
 */
export function isEligibleActivityType(activityType: string): boolean {
  return EINUNDZWANZIG_CONFIG.eligibleActivityTypes.includes(
    activityType.toLowerCase()
  );
}

/**
 * Get days remaining until challenge ends
 */
export function getDaysRemaining(): number {
  const now = new Date();
  const end = EINUNDZWANZIG_CONFIG.endDate;

  if (now >= end) {
    return 0;
  }

  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get days until challenge starts
 */
export function getDaysUntilStart(): number {
  const now = new Date();
  const start = EINUNDZWANZIG_CONFIG.startDate;

  if (now >= start) {
    return 0;
  }

  const diffMs = start.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get days since challenge started
 */
export function getDaysSinceStart(): number {
  const now = new Date();
  const start = EINUNDZWANZIG_CONFIG.startDate;

  if (now < start) {
    return 0;
  }

  const diffMs = now.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate estimated sats from total distance
 */
export function calculateSatsFromDistance(distanceKm: number): number {
  return Math.floor(distanceKm * EINUNDZWANZIG_CONFIG.satsPerKm);
}
