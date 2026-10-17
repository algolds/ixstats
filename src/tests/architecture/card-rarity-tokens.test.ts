/** @jest-environment node */
/**
 * One rarity palette (spec §3 UX details): the hues the cards rendered from display-utils, as Facet tokens declared
 * once and the same in both themes, and the card face reading them through `data-card-rarity`.
 */
import fs from "fs";
import path from "path";
import { CARD_RARITY_HEX } from "~/lib/design/tokens";

const styles = path.resolve(__dirname, "../../styles");
const tokens = fs.readFileSync(path.join(styles, "facet/tokens.css"), "utf8");
const cardArt = fs.readFileSync(path.join(styles, "card-art.css"), "utf8");

const ATTRIBUTE: Record<keyof typeof CARD_RARITY_HEX, string> = {
  common: "COMMON",
  uncommon: "UNCOMMON",
  rare: "RARE",
  "ultra-rare": "ULTRA_RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};

describe("card rarity tokens", () => {
  it("declares each rarity once, with the display-utils hue", () => {
    for (const [name, hex] of Object.entries(CARD_RARITY_HEX)) {
      const declarations = [
        ...tokens.matchAll(new RegExp(`--color-rarity-${name}:\\s*([^;]+);`, "g")),
      ];
      expect({ name, values: declarations.map((m) => m[1]!.trim()) }).toEqual({
        name,
        values: [hex],
      });
    }
  });

  it("has no other rarity tokens", () => {
    const names = [...tokens.matchAll(/--color-rarity-([a-z-]+):/g)].map((m) => m[1]);
    expect(names.sort()).toEqual(Object.keys(CARD_RARITY_HEX).sort());
  });

  it("keeps the hues the cards render today", () => {
    expect(CARD_RARITY_HEX).toEqual({
      common: "#94a3b8",
      uncommon: "#10b981",
      rare: "#3b82f6",
      "ultra-rare": "#06b6d4",
      epic: "#a855f7",
      legendary: "#eab308",
    });
  });

  it("maps every data-card-rarity value to its token in the card art sheet", () => {
    expect(cardArt).toMatch(
      /\[data-card-rarity\]\s*\{\s*--card-rarity:\s*var\(--color-rarity-common\);/
    );
    for (const [name, attribute] of Object.entries(ATTRIBUTE)) {
      if (name === "common") continue;
      expect(cardArt).toMatch(
        new RegExp(
          `\\[data-card-rarity="${attribute}"\\]\\s*\\{\\s*--card-rarity:\\s*var\\(--color-rarity-${name}\\);`
        )
      );
    }
  });

  it("gives every finish but Standard a sheen", () => {
    for (const finish of ["FOIL", "HOLO", "SERIALISED"]) {
      expect(cardArt).toContain(`[data-card-finish="${finish}"] .card-face-sheen`);
    }
    expect(cardArt).not.toContain('[data-card-finish="STANDARD"]');
  });
});
