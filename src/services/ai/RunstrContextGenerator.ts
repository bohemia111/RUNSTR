import AsyncStorage from '@react-native-async-storage/async-storage';
import LocalWorkoutStorageService, {
  type LocalWorkout,
} from '../fitness/LocalWorkoutStorageService';
import FitnessTestService from '../fitness/FitnessTestService';
import type { FitnessTestResult } from '../../types/fitnessTest';

const CONTEXT_STORAGE_KEY = '@runstr:ai_context';
const CONTEXT_TIMESTAMP_KEY = '@runstr:ai_context_timestamp';
const CONVERSATION_MEMORY_KEY = '@runstr:ai_conversation_memory';
const MAX_MEMORY_ENTRIES = 10;

export interface ConversationMemory {
  timestamp: string;
  type: 'weekly' | 'trends' | 'tips';
  query: string;
  summary: string;
}

export class RunstrContextGenerator {
  /**
   * Generate complete RUNSTR.md context file
   */
  static async generateContext(): Promise<string> {
    const sections: string[] = [];

    // Header
    sections.push('# RUNSTR Context File');
    sections.push(`Last Updated: ${new Date().toISOString()}`);
    sections.push('');

    // Physical Profile
    const physicalProfile = await this.getPhysicalProfile();
    if (physicalProfile) {
      sections.push(physicalProfile);
    }

    // Goals & Habits
    const goalsHabits = await this.getGoalsAndHabits();
    if (goalsHabits) {
      sections.push(goalsHabits);
    }

    // Fitness Test Results
    const fitnessTests = await this.getFitnessTestResults();
    if (fitnessTests) {
      sections.push(fitnessTests);
    }

    // Recent Performance
    const recentPerformance = await this.getRecentPerformance();
    if (recentPerformance) {
      sections.push(recentPerformance);
    }

    // Workout Details
    const workoutDetails = await this.getWorkoutDetails();
    if (workoutDetails) {
      sections.push(workoutDetails);
    }

    // Diet & Wellness
    const dietWellness = await this.getDietAndWellness();
    if (dietWellness) {
      sections.push(dietWellness);
    }

    // Conversation Memory
    const memory = await this.getConversationMemory();
    if (memory) {
      sections.push(memory);
    }

    return sections.join('\n');
  }

  /**
   * Update stored context
   */
  static async updateContext(): Promise<void> {
    try {
      const context = await this.generateContext();
      await AsyncStorage.setItem(CONTEXT_STORAGE_KEY, context);
      await AsyncStorage.setItem(
        CONTEXT_TIMESTAMP_KEY,
        new Date().toISOString()
      );
    } catch (error) {
      console.error('Error updating RUNSTR context:', error);
    }
  }

