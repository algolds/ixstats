/**
 * Rarity rolls and card draws shared by pack opening and the daily card. A draw gives exactly the rolled rarity: a pack
 * whose pool cannot give a rarity it shows is refused (`undeliverableRarities`), and the daily card, whose odds are not
 * shown, rolls only over the rarities that have cards (`oddsWithCards`).
 */
import type { Card, CardRarity, Prisma } from "@prisma/client";
import { EXCLUDE_RESTRICTED_ART } from "./art-licence";
import { RARITY_ORDER } from "./face/labels";
import { CATALOGUE_WHERE } from "./hub/catalogue";
import type { TierCounts } from "./pack-odds";

/** Odds per rarity, in percent. */
export type RarityOdds = Record<CardRarity, number>;

/** One rarity, in proportion to its odds (a negative one counts as none); Common when no rarity has odds. */
export function rollRarity(odds: RarityOdds, random: () => number = Math.random): CardRarity {
  const weight = (rarity: CardRarity) => Math.max(0, odds[rarity]);
  const roll = random() * RARITY_ORDER.reduce((sum, rarity) => sum + weight(rarity), 0);
  let cumulative = 0;
  for (const rarity of RARITY_ORDER) {
    cumulative += weight(rarity);
    if (roll < cumulative) return rarity;
  }
  return "COMMON";
}

/** The pool's cards of each rarity, in one grouped read. */
export async function tierCounts(
  tx: Prisma.TransactionClient,
  poolWhere: Prisma.CardWhereInput
): Promise<TierCounts> {
  const rows = await tx.card.groupBy({ by: ["rarity"], where: poolWhere, _count: { _all: true } });
  const counts: Partial<RarityOdds> = {};
  for (const row of rows) counts[row.rarity] = row._count._all;
  return counts;
}

/** The odds with every rarity that has no card dropped, so the roll falls only on rarities that do (the daily card). */
export function oddsWithCards(odds: RarityOdds, counts: TierCounts): RarityOdds {
  const shared = { ...odds };
  for (const rarity of RARITY_ORDER) {
    if ((counts[rarity] ?? 0) === 0) shared[rarity] = 0;
  }
  return shared;
}

export interface PoolDrawer {
  /** A card of exactly the rolled rarity; null when that rarity has no card. */
  draw(rolled: CardRarity): Promise<Card | null>;
}

/**
 * Draws cards from one pool by its tier counts (read once, in the caller's transaction). A tier counted as empty, or
 * emptied since the count (a card retired or taken down meanwhile), draws null: there is no fallback to another rarity.
 */
export function createPoolDrawer(
  tx: Prisma.TransactionClient,
  poolWhere: Prisma.CardWhereInput,
  counts: TierCounts,
  random: () => number = Math.random
): PoolDrawer {
  return {
    async draw(rolled) {
      const count = counts[rolled] ?? 0;
      if (count === 0) return null;
      return tx.card.findFirst({
        where: { AND: [poolWhere, { rarity: rolled }] },
        orderBy: { id: "asc" },
        skip: Math.floor(random() * count),
      });
    },
  };
}

/**
 * The daily card's pool: the catalogue of every published realm (approved and live, so imports waiting in review,
 * taken-down cards and a draft or generating realm's cards stay out), never bound, Special, Trophy or Nation cards, nor
 * restricted-licence art.
 */
export const DAILY_POOL_WHERE = {
  ...CATALOGUE_WHERE,
  isBound: false,
  cardType: { notIn: ["SPECIAL", "TROPHY", "NATION"] },
  ...EXCLUDE_RESTRICTED_ART,
} satisfies Prisma.CardWhereInput;
