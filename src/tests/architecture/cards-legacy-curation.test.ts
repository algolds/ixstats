/** Card surfaces the cards refresh removed stay gone: curation. */
import { existsSync } from "node:fs";

describe("removed card surfaces", () => {
  it("has no paid lore request flow (Task 12)", () => {
    expect(existsSync("src/server/api/routers/lore-cards/admin.ts")).toBe(false);
    expect(existsSync("src/server/api/routers/lore-cards/user.ts")).toBe(false);
    expect(existsSync("src/app/admin/cards/lore-batch")).toBe(false);
    expect(existsSync("src/components/cards/lore/LoreCardGenerator.tsx")).toBe(false);
  });
});
