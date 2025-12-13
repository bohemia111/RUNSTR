/**
 * CoachClaudeService - AI-Powered Fitness Coach using PPQ.AI
 *
 * Provides workout analysis using PPQ.AI's API (OpenAI-compatible).
 * Fast, reliable, and powered by anonymous Bitcoin payments.
 *
 * Enhanced with RUNSTR.md context file for comprehensive coaching.
 * API: https://api.ppq.ai/chat/completions
 * Model: User-selectable (default: claude-haiku-4.5)
 */

import type { LocalWorkout } from '../fitness/LocalWorkoutStorageService';
import { RunstrContextGenerator } from './RunstrContextGenerator';
import { ModelManager } from './ModelManager';

// In-memory cache for recent analyses
const ANALYSIS_CACHE = new Map<
  string,
  { analysis: string; timestamp: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export type PromptType = 'weekly' | 'trends' | 'tips';

export interface CoachInsight {
  type: PromptType;
  bullets: string[];
  generatedAt: number;
}

/**
 * Format workout data for Claude context
 */
function formatWorkoutsForContext(workouts: LocalWorkout[]): string {
  // Sort by date (newest first) and limit to last 20 workouts for cost efficiency
  const sortedWorkouts = [...workouts]
    .sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    )
    .slice(0, 20);

  const formatted = sortedWorkouts.map((w) => {
    const distance = w.distance
      ? `${(w.distance / 1000).toFixed(2)}km`
      : undefined;
    // Format duration differently for daily step accumulations vs actual workouts
    const duration = w.duration
      ? w.source === 'daily_steps'
        ? `${(w.duration / 3600).toFixed(1)}h (daily step accumulation)`
        : `${Math.round(w.duration / 60)}min`
      : undefined;
    const pace = w.pace ? `${formatPace(w.pace)}/km` : undefined;

    return {
      date: w.startTime.split('T')[0],
      type: w.type || 'unknown',
      source: w.source || 'unknown', // Include data source for AI context
      isStepAccumulation: w.source === 'daily_steps', // Flag for daily step data
      distance,
      duration,
      pace,
      calories: w.calories || undefined,
      steps: w.steps || undefined, // Include step count if available
    };
  });

  return JSON.stringify(formatted, null, 2);
}

/**
 * Format pace in seconds/km to MM:SS format
 */
