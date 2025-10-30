import { test, expect } from "@playwright/test";

test("MyCountry datapoints round-trip", async ({ page }) => {
  const prefix = process.env.TEST_TENANT_PREFIX || "__e2e__";
  const name = `${prefix}-${Date.now()}-datapoints`;

  // Create from scratch
  await page.goto("/mycountry/builder");
  await page.getByLabel(/Country name/i).fill(name);
  await page.getByLabel(/Population/i).fill("1234567");
  await page.getByLabel(/GDP per capita/i).fill("34567");
  await page.getByRole("button", { name: /Create Country/i }).click();
  await expect(page).toHaveURL(new RegExp(`/mycountry/${name}`));

  // Edit key datapoints
  await page.getByRole("button", { name: /Edit/i }).click();
  await page.getByLabel(/Population/i).fill("2234567");
  await page.getByLabel(/GDP per capita/i).fill("44567");
  await page.getByRole("button", { name: /Save/i }).click();
  await expect(page.getByText(/2234567/)).toBeVisible();
  await expect(page.getByText(/44,567/)).toBeVisible();
});
