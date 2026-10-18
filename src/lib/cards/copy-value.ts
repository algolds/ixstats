/**
 * What a copy is worth: the one per-copy value (cards refresh §3, "Data"), loaded for many copies at once. The
 * dividend, the wallet, Passport, achievements, trades, Mine and the sheet all read this, so a copy is worth the same
 * everywhere: `valueOfCopy` from its finish, its level, its finish's market median and (NS cards before their first
 * sale) the bank term. A retired card's copies are left out, so every reader values them at 0.
 */
import { Prisma, type CardFinish, type CardType, type PrismaClient } from "@prisma/client";
import { nsBankValueSql } from "./ns-bank-sql";
import { getValuationConfig, valueOfCopy, type ValueCard } from "./valuation";

export type ValueDb = Pick<
  PrismaClient,
  "cardOwnership" | "card" | "cardMarketPrice" | "systemConfig" | "$queryRaw"
>;

export interface CopyValue {
  ownershipId: string;
  ownerId: string;
  cardId: string;
  cardType: CardType;
  finish: CardFinish;
  value: number;
}

export interface CopyValueFilter {
  ownerIds?: string[];
  ownershipIds?: string[];
  excludeTypes?: CardType[];
}

/** Ids per `IN` list, well under Postgres' bind limit. */
const CHUNK = 5000;
const toCents = (n: number) => Math.round(n * 100) / 100;
const priceKey = (cardId: string, finish: CardFinish) => `${cardId}:${finish}`;

function inChunks<T>(items: T[]): T[][] {
  return Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) =>
    items.slice(i * CHUNK, (i + 1) * CHUNK)
  );
}

function copyWhere(filter: CopyValueFilter): Prisma.CardOwnershipWhereInput {
  const cards: Prisma.CardWhereInput = {
    isRetired: false,
    ...(filter.excludeTypes?.length ? { cardType: { notIn: filter.excludeTypes } } : {}),
  };
  return {
    ...(filter.ownerIds ? { ownerId: { in: filter.ownerIds } } : {}),
    ...(filter.ownershipIds ? { id: { in: filter.ownershipIds } } : {}),
    cards,
  };
}

/** The bank value of each unsold NS card, read from its metadata in SQL. */
async function loadBanks(db: ValueDb, nsIds: string[]): Promise<Map<string, number | null>> {
  if (nsIds.length === 0) return new Map();
  const rows = await db.$queryRaw<Array<{ id: string; bank: number | null }>>`
    SELECT c.id, ${nsBankValueSql("c")} AS bank FROM cards c WHERE c.id IN (${Prisma.join(nsIds)})`;
  return new Map(rows.map((r) => [r.id, r.bank]));
}

async function loadValueCards(db: ValueDb, cardIds: string[]): Promise<Map<string, ValueCard>> {
  const cards = new Map<string, ValueCard>();
  for (const ids of inChunks(cardIds)) {
    const rows = await db.card.findMany({
      where: { id: { in: ids } },
      select: { id: true, rarity: true, cardType: true, firstSoldAt: true, isRetired: true },
    });
    const banks = await loadBanks(
      db,
      rows.filter((r) => r.cardType === "NS" && r.firstSoldAt === null).map((r) => r.id)
    );
    for (const { id, ...card } of rows) {
      cards.set(id, { ...card, nsBankValue: banks.get(id) ?? null });
    }
  }
  return cards;
}

async function loadMedians(db: ValueDb, cardIds: string[]): Promise<Map<string, number>> {
  const medians = new Map<string, number>();
  for (const ids of inChunks(cardIds)) {
    const rows = await db.cardMarketPrice.findMany({
      where: { cardId: { in: ids } },
      select: { cardId: true, finish: true, median: true },
    });
    for (const r of rows) medians.set(priceKey(r.cardId, r.finish), r.median);
  }
  return medians;
}

/** The value of every live copy the filter names, in a fixed number of reads however many copies there are. */
export async function loadCopyValues(db: ValueDb, filter: CopyValueFilter): Promise<CopyValue[]> {
  if (filter.ownerIds?.length === 0 || filter.ownershipIds?.length === 0) return [];
  const copies = await db.cardOwnership.findMany({
    where: copyWhere(filter),
    select: { id: true, ownerId: true, cardId: true, finish: true, level: true },
  });
  if (copies.length === 0) return [];
  const cardIds = [...new Set(copies.map((c) => c.cardId))];
  const [cfg, cards, medians] = await Promise.all([
    getValuationConfig(db),
    loadValueCards(db, cardIds),
    loadMedians(db, cardIds),
  ]);
  return copies.flatMap((copy) => {
    const card = cards.get(copy.cardId);
    if (!card) return [];
    const median = medians.get(priceKey(copy.cardId, copy.finish)) ?? null;
    const value = valueOfCopy({ card, finish: copy.finish, level: copy.level, median }, cfg);
    return [
      {
        ownershipId: copy.id,
        ownerId: copy.ownerId,
        cardId: copy.cardId,
        cardType: card.cardType,
        finish: copy.finish,
        value,
      },
    ];
  });
}

/** Each owner's summed copy values. */
export async function deckValuesByOwner(
  db: ValueDb,
  filter: Omit<CopyValueFilter, "ownershipIds">
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  for (const copy of await loadCopyValues(db, filter)) {
    totals.set(copy.ownerId, (totals.get(copy.ownerId) ?? 0) + copy.value);
  }
  for (const [ownerId, total] of totals) totals.set(ownerId, toCents(total));
  return totals;
}

/** One owner's deck: the display total (trophies included), the figure without trophies, and the copy count. */
export async function deckValueOf(
  db: ValueDb,
  ownerId: string
): Promise<{ total: number; exTrophy: number; copies: number }> {
  const copies = await loadCopyValues(db, { ownerIds: [ownerId] });
  const sum = (list: CopyValue[]) => toCents(list.reduce((acc, c) => acc + c.value, 0));
  return {
    total: sum(copies),
    exTrophy: sum(copies.filter((c) => c.cardType !== "TROPHY")),
    copies: copies.length,
  };
}

/** The better of two copies of one card: the higher value, then the lower copy id, so the pick never depends on order. */
const beats = (a: CopyValue, b: CopyValue) =>
  a.value > b.value || (a.value === b.value && a.ownershipId < b.ownershipId);

/** An owner's most valuable copies, the best copy of each card, best first. */
export async function topCopiesByValue(
  db: ValueDb,
  ownerId: string,
  limit: number
): Promise<CopyValue[]> {
  const best = new Map<string, CopyValue>();
  for (const copy of await loadCopyValues(db, { ownerIds: [ownerId] })) {
    const current = best.get(copy.cardId);
    if (!current || beats(copy, current)) best.set(copy.cardId, copy);
  }
  return [...best.values()]
    .sort((a, b) => b.value - a.value || a.cardId.localeCompare(b.cardId))
    .slice(0, limit);
}
