import { z } from "zod";

/** IxWorld — tenant 0. Client-safe; `~/server/modules/realms` re-exports it for the server. */
export const DEFAULT_REALM_ID = "default";

/** `realm: ALL_REALMS` asks a realm-scoped listing for every realm; the server grants it to site admins only (ruling E-o). */
export const ALL_REALMS = "*";

/** The optional `realm` slug a realm-scoped procedure accepts (`?realm=`), or `ALL_REALMS`. */
export const realmScopeInput = z.object({ realm: z.string().max(100).optional() });
