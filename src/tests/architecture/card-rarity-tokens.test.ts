/** @jest-environment node */
/**
 * One rarity palette: six Facet tokens declared once and the same in both themes, mirrored in CARD_RARITY_HEX, and the
 * card face reading them through `data-card-rarity` only (no rarity utility classes).
 */
import fs from "fs";
import path from "path";
import { CARD_RARITY_HEX } from "~/lib/design/tokens";

const styles = path.resolve(__dirname, "../../styles");
const src = path.resolve(__dirname, "../..");

function filesUnder(dir: string, extensions: RegExp): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full, extensions);
    return extensions.test(entry.name) ? [full] : [];
  });
}

/** Every sheet, so a per-theme override in any of them counts as a second declaration. */
const tokens = filesUnder(styles, /\.css$/)
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
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
  it("declares each rarity once, with its CARD_RARITY_HEX value", () => {
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

  it("pins the six hues", () => {
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

  it("is read only through data-card-rarity, never as a rarity utility class", () => {
    // The light-theme edge and gem are darkened at the element (--card-rarity-paint); a utility would paint the raw hue.
    const utility = /(?<![\w-])(?:text|bg|border|fill|stroke)-rarity-/;
    const offenders = filesUnder(src, /\.(?:tsx?|css|mdx?)$/).filter(
      (file) => file !== __filename && utility.test(fs.readFileSync(file, "utf8"))
    );
    expect(offenders.map((file) => path.relative(src, file))).toEqual([]);
  });
});
