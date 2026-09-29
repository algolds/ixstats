import type { PrismaClient } from "@prisma/client";
import { ALL_REALMS, realmScopeInput } from "~/lib/realms/realm-ids";
import { isSiteAdmin, resolveViewerRealmId, type RealmActor } from "~/server/modules/realms";

export { realmScopeInput };

export function viewerRealmId(
  ctx: { db: Pick<PrismaClient, "realm">; user?: { country?: { realmId?: string | null } | null } | null },
  realmSlug?: string
): Promise<string> {
  return resolveViewerRealmId(ctx.db, { realmSlug, activeRealmId: ctx.user?.country?.realmId });
}

/**
 * The `where` fragment of a realm-scoped listing: the viewer's realm, or no filter (every realm) when a
 * site admin passes "*". A non-admin's "*" is ignored — they get their own realm.
 */
export async function realmWhere(
  ctx: {
    db: Pick<PrismaClient, "realm">;
    user?: (RealmActor & { country?: { realmId?: string | null } | null }) | null;
  },
  realmSlug?: string
): Promise<{ realmId?: string }> {
  if (realmSlug !== ALL_REALMS) return { realmId: await viewerRealmId(ctx, realmSlug) };
  return ctx.user && isSiteAdmin(ctx.user) ? {} : { realmId: await viewerRealmId(ctx) };
}
