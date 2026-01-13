import { writeFile } from 'fs/promises';
import { join } from 'path';
import { Logger } from '../utils/logger.js';

const logger = new Logger('TestGenerator');

export interface TestAction {
  type: string;
  description: string;
  url?: string;
  element?: string;
  value?: string;
  duration?: number;
  expected?: string;
  locatorMethod?: string;
}

export class TestGenerator {
  async generateTestFile(
    testName: string,
    testDescription: string,
    actions: TestAction[]
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedName = testName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const fileName = `${sanitizedName}-${timestamp}.spec.ts`;
    const filePath = join(process.cwd(), 'tests', fileName);

    const testCode = this.generateTestCode(testName, testDescription, actions);
    
    await writeFile(filePath, testCode, 'utf-8');
    logger.info(`Generated test file: ${filePath}`);
    
    return filePath;
  }

  private generateTestCode(
    testName: string,
    description: string,
    actions: TestAction[]
  ): string {
    const steps = actions.map((action, index) => {
      return this.generateStepCode(action, index + 1);
    }).join('\n\n');

    return `import { test, expect } from '@playwright/test';

/**
 * Auto-generated test: ${testName}
 * Description: ${description}
 * Generated: ${new Date().toISOString()}
 */

test.describe('${testName}', () => {
  test('${description}', async ({ page }) => {
    ${steps}
  });
});
`;
  }

  private generateStepCode(action: TestAction, stepNum: number): string {
    const indent = '    ';
    
    switch (action.type) {
      case 'navigate':
        return `${indent}// Step ${stepNum}: ${action.description}
${indent}await page.goto('${action.url}');
${indent}await page.waitForLoadState('networkidle');`;

      case 'click':
        const clickLocator = this.generateLocatorCode(action.element!, 'button');
        return `${indent}// Step ${stepNum}: ${action.description}
${indent}await page.${clickLocator}.click();`;

      case 'fill':
        const fillLocator = this.generateLocatorCode(action.element!, 'textbox');
        return `${indent}// Step ${stepNum}: ${action.description}
${indent}await page.${fillLocator}.fill('${action.value || ''}');`;

      case 'wait':
        return `${indent}// Step ${stepNum}: ${action.description}
${indent}await page.waitForTimeout(${action.duration || 1000});`;

      case 'verify':
        return `${indent}// Step ${stepNum}: ${action.description}
${indent}await expect(page.locator('body')).toContainText('${action.expected}');`;

      default:
        return `${indent}// Step ${stepNum}: ${action.description} (not implemented)`;
    }
  }

  private generateLocatorCode(description: string, defaultRole: string): string {
    // Generate Playwright locator code using recommended methods
    const sanitized = description.toLowerCase().trim();
    
    // Try to determine the best locator method
    if (sanitized.includes('button') || defaultRole === 'button') {
      return `getByRole('button', { name: /${this.escapeRegex(description)}/i })`;
    } else if (sanitized.includes('email') || sanitized.includes('e-mail')) {
      return `getByRole('textbox', { name: /email/i })`;
    } else if (sanitized.includes('password')) {
      return `getByLabel(/password/i)`;
    } else if (sanitized.includes('username') || sanitized.includes('user name')) {
      return `getByLabel(/username/i)`;
    } else if (sanitized.includes('search')) {
      return `getByRole('searchbox')`;
    } else if (sanitized.includes('link')) {
      return `getByRole('link', { name: /${this.escapeRegex(description)}/i })`;
    } else if (defaultRole === 'textbox') {
      return `getByPlaceholder(/${this.escapeRegex(description)}/i)`;
    }
    
    // Default to text-based locator
    return `getByText(/${this.escapeRegex(description)}/i)`;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
