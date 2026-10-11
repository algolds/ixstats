import { z } from "zod";

/** Ixnay — tenant 0. Client-safe; `~/server/modules/realms` re-exports it for the server. */
export const DEFAULT_REALM_ID = "default";

/** `Realm.status` values nobody but the realm's staff can see (unpublished). One rule for every reader and list. */
export const UNPUBLISHED_REALM_STATUSES = ["draft", "generating"] as const;

/** Whether a realm status is unpublished (draft or generating). */
export function isUnpublishedStatus(status: string | null | undefined): boolean {
  return UNPUBLISHED_REALM_STATUSES.some((unpublished) => unpublished === status);
}

/** `realm: ALL_REALMS` asks a realm-scoped listing for every realm; the server grants it to site admins only (ruling E-o). */
export const ALL_REALMS = "*";

/** The optional `realm` slug a realm-scoped procedure accepts (`?realm=`), or `ALL_REALMS`. */
export const realmScopeInput = z.object({ realm: z.string().max(100).optional() });

/** Ixnay's realm slug (`?realm=ixnay`). */
export const IXNAY_SLUG = "ixnay";

/** Slugs that still name Ixnay: its former slug `ixworld` and the legacy "default", so old links keep working. */
const IXNAY_SLUGS: ReadonlySet<string> = new Set([IXNAY_SLUG, "ixworld", DEFAULT_REALM_ID]);

/** Whether a slug names Ixnay (its slug or a legacy alias). */
export function isIxnaySlug(slug: string): boolean {
  return IXNAY_SLUGS.has(slug);
}

/**
 * Whether a page shows Ixnay: the `?realm=` slug names it, or no slug is given and the viewer's active
 * nation is in Ixnay (or they have none). Mirrors resolveViewerRealmId (decision 4).
 */
export function isIxnayView(realmSlug?: string | null, activeRealmId?: string | null): boolean {
  if (realmSlug) return isIxnaySlug(realmSlug);
  return !activeRealmId || activeRealmId === DEFAULT_REALM_ID;
}
