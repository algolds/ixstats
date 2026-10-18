/** @jest-environment node */
/**
 * The dust EV guard (replaces the old pack-junk EV test): fusing then breaking down, and crafting then breaking
 * down, never return more dust than went in, for the defaults and for hostile admin numbers after clamping. A fused
 * copy is import-discounted when any of its inputs was, as the Workshop's fuse writes it.
 */
import type { CardFinish, CardRarity } from "@prisma/client";
import {
  CARD_ECONOMY_DEFAULTS,
  clampEconomyConfig,
  type CardEconomyConfig,
} from "~/lib/cards/economy-config";
import { CARD_VALUATION_DEFAULTS } from "~/lib/cards/valuation";
import { craftQuote, dustYield, type DustCopy } from "~/lib/cards/dust";
import { nextFinish } from "~/lib/cards/finish";

const RARITIES: CardRarity[] = ["COMMON", "UNCOMMON", "RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"];
const FINISHES: CardFinish[] = ["STANDARD", "FOIL", "HOLO", "SERIALISED"];
const FUSIBLE: CardFinish[] = ["STANDARD", "FOIL"];

const HOSTILE: Partial<CardEconomyConfig>[] = [
  {},
  { fusionCopies: 2 },
  { fusionCopies: 2, dustFoilMult: 10, dustHoloMult: 1000 },
  { fusionCopies: 2, dustFoilMult: 2, dustHoloMult: 4 },
  { fusionCopies: 1, dustFoilMult: 3, dustHoloMult: 9 },
  { dustFoilMult: 2.6, dustHoloMult: 7.7 },
  { dustFoilMult: 0, dustHoloMult: -4 },
  { dustHoloMult: Number.POSITIVE_INFINITY, dustFoilMult: Number.NaN },
  { dustImportMult: 0.33, dustUncommon: 17 },
  { dustImportMult: 0.29, dustRare: 100, dustEpic: 333.7 },
  { dustImportMult: 1, dustCommon: 1 },
  { dustImportMult: 0 },
  { craftDustMult: 0.1 },
  { craftDustMult: 1, dustLegendary: 7 },
  { craftDustMult: 1.1, dustRare: 50 },
  { fusionCopies: 10, dustFoilMult: 10, dustHoloMult: 100, dustImportMult: 0.9 },
  { fusionCopies: 50, dustFoilMult: 50, dustHoloMult: 2500 },
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
      expect(dustYield(crafted, cfg)).toBeLessThanOrEqual(
        craftQuote(rarity, cfg, CARD_VALUATION_DEFAULTS).dust
      );
    }
  });

  it("pays and charges whole, non-negative dust that fits an Int, for every rarity and finish", () => {
    const fits = (dust: number) => Number.isInteger(dust) && dust >= 0 && dust <= INT_MAX;
    for (const rarity of RARITIES) {
      expect(fits(craftQuote(rarity, cfg, CARD_VALUATION_DEFAULTS).dust)).toBe(true);
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
