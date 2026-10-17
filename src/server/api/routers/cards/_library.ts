// src/server/api/routers/cards/_library.ts
/** The card library's filters and orders, shared by the players' read (getNSCards) and the admin explorer. */
import type { CardRarity, CardReviewState, CardType, LoreCategory, Prisma } from "@prisma/client";
import { z } from "zod";

export const LIBRARY_SORTS = [
  "marketValue",
  "marketValue_asc",
  "rarity",
  "recent",
  "name",
] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

export const LIBRARY_ORDER: Record<LibrarySort, Prisma.CardOrderByWithRelationInput[]> = {
  marketValue: [{ marketValue: "desc" }],
  marketValue_asc: [{ marketValue: "asc" }],
  name: [{ title: "asc" }],
  recent: [{ createdAt: "desc" }],
  rarity: [{ marketValue: "desc" }],
};

export const cteFilterSchema = z.enum(["all", "cte_only", "active_only"]);

export interface LibraryFilter {
  search?: string;
  season?: number;
  rarity?: CardRarity;
  region?: string;
  cteFilter: z.infer<typeof cteFilterSchema>;
  cardType?: CardType;
  category?: LoreCategory;
  /** true: only retired; false: only live; undefined: both. */
  retired?: boolean;
  /** Only cards in this review state (players see APPROVED only). */
  reviewState?: CardReviewState;
}

/** The library `where`: each filter is one AND term (the CTE and region filters both read metadata). */
export function libraryWhere(filter: LibraryFilter): Prisma.CardWhereInput {
  const and: Prisma.CardWhereInput[] = [];
  const term = filter.search?.trim();
  if (filter.category) and.push({ category: filter.category });
  if (filter.cardType) and.push({ cardType: filter.cardType });
  if (filter.season) and.push({ season: filter.season });
  if (filter.rarity) and.push({ rarity: filter.rarity });
  if (filter.retired !== undefined) and.push({ isRetired: filter.retired });
  if (filter.reviewState) and.push({ reviewState: filter.reviewState });
  if (filter.cteFilter !== "all")
    and.push({ metadata: { path: ["isCTE"], equals: filter.cteFilter === "cte_only" } });
  if (filter.region)
    and.push({ metadata: { path: ["nsData", "region"], string_contains: filter.region } });
  if (term) {
    const contains = { contains: term, mode: "insensitive" as const };
    and.push({ OR: [{ title: contains }, { slug: contains }, { wikiExcerpt: contains }] });
  }
  return { AND: and };
}
