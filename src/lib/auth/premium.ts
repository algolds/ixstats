/**
 * MyCountry Premium: the one definition the server gate (premiumProcedure), the client
 * ability (defineAbilityFor) and users.getMembershipStatus share.
 *
 * NEXT_PUBLIC_PREMIUM_FOR_ALL="true" grants premium features (Defense, Intelligence,
 * Map Editor, PvP/PvNPC operations) to every signed-in user — for test and staging builds.
 * It is off unless set, and should stay off in production. It is a NEXT_PUBLIC_ variable
 * so the server gate and the client UI agree (Next.js inlines it into the client bundle at
 * build time, so a change needs a rebuild).
 */

export const PREMIUM_TIER = "mycountry_premium";

/** True when NEXT_PUBLIC_PREMIUM_FOR_ALL="true" (test builds). */
export function isPremiumForAll(): boolean {
  return process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL === "true";
}

/** Whether a membership tier gets MyCountry Premium features (honours the test switch). */
export function hasPremiumTier(membershipTier: string | null | undefined): boolean {
  return membershipTier === PREMIUM_TIER || isPremiumForAll();
}
