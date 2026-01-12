import { test, expect } from '@playwright/test';
import { SelfHealingManager } from '../src/self-healing/healing-manager';
import { testDataGenerator } from '../src/self-healing/test-data-generator';

test.describe('Self-Healing Demo', () => {
  test('demonstrates self-healing on element not found', async ({ page }) => {
    const healer = new SelfHealingManager(page);

    await page.goto('https://demo.playwright.dev/');

    // This will try the selector, fail, and then use AI to find the correct element
    const result = await healer.clickWithHealing('Get Started button');

    expect(result.success).toBeTruthy();
    console.log('Healing result:', result);
  });

  test('demonstrates form filling with self-healing', async ({ page }) => {
    const healer = new SelfHealingManager(page);

    await page.goto('https://demo.playwright.dev/demo/');

    // Generate test data
    const userData = testDataGenerator.generateUserProfile();
    console.log('Generated user data:', userData.data);

    // Fill form with self-healing enabled
    await healer.fillWithHealing('email input', userData.data.email);
    await healer.fillWithHealing('name input', userData.data.fullName);

    expect(healer.getCacheStats().size).toBeGreaterThan(0);
  });

  test('demonstrates test data generation', async ({ page }) => {
    // Basic data generation (fast)
    const user = testDataGenerator.generateBasicData('user');
    console.log('Basic user data:', user.data);

    // Complete user profile
    const profile = testDataGenerator.generateUserProfile();
    console.log('Complete profile:', profile.data);

    // Checkout data
    const checkout = testDataGenerator.generateCheckoutData();
    console.log('Checkout data:', checkout.data);

    // Unique email
    const email = testDataGenerator.generateUniqueEmail('test');
    console.log('Unique email:', email);

    expect(user.data.email).toContain('@');
    expect(profile.data.address.city).toBeTruthy();
    expect(checkout.data.payment.cardNumber).toMatch(/\d{4} \d{4} \d{4} \d{4}/);
  });
});

test.describe('Traditional Playwright with AI Enhancement', () => {
  test('hybrid approach - traditional + AI fallback', async ({ page }) => {
    const healer = new SelfHealingManager(page);

    await page.goto('https://playwright.dev/');

    // Try traditional Playwright first
    try {
      await page.getByRole('link', { name: 'Docs' }).click();
      console.log('Traditional selector worked!');
    } catch (error) {
      console.log('Traditional selector failed, trying AI healing...');
      await healer.clickWithHealing('Docs link');
    }

    // AI-powered verification
    const verifyResult = await healer.verifyWithHealing('Installation heading');
    expect(verifyResult.success).toBeTruthy();
  });
});
