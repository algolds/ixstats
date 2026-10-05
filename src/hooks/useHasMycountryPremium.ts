"use client";

import { useAbility } from "~/components/providers/AbilityProvider";
import { useIsBetaTester } from "~/hooks/usePermissions";

/** MyCountry sections the premium ability gates (`PREMIUM_SECTIONS` in `~/lib/auth/ability`). */
type PremiumSection = "defense" | "intelligence" | "map-editor";

/**
 * Whether the user gets MyCountry's premium tools: the premium ability (premium tier, owner,
 * admin, staff) or the beta-tester role. The one client check behind the Defense sidebar row,
 * the Defense page lock and the Map editor action; the server gate accepts the same users.
 */
export function useHasMycountryPremium(section: PremiumSection): boolean {
  const hasAbility = useAbility().can("access", "MyCountryFeature", section);
  const isBetaTester = useIsBetaTester();
  return hasAbility || isBetaTester;
}
