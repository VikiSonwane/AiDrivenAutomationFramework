import { chromium, type Browser, type Page } from 'playwright';
import { Logger } from '../utils/logger.js';
import { PlaywrightTools } from '../mcp-server/playwright-tools.js';
import { queryOllama } from './llm-provider.js';
import { TestGenerator } from './test-generator.js';

const logger = new Logger('AgenticOrchestrator');

export class AgenticOrchestrator {
  private testId: string;
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(testId: string) {
    this.testId = testId;
  }

  async execute(testDescription: string): Promise<any> {
    logger.info(`Starting intelligent test execution: ${this.testId}`);
    
    const steps: string[] = [];
    const errors: string[] = [];
    let healingAttempts = 0;
    let success = true;
    let generatedTestFile: string | null = null;

    try {
      // Launch browser
      logger.info('Launching browser...');
      this.browser = await chromium.launch({ headless: false });
      const context = await this.browser.newContext();
      this.page = await context.newPage();
      const tools = new PlaywrightTools(this.page);

      // Parse to extract URLs first
      const urlMatch = testDescription.match(/(https?:\/\/[^\s]+)/i);
      if (urlMatch) {
        const url = urlMatch[0];
        logger.info(`Navigating to: ${url}`);
        await tools.navigate({ url });
        await this.page.waitForLoadState('domcontentloaded'); // Faster than networkidle
        steps.push(`✓ Navigated to ${url}`);
        await this.page.waitForTimeout(300); // Reduced wait
      }

      // Analyze page structure BEFORE generating actions
      logger.info('Analyzing page structure...');
      const pageContext = await this.analyzePageStructure();
      steps.push(`🔍 Analyzed page structure (${pageContext.elements.length} interactive elements found)`);

      // Use LLM with page context to generate intelligent test plan
      logger.info('Using LLM with page context to generate intelligent test plan...');
      const actions = await this.generateIntelligentTestPlan(testDescription, pageContext);
      logger.info(`LLM generated ${actions.length} intelligent actions based on page structure`);

      // Add navigation action at the beginning if URL was extracted
      const actionsForTestFile = urlMatch 
        ? [{ type: 'navigate', url: urlMatch[0], description: `Navigate to ${urlMatch[0]}` }, ...actions]
        : actions;

      // Generate test file before execution
      try {
        const testGenerator = new TestGenerator();
        const testName = `Auto-generated-${this.testId}`;
        generatedTestFile = await testGenerator.generateTestFile(
          testName,
          testDescription.split('\n')[0] || 'Auto-generated test',
          actionsactions
        );
        logger.info(`Test file generated: ${generatedTestFile}`);
        steps.push(`📝 Generated test file: ${generatedTestFile.split('/').pop()}`);
      } catch (genError: any) {
        logger.warn('Failed to generate test file', genError);
        steps.push(`⚠ Test file generation failed: ${genError.message}`);
      }

      // Execute each action with self-healing
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        logger.info(`Executing step ${i + 1}: ${action.type} - ${action.description}`);
        
        try {
          switch (action.type) {
            case 'click':
              await this.executeWithHealing(
                async () => {
                  const locator = await this.getSmartLocator(action);
                  await locator.click();
                },
                action.element,
                'click'
              );
              steps.push(`✓ Clicked: ${action.element}`);
              break;
            
            case 'fill':
              await this.executeWithHealing(
                async () => {
                  const locator = await this.getSmartLocator(action);
                  await locator.fill(action.value || '');
                },
                action.element,
                'fill'
              );
              steps.push(`✓ Filled: ${action.element} with ${action.value}`);
              break;
            
            case 'wait':
              await this.page.waitForTimeout(action.duration || 1000);
              steps.push(`✓ Waited ${action.duration || 1000}ms`);
              break;
            
            case 'verify':
              const content = await this.page.textContent('body');
              const verified = content?.includes(action.expected || '') || false;
              if (verified) {
                steps.push(`✓ Verified: ${action.description}`);
              } else {
                steps.push(`✗ Verification failed: ${action.description}`);
                success = false;
              }
              break;
            
            default:
              logger.warn(`Unknown action type: ${action.type}`);
              steps.push(`⚠ Skipped unknown action: ${action.description}`);
          }
          
          // Small delay between actions for stability
          await this.page.waitForTimeout(200); // Reduced for speed
        } catch (stepError: any) {
          // Try self-healing
          logger.warn(`Step ${i + 1} failed, attempting self-healing...`);
          try {
            healingAttempts++;
            await this.healAndRetry(action, stepError);
            steps.push(`✓ Self-healed and completed: ${action.description}`);
          } catch (healError: any) {
            const errorMsg = `Step ${i + 1} failed after healing: ${healError.message}`;
            logger.error(errorMsg, healError);
            errors.push(errorMsg);
            steps.push(`✗ Failed: ${action.description}`);
            success = false;
          }
        }
      }

    } catch (error: any) {
      logger.error('Test execution failed', error);
      errors.push(error.message);
      success = false;
    } finally {
      // Cleanup
      if (this.browser) {
        logger.info('Closing browser...');
        await this.browser.close();
      }
    }

