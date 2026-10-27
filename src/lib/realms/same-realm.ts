/**
 * The cross-realm rule (realm clocks design §3; realm time design, carried over): nations of two realms do not
 * interact as countries, since each realm runs on its own clock. Client-safe, so a picker offers only the nations
 * the server would accept; the server guard is `~/server/shared/same-realm-guard`.
 */
import { DEFAULT_REALM_ID } from "./realm-ids";

/** The refusal every country-to-country action gives across realms. */
export const SAME_REALM_MESSAGE = "Both nations must be in the same realm";

/** A realm id as rows carry it; a missing one (older rows, test doubles) counts as Ixnay's, like Country's default. */
export type RealmRef = string | null | undefined;

/** Whether two nations' realms are the same realm. */
export function sameRealm(a: RealmRef, b: RealmRef): boolean {
  return (a ?? DEFAULT_REALM_ID) === (b ?? DEFAULT_REALM_ID);
}

/** The nations a picker may offer: those of the viewer's realm (all of them while the viewer's realm is unknown). */
export function nationsInRealm<T extends { realmId?: RealmRef }>(
  nations: readonly T[],
  realmId: RealmRef
): T[] {
  if (realmId === undefined) return [...nations];
  return nations.filter((n) => sameRealm(n.realmId, realmId));
}
