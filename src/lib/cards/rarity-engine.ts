/**
 * The one rarity engine (cards refresh spec §2.1): an article's quality score, read against its source wiki's
 * threshold table, is the rarity a card is imported at. The tables are tuned on the Economy tab (cards.config.ts);
 * after import a card's rarity only changes by an audited admin override. Pure and client-safe.
 */
import { z } from "zod";
import { CardRarity } from "~/lib/cards/enums";
import type { CardWikiSource } from "~/lib/cards/card-sources";

/** What a quality score is made of, read from the article at import. */
export interface ArticleSignals {
  /** Characters of cleaned article text. */
  length: number;
  referenceCount: number;
  inboundLinks: number;
  categoryCount: number;
  hasInfobox: boolean;
  isFeatured: boolean;
}

/** 0 to 100: length (up to 30), references (30), inbound links (20), featured (20), infobox (5), categories (5). */
export function qualityScore(s: ArticleSignals): number {
  const score =
    Math.min((s.length / 1000) * 0.3, 30) +
    Math.min(s.referenceCount * 5 * 0.3, 30) +
    Math.min(s.inboundLinks * 2 * 0.2, 20) +
    (s.isFeatured ? 20 : 0) +
    (s.hasInfobox ? 5 : 0) +
    Math.min(s.categoryCount * 0.5, 5);
  return Math.min(score, MAX_QUALITY_SCORE);
}

/** The rarities a table gives a minimum score, lowest first; below Uncommon's minimum a card is Common. */
export const TIERED_RARITIES = [
  CardRarity.UNCOMMON,
  CardRarity.RARE,
  CardRarity.ULTRA_RARE,
  CardRarity.EPIC,
  CardRarity.LEGENDARY,
] as const;
export type TieredRarity = (typeof TIERED_RARITIES)[number];
export type RarityThresholds = Record<TieredRarity, number>;

/** The highest quality score, and so the highest minimum a rarity table can set. */
export const MAX_QUALITY_SCORE = 100;

// A sentence, as the Economy tab shows the first issue as it is.
const SCORE_RANGE = `Each minimum score must be a number from 0 to ${MAX_QUALITY_SCORE}`;
const minScore = z
  .number({ error: SCORE_RANGE })
  .min(0, { error: SCORE_RANGE })
  .max(MAX_QUALITY_SCORE, { error: SCORE_RANGE });

export const RarityThresholdsSchema = z
  .object({
    UNCOMMON: minScore,
    RARE: minScore,
    ULTRA_RARE: minScore,
    EPIC: minScore,
    LEGENDARY: minScore,
  })
  .refine(
    (table) =>
      TIERED_RARITIES.every(
        (rarity, i) => i === 0 || table[rarity] > table[TIERED_RARITIES[i - 1]]
      ),
    { message: "Each rarity needs a higher minimum score than the one below it" }
  );

/** The generator's calibration on IxWiki. The other wikis start from it until an admin tunes their table. */
const IXWIKI_THRESHOLDS: Readonly<RarityThresholds> = Object.freeze({
  UNCOMMON: 21,
  RARE: 41,
  ULTRA_RARE: 61,
  EPIC: 81,
  LEGENDARY: 96,
});

export const DEFAULT_RARITY_THRESHOLDS: Readonly<Record<CardWikiSource, RarityThresholds>> = {
  ixwiki: IXWIKI_THRESHOLDS,
  iiwiki: IXWIKI_THRESHOLDS,
  althistory: IXWIKI_THRESHOLDS,
  commons: IXWIKI_THRESHOLDS,
};

/** The highest rarity whose minimum the score reaches, else Common. */
export function rarityForScore(score: number, thresholds: RarityThresholds): CardRarity {
  for (let i = TIERED_RARITIES.length - 1; i >= 0; i--) {
    const rarity = TIERED_RARITIES[i];
    if (score >= thresholds[rarity]) return rarity;
  }
  return CardRarity.COMMON;
}
