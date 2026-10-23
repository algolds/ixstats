/**
 * A realm's founder (or a site admin) sets the category of the realm's own lore cards, in Manage → Cards. The router
 * authorises the realm through the realms module first. Every write is `setCardCategory`'s, held to the realm's cards
 * by `realmId`: another realm's card reads as missing, and an NS or Special card is refused there.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { CategoryChoice } from "~/lib/cards/category-taxonomy";
import { likeLiteral } from "~/lib/utils/like-literal";
import { setCardCategory, type CategoryEditSource } from "./cards.categories";

export const REALM_CATEGORY_SHOWS = ["all", "uncategorised", "review"] as const;
export type RealmCategoryShow = (typeof REALM_CATEGORY_SHOWS)[number];

export interface RealmCategoryListInput {
  search?: string;
  show: RealmCategoryShow;
  offset: number;
  limit: number;
}

const SHOW_WHERE: Record<RealmCategoryShow, Prisma.CardWhereInput> = {
  all: {},
  uncategorised: { category: null },
  review: { categoryNeedsReview: true },
};

/** The realm's live lore cards with their category, by title. A retired card takes no category edits. */
export async function listRealmCategoryCards(
  db: Pick<PrismaClient, "card">,
  realmId: string,
  input: RealmCategoryListInput
) {
  const search = input.search?.trim();
  const where: Prisma.CardWhereInput = {
    realmId,
    cardType: "LORE",
    isRetired: false,
    ...SHOW_WHERE[input.show],
    ...(search ? { title: { contains: likeLiteral(search), mode: "insensitive" } } : {}),
  };
  const [rows, total] = await Promise.all([
    db.card.findMany({
      where,
      orderBy: [{ title: "asc" }, { id: "asc" }],
      skip: input.offset,
      take: input.limit,
      select: { id: true, title: true, category: true, subcategory: true },
    }),
    db.card.count({ where }),
  ]);
  return { rows, total };
}

export interface RealmCategoryEdit {
  realmId: string;
  actor: { id: string; clerkUserId: string };
  /** A site admin's edit is the admin's; the founder's is the realm owner's. */
  source: Extract<CategoryEditSource, "ADMIN" | "REALM_OWNER">;
  cardId: string;
  choice: CategoryChoice;
}

export function setRealmCardCategory(
  db: PrismaClient,
  input: RealmCategoryEdit
): Promise<{ changed: boolean }> {
  return setCardCategory(db, {
    cardId: input.cardId,
    realmId: input.realmId,
    choice: input.choice,
    source: input.source,
    editor: { dbId: input.actor.id, clerkId: input.actor.clerkUserId },
  });
}
