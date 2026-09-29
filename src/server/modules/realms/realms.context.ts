import type { PrismaClient } from "@prisma/client";

/** IxWorld — tenant 0. */
export const DEFAULT_REALM_ID = "default";

/** The realm a viewer is looking at: ?realm=<slug>, else their active nation's realm, else IxWorld (decision 4). */
export async function resolveViewerRealmId(
  db: Pick<PrismaClient, "realm">,
  input: { realmSlug?: string | null; activeRealmId?: string | null }
): Promise<string> {
  if (input.realmSlug) {
    const realm = await db.realm.findUnique({ where: { slug: input.realmSlug }, select: { id: true } });
    return realm?.id ?? DEFAULT_REALM_ID;
  }
  return input.activeRealmId ?? DEFAULT_REALM_ID;
}
