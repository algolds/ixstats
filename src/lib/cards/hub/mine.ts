// src/lib/cards/hub/mine.ts
import { CardFinish, CardRarity, CardType, LoreCategory } from "@prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { copyValue } from "~/lib/cards/copy-value";
import { rarityRank } from "~/lib/cards/face/labels";
import { MINE_SORTS, type MineSort } from "~/lib/cards/face/mine-options";
import type { CardFaceData, CardRealmBadge } from "~/lib/cards/face/types";
import { CARD_FACE_SELECT, COPY_FACE_SELECT, toCardFace, toRealmBadge } from "./faces";

/** Mine's filters, search, sort and page (spec §2.3 Mine). `cursor` is an offset. */
export const MineQuerySchema = z.object({
  realmId: z.string().min(1).max(64).optional(),
  rarities: z.array(z.enum(CardRarity)).max(6).optional(),
  finishes: z.array(z.enum(CardFinish)).max(4).optional(),
  types: z.array(z.enum(CardType)).max(5).optional(),
  categories: z.array(z.enum(LoreCategory)).max(20).optional(),
  duplicates: z.boolean().optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(MINE_SORTS).default("acquired"),
  cursor: z.number().int().min(0).nullish(),
  limit: z.number().int().min(1).max(120).default(60),
});
export type MineQuery = z.infer<typeof MineQuerySchema>;

const MINE_COPY_SELECT = {
  ...COPY_FACE_SELECT,
  cardId: true,
  acquiredAt: true,
  isLocked: true,
  cards: { select: { ...CARD_FACE_SELECT, category: true, marketValue: true } },
} satisfies Prisma.CardOwnershipSelect;
type MineCopyRow = Prisma.CardOwnershipGetPayload<{ select: typeof MINE_COPY_SELECT }>;

export interface MineEntry {
  row: MineCopyRow;
  value: number;
}

/** One copy in Mine: its face, its value, and how many copies of its card the player holds. */
export interface MineRow {
  face: CardFaceData;
  value: number;
  copies: number;
  acquiredAt: Date;
  isLocked: boolean;
}

export interface MinePage {
  rows: MineRow[];
  total: number;
  nextCursor: number | null;
  /** Every realm the player holds a card from, for the realm filter. */
  realms: CardRealmBadge[];
  totalCopies: number;
}

function inList<T>(list: readonly T[] | undefined, value: T): boolean {
  return !list?.length || list.includes(value);
}

function matchesFacets({ row }: MineEntry, query: MineQuery): boolean {
  const card = row.cards;
  return (
    (!query.realmId || card.realm.id === query.realmId) &&
    inList(query.rarities, card.rarity) &&
    inList(query.finishes, row.finish) &&
    inList(query.types, card.cardType) &&
    (!query.categories?.length ||
      (card.category !== null && query.categories.includes(card.category)))
  );
}

/** `search` is the query's search, lower-cased once by the caller. */
function matches(
  entry: MineEntry,
  query: MineQuery,
  search: string | undefined,
  copies: ReadonlyMap<string, number>
): boolean {
  return (
    matchesFacets(entry, query) &&
    (!query.duplicates || (copies.get(entry.row.cardId) ?? 0) > 1) &&
    (!search || entry.row.cards.title.toLowerCase().includes(search))
  );
}

const byTitle = (a: MineEntry, b: MineEntry) => a.row.cards.title.localeCompare(b.row.cards.title);

const COMPARE: Record<MineSort, (a: MineEntry, b: MineEntry) => number> = {
  acquired: (a, b) => b.row.acquiredAt.getTime() - a.row.acquiredAt.getTime(),
  rarity: (a, b) =>
    rarityRank(b.row.cards.rarity) - rarityRank(a.row.cards.rarity) || byTitle(a, b),
  value: (a, b) => b.value - a.value || byTitle(a, b),
  title: (a, b) => byTitle(a, b) || a.row.serialNumber - b.row.serialNumber,
  level: (a, b) => b.row.level - a.row.level || byTitle(a, b),
};

/** The page of Mine a query asks for. Pure: the whole inventory is in hand (it is capped by capacity). */
export function selectMine(entries: readonly MineEntry[], query: MineQuery): MinePage {
  const copies = new Map<string, number>();
  const realms = new Map<string, CardRealmBadge>();
  for (const { row } of entries) {
    copies.set(row.cardId, (copies.get(row.cardId) ?? 0) + 1);
    realms.set(row.cards.realm.id, toRealmBadge(row.cards.realm));
  }
  const search = query.search?.toLowerCase();
  const picked = entries.filter((e) => matches(e, query, search, copies)).sort(COMPARE[query.sort]);
  const start = query.cursor ?? 0;
  const page = picked.slice(start, start + query.limit);
  const next = start + page.length;
  return {
    rows: page.map(({ row, value }) => ({
      face: toCardFace(row.cards, { revealArt: true, copy: row }),
      value,
      copies: copies.get(row.cardId) ?? 1,
      acquiredAt: row.acquiredAt,
      isLocked: row.isLocked,
    })),
    total: picked.length,
    nextCursor: next < picked.length ? next : null,
    realms: [...realms.values()].sort((a, b) => a.name.localeCompare(b.name)),
    totalCopies: entries.length,
  };
}

/** Far above any inventory (capacity is 150 plus upgrades); only a guard against a runaway account. */
const MAX_MINE_COPIES = 5000;

/** Mine: every copy the player holds, retired cards included (spec §3), valued by the shared per-copy value. */
export async function listMine(
  db: Pick<PrismaClient, "cardOwnership">,
  ownerId: string,
  query: MineQuery
): Promise<MinePage> {
  const rows = await db.cardOwnership.findMany({
    where: { ownerId },
    select: MINE_COPY_SELECT,
    // The id breaks timestamp ties, and the sorts are stable, so offset paging is deterministic for every sort.
    orderBy: [{ acquiredAt: "desc" }, { id: "asc" }],
    take: MAX_MINE_COPIES,
  });
  // A hidden (retired) copy is worth nothing, as in the Wallet's figures and the dividend.
  return selectMine(
    rows.map((row) => ({ row, value: row.cards.isRetired ? 0 : copyValue(row) })),
    query
  );
}
