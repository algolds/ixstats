/**
 * MyCountry Premium: the one definition the server gate (premiumProcedure), the client
 * ability (defineAbilityFor) and users.getMembershipStatus share. Beta testers get the same
 * tools (`isBetaTesterRole`).
 *
 * NEXT_PUBLIC_PREMIUM_FOR_ALL="true" grants premium features (Defense, Intelligence,
 * Map Editor, PvP/PvNPC operations) to every signed-in user — for test and staging builds.
 * It is off unless set, and should stay off in production. It is a NEXT_PUBLIC_ variable
 * so the server gate and the client UI agree (Next.js inlines it into the client bundle at
 * build time, so a change needs a rebuild).
 */

const PREMIUM_TIER = "mycountry_premium";

/** True when NEXT_PUBLIC_PREMIUM_FOR_ALL="true" (test builds). */
function isPremiumForAll(): boolean {
  return process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL === "true";
}

/** Whether a membership tier gets MyCountry Premium features (honours the test switch). */
export function hasPremiumTier(membershipTier: string | null | undefined): boolean {
  return membershipTier === PREMIUM_TIER || isPremiumForAll();
}

/** Role names that count as beta testers (staff and above are included). */
export const BETA_TESTER_ROLE_NAMES: readonly string[] = [
  "owner",
  "admin",
  "staff",
  "beta_tester",
  "beta-tester",
  "beta",
];

/**
 * Whether a database role is a beta tester's: a beta role name, staff level or above (<= 20), or
 * the beta level (90). Beta testers get MyCountry Premium tools alongside premium members; the
 * server gate (premiumMiddleware) and the client (`useHasMycountryPremium`) both read this.
 */
export function isBetaTesterRole(
  roleName: string | null | undefined,
  roleLevel: number | null | undefined
): boolean {
  if (roleName && BETA_TESTER_ROLE_NAMES.includes(roleName)) return true;
  return roleLevel !== null && roleLevel !== undefined && (roleLevel <= 20 || roleLevel === 90);
}
