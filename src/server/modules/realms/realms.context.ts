import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { isRealmHiddenFrom, type RealmActor } from "./realms.access";

export { DEFAULT_REALM_ID };

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
    const realm = await db.realm.findUnique({
      where: { slug: input.realmSlug },
      select: { id: true, status: true, ownerId: true },
    });
    if (!realm || isRealmHiddenFrom(input.viewer, realm)) return DEFAULT_REALM_ID;
    return realm.id;
  }
  return input.activeRealmId ?? DEFAULT_REALM_ID;
}
