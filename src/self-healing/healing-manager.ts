import type { Page } from 'playwright';
import { queryOllama } from '../orchestration/llm-provider.js';
import { SELECTOR_HEALING_PROMPT } from '../orchestration/prompts.js';
import { SelectorResolutionSchema } from '../orchestration/schemas.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('SelfHealing');

export interface HealingResult {
  success: boolean;
  originalSelector: string;
  healedSelector?: string;
  confidence?: number;
  reasoning?: string;
  attempts: number;
}

export class SelfHealingManager {
  private page: Page;
  private healingCache: Map<string, HealingResult> = new Map();
  private maxAttempts: number = 3;

  constructor(page: Page, maxAttempts: number = 3) {
    this.page = page;
    this.maxAttempts = maxAttempts;
  }

  async clickWithHealing(
    elementDescription: string,
    maxAttempts?: number
  ): Promise<HealingResult> {
    const attempts = maxAttempts || this.maxAttempts;
    
    // Check cache first
    const cached = this.healingCache.get(`click:${elementDescription}`);
    if (cached && cached.success) {
      logger.debug(`Using cached selector for: ${elementDescription}`);
      try {
        await this.executeClick(cached.healedSelector!);
        return cached;
      } catch (error) {
        // Cache miss, clear and retry
        logger.warn('Cached selector failed, clearing cache');
        this.healingCache.delete(`click:${elementDescription}`);
      }
    }

    // Try original selector first
    try {
      logger.debug(`Attempting click with original selector: ${elementDescription}`);
      await this.executeClick(elementDescription);
      
      const result: HealingResult = {
        success: true,
        originalSelector: elementDescription,
        attempts: 1,
      };
      
      this.healingCache.set(`click:${elementDescription}`, result);
      return result;
    } catch (originalError) {
      logger.warn(`Original selector failed: ${elementDescription}`, originalError);

      // Attempt healing
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          logger.info(`Healing attempt ${attempt}/${attempts} for: ${elementDescription}`);
          
          const healedSelector = await this.healSelector(elementDescription, originalError);
          
          if (healedSelector) {
            await this.executeClick(healedSelector.selector);
            
            const result: HealingResult = {
              success: true,
              originalSelector: elementDescription,
              healedSelector: healedSelector.selector,
              confidence: healedSelector.confidence,
              reasoning: healedSelector.reasoning,
              attempts: attempt + 1,
            };
            
            // Cache successful healing
            this.healingCache.set(`click:${elementDescription}`, result);
            logger.info(`Successfully healed selector: ${healedSelector.selector}`);
            
            return result;
          }
        } catch (healingError) {
          logger.warn(`Healing attempt ${attempt} failed`, healingError);
          if (attempt === attempts) {
            throw healingError;
          }
        }
      }

