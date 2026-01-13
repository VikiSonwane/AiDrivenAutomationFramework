import { test, expect } from '@playwright/test';

/**
 * Auto-generated test: Auto-generated-test-1768229592611
 * Description: login to http://dev.sony-music-atlas.oysterlabs.com/login
 * Generated: 2026-01-12T14:54:51.409Z
 */

test.describe('Auto-generated-test-1768229592611', () => {
  test('login to http://dev.sony-music-atlas.oysterlabs.com/login', async ({ page }) => {
        // Step 1: Enter email
    await page.getByRole('textbox', { name: /email/i }).fill('test@example.com');

    // Step 2: Enter password
    await page.getByLabel(/password/i).fill('password123');

    // Step 3: Click Log in button
    await page.getByRole('button', { name: /login button/i }).click();
  });
});
