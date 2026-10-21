/** Card surfaces the cards refresh removed stay gone: the old pack award path. */
import { existsSync, readFileSync } from "node:fs";

describe("removed card surfaces", () => {
  it("awards packs only through the cards admin tools", () => {
    expect(existsSync("src/server/api/routers/card-packs/admin.ts")).toBe(false);
    expect(readFileSync("src/server/api/routers/card-packs/discovery.ts", "utf8")).not.toContain(
      "getAllPacks"
    );
    expect(readFileSync("src/server/api/routers/card-packs/index.ts", "utf8")).not.toContain(
      "cardPacksAdminRouter"
    );
    expect(readFileSync("src/app/admin/vault/VaultUserDirectory.tsx", "utf8")).not.toContain(
      "adminAwardPack"
    );
  });
});
