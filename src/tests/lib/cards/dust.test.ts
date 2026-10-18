/** @jest-environment node */
import { CARD_ECONOMY_DEFAULTS as cfg, clampEconomyConfig } from "~/lib/cards/economy-config";
import { CARD_VALUATION_DEFAULTS as valuation } from "~/lib/cards/valuation";
import {
  copyBlocker,
  craftability,
  craftQuote,
  dustYield,
  fusionBlocker,
  standardDust,
  type WorkshopCopy,
} from "~/lib/cards/dust";

const copy = (over: Partial<WorkshopCopy> = {}): WorkshopCopy => ({
  cardId: "c1",
  rarity: "COMMON",
  finish: "STANDARD",
  importDiscounted: false,
  inscription: null,
  isLocked: false,
  isBound: false,
  ...over,
});

describe("dust", () => {
  it.each([
    ["COMMON", 5],
    ["UNCOMMON", 15],
    ["RARE", 50],
    ["ULTRA_RARE", 150],
    ["EPIC", 500],
    ["LEGENDARY", 1500],
  ] as const)("a Standard %s copy breaks down for %d", (rarity, dust) => {
    expect(standardDust(rarity, cfg)).toBe(dust);
    expect(dustYield(copy({ rarity }), cfg)).toBe(dust);
  });

  it("multiplies Foil by 3 and Holo by 9, and quarters an imported copy (rounded down first)", () => {
    expect(dustYield(copy({ rarity: "RARE", finish: "FOIL" }), cfg)).toBe(150);
    expect(dustYield(copy({ rarity: "RARE", finish: "HOLO" }), cfg)).toBe(450);
    expect(dustYield(copy({ rarity: "UNCOMMON", importDiscounted: true }), cfg)).toBe(3);
    expect(
      dustYield(copy({ rarity: "UNCOMMON", finish: "FOIL", importDiscounted: true }), cfg)
    ).toBe(9);
  });

  it("works out the import share exactly, in whole dust", () => {
    const share = clampEconomyConfig({ ...cfg, dustRare: 100, dustImportMult: 0.57 });
    expect(dustYield(copy({ rarity: "RARE", importDiscounted: true }), share)).toBe(57);
    expect(dustYield(copy({ rarity: "RARE", finish: "HOLO", importDiscounted: true }), share)).toBe(
      513
    );
    // 0.123456 of 100,000 is 12,345.6; the share applies 0.1234.
    const fine = clampEconomyConfig({ ...cfg, dustRare: 100_000, dustImportMult: 0.123456 });
    expect(dustYield(copy({ rarity: "RARE", importDiscounted: true }), fine)).toBe(12_340);
    const none = clampEconomyConfig({ ...cfg, dustImportMult: 0 });
    expect(
      dustYield(copy({ rarity: "LEGENDARY", finish: "HOLO", importDiscounted: true }), none)
    ).toBe(0);
  });

  it("gives nothing for a Serialised copy", () => {
    expect(dustYield(copy({ finish: "SERIALISED" }), cfg)).toBe(0);
    expect(dustYield(copy({ rarity: "LEGENDARY", finish: "SERIALISED" }), cfg)).toBe(0);
  });

  it("prices a craft at 8x the Standard yield plus the rarity floor", () => {
    expect(craftQuote("COMMON", cfg, valuation)).toEqual({ dust: 40, credits: 10 });
    expect(craftQuote("EPIC", cfg, valuation)).toEqual({ dust: 4000, credits: 1000 });
  });

  it("prices a craft exactly, rounding a part dust up", () => {
    expect(craftQuote("RARE", { ...cfg, craftDustMult: 1.1 }, valuation).dust).toBe(55);
    expect(craftQuote("COMMON", { ...cfg, craftDustMult: 1.1 }, valuation).dust).toBe(6);
  });

  it("never prices a craft above its stated multiplier", () => {
    // 1.00006 × 50 is 50.003 and 1.00006 × 100,000 is 100,006; the cost applies 1.0000.
    expect(craftQuote("RARE", { ...cfg, craftDustMult: 1.00006 }, valuation).dust).toBe(50);
    const big = { ...cfg, dustRare: 100_000, craftDustMult: 1.00006 };
    expect(craftQuote("RARE", big, valuation).dust).toBe(100_000);
  });

  it("charges the rarity floor in whole cents, never below 0, and the default floor for one that is not finite", () => {
    const quote = (floorCommon: number) =>
      craftQuote("COMMON", cfg, { ...valuation, floorCommon }).credits;
    expect(quote(-5)).toBe(0);
    expect(quote(Number.POSITIVE_INFINITY)).toBe(10);
    expect(quote(Number.NaN)).toBe(10);
    expect(quote(10.29)).toBe(10.29);
    expect(quote(1.13)).toBe(1.13);
    expect(quote(10.005)).toBe(10);
  });

  it("refuses Legendary, bound, Special, Trophy and retired cards", () => {
    const card = { rarity: "EPIC", cardType: "LORE", isBound: false, isRetired: false } as const;
    expect(craftability(card)).toEqual({ ok: true });
    expect(craftability({ ...card, cardType: "NS" })).toEqual({ ok: true });
    expect(craftability({ ...card, rarity: "LEGENDARY" })).toEqual({
      ok: false,
      reason: "Legendary cards can't be crafted.",
    });
    const uncraftable = { ok: false, reason: "This card can't be crafted." };
    expect(craftability({ ...card, isBound: true })).toEqual(uncraftable);
    expect(craftability({ ...card, cardType: "SPECIAL" })).toEqual(uncraftable);
    expect(craftability({ ...card, cardType: "TROPHY" })).toEqual(uncraftable);
    expect(craftability({ ...card, isRetired: true })).toEqual({
      ok: false,
      reason: "Retired cards can't be crafted.",
    });
  });

  it("names why a copy can't be broken down", () => {
    expect(copyBlocker(copy(), "break down")).toBeNull();
    expect(copyBlocker(copy(), "fuse")).toBeNull();
    expect(copyBlocker(copy({ isBound: true }), "break down")).toBe(
      "Bound cards can't be broken down."
    );
    expect(copyBlocker(copy({ finish: "SERIALISED" }), "fuse")).toBe(
      "Serialised copies can't be fused."
    );
    expect(copyBlocker(copy({ inscription: "gg" }), "break down")).toBe(
      "Signed copies can't be broken down."
    );
    expect(copyBlocker(copy({ isLocked: true }), "fuse")).toBe(
      "A copy that is listed or in a trade can't be fused."
    );
  });

  it("fuses exactly three copies of one card at one fusible finish", () => {
    expect(fusionBlocker([copy(), copy(), copy()], cfg)).toBeNull();
    expect(fusionBlocker([], cfg)).toBe("Fusing takes 3 copies.");
    expect(fusionBlocker([copy(), copy()], cfg)).toBe("Fusing takes 3 copies.");
    expect(fusionBlocker([copy(), copy(), copy(), copy()], cfg)).toBe("Fusing takes 3 copies.");
    expect(fusionBlocker([copy(), copy(), copy({ cardId: "c2" })], cfg)).toBe(
      "Fuse copies of one card at the same finish."
    );
    expect(fusionBlocker([copy(), copy(), copy({ finish: "FOIL" })], cfg)).toBe(
      "Fuse copies of one card at the same finish."
    );
    const holo = copy({ finish: "HOLO" });
    expect(fusionBlocker([holo, holo, holo], cfg)).toBe(
      "Holo is the highest finish fusing reaches."
    );
    const serialised = copy({ finish: "SERIALISED" });
    expect(fusionBlocker([serialised, serialised, serialised], cfg)).toBe(
      "Serialised copies can't be fused."
    );
    expect(fusionBlocker([copy(), copy(), copy({ inscription: "x" })], cfg)).toBe(
      "Signed copies can't be fused."
    );
    expect(fusionBlocker([copy(), copy()], { ...cfg, fusionCopies: 2 })).toBeNull();
    expect(fusionBlocker([], { fusionCopies: 0 })).toBe("Fusing takes 0 copies.");
  });
});
