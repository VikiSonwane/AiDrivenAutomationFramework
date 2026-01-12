import { z } from 'zod';

export const BrowserConfigSchema = z.object({
  headless: z.boolean().default(true),
  timeout: z.number().default(30000),
  slowMo: z.number().default(0),
  viewport: z.object({
    width: z.number().default(1920),
    height: z.number().default(1080),
  }),
});

export const MCPConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().default(3000),
  maxConcurrentBrowsers: z.number().default(5),
});

export const LLMConfigSchema = z.object({
  primaryModel: z.string().default('claude-3-5-sonnet-20240620'),
  cheapModel: z.string().default('claude-3-haiku-20240307'),
  enableCaching: z.boolean().default(true),
  maxTokens: z.number().default(4096),
});

export const SelfHealingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  confidenceThreshold: z.number().min(0).max(1).default(0.8),
  requireApproval: z.boolean().default(true),
  maxHealingAttempts: z.number().default(3),
});

export const ConfigSchema = z.object({
  browser: BrowserConfigSchema,
  mcp: MCPConfigSchema,
  llm: LLMConfigSchema,
  selfHealing: SelfHealingConfigSchema,
  redis: z.object({
    url: z.string(),
  }),
  database: z.object({
    url: z.string(),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    file: z.string().optional(),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;
export type BrowserConfig = z.infer<typeof BrowserConfigSchema>;
export type MCPConfig = z.infer<typeof MCPConfigSchema>;
export type LLMConfig = z.infer<typeof LLMConfigSchema>;
export type SelfHealingConfig = z.infer<typeof SelfHealingConfigSchema>;
