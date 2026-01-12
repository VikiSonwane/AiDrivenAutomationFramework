import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page } from 'playwright';
import { Logger } from '../utils/logger.js';
import type { BrowserConfig } from '../config/schema.js';

const logger = new Logger('BrowserManager');

export class BrowserManager {
  private browsers: Map<string, Browser> = new Map();
  private contexts: Map<string, BrowserContext> = new Map();
  private config: BrowserConfig;

  constructor(config: BrowserConfig) {
    this.config = config;
  }

  async launchBrowser(browserType: 'chromium' | 'firefox' | 'webkit' = 'chromium'): Promise<Browser> {
    const existingBrowser = this.browsers.get(browserType);
    if (existingBrowser && existingBrowser.isConnected()) {
      logger.debug(`Reusing existing ${browserType} browser`);
      return existingBrowser;
    }

    logger.info(`Launching ${browserType} browser`);
    
    const launchOptions = {
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      timeout: this.config.timeout,
    };

    let browser: Browser;
    switch (browserType) {
      case 'firefox':
        browser = await firefox.launch(launchOptions);
        break;
      case 'webkit':
        browser = await webkit.launch(launchOptions);
        break;
      default:
        browser = await chromium.launch(launchOptions);
    }

    this.browsers.set(browserType, browser);
    logger.info(`${browserType} browser launched successfully`);
    return browser;
  }

  async createContext(browser: Browser, contextId: string): Promise<BrowserContext> {
    const existingContext = this.contexts.get(contextId);
    if (existingContext) {
      logger.debug(`Reusing existing context: ${contextId}`);
      return existingContext;
    }

    logger.info(`Creating new browser context: ${contextId}`);
    const context = await browser.newContext({
      viewport: this.config.viewport,
      userAgent: 'Agentic-QA-Platform/1.0',
    });

    this.contexts.set(contextId, context);
    return context;
  }

  async newPage(contextId: string): Promise<Page> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context not found: ${contextId}`);
    }

    logger.debug(`Creating new page in context: ${contextId}`);
    return await context.newPage();
  }

  async closeContext(contextId: string): Promise<void> {
    const context = this.contexts.get(contextId);
    if (context) {
      logger.info(`Closing context: ${contextId}`);
      await context.close();
      this.contexts.delete(contextId);
    }
  }

  async closeBrowser(browserType: 'chromium' | 'firefox' | 'webkit'): Promise<void> {
    const browser = this.browsers.get(browserType);
    if (browser) {
      logger.info(`Closing ${browserType} browser`);
      await browser.close();
      this.browsers.delete(browserType);
    }
  }

  async closeAll(): Promise<void> {
    logger.info('Closing all browser contexts and browsers');
    
    // Close all contexts
    for (const [id, context] of this.contexts.entries()) {
      try {
        await context.close();
        logger.debug(`Closed context: ${id}`);
      } catch (error) {
        logger.error(`Error closing context ${id}`, error);
      }
    }
    this.contexts.clear();

    // Close all browsers
    for (const [type, browser] of this.browsers.entries()) {
      try {
        await browser.close();
        logger.debug(`Closed ${type} browser`);
      } catch (error) {
        logger.error(`Error closing ${type} browser`, error);
      }
    }
    this.browsers.clear();
  }

  getActiveBrowsers(): string[] {
    return Array.from(this.browsers.keys()).filter(key => 
      this.browsers.get(key)?.isConnected()
    );
  }

  getActiveContexts(): string[] {
    return Array.from(this.contexts.keys());
  }
}
