import { test as base } from '@playwright/test';
import { AgenticOrchestrator } from '../orchestration/agentic-orchestrator.js';
import { v4 as uuidv4 } from 'uuid';

export interface AgenticTestFixtures {
  agent: AgenticOrchestrator;
  testId: string;
}

export const test = base.extend<AgenticTestFixtures>({
  testId: async ({}, use) => {
    const testId = uuidv4();
    await use(testId);
  },

  agent: async ({ testId }, use) => {
    const agent = new AgenticOrchestrator(testId);
    await use(agent);
  },
});

export { expect } from '@playwright/test';
