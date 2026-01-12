import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { Logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const logger = new Logger('LLMProvider');

export type LLMModel = 'primary' | 'cheap' | 'vision';

export class LLMProvider {
  private models: Map<LLMModel, ChatAnthropic | ChatOpenAI> = new Map();
  private tokenUsage: Map<string, number> = new Map();

  constructor() {
    this.initializeModels();
  }

  private initializeModels(): void {
    try {
      // Primary model (Claude Sonnet for complex reasoning)
      if (process.env.ANTHROPIC_API_KEY) {
        const primaryModel = new ChatAnthropic({
          modelName: config.llm.primaryModel,
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
          maxTokens: config.llm.maxTokens,
          temperature: 0.1, // Low temperature for deterministic outputs
        });
        this.models.set('primary', primaryModel);
        logger.info(`Primary model initialized: ${config.llm.primaryModel}`);
      }

      // Cheap model (Haiku for simple tasks)
      if (process.env.ANTHROPIC_API_KEY) {
        const cheapModel = new ChatAnthropic({
          modelName: config.llm.cheapModel,
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
          maxTokens: 2048,
          temperature: 0.1,
        });
        this.models.set('cheap', cheapModel);
        logger.info(`Cheap model initialized: ${config.llm.cheapModel}`);
      }

      // Vision model (GPT-4o or Claude for screenshots)
      if (process.env.OPENAI_API_KEY) {
        const visionModel = new ChatOpenAI({
          modelName: 'gpt-4o',
          openAIApiKey: process.env.OPENAI_API_KEY,
          maxTokens: 4096,
          temperature: 0.1,
        });
        this.models.set('vision', visionModel);
        logger.info('Vision model initialized: gpt-4o');
      }

      if (this.models.size === 0) {
        throw new Error('No LLM models initialized. Please provide API keys.');
      }
    } catch (error) {
      logger.error('Failed to initialize LLM models', error);
      throw error;
    }
  }

  getModel(type: LLMModel = 'primary'): ChatAnthropic | ChatOpenAI {
    const model = this.models.get(type);
    if (!model) {
      logger.warn(`Model type ${type} not available, falling back to primary`);
      const fallback = this.models.get('primary') || this.models.values().next().value;
      if (!fallback) {
        throw new Error('No LLM models available');
      }
      return fallback;
    }
    return model;
  }

  trackTokenUsage(testId: string, tokens: number): void {
    const current = this.tokenUsage.get(testId) || 0;
    this.tokenUsage.set(testId, current + tokens);
    logger.debug(`Token usage for ${testId}: ${current + tokens}`);
  }

  getTokenUsage(testId: string): number {
    return this.tokenUsage.get(testId) || 0;
  }

  getTotalTokenUsage(): number {
    return Array.from(this.tokenUsage.values()).reduce((sum, val) => sum + val, 0);
  }

  clearTokenUsage(testId?: string): void {
    if (testId) {
      this.tokenUsage.delete(testId);
    } else {
      this.tokenUsage.clear();
    }
  }
}

export const llmProvider = new LLMProvider();
