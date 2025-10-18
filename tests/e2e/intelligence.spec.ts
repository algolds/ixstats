import { test, expect } from '@playwright/test';

test('Intelligence dashboards render', async ({ page }) => {
  await page.goto('/intelligence');
  await expect(page.getByText(/Briefings|Alerts|Hot Issues/i)).toBeVisible();
});


