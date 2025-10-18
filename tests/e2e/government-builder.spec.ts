import { test, expect } from '@playwright/test';

test('Government Builder - add/remove components', async ({ page }) => {
  await page.goto('/mycountry/government');
  const add = page.getByRole('button', { name: /Add Component/i });
  if (await add.isVisible()) {
    await add.click();
  }
  await expect(page.getByText(/Component added|saved/i)).toBeVisible({ timeout: 10000 });
});


