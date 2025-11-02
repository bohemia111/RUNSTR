/**
 * TypeScript types for RUNSTR Fitness Test
 *
 * The RUNSTR Test is a standardized fitness assessment with three components:
 * - Pushups (2 minutes max reps)
 * - Situps (2 minutes max reps)
 * - 5K Run (timed)
 *
 * Users complete all three within 60 minutes for a composite score (0-300).
 */

export interface FitnessTestComponent {
  reps?: number; // For pushups/situps
  timeSeconds?: number; // For 5K run
  score: number; // 0-100 points per component
  workoutId?: string; // Reference to local workout
}

export interface FitnessTestResult {
  id: string; // Unique test ID
  timestamp: number; // When test was completed
  testDuration: number; // How long test took in seconds (up to 3600)

  // Component scores
  pushups: FitnessTestComponent | null;
  situps: FitnessTestComponent | null;
  run: FitnessTestComponent | null;

  // Overall score
  compositeScore: number; // Sum of component scores (0-300)
  grade: 'Elite' | 'Advanced' | 'Intermediate' | 'Beginner' | 'Baseline';

  // Publishing status
  publishedToNostr: boolean;
  kind1301EventId?: string; // Nostr event ID if published as kind 1301
  kind1EventId?: string; // Nostr event ID if shared as kind 1
}

export interface ActiveFitnessTest {
  id: string;
  startTime: number; // Timestamp when test started
  status: 'active';
}

export interface FitnessTestGrade {
  name: 'Elite' | 'Advanced' | 'Intermediate' | 'Beginner' | 'Baseline';
  emoji: string;
  minScore: number;
  maxScore: number;
}

export const FITNESS_TEST_GRADES: FitnessTestGrade[] = [
  { name: 'Elite', emoji: '🏆', minScore: 270, maxScore: 300 },
  { name: 'Advanced', emoji: '💪', minScore: 240, maxScore: 269 },
  { name: 'Intermediate', emoji: '⚡', minScore: 210, maxScore: 239 },
  { name: 'Beginner', emoji: '📈', minScore: 180, maxScore: 209 },
  { name: 'Baseline', emoji: '🎯', minScore: 0, maxScore: 179 },
];
