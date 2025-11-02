/**
 * Garmin API Type Definitions
 * Based on Garmin Health API v1.2.3 Activity API documentation
 */

/**
 * Garmin Activity Summary from Activity API
 * See: https://developer.garmin.com/health-api/activity-api/
 */
export interface GarminActivity {
  summaryId: string; // Unique identifier for the summary
  activityId: string; // Unique identifier of the activity at Garmin Connect
  activityType: string; // Text description (e.g., "RUNNING", "CYCLING")
  activityName?: string; // User-given name for activity
  startTimeInSeconds: number; // Unix timestamp (seconds since Jan 1, 1970 UTC)
  startTimeOffsetInSeconds: number; // Offset to derive local time
  durationInSeconds: number; // Length of activity in seconds
  distanceInMeters?: number; // Total distance covered
  activeKilocalories?: number; // Active calories burned (dietary calories)
  deviceName?: string; // Device that recorded activity (e.g., "Garmin Fenix 8")

  // Speed/Pace metrics
  averageSpeedInMetersPerSecond?: number;
  maxSpeedInMetersPerSecond?: number;
  averagePaceInMinutesPerKilometer?: number;
  maxPaceInMinutesPerMinute?: number;

  // Heart rate metrics
  averageHeartRateInBeatsPerMinute?: number;
  maxHeartRateInBeatsPerMinute?: number;

  // Activity-specific metrics
  averageBikeCadenceInRoundsPerMinute?: number; // Cycling
  maxBikeCadenceInRoundsPerMinute?: number; // Cycling
  averageRunCadenceInStepsPerMinute?: number; // Running
  maxRunCadenceInStepsPerMinute?: number; // Running
  averageSwimCadenceInStrokesPerMinute?: number; // Swimming
  numberOfActiveLengths?: number; // Swimming

  // Wheelchair mode (if enabled)
  pushes?: number;
  averagePushCadenceInPushesPerMinute?: number;
  maxPushCadenceInPushesPerMinute?: number;

  // GPS and elevation
  startingLatitudeInDegree?: number;
  startingLongitudeInDegree?: number;
  totalElevationGainInMeters?: number;
  totalElevationLossInMeters?: number;

  // Activity metadata
  steps?: number; // For walking/running activities
  isParent?: boolean; // True if parent of multi-sport activity
  parentSummaryId?: string; // ID of parent activity if this is a child
  manual?: boolean; // True if manually created (not from device)
  isWebUpload?: boolean; // True if uploaded via web
}

/**
 * Garmin Activity API Response (list of activities)
 */
export interface GarminActivitiesResponse {
  activities?: GarminActivity[];
}

/**
 * Garmin OAuth Token Response (OAuth 2.0 PKCE)
 * Returned after successful OAuth code exchange
 */
export interface GarminAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number; // Seconds until access token expires (typically 3 months)
  refresh_token_expires_in?: number; // Seconds until refresh token expires (optional)
  token_type: 'Bearer';
}

/**
 * Garmin Sync Result
 * Similar to HealthKitSyncResult
 */
export interface GarminSyncResult {
  success: boolean;
  workoutsCount?: number; // Total workouts fetched
  newWorkouts?: number; // New workouts added to storage
  skippedWorkouts?: number; // Workouts already in storage
  error?: string; // Error message if sync failed
}

/**
 * Garmin Service Status
 */
export interface GarminServiceStatus {
  available: boolean; // Service initialized
  authenticated: boolean; // User has valid tokens
  syncInProgress: boolean; // Sync currently running
  lastSyncAt?: string; // ISO timestamp of last sync
}

/**
 * Garmin Activity Type Mapping
 * Maps Garmin activity types to RUNSTR workout types
 * Based on Appendix A in Garmin Activity API docs
 */
