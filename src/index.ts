import { AgenticOrchestrator } from './orchestration/agentic-orchestrator.js';
import { Logger } from './utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger('Main');

async function main() {
  logger.info('Agentic QA Platform - CLI Mode');
  
  const testDescription = process.argv[2];
  
  if (!testDescription) {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🤖 Agentic QA Automation Platform                            ║
╚═══════════════════════════════════════════════════════════════╝

Usage:
  npm start -- "Your test description here"

Example:
  npm start -- "Navigate to playwright.dev, click Docs, verify Installation is visible"

Or start the API server:
  npm run api

Or run Playwright tests:
  npm test
    `);
    process.exit(0);
  }

  try {
    const testId = uuidv4();
    logger.info(`Test ID: ${testId}`);
    
    const orchestrator = new AgenticOrchestrator(testId);
    const result = await orchestrator.execute(testDescription);
    
    console.log('\n' + '═'.repeat(70));
    console.log('TEST RESULTS');
    console.log('═'.repeat(70));
    console.log(`Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Steps Completed: ${result.steps}`);
    console.log(`Healing Attempts: ${result.healingAttempts}`);
    console.log(`Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((err: any, idx: number) => {
        console.log(`  ${idx + 1}. ${err.error}`);
      });
    }
    
    console.log('═'.repeat(70) + '\n');
    
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    logger.error('Test execution failed', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

main();
