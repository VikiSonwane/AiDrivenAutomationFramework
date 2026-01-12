# Advanced Usage Guide

## Table of Contents
- [Custom MCP Tools](#custom-mcp-tools)
- [Advanced Self-Healing](#advanced-self-healing)
- [Performance Optimization](#performance-optimization)
- [CI/CD Integration](#cicd-integration)
- [Multi-Environment Testing](#multi-environment-testing)
- [Visual Regression Testing](#visual-regression-testing)

## Custom MCP Tools

Extend the MCP server with custom tools for your application:

```typescript
// src/mcp-server/custom-tools.ts
export class CustomTools {
  async loginWithSSO(params: { provider: string }) {
    // Custom SSO login logic
  }
  
  async seedTestData(params: { dataType: string; count: number }) {
    // Seed database via API
  }
  
  async verifyEmail(params: { email: string }) {
    // Check test email inbox
  }
}
```

Register in MCP server:

```typescript
// Add to src/mcp-server/index.ts
{
  name: 'login_sso',
  description: 'Login using SSO provider',
  inputSchema: {
    type: 'object',
    properties: {
      provider: { type: 'string', enum: ['google', 'github', 'microsoft'] }
    }
  }
}
```

## Advanced Self-Healing

### Custom Healing Strategies

```typescript
import { SelfHealingManager } from '../src/self-healing/healing-manager';

class CustomHealer extends SelfHealingManager {
  async healWithDomainKnowledge(element: string, context: string) {
    // Use application-specific knowledge
    if (context.includes('checkout')) {
      // Try checkout-specific selectors first
      return this.tryCheckoutSelectors(element);
    }
  }
  
  private async tryCheckoutSelectors(element: string) {
    const checkoutMap = {
      'payment button': ['#payment-submit', '.checkout-pay', '[data-checkout="pay"]'],
      'shipping form': ['#shipping-form', '.shipping-info', '[name="shipping"]'],
    };
    
    // Try domain-specific selectors
    return checkoutMap[element.toLowerCase()] || [];
  }
}
```

### Healing with Visual Confirmation

```typescript
async clickWithVisualConfirmation(element: string) {
  const beforeScreenshot = await this.page.screenshot();
  
  await this.clickWithHealing(element);
  
  const afterScreenshot = await this.page.screenshot();
  
  // Ask LLM: "Did the click have the expected effect?"
  const analysis = await analyzeScreenshots(beforeScreenshot, afterScreenshot);
  
  if (!analysis.success) {
    throw new Error('Click did not produce expected visual change');
  }
}
```

## Performance Optimization

### 1. Selector Caching Strategy

```typescript
// Redis-backed selector cache
import { createClient } from 'redis';

class SelectorCache {
  private redis = createClient({ url: process.env.REDIS_URL });
  
  async get(originalSelector: string): Promise<string | null> {
    return await this.redis.get(`selector:${originalSelector}`);
  }
  
  async set(original: string, healed: string, ttl: number = 86400) {
    await this.redis.setEx(`selector:${original}`, ttl, healed);
  }
}
```

### 2. Parallel Test Execution

```typescript
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 4 : 8,
  fullyParallel: true,
  
  // Shard tests across machines
  shard: {
    current: parseInt(process.env.SHARD_INDEX || '1'),
    total: parseInt(process.env.SHARD_TOTAL || '1'),
  },
});
```

### 3. Prompt Caching

```typescript
// Use Claude's prompt caching (90% cost reduction)
const llm = new ChatAnthropic({
  modelName: 'claude-3-5-sonnet-20240620',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  cache_control: { type: 'ephemeral' }, // Cache system prompts
});

// Mark cacheable content
const systemPrompt = new SystemMessage({
  content: largeSystemPrompt,
  additional_kwargs: {
    cache_control: { type: 'ephemeral' }
  }
});
```

### 4. Batch LLM Requests

```typescript
async healMultipleSelectors(elements: string[]) {
  // Single LLM call for multiple healings
  const prompt = `Heal these selectors: ${JSON.stringify(elements)}`;
  const results = await llm.invoke(prompt);
  return results.healedSelectors;
}
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/tests.yml
name: Agentic QA Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps chromium
      
      - name: Run tests
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SHARD_INDEX: ${{ matrix.shard }}
          SHARD_TOTAL: 4
        run: npm test
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-${{ matrix.shard }}
          path: test-results/
      
      - name: Upload Allure results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: allure-results-${{ matrix.shard }}
          path: allure-results/
```

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - test
  - report

test:
  stage: test
  image: node:20
  parallel: 4
  before_script:
    - npm ci
    - npx playwright install --with-deps chromium
  script:
    - npm test
  artifacts:
    when: always
    paths:
      - test-results/
      - allure-results/
    expire_in: 30 days
  variables:
    SHARD_INDEX: $CI_NODE_INDEX
    SHARD_TOTAL: $CI_NODE_TOTAL
```

## Multi-Environment Testing

### Environment Configuration

```typescript
// src/config/environments.ts
export const environments = {
  dev: {
    baseUrl: 'https://dev.example.com',
    apiUrl: 'https://api-dev.example.com',
    credentials: {
      user: 'dev_user',
      password: process.env.DEV_PASSWORD,
    },
  },
  staging: {
    baseUrl: 'https://staging.example.com',
    apiUrl: 'https://api-staging.example.com',
    credentials: {
      user: 'staging_user',
      password: process.env.STAGING_PASSWORD,
    },
  },
  production: {
    baseUrl: 'https://example.com',
    apiUrl: 'https://api.example.com',
    credentials: {
      user: 'prod_user',
      password: process.env.PROD_PASSWORD,
    },
  },
};

export function getEnvironment() {
  const env = process.env.TEST_ENV || 'dev';
  return environments[env];
}
```

### Environment-Aware Tests

```typescript
import { test } from './fixtures/agentic-test';
import { getEnvironment } from '../src/config/environments';

test('user login across environments', async ({ agent }) => {
  const env = getEnvironment();
  
  await agent.execute(`
    1. Navigate to ${env.baseUrl}
    2. Login with username "${env.credentials.user}"
    3. Verify dashboard loads
  `);
});
```

## Visual Regression Testing

### With Playwright

```typescript
import { test, expect } from '@playwright/test';

test('visual regression - homepage', async ({ page }) => {
  await page.goto('https://example.com');
  
  // First run: creates baseline
  // Subsequent runs: compares against baseline
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixels: 100, // Allow minor differences
  });
});
```

### With AI Analysis

```typescript
import { llmProvider } from '../src/orchestration/llm-provider';

async function analyzeVisualChange(before: Buffer, after: Buffer) {
  const llm = llmProvider.getModel('vision');
  
  const prompt = `
    Compare these two screenshots.
    Ignore minor rendering differences (fonts, anti-aliasing).
    Report significant UI changes that affect functionality or UX.
    
    Screenshot 1 (baseline): [attached]
    Screenshot 2 (current): [attached]
  `;
  
  const response = await llm.invoke([
    {
      type: 'image',
      image: before.toString('base64'),
    },
    {
      type: 'image',
      image: after.toString('base64'),
    },
    {
      type: 'text',
      text: prompt,
    },
  ]);
  
  return parseVisualAnalysis(response);
}
```

## Database Test Isolation

### Transaction Rollback Strategy

```typescript
import { test as base } from '@playwright/test';
import { Pool } from 'pg';

export const test = base.extend({
  db: async ({}, use) => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    
    // Start transaction
    await client.query('BEGIN');
    
    await use(client);
    
    // Rollback after test
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  },
});

// Usage
test('with database isolation', async ({ db, agent }) => {
  // Seed data
  await db.query('INSERT INTO users ...');
  
  // Run test
  await agent.execute('...');
  
  // Data automatically rolled back after test
});
```

## Monitoring & Alerting

### Prometheus Metrics

```typescript
// src/monitoring/metrics.ts
import { Counter, Histogram, register } from 'prom-client';

export const testCounter = new Counter({
  name: 'agentic_qa_tests_total',
  help: 'Total number of tests executed',
  labelNames: ['status'],
});

export const testDuration = new Histogram({
  name: 'agentic_qa_test_duration_seconds',
  help: 'Test execution duration',
  buckets: [1, 5, 10, 30, 60, 120],
});

export const healingCounter = new Counter({
  name: 'agentic_qa_healing_attempts_total',
  help: 'Number of self-healing attempts',
  labelNames: ['success'],
});

export const tokenUsage = new Counter({
  name: 'agentic_qa_tokens_total',
  help: 'Total LLM tokens used',
  labelNames: ['model'],
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Slack Notifications

```typescript
async function sendTestResults(result: TestResult) {
  if (!result.success) {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `❌ Test Failed: ${result.testName}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Test:* ${result.testName}\n*Status:* Failed\n*Errors:* ${result.errors.length}\n*Healing Attempts:* ${result.healingAttempts}`,
            },
          },
        ],
      }),
    });
  }
}
```

## Security Best Practices

### 1. Secrets Management

```typescript
// Never commit secrets
// Use environment variables or secret managers

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function getSecret(secretName: string) {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  return JSON.parse(response.SecretString);
}
```

### 2. Sanitize LLM Inputs

```typescript
function sanitizeForLLM(userInput: string): string {
  // Remove potential prompt injection attempts
  const dangerous = ['ignore previous', 'system:', 'assistant:', '<|'];
  
  let sanitized = userInput;
  for (const pattern of dangerous) {
    sanitized = sanitized.replace(new RegExp(pattern, 'gi'), '');
  }
  
  return sanitized.substring(0, 10000); // Limit length
}
```

### 3. Screenshot Sanitization

```typescript
async function sanitizeScreenshot(screenshot: Buffer): Promise<Buffer> {
  // Blur sensitive data before sending to LLM
  const image = sharp(screenshot);
  
  // Detect and blur sensitive regions (PII, credit cards, etc.)
  // Implementation depends on your needs
  
  return await image.blur(5).toBuffer();
}
```

## Troubleshooting

### Common Issues

**Issue: MCP connection timeout**
```typescript
// Increase timeout
this.client.request(params, { timeout: 60000 });
```

**Issue: High token costs**
```typescript
// Enable aggressive caching
config.llm.enableCaching = true;
// Use cheap model for simple tasks
config.llm.useCheapModelForSimpleTasks = true;
```

**Issue: Flaky tests**
```typescript
// Increase retries and timeouts
test.setTimeout(120000);
test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(30000);
});
```

**Issue: Browser crashes**
```typescript
// Add error recovery
try {
  await agent.execute(testDescription);
} catch (error) {
  if (error.message.includes('Target closed')) {
    // Browser crashed, restart and retry
    await restartBrowser();
    await agent.execute(testDescription);
  }
}
```
