/**
 * Rewards Configuration
 * Settings for automated daily workout rewards
 */

export const REWARD_CONFIG = {
  /**
   * Sender NWC Connection String
   * This is the wallet that sends automated rewards to users
   * TESTING: Using coinos.io NWC for reward distribution
   */
  SENDER_NWC:
    process.env.REWARD_SENDER_NWC ||
    'nostr+walletconnect://72bdbc57bdd6dfc4e62685051de8041d148c3c68fe42bf301f71aa6cf53e52fb?relay=wss%3A%2F%2Frelay.coinos.io&secret=e827878f1a5b3ab0a65d47fc8301d78a5e3f586c6ab5b5f4f1fd565338c22aa4&lud16=RUNSTR@coinos.io',

  /**
   * Daily Workout Reward Amount
   * Amount in satoshis sent for first workout of the day
   */
  DAILY_WORKOUT_REWARD: 21,

  /**
   * Minimum Workout Distance for Reward
   * Distance in meters required to qualify for a reward
   */
  MIN_WORKOUT_DISTANCE_METERS: 1000, // 1km minimum

  /**
   * Maximum Rewards Per Day
   * How many times a user can earn rewards in one day
   */
  MAX_REWARDS_PER_DAY: 1,

  /**
   * Reward Eligibility
   * Minimum workout duration to qualify for reward (in seconds)
   */
  MIN_WORKOUT_DURATION: 60, // 1 minute minimum

  /**
   * Retry Configuration
   * If reward payment fails, how many times to retry
   */
  MAX_RETRY_ATTEMPTS: 0, // 0 = no retries (silent failure)
  RETRY_DELAY_MS: 0,
} as const;

/**
 * Storage keys for reward tracking
 */
export const REWARD_STORAGE_KEYS = {
  LAST_REWARD_DATE: '@runstr:last_reward_date',
  REWARD_COUNT_TODAY: '@runstr:reward_count_today',
  TOTAL_REWARDS_EARNED: '@runstr:total_rewards_earned',
} as const;