    const result = {
      testId: this.testId,
      success,
      steps: steps.length,
      errors,
      healingAttempts,
      messages: steps,
      generatedTestFile,
    };

    logger.info(`Test execution completed: ${success ? 'PASSED' : 'FAILED'} (${healingAttempts} healing attempts)`);
    return result;
  }

  private async getSmartLocator(action: any): Promise<any> {
    // Use LLM-provided locator strategy if available
    if (action.locatorStrategy) {
      try {
        switch (action.locatorStrategy) {
          case 'getByRole':
            return this.page!.getByRole(
              action.locatorValue,
              action.locatorOptions ? action.locatorOptions : undefined
            );
          case 'getByLabel':
            return this.page!.getByLabel(new RegExp(action.locatorValue, 'i'));
          case 'getByPlaceholder':
            return this.page!.getByPlaceholder(new RegExp(action.locatorValue, 'i'));
          case 'getByText':
            return this.page!.getByText(new RegExp(action.locatorValue, 'i'));
        }
      } catch (e) {
        logger.warn(`Failed to use LLM locator strategy, falling back: ${e}`);
      }
    }

    // Fallback to finding element by description
    const selector = await this.findElementWithAccessibility(
      action.element,
      action.type === 'click' ? 'button' : 'textbox'
    );
    return this.page!.locator(selector);
  }

  private async executeWithHealing(
    action: () => Promise<void>,
    elementDescription: string,
    actionType: string
  ): Promise<void> {
    try {
      await action();
    } catch (error) {
      logger.warn(`Action failed, attempting self-healing for: ${elementDescription}`);
      // Get fresh accessibility snapshot and retry
      const snapshot = await this.getAccessibilitySnapshot();
      const healedSelector = await this.healSelector(elementDescription, actionType, snapshot);
      
      if (actionType === 'click') {
        await this.page!.click(healedSelector);
      } else if (actionType === 'fill') {
        await this.page!.fill(healedSelector, '');
      }
    }
  }

  private async healAndRetry(action: any, _originalError: any): Promise<void> {
    logger.info(`Healing failed action: ${action.type} - ${action.description}`);
    
    // Get current page accessibility snapshot
    const snapshot = await this.getAccessibilitySnapshot();
    
    // Use LLM to find the correct selector
    const healedSelector = await this.healSelector(action.element, action.type, snapshot);
    
    // Retry the action with the healed selector
    switch (action.type) {
      case 'click':
        await this.page!.click(healedSelector);
        break;
      case 'fill':
        await this.page!.fill(healedSelector, action.value || '');
        break;
      default:
        throw new Error(`Cannot heal action type: ${action.type}`);
    }
  }

  private async getAccessibilitySnapshot(): Promise<string> {
    try {
      // Get page structure using locator snapshot
      const body = await this.page!.locator('body').first();
      const snapshot = await body.evaluate((el) => {
        const getElementInfo = (element: any): any => {
          const tag = element.tagName.toLowerCase();
          const attrs: any = {};
          ['id', 'name', 'type', 'placeholder', 'aria-label', 'role', 'class'].forEach((attr: string) => {
            const val = element.getAttribute(attr);
            if (val) attrs[attr] = val;
          });
          return {
            tag,
            attrs,
            text: element.textContent?.trim().substring(0, 50) || '',
            children: Array.from(element.children).slice(0, 10).map(getElementInfo)
          };
        };
        return getElementInfo(el);
      });
      return JSON.stringify(snapshot, null, 2);
    } catch (error) {
      logger.warn('Could not get page snapshot, using page content');
      const content = await this.page!.content();
      return content.substring(0, 5000); // Limit size
    }
  }

  private async healSelector(
    elementDescription: string,
    actionType: string,
    pageSnapshot: string
  ): Promise<string> {
    const prompt = `You are a web automation expert. Find the best CSS or Playwright selector for this element.

Element Description: ${elementDescription}
Action Type: ${actionType}

Current Page Accessibility Tree (truncated):
${pageSnapshot.substring(0, 3000)}

Return ONLY the selector string, no explanation. Examples:
- button[type="submit"]
- input[name="email"]
- text="Login"
- role=button[name="Submit"]

Selector:`;

    try {
      const response = await queryOllama(prompt, 'llama3:latest');
      const selector = response.trim().replace(/[`'"]/g, '').split('\n')[0].trim();
      logger.info(`LLM healed selector: ${selector}`);
      return selector;
    } catch (error) {
      logger.error('LLM healing failed', error);
      throw error;
    }
  }

  private async findElementWithAccessibility(
    description: string,
    role?: string
  ): Promise<string> {
    // First try Playwright's recommended locators (most robust)
    const playwrightLocators = [
      { method: 'getByRole', value: role || 'button', name: description },
      { method: 'getByLabel', value: description },
      { method: 'getByPlaceholder', value: description },
      { method: 'getByText', value: description },
      { method: 'getByRole', value: 'textbox', name: description },
      { method: 'getByRole', value: 'button', name: description },
    ];

    // Try recommended locators first
    for (const loc of playwrightLocators) {
      try {
        let locator;
        if (loc.method === 'getByRole' && loc.name) {
          locator = this.page!.getByRole(loc.value as any, { name: new RegExp(loc.name, 'i') });
        } else if (loc.method === 'getByLabel') {
          locator = this.page!.getByLabel(new RegExp(loc.value, 'i'));
        } else if (loc.method === 'getByPlaceholder') {
          locator = this.page!.getByPlaceholder(new RegExp(loc.value, 'i'));
        } else if (loc.method === 'getByText') {
          locator = this.page!.getByText(new RegExp(loc.value, 'i'));
        } else {
          continue;
        }

        const count = await locator.count();
        if (count > 0) {
          logger.debug(`Found element with ${loc.method}: ${JSON.stringify(loc)}`);
          return this.locatorToString(loc);
        }
      } catch (e) {
        // Continue trying
      }
    }

    // Fallback to attribute-based selectors (less preferred)
    const fallbackSelectors = [
      `[name="${description}" i]`,
      `[id="${description}" i]`,
      `[aria-label="${description}" i]`,
    ];

    for (const selector of fallbackSelectors) {
      try {
        const count = await this.page?.locator(selector).count();
        if (count && count > 0) {
          logger.debug(`Found element with fallback selector: ${selector}`);
          return selector;
        }
      } catch (e) {
        // Continue trying
      }
    }

    // If not found, use LLM with accessibility tree
    logger.info('Element not found with Playwright locators, using LLM healing...');
    const snapshot = await this.getAccessibilitySnapshot();
    return await this.healSelector(description, 'find', snapshot);
  }

  private locatorToString(loc: any): string {
    if (loc.method === 'getByRole') {
      return `getByRole('${loc.value}'${loc.name ? `, { name: /${loc.name}/i }` : ''})`;
    } else if (loc.method === 'getByLabel') {
      return `getByLabel(/${loc.value}/i)`;
    } else if (loc.method === 'getByPlaceholder') {
      return `getByPlaceholder(/${loc.value}/i)`;
    } else if (loc.method === 'getByText') {
      return `getByText(/${loc.value}/i)`;
    }
    return loc.value;
  }

  private async generateIntelligentTestPlan(
    testDescription: string, 
    pageContext: any
  ): Promise<any[]> {
    const prompt = `You are an expert QA automation engineer. Analyze the actual page structure and generate ONLY the necessary test steps.

USER REQUEST:
${testDescription}

ACTUAL PAGE INPUTS:
${JSON.stringify(pageContext.inputs.slice(0, 15), null, 2)}

ACTUAL PAGE BUTTONS:
${JSON.stringify(pageContext.buttons.slice(0, 10), null, 2)}

INSTRUCTIONS:
1. Match user's intent to ACTUAL elements on the page
2. For LOGIN tasks:
   - Find email/username input: look for type="email", type="text" with name/placeholder containing "email"/"username"
   - Find password input: look for type="password"
   - Find submit button: look for type="submit" or button text containing "sign in"/"login"
3. Use EXACT values from page structure (placeholder, name, ariaLabel, text)
4. Skip verification steps unless explicitly requested
5. Be concise - only generate steps that can actually be performed

OUTPUT FORMAT - Return ONLY valid JSON array (no explanation, no markdown):
[
  {
    "type": "fill",
    "element": "email field",
    "value": "test@example.com",
    "description": "Enter email",
    "locatorStrategy": "getByPlaceholder",
    "locatorValue": "Email"
  },
  {
    "type": "fill", 
    "element": "password field",
    "value": "password123",
    "description": "Enter password",
    "locatorStrategy": "getByPlaceholder",
    "locatorValue": "Password"
  },
  {
    "type": "click",
    "element": "login button",
    "description": "Click Sign In button",
    "locatorStrategy": "getByRole",
    "locatorValue": "button",
    "locatorOptions": {"name": "Sign In"}
  }
]

Generate the JSON:`;

    try {
      const response = await queryOllama(prompt, 'llama3:latest');
      logger.debug(`LLM Intelligent Response: ${response.substring(0, 300)}...`);
      
      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const actions = JSON.parse(jsonMatch[0]);
        logger.info(`LLM generated ${actions.length} intelligent actions`);
        return actions;
      }
      
      // Fallback
      logger.warn('LLM response not valid JSON, using fallback');
      return this.parseTestDescription(testDescription);
    } catch (error) {
      logger.error('LLM intelligent generation failed', error);
      return this.parseTestDescription(testDescription);
    }
  }

  private async analyzePageStructure(): Promise<any> {
    try {
      // Get all interactive elements with their properties (optimized for speed)
      const elements = await this.page!.evaluate(() => {
        // @ts-ignore - runs in browser context
        const doc = document;
        // @ts-ignore - runs in browser context
        const win = window;
        
        const getElementDetails = (el: any) => {
          const rect = el.getBoundingClientRect();
          // Only return essential properties for speed
          return {
            tag: el.tagName.toLowerCase(),
            type: el.type || null,
            name: el.name || null,
            id: el.id || null,
            placeholder: el.placeholder || null,
            ariaLabel: el.getAttribute('aria-label') || null,
            text: el.textContent?.trim().substring(0, 50) || null,
            visible: rect.width > 0 && rect.height > 0,
          };
        };

        // Get only visible inputs and buttons (faster filtering)
        const inputs = Array.from(doc.querySelectorAll('input:not([type="hidden"]), textarea, select'))
          .map(getElementDetails)
          .filter((el: any) => el.visible)
          .slice(0, 20); // Limit for speed
        
        const buttons = Array.from(doc.querySelectorAll('button, input[type="submit"], input[type="button"]'))
          .map(getElementDetails)
          .filter((el: any) => el.visible)
          .slice(0, 10); // Limit for speed

        return {
          inputs,
          buttons,
          title: doc.title,
          url: win.location.href,
        };
      });

      logger.info(`Page analysis: ${elements.inputs.length} inputs, ${elements.buttons.length} buttons`);
      
      return {
        elements: [...elements.inputs, ...elements.buttons],
        inputs: elements.inputs,
        buttons: elements.buttons,
        pageTitle: elements.title,
        pageUrl: elements.url,
      };
    } catch (error) {
      logger.error('Page analysis failed', error);
      return {
        elements: [],
        inputs: [],
        buttons: [],
        pageTitle: '',
        pageUrl: '',
      };
    }
  }

  private parseTestDescription(description: string): any[] {
    const actions: any[] = [];
    const lines = description.toLowerCase().split('\n').filter(line => line.trim());

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and section headers
      if (!trimmed || trimmed.startsWith('test scenario') || trimmed.startsWith('#')) {
        continue;
      }

      // Remove numbering (e.g., "1.", "2.", "step 1:")
      const cleaned = trimmed.replace(/^\d+[\.\)]\s*/, '').replace(/^step\s+\d+:\s*/i, '');

      // Navigate patterns
      if (cleaned.match(/navigate|goto|go to|open|visit/i)) {
        const urlMatch = cleaned.match(/(https?:\/\/[^\s]+)/i) || cleaned.match(/([a-z0-9\-\.]+\.(com|org|net|io|dev|app))/i);
        const url = urlMatch ? urlMatch[0] : cleaned.replace(/.*(?:to|open|visit)\s+/i, '').trim();
        actions.push({
          type: 'navigate',
          description: cleaned,
          url: url.startsWith('http') ? url : `https://${url}`,
        });
      }
      // Click patterns
      else if (cleaned.match(/click|press|tap/i)) {
        const element = cleaned.replace(/.*(?:click|press|tap)\s+(?:on\s+)?(?:the\s+)?/i, '').trim();
        actions.push({
          type: 'click',
          description: cleaned,
          element,
        });
      }
      // Fill/Enter patterns
      else if (cleaned.match(/enter|type|fill|input/i)) {
        const parts = cleaned.match(/(?:enter|type|fill|input)\s+['"]?([^'"]+?)['"]?\s+(?:in|into|to|on)\s+(?:the\s+)?(.+)/i);
        if (parts) {
          actions.push({
            type: 'fill',
            description: cleaned,
            element: parts[2].trim(),
            value: parts[1].trim(),
          });
        }
      }
      // Wait patterns
      else if (cleaned.match(/wait|pause|sleep/i)) {
        const durationMatch = cleaned.match(/(\d+)\s*(ms|milliseconds?|s|seconds?)?/i);
        const duration = durationMatch ? parseInt(durationMatch[1]) * (durationMatch[2]?.startsWith('s') ? 1000 : 1) : 1000;
        actions.push({
          type: 'wait',
          description: cleaned,
          duration,
        });
      }
      // Generic action - log it but skip
      else {
        logger.debug(`Unmatched line: ${cleaned}`);
      }
    }

    return actions;
  }
}
