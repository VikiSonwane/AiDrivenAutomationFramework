import type { Page } from 'playwright';
import { Logger } from '../utils/logger.js';

const logger = new Logger('PlaywrightTools');

export interface NavigateParams {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface ClickParams {
  selector?: string;
  ref?: string;
  element: string;
  button?: 'left' | 'right' | 'middle';
}

export interface FillParams {
  selector?: string;
  ref?: string;
  element: string;
  text: string;
}

export interface SelectParams {
  selector?: string;
  ref?: string;
  element: string;
  values: string[];
}

export interface ScreenshotParams {
  fullPage?: boolean;
  path?: string;
}

export interface AccessibilityTreeParams {
  includeHidden?: boolean;
}

export class PlaywrightTools {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate(params: NavigateParams): Promise<{ success: boolean; url: string }> {
    try {
      logger.info(`Navigating to: ${params.url}`);
      await this.page.goto(params.url, {
        waitUntil: params.waitUntil || 'load',
      });
      return { success: true, url: this.page.url() };
    } catch (error) {
      logger.error('Navigation failed', error);
      throw error;
    }
  }

  async click(params: ClickParams): Promise<{ success: boolean; message: string }> {
    try {
      logger.info(`Clicking element: ${params.element}`);
      
      // Try ref first (exact element reference), fallback to selector
      const locator = params.ref 
        ? this.page.locator(`[data-testid="${params.ref}"]`)
        : this.resolveSelector(params.element);

      await locator.click({
        button: params.button || 'left',
      });

      return { success: true, message: `Clicked on ${params.element}` };
    } catch (error) {
      logger.error(`Click failed on: ${params.element}`, error);
      throw error;
    }
  }

  async fill(params: FillParams): Promise<{ success: boolean; message: string }> {
    try {
      logger.info(`Filling element: ${params.element} with text: ${params.text}`);
      
      const locator = params.ref
        ? this.page.locator(`[data-testid="${params.ref}"]`)
        : this.resolveSelector(params.element);

      await locator.fill(params.text);

      return { success: true, message: `Filled ${params.element} with: ${params.text}` };
    } catch (error) {
      logger.error(`Fill failed on: ${params.element}`, error);
      throw error;
    }
  }

  async selectOption(params: SelectParams): Promise<{ success: boolean; message: string }> {
    try {
      logger.info(`Selecting options in: ${params.element}`);
      
      const locator = params.ref
        ? this.page.locator(`[data-testid="${params.ref}"]`)
        : this.resolveSelector(params.element);

      await locator.selectOption(params.values);

      return { success: true, message: `Selected options in ${params.element}` };
    } catch (error) {
      logger.error(`Select failed on: ${params.element}`, error);
      throw error;
    }
  }

  async takeScreenshot(params: ScreenshotParams): Promise<{ success: boolean; path: string }> {
    try {
      logger.info('Taking screenshot');
      const timestamp = Date.now();
      const path = params.path || `screenshots/screenshot-${timestamp}.png`;
      
      await this.page.screenshot({
        path,
        fullPage: params.fullPage || false,
      });

      return { success: true, path };
    } catch (error) {
      logger.error('Screenshot failed', error);
      throw error;
    }
  }

  async getAccessibilityTree(params: AccessibilityTreeParams = {}): Promise<any> {
    try {
      logger.info('Getting accessibility tree');
      const snapshot = await this.page.accessibility.snapshot({
        interestingOnly: !params.includeHidden,
      });
      return snapshot;
    } catch (error) {
      logger.error('Failed to get accessibility tree', error);
      throw error;
    }
  }

  async getPageState(): Promise<{
    url: string;
    title: string;
    html?: string;
    accessibilityTree?: any;
  }> {
    try {
      const url = this.page.url();
      const title = await this.page.title();
      const accessibilityTree = await this.getAccessibilityTree();

      return {
        url,
        title,
        accessibilityTree,
      };
    } catch (error) {
      logger.error('Failed to get page state', error);
      throw error;
    }
  }

  async expectVisible(selector: string): Promise<{ success: boolean; message: string }> {
    try {
      logger.info(`Checking visibility of: ${selector}`);
      const locator = this.resolveSelector(selector);
      await locator.waitFor({ state: 'visible' });
      return { success: true, message: `Element is visible: ${selector}` };
    } catch (error) {
      logger.error(`Element not visible: ${selector}`, error);
      throw error;
    }
  }

  async expectText(selector: string, expectedText: string): Promise<{ success: boolean; message: string }> {
    try {
      logger.info(`Checking text in: ${selector}`);
      const locator = this.resolveSelector(selector);
      const actualText = await locator.textContent();
      
      if (actualText?.includes(expectedText)) {
        return { success: true, message: `Text matches in ${selector}` };
      } else {
        throw new Error(`Expected text "${expectedText}" not found. Actual: "${actualText}"`);
      }
    } catch (error) {
      logger.error(`Text expectation failed: ${selector}`, error);
      throw error;
    }
  }

  private resolveSelector(description: string) {
    // Try semantic locators first (Playwright's auto-waiting locators)
    
    // Button by text
    if (description.toLowerCase().includes('button')) {
      const buttonText = description.replace(/button/gi, '').trim();
      if (buttonText) {
        return this.page.getByRole('button', { name: buttonText });
      }
    }

    // Input by label
    if (description.toLowerCase().includes('input') || 
        description.toLowerCase().includes('field')) {
      const labelText = description.replace(/input|field/gi, '').trim();
      if (labelText) {
        return this.page.getByLabel(labelText, { exact: false });
      }
    }

    // Link by text
    if (description.toLowerCase().includes('link')) {
      const linkText = description.replace(/link/gi, '').trim();
      if (linkText) {
        return this.page.getByRole('link', { name: linkText });
      }
    }

    // Fallback to text content search
    return this.page.getByText(description, { exact: false });
  }
}
