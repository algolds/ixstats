/** Card surfaces the cards refresh removed (spec §2.4) stay gone: the old explorer and the legacy admin router. */
import { existsSync } from "node:fs";

describe("removed card surfaces", () => {
  it("has no old explorer and no legacy card admin router (Task 20)", () => {
    for (const path of [
      "src/app/admin/cards/AdminCardExplorer.tsx",
      "src/app/admin/cards/explorer",
      "src/server/api/routers/cards/admin-legacy.ts",
      "src/tests/components/admin/cards-explorer.test.tsx",
    ]) {
      expect(existsSync(path)).toBe(false);
    }
  });
});
