import { test, expect } from '@playwright/test';

test('QuickActions render', async ({ page }) => {
  await page.goto('/mycountry/quick');
  await expect(page.getByText(/Cabinet|Policies|Meetings/i)).toBeVisible();
});


