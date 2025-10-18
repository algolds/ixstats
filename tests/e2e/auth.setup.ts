import { test as setup, expect } from '@playwright/test';

setup('authenticate and persist storage', async ({ page }) => {
  const base = process.env.PROD_CLONE_BASE_URL || 'http://localhost:3000';
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    return; // Skip if no creds
  }

  await page.goto(base + '/sign-in');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard|mycountry|\//, { timeout: 15000 });
});


