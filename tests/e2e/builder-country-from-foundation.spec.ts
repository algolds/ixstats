import { test, expect } from "@playwright/test";

test("Country Builder - From Foundation", async ({ page }) => {
  const prefix = process.env.TEST_TENANT_PREFIX || "__e2e__";
  const name = `${prefix}-${Date.now()}-foundation`;

  await page.goto("/mycountry/builder");
  await page.getByRole("tab", { name: /Foundation/i }).click();
  // pick first foundation country option
  const dropdown = page.getByLabel(/Foundation Country/i);
  if (await dropdown.isVisible()) {
    await dropdown.selectOption({ index: 1 });
  }
  await page.getByLabel(/Country name/i).fill(name);
  await page.getByRole("button", { name: /Create Country/i }).click();
  await expect(page).toHaveURL(new RegExp(`/mycountry/${name}`));
});
