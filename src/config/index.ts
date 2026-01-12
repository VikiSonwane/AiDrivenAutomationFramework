import dotenv from 'dotenv';
import { ConfigSchema, type Config } from './schema.js';

dotenv.config();

export function loadConfig(): Config {
  const config = {
    browser: {
      headless: process.env.HEADLESS === 'true',
      timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000'),
      slowMo: parseInt(process.env.SLOW_MO || '0'),
      viewport: {
        width: 1920,
        height: 1080,
      },
    },
    mcp: {
      host: process.env.MCP_SERVER_HOST || 'localhost',
      port: parseInt(process.env.MCP_SERVER_PORT || '3000'),
      maxConcurrentBrowsers: 5,
    },
    llm: {
      primaryModel: process.env.EXPENSIVE_MODEL || 'claude-3-5-sonnet-20240620',
      cheapModel: process.env.CHEAP_MODEL || 'claude-3-haiku-20240307',
      enableCaching: process.env.ENABLE_PROMPT_CACHING === 'true',
      maxTokens: 4096,
    },
    selfHealing: {
      enabled: process.env.ENABLE_SELF_HEALING === 'true',
      confidenceThreshold: parseFloat(process.env.AUTO_HEAL_CONFIDENCE_THRESHOLD || '0.8'),
      requireApproval: process.env.REQUIRE_HUMAN_APPROVAL === 'true',
      maxHealingAttempts: 3,
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    database: {
      url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/agentic_qa',
    },
    logging: {
      level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
      file: process.env.LOG_FILE,
    },
  };

  return ConfigSchema.parse(config);
}

export const config = loadConfig();
