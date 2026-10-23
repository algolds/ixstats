/**
 * A realm's founder (or a site admin) sets the category of the realm's own lore cards, in Manage → Cards. Every
 * write is `setCardCategory`'s, held to the realm's cards by `realmId`: another realm's card reads as missing, and an
 * NS or Special card is refused there.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { CategoryChoice } from "~/lib/cards/category-taxonomy";
import { realmSlugWhere } from "~/lib/realms/realm-ids";
import { likeLiteral } from "~/lib/utils/like-literal";
import {
  canModerateRealm,
  isSiteAdmin,
  type RealmActor,
} from "~/server/modules/realms/realms.access";
import { setCardCategory } from "./cards.categories";

export const REALM_CATEGORY_SHOWS = ["all", "uncategorised", "review"] as const;
export type RealmCategoryShow = (typeof REALM_CATEGORY_SHOWS)[number];

/**
 * The realm whose card categories `actor` manages: the founder's or any for a site admin, not an officer's. An
 * archived realm is read, never written.
 */
export async function loadCategoryRealm(
  db: Pick<PrismaClient, "realm">,
  actor: RealmActor,
  slug: string,
  { write }: { write: boolean }
): Promise<{ id: string; name: string }> {
  const realm = await db.realm.findUnique({
    where: realmSlugWhere(slug),
    select: { id: true, name: true, ownerId: true, status: true },
  });
  if (!realm) throw new TRPCError({ code: "NOT_FOUND", message: "Realm not found" });
  if (!canModerateRealm(actor, realm)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the realm's founder and site admins edit its card categories",
    });
  }
  if (write && realm.status === "archived") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This realm is archived: its card categories can't be changed",
    });
  }
  return { id: realm.id, name: realm.name };
}

export interface RealmCategoryListInput {
  slug: string;
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

/** The realm's lore cards with their category, by title. */
export async function listRealmCategoryCards(
  db: Pick<PrismaClient, "realm" | "card">,
  actor: RealmActor,
  input: RealmCategoryListInput
) {
  const realm = await loadCategoryRealm(db, actor, input.slug, { write: false });
  const search = input.search?.trim();
  const where: Prisma.CardWhereInput = {
    realmId: realm.id,
    cardType: "LORE",
    ...SHOW_WHERE[input.show],
    ...(search ? { title: { contains: likeLiteral(search), mode: "insensitive" } } : {}),
  };
  const [rows, total] = await Promise.all([
    db.card.findMany({
      where,
      orderBy: [{ title: "asc" }, { id: "asc" }],
      skip: input.offset,
      take: input.limit,
      select: {
        id: true,
        title: true,
        category: true,
        subcategory: true,
        categoryNeedsReview: true,
      },
    }),
    db.card.count({ where }),
  ]);
  return { rows, total };
}

/** A site admin's edit is the admin's; the founder's is the realm owner's. */
export async function setRealmCardCategory(
  db: PrismaClient,
  actor: RealmActor,
  input: { slug: string; cardId: string; choice: CategoryChoice }
): Promise<{ changed: boolean }> {
  const realm = await loadCategoryRealm(db, actor, input.slug, { write: true });
  return setCardCategory(db, {
    cardId: input.cardId,
    realmId: realm.id,
    choice: input.choice,
    source: isSiteAdmin(actor) ? "ADMIN" : "REALM_OWNER",
    editor: { dbId: actor.id, clerkId: actor.clerkUserId },
  });
}
