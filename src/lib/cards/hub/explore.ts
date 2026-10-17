// src/lib/cards/hub/explore.ts
import { CardRarity, CardType, LoreCategory } from "@prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { normalizeArtwork } from "~/lib/cards/face/artwork";
import { EXPLORE_SORTS, OWNED_FILTERS, type ExploreSort } from "~/lib/cards/face/explore-options";
import type { CardFaceData, CardRealmBadge } from "~/lib/cards/face/types";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { cardsWithVisibleArt, facesFor } from "./art-visibility";
import { CATALOGUE_WHERE } from "./catalogue";
import { CARD_FACE_SELECT, toCardFace, toRealmBadge } from "./faces";

type ArtDb = Pick<PrismaClient, "cardOwnership" | "cardAuction">;

/** Explore's grid filters (spec §2.3: realm, rarity, type, category; region and season for NS cards). */
export const ExploreQuerySchema = z.object({
  realmId: z.string().min(1).max(64).optional(),
  rarities: z.array(z.enum(CardRarity)).max(6).optional(),
  types: z.array(z.enum(CardType)).max(5).optional(),
  categories: z.array(z.enum(LoreCategory)).max(20).optional(),
  region: z.string().trim().min(1).max(100).optional(),
  season: z.number().int().min(1).max(99).optional(),
  owned: z.enum(OWNED_FILTERS).default("all"),
  search: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(EXPLORE_SORTS).default("newest"),
  cursor: z.number().int().min(0).nullish(),
  limit: z.number().int().min(1).max(96).default(48),
});
export type ExploreQuery = z.infer<typeof ExploreQuerySchema>;

function ownedWhere(owned: ExploreQuery["owned"], viewerId: string): Prisma.CardWhereInput {
  if (owned === "owned") return { CardOwnership: { some: { ownerId: viewerId } } };
  if (owned === "missing") return { CardOwnership: { none: { ownerId: viewerId } } };
  return {};
}

/** The catalogue narrowed by the grid's filters. Trophy cards stay in the grid (they leave only the shelves). */
export function exploreWhere(query: ExploreQuery, viewerId: string): Prisma.CardWhereInput {
  return {
    ...CATALOGUE_WHERE,
    ...(query.realmId ? { realmId: query.realmId } : {}),
    ...(query.rarities?.length ? { rarity: { in: query.rarities } } : {}),
    ...(query.types?.length ? { cardType: { in: query.types } } : {}),
    ...(query.categories?.length ? { category: { in: query.categories } } : {}),
    ...(query.season ? { season: query.season } : {}),
    ...(query.region ? { metadata: { path: ["nsData", "region"], equals: query.region } } : {}),
    ...(query.search ? { title: { contains: query.search, mode: "insensitive" } } : {}),
    ...ownedWhere(query.owned, viewerId),
  };
}

/** Every sort ends on a unique key, so offset pages never repeat or skip a card. */
const ORDER: Record<ExploreSort, Prisma.CardOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  title: [{ title: "asc" }, { id: "asc" }],
  rarity: [{ rarity: "desc" }, { title: "asc" }, { id: "asc" }],
  wanted: [{ watchlist: { _count: "desc" } }, { createdAt: "desc" }, { id: "asc" }],
};

export function exploreOrderBy(sort: ExploreSort): Prisma.CardOrderByWithRelationInput[] {
  return ORDER[sort];
}

export interface ExplorePage {
  faces: CardFaceData[];
  total: number;
  nextCursor: number | null;
}

/** The filtered grid: every approved card, silhouettes for the ones the viewer has not collected. */
export async function exploreGrid(
  db: Pick<PrismaClient, "card"> & ArtDb,
  viewerId: string,
  query: ExploreQuery
): Promise<ExplorePage> {
  const where = exploreWhere(query, viewerId);
  const skip = query.cursor ?? 0;
  const [total, rows] = await Promise.all([
    db.card.count({ where }),
    db.card.findMany({
      where,
      orderBy: exploreOrderBy(query.sort),
      skip,
      take: query.limit,
      select: CARD_FACE_SELECT,
    }),
  ]);
  const faces = await facesFor(
    db,
    viewerId,
    rows.map((card) => ({ card }))
  );
  const next = skip + rows.length;
  return { faces, total, nextCursor: next < total ? next : null };
}

export interface ShelfCard {
  face: CardFaceData;
  /** Players wishing for it (anonymous totals, spec §2.3 Wishlist). */
  wanted: number;
}

