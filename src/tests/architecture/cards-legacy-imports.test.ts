/** Card surfaces the cards refresh removed (spec §2.4) stay gone: imports. */
import { existsSync } from "node:fs";

describe("removed card surfaces", () => {
  it("has no lore batch studio, Commons flag importer, request-free maintenance tools or unified log (Task 10)", () => {
    for (const file of [
      "CardImportStudio.tsx",
      "LoreCardBatchAdmin.tsx",
      "CommonsFlagImporterAdmin.tsx",
      "lore-batch/LoreBatchDialogs.tsx",
      "lore-batch/useLoreBatchQueue.ts",
    ]) {
      expect(existsSync(`src/app/admin/cards/${file}`)).toBe(false);
    }
    expect(existsSync("src/server/api/routers/lore-cards/maintenance.ts")).toBe(false);
    expect(existsSync("src/server/api/routers/cards/operations.ts")).toBe(false);
    expect(existsSync("src/lib/flags/commons-flag-importer.ts")).toBe(false);
  });
});
