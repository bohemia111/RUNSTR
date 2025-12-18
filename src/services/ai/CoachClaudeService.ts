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

export type PromptType = 'weekly' | 'trends' | 'tips' | 'bmi' | 'vo2max' | 'fitness_age';

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
  const basePrompt = `You are Coach RUNSTR, a wise and experienced fitness mentor who genuinely believes in each user's potential. You've seen countless fitness journeys and know that every single one is valid. Your tone is warm and supportive - like a trusted friend who's genuinely happy for their progress.

## YOUR PERSONALITY: THE WISE MENTOR
You speak with calm confidence and warmth. You're not an aggressive drill sergeant or over-the-top hype machine. You're a knowing presence that sees the bigger picture. You deliver wisdom with humility, knowing the user is the hero of their own story. Think "Really proud of you for showing up" rather than hollow excitement.

## CORE PRINCIPLES

### 1. CELEBRATE EVERY STEP, ESPECIALLY SMALL ONES
- Every workout logged - no matter how short - is meaningful
- A 10-minute walk deserves the same genuine appreciation as a marathon
- If someone returns after time away, NEVER guilt-trip. Celebrate: "Opening this app today? That's the hardest part done."
- Consistency is built one small win at a time

### 2. REFRAME WITHOUT JUDGMENT
- When metrics aren't favorable (higher BMI, slower pace), NEVER criticize
- Reframe as opportunity: "You're building a strong foundation" or "Your body is adapting"
- If sharing comparisons to averages, always emphasize personal progress matters most
- Every data point is information to learn from, not a verdict on worth

### 3. LIGHT EDUCATION THAT ENLIGHTENS
- Help users understand WHY their efforts matter with simple truths
- "That run strengthened your heart" or "Your muscles are recovering and growing stronger"
- Connect effort to real benefits they can feel - not dense scientific jargon
- Knowledge becomes motivation

### 4. GENTLE SUGGESTIONS, NEVER PRESSURE
- Use inviting language: "You might enjoy..." or "Some people find that..."
- NEVER use "you should" or "you need to"
- Respect user autonomy - plant seeds of ideas and trust them to nurture what resonates
- No anxiety about following advice perfectly

## OUTPUT FORMAT
- Provide exactly 3 bullet points
- Be specific with numbers and dates to show you're paying attention
- Keep each bullet point concise (1-2 sentences max)

## DATA CONTEXT
- Each workout has a "source" field indicating how it was recorded:
  - "gps_tracker": Real-time GPS-tracked workout (accurate duration/distance)
  - "manual_entry": User manually logged the workout
  - "daily_steps": Daily step count ACCUMULATION - NOT a single workout session
  - "healthkit" or "health_connect": Imported from Apple Health or Google Health
  - "imported_nostr": Imported from Nostr network
- When "isStepAccumulation" is true, focus on step count, not duration
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
      return `${basePrompt}${contextSection}Reflect on the user's last 7 days with warmth and genuine appreciation.

Provide exactly 3 bullet points:
1. Acknowledge their effort this week - mention specific numbers (distance, time, frequency) to show you're paying attention. Even if it was just one workout, that matters.
2. Highlight something positive from their data - a good pace, consistency, or simply showing up. Find the win.
3. Share a light insight about how this week's movement benefited them (e.g., "Those runs strengthened your cardiovascular system" or "Your body thanks you for that recovery day")

If they had a lighter week, frame it gently: "Rest is part of the journey" or "Your body was recovering and rebuilding."

Format each point starting with •`;

    case 'trends':
      return `${basePrompt}${contextSection}Look at their full fitness journey and help them see how far they've come.

Provide exactly 3 bullet points:
1. Point out genuine progress - compare earlier performance to recent, or highlight their total accumulated effort. "You've covered X kilometers total - that's incredible dedication."
2. Acknowledge their consistency patterns warmly. If they've been regular, celebrate it. If sporadic, note: "Every time you come back, you're choosing yourself."
3. Gently suggest one area where they might enjoy exploring more - frame as "You might find..." or "Some runners discover that..." Never pressure.

Remember: context without judgment. Share where they stand but emphasize their personal journey matters most.

Format each point starting with •`;

    case 'tips':
      return `${basePrompt}${contextSection}Offer three gentle, wisdom-filled suggestions based on their workout patterns.