  /**
   * Get stored context
   */
  static async getContext(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(CONTEXT_STORAGE_KEY);
    } catch (error) {
      console.error('Error retrieving RUNSTR context:', error);
      return null;
    }
  }

  /**
   * Append conversation to memory
   */
  static async appendMemory(
    type: 'weekly' | 'trends' | 'tips',
    query: string,
    response: string
  ): Promise<void> {
    try {
      // Get existing memory
      const memoryJson = await AsyncStorage.getItem(CONVERSATION_MEMORY_KEY);
      const memory: ConversationMemory[] = memoryJson
        ? JSON.parse(memoryJson)
        : [];

      // Create summary from response (first 150 chars)
      const summary = response
        .split('\n')
        .slice(0, 2)
        .join(' ')
        .substring(0, 150);

      // Add new entry
      memory.unshift({
        timestamp: new Date().toISOString(),
        type,
        query,
        summary,
      });

      // Keep only last MAX_MEMORY_ENTRIES
      const trimmedMemory = memory.slice(0, MAX_MEMORY_ENTRIES);

      // Save back
      await AsyncStorage.setItem(
        CONVERSATION_MEMORY_KEY,
        JSON.stringify(trimmedMemory)
      );

      // Update context file
      await this.updateContext();
    } catch (error) {
      console.error('Error appending conversation memory:', error);
    }
  }

  /**
   * Clear conversation memory
   */
  static async clearMemory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CONVERSATION_MEMORY_KEY);
      await this.updateContext();
    } catch (error) {
      console.error('Error clearing conversation memory:', error);
    }
  }

  // Private helper methods

  private static async getPhysicalProfile(): Promise<string | null> {
    try {
      // Try to get height/weight from AsyncStorage
      // Keys based on Settings screen implementation
      const heightFt = await AsyncStorage.getItem('@runstr:height_ft');
      const heightIn = await AsyncStorage.getItem('@runstr:height_in');
      const weight = await AsyncStorage.getItem('@runstr:weight');

      if (!heightFt && !weight) {
        return null;
      }

      const lines: string[] = ['## Physical Profile'];

      if (heightFt) {
        const ft = parseInt(heightFt);
        const inches = heightIn ? parseInt(heightIn) : 0;
        const totalInches = ft * 12 + inches;
        const cm = Math.round(totalInches * 2.54);
        lines.push(`- Height: ${ft}'${inches}" (${cm}cm)`);
      }

      if (weight) {
        const lbs = parseInt(weight);
        const kg = Math.round(lbs * 0.453592);
        lines.push(`- Weight: ${lbs} lbs (${kg}kg)`);
      }

      lines.push('');
      return lines.join('\n');
    } catch (error) {
      return null;
    }
  }

  private static async getGoalsAndHabits(): Promise<string | null> {
    try {
      // Try to get goals/habits from AsyncStorage
      // These would be stored by Goals & Habits feature
      const goalsJson = await AsyncStorage.getItem('@runstr:goals');
      const habitsJson = await AsyncStorage.getItem('@runstr:habits');

      if (!goalsJson && !habitsJson) {
        return null;
      }

      const lines: string[] = ['## Goals & Habits'];

      if (goalsJson) {
        const goals = JSON.parse(goalsJson);
        if (goals.primary) {
          lines.push(`Primary Goal: ${goals.primary}`);
        }
        if (goals.focus) {
          lines.push(`Training Focus: ${goals.focus}`);
        }
      }

      if (habitsJson) {
        const habits = JSON.parse(habitsJson);
        if (habits.routine) {
          lines.push(`Habits: ${habits.routine}`);
        }
      }

      lines.push('');
      return lines.join('\n');
    } catch (error) {
      return null;
    }
  }

  private static async getFitnessTestResults(): Promise<string | null> {
    try {
      const history = await FitnessTestService.getTestHistory();
      if (!history || history.length === 0) {
        return null;
      }

      const lines: string[] = ['## Fitness Test Results'];

      // Latest test
      const latest = history[0];
      const date = new Date(latest.timestamp).toISOString().split('T')[0];
      lines.push(
        `Latest (${date}): ${latest.compositeScore}/300 (${latest.grade})`
      );

      // Component breakdown
      const components: string[] = [];
      if (latest.pushups) {
        components.push(
          `Pushups: ${latest.pushups.reps} → ${latest.pushups.score}pts`
        );
      }
      if (latest.situps) {
        components.push(
          `Situps: ${latest.situps.reps} → ${latest.situps.score}pts`
        );
      }
      if (latest.run && latest.run.timeSeconds) {
        const runTime = this.formatDuration(latest.run.timeSeconds);
        components.push(`5K: ${runTime} → ${latest.run.score}pts`);
      }
      if (components.length > 0) {
        lines.push(`- ${components.join(' | ')}`);
      }

      // Personal best
      const pb = await FitnessTestService.getPersonalBest();
      if (pb && pb.compositeScore === latest.compositeScore) {
        lines.push('Personal Best: Yes!');
      } else if (pb) {
        lines.push(`Personal Best: ${pb.compositeScore}/300`);
      }

      // History (last 5 tests)
      if (history.length > 1) {
        const historyScores = history
          .slice(1, 6)
          .map((test) => {
            const testDate = new Date(test.timestamp);
            const month = testDate.toLocaleDateString('en-US', {
              month: 'short',
            });
            return `${test.compositeScore} (${month})`;
          })
          .join(', ');
        lines.push(`History: ${historyScores}`);
      }

      lines.push('');
      return lines.join('\n');
    } catch (error) {
      return null;
    }
  }

  private static async getRecentPerformance(): Promise<string | null> {
    try {
      const allWorkouts = await LocalWorkoutStorageService.getAllWorkouts();
      if (!allWorkouts || allWorkouts.length === 0) {
        return null;
      }

      // Filter last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentWorkouts = allWorkouts.filter((w) => {
        const workoutDate = new Date(w.startTime);
        return workoutDate >= thirtyDaysAgo;
      });

      if (recentWorkouts.length === 0) {
        return null;
      }

      const lines: string[] = ['## Recent Performance (Last 30 Days)'];

      // Calculate totals
      const totalDistance = recentWorkouts.reduce(
        (sum, w) => sum + (w.distance || 0),
        0
      );
      const totalDuration = recentWorkouts.reduce(
        (sum, w) => sum + (w.duration || 0),
        0
      );
      const totalCalories = recentWorkouts.reduce(
        (sum, w) => sum + (w.calories || 0),
        0
      );

      lines.push(
        `Total: ${recentWorkouts.length} workouts, ` +
          `${(totalDistance / 1000).toFixed(1)}km, ` +
          `${this.formatDuration(totalDuration)}`
      );

      // Breakdown by activity type
      const byType: { [key: string]: { count: number; distance: number } } = {};
      recentWorkouts.forEach((w) => {
        if (!byType[w.type]) {
          byType[w.type] = { count: 0, distance: 0 };
        }
        byType[w.type].count++;
        byType[w.type].distance += w.distance || 0;
      });

      Object.entries(byType).forEach(([type, stats]) => {
        const typeName = type.charAt(0).toUpperCase() + type.slice(1);
        if (stats.distance > 0) {
          lines.push(
            `- ${typeName}: ${stats.count} workouts (${(
              stats.distance / 1000
            ).toFixed(1)}km)`
          );
        } else {
          lines.push(`- ${typeName}: ${stats.count} sessions`);
        }
      });

      lines.push('');
      return lines.join('\n');
    } catch (error) {
      return null;
    }
  }

  private static async getWorkoutDetails(): Promise<string | null> {
    try {
      const allWorkouts = await LocalWorkoutStorageService.getAllWorkouts();
      if (!allWorkouts || allWorkouts.length === 0) {
        return null;
      }

      const lines: string[] = ['## Workout Details (Last 10)'];

      // Get last 10 workouts
      const recentWorkouts = allWorkouts.slice(0, 10);

      recentWorkouts.forEach((workout, index) => {
        const date = new Date(workout.startTime).toISOString().split('T')[0];
        const type =
          workout.type.charAt(0).toUpperCase() + workout.type.slice(1);

        let details = `${index + 1}. [${date}] ${type}`;

        if (workout.distance) {
          details += ` - ${(workout.distance / 1000).toFixed(2)}km`;
        }

        if (workout.duration) {
          details += `, ${this.formatDuration(workout.duration)}`;
        }

        if (workout.pace) {
          details += `, ${this.formatPace(workout.pace)}/km`;
        }

        if (workout.calories) {
          details += `, ${workout.calories} cal`;
        }

        // Strength training details
        if (workout.type === 'strength' && workout.repsBreakdown) {
          const repsStr = workout.repsBreakdown.join(',');
          const sets = workout.sets || workout.repsBreakdown.length;
          details += ` - ${
            workout.exerciseType || 'Exercise'
          } ${sets}x[${repsStr}]`;
        }

        lines.push(details);
      });

      lines.push('');
      return lines.join('\n');
    } catch (error) {
      return null;
    }
  }

  private static async getDietAndWellness(): Promise<string | null> {
    try {
      const allWorkouts = await LocalWorkoutStorageService.getAllWorkouts();
      if (!allWorkouts || allWorkouts.length === 0) {
        return null;
      }

      // Filter last 7 days for diet/wellness
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentWorkouts = allWorkouts.filter((w) => {
        const workoutDate = new Date(w.startTime);
        return workoutDate >= sevenDaysAgo;
      });

      const dietWorkouts = recentWorkouts.filter(
        (w) => w.type === 'diet' || w.type === 'fasting'
      );
      const meditationWorkouts = recentWorkouts.filter(
        (w) => w.type === 'meditation'
      );

      if (dietWorkouts.length === 0 && meditationWorkouts.length === 0) {
        return null;
      }

      const lines: string[] = ['## Diet & Wellness (Last 7 Days)'];

      if (dietWorkouts.length > 0) {
        const meals = dietWorkouts.filter((w) => w.type === 'diet');
        const fasting = dietWorkouts.filter((w) => w.type === 'fasting');

        if (meals.length > 0) {
          lines.push(`- Meals: ${meals.length} logged`);
        }

        if (fasting.length > 0) {
          const fastingDurations = fasting
            .map((w) => `${Math.round((w.fastingDuration || 0) / 3600)}h`)
            .join(', ');
          lines.push(
            `- Fasting: ${fasting.length} sessions (${fastingDurations})`
          );
        }
      }

      if (meditationWorkouts.length > 0) {
        const avgDuration =
          meditationWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0) /
          meditationWorkouts.length;
        lines.push(
          `- Meditation: ${
            meditationWorkouts.length
          } sessions (avg ${Math.round(avgDuration / 60)}min)`
        );
      }

      lines.push('');
      return lines.join('\n');
    } catch (error) {
      return null;
    }
  }

  private static async getConversationMemory(): Promise<string | null> {
    try {
      const memoryJson = await AsyncStorage.getItem(CONVERSATION_MEMORY_KEY);
      if (!memoryJson) {
        return null;
      }

      const memory: ConversationMemory[] = JSON.parse(memoryJson);
      if (memory.length === 0) {
        return null;
      }

      const lines: string[] = ['## Conversation Memory'];

      memory.forEach((entry) => {
        const date = new Date(entry.timestamp).toISOString().split('T')[0];
        const typeLabel =
          entry.type.charAt(0).toUpperCase() + entry.type.slice(1);
        lines.push(`[${date} | ${typeLabel}] ${entry.query}`);
        lines.push(`- ${entry.summary}`);
        lines.push('');
      });

      return lines.join('\n');
    } catch (error) {
      return null;
    }
  }

  // Utility methods

  private static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${secs}s`;
    }
  }

  private static formatPace(pace: number): string {
    // pace is in seconds per km
    const minutes = Math.floor(pace / 60);
    const seconds = Math.floor(pace % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}
