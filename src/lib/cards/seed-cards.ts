/**
 * The six Lore cards seeded by hand into Ixnay on 2026-02-16, before cards came from wiki articles. They have no
 * article behind them, so the card categories phase retires them (`scripts/cards/retire-seed-cards.ts`).
 */

/** The day they were seeded, in UTC. */
export const SEED_CARD_DAY = "2026-02-16";

export const SEED_CARD_TITLES: readonly string[] = [
  "Battle of Corumm",
  "Cathedral of Stars",
  "History of Ixnay",
  "Port of Alkharsis",
  "The Great Migration",
  "Treaty of Kiro",
];

export interface SeedCardCandidate {
  cardType: string;
  wikiArticleTitle: string | null;
  createdAt: Date;
  title: string;
}

/** A Lore card with no article, created on the seed day (UTC), under one of the six titles. */
export function isSeedCard(card: SeedCardCandidate): boolean {
  return (
    card.cardType === "LORE" &&
    card.wikiArticleTitle === null &&
    card.createdAt.toISOString().slice(0, 10) === SEED_CARD_DAY &&
    SEED_CARD_TITLES.includes(card.title)
  );
}
