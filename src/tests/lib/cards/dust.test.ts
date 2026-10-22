/** @jest-environment node */
/**
 * Dust (`src/lib/cards/dust.ts`): each rarity's Standard yield, the Foil and Holo multiples and the import share in
 * whole dust, a craft's price, and what can be crafted. The EV guard: fusing then breaking down, and crafting then
 * breaking down, never return more dust than went in, at the defaults and for hostile admin numbers after clamping,
 * and every yield and price fits the Int column. A fused copy is import-discounted when any of its inputs was.
 *
 * Folds economy-ev.
 */
import type { CardFinish, CardRarity } from "@prisma/client";
import {
  CARD_ECONOMY_DEFAULTS,
  CARD_ECONOMY_DEFAULTS as cfg,
  clampEconomyConfig,
  type CardEconomyConfig,
} from "~/lib/cards/economy-config";
import { CARD_VALUATION_DEFAULTS as valuation } from "~/lib/cards/valuation";
import {
  craftability,
  craftQuote,
  dustYield,
  standardDust,
  type DustCopy,
  type WorkshopCopy,
} from "~/lib/cards/dust";
import { nextFinish } from "~/lib/cards/finish";

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

  it("prices a craft at 8x the Standard yield plus the rarity floor", () => {
    expect(craftQuote("COMMON", cfg, valuation)).toEqual({ dust: 40, credits: 10 });
    expect(craftQuote("EPIC", cfg, valuation)).toEqual({ dust: 4000, credits: 1000 });
  });

  it("prices a craft exactly, rounding a part dust up", () => {
    expect(craftQuote("RARE", { ...cfg, craftDustMult: 1.1 }, valuation).dust).toBe(55);
    expect(craftQuote("COMMON", { ...cfg, craftDustMult: 1.1 }, valuation).dust).toBe(6);
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
});

const RARITIES: CardRarity[] = ["COMMON", "UNCOMMON", "RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"];
const FINISHES: CardFinish[] = ["STANDARD", "FOIL", "HOLO", "SERIALISED"];
const FUSIBLE: CardFinish[] = ["STANDARD", "FOIL"];

/** Admin numbers that each push one clamp: the defaults, a loop-making fusion, a fusion of 1, part multiples, numbers
 * that are not finite, a part import share, a craft below one yield, and every number at its ceiling. */
const HOSTILE: Partial<CardEconomyConfig>[] = [
  {},
  { fusionCopies: 2, dustFoilMult: 10, dustHoloMult: 1000 },
  { fusionCopies: 1, dustFoilMult: 3, dustHoloMult: 9 },
  { dustFoilMult: 2.6, dustHoloMult: 7.7 },
  { dustHoloMult: Number.POSITIVE_INFINITY, dustFoilMult: Number.NaN },
  { dustImportMult: 0.29, dustRare: 100, dustEpic: 333.7 },
  { craftDustMult: 0.1 },
  { fusionCopies: 10, dustFoilMult: 10, dustHoloMult: 100, dustLegendary: 3e8, craftDustMult: 1e6 },
];

/** The largest Int column value (CardDustBalance.balance). */
const INT_MAX = 2_147_483_647;

/** Every way to mark n inputs imported or not. */
function importPatterns(n: number): boolean[][] {
  return Array.from({ length: 2 ** n }, (_, mask) =>
    Array.from({ length: n }, (_, i) => Boolean(mask & (1 << i)))
  );
}

function fusedYield(inputs: DustCopy[], cfg: CardEconomyConfig): number {
  const finish = nextFinish(inputs[0]!.finish);
  if (!finish) throw new Error("not fusible");
  return dustYield(
    { rarity: inputs[0]!.rarity, finish, importDiscounted: inputs.some((c) => c.importDiscounted) },
    cfg
  );
}

describe.each(
  HOSTILE.map((over): [string, CardEconomyConfig] => [
    JSON.stringify(over),
    clampEconomyConfig({ ...CARD_ECONOMY_DEFAULTS, ...over }),
  ])
)("dust EV with %s", (_label, cfg) => {
  it("fuse then break down never beats breaking the inputs down", () => {
    for (const rarity of RARITIES) {
      for (const finish of FUSIBLE) {
        for (const pattern of importPatterns(cfg.fusionCopies)) {
          const inputs = pattern.map((importDiscounted) => ({ rarity, finish, importDiscounted }));
          const separately = inputs.reduce((sum, c) => sum + dustYield(c, cfg), 0);
          expect(fusedYield(inputs, cfg)).toBeLessThanOrEqual(separately);
        }
      }
    }
  });

  it("craft then break down never returns more dust than the craft cost", () => {
    for (const rarity of RARITIES) {
      const crafted = { rarity, finish: "STANDARD" as const, importDiscounted: false };
      expect(dustYield(crafted, cfg)).toBeLessThanOrEqual(craftQuote(rarity, cfg, valuation).dust);
    }
  });

  it("pays and charges whole, non-negative dust that fits an Int, for every rarity and finish", () => {
    const fits = (dust: number) => Number.isInteger(dust) && dust >= 0 && dust <= INT_MAX;
    for (const rarity of RARITIES) {
      expect(fits(craftQuote(rarity, cfg, valuation).dust)).toBe(true);
      for (const finish of FINISHES) {
        for (const importDiscounted of [false, true]) {
          expect(fits(dustYield({ rarity, finish, importDiscounted }, cfg))).toBe(true);
        }
      }
    }
  });
});

it("at the defaults fusion is exactly neutral: 3 Standard = 1 Foil, 3 Foil = 1 Holo", () => {
  const cfg = CARD_ECONOMY_DEFAULTS;
  for (const rarity of RARITIES) {
    const standard = { rarity, finish: "STANDARD" as const, importDiscounted: false };
    const foil = { ...standard, finish: "FOIL" as const };
    expect(fusedYield([standard, standard, standard], cfg)).toBe(3 * dustYield(standard, cfg));
    expect(fusedYield([foil, foil, foil], cfg)).toBe(3 * dustYield(foil, cfg));
  }
});
