/**
 * Which realm a realm-scoped ranking shows (realm clocks design §3: rankings per realm). `?realm=` names it; without
 * one the server ranks the viewer's realm (their active nation's, Ixnay without one), so the selector shows that.
 * Ixnay's slugs (`ixnay`, `ixworld`, `default`) find its row by id, whatever slug the row carries.
 */
import { DEFAULT_REALM_ID, isIxnaySlug } from "./realm-ids";

interface ListedRealm {
  id: string;
  slug: string;
}

/** The listed realm a ranking shows, or undefined (an unlisted realm opened by link, or the list still loading). */
export function selectedRankingRealm<T extends ListedRealm>(
  realms: readonly T[],
  realmParam: string | undefined,
  viewerRealmId: string | undefined
): T | undefined {
  if (realmParam) {
    return realms.find((r) =>
      isIxnaySlug(realmParam) ? r.id === DEFAULT_REALM_ID : r.slug === realmParam
    );
  }
  return realms.find((r) => r.id === (viewerRealmId ?? DEFAULT_REALM_ID));
}

/**
 * Whether `?realm=` names a realm the directory does not list (a draft, or an unlisted realm opened by link): such a
 * realm has no public ranking. False while the directory loads or when no realm is named.
 */
export function isUnlistedRankingRealm(
  realms: readonly ListedRealm[] | undefined,
  realmParam: string | undefined
): boolean {
  return !!realms && !!realmParam && !selectedRankingRealm(realms, realmParam, undefined);
}
