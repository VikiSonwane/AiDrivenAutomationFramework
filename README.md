# Agentic QA Automation Platform

An AI-driven QA automation platform that uses LLMs as intelligent test agents, leveraging Model Context Protocol (MCP) to control browsers through Playwright. This platform transforms manual testing into natural language specifications that AI agents execute adaptively.

## 🎯 Key Features

- **Natural Language Test Authoring**: Write tests in plain English
- **Self-Healing Tests**: AI adapts to UI changes automatically
- **Intelligent Selector Resolution**: Uses accessibility trees and semantic understanding
- **Cost-Optimized**: Multi-model strategy with prompt caching
- **Production-Ready**: Built-in retry logic, error handling, and comprehensive reporting
- **MCP Architecture**: Standardized protocol for AI-browser interaction

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│   Test Specification Interface          │
│   (Natural Language Input)              │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│   LangGraph Orchestration               │
│   (ReAct Agent Pattern)                 │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│   Model Context Protocol (MCP)          │
│   (Standardized Tool Interface)         │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│   Playwright Browser Automation         │
└─────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Redis (for caching and state management)
- PostgreSQL (for test results storage)
- Anthropic API key (Claude) or OpenAI API key

### Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Copy environment configuration
cp .env.example .env

# Edit .env with your API keys
```

### Running the Platform

```bash
# Start MCP server
npm run mcp:server

# Run tests with UI mode
npm run test:ui

# Run tests in headless mode
npm test
```

## 📖 Usage

### Writing Natural Language Tests

Create a test file in `tests/`:

```typescript
import { test } from './fixtures/agentic-test';

test('User can purchase a product with discount', async ({ agent }) => {
  await agent.executeNaturalLanguageTest(`
    1. Navigate to the e-commerce staging site
    2. Login as 'test_user_1' with password 'Test123!'
    3. Search for "Blue T-Shirt"
    4. Add the first result to cart
    5. Apply discount code "SAVE20"
    6. Verify the total is $40 (20% off $50)
    7. Complete checkout
  `);
});
```

### Traditional Playwright + AI Enhancement

```typescript
import { test } from '@playwright/test';
import { AIAssistant } from './utils/ai-assistant';

test('Complex form with self-healing', async ({ page }) => {
  const ai = new AIAssistant(page);
  
  await page.goto('https://example.com/form');
  
  // Try traditional selector, fallback to AI healing
  await ai.fillWithHealing('email', 'user@example.com');
  await ai.clickWithHealing('Submit button');
  
  // AI-powered assertion
  await ai.verifyIntent('User should see success message');
});
```

## 🔧 Configuration

### MCP Server Configuration

Edit `src/mcp-server/config.ts`:

```typescript
export const config = {
  browser: {
    headless: true,
    timeout: 30000,
    contextOptions: {
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Custom Agent',
    },
  },
  llm: {
    primaryModel: 'claude-3-5-sonnet-20240620',
    cheapModel: 'claude-3-haiku-20240307',
    enableCaching: true,
  },
  selfHealing: {
    enabled: true,
    confidenceThreshold: 0.8,
    requireApproval: true,
  },
};
```

## 📊 Monitoring & Reporting

### View Test Results

```bash
# Open Playwright report
npx playwright show-report

# Generate Allure report
npx allure generate allure-results --clean
npx allure open
```

### Cost Tracking

Token usage and costs are automatically tracked in the database and displayed in the dashboard.

## 🧠 Self-Healing

The platform implements multi-level self-healing:

1. **Selector Healing**: When elements aren't found, AI analyzes the accessibility tree to find alternatives
2. **Workflow Adaptation**: If UI flow changes, AI generates alternative action sequences
3. **Assertion Flexibility**: AI determines if assertion failures are bugs or expected variations

All healing actions require human approval (configurable).

## 🏭 Production Deployment

### Docker Deployment

```bash
docker-compose up -d
```

### Kubernetes Deployment

```bash
kubectl apply -f k8s/
```

### Environment Variables

See `.env.example` for all configuration options.

## 📈 Performance & Costs

Expected costs (using Claude 3.5 Sonnet):
- Test generation: $0.10-0.30 per test
- Self-healing: $0.05-0.15 per attempt
- Visual analysis: $0.20-0.50 per screenshot

For 1000 daily tests with 10% self-healing:
- Monthly LLM costs: $500-2000
- Can reduce 50-70% with aggressive caching

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines.

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Resources

- [Model Context Protocol](https://modelcontextprotocol.io)
- [Playwright Documentation](https://playwright.dev)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Claude API](https://www.anthropic.com/api)
