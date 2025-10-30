import { test, expect } from "@playwright/test";

test("Country Builder - From iiWiki Import", async ({ page }) => {
  const prefix = process.env.TEST_TENANT_PREFIX || "__e2e__";
  const name = `${prefix}-${Date.now()}-wiki`;

  await page.goto("/mycountry/builder");
  await page.getByRole("tab", { name: /Import/i }).click();
  await page.getByPlaceholder(/Search iiWiki/i).fill("Test");
  await page.getByRole("button", { name: /Search/i }).click();
  // select first result if available
  const first = page.getByRole("button", { name: /Import/i }).first();
  if (await first.isVisible({ timeout: 10000 })) {
    await first.click();
  }
  await page.getByLabel(/Country name/i).fill(name);
  await page.getByRole("button", { name: /Create Country/i }).click();
  await expect(page).toHaveURL(new RegExp(`/mycountry/${name}`));
});
