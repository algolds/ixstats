/**
 * The realm a map URL names. Map URLs carry the realm's id (what `realms.map.version` returns), and accept its slug
 * too, so a hand-written link or an embed's `?realm=` slug works. Server only.
 */
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID, isIxnaySlug } from "~/lib/realms/realm-ids";

/** The id of the realm whose id or slug is `segment`, or null when there is none. Ixnay's slugs name it even
 * without a realm row. Visibility is not checked here: `realmTileAccess` decides who may see an unpublished realm. */
export async function findRealmIdBySlugOrId(
  db: Pick<PrismaClient, "realm">,
  segment: string
): Promise<string | null> {
  if (isIxnaySlug(segment)) return DEFAULT_REALM_ID;
  const realm = await db.realm.findFirst({
    where: { OR: [{ id: segment }, { slug: segment }] },
    select: { id: true },
  });
  return realm?.id ?? null;
}
