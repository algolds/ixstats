/**
 * Who may read a realm's map tiles (the vector tiles of `/api/map-tiles` and the raster art of
 * `/api/map-rasters`): anyone for Ixnay and published realms, cacheable by any cache; an unpublished realm
 * only for those who may see it, never cached. Server only.
 *
 * Tile URLs name the realm by id or by slug. The realm row (status, owner) is memoised for 60 s, since every tile
 * request needs it; the answer for the viewer never is, so an unpublished realm's "private" for its staff cannot
 * reach an anonymous viewer.
 */
import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import { DEFAULT_REALM_ID, isRealmHiddenFrom, isRealmPublished } from "~/server/modules/realms";
import { isIxnaySlug } from "~/lib/realms/realm-ids";
import { onMapInvalidated } from "~/server/shared/map-invalidation";

const ROW_TTL_MS = 60_000;
const REALM_SELECT = { id: true, status: true, ownerId: true } as const;

interface RealmRow {
  id: string;
  status: string;
  ownerId: string;
}

/** Realm rows by the id or slug a URL named them with (only realms that exist, so at most 2 per realm). */
const rows = new Map<string, { row: RealmRow; at: number }>();

// A realm whose map was invalidated may have changed status too: read it again
onMapInvalidated((realmId) => {
  for (const [name, { row }] of rows) if (realmId === null || row.id === realmId) rows.delete(name);
});

async function findRealm(name: string): Promise<RealmRow | null> {
  const hit = rows.get(name);
  if (hit && Date.now() - hit.at < ROW_TTL_MS) return hit.row;
  const row =
    (await db.realm.findUnique({ where: { id: name }, select: REALM_SELECT })) ??
    (await db.realm.findUnique({ where: { slug: name }, select: REALM_SELECT }));
  if (row) rows.set(name, { row, at: Date.now() });
  return row;
}

async function currentViewer() {
  const { userId } = await auth();
  if (!userId) return null;
  return db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true, clerkUserId: true, role: { select: { name: true, level: true } } },
  });
}

/** The realm a tile URL names (by id or slug) and how the viewer may read it. */
export interface TileRealm {
  id: string;
  /** "public": Ixnay or a published realm. "private": an unpublished realm the viewer may see. */
  access: "public" | "private";
}

/** The realm `name` (an id, a slug, or one of Ixnay's names) means for this viewer; null if unknown or hidden. */
export async function resolveTileRealm(name: string): Promise<TileRealm | null> {
  if (isIxnaySlug(name)) return { id: DEFAULT_REALM_ID, access: "public" };
  const realm = await findRealm(name);
  if (!realm) return null;
  if (isRealmPublished(realm.id, realm.status)) return { id: realm.id, access: "public" };
  return isRealmHiddenFrom(await currentViewer(), realm)
    ? null
    : { id: realm.id, access: "private" };
}

/** "public" (Ixnay, a published realm), "private" (an unpublished realm the viewer may see), else null. */
export async function realmTileAccess(realm: string): Promise<TileRealm["access"] | null> {
  return (await resolveTileRealm(realm))?.access ?? null;
}

/** The Cache-Control of an unpublished realm's tiles: the viewer's browser only, never stored. */
export const PRIVATE_TILE_CACHE = "private, no-store";
