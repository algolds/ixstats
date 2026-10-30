import { isIxnaySlug } from "./realm-ids";

/**
 * Whether a country page offers "Claim this nation": the nation has no owner, is open to claims (a founder can
 * reserve a generated nation as scenery: `claimable` false) and belongs to a realm (other than Ixnay, whose open
 * nations are taken from /setup) that is open to claims. Client-safe; reads the loaded country record
 * (`owner`/`ownerUserId`, `claimable` and `realm { slug, status }`).
 */
export function claimableNation(country: {
  id?: unknown;
  name?: unknown;
  ownerUserId?: unknown;
  owner?: unknown;
  claimable?: boolean;
  realm?: { slug?: unknown; status?: unknown } | null;
}): { countryId: string; countryName: string } | null {
  if (country.owner || country.ownerUserId) return null;
  if (country.claimable === false) return null;
  const slug = typeof country.realm?.slug === "string" ? country.realm.slug : null;
  if (!slug || isIxnaySlug(slug)) return null;
  if (country.realm?.status !== "active") return null;
  if (typeof country.id !== "string" || typeof country.name !== "string") return null;
  return { countryId: country.id, countryName: country.name.replace(/_/g, " ") };
}

/** The hint beside a claim for a player who holds a nation already: a claim adds to their nations and never moves
 * the one they act as (assignNation, ruling F-1). */
export const CLAIM_ADDS_TO_HOLDINGS =
  "Adds to the nations you hold. Your active nation stays the same.";