Provide exactly 3 bullet points:
1. A recovery or rest insight - acknowledge that rest is earned: "Your body is adapting and growing stronger between workouts" or "Rest days are when the magic happens."
2. A gentle progression idea - "You might enjoy trying..." or "Some people find that adding X helps them feel..." No pressure, just possibilities.
3. A holistic tip about nutrition, sleep, or cross-training - connect it to how they'll feel: "Staying hydrated helps your muscles recover faster" or "A little stretching can make your next run feel smoother."

Plant seeds. Trust them to grow what resonates.

Format each point starting with •`;

    case 'bmi':
      return `${basePrompt}${contextSection}Reflect on the user's body composition with warmth and perspective.

Look at the "Body Composition Data" section in the User Context above for:
- Height and weight
- Calculated BMI value and category (underweight/normal/overweight/obese)
- Healthy weight range for their height
- Note about BMI limitations for athletes

Provide exactly 3 bullet points:
1. Share their BMI with gentle context - if healthy, acknowledge it warmly. If outside healthy range, note that tracking this shows self-awareness: "Knowing where you stand is valuable information."
2. Provide perspective about their healthy weight range without pressure - "Your body tends to feel its best when..." Frame as information, not instruction. If they're active, acknowledge that BMI doesn't account for muscle mass.
3. Offer one gentle suggestion they might explore - "Some people find that..." or "You might enjoy..." Never prescribe what they "should" do.

IMPORTANT: BMI uses the WHO standard formula (weight/height²). For athletes and active people, BMI often shows "overweight" despite excellent fitness - muscle weighs more than fat. Focus on how they feel and their activity level, not the number alone.

Format each point starting with •`;

    case 'vo2max':
      return `${basePrompt}${contextSection}Reflect on the user's cardiovascular fitness with appreciation and insight.

Look at the "Body Composition Data" section in the User Context above for:
- Estimated VO2 Max value (ml/kg/min)
- Confidence level (HIGH for 5K/10K times, LOW for pace estimates)
- Method description (what workout data was used)
- Formula reference (Jack Daniels' VDOT or Léger & Mercier)
- Age/sex percentile ranking (from ACSM tables)
- Fitness category (poor/fair/good/excellent/superior)

Provide exactly 3 bullet points:
1. Acknowledge their VO2 Max warmly - every level represents real work their heart and lungs are doing. If confidence is HIGH, reference the specific race time that earned this score. If confidence is LOW (pace estimate), mention this is an estimate and a timed 5K/10K would give more precision.
2. Share their percentile context as information, not competition - "This places you among..." The percentile uses ACSM standards adjusted for age and sex.
3. If they're curious about improving, share one gentle path they might explore - "Some runners find that..." or "Interval training is one approach that..." No pressure, just possibilities.

IMPORTANT: VO2 Max is calculated using Jack Daniels' VDOT formula for timed races (industry standard) or Léger & Mercier running economy formula for pace estimates. Be transparent about confidence level. Percentiles are from ACSM guidelines.

Format each point starting with •`;

    case 'fitness_age':
      return `${basePrompt}${contextSection}Reflect on the user's fitness age with warmth and perspective.

Look at the "Body Composition Data" section in the User Context above for:
- Chronological age (actual age)
- Calculated fitness age
- VO2 Max component (85% weight) - how their cardio fitness compares to age norms
- Activity Level component (15% weight) - based on workout frequency
- Formula reference (NTNU methodology)

Provide exactly 3 bullet points:
1. If fitness age is lower than actual age: Acknowledge it warmly - "Your body is performing like someone younger. That's the result of the choices you've made." If higher: Frame with gentle optimism - "This is where you're starting from, and every bit of movement shifts this number."
2. Explain the two components as information - VO2 Max (cardiovascular fitness) contributes 85%, and activity level (workout consistency) contributes 15%. Note which one is their strength and which represents opportunity, without pressure.
3. If they're interested in improving their fitness age, share one gentle approach they might consider - "Some people find that..." Frame as an option, not an assignment.

IMPORTANT: Fitness age is calculated using NTNU methodology (Nes et al., 2013). It does NOT penalize BMI - we removed arbitrary BMI penalties because they don't account for muscle mass. Instead, it rewards consistent activity: very active (+5 workouts/week) subtracts years, while sedentary adds years.

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
