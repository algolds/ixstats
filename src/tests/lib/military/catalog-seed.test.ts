/** @jest-environment node */
/**
 * P2-7: the equipment catalog lists each item once. The seed keeps the first of each name, and the realm time SQL
 * retires exactly the keys the seed drops, merging them into the keys it keeps.
 */
import fs from "fs";
import path from "path";
import { buildEquipmentCatalogSeed } from "~/lib/military/catalog-seed";
import { builtinEquipmentPresets } from "~/lib/military/player-catalog";

const SQL = fs.readFileSync(
  path.resolve(__dirname, "../../../../scripts/migrations/2026-10-realm-time/r3-catalog-duplicates.sql"),
  "utf8"
);
const pairs = [...SQL.matchAll(/\('([A-Z0-9_]+)', '([A-Z0-9_]+)'\)/g)].map((m) => ({ retired: m[1]!, kept: m[2]! }));

describe("the equipment catalog seed", () => {
  const rows = buildEquipmentCatalogSeed();

  it("names every item once", () => {
    const names = rows.map((r) => r.name);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
    expect(names.filter((n) => n === "Eurofighter Typhoon")).toHaveLength(1);
    expect(builtinEquipmentPresets().filter((p) => p.name === "Eurofighter Typhoon")).toHaveLength(1);
  });

  it("drops exactly the keys the SQL retires, and keeps the keys it merges them into", () => {
    const keys = new Set(rows.map((r) => r.key));
    expect(pairs).toHaveLength(5);
    for (const { retired, kept } of pairs) {
      expect(keys.has(retired)).toBe(false);
      expect(keys.has(kept)).toBe(true);
    }
  });
});
