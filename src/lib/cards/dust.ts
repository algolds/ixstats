/**
 * Dust and crafting maths (client-safe). Dust is per realm and account-bound; the ledger lives in
 * `src/server/modules/cards/workshop/dust-ledger.ts`.
 */
import type { CardFinish, CardRarity, CardType } from "@prisma/client";
import type { CardEconomyConfig } from "./economy-config";
import { nextFinish } from "./finish";
import { rarityFloor, type CardValuationConfig } from "./valuation";

export interface DustCopy {
  rarity: CardRarity;
  finish: CardFinish;
  importDiscounted: boolean;
}

const STANDARD_DUST: Record<CardRarity, keyof CardEconomyConfig> = {
  COMMON: "dustCommon",
  UNCOMMON: "dustUncommon",
  RARE: "dustRare",
  ULTRA_RARE: "dustUltraRare",
  EPIC: "dustEpic",
  LEGENDARY: "dustLegendary",
};

export function standardDust(rarity: CardRarity, cfg: CardEconomyConfig): number {
  return cfg[STANDARD_DUST[rarity]];
}

/**
 * Fractional multipliers apply in ten-thousandths, so whole dust times a multiplier is integer arithmetic and rounds
 * exactly (a float 100 × 0.29 is 28.999..., which would lose a whole dust).
 */
const MULT_UNIT = 10_000;
const multUnits = (mult: number) => Math.round(mult * MULT_UNIT);

function finishDustMult(finish: CardFinish, cfg: CardEconomyConfig): number {
  if (finish === "FOIL") return cfg.dustFoilMult;
  if (finish === "HOLO") return cfg.dustHoloMult;
  return 1;
}

/**
 * Dust a copy breaks down for: the Standard yield (an imported NS copy's share, rounded down before the finish so a
 * fused copy can never round up) times the finish's whole multiple. Serialised copies never break down. A fused copy
 * is import-discounted when any of its inputs was, which keeps fusing from ever adding dust (the EV guard in
 * `economy-ev.test.ts`).
 */
export function dustYield(copy: DustCopy, cfg: CardEconomyConfig): number {
  if (copy.finish === "SERIALISED") return 0;
  const standard = standardDust(copy.rarity, cfg);
  const base = copy.importDiscounted
    ? Math.floor((standard * multUnits(cfg.dustImportMult)) / MULT_UNIT)
    : standard;
  return base * finishDustMult(copy.finish, cfg);
}

export interface CraftQuote {
  dust: number;
  credits: number;
}

/**
 * A craft: `craftDustMult` × the Standard yield in the card's realm dust (a part dust rounds up), plus the rarity floor
 * in IxC. A crafted copy is always Standard, so it never breaks down for more than it cost.
 */
export function craftQuote(
  rarity: CardRarity,
  cfg: CardEconomyConfig,
  valuation: CardValuationConfig
): CraftQuote {
  return {
    dust: Math.ceil((standardDust(rarity, cfg) * multUnits(cfg.craftDustMult)) / MULT_UNIT),
    credits: rarityFloor(valuation, rarity),
  };
}

export interface CraftableCard {
  rarity: CardRarity;
  cardType: CardType;
  isBound: boolean;
  isRetired: boolean;
}

export type Verdict = { ok: true } | { ok: false; reason: string };

/** Special event cards stay event-only (packs and the daily card skip them too); trophies are bound. */
const UNCRAFTABLE_TYPES: ReadonlySet<CardType> = new Set<CardType>(["SPECIAL", "TROPHY"]);

export function craftability(card: CraftableCard): Verdict {
  if (card.rarity === "LEGENDARY")
    return { ok: false, reason: "Legendary cards can't be crafted." };
  if (card.isBound || UNCRAFTABLE_TYPES.has(card.cardType)) {
    return { ok: false, reason: "This card can't be crafted." };
  }
  if (card.isRetired) return { ok: false, reason: "Retired cards can't be crafted." };
  return { ok: true };
}

export interface WorkshopCopy extends DustCopy {
  cardId: string;
  inscription: string | null;
  isLocked: boolean;
  isBound: boolean;
}

const PARTICIPLE = { "break down": "broken down", fuse: "fused" } as const;

/** Why one copy can't be broken down or fused, or null. */
export function copyBlocker(copy: WorkshopCopy, action: "break down" | "fuse"): string | null {
  const done = PARTICIPLE[action];
  if (copy.isBound) return `Bound cards can't be ${done}.`;
  if (copy.finish === "SERIALISED") return `Serialised copies can't be ${done}.`;
  if (copy.inscription !== null) return `Signed copies can't be ${done}.`;
  if (copy.isLocked) return `A copy that is listed or in a trade can't be ${done}.`;
  return null;
}

/** Why a set of copies can't be fused, or null: exactly `fusionCopies` of one card at one fusible finish. */
export function fusionBlocker(
  copies: WorkshopCopy[],
  cfg: Pick<CardEconomyConfig, "fusionCopies">
): string | null {
  const [first] = copies;
  if (!first || copies.length !== cfg.fusionCopies)
    return `Fusing takes ${cfg.fusionCopies} copies.`;
  if (copies.some((c) => c.cardId !== first.cardId || c.finish !== first.finish)) {
    return "Fuse copies of one card at the same finish.";
  }
  for (const copy of copies) {
    const blocked = copyBlocker(copy, "fuse");
    if (blocked) return blocked;
  }
  if (nextFinish(first.finish) === null) return "Holo is the highest finish fusing reaches.";
  return null;
}
