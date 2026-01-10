/**
 * useCoachRunstr - AI-Powered Fitness Coach Hook
 *
 * Custom React hook that wraps CoachClaudeService to provide
 * AI-powered fitness insights using Claude Haiku API.
 *
 * All processing happens via Anthropic's API - fast, reliable, and cost-effective.
 * Cost: ~$0.0003 per workout analysis (~$0.30 per 1,000 workouts)
 */

import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { coachClaude } from './CoachClaudeService';
import type { PromptType, CoachInsight } from './CoachClaudeService';
import type { LocalWorkout } from '../fitness/LocalWorkoutStorageService';

// Cache keys for AsyncStorage
const CACHE_PREFIX = '@runstr:coach_cache:';
const API_KEY_STORAGE_KEY = '@runstr:ppq_api_key';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Default PPQ.AI API key for RUNSTR Premium (all users get AI features by default)
const DEFAULT_PPQ_API_KEY = 'sk-cHbG30uYuFdQGvKGKSHBP6';

interface CachedInsight extends CoachInsight {
  expiresAt: number;
}

/**
 * Get cached insight from AsyncStorage
 */
async function getCachedInsight(
  type: PromptType
): Promise<CoachInsight | null> {
  try {
    const cacheKey = `${CACHE_PREFIX}${type}`;
    const cached = await AsyncStorage.getItem(cacheKey);

    if (!cached) return null;

    const parsed: CachedInsight = JSON.parse(cached);

    if (Date.now() > parsed.expiresAt) {
      await AsyncStorage.removeItem(cacheKey);
      return null;
    }

    return {
      type: parsed.type,
      bullets: parsed.bullets,
      generatedAt: parsed.generatedAt,
    };
  } catch (error) {
    console.error('[CoachRunstr] Failed to get cached insight:', error);
    return null;
  }
}

/**
 * Cache insight to AsyncStorage with TTL
 */
async function cacheInsight(insight: CoachInsight): Promise<void> {
  try {
    const cacheKey = `${CACHE_PREFIX}${insight.type}`;
    const cached: CachedInsight = {
      ...insight,
      expiresAt: Date.now() + CACHE_TTL,
    };

    await AsyncStorage.setItem(cacheKey, JSON.stringify(cached));
  } catch (error) {
    console.error('[CoachRunstr] Failed to cache insight:', error);
  }
}

/**
 * Custom hook for COACH RUNSTR AI insights
 */
export function useCoachRunstr() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [isUsingDefaultKey, setIsUsingDefaultKey] = useState(true);

  // Initialize Claude service on mount
  useEffect(() => {
    const initializeService = async () => {
      try {
        // Try to load custom API key from AsyncStorage
        const storedKey = await AsyncStorage.getItem(API_KEY_STORAGE_KEY);

        // Use stored key if available, otherwise use default RUNSTR Premium key
        const keyToUse = storedKey || DEFAULT_PPQ_API_KEY;
        const usingDefault = !storedKey;

        coachClaude.initialize(keyToUse);
        setApiKeyConfigured(true);
        setModelReady(true);
        setIsUsingDefaultKey(usingDefault);

        console.log(
          `[CoachRunstr] Claude service initialized with ${usingDefault ? 'default RUNSTR Premium' : 'custom'} API key`
        );
      } catch (err) {
        console.error('[CoachRunstr] Failed to initialize service:', err);
        setError('Failed to initialize Coach Claude');
        setModelReady(false);
      }
    };

    initializeService();
  }, []);

  /**
   * Set custom API key and initialize service
   */
  const setApiKey = useCallback(async (apiKey: string) => {
    try {
      // Store custom API key in AsyncStorage
      await AsyncStorage.setItem(API_KEY_STORAGE_KEY, apiKey);

      // Initialize Claude service with custom key
      coachClaude.initialize(apiKey);

      setApiKeyConfigured(true);
      setModelReady(true);
      setIsUsingDefaultKey(false);
      setError(null);

      console.log('[CoachRunstr] Custom API key configured successfully');
    } catch (err) {
      console.error('[CoachRunstr] Failed to set API key:', err);
      setError('Failed to configure API key');
      throw err;
    }
  }, []);

  /**
   * Reset to default RUNSTR Premium API key
   */
  const resetToDefaultKey = useCallback(async () => {
    try {
      // Remove custom key from storage
      await AsyncStorage.removeItem(API_KEY_STORAGE_KEY);

      // Re-initialize with default key
      coachClaude.initialize(DEFAULT_PPQ_API_KEY);

      setApiKeyConfigured(true);
      setModelReady(true);
      setIsUsingDefaultKey(true);
      setError(null);

      console.log('[CoachRunstr] Reset to default RUNSTR Premium API key');
    } catch (err) {
      console.error('[CoachRunstr] Failed to reset to default key:', err);
      setError('Failed to reset API key');
      throw err;
    }
  }, []);

  /**
   * Generate AI-powered insight
   */
  const generateInsight = useCallback(
    async (
      type: PromptType,
      workouts: LocalWorkout[],
      options?: { useCache?: boolean }
    ): Promise<CoachInsight> => {
      if (!coachClaude.isReady()) {
        throw new Error(
          'Coach Claude is not configured. Please set your API key first.'
        );
      }

      const useCache = options?.useCache !== false;

      // Check AsyncStorage cache first
      if (useCache) {
        const cached = await getCachedInsight(type);
        if (cached) {
          console.log(
            `[CoachRunstr] Using cached ${type} insight from AsyncStorage`
          );
          return cached;
        }
      }

      setLoading(true);
      setError(null);

      try {
        console.log(
          `[CoachRunstr] Generating ${type} insight via Claude Haiku...`
        );

        // Call Claude service
        const insight = await coachClaude.generateInsight(
          type,
          workouts,
          options
        );

        // Cache to AsyncStorage
        if (useCache) {
          await cacheInsight(insight);
        }

        console.log(`[CoachRunstr] Generated ${type} insight successfully`);
        return insight;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Unknown error occurred';
        console.error(`[CoachRunstr] Failed to generate ${type} insight:`, err);
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Clear all cached insights
   */
  const clearCache = useCallback(async () => {
    try {
      // Clear AsyncStorage cache
      await AsyncStorage.multiRemove([
        `${CACHE_PREFIX}weekly`,
        `${CACHE_PREFIX}trends`,
        `${CACHE_PREFIX}tips`,
        `${CACHE_PREFIX}bmi`,
        `${CACHE_PREFIX}vo2max`,
        `${CACHE_PREFIX}fitness_age`,
      ]);

      // Clear in-memory cache
      coachClaude.clearCache();

      console.log('[CoachRunstr] All caches cleared');
    } catch (err) {
      console.error('[CoachRunstr] Failed to clear cache:', err);
    }
  }, []);

  return {
    generateInsight,
    clearCache,
    setApiKey,
    resetToDefaultKey,
    loading,
    error,
    modelReady,
    apiKeyConfigured,
    isUsingDefaultKey,
  };
}

// Export types for use in components
export type { PromptType, CoachInsight };
