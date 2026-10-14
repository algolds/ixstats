/** @jest-environment node */
/**
 * The Lorewards view ships in the standalone WikiOS bundle (/util/lorewards), so it must not pull in anything
 * that belongs to the Vault: no Vault components, no server modules, and from `~/lib/vault` only types.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "src/components/lorewards");
const IMPORT = /^import\s+(type\s+)?[^;]*?from\s+"([^"]+)";/gms;

describe("components/lorewards imports", () => {
  const files = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f));

  it("has the view and its sections", () => {
    expect(files).toEqual(expect.arrayContaining(["LorewardsView.tsx", "YourLorewards.tsx"]));
  });

  it.each(files)("%s imports nothing Vault-only", (file) => {
    const source = readFileSync(join(DIR, file), "utf8");
    for (const [, typeOnly, from] of source.matchAll(IMPORT)) {
      expect(from).not.toMatch(/^~\/(components\/vault|server|hooks\/vault)/);
      if (from!.startsWith("~/lib/vault")) expect(typeOnly).toBeTruthy();
    }
  });
});
