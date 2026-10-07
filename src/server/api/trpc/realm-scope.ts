import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { ALL_REALMS, realmScopeInput } from "~/lib/realms/realm-ids";
import {
  isSiteAdmin,
  realmMapAccess,
  resolveViewerRealmId,
  type RealmActor,
} from "~/server/modules/realms";

export { realmScopeInput };

export function viewerRealmId(
  ctx: {
    db: Pick<PrismaClient, "realm">;
    user?: (Partial<RealmActor> & { country?: { realmId?: string | null } | null }) | null;
  },
  realmSlug?: string
): Promise<string> {
  const viewer = ctx.user?.id && ctx.user.clerkUserId ? (ctx.user as RealmActor) : null;
  return resolveViewerRealmId(ctx.db, {
    realmSlug,
    activeRealmId: ctx.user?.country?.realmId,
    viewer,
  });
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

/**
 * The realm a world-mode map editor works in (`?realm=`, else the viewer's realm), once the caller may edit its
 * map: site admins anywhere, a realm's founder and its officers holding the `map` power in that realm only
 * (`canEditRealmMap`). Throws FORBIDDEN otherwise, so IxWorld stays admin-only.
 */
export async function editableMapRealmId(
  ctx: {
    db: Pick<PrismaClient, "realm">;
    user?: (Partial<RealmActor> & { country?: { realmId?: string | null } | null }) | null;
  },
  realmSlug?: string
): Promise<string> {
  const realmId = await viewerRealmId(ctx, realmSlug);
  const actor = ctx.user?.id && ctx.user.clerkUserId ? (ctx.user as RealmActor) : null;
  const access = await realmMapAccess(ctx.db, actor, realmId);
  if (!access.canEdit) {
    throw new TRPCError({
      code: actor ? "FORBIDDEN" : "UNAUTHORIZED",
      message: access.reason ?? "You can't edit this map",
    });
  }
  return realmId;
}