export interface RealmShelf {
  realm: CardRealmBadge;
  bannerUrl: string | null;
  cardCount: number;
  newest: ShelfCard[];
  mostWanted: ShelfCard[];
}

const SHELF_SIZE = 6;
const MAX_SHELVES = 12;
const SHELF_SELECT = {
  ...CARD_FACE_SELECT,
  _count: { select: { watchlist: true } },
} satisfies Prisma.CardSelect;
type ShelfRow = Prisma.CardGetPayload<{ select: typeof SHELF_SELECT }>;

/** Only public realms get a shelf; an unlisted realm's cards are still in the grid. */
const SHELF_CATALOGUE_WHERE = {
  ...CATALOGUE_WHERE,
  realm: { ...CATALOGUE_WHERE.realm, visibility: "public" },
} satisfies Prisma.CardWhereInput;

/** Ixnay first (it is the home world), then the realms with the most cards. */
function shelfOrder(
  a: { realmId: string; count: number },
  b: { realmId: string; count: number }
): number {
  if (a.realmId === DEFAULT_REALM_ID) return -1;
  if (b.realmId === DEFAULT_REALM_ID) return 1;
  return b.count - a.count;
}

/** A shelf's two strips. Trophy cards stay off them: every Loreward place would crowd Ixnay's newest. */
async function shelfStrips(
  db: Pick<PrismaClient, "card">,
  realmId: string
): Promise<{ newest: ShelfRow[]; wanted: ShelfRow[] }> {
  const where = {
    ...CATALOGUE_WHERE,
    realmId,
    cardType: { not: "TROPHY" },
  } satisfies Prisma.CardWhereInput;
  const [newest, wanted] = await Promise.all([
    db.card.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: SHELF_SIZE,
      select: SHELF_SELECT,
    }),
    db.card.findMany({
      where: { ...where, watchlist: { some: {} } },
      orderBy: [{ watchlist: { _count: "desc" } }, { id: "asc" }],
      take: SHELF_SIZE,
      select: SHELF_SELECT,
    }),
  ]);
  return { newest, wanted };
}

/** The realm shelves (spec §2.3 Explore): banner, card count, the newest cards and the most wanted. */
export async function exploreShelves(
  db: Pick<PrismaClient, "card" | "realm"> & ArtDb,
  viewerId: string
): Promise<RealmShelf[]> {
  const groups = await db.card.groupBy({
    by: ["realmId"],
    where: SHELF_CATALOGUE_WHERE,
    _count: { _all: true },
  });
  if (groups.length === 0) return [];
  const ordered = groups
    .map((g) => ({ realmId: g.realmId, count: g._count._all }))
    .sort(shelfOrder)
    .slice(0, MAX_SHELVES);
  const [realms, strips] = await Promise.all([
    db.realm.findMany({
      where: { id: { in: ordered.map((g) => g.realmId) } },
      select: {
        id: true,
        slug: true,
        name: true,
        emblemUrl: true,
        isSystem: true,
        bannerUrl: true,
      },
    }),
    Promise.all(ordered.map((g) => shelfStrips(db, g.realmId))),
  ]);
  const visible = await cardsWithVisibleArt(
    db,
    viewerId,
    strips.flatMap((s) => [...s.newest, ...s.wanted].map((c) => c.id))
  );
  const shelfCard = (row: ShelfRow): ShelfCard => ({
    face: toCardFace(row, { revealArt: visible.has(row.id) }),
    wanted: row._count.watchlist,
  });
  const realmById = new Map(realms.map((r) => [r.id, r]));
  return ordered.flatMap((group, index) => {
    const realm = realmById.get(group.realmId);
    const strip = strips[index];
    if (!realm || !strip) return [];
    return [
      {
        realm: toRealmBadge(realm),
        bannerUrl: normalizeArtwork(realm.bannerUrl),
        cardCount: group.count,
        newest: strip.newest.map(shelfCard),
        mostWanted: strip.wanted.map(shelfCard),
      },
    ];
  });
}

/** NationStates regions with cards, most cards first, for the region filter (spec §2.1: region stays a filter). */
export async function exploreRegions(db: Pick<PrismaClient, "$queryRaw">): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ region: string }>>`
    SELECT metadata->'nsData'->>'region' AS region
    FROM cards
    WHERE "cardType" = 'NS' AND "reviewState" = 'APPROVED' AND "isRetired" = false
      AND COALESCE(metadata->'nsData'->>'region', '') <> ''
    GROUP BY 1
    ORDER BY COUNT(*) DESC, 1
    LIMIT 60`;
  return rows.map((r) => r.region);
}