      // All attempts failed
      return {
        success: false,
        originalSelector: elementDescription,
        attempts: attempts + 1,
      };
    }
  }

  async fillWithHealing(
    elementDescription: string,
    text: string,
    maxAttempts?: number
  ): Promise<HealingResult> {
    const attempts = maxAttempts || this.maxAttempts;
    
    const cacheKey = `fill:${elementDescription}`;
    const cached = this.healingCache.get(cacheKey);
    if (cached && cached.success) {
      try {
        await this.executeFill(cached.healedSelector!, text);
        return cached;
      } catch (error) {
        this.healingCache.delete(cacheKey);
      }
    }

    try {
      await this.executeFill(elementDescription, text);
      
      const result: HealingResult = {
        success: true,
        originalSelector: elementDescription,
        attempts: 1,
      };
      
      this.healingCache.set(cacheKey, result);
      return result;
    } catch (originalError) {
      logger.warn(`Original fill failed: ${elementDescription}`, originalError);

      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          const healedSelector = await this.healSelector(elementDescription, originalError);
          
          if (healedSelector) {
            await this.executeFill(healedSelector.selector, text);
            
            const result: HealingResult = {
              success: true,
              originalSelector: elementDescription,
              healedSelector: healedSelector.selector,
              confidence: healedSelector.confidence,
              reasoning: healedSelector.reasoning,
              attempts: attempt + 1,
            };
            
            this.healingCache.set(cacheKey, result);
            return result;
          }
        } catch (healingError) {
          if (attempt === attempts) {
            throw healingError;
          }
        }
      }

      return {
        success: false,
        originalSelector: elementDescription,
        attempts: attempts + 1,
      };
    }
  }

  async verifyWithHealing(
    elementDescription: string,
    expectedText?: string
  ): Promise<HealingResult> {
    try {
      const locator = this.resolveSelector(elementDescription);
      await locator.waitFor({ state: 'visible', timeout: 10000 });
      
      if (expectedText) {
        const actualText = await locator.textContent();
        if (!actualText?.includes(expectedText)) {
          throw new Error(`Expected text "${expectedText}" not found. Actual: "${actualText}"`);
        }
      }

      return {
        success: true,
        originalSelector: elementDescription,
        attempts: 1,
      };
    } catch (error) {
      logger.warn(`Verification failed: ${elementDescription}`, error);

      // Try healing
      try {
        const healedSelector = await this.healSelector(elementDescription, error);
        
        if (healedSelector) {
          const healedLocator = this.page.locator(healedSelector.selector);
          await healedLocator.waitFor({ state: 'visible', timeout: 10000 });
          
          return {
            success: true,
            originalSelector: elementDescription,
            healedSelector: healedSelector.selector,
            confidence: healedSelector.confidence,
            attempts: 2,
          };
        }
      } catch (healingError) {
        logger.error('Healing verification failed', healingError);
      }

      return {
        success: false,
        originalSelector: elementDescription,
        attempts: 2,
      };
    }
  }

  private async healSelector(
    elementDescription: string,
    error: any
  ): Promise<{ selector: string; confidence: number; reasoning: string } | null> {
    try {
      // Get current page state
      const url = this.page.url();
      // Playwright's accessibility API is available via import { accessibility } from 'playwright';
      // But Page does not have .accessibility, so skip accessibility tree or use a fallback
      const accessibilityTree = {}; // Fallback: empty object or implement accessibility extraction if needed

      // Ask LLM for healing suggestion via Ollama
      const prompt = await SELECTOR_HEALING_PROMPT.format({
        originalElement: elementDescription,
        error: error.toString(),
        accessibilityTree: JSON.stringify(accessibilityTree, null, 2).substring(0, 5000), // Limit size
        url,
      });

      const responseText = await queryOllama(
        `You are an expert at finding elements on web pages. Output valid JSON only.\n${prompt}`
      );

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from LLM response');
      }

      const resolution = SelectorResolutionSchema.parse(JSON.parse(jsonMatch[0]));

      if (resolution.alternatives.length === 0) {
        logger.warn('No healing alternatives found');
        return null;
      }

      // Get the highest confidence alternative
      const best = resolution.alternatives.sort((a, b) => b.confidence - a.confidence)[0];

      if (best.confidence < 0.6) {
        logger.warn(`Best alternative has low confidence: ${best.confidence}`);
        return null;
      }

      logger.info(`Healing suggestion: ${best.selector} (confidence: ${best.confidence})`);

      return {
        selector: best.selector,
        confidence: best.confidence,
        reasoning: resolution.reasoning,
      };
    } catch (error) {
      logger.error('Selector healing failed', error);
      return null;
    }
  }

  private async executeClick(selector: string): Promise<void> {
    const locator = this.resolveSelector(selector);
    await locator.click({ timeout: 10000 });
  }

  private async executeFill(selector: string, text: string): Promise<void> {
    const locator = this.resolveSelector(selector);
    await locator.fill(text, { timeout: 10000 });
  }

  private resolveSelector(description: string) {
    // Try semantic locators first
    if (description.toLowerCase().includes('button')) {
      const buttonText = description.replace(/button/gi, '').trim();
      if (buttonText) {
        return this.page.getByRole('button', { name: buttonText });
      }
    }

    if (description.toLowerCase().includes('input') || description.toLowerCase().includes('field')) {
      const labelText = description.replace(/input|field/gi, '').trim();
      if (labelText) {
        return this.page.getByLabel(labelText, { exact: false });
      }
    }

    if (description.toLowerCase().includes('link')) {
      const linkText = description.replace(/link/gi, '').trim();
      if (linkText) {
        return this.page.getByRole('link', { name: linkText });
      }
    }

    // Fallback to text or CSS selector
    if (description.startsWith('#') || description.startsWith('.') || description.startsWith('[')) {
      return this.page.locator(description);
    }

    return this.page.getByText(description, { exact: false });
  }

  clearCache(): void {
    this.healingCache.clear();
    logger.debug('Healing cache cleared');
  }

  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.healingCache.size,
      entries: Array.from(this.healingCache.keys()),
    };
  }
}
