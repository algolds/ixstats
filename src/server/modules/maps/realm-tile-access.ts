/**
 * Who may read a realm's map tiles (the vector tiles of `/api/map-tiles` and the raster art of
 * `/api/map-rasters`): anyone for IxWorld and published realms, cacheable by any cache; an unpublished realm
 * only for those who may see it, never cached. Server only.
 */
import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import { DEFAULT_REALM_ID, isRealmHiddenFrom, isRealmPublished } from "~/server/modules/realms";

/** "public" (IxWorld, a published realm), "private" (an unpublished realm the viewer may see), else null. */
export async function realmTileAccess(realmId: string): Promise<"public" | "private" | null> {
  if (realmId === DEFAULT_REALM_ID) return "public";
  const realm = await db.realm.findUnique({
    where: { id: realmId },
    select: { status: true, ownerId: true },
  });
  if (!realm) return null;
  if (isRealmPublished(realmId, realm.status)) return "public";
  const { userId } = await auth();
  const viewer = userId
    ? await db.user.findUnique({
        where: { clerkUserId: userId },
        select: { id: true, clerkUserId: true, role: { select: { name: true, level: true } } },
      })
    : null;
  return isRealmHiddenFrom(viewer, realm) ? null : "private";
}

/** The Cache-Control of an unpublished realm's tiles: the viewer's browser only, never stored. */
export const PRIVATE_TILE_CACHE = "private, no-store";
