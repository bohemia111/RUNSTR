/**
 * Running Challenge Presets
 * 4 challenge types for 1v1 running competitions (5K/10K/Half/Full Marathon)
 * Always running activity, always fastest_time scoring, always 1-day duration
 */

export type RunningChallengeDistance =
  | '5k'
  | '10k'
  | 'half-marathon'
  | 'marathon';

export interface RunningChallengePreset {
  id: RunningChallengeDistance;
  name: string;
  distance: number; // kilometers
  unit: string;
  description: string;
  activityType: 'running'; // Always running
  metric: 'fastest_time'; // Always fastest time
  durationHours: 24; // Always 24 hours (1 day)
}

export const RUNNING_CHALLENGE_PRESETS: RunningChallengePreset[] = [
  {
    id: '5k',
    name: '5K Sprint',
    distance: 5,
    unit: 'km',
    description: '5 kilometers - fastest time wins',
    activityType: 'running',
    metric: 'fastest_time',
    durationHours: 24,
  },
  {
    id: '10k',
    name: '10K Challenge',
    distance: 10,
    unit: 'km',
    description: '10 kilometers - fastest time wins',
    activityType: 'running',
    metric: 'fastest_time',
    durationHours: 24,
  },
  {
    id: 'half-marathon',
    name: 'Half Marathon',
    distance: 21.1,
    unit: 'km',
    description: '21.1 kilometers - fastest time wins',
    activityType: 'running',
    metric: 'fastest_time',
    durationHours: 24,
  },
  {
    id: 'marathon',
    name: 'Full Marathon',
    distance: 42.2,
    unit: 'km',
    description: '42.2 kilometers - fastest time wins',
    activityType: 'running',
    metric: 'fastest_time',
    durationHours: 24,
  },
];

// DEPRECATED: Duration options removed - challenges are now fixed to 1 day (24 hours)
export interface ChallengeDurationOption {
  value: '24h';
  label: string;
  hours: number;
}

export const CHALLENGE_DURATION_OPTIONS: ChallengeDurationOption[] = [
  { value: '24h', label: '24 Hours', hours: 24 },
];

/**
 * Get challenge preset by ID
 */
export function getRunningChallengePreset(
  id: RunningChallengeDistance
): RunningChallengePreset | undefined {
  return RUNNING_CHALLENGE_PRESETS.find((preset) => preset.id === id);
}

/**
 * Get display name for challenge distance
 */
export function getChallengeName(distance: RunningChallengeDistance): string {
  const preset = getRunningChallengePreset(distance);
  return preset?.name || distance;
}

/**
 * Get distance value in kilometers
 */
export function getChallengeDistance(
  distance: RunningChallengeDistance
): number {
  const preset = getRunningChallengePreset(distance);
  return preset?.distance || 0;
}
