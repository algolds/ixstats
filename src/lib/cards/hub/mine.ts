// src/lib/cards/hub/mine.ts
import { CardFinish, CardRarity, CardType } from "@prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  CategoryFilter,
  UNCATEGORISED,
  type CategoryFilterValue,
} from "~/lib/cards/category-enums";
import { loadCopyValues, type ValueDb } from "~/lib/cards/copy-value";
import { filterFacets, type FilterFacets } from "~/lib/cards/face/filter-facets";
import { rarityRank } from "~/lib/cards/face/labels";
import { MINE_SORTS, type MineSort } from "~/lib/cards/face/mine-options";
import type { CardFaceData, CardRealmBadge } from "~/lib/cards/face/types";
import { offeredCopyIds } from "~/lib/cards/trade/offered-copies";
import { CARD_FACE_SELECT, COPY_FACE_SELECT, toCardFace, toRealmBadge } from "./faces";

/**
 * Mine's filters, search, sort and page (spec §2.3 Mine). `cursor` is an offset. `copyId` finds one copy, as the Sell
 * picker does for the copy a `?sell=` link names, wherever it falls in the pages.
 */
export const MineQuerySchema = z.object({
  copyId: z.string().min(1).max(64).optional(),
  realmId: z.string().min(1).max(64).optional(),
  rarities: z.array(z.enum(CardRarity)).max(6).optional(),
  finishes: z.array(z.enum(CardFinish)).max(4).optional(),
  types: z.array(z.enum(CardType)).max(5).optional(),
  categories: z.array(z.enum(CategoryFilter)).max(20).optional(),
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
  // The copy's own inscription text decides whether it breaks down; the signer's id and frozen name are never read.
  inscription: true,
  importDiscounted: true,
  cards: { select: { ...CARD_FACE_SELECT, category: true, isBound: true } },
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
  /** A trophy or achievement-reward copy, which can never be traded, listed or transferred. */
  isBound: boolean;
  /** For the bulk actions: a signed copy never breaks down or fuses, and an imported one breaks down for its share. */
  inscription: string | null;
  importDiscounted: boolean;
  /** Named in a pending trade offer, on either side, which the workshop counts as a lock (`judgedCopiesTx`). */
  inOffer: boolean;
}

export interface MinePage {
  rows: MineRow[];
  total: number;
  nextCursor: number | null;
  /** Every realm the player holds a card from, for the realm filter. */
  realms: CardRealmBadge[];
  totalCopies: number;
  /** The types and categories of every copy the player holds, before the filters, for the filters' choices. */
  facets: FilterFacets;
}

function inList<T>(list: readonly T[] | undefined, value: T): boolean {
  return !list?.length || list.includes(value);
}

/** A card with no category matches only Uncategorised, and only when it is a lore card. */
function matchesCategory(
  values: readonly CategoryFilterValue[] | undefined,
  card: MineCopyRow["cards"]
): boolean {
  if (!values?.length) return true;
  if (card.category !== null) return values.includes(card.category);
  return card.cardType === "LORE" && values.includes(UNCATEGORISED);
}

function matchesFacets({ row }: MineEntry, query: MineQuery): boolean {
  const card = row.cards;
  return (
    (!query.realmId || card.realm.id === query.realmId) &&
    inList(query.rarities, card.rarity) &&
    inList(query.finishes, row.finish) &&
    inList(query.types, card.cardType) &&
    matchesCategory(query.categories, card)
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
    (!query.copyId || entry.row.id === query.copyId) &&
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
      face: toCardFace(row.cards, { collected: true, copy: row }),
      value,
      copies: copies.get(row.cardId) ?? 1,
      acquiredAt: row.acquiredAt,
      isLocked: row.isLocked,
      isBound: row.cards.isBound,
      inscription: row.inscription,
      importDiscounted: row.importDiscounted,
      // The pure selection reads no offers; listMine marks the page's.
      inOffer: false,
    })),
    total: picked.length,
    nextCursor: next < picked.length ? next : null,
    realms: [...realms.values()].sort((a, b) => a.name.localeCompare(b.name)),
    totalCopies: entries.length,
    facets: filterFacets(entries.map(({ row }) => row.cards)),
  };
}

/** Far above any inventory (capacity is 150 plus upgrades); only a guard against a runaway account. */
const MAX_MINE_COPIES = 5000;

/**
 * Mine: every copy the player holds, retired cards included (spec §3), valued by the shared per-copy value. The copies
 * on the page a pending trade offer names are marked, read for that page alone so the offer predicate stays small.
 */
export async function listMine(
  db: Pick<PrismaClient, "cardOwnership" | "tradeOffer"> & ValueDb,
  ownerId: string,
  query: MineQuery
): Promise<MinePage> {
  const [rows, values] = await Promise.all([
    db.cardOwnership.findMany({
      where: { ownerId },
      select: MINE_COPY_SELECT,
      // The id breaks timestamp ties, and the sorts are stable, so offset paging is deterministic for every sort.
      orderBy: [{ acquiredAt: "desc" }, { id: "asc" }],
      take: MAX_MINE_COPIES,
    }),
    loadCopyValues(db, { ownerIds: [ownerId] }),
  ]);
  // A hidden (retired) copy has no value there, so it is worth nothing, as in the Wallet's figures and the dividend.
  const valueOf = new Map(values.map((v) => [v.ownershipId, v.value]));
  const page = selectMine(
    rows.map((row) => ({ row, value: valueOf.get(row.id) ?? 0 })),
    query
  );
  const ids = page.rows.flatMap((row) => (row.face.copy ? [row.face.copy.ownershipId] : []));
  const offered = await offeredCopyIds(db, ids);
  return {
    ...page,
    rows: page.rows.map((row) => ({
      ...row,
      inOffer: row.face.copy !== null && offered.has(row.face.copy.ownershipId),
    })),
  };
}
