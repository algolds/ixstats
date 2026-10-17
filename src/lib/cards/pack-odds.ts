/**
 * A pack's odds per rarity, as stored on CardPack (percent per card), and the bounds the pack editor and the server
 * share. Odds are shown in the store, so they add up to 100. Client-safe.
 */
import { z } from "zod";

/** Each rarity, lowest first, with its CardPack odds column. */
export const PACK_ODDS_FIELDS = [
  ["COMMON", "commonOdds"],
  ["UNCOMMON", "uncommonOdds"],
  ["RARE", "rareOdds"],
  ["ULTRA_RARE", "ultraRareOdds"],
  ["EPIC", "epicOdds"],
  ["LEGENDARY", "legendaryOdds"],
] as const;

export type PackOddsField = (typeof PACK_ODDS_FIELDS)[number][1];
export type PackOdds = Record<PackOddsField, number>;

/** A new pack's odds: the CardPack column defaults. */
export const DEFAULT_PACK_ODDS: Readonly<PackOdds> = {
  commonOdds: 65,
  uncommonOdds: 25,
  rareOdds: 7,
  ultraRareOdds: 2,
  epicOdds: 0.9,
  legendaryOdds: 0.1,
};

export const PACK_MAX_PRICE = 1_000_000;
export const PACK_MAX_CARDS = 20;
/** The most a pack's total stock or per-player limit can be (well inside the int4 columns). */
export const PACK_MAX_LIMIT = 1_000_000;

export function packOddsTotal(odds: PackOdds): number {
  return PACK_ODDS_FIELDS.reduce((sum, [, field]) => sum + odds[field], 0);
}

/** True when the odds add up to 100, within float rounding. */
export function oddsAddUp(odds: PackOdds): boolean {
  return Math.abs(packOddsTotal(odds) - 100) <= 0.01;
}

const percent = z.number().min(0).max(100);

export const PackOddsSchema = z
  .object({
    commonOdds: percent,
    uncommonOdds: percent,
    rareOdds: percent,
    ultraRareOdds: percent,
    epicOdds: percent,
    legendaryOdds: percent,
  })
  .refine(oddsAddUp, { message: "The odds must add up to 100%" });
