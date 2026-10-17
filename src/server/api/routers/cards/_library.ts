// src/server/api/routers/cards/_library.ts
/** The card library's filters and orders, for the players' read (getNSCards). The admin Library has its own. */
import type { CardRarity, Prisma } from "@prisma/client";
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
}

/**
 * The library `where`: live, approved cards only (players never see a retired or pending one), then each filter as
 * one AND term (the CTE and region filters both read metadata).
 */
export function libraryWhere(filter: LibraryFilter): Prisma.CardWhereInput {
  const and: Prisma.CardWhereInput[] = [{ isRetired: false }, { reviewState: "APPROVED" }];
  const term = filter.search?.trim();
  if (filter.season) and.push({ season: filter.season });
  if (filter.rarity) and.push({ rarity: filter.rarity });
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
