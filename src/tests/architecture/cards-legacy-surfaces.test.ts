/** Card surfaces the cards refresh removed (spec §2.4) stay gone. */
import { existsSync, readFileSync } from "node:fs";

describe("removed card surfaces", () => {
  it("has no orphan lore REST routes, no /vault/admin stub and no duplicate Reference Data card links", () => {
    for (const route of [
      "generate-lore-card",
      "preview-article",
      "category-articles",
      "random-articles",
      "categories",
    ]) {
      expect(existsSync(`src/app/api/wiki/${route}`)).toBe(false);
    }
    expect(existsSync("src/app/api/wiki/article-candidates.ts")).toBe(false);
    expect(existsSync("src/app/vault/admin")).toBe(false);
    expect(
      readFileSync("src/app/admin/reference-data/ReferenceDataPanel.tsx", "utf8")
    ).not.toContain("/admin/cards");
  });
});
