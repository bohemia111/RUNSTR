import AsyncStorage from '@react-native-async-storage/async-storage';

const MODEL_STORAGE_KEY = '@runstr:ppq_selected_model';
const DEFAULT_MODEL = 'claude-haiku-4.5';

export interface AIModel {
  id: string;
  name: string;
}

export class ModelManager {
  /**
   * Available AI models for COACH RUNSTR
   * Based on PPQ.AI popular models list
   */
  static readonly AVAILABLE_MODELS: AIModel[] = [
    { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5' },
    { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5' },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'auto', name: 'Auto Model' },
    { id: 'gpt-5.1', name: 'GPT-5.1' },
    { id: 'deepseek/deepseek-chat-v3.1', name: 'DeepSeek V3.1' },
    { id: 'qwen/qwen3-max', name: 'Qwen3 Max' },
    { id: 'perplexity/sonar-reasoning', name: 'Sonar Reasoning' },
  ];

  /**
   * Get list of available models
   */
  static getAvailableModels(): AIModel[] {
    return this.AVAILABLE_MODELS;
  }

  /**
   * Get currently selected model ID
   */
  static async getSelectedModel(): Promise<string> {
    try {
      const model = await AsyncStorage.getItem(MODEL_STORAGE_KEY);
      return model || DEFAULT_MODEL;
    } catch (error) {
      console.error('Error getting selected model:', error);
      return DEFAULT_MODEL;
    }
  }

  /**
   * Set selected model
   */
  static async setSelectedModel(modelId: string): Promise<void> {
    try {
      // Validate model exists
      const modelExists = this.AVAILABLE_MODELS.some((m) => m.id === modelId);
      if (!modelExists) {
        console.warn(
          `Model ${modelId} not found in available models, using default`
        );
        await AsyncStorage.setItem(MODEL_STORAGE_KEY, DEFAULT_MODEL);
        return;
      }

      await AsyncStorage.setItem(MODEL_STORAGE_KEY, modelId);
    } catch (error) {
      console.error('Error setting selected model:', error);
    }
  }

  /**
   * Get model name from ID
   */
  static getModelName(modelId: string): string {
    const model = this.AVAILABLE_MODELS.find((m) => m.id === modelId);
    return model?.name || modelId;
  }

  /**
   * Reset to default model
   */
  static async resetToDefault(): Promise<void> {
    try {
      await AsyncStorage.setItem(MODEL_STORAGE_KEY, DEFAULT_MODEL);
    } catch (error) {
      console.error('Error resetting to default model:', error);
    }
  }
}
