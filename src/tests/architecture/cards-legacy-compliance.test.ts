/** Card surfaces the cards refresh removed (spec §2.4) stay gone: compliance. */
import { existsSync, readFileSync } from "node:fs";

describe("removed card surfaces", () => {
  it("has one takedown path: no NS-only admin hide, restore or list (Task 17)", () => {
    expect(existsSync("src/app/admin/cards/CardTakedownsAdmin.tsx")).toBe(false);
    const nsCards = readFileSync("src/server/api/routers/ns-import/cards.ts", "utf8");
    for (const name of [
      "hideNSCard",
      "restoreNSCard",
      "listHiddenNSCards",
      "retireCardArtwork",
      "findNSCard",
      "adminProcedure",
      "nsTakedown",
    ]) {
      expect(nsCards).not.toContain(name);
    }
  });
});