function formatPace(paceSecondsPerKm: number): string {
  const minutes = Math.floor(paceSecondsPerKm / 60);
  const seconds = Math.round(paceSecondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get system prompt for each insight type
 */
async function getSystemPrompt(type: PromptType): Promise<string> {
  const basePrompt = `You are Coach RUNSTR, a professional fitness coach analyzing workout data. Provide insights in exactly 3 bullet points. Be specific with numbers and dates. Keep each bullet point concise (1-2 sentences max).

IMPORTANT DATA CONTEXT:
- Each workout has a "source" field indicating how it was recorded:
  - "gps_tracker": Real-time GPS-tracked workout (accurate duration/distance)
  - "manual_entry": User manually logged the workout
  - "daily_steps": Daily step count ACCUMULATION - NOT a single workout session. Duration represents time since midnight, not actual walking time. Treat these as daily activity totals.
  - "healthkit" or "health_connect": Imported from Apple Health or Google Health
  - "imported_nostr": Imported from Nostr network
- When "isStepAccumulation" is true, do NOT report the duration as a workout session length. Instead, focus on the step count.
- Only reference actual workout durations for gps_tracker, manual_entry, and healthkit sources.`;

  // Load RUNSTR.md context file
  let contextFile = await RunstrContextGenerator.getContext();

  // If no context file exists, generate one
  if (!contextFile) {
    await RunstrContextGenerator.updateContext();
    contextFile = await RunstrContextGenerator.getContext();
  }

  // Build full prompt with context
  const contextSection = contextFile
    ? `\n\n## User Context\n${contextFile}\n\n`
    : '\n\n';

  switch (type) {
    case 'weekly':
      return `${basePrompt}${contextSection}Analyze the last 7 days of workouts. Provide exactly 3 bullet points covering:
1. Total distance/time and workout frequency
2. Average pace or notable performance metrics
3. One specific achievement, observation, or nutrition insight

When analyzing workouts, also consider any diet data provided. If meal descriptions are available, provide refined calorie estimates based on the actual foods described (not just portion sizes). Note any nutritional patterns that could affect fitness performance.

Format each point starting with •`;

    case 'trends':
      return `${basePrompt}${contextSection}Analyze all-time workout history. Provide exactly 3 bullet points identifying:
1. Long-term improvement trends
2. Consistency patterns
3. One area showing progress or needing attention

Format each point starting with •`;

    case 'tips':
      return `${basePrompt}${contextSection}Based on all workout data, provide exactly 3 actionable training tips:
1. One tip for recovery or rest
2. One tip for progression or improvement
3. One tip for nutrition or variety/cross-training

If diet data is available with meal descriptions, include nutrition-focused advice. When meal descriptions are provided, suggest calorie adjustments if the current estimates seem off based on the foods described.

Format each point starting with •`;
  }
}

/**
 * Parse Claude response into bullet points
 */
function parseBullets(response: string): string[] {
  // Split by bullet point markers
  const bulletRegex = /^[\s]*[•\-\*\d\.]+[\s]*(.*?)$/gm;
  const matches = Array.from(response.matchAll(bulletRegex));

  if (matches.length >= 3) {
    return matches.slice(0, 3).map((m) => m[1].trim());
  }

  // Fallback: split by newlines
  const lines = response
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return lines.slice(0, 3);
}

/**
 * Generate cache key for workout analysis
 */
function getCacheKey(type: PromptType, workouts: LocalWorkout[]): string {
  const workoutHashes = workouts
    .slice(0, 5) // Use first 5 workouts for cache key
    .map((w) => `${w.startTime}${w.distance}${w.duration}`)
    .join('|');
  return `${type}:${workoutHashes}`;
}

/**
 * Coach Claude Service
 */
class CoachClaudeService {
  private apiKey: string | null = null;

  /**
   * Initialize the service with API key
   */
  initialize(apiKey: string) {
    this.apiKey = apiKey;
    console.log('[CoachClaude] Service initialized with PPQ.AI');
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.apiKey !== null;
  }

  /**
   * Generate AI-powered insight
   */
  async generateInsight(
    type: PromptType,
    workouts: LocalWorkout[],
    options?: { useCache?: boolean }
  ): Promise<CoachInsight> {
    if (!this.apiKey) {
      throw new Error(
        'CoachClaude not initialized. Call initialize() with API key first.'
      );
    }

    const useCache = options?.useCache !== false;

    // Check cache first
    if (useCache) {
      const cacheKey = getCacheKey(type, workouts);
      const cached = ANALYSIS_CACHE.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[CoachClaude] Using cached ${type} insight`);
        const bullets = parseBullets(cached.analysis);
        return {
          type,
          bullets: bullets.slice(0, 3),
          generatedAt: cached.timestamp,
        };
      }
    }

    try {
      console.log(`[CoachClaude] Generating ${type} insight via PPQ.AI...`);

      // Format workout data
      const workoutContext = formatWorkoutsForContext(workouts);
      const systemPrompt = await getSystemPrompt(type);

      // Get user-selected model
      const selectedModel = await ModelManager.getSelectedModel();
      console.log(`[CoachClaude] Using model: ${selectedModel}`);

      // Call PPQ.AI API (OpenAI-compatible)
      const response = await fetch('https://api.ppq.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 200,
          temperature: 0.7,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: `Here is my workout history:\n\n${workoutContext}\n\nProvide 3 specific insights.`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PPQ.AI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const responseText = data.choices?.[0]?.message?.content || '';

      console.log(`[CoachClaude] Generation complete, response:`, responseText);

      // Parse response into bullets
      const bullets = parseBullets(responseText);

      // Ensure we have exactly 3 bullets
      while (bullets.length < 3) {
        bullets.push('Continue your great work!');
      }

      const insight: CoachInsight = {
        type,
        bullets: bullets.slice(0, 3),
        generatedAt: Date.now(),
      };

      // Cache the result
      if (useCache) {
        const cacheKey = getCacheKey(type, workouts);
        ANALYSIS_CACHE.set(cacheKey, {
          analysis: responseText,
          timestamp: Date.now(),
        });
      }

      // Update conversation memory
      await RunstrContextGenerator.appendMemory(
        type,
        `Get ${type} insights`,
        responseText
      );

      console.log(`[CoachClaude] Generated ${type} insight successfully`);
      return insight;
    } catch (error) {
      console.error(`[CoachClaude] Failed to generate ${type} insight:`, error);

      if (error instanceof Error) {
        // Handle specific PPQ.AI API errors
        if (error.message.includes('401') || error.message.includes('403')) {
          throw new Error(
            'Invalid API key. Please check your PPQ.AI API key in Settings.'
          );
        } else if (error.message.includes('429')) {
          throw new Error('Rate limit exceeded. Please try again in a moment.');
        } else if (error.message.includes('402')) {
          throw new Error(
            'Insufficient credits. Please add more Bitcoin to your PPQ.AI account.'
          );
        }
      }

      throw error;
    }
  }

  /**
   * Clear analysis cache
   */
  clearCache() {
    ANALYSIS_CACHE.clear();
    console.log('[CoachClaude] Cache cleared');
  }
}

// Export singleton instance
export const coachClaude = new CoachClaudeService();
