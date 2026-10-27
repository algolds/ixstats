import type { PrismaClient } from "@prisma/client";
import type { MapUpdateEvent } from "~/lib/maps/map-update-bus";

// Most map writes name a country, not a realm. The live-sync stream gives each such change the country's realm
// before it goes out, so a viewer of another realm can ignore it. A country's realm almost never changes, and every
// connected viewer asks for every change, so the answer is memoised per country (the pending lookup too, which
// connections share).

const REALM_TTL_MS = 60_000;
const MAX_COUNTRIES = 2_000;

type CountryReader = { country: Pick<PrismaClient["country"], "findUnique"> };

const realmOfCountry = new Map<string, { at: number; realm: Promise<string | undefined> }>();

function lookupRealm(db: CountryReader, countryId: string): Promise<string | undefined> {
  const hit = realmOfCountry.get(countryId);
  if (hit && Date.now() - hit.at < REALM_TTL_MS) return hit.realm;
  if (realmOfCountry.size >= MAX_COUNTRIES) realmOfCountry.clear();
  const realm = db.country
    .findUnique({ where: { id: countryId }, select: { realmId: true } })
    .then((row) => row?.realmId)
    .catch(() => {
      realmOfCountry.delete(countryId);
      return undefined;
    });
  realmOfCountry.set(countryId, { at: Date.now(), realm });
  return realm;
}

/**
 * The event with the realm of its country when the writer named only the country. An event that names a realm, or
 * neither, or a country with no answer (unknown, or the lookup failed) is returned as it is: every realm's viewers
 * then treat it as their own.
 */
export async function resolveEventRealm(
  db: CountryReader,
  event: MapUpdateEvent
): Promise<MapUpdateEvent> {
  if (event.realmId || !event.countryId) return event;
  const realmId = await lookupRealm(db, event.countryId);
  return realmId ? { ...event, realmId } : event;
}
