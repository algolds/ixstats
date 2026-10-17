/** A pack's odds per rarity, as stored on CardPack (percent per card). They are shown in the store, so they add up to 100. */
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
