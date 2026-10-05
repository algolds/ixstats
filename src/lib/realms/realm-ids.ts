import { z } from "zod";

/** IxWorld — tenant 0. Client-safe; `~/server/modules/realms` re-exports it for the server. */
export const DEFAULT_REALM_ID = "default";

/** `realm: ALL_REALMS` asks a realm-scoped listing for every realm; the server grants it to site admins only (ruling E-o). */
export const ALL_REALMS = "*";

/** The optional `realm` slug a realm-scoped procedure accepts (`?realm=`), or `ALL_REALMS`. */
export const realmScopeInput = z.object({ realm: z.string().max(100).optional() });

/** IxWorld's realm slug (`?realm=ixworld`). Legacy rows may still carry the slug "default". */
export const IXWORLD_SLUG = "ixworld";

/**
 * Whether a page shows IxWorld: the `?realm=` slug names it, or no slug is given and the viewer's active
 * nation is in IxWorld (or they have none). Mirrors resolveViewerRealmId (decision 4).
 */
export function isIxWorldView(realmSlug?: string | null, activeRealmId?: string | null): boolean {
  if (realmSlug) return realmSlug === IXWORLD_SLUG || realmSlug === DEFAULT_REALM_ID;
  return !activeRealmId || activeRealmId === DEFAULT_REALM_ID;
}
