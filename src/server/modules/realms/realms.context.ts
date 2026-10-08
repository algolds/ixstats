import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID, IXWORLD_SLUG } from "~/lib/realms/realm-ids";
import { isRealmHiddenFrom, type RealmActor } from "./realms.access";

export { DEFAULT_REALM_ID };

/**
 * The realm a slug names, for `viewer`: null for an unknown slug, and for a draft or generating realm's slug
 * unless the viewer is its staff (AT-6). IxWorld's slugs name IxWorld even when it has no realm row.
 */
export async function findRealmIdBySlug(
  db: Pick<PrismaClient, "realm">,
  realmSlug: string,
  viewer?: RealmActor | null
): Promise<string | null> {
  const realm = await db.realm.findUnique({
    where: { slug: realmSlug },
    select: { id: true, status: true, ownerId: true },
  });
  if (realm) return isRealmHiddenFrom(viewer, realm) ? null : realm.id;
  return realmSlug === IXWORLD_SLUG || realmSlug === DEFAULT_REALM_ID ? DEFAULT_REALM_ID : null;
}

/**
 * The realm a viewer is looking at: ?realm=<slug>, else their active nation's realm, else IxWorld (decision 4).
 * A draft or generating realm's slug resolves only for its staff (AT-6); anyone else gets IxWorld, as for an
 * unknown slug.
 */
export async function resolveViewerRealmId(
  db: Pick<PrismaClient, "realm">,
  input: { realmSlug?: string | null; activeRealmId?: string | null; viewer?: RealmActor | null }
): Promise<string> {
  if (input.realmSlug) {
    return (await findRealmIdBySlug(db, input.realmSlug, input.viewer)) ?? DEFAULT_REALM_ID;
  }
  return input.activeRealmId ?? DEFAULT_REALM_ID;
}
