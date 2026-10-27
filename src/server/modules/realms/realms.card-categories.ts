/**
 * Who manages a realm's card categories, in Manage → Cards: the founder, or any site admin, never an officer. The
 * router authorises here and hands the cards module the realm's id.
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { realmSlugWhere } from "~/lib/realms/realm-ids";
import { canModerateRealm, isSiteAdmin, type RealmActor } from "./realms.access";

export interface CardCategoryRealm {
  id: string;
  /** The edit is a site admin's rather than the founder's. */
  asSiteAdmin: boolean;
}

/** The realm whose card categories `actor` manages. An archived realm is read, never written. */
export async function loadCardCategoryRealm(
  db: Pick<PrismaClient, "realm">,
  actor: RealmActor,
  slug: string,
  { write }: { write: boolean }
): Promise<CardCategoryRealm> {
  const realm = await db.realm.findUnique({
    where: realmSlugWhere(slug),
    select: { id: true, ownerId: true, status: true },
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
  return { id: realm.id, asSiteAdmin: isSiteAdmin(actor) };
}
