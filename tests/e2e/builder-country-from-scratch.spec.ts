import { test, expect } from '@playwright/test';

test.describe('Country Builder - From Scratch', () => {
  test('creates a country successfully', async ({ page }) => {
    const prefix = process.env.TEST_TENANT_PREFIX || '__e2e__';
    const name = `${prefix}-${Date.now()}-land`;

    await page.goto('/mycountry/builder');
    await page.getByLabel(/Country name/i).fill(name);
    await page.getByLabel(/Population/i).fill('1000000');
    await page.getByLabel(/GDP per capita/i).fill('25000');
    await page.getByRole('button', { name: /Create Country/i }).click();

    await expect(page).toHaveURL(new RegExp(`/mycountry/${name}`));
    await expect(page.getByText(name)).toBeVisible();
  });
});


