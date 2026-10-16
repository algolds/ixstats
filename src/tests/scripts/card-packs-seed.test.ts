/** @jest-environment node */
/** Cards refresh §3: the pack seed only creates, so it never overwrites an admin's edits; its types are the new enum. */
import { readFileSync } from "node:fs";
import packs from "../../../prisma/seeds/data/card-packs.json";

const seed = readFileSync("prisma/seeds/card-packs.ts", "utf8");

describe("card pack seed", () => {
  it("creates missing packs and never updates existing ones", () => {
    expect(seed).toMatch(/createMany\(\{[\s\S]*skipDuplicates: true/);
    expect(seed).not.toMatch(/\.upsert\(|\.update\(/);
    // The JSON keeps pdsConfig for the pack art generator; the seed strips it (the column is gone).
    expect(seed).toMatch(/pdsConfig: _art, \.\.\.pack/);
  });

  it("names only refreshed card types", () => {
    for (const pack of packs) {
      expect([null, "LORE", "NATION", "NS", "SPECIAL", "TROPHY"]).toContain(pack.cardType);
    }
    expect(packs.filter((pack) => pack.cardType === "NS")).toHaveLength(12);
  });
});
