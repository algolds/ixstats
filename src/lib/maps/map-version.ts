/** The largest map version: `Realm.mapVersion` is a 32-bit integer, and from a realm's first edit on it is the epoch
 * second (ten digits), never below it (`invalidateRealmMap`). */
export const MAX_MAP_VERSION = 2_147_483_647;

/** A map version from a URL segment (digits only, up to `MAX_MAP_VERSION`), else null. */
export function parseMapVersion(segment: string): number | null {
  if (!/^\d{1,10}$/.test(segment)) return null;
  const version = Number(segment);
  return version <= MAX_MAP_VERSION ? version : null;
}
