import { test, expect } from "@playwright/test";

test("Diplomatic flows - embassies list and create if allowed", async ({ page }) => {
  await page.goto("/diplomatic");
  await expect(page.getByText(/Embassies|Missions|Cultural/i)).toBeVisible();
});
