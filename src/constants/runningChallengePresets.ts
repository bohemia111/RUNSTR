/**
 * Running Challenge Presets
 * 3 challenge types for 1v1 running competitions (5K/10K/Half Marathon)
 * Always running activity, always fastest_time scoring
 */

export type RunningChallengeDistance = '5k' | '10k' | 'half-marathon';

export interface RunningChallengePreset {
  id: RunningChallengeDistance;
  name: string;
  distance: number; // kilometers
  unit: string;
  description: string;
  activityType: 'running'; // Always running
  metric: 'fastest_time'; // Always fastest time
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
  },
  {
    id: '10k',
    name: '10K Challenge',
    distance: 10,
    unit: 'km',
    description: '10 kilometers - fastest time wins',
    activityType: 'running',
    metric: 'fastest_time',
  },
  {
    id: 'half-marathon',
    name: 'Half Marathon',
    distance: 21.1,
    unit: 'km',
    description: '21.1 kilometers - fastest time wins',
    activityType: 'running',
    metric: 'fastest_time',
  },
];

export interface ChallengeDurationOption {
  value: '24h' | '48h' | '1week';
  label: string;
  hours: number;
}

export const CHALLENGE_DURATION_OPTIONS: ChallengeDurationOption[] = [
  { value: '24h', label: '24 Hours', hours: 24 },
  { value: '48h', label: '48 Hours', hours: 48 },
  { value: '1week', label: '1 Week', hours: 168 },
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
export function getChallengeDistance(distance: RunningChallengeDistance): number {
  const preset = getRunningChallengePreset(distance);
  return preset?.distance || 0;
}
