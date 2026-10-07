import { DEFAULT_REALM_ID, IXWORLD_SLUG } from "./realm-ids";

/**
 * Whether a country page offers "Claim this nation": the nation has no owner and belongs to a realm (other than
 * IxWorld, whose open nations are taken from /setup) that is open to claims. Client-safe; reads the loaded
 * country record (`owner`/`ownerUserId` and `realm { slug, status }`).
 */
export function claimableNation(country: {
  id?: unknown;
  name?: unknown;
  ownerUserId?: unknown;
  owner?: unknown;
  realm?: { slug?: unknown; status?: unknown } | null;
}): { countryId: string; countryName: string } | null {
  if (country.owner || country.ownerUserId) return null;
  const slug = typeof country.realm?.slug === "string" ? country.realm.slug : null;
  if (!slug || slug === IXWORLD_SLUG || slug === DEFAULT_REALM_ID) return null;
  if (country.realm?.status !== "active") return null;
  if (typeof country.id !== "string" || typeof country.name !== "string") return null;
  return { countryId: country.id, countryName: country.name.replace(/_/g, " ") };
}
