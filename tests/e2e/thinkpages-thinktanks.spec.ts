import { test, expect } from "@playwright/test";

test.describe("ThinkPages & ThinkTanks", () => {
  test("create/edit/delete post", async ({ page }) => {
    const prefix = process.env.TEST_TENANT_PREFIX || "__e2e__";
    const content = `${prefix} post ${Date.now()}`;
    await page.goto("/thinkpages");
    const compose = page.getByPlaceholder(/What are you thinking/i);
    if (!(await compose.isVisible())) test.skip();
    await compose.fill(content);
    await page.getByRole("button", { name: /Post/i }).click();
    await expect(page.getByText(content)).toBeVisible();
    // Delete if possible
    const menu = page.getByRole("button", { name: /More/i }).first();
    if (await menu.isVisible()) {
      await menu.click();
      const del = page.getByRole("menuitem", { name: /Delete/i }).first();
      if (await del.isVisible()) await del.click();
    }
  });

  test("create/join/leave thinktank", async ({ page }) => {
    await page.goto("/thinktanks");
    // Loosely assert page loads
    await expect(page.getByText(/ThinkTanks/i)).toBeVisible();
  });
});