export const GARMIN_ACTIVITY_TYPE_MAP: Record<string, string> = {
  // Running activities
  RUNNING: 'running',
  INDOOR_RUNNING: 'running',
  STREET_RUNNING: 'running',
  TRACK_RUNNING: 'running',
  TRAIL_RUNNING: 'running',
  TREADMILL_RUNNING: 'running',
  ULTRA_RUN: 'running',
  VIRTUAL_RUN: 'running',
  OBSTACLE_RUN: 'running',

  // Walking activities
  WALKING: 'walking',
  CASUAL_WALKING: 'walking',
  SPEED_WALKING: 'walking',

  // Hiking
  HIKING: 'hiking',
  RUCKING: 'hiking',

  // Cycling activities
  CYCLING: 'cycling',
  BMX: 'cycling',
  CYCLOCROSS: 'cycling',
  DOWNHILL_BIKING: 'cycling',
  E_BIKE_FITNESS: 'cycling',
  E_BIKE_MOUNTAIN: 'cycling',
  E_ENDURO_MTB: 'cycling',
  ENDURO_MTB: 'cycling',
  GRAVEL_CYCLING: 'cycling',
  INDOOR_CYCLING: 'cycling',
  MOUNTAIN_BIKING: 'cycling',
  RECUMBENT_CYCLING: 'cycling',
  ROAD_BIKING: 'cycling',
  TRACK_CYCLING: 'cycling',
  VIRTUAL_RIDE: 'cycling',

  // Gym & Fitness
  FITNESS_EQUIPMENT: 'gym',
  CARDIO: 'gym',
  HIIT: 'gym',
  ELLIPTICAL: 'gym',
  STAIR_CLIMBING: 'gym',
  INDOOR_ROWING: 'gym',

  // Strength training
  STRENGTH_TRAINING: 'strength_training',

  // Yoga
  YOGA: 'yoga',
  PILATES: 'yoga',

  // Meditation
  MEDITATION: 'meditation',

  // Swimming
  SWIMMING: 'other', // Could add 'swimming' type to RUNSTR
  LAP_SWIMMING: 'other',
  OPEN_WATER_SWIMMING: 'other',

  // Winter sports
  WINTER_SPORTS: 'other',
  BACKCOUNTRY_SKIING: 'other',
  CROSS_COUNTRY_SKIING_WS: 'other',
  RESORT_SKIING: 'other',
  SNOWBOARDING_WS: 'other',
  SKATING_WS: 'other',
  SNOW_SHOE_WS: 'other',

  // Water sports
  WATER_SPORTS: 'other',
  BOATING: 'other',
  KAYAKING: 'other',
  ROWING_V2: 'other',
  SAILING_V2: 'other',
  SURFING_V2: 'other',

  // Team sports
  TEAM_SPORTS: 'other',
  AMERICAN_FOOTBALL: 'other',
  BASEBALL: 'other',
  BASKETBALL: 'other',
  CRICKET: 'other',
  SOCCER: 'other',
  VOLLEYBALL: 'other',

  // Racket sports
  RACKET_SPORTS: 'other',
  TENNIS: 'other',
  BADMINTON: 'other',
  PICKLEBALL: 'other',
  TABLE_TENNIS: 'other',

  // Other activities
  ROCK_CLIMBING: 'other',
  INDOOR_CLIMBING: 'other',
  GOLF: 'other',
  DANCE: 'other',
  BOXING: 'other',
  MIXED_MARTIAL_ARTS: 'other',
  JUMP_ROPE: 'other',

  // Wheelchair activities
  WHEELCHAIR_PUSH_RUN: 'running',
  WHEELCHAIR_PUSH_WALK: 'walking',

  // Default fallback
  OTHER: 'other',
};

/**
 * Garmin API Endpoints (OAuth 2.0 PKCE + Health API)
 * Reference: OAuth2PKCE_1.pdf specification from Garmin Developer Portal
 */
export const GARMIN_ENDPOINTS = {
  // OAuth 2.0 PKCE endpoints (correct as of 2024)
  OAUTH_AUTHORIZE: 'https://apis.garmin.com/tools/oauth2/authorizeUser',
  OAUTH_TOKEN: 'https://diauth.garmin.com/di-oauth2-service/oauth/token',
  // Health API endpoints
  ACTIVITIES: 'https://apis.garmin.com/wellness-api/rest/activities',
  ACTIVITY_DETAILS: 'https://apis.garmin.com/wellness-api/rest/activityDetails',
} as const;

/**
 * Garmin OAuth Configuration
 */
export interface GarminOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}
