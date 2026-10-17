/** Card surfaces the cards refresh removed stay gone: the old Designer studio, its seed and its rarity engine. */
import { existsSync, readFileSync } from "node:fs";

describe("removed card surfaces", () => {
  it("has one Designer, for Special cards, and no seed or second rarity engine", () => {
    for (const path of [
      "src/components/cards/designer",
      "src/lib/achievements/card-rewards.ts",
      "prisma/seeds/achievement-cards.ts",
      "src/lib/cards/rarity-algorithm.ts",
      "src/lib/cards/subcategory-registry.ts",
    ]) {
      expect(existsSync(path)).toBe(false);
    }
    const wiki = readFileSync("src/server/api/routers/lore-cards/wiki.ts", "utf8");
    for (const name of ["createCustomDesignedCard", "searchLoreArchive", "fetchLoreMetadata"]) {
      expect(wiki).not.toContain(name);
    }
  });
});
