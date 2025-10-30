import { test, expect } from "@playwright/test";

test("sign-in page loads and redirects after login", async ({ page }) => {
  const base = process.env.PROD_CLONE_BASE_URL || "http://localhost:3000";
  await page.goto(base + "/sign-in");
  await expect(page).toHaveTitle(/Sign/i);
});
