/**
 * ThinkPages accounts the IxTwitter Discord sync (`~/lib/discord/ixtwitter-sync`) creates.
 *
 * The sync mirrors every IxTwitter poster and every `@handle` they post as into a ThinkPages
 * account owned by a synthetic Clerk id (`system_ixtwitter_<discord name>` or
 * `system_ixtwitter_handle_<handle>`). Those rows hold the unique username, so without a claim
 * path any name ever used on IxTwitter is unavailable to a real member forever.
 *
 * An unclaimed imported account is therefore claimable: creating a persona with its username
 * transfers the row (and its post history) to the member instead of failing. Imports tied to a
 * known nation (`verified`, set by the sync for mapped Discord users) may only be claimed for that
 * same nation; "Former Nation" imports (unverified, parked on a placeholder country) are open.
 */

/** The synthetic Clerk id prefix every IxTwitter-imported account carries until it is claimed. */
export const IXTWITTER_IMPORT_OWNER_PREFIX = "system_ixtwitter_";

/** True when the account was made by the IxTwitter sync and no member has claimed it yet. */
export function isUnclaimedImportedAccount(account: { clerkUserId: string }): boolean {
  return account.clerkUserId.startsWith(IXTWITTER_IMPORT_OWNER_PREFIX);
}

/**
 * Whether a member creating a persona for `targetCountryId` may claim this imported account.
 * Without a target country (the public availability check before a country is known) only
 * nation-agnostic imports count as claimable.
 */
export function canClaimImportedAccount(
  account: { clerkUserId: string; countryId: string | null; verified: boolean },
  targetCountryId?: string | null
): boolean {
  if (!isUnclaimedImportedAccount(account)) return false;
  if (!account.verified) return true;
  return !!targetCountryId && account.countryId === targetCountryId;
}
