import { test, expect } from "@playwright/test";

test.describe("Tax Builder - Basic", () => {
  test("switch calculation methods and save", async ({ page }) => {
    await page.goto("/mycountry/tax");

    // Switch to Progressive
    await page.getByRole("button", { name: /Progressive/i }).click();
    await expect(page.getByText(/Progressive/i)).toBeVisible();

    // Add a bracket
    const addBracket = page.getByRole("button", { name: /Add Bracket/i });
    if (await addBracket.isVisible()) {
      await addBracket.click();
    }

    // Save
    const save = page.getByRole("button", { name: /Save/i });
    if (await save.isVisible()) {
      await save.click();
    }

    // Expect no error toast
    await expect(page.getByText(/saved|updated/i)).toBeVisible({ timeout: 15000 });
  });
});
